const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const jwt = require('jsonwebtoken');
const User = require('../lib/models/user');
const { optionalAuth, requireAuth } = require('../lib/auth');
test.after(() => db.close());

test('optional and required auth share one lookup per request and recheck disabled users', async t => {
  const account = user('auth-cache');
  const lookup = t.mock.method(User, 'findById');
  const request = await serve(t, app => app.get('/', optionalAuth, requireAuth, (req, res) => res.json(req.user)));
  assert.equal((await request('/', account)).status, 200);
  assert.equal(lookup.mock.callCount(), 1);
  db.prepare('UPDATE users SET disabled = 1 WHERE id = ?').run(account.id);
  const denied = await request('/', account);
  assert.equal(denied.status, 403);
  assert.equal(lookup.mock.callCount(), 2);
});

test('required auth retains errors while optional auth allows anonymous access', async t => {
  const request = await serve(t, app => {
    app.get('/required', requireAuth, (req, res) => res.json(req.user));
    app.get('/optional', optionalAuth, (req, res) => res.json(req.user || null));
  });
  const tokens = [
    [undefined, 'Authentication required'],
    ['invalid', 'Invalid or expired token'],
    [jwt.sign({ id: 999999 }, process.env.JWT_SECRET), 'User not found'],
    [jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -1 }), 'Invalid or expired token'],
    [jwt.sign({ id: 1 }, 'wrong-secret'), 'Invalid or expired token'],
  ];
  for (const [token, error] of tokens) {
    const response = await request('/required', { token });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error });
    assert.equal(await (await request('/optional', { token })).json(), null);
  }
});
