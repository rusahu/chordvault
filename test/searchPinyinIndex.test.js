process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
const insertSong = db.prepare(
  "INSERT INTO songs (user_id, title, artist, content, visibility, status) VALUES (?, ?, ?, ?, 'public', 'active')"
);
const u = insertUser.run('u').lastInsertRowid;

test('songs_search has a pinyin column', () => {
  const cols = db.prepare('PRAGMA table_info(songs_search)').all().map((c) => c.name);
  assert.ok(cols.includes('pinyin'), `columns were: ${cols.join(',')}`);
});

test('insert populates pinyin as space-stripped toneless lowercase (title+artist)', () => {
  const id = insertSong.run(u, '主的喜樂', '大衛', '{title: 主的喜樂}\n[G]a').lastInsertRowid;
  const row = db.prepare('SELECT pinyin FROM songs_search WHERE rowid = ?').get(id);
  // 主的喜樂 -> zhudexile , 大衛 -> dawei
  assert.equal(row.pinyin, 'zhudexiledawei');
});

test('update recomputes pinyin', () => {
  const id = insertSong.run(u, '平安', '', '{title: 平安}\n[C]b').lastInsertRowid;
  db.prepare("UPDATE songs SET title = '喜樂' WHERE id = ?").run(id);
  const row = db.prepare('SELECT pinyin FROM songs_search WHERE rowid = ?').get(id);
  assert.equal(row.pinyin, 'xile');
});

test('migration: legacy 3-column songs_search is rebuilt with pinyin populated', () => {
  const Database = require('better-sqlite3');
  const path = require('node:path');
  const os = require('node:os');
  const fs = require('node:fs');
  const file = path.join(os.tmpdir(), `cv-migrate-${process.pid}.db`);
  fs.rmSync(file, { force: true });

  // Build a legacy DB: songs table + OLD 3-column FTS with one row.
  const legacy = new Database(file);
  legacy.exec(`
    CREATE TABLE songs (id INTEGER PRIMARY KEY, user_id, title, artist, key, content,
      visibility, parent_id, youtube_url, format_detected, bpm, tags, language, status,
      content_hash, created_at, updated_at);
    CREATE VIRTUAL TABLE songs_search USING fts5(title, artist, lyrics, tokenize='trigram');
    INSERT INTO songs (id, title, artist, content, visibility, status) VALUES (1, '喜樂', '', 'x', 'public', 'active');
  `);
  legacy.close();

  // Re-open through the app's db module in a child process so the migration runs on load.
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(process.execPath, ['-e', `
    process.env.DB_PATH = ${JSON.stringify(file)};
    const { db } = require(${JSON.stringify(path.resolve(__dirname, '../lib/db.js'))});
    const cols = db.prepare('PRAGMA table_info(songs_search)').all().map(c => c.name);
    const row = db.prepare('SELECT pinyin FROM songs_search WHERE rowid = 1').get();
    console.log(JSON.stringify({ cols, pinyin: row && row.pinyin }));
  `]).toString();
  fs.rmSync(file, { force: true });

  const res = JSON.parse(out.trim().split('\n').pop());
  assert.ok(res.cols.includes('pinyin'));
  assert.equal(res.pinyin, 'xile');
});
