process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
const insertSong = db.prepare(
  "INSERT INTO songs (user_id, title, artist, content, visibility, status) VALUES (?, ?, ?, ?, 'public', 'active')"
);
const u = insertUser.run('u').lastInsertRowid;
insertSong.run(u, '主的喜樂', '大衛', '{title: 主的喜樂}\n[G]a');
insertSong.run(u, 'Amazing Grace', 'Newton', '{title: Amazing Grace}\n[C]b');

const titles = (q) => Song.listPublic({ q }).map((r) => r.title);

test('full-syllable pinyin finds the Chinese song', () => {
  assert.deepEqual(titles('xile'), ['主的喜樂']);
});

test('pinyin with spaces is matched (spaces stripped)', () => {
  assert.deepEqual(titles('zhu de'), ['主的喜樂']);
});

test('short (<3 char) pinyin still matches via LIKE fallback', () => {
  // 大衛 -> dawei ; "da" is 2 chars, below the trigram floor
  assert.deepEqual(titles('da'), ['主的喜樂']);
});

test('CJK query still matches (no regression)', () => {
  assert.deepEqual(titles('喜樂'), ['主的喜樂']);
});

test('English query still matches its title, not the pinyin song', () => {
  assert.deepEqual(titles('amazing'), ['Amazing Grace']);
});
