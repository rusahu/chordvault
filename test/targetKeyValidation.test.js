const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTargetKey } = require('../lib/validation');

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

test('rejects non-strings', () => {
  assert.ok(validateTargetKey(5));
  assert.ok(validateTargetKey({}));
});

test('rejects an over-long value', () => {
  assert.ok(validateTargetKey('C'.repeat(20)));
});
