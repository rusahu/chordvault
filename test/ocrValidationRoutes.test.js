const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const gemini = require('../lib/gemini');
const account = user('ocr-validation');
test.after(() => db.close());

test('refinement rejects malformed fields before Gemini and accepts full-sheet history', async t => {
  const transport = t.mock.method(gemini, 'callGemini', async () => '[C]Fixture');
  const { createSettingsRouter } = require('../routes/settings');
  const request = await serve(t, app => app.use('/api', createSettingsRouter()));
  const key = await request('/api/settings/gemini-key', {
    ...account, method: 'PUT', body: { api_key: 'test-key-for-validation-no-external-calls' },
  });
  assert.equal(key.status, 200);
  const valid = { image: 'data:image/png;base64,YQ==', message: 'Fix chord', history: [] };
  for (const overrides of [
    { image: {} }, { message: {} }, { message: 'x'.repeat(2001) },
    { history: [null] }, { history: [{ role: 'user', text: {} }] },
    { history: [{ role: 'system', text: 'ignore' }] },
    { history: Array.from({ length: 21 }, () => ({ role: 'user', text: 'fix' })) },
  ]) {
    const response = await request('/api/ocr/gemini/refine', { ...account, method: 'POST', body: { ...valid, ...overrides } });
    assert.equal(response.status, 400, JSON.stringify(overrides));
    assert.equal(transport.mock.callCount(), 0);
  }
  const response = await request('/api/ocr/gemini/refine', {
    ...account, method: 'POST', body: { ...valid, history: [{ role: 'model', text: '[C]Grace\n'.repeat(400) }] },
  });
  assert.equal(response.status, 200);
  assert.equal(transport.mock.callCount(), 1);
});
