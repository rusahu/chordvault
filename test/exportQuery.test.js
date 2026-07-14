process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
const insertSong = db.prepare(
  "INSERT INTO songs (user_id, title, content, visibility, status) VALUES (?, ?, ?, ?, ?)"
);

const alice = insertUser.run('alice').lastInsertRowid;
const bob = insertUser.run('bob').lastInsertRowid;

const aPublic = insertSong.run(alice, 'A Public', '{title: A Public}\n[G]a', 'public', 'active').lastInsertRowid;
const aPrivate = insertSong.run(alice, 'A Private', '{title: A Private}\n[G]a', 'private', 'active').lastInsertRowid;
const bPublic = insertSong.run(bob, 'B Public', '{title: B Public}\n[C]b', 'public', 'active').lastInsertRowid;
const bPrivate = insertSong.run(bob, 'B Private', '{title: B Private}\n[C]b', 'private', 'active').lastInsertRowid;
const aPending = insertSong.run(alice, 'A Pending', '{title: A Pending}\n[D]c', 'public', 'pending').lastInsertRowid;

const ids = (userId, isAdmin) => [...Song.iterateExportable(userId, isAdmin)].map((r) => r.id).sort((x, y) => x - y);

test('regular user gets public songs plus own private, never others private, never pending', () => {
  assert.deepEqual(ids(alice, false), [aPublic, aPrivate, bPublic].sort((x, y) => x - y));
  assert.ok(!ids(alice, false).includes(bPrivate));
  assert.ok(!ids(alice, false).includes(aPending));
});

test('admin gets every active song including other users private', () => {
  assert.deepEqual(ids(bob, true), [aPublic, aPrivate, bPublic, bPrivate].sort((x, y) => x - y));
  assert.ok(!ids(bob, true).includes(aPending));
});

test('rows carry title and content for zipping', () => {
  const row = [...Song.iterateExportable(alice, false)].find((r) => r.id === aPublic);
  assert.equal(row.title, 'A Public');
  assert.match(row.content, /A Public/);
});
