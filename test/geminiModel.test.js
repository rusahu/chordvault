const test = require('node:test');
const assert = require('node:assert/strict');
const { GEMINI_MODELS, DEFAULT_GEMINI_MODEL, isValidGeminiModel, resolveGeminiModel } = require('../lib/constants');

test('default model is one of the listed models', () => {
  assert.ok(isValidGeminiModel(DEFAULT_GEMINI_MODEL));
});

test('backend uses the shared public model default', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, require('../shared/public-constants.json').DEFAULT_GEMINI_MODEL);
});

test('model ids are unique', () => {
  const ids = GEMINI_MODELS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every model has an id and label', () => {
  for (const m of GEMINI_MODELS) {
    assert.ok(m.id && m.label, `incomplete entry: ${JSON.stringify(m)}`);
  }
});

test('resolves to the default when nothing is stored', () => {
  assert.equal(resolveGeminiModel(undefined, null), DEFAULT_GEMINI_MODEL);
});

test('a stored preference for a delisted model falls back to the default', () => {
  assert.equal(resolveGeminiModel(undefined, 'gemini-3-flash-preview'), DEFAULT_GEMINI_MODEL);
  assert.equal(resolveGeminiModel(undefined, 'gemini-2.5-flash-lite'), DEFAULT_GEMINI_MODEL);
});

test('a stored preference for a listed model is respected', () => {
  assert.equal(resolveGeminiModel(undefined, 'gemini-2.5-flash'), 'gemini-2.5-flash');
});

test('request body takes precedence over the stored preference', () => {
  assert.equal(resolveGeminiModel('gemini-3.8-flash', 'gemini-2.5-flash'), 'gemini-3.8-flash');
  assert.equal(resolveGeminiModel('gemini-3.7-flash', 'gemini-3.6-flash'), 'gemini-3.7-flash');
});

test('an invalid request body falls back to a valid stored preference', () => {
  assert.equal(resolveGeminiModel('bogus', 'gemini-2.5-flash'), 'gemini-2.5-flash');
});

test('when every candidate is invalid the default wins', () => {
  assert.equal(resolveGeminiModel('bogus', 'also-bogus'), DEFAULT_GEMINI_MODEL);
  assert.equal(resolveGeminiModel(null, 12345), DEFAULT_GEMINI_MODEL);
});

test('isValidGeminiModel rejects non-string and unknown ids', () => {
  assert.ok(!isValidGeminiModel(undefined));
  assert.ok(!isValidGeminiModel(''));
  assert.ok(!isValidGeminiModel('gemini-3-flash-preview'));
  assert.ok(isValidGeminiModel('gemini-3.8-flash'));
});
