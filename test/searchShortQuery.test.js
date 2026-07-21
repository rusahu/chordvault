process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
const insertSong = db.prepare(
  "INSERT INTO songs (user_id, title, content, visibility, status) VALUES (?, ?, ?, ?, ?)"
);

const u = insertUser.run('worshipper').lastInsertRowid;
insertSong.run(u, '主的喜樂是我力量', '{title: 主的喜樂是我力量}\n[G]a', 'public', 'active');

const titles = (q) => Song.listPublic({ q }).map((r) => r.title);

test('3-char CJK substring matches (FTS baseline)', () => {
  assert.deepEqual(titles('的喜樂'), ['主的喜樂是我力量']);
});

test('2-char CJK substring in the MIDDLE matches (was broken: trigram <3 chars)', () => {
  assert.deepEqual(titles('喜樂'), ['主的喜樂是我力量']);
});

test('2-char CJK substring at the START matches', () => {
  assert.deepEqual(titles('主的'), ['主的喜樂是我力量']);
});

test('2-char CJK substring at the END matches', () => {
  assert.deepEqual(titles('力量'), ['主的喜樂是我力量']);
});

test('short simplified query matches a traditional-stored title (variant fallback)', () => {
  // 喜樂 (trad) stored; user types 喜乐 (simp)
  assert.deepEqual(titles('喜乐'), ['主的喜樂是我力量']);
});

test('short query that does not occur returns nothing', () => {
  assert.deepEqual(titles('平安'), []);
});
