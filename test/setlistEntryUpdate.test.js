process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Setlist = require('../lib/models/setlist');

// Exercises the real model against a real schema. An earlier version of this
// file copied the UPDATE statement into the test, so the model could break
// without a single test noticing.

const userId = db.prepare("INSERT INTO users (username, password_hash) VALUES ('u', 'x')").run().lastInsertRowid;
const songId = db.prepare("INSERT INTO songs (user_id, title, content) VALUES (?, 's', '{key: C}')").run(userId).lastInsertRowid;
const setlistId = db.prepare("INSERT INTO setlists (user_id, name) VALUES (?, 'sl')").run(userId).lastInsertRowid;

function entryWith(targetKey) {
  return Setlist.addSongEntry(setlistId, songId, { targetKey, nashville: 0 }).entry_id;
}

function update(entryId, updates) {
  Setlist.updateSongEntry(entryId, setlistId, Setlist.getEntryById(entryId, setlistId), updates);
}

const keyOf = (entryId) => Setlist.getEntryById(entryId, setlistId).target_key;

test('an explicit null clears a pinned key to as-written', () => {
  const id = entryWith('A');
  update(id, { targetKey: null, targetKeyProvided: true });
  assert.equal(keyOf(id), null);
});

test('an absent field leaves the pinned key untouched', () => {
  const id = entryWith('A');
  update(id, { targetKey: null, targetKeyProvided: false });
  assert.equal(keyOf(id), 'A');
});

test('a new key replaces the old one', () => {
  const id = entryWith('A');
  update(id, { targetKey: 'C', targetKeyProvided: true });
  assert.equal(keyOf(id), 'C');
});

test('setting a key on an as-written entry pins it', () => {
  const id = entryWith(null);
  update(id, { targetKey: 'F#', targetKeyProvided: true });
  assert.equal(keyOf(id), 'F#');
});

test('updating only nashville does not disturb the key', () => {
  const id = entryWith('A');
  update(id, { targetKeyProvided: false, nashville: true });
  assert.equal(keyOf(id), 'A');
  assert.equal(Setlist.getEntryById(id, setlistId).nashville, 1);
});

test('a content override is preserved when only the key is updated', () => {
  const id = entryWith('A');
  update(id, { targetKeyProvided: true, targetKey: 'D', contentOverride: '{key: E}' });
  update(id, { targetKeyProvided: true, targetKey: 'G' });
  const entry = Setlist.getEntryById(id, setlistId);
  assert.equal(entry.target_key, 'G');
  assert.equal(entry.content_override, '{key: E}');
});

test('the entry round-trips through getEntries as target_key', () => {
  const id = entryWith('Bb');
  const row = Setlist.getEntries(setlistId).find((e) => e.entry_id === id);
  assert.equal(row.target_key, 'Bb');
});
