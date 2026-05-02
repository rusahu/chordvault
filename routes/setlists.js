const express = require('express');
const { db } = require('../lib/db');
const { requireAuth, optionalAuth, isAdminRole } = require('../lib/auth');
const { STATUS, VISIBILITY, LIMITS } = require('../lib/constants');
const { parseId, isValidDate, validateSetlistInput, validateTranspose } = require('../lib/validation');
const { getLikeSearch } = require('../lib/searchUtils');

function resolveSetlist(res, setlistId, userId) {
  const setlist = db.prepare('SELECT * FROM setlists WHERE id = ? AND user_id = ?').get(setlistId, userId);
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' });
    return null;
  }
  return setlist;
}

/**
 * Atomically reorders all entries in a setlist by updating their position values.
 * Wraps updates in a SQLite transaction so either all positions change or none do.
 * Also bumps the setlist's updated_at timestamp.
 *
 * @param {number} setlistId - The setlist to reorder
 * @param {number[]} entryIds - Entry IDs in their new order (position = array index + 1)
 */
const reorderTransaction = db.transaction((setlistId, entryIds) => {
  const updatePos = db.prepare('UPDATE setlist_songs SET position = ? WHERE id = ? AND setlist_id = ?');
  for (let i = 0; i < entryIds.length; i++) {
    updatePos.run(i + 1, entryIds[i], setlistId);
  }
  db.prepare('UPDATE setlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(setlistId);
});

function createSetlistsRouter() {
  const router = express.Router();

  router.get('/setlists', requireAuth, (req, res) => {
    const { q, date_from, date_to } = req.query;
    let query = `
      SELECT s.*, COUNT(ss.id) as song_count
      FROM setlists s LEFT JOIN setlist_songs ss ON s.id = ss.setlist_id
      WHERE s.user_id = ?
    `;
    const params = [req.user.id];
    if (q?.trim()) {
      const search = getLikeSearch(q);
      query += search.sql;
      params.push(...search.params);
    }
    if (date_from?.trim() && isValidDate(date_from.trim())) {
      query += ' AND COALESCE(s.event_date, DATE(s.created_at)) >= ?';
      params.push(date_from.trim());
    }
    if (date_to?.trim() && isValidDate(date_to.trim())) {
      query += ' AND COALESCE(s.event_date, DATE(s.created_at)) <= ?';
      params.push(date_to.trim());
    }
    query += ' GROUP BY s.id ORDER BY s.event_date DESC, s.updated_at DESC';
    res.json(db.prepare(query).all(...params));
  });

  router.post('/setlists', requireAuth, (req, res) => {
    const { name, visibility, event_date } = req.body;
    const validationError = validateSetlistInput(name, event_date);
    if (validationError) return res.status(400).json({ error: validationError });
    const vis = visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC;
    const result = db.prepare('INSERT INTO setlists (user_id, name, visibility, event_date) VALUES (?, ?, ?, ?)')
      .run(req.user.id, name.trim(), vis, event_date || null);
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  });

  router.get('/setlists/public', (req, res) => {
    const { q, date_from, date_to } = req.query;
    let query = `
      SELECT s.*, u.username, COUNT(ss.id) as song_count
      FROM setlists s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN setlist_songs ss ON s.id = ss.setlist_id
      WHERE s.visibility = ?
    `;
    const params = [VISIBILITY.PUBLIC];
    if (q?.trim()) {
      const search = getLikeSearch(q);
      query += search.sql;
      params.push(...search.params);
    }
    if (date_from?.trim() && isValidDate(date_from.trim())) {
      query += ' AND COALESCE(s.event_date, DATE(s.created_at)) >= ?';
      params.push(date_from.trim());
    }
    if (date_to?.trim() && isValidDate(date_to.trim())) {
      query += ' AND COALESCE(s.event_date, DATE(s.created_at)) <= ?';
      params.push(date_to.trim());
    }
    query += ' GROUP BY s.id ORDER BY s.event_date DESC, s.updated_at DESC LIMIT 100';
    res.json(db.prepare(query).all(...params));
  });

  router.get('/setlists/public/:id', optionalAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    const setlist = db.prepare('SELECT s.*, u.username FROM setlists s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.visibility = ?').get(id, VISIBILITY.PUBLIC);
    if (!setlist) return res.status(404).json({ error: 'Setlist not found' });
    const entries = db.prepare(`
      SELECT ss.id as entry_id, ss.song_id, ss.position, ss.transpose, ss.nashville, ss.content_override,
             so.title, so.artist, so.content, so.key, so.youtube_url, so.bpm, so.tags, so.language, so.visibility, so.user_id as song_user_id, u.username
      FROM setlist_songs ss
      JOIN songs so ON ss.song_id = so.id
      JOIN users u ON so.user_id = u.id
      WHERE ss.setlist_id = ?
      ORDER BY ss.position ASC
    `).all(id);
    const userId = req.user ? req.user.id : 0;
    const safeEntries = entries.map((e) => {
      if (e.visibility === VISIBILITY.PRIVATE && e.song_user_id !== userId && !(req.user && isAdminRole(req.user.role))) {
        return {
          entry_id: e.entry_id, song_id: e.song_id, position: e.position,
          transpose: 0, nashville: 0, content_override: null,
          title: '[Private Song]', artist: '', content: '', key: '',
          youtube_url: null, bpm: null, tags: null, language: '',
          username: '', is_private_placeholder: true,
        };
      }
      const { song_user_id: _, ...safe } = e;
      return safe;
    });
    res.json({ ...setlist, entries: safeEntries });
  });

  router.get('/setlists/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    const setlist = resolveSetlist(res, id, req.user.id);
    if (!setlist) return;
    const entries = db.prepare(`
      SELECT ss.id as entry_id, ss.song_id, ss.position, ss.transpose, ss.nashville, ss.content_override,
             s.title, s.artist, s.content, s.key, s.youtube_url, s.bpm, s.tags, s.language, s.visibility, s.user_id as song_user_id, u.username
      FROM setlist_songs ss
      JOIN songs s ON ss.song_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE ss.setlist_id = ?
      ORDER BY ss.position ASC
    `).all(id);
    const safeEntries = entries.map((e) => {
      if (e.visibility === VISIBILITY.PRIVATE && e.song_user_id !== req.user.id && !isAdminRole(req.user.role)) {
        return {
          entry_id: e.entry_id, song_id: e.song_id, position: e.position,
          transpose: 0, nashville: 0, content_override: null,
          title: '[Private Song]', artist: '', content: '', key: '',
          youtube_url: null, bpm: null, tags: null, language: '',
          username: '', is_private_placeholder: true,
        };
      }
      const { song_user_id: _, ...safe } = e;
      return safe;
    });
    res.json({ ...setlist, entries: safeEntries });
  });

  router.put('/setlists/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    const { name, visibility, event_date } = req.body;
    const validationError = validateSetlistInput(name, event_date);
    if (validationError) return res.status(400).json({ error: validationError });
    const vis = visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC;
    const result = db.prepare('UPDATE setlists SET name = ?, visibility = ?, event_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .run(name.trim(), vis, event_date !== undefined ? (event_date || null) : null, id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Setlist not found' });
    res.json({ success: true });
  });

  router.delete('/setlists/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    const result = db.prepare('DELETE FROM setlists WHERE id = ? AND user_id = ?').run(id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Setlist not found' });
    res.json({ success: true });
  });

  router.post('/setlists/:id/songs', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    if (!resolveSetlist(res, id, req.user.id)) return;
    const { song_id, transpose, nashville } = req.body;
    if (!song_id) return res.status(400).json({ error: 'song_id is required' });
    const songIdParsed = parseId(song_id);
    if (!songIdParsed) return res.status(400).json({ error: 'Invalid song_id' });
    const transposeErr = validateTranspose(transpose);
    if (transposeErr) return res.status(400).json({ error: transposeErr });
    if (nashville !== undefined && typeof nashville !== 'boolean' && nashville !== 0 && nashville !== 1) {
      return res.status(400).json({ error: 'Nashville must be a boolean' });
    }
    const song = db.prepare('SELECT id, user_id, visibility, status FROM songs WHERE id = ?').get(songIdParsed);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.status === STATUS.PENDING) return res.status(400).json({ error: 'Cannot add a pending correction to a setlist' });
    if (song.user_id !== req.user.id && song.visibility !== VISIBILITY.PUBLIC) {
      return res.status(403).json({ error: 'Cannot add a private song you don\'t own' });
    }
    const maxPos = db.prepare('SELECT MAX(position) as max FROM setlist_songs WHERE setlist_id = ?').get(id);
    const position = (maxPos.max || 0) + 1;
    const result = db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, transpose, nashville) VALUES (?, ?, ?, ?, ?)')
      .run(id, songIdParsed, position, transpose || 0, nashville ? 1 : 0);
    db.prepare('UPDATE setlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    res.json({ entry_id: result.lastInsertRowid, position });
  });

  router.put('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = parseId(req.params.setlistId);
    const entryId = parseId(req.params.entryId);
    if (!setlistId) return res.status(400).json({ error: 'Invalid setlist ID' });
    if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });
    if (!resolveSetlist(res, setlistId, req.user.id)) return;
    const entry = db.prepare('SELECT * FROM setlist_songs WHERE id = ? AND setlist_id = ?').get(entryId, setlistId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const { transpose, nashville, content_override } = req.body;
    const transposeErr = validateTranspose(transpose);
    if (transposeErr) return res.status(400).json({ error: transposeErr });
    if (nashville !== undefined && typeof nashville !== 'boolean' && nashville !== 0 && nashville !== 1) {
      return res.status(400).json({ error: 'Nashville must be a boolean' });
    }
    if (content_override !== undefined && content_override !== null && content_override.length > LIMITS.MAX_CONTENT) {
      return res.status(400).json({ error: 'Content override too large (max 100KB)' });
    }
    db.prepare(`UPDATE setlist_songs SET
      transpose = COALESCE(?, transpose),
      nashville = COALESCE(?, nashville),
      content_override = ?
      WHERE id = ?`).run(
      transpose !== undefined ? transpose : null,
      nashville !== undefined ? (nashville ? 1 : 0) : null,
      content_override !== undefined ? content_override : entry.content_override,
      entryId
    );
    db.prepare('UPDATE setlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(setlistId);
    res.json({ success: true });
  });

  router.delete('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = parseId(req.params.setlistId);
    const entryId = parseId(req.params.entryId);
    if (!setlistId) return res.status(400).json({ error: 'Invalid setlist ID' });
    if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });
    if (!resolveSetlist(res, setlistId, req.user.id)) return;
    const result = db.prepare('DELETE FROM setlist_songs WHERE id = ? AND setlist_id = ?').run(entryId, setlistId);
    if (!result.changes) return res.status(404).json({ error: 'Entry not found' });
    db.prepare('UPDATE setlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(setlistId);
    res.json({ success: true });
  });

  router.put('/setlists/:id/reorder', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    if (!resolveSetlist(res, id, req.user.id)) return;
    const { entry_ids } = req.body;
    if (!Array.isArray(entry_ids)) return res.status(400).json({ error: 'entry_ids array is required' });
    if (entry_ids.length > LIMITS.MAX_REORDER) return res.status(400).json({ error: 'Too many entries' });
    const parsedIds = entry_ids.map(e => parseId(e));
    if (parsedIds.some(e => e === null)) return res.status(400).json({ error: 'All entry_ids must be valid integers' });
    if (new Set(parsedIds).size !== parsedIds.length) return res.status(400).json({ error: 'Duplicate entry_ids are not allowed' });
    const actualCount = db.prepare('SELECT COUNT(*) as count FROM setlist_songs WHERE setlist_id = ?').get(id).count;
    if (parsedIds.length !== actualCount) return res.status(400).json({ error: 'entry_ids count must match the number of entries in the setlist' });
    reorderTransaction(id, parsedIds);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSetlistsRouter };
