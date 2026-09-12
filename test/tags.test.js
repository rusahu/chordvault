process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../lib/db');
const Song = require('../lib/models/song');
const { normalizeTags, parseTagFilters, normalizeTagDirective } = require('../lib/tags');

const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')");
const insertSong = db.prepare(
  'INSERT INTO songs (user_id, title, content, tags, visibility, status) VALUES (?, ?, ?, ?, ?, ?)',
);
const owner = insertUser.run('tag-owner').lastInsertRowid;
const other = insertUser.run('other-owner').lastInsertRowid;
insertSong.run(owner, 'Date Night', '{title: Date Night}\n[G]lyrics', 'Romantic,Acoustic', 'public', 'active');
insertSong.run(owner, 'Quiet Song', '{title: Quiet Song}\n[C]lyrics', 'romantic,Slow Dance', 'public', 'active');
insertSong.run(owner, 'Loud Song', '{title: Loud Song}\n[D]lyrics', 'Rock,DJ', 'private', 'active');
insertSong.run(other, 'Someone Else', '{title: Someone Else}\n[E]lyrics', 'Private Tag', 'private', 'active');
insertSong.run(other, 'Pending Public', '{title: Pending Public}\n[F]lyrics', 'Pending Tag', 'public', 'pending');

test('normalization preserves display case and removes case-insensitive duplicates', () => {
  assert.deepEqual(normalizeTags(' Romantic,romantic, Slow Dance, '), ['Romantic', 'Slow Dance']);
  assert.deepEqual(parseTagFilters(['Romantic,Acoustic', 'Slow Dance']), ['Romantic', 'Acoustic', 'Slow Dance']);
  assert.equal(
    normalizeTagDirective('{title: Song}\n{x_tags: Romantic, romantic, Slow Dance}\n[G]lyrics'),
    '{title: Song}\n{x_tags: Romantic,Slow Dance}\n[G]lyrics',
  );
});

test('user tag catalog is isolated, distinct, and sorted', () => {
  assert.deepEqual(
    Song.listTagsForUser(owner),
    ['Acoustic', 'Romantic', 'Slow Dance', 'Rock', 'DJ'].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );
});

test('public tag catalog and filters exclude private and pending songs', () => {
  assert.deepEqual(Song.listPublicTags(), ['Acoustic', 'Romantic', 'Slow Dance']);
  assert.deepEqual(Song.listPublic({ tags: ['romantic', 'acoustic'] }).map((song) => song.title), ['Date Night']);
  assert.deepEqual(Song.listPublic({ tags: ['Private Tag'] }), []);
});

test('normal search matches long and short tag names', () => {
  assert.deepEqual(Song.listForUser(owner, { q: 'Acoustic' }).map((song) => song.title), ['Date Night']);
  assert.deepEqual(Song.listForUser(owner, { q: 'DJ' }).map((song) => song.title), ['Loud Song']);
});

test('tag filters are exact and case-insensitive', () => {
  assert.deepEqual(
    Song.listForUser(owner, { tags: ['ROMANTIC'] })
      .map((song) => song.title)
      .sort(),
    ['Date Night', 'Quiet Song'],
  );
  assert.deepEqual(Song.listForUser(owner, { tags: ['romant'] }), []);
});

test('multiple tags use AND and combine with text search and pagination totals', () => {
  const result = Song.listForUser(owner, { q: 'date', tags: ['romantic', 'acoustic'], page: 1, limit: 20 });
  assert.deepEqual(
    result.songs.map((song) => song.title),
    ['Date Night'],
  );
  assert.equal(result.total, 1);
  assert.equal(result.totalPages, 1);
});
