process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../lib/db');
const { createSetlistsRouter } = require('../routes/setlists');

// Drives the real routes over a real HTTP listener against a throwaway
// in-memory database. The unit tests cover validateTargetKey/canonicalTargetKey
// themselves; this covers the wiring, which is where a key reached storage
// untrimmed and un-normalised.

const userId = db.prepare("INSERT INTO users (username, password_hash) VALUES ('u', 'x')").run().lastInsertRowid;
const songId = db
  .prepare("INSERT INTO songs (user_id, title, content, visibility, status) VALUES (?, 's', '{key: C}', 'public', 'active')")
  .run(userId).lastInsertRowid;
const setlistId = db.prepare("INSERT INTO setlists (user_id, name) VALUES (?, 'sl')").run(userId).lastInsertRowid;
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const app = express();
app.use(express.json());
app.use('/api', createSetlistsRouter());
const server = app.listen(0);
server.unref();
test.after(() => server.close());

function api(method, path, body) {
  return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const addEntry = async (target_key) => {
  const res = await api('POST', `/setlists/${setlistId}/songs`, { song_id: songId, target_key });
  assert.equal(res.status, 200, `POST returned ${res.status}`);
  return (await res.json()).entry_id;
};

const keyOf = (entryId) =>
  db.prepare('SELECT target_key FROM setlist_songs WHERE id = ?').get(entryId).target_key;

test('POST stores the key trimmed', async () => {
  assert.equal(keyOf(await addEntry('  Bb  ')), 'Bb');
});

test('POST stores an awkward enharmonic in the picker spelling', async () => {
  assert.equal(keyOf(await addEntry('Db')), 'C#');
});

test('PUT stores the key trimmed', async () => {
  const entryId = await addEntry(null);
  const res = await api('PUT', `/setlists/${setlistId}/entries/${entryId}`, { target_key: '  F#  ' });
  assert.equal(res.status, 200);
  assert.equal(keyOf(entryId), 'F#');
});

test('PUT stores an awkward enharmonic in the picker spelling', async () => {
  const entryId = await addEntry(null);
  const res = await api('PUT', `/setlists/${setlistId}/entries/${entryId}`, { target_key: 'Ab' });
  assert.equal(res.status, 200);
  assert.equal(keyOf(entryId), 'G#');
});

test('PUT clears the key on an explicit null', async () => {
  const entryId = await addEntry('A');
  const res = await api('PUT', `/setlists/${setlistId}/entries/${entryId}`, { target_key: null });
  assert.equal(res.status, 200);
  assert.equal(keyOf(entryId), null);
});

test('PUT leaves the key alone when the field is absent', async () => {
  const entryId = await addEntry('A');
  const res = await api('PUT', `/setlists/${setlistId}/entries/${entryId}`, { nashville: true });
  assert.equal(res.status, 200);
  assert.equal(keyOf(entryId), 'A');
});

test('both routes reject a key the renderer cannot use', async () => {
  const post = await api('POST', `/setlists/${setlistId}/songs`, { song_id: songId, target_key: '1' });
  assert.equal(post.status, 400);
  assert.equal((await post.json()).error, 'Invalid key: 1');

  const entryId = await addEntry('A');
  const put = await api('PUT', `/setlists/${setlistId}/entries/${entryId}`, { target_key: 'Do' });
  assert.equal(put.status, 400);
  assert.equal(keyOf(entryId), 'A');
});
