const express = require('express');
const { requireAuth, optionalAuth, isAdminRole } = require('../lib/auth');
const { STATUS, VISIBILITY, LIMITS } = require('../lib/constants');
const { parseId, validateSetlistInput, validateTranspose, parsePaginationParams } = require('../lib/validation');
const Setlist = require('../lib/models/setlist');
const Song = require('../lib/models/song');

function resolveSetlist(res, setlistId, userId) {
  const setlist = Setlist.findById(setlistId, userId);
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' });
    return null;
  }
  return setlist;
}

function createSetlistsRouter() {
  const router = express.Router();

  router.get('/setlists', requireAuth, (req, res) => {
    const { q, date_from, date_to, page, limit } = req.query;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Setlist.listForUser(req.user.id, { q, dateFrom: date_from, dateTo: date_to, page: pageNum, limit: limitNum }));
  });

  router.post('/setlists', requireAuth, (req, res) => {
    const { name, visibility, event_date } = req.body;
    const validationError = validateSetlistInput(name, event_date);
    if (validationError) return res.status(400).json({ error: validationError });
    const vis = visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC;
    const result = Setlist.create(req.user.id, name.trim(), vis, event_date || null);
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  });

  router.get('/setlists/public', (req, res) => {
    const { q, date_from, date_to, page, limit } = req.query;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Setlist.listPublic({ q, dateFrom: date_from, dateTo: date_to, page: pageNum, limit: limitNum }));
  });

  router.get('/setlists/public/:id', optionalAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    const setlist = Setlist.findPublicById(id);
    if (!setlist) return res.status(404).json({ error: 'Setlist not found' });
    const entries = Setlist.getEntries(id);
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
    const entries = Setlist.getEntries(id);
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
    const result = Setlist.update(id, req.user.id, name.trim(), vis, event_date !== undefined ? (event_date || null) : null);
    if (!result.changes) return res.status(404).json({ error: 'Setlist not found' });
    res.json({ success: true });
  });

  router.delete('/setlists/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid setlist ID' });
    const result = Setlist.delete(id, req.user.id);
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
    const song = Song.findById(songIdParsed);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.status === STATUS.PENDING) return res.status(400).json({ error: 'Cannot add a pending correction to a setlist' });
    if (song.user_id !== req.user.id && song.visibility !== VISIBILITY.PUBLIC) {
      return res.status(403).json({ error: 'Cannot add a private song you don\'t own' });
    }
    const result = Setlist.addSongEntry(id, songIdParsed, { transpose, nashville });
    res.json({ entry_id: result.entry_id, position: result.position });
  });

  router.put('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = parseId(req.params.setlistId);
    const entryId = parseId(req.params.entryId);
    if (!setlistId) return res.status(400).json({ error: 'Invalid setlist ID' });
    if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });
    if (!resolveSetlist(res, setlistId, req.user.id)) return;
    const entry = Setlist.getEntryById(entryId, setlistId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const { transpose, nashville, font, two_col, content_override } = req.body;
    const transposeErr = validateTranspose(transpose);
    if (transposeErr) return res.status(400).json({ error: transposeErr });
    if (nashville !== undefined && typeof nashville !== 'boolean' && nashville !== 0 && nashville !== 1) {
      return res.status(400).json({ error: 'Nashville must be a boolean' });
    }
    if (content_override !== undefined && content_override !== null && content_override.length > LIMITS.MAX_CONTENT) {
      return res.status(400).json({ error: 'Content override too large (max 100KB)' });
    }
    Setlist.updateSongEntry(entryId, setlistId, entry, {
      transpose,
      nashville,
      font,
      twoCol: two_col,
      contentOverride: content_override
    });
    res.json({ success: true });
  });

  router.delete('/setlists/:setlistId/entries/:entryId', requireAuth, (req, res) => {
    const setlistId = parseId(req.params.setlistId);
    const entryId = parseId(req.params.entryId);
    if (!setlistId) return res.status(400).json({ error: 'Invalid setlist ID' });
    if (!entryId) return res.status(400).json({ error: 'Invalid entry ID' });
    if (!resolveSetlist(res, setlistId, req.user.id)) return;
    const result = Setlist.deleteSongEntry(entryId, setlistId);
    if (!result.changes) return res.status(404).json({ error: 'Entry not found' });
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
    const entries = Setlist.getEntries(id);
    if (parsedIds.length !== entries.length) return res.status(400).json({ error: 'entry_ids count must match the number of entries in the setlist' });
    Setlist.reorderEntries(id, parsedIds);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSetlistsRouter };
