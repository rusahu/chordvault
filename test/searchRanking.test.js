process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
// explicit updated_at so recency is controlled (lyric-only match is the NEWEST)
const insertSong = db.prepare(
  "INSERT INTO songs (user_id, title, artist, content, visibility, status, updated_at) VALUES (?, ?, ?, ?, 'public', 'active', ?)"
);
const u = insertUser.run('u').lastInsertRowid;

// term "amazing": in title (oldest), in artist (middle), in lyrics only (NEWEST)
insertSong.run(u, 'Amazing Grace', 'Newton', '{title: Amazing Grace}\n[G]sweet sound', '2024-01-01');
insertSong.run(u, 'Grace Alone', 'Amazing Band', '{title: Grace Alone}\n[C]love', '2025-01-01');
insertSong.run(u, 'Old Rugged Cross', 'x', '{title: Old Rugged Cross}\ntruly amazing to sing', '2026-12-31');

const titles = (q) => Song.listPublic({ q }).map((r) => r.title);

test('title match ranks above artist match ranks above lyric-only match (not by recency)', () => {
  assert.deepEqual(titles('amazing'), ['Amazing Grace', 'Grace Alone', 'Old Rugged Cross']);
});

// CJK ranking also applies on the short-query (<3 char) LIKE path
insertSong.run(u, '喜樂', '某人', '{title: 喜樂}\n[G]a', '2024-01-01'); // title match
insertSong.run(u, '平安夜', '某人', '{title: 平安夜}\n這是喜樂的歌 到永遠', '2026-12-31'); // lyric-only, newest

test('short CJK query ranks title match above newer lyric-only match', () => {
  assert.deepEqual(titles('喜樂'), ['喜樂', '平安夜']);
});
