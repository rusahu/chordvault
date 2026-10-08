const express = require('express');
const { createHash } = require('node:crypto');
const { requireAuth } = require('../lib/auth');
const Offline = require('../lib/models/offline');

function createOfflineRouter() {
  const router = express.Router();
  router.get('/offline-library', requireAuth, (req, res) => {
    const body = JSON.stringify(Offline.snapshot(req.user));
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    res.set({ ETag: etag, 'Cache-Control': 'private, no-store', Vary: 'Authorization' });
    if (req.get('if-none-match') === etag) return res.status(304).end();
    res.type('json').send(body);
  });
  return router;
}

module.exports = { createOfflineRouter };
