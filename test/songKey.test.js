const test = require('node:test');
const assert = require('node:assert/strict');
const { songKeyFromContent } = require('../lib/songKey');

test('reads the key directive and applies no shift at 0', () => {
  assert.equal(songKeyFromContent('{key: G}\n[G]a', 0), 'G');
});

test('transposes the key directive upward', () => {
  assert.equal(songKeyFromContent('{key: G}\n[G]a', 2), 'A');
});

test('transposes the key directive downward', () => {
  assert.equal(songKeyFromContent('{key: A}\n[A]a', -2), 'G');
});

test('normalizes awkward spellings via the shared map', () => {
  assert.equal(songKeyFromContent('{key: G}\n[G]a', -1), 'F#');
});

test('handles minor keys', () => {
  assert.equal(songKeyFromContent('{key: Am}\n[Am]a', 3), 'Cm');
});

test('accepts the short {k:} directive and is case-insensitive', () => {
  assert.equal(songKeyFromContent('{k: C}\n[C]a', 2), 'D');
  assert.equal(songKeyFromContent('{Key: C}\n[C]a', 2), 'D');
});

test('wraps past an octave', () => {
  assert.equal(songKeyFromContent('{key: G}\n[G]a', 12), 'G');
  assert.equal(songKeyFromContent('{key: G}\n[G]a', 14), 'A');
});

test('returns empty string when there is no key directive', () => {
  assert.equal(songKeyFromContent('[C]a [F]b', 2), '');
});

test('returns empty string when the key is not parseable', () => {
  assert.equal(songKeyFromContent('{key: Chorus}\n[C]a', 0), '');
  assert.equal(songKeyFromContent('{key: }\n[C]a', 0), '');
});

test('returns empty string for empty content', () => {
  assert.equal(songKeyFromContent('', 0), '');
});
