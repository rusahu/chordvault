process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
const insertSong = db.prepare(
  "INSERT INTO songs (user_id, title, content, visibility, status) VALUES (?, ?, ?, 'public', 'active')"
);
const u = insertUser.run('u').lastInsertRowid;
insertSong.run(u, 'Amazing Grace', '{title: Amazing Grace}\n[G]a');

const titles = (q) => Song.listPublic({ q }).map((r) => r.title);

test('multi-word query matches regardless of word order', () => {
  assert.deepEqual(titles('grace amazing'), ['Amazing Grace']);
});

test('multi-word query tolerates extra whitespace', () => {
  assert.deepEqual(titles('amazing   grace'), ['Amazing Grace']);
});

test('single-word query still matches', () => {
  assert.deepEqual(titles('amazing'), ['Amazing Grace']);
});

test('all words must be present (AND, not OR)', () => {
  assert.deepEqual(titles('amazing missing'), []);
});
