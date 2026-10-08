process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'offline-test-only';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../lib/db');
const { createOfflineRouter } = require('../routes/offline');

const addUser = (name, role = 'user') => Number(db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(name, 'secret-hash', role).lastInsertRowid);
const owner = addUser('owner');
const other = addUser('other');
const admin = addUser('admin', 'admin');
const addSong = (user, title, visibility = 'public', status = 'active', parent = null) => Number(db.prepare('INSERT INTO songs (user_id, title, content, visibility, status, parent_id) VALUES (?, ?, ?, ?, ?, ?)').run(user, title, '{key: C}\n[C]喜樂 快乐', visibility, status, parent).lastInsertRowid);
const publicSong = addSong(other, 'Public');
const version = addSong(other, 'Public version', 'public', 'active', publicSong);
const ownPrivate = addSong(owner, 'Own private', 'private');
const denied = addSong(other, 'Other private', 'private');
addSong(owner, 'Pending', 'public', 'pending');
for (let i = 0; i < 105; i++) addSong(other, `Public ${i}`);
const setlist = Number(db.prepare('INSERT INTO setlists (user_id, name) VALUES (?, ?)').run(owner, 'Offline worship').lastInsertRowid);
db.prepare('INSERT INTO setlists (user_id, name) VALUES (?, ?)').run(other, 'Not my setlist');
const addEntry = db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, target_key, content_override) VALUES (?, ?, ?, ?, ?)');
addEntry.run(setlist, publicSong, 2, 'D', '[D]Override');
addEntry.run(setlist, denied, 1, 'F', 'Private override');
const app = express();
app.use('/api', createOfflineRouter());
const server = app.listen(0);
server.unref();
test.after(() => server.close());
function request(user = owner, headers = {}) {
  return fetch(`http://127.0.0.1:${server.address().port}/api/offline-library`, {
    headers: { ...(user ? { authorization: `Bearer ${jwt.sign({ id: user }, process.env.JWT_SECRET)}` } : {}), ...headers },
  });
}

test('snapshot requires an enabled authenticated user', async () => {
  assert.equal((await request(null)).status, 401);
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(other);
  assert.equal((await request(other)).status, 403);
  db.prepare('UPDATE users SET disabled=0 WHERE id=?').run(other);
});

test('snapshot includes every accessible active version beyond list caps without secrets', async () => {
  const response = await request();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.accountId, owner);
  assert.equal(data.songs.length, 108);
  assert.ok(data.songs.some(s => s.id === ownPrivate));
  assert.equal(data.songs.find(s => s.id === version).familyId, publicSong);
  assert.ok(data.songs.every(s => s.content.includes('[C]')));
  assert.ok(!JSON.stringify(data).includes('secret-hash'));
  assert.ok(!data.songs.some(s => s.id === denied));
  assert.equal(data.catalog.length, data.songs.length);
  const searchable = data.catalog.find(s => s.id === publicSong);
  assert.ok(searchable.search.lyrics.some(s => s.includes('快乐')));
  assert.ok(searchable.search.lyrics.some(s => s.includes('快樂')));
  assert.ok(searchable.search.lyrics.every(s => !s.includes('[c]')));
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('vary'), /authorization/i);
});

test('own setlists retain order and safe overrides, with denied entries masked', async () => {
  const data = await (await request()).json();
  assert.equal(data.setlists.length, 1);
  const entries = data.setlists[0].entries;
  assert.equal(entries[0].song_id, denied);
  assert.equal(entries[0].is_private_placeholder, true);
  assert.equal(entries[0].content, '');
  assert.equal(entries[0].content_override, null);
  assert.equal(entries[1].target_key, 'D');
  assert.equal(entries[1].content_override, '[D]Override');
});

test('admins do not automatically download unrelated private libraries', async () => {
  const data = await (await request(admin)).json();
  assert.ok(!data.songs.some(s => s.id === denied || s.id === ownPrivate));
});

test('conditional responses authenticate first and reflect edits, reorder and deletion', async () => {
  let response = await request();
  let etag = response.headers.get('etag');
  assert.equal((await request(owner, { 'if-none-match': etag })).status, 304);
  assert.equal((await request(null, { 'if-none-match': etag })).status, 401);
  assert.equal((await request(admin, { 'if-none-match': etag })).status, 200);
  for (const sql of [
    `UPDATE songs SET content='[G]Changed' WHERE id=${publicSong}`,
    `UPDATE setlist_songs SET position=3 WHERE setlist_id=${setlist} AND song_id=${denied}`,
    `UPDATE songs SET visibility='private' WHERE id=${version}`,
    `DELETE FROM songs WHERE id=${ownPrivate}`,
  ]) {
    db.exec(sql);
    response = await request(owner, { 'if-none-match': etag });
    assert.equal(response.status, 200);
    assert.notEqual(response.headers.get('etag'), etag);
    etag = response.headers.get('etag');
  }
});
