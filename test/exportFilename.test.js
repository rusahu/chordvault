const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeBaseName, makeUniqueNamer } = require('../lib/exportFilename');

test('sanitizeBaseName strips filesystem-illegal characters', () => {
  assert.equal(sanitizeBaseName('AC/DC: Back?', 1), 'AC DC Back');
});

test('sanitizeBaseName keeps hyphens in titles', () => {
  assert.equal(sanitizeBaseName('Spider-Man', 1), 'Spider-Man');
});

test('sanitizeBaseName collapses whitespace and trims', () => {
  assert.equal(sanitizeBaseName('  Hello\tWorld\n ', 1), 'Hello World');
});

test('sanitizeBaseName caps length at 100', () => {
  const out = sanitizeBaseName('x'.repeat(200), 1);
  assert.equal(out.length, 100);
});

test('sanitizeBaseName falls back to song-<id> when empty', () => {
  assert.equal(sanitizeBaseName('   ', 42), 'song-42');
  assert.equal(sanitizeBaseName('///', 7), 'song-7');
});

test('makeUniqueNamer appends .cho and de-duplicates within a run', () => {
  const name = makeUniqueNamer();
  assert.equal(name('Amazing Grace', 1), 'Amazing Grace.cho');
  assert.equal(name('Amazing Grace', 2), 'Amazing Grace-2.cho');
  assert.equal(name('Amazing Grace', 3), 'Amazing Grace-3.cho');
});

test('makeUniqueNamer de-duplicates case-insensitively', () => {
  const name = makeUniqueNamer();
  assert.equal(name('Song', 1), 'Song.cho');
  assert.equal(name('song', 2), 'song-2.cho');
});

test('makeUniqueNamer uses fallback name for empty titles', () => {
  const name = makeUniqueNamer();
  assert.equal(name('', 5), 'song-5.cho');
});
