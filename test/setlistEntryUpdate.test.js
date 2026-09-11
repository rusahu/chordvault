const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

// Mirrors the UPDATE in lib/models/setlist.js updateSongEntryTransaction.
const SQL = `UPDATE setlist_songs SET
  target_key = CASE WHEN ? THEN ? ELSE target_key END,
  nashville = COALESCE(?, nashville)
  WHERE id = ?`;

function dbWith(targetKey) {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE setlist_songs (id INTEGER PRIMARY KEY, target_key TEXT, nashville INTEGER DEFAULT 0)');
  db.prepare('INSERT INTO setlist_songs (id, target_key) VALUES (1, ?)').run(targetKey);
  return db;
}
const keyOf = (db) => db.prepare('SELECT target_key FROM setlist_songs WHERE id = 1').get().target_key;

test('an explicit null clears a pinned key to as-written', () => {
  const db = dbWith('A');
  db.prepare(SQL).run(1, null, null, 1);
  assert.equal(keyOf(db), null);
});

test('an absent field leaves the pinned key untouched', () => {
  const db = dbWith('A');
  db.prepare(SQL).run(0, null, null, 1);
  assert.equal(keyOf(db), 'A');
});

test('a new key replaces the old one', () => {
  const db = dbWith('A');
  db.prepare(SQL).run(1, 'C', null, 1);
  assert.equal(keyOf(db), 'C');
});

test('setting a key on an as-written entry pins it', () => {
  const db = dbWith(null);
  db.prepare(SQL).run(1, 'F#', null, 1);
  assert.equal(keyOf(db), 'F#');
});

test('updating only nashville does not disturb the key', () => {
  const db = dbWith('A');
  db.prepare(SQL).run(0, null, 1, 1);
  assert.equal(keyOf(db), 'A');
  assert.equal(db.prepare('SELECT nashville FROM setlist_songs WHERE id = 1').get().nashville, 1);
});
