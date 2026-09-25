const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTargetKey, canonicalTargetKey } = require('../lib/validation');

test('undefined is valid: the field was not supplied', () => {
  assert.equal(validateTargetKey(undefined), null);
});

test('null is valid: an explicit reset to as-written', () => {
  assert.equal(validateTargetKey(null), null);
});

test('accepts plain, sharp, flat and minor keys', () => {
  for (const k of ['C', 'G', 'F#', 'Bb', 'Ab', 'Am', 'Bm', 'C#m', 'Ebm']) {
    assert.equal(validateTargetKey(k), null, `${k} should be valid`);
  }
});

test('accepts German H, which the chord engine reads as B natural', () => {
  assert.equal(validateTargetKey('H'), null);
});

test('rejects non-keys', () => {
  assert.ok(validateTargetKey('Chorus'));
  assert.ok(validateTargetKey('C major'));
  assert.ok(validateTargetKey(''));
  assert.ok(validateTargetKey('   '));
});

// Key.parse took all of these, so they persisted through the API and only
// failed at render: Key.distance throws, getTransposeDelta swallows it and
// returns 0, and the entry renders as written with live-looking but dead
// sharp/flat buttons. Validating against the canonical set closes that.
test('rejects numerals, solfege and lowercase, which the renderer cannot use', () => {
  for (const k of ['1', '7', 'Do', 'Re', 'a', 'bm']) {
    assert.ok(validateTargetKey(k), `${k} should be rejected`);
  }
});

test('accepts a key with surrounding whitespace, which is stored trimmed', () => {
  assert.equal(validateTargetKey(' A '), null);
  assert.equal(canonicalTargetKey(' A '), 'A');
});

// stepKey looks the stored key up in the picker's own list, so an accepted but
// awkward spelling would make the sharp/flat buttons permanent no-ops.
test('resolves an awkward enharmonic to the spelling the key picker uses', () => {
  assert.equal(validateTargetKey('Db'), null);
  assert.equal(canonicalTargetKey('Db'), 'C#');
  assert.equal(canonicalTargetKey('A#m'), 'Bbm');
});

test('leaves a key that is already canonical alone', () => {
  assert.equal(canonicalTargetKey('F#m'), 'F#m');
  assert.equal(canonicalTargetKey('Hm'), 'Hm');
});

test('rejects non-strings', () => {
  assert.ok(validateTargetKey(5));
  assert.ok(validateTargetKey({}));
});

test('rejects an over-long value', () => {
  assert.ok(validateTargetKey('C'.repeat(20)));
});
