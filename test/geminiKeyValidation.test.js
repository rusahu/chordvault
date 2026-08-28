const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGeminiApiKey } = require('../lib/validation');

test('accepts legacy AIza Gemini API keys', () => {
  assert.equal(validateGeminiApiKey(`AIza${'a'.repeat(35)}`), null);
});

test('accepts new AQ Gemini authentication keys', () => {
  assert.equal(validateGeminiApiKey(`AQ.${'a'.repeat(50)}`), null);
});

test('does not assume a provider-specific API key prefix', () => {
  assert.equal(validateGeminiApiKey(`future-format.${'a'.repeat(30)}`), null);
});

test('rejects missing, whitespace-containing, and out-of-bounds API keys', () => {
  assert.equal(validateGeminiApiKey(), 'API key is required');
  assert.equal(validateGeminiApiKey('short'), 'Invalid Gemini API key format');
  assert.equal(
    validateGeminiApiKey(`AQ.${'a'.repeat(20)} ${'b'.repeat(20)}`),
    'Invalid Gemini API key format',
  );
  assert.equal(validateGeminiApiKey('a'.repeat(101)), 'Invalid Gemini API key format');
});
