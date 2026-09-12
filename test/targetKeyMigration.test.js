const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { migrateTargetKey } = require('../lib/targetKeyMigration');

function legacyDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE songs (id INTEGER PRIMARY KEY, content TEXT);
    CREATE TABLE setlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setlist_id INTEGER, song_id INTEGER, position INTEGER,
      transpose INTEGER DEFAULT 0, nashville INTEGER DEFAULT 0,
      font INTEGER DEFAULT NULL, two_col INTEGER DEFAULT NULL,
      content_override TEXT DEFAULT NULL
    );
  `);
  return db;
}

function cols(db) {
  return db.prepare('PRAGMA table_info(setlist_songs)').all().map((c) => c.name);
}

test('backfills a transposed row and drops the old column', () => {
  const db = legacyDb();
  db.prepare("INSERT INTO songs VALUES (1, '{key: G}\\n[G]a')").run();
  db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, transpose) VALUES (1, 1, 1, 2)').run();

  migrateTargetKey(db);

  assert.equal(db.prepare('SELECT target_key FROM setlist_songs WHERE id = 1').get().target_key, 'A');
  assert.ok(!cols(db).includes('transpose'), 'transpose column should be dropped');
});

test('leaves untransposed rows NULL, meaning as-written', () => {
  const db = legacyDb();
  db.prepare("INSERT INTO songs VALUES (1, '{key: G}\\n[G]a')").run();
  db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, transpose) VALUES (1, 1, 1, 0)').run();

  migrateTargetKey(db);

  assert.equal(db.prepare('SELECT target_key FROM setlist_songs WHERE id = 1').get().target_key, null);
});

test('derives from content_override when the entry has one', () => {
  const db = legacyDb();
  db.prepare("INSERT INTO songs VALUES (1, '{key: G}\\n[G]a')").run();
  db.prepare("INSERT INTO setlist_songs (setlist_id, song_id, position, transpose, content_override) VALUES (1, 1, 1, 2, '{key: C}\\n[C]a')").run();

  migrateTargetKey(db);

  assert.equal(db.prepare('SELECT target_key FROM setlist_songs WHERE id = 1').get().target_key, 'D');
});

test('is idempotent: a second run after the drop does not throw', () => {
  const db = legacyDb();
  db.prepare("INSERT INTO songs VALUES (1, '{key: G}\\n[G]a')").run();
  db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, transpose) VALUES (1, 1, 1, 2)').run();

  migrateTargetKey(db);
  assert.doesNotThrow(() => migrateTargetKey(db), 'second run must not reference the dropped column');
  assert.equal(db.prepare('SELECT target_key FROM setlist_songs WHERE id = 1').get().target_key, 'A');
});

test('skips the drop when a row cannot be converted, and loses no data', () => {
  const db = legacyDb();
  db.prepare("INSERT INTO songs VALUES (1, '[C]a [F]b')").run();   // no key directive
  db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, transpose) VALUES (1, 1, 1, 3)').run();

  migrateTargetKey(db);

  assert.ok(cols(db).includes('transpose'), 'transpose must survive an incomplete backfill');
  assert.equal(db.prepare('SELECT transpose FROM setlist_songs WHERE id = 1').get().transpose, 3);
  assert.equal(db.prepare('SELECT target_key FROM setlist_songs WHERE id = 1').get().target_key, null);
});

test('a fresh database with no legacy column is left alone', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE songs (id INTEGER PRIMARY KEY, content TEXT);
    CREATE TABLE setlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, setlist_id INTEGER, song_id INTEGER,
      position INTEGER, nashville INTEGER DEFAULT 0, target_key TEXT DEFAULT NULL,
      font INTEGER DEFAULT NULL, two_col INTEGER DEFAULT NULL, content_override TEXT DEFAULT NULL
    );
  `);
  assert.doesNotThrow(() => migrateTargetKey(db));
  assert.ok(cols(db).includes('target_key'));
});
