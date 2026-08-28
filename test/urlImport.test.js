const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateImportUrl,
  addSourceDirective,
  assertUrlRetrieved,
  supportsToolStructuredOutput,
  validateExtractedChordSheet,
  convertUrlImportResult,
} = require('../lib/url-import');

test('validateImportUrl normalizes public HTTP(S) URLs', () => {
  assert.equal(validateImportUrl(' https://Example.com/song?q=1 ').url, 'https://example.com/song?q=1');
  assert.equal(validateImportUrl('http://example.com/song').url, 'http://example.com/song');
});

test('validateImportUrl rejects malformed, credentialed, and non-HTTP URLs', () => {
  assert.match(validateImportUrl('example.com/song').error, /complete, valid URL/);
  assert.match(validateImportUrl('ftp://example.com/song').error, /Only http/);
  assert.match(validateImportUrl('https://user:pass@example.com/song').error, /credentials/);
});

test('validateImportUrl rejects local and private-network literals', () => {
  for (const url of [
    'http://localhost/song',
    'http://chords.local/song',
    'http://127.0.0.1/song',
    'http://10.0.0.1/song',
    'http://172.16.0.1/song',
    'http://192.168.1.1/song',
    'http://[::1]/song',
  ]) {
    assert.match(validateImportUrl(url).error, /Local and private-network/, url);
  }
  assert.equal(validateImportUrl('https://fcbarcelona.com/song').error, undefined);
});

test('addSourceDirective replaces model-provided provenance and keeps the metadata block', () => {
  const result = addSourceDirective(
    '{title: Test}\n{x_source: https://wrong.example}\n{artist: Artist}\n\n[G]Hello',
    'https://example.com/song',
  );
  assert.equal((result.match(/\{x_source:/g) || []).length, 1);
  assert.match(result, /^\{title: Test\}\n\{artist: Artist\}\n\{x_source: https:\/\/example\.com\/song\}/);
});

test('assertUrlRetrieved accepts success and maps failures to actionable errors', () => {
  assert.doesNotThrow(() => assertUrlRetrieved({
    urlContextMetadata: { urlMetadata: [{ urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] },
  }));
  assert.throws(
    () => assertUrlRetrieved({ url_context_metadata: { url_metadata: [{ url_retrieval_status: 'URL_RETRIEVAL_STATUS_UNSAFE' }] } }),
    (error) => error.code === 'URL_UNSAFE' && error.status === 422,
  );
  assert.throws(() => assertUrlRetrieved({}), (error) => error.code === 'URL_UNAVAILABLE');
});

test('structured tool output is limited to Gemini 3 models', () => {
  assert.equal(supportsToolStructuredOutput('gemini-3.6-flash'), true);
  assert.equal(supportsToolStructuredOutput('gemini-2.5-flash'), false);
});

test('URL extraction must contain a real chord rather than a section label', () => {
  assert.doesNotThrow(() => validateExtractedChordSheet('{title: Test}\n[G]Hello'));
  assert.throws(
    () => validateExtractedChordSheet('{title: Test}\n[Bridge]\nLyrics only'),
    (error) => error.code === 'NO_CHORD_SHEET' && error.status === 422,
  );
});

test('Gemini 3 structured results are converted to ChordPro with source provenance', () => {
  const result = convertUrlImportResult(JSON.stringify({
    metadata: { title: 'Test', language: 'en' },
    sections: [{ lines: [{ segments: [{ chord: 'G', lyrics: 'Hello' }] }] }],
  }), true, 'https://example.com/song');
  assert.equal(result.language, 'en');
  assert.match(result.text, /\{title: Test\}/);
  assert.match(result.text, /\{x_source: https:\/\/example\.com\/song\}/);
  assert.match(result.text, /\[G\]Hello/);
});

test('Gemini 2.5 text results are cleaned, validated, and retain valid language', () => {
  const result = convertUrlImportResult(
    '```chordpro\n{title: Test}\n{x_language: en}\n[G]Hello\n```',
    false,
    'https://example.com/song',
  );
  assert.equal(result.language, 'en');
  assert.doesNotMatch(result.text, /```/);
  assert.match(result.text, /\{x_source: https:\/\/example\.com\/song\}/);
});
