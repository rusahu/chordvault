process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'backend-cleanup-test';
const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../../lib/db');
const { errorHandler } = require('../../lib/errors');

function user(name, role = 'user') {
  const id = Number(db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(name, 'unused', role).lastInsertRowid);
  return { id, token: jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' }) };
}

async function serve(t, mount) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  mount(app);
  app.use(errorHandler);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, { method = 'GET', token, body, ip = '192.0.2.1' } = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

module.exports = { db, user, serve };
