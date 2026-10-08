const test = require('node:test');
const assert = require('node:assert/strict');
const languages = require('../lib/languages');

test('exports only the code set', () => {
  assert.deepEqual(Object.keys(languages), ['LANGUAGE_CODES']);
});

test('holds all 94 supported codes', () => {
  assert.equal(languages.LANGUAGE_CODES.size, 94);
});

test('recognises codes the app relies on', () => {
  for (const code of ['en', 'zh', 'ja', 'ko', 'id', 'ms']) {
    assert.ok(languages.LANGUAGE_CODES.has(code), `missing ${code}`);
  }
});

test('rejects unknown codes', () => {
  assert.equal(languages.LANGUAGE_CODES.has('qq'), false);
  assert.equal(languages.LANGUAGE_CODES.has(''), false);
});

test('every code is a bare two-letter lowercase string', () => {
  for (const code of languages.LANGUAGE_CODES) {
    assert.match(code, /^[a-z]{2}$/, `malformed: ${code}`);
  }
});

test('registry has unique codes and names for every supported language', () => {
  const registry = require('../shared/languages.json');
  assert.equal(registry.length, languages.LANGUAGE_CODES.size);
  assert.deepEqual(new Set(registry.map(language => language.code)), languages.LANGUAGE_CODES);
  for (const language of registry) assert.ok(language.name.length > 0);
});
