const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
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

test('code list matches the frontend registry', () => {
  const path = resolve(__dirname, '../frontend/src/lib/languages.ts');
  const matches = readFileSync(path, 'utf8').match(/code: '([a-z]{2})'/g) || [];
  const frontend = matches.map((m) => m.slice(-3, -1));
  assert.equal(frontend.length, 94, 'frontend registry did not yield 94 entries');
  assert.equal(new Set(frontend).size, frontend.length, 'frontend registry has duplicate codes');
  assert.deepEqual([...new Set(frontend)].sort(), [...languages.LANGUAGE_CODES].sort());
});
