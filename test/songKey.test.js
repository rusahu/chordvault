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

// The frontend's ChordProParser recognises ONLY a lowercase, case-sensitive
// `key` directive — {k:}, {Key:} and {KEY:} leave it with no key at all, so it
// falls back to the first chord root. Reading them here would backfill a
// perfectly canonical target_key that the frontend then disagrees with, and
// the migration's gate cannot catch a canonical value. Failing closed leaves
// the row NULL and blocks the column drop instead.
test('rejects the {k:} alias and the capitalised spellings the frontend ignores', () => {
  assert.equal(songKeyFromContent('{k: C}\n[C]a', 2), '');
  assert.equal(songKeyFromContent('{K: C}\n[C]a', 2), '');
  assert.equal(songKeyFromContent('{Key: C}\n[C]a', 2), '');
  assert.equal(songKeyFromContent('{KEY: C}\n[C]a', 2), '');
});

test('accepts a space before the colon, which the frontend parser also accepts', () => {
  assert.equal(songKeyFromContent('{key : C}\n[C]a', 2), 'D');
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

// Key.transpose() alone can yield a non-canonical spelling like 'B#' or 'E#',
// which ENHARMONIC_MAP doesn't cover. .normalize() resolves it to the
// canonical letter before normalizeKey() runs; without it these would either
// return the raw 'B#'/'E#' spelling or (post-canonical-gate) ''.
test('normalizes a spelling that only appears without a canonicalizing transpose', () => {
  assert.equal(songKeyFromContent('{key: C#}\n[C#]a', -1), 'C');
});

test('normalizes a non-canonical spelling in a minor key', () => {
  assert.equal(songKeyFromContent('{key: C#m}\n[C#m]a', -1), 'Cm');
});

test('normalizes a non-canonical spelling beyond a +/-6 semitone shift', () => {
  assert.equal(songKeyFromContent('{key: C#m}\n[C#m]a', -8), 'Fm');
});

// German notation ('H' for B natural) is a supported {key:} spelling
// (CHORDVAULT_CONTEXT.md: "German notation now works"). At an
// octave-equivalent shift it lands back on the literal 'H' spelling, which
// isn't in ALL_KEYS/ALL_KEYS_MINOR (those drive the frontend key-picker and
// have no 'H' button) but must still pass the canonical-key gate via the
// backend-only CANONICAL_KEYS list, or a German-notation song can never
// clear the migration's verification gate.
test('accepts German H notation at every octave-equivalent shift', () => {
  assert.equal(songKeyFromContent('{key: H}\n[H]a', -12), 'H');
  assert.equal(songKeyFromContent('{key: H}\n[H]a', 0), 'H');
  assert.equal(songKeyFromContent('{key: H}\n[H]a', 12), 'H');
});

test('accepts German Hm notation at every octave-equivalent shift', () => {
  assert.equal(songKeyFromContent('{key: Hm}\n[Hm]a', -12), 'Hm');
  assert.equal(songKeyFromContent('{key: Hm}\n[Hm]a', 0), 'Hm');
  assert.equal(songKeyFromContent('{key: Hm}\n[Hm]a', 12), 'Hm');
});

test('transposes German H notation away from H at a non-octave shift', () => {
  assert.equal(songKeyFromContent('{key: H}\n[H]a', 3), 'D');
});
