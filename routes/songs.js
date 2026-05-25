const express = require('express');
const { requireAuth, optionalAuth, isAdminRole } = require('../lib/auth');
const { STATUS, VISIBILITY, LIMITS } = require('../lib/constants');
const { parseId, validateSongInput, validateVisibility, validateLanguage, parsePaginationParams } = require('../lib/validation');
const { LANGUAGE_CODES } = require('../lib/languages');
const Song = require('../lib/models/song');
const User = require('../lib/models/user');

function extractDirective(content, name) {
  const re = new RegExp(`\\{${name}:\\s*([^}]*)\\}`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

function extractMetadata(content) {
  const tags = extractDirective(content, 'x_tags');
  const cleanedTags = tags ? String(tags).split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(',') : null;
  const bpmStr = extractDirective(content, 'tempo');
  const bpm = bpmStr ? parseInt(bpmStr, 10) : null;
  return {
    title: extractDirective(content, 'title') || '',
    artist: extractDirective(content, 'artist') || '',
    key: extractDirective(content, 'key') || '',
    bpm: (bpm && bpm >= 1 && bpm <= 300) ? bpm : null,
    youtube_url: extractDirective(content, 'x_youtube') || null,
    tags: cleanedTags,
    language: extractDirective(content, 'x_language') || '',
  };
}

function resolveCorrectionWithAuth(req, res) {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid correction ID' }); return null; }
  const correction = Song.findById(id);
  if (!correction || correction.status !== STATUS.PENDING) { res.status(404).json({ error: 'Pending correction not found' }); return null; }
  const originalId = correction.parent_id;
  if (!originalId) { res.status(400).json({ error: 'Correction has no parent song' }); return null; }
  const original = Song.findById(originalId);
  if (!original) { res.status(404).json({ error: 'Original song not found' }); return null; }
  const isOwner = original.user_id === req.user.id;
  if (!isOwner && !isAdminRole(req.user.role)) {
    res.status(403).json({ error: 'Only the song owner or admins can manage corrections' });
    return null;
  }
  return { correction, original, originalId };
}

function createSongsRouter() {
  const router = express.Router();

  router.get('/songs', requireAuth, (req, res) => {
    const { q, language, page, limit } = req.query;
    const userId = req.user.id;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Song.listForUser(userId, { q, language, page: pageNum, limit: limitNum }));
  });

  router.get('/songs/public', (req, res) => {
    const { q, language, page, limit } = req.query;
    const userId = req.user ? req.user.id : 0;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    res.json(Song.listPublic({ q, language, userId, page: pageNum, limit: limitNum }));
  });

  router.get('/users/:username/songs', (req, res) => {
    const user = User.findByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { page, limit } = req.query;
    const { page: pageNum, limit: limitNum } = parsePaginationParams(page, limit);
    const songs = Song.listByUser(user.id, { page: pageNum, limit: limitNum });
    res.json(songs);
  });

  router.get('/songs/:id', optionalAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const song = Song.findById(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.status === STATUS.PENDING) {
      const isSubmitter = req.user && req.user.id === song.user_id;
      const isOriginalOwner = req.user && song.parent_id && Song.findById(song.parent_id)?.user_id === req.user.id;
      const isAdmin = req.user && isAdminRole(req.user.role);
      if (!isSubmitter && !isOriginalOwner && !isAdmin) {
        return res.status(404).json({ error: 'Song not found' });
      }
    }
    if (song.visibility === VISIBILITY.PRIVATE) {
      const isOwner = req.user && req.user.id === song.user_id;
      const isAdmin = req.user && isAdminRole(req.user.role);
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Song not found' });
      }
    }
    // Include version_count for single song view
    const userId = req.user ? req.user.id : 0;
    const versionCount = Song.getVersionCount(song.parent_id, song.id, userId);
    res.json({ ...song, version_count: versionCount });
  });

  router.post('/songs', requireAuth, (req, res) => {
    const { content, format_detected, visibility } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    if (content.length > LIMITS.MAX_CONTENT) return res.status(400).json({ error: `Song content too large (max ${LIMITS.MAX_CONTENT / 1000}KB)` });
    if (!/\[[A-G][^\]]*\]/.test(content)) return res.status(400).json({ error: 'No chords detected. Add chords (e.g. [C], [G]) before saving.' });
    const meta = extractMetadata(content);
    if (!meta.title) return res.status(400).json({ error: 'Title is required. Add {title: Song Name} to your content.' });
    if (meta.language) {
      const langError = validateLanguage(meta.language);
      if (langError) return res.status(400).json({ error: langError });
    }
    const visError = validateVisibility(visibility);
    if (visError) return res.status(400).json({ error: visError });

    const fmt = format_detected?.trim() || null;
    const finalVisibility = visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC;
    const result = Song.create(req.user.id, meta, content, finalVisibility, fmt);
    res.json({ id: result.lastInsertRowid });
  });

  router.post('/songs/import', requireAuth, (req, res) => {
    const { songs } = req.body;
    if (!Array.isArray(songs)) return res.status(400).json({ error: 'Request body must contain a "songs" array' });
    if (songs.length > LIMITS.MAX_IMPORT) return res.status(400).json({ error: `Maximum ${LIMITS.MAX_IMPORT} songs per import` });

    const errors = [];
    const valid = [];

    songs.forEach((s, i) => {
      if (!s.content?.trim()) { errors.push({ index: i, error: 'Content is required' }); return; }
      if (s.content.length > LIMITS.MAX_CONTENT) { errors.push({ index: i, error: `Content too large (max ${LIMITS.MAX_CONTENT / 1000}KB)` }); return; }
      const meta = extractMetadata(s.content);
      if (!meta.title) { errors.push({ index: i, error: 'Title is required. Add {title: Song Name} to content.' }); return; }
      if (meta.language && !LANGUAGE_CODES.has(meta.language)) { errors.push({ index: i, error: `Invalid language code: ${meta.language}` }); return; }
      const visError = validateVisibility(s.visibility);
      if (visError) { errors.push({ index: i, error: visError }); return; }
      valid.push({
        ...meta,
        content: s.content.trim(),
        visibility: s.visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC,
      });
    });

    try {
      Song.importSongs(req.user.id, valid);
      res.json({ imported: valid.length, errors });
    } catch (e) {
      console.error('Import failed:', e.message);
      res.status(500).json({ error: 'Import failed. Please check your data and try again.' });
    }
  });

  router.put('/songs/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const existing = Song.findById(id);
    if (!existing) return res.status(404).json({ error: 'Song not found or not yours' });
    const { content, format_detected, visibility } = req.body;
    const finalContent = content?.trim() || existing.content;
    if (content && content.length > LIMITS.MAX_CONTENT) return res.status(400).json({ error: `Song content too large (max ${LIMITS.MAX_CONTENT / 1000}KB)` });
    if (content && !/\[[A-G][^\]]*\]/.test(content)) return res.status(400).json({ error: 'No chords detected. Add chords (e.g. [C], [G]) before saving.' });
    const meta = extractMetadata(finalContent);
    if (!meta.title) return res.status(400).json({ error: 'Title is required. Add {title: Song Name} to your content.' });
    if (meta.language) {
      const langError = validateLanguage(meta.language);
      if (langError) return res.status(400).json({ error: langError });
    }
    const visError = validateVisibility(visibility);
    if (visError) return res.status(400).json({ error: visError });

    const fmt = format_detected !== undefined ? (format_detected?.trim() || null) : existing.format_detected;
    const finalVisibility = visibility !== undefined ? (visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC) : existing.visibility;
    Song.update(id, meta, finalContent, finalVisibility, fmt);
    res.json({ success: true });
  });

  router.delete('/songs/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const isAdmin = isAdminRole(req.user.role);
    const result = Song.delete(id, isAdmin ? null : req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Song not found or not yours' });
    res.json({ success: true });
  });

  router.post('/songs/:id/version', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const original = Song.findById(id);
    if (!original || original.status !== STATUS.ACTIVE) return res.status(404).json({ error: 'Song not found' });
    
    const isOwner = original.user_id === req.user.id;
    const isAdmin = isAdminRole(req.user.role);
    const isPublic = original.visibility === VISIBILITY.PUBLIC;
    if (!isOwner && !isAdmin && !isPublic) return res.status(403).json({ error: 'Not authorized' });

    const { content, youtube_url } = req.body;
    const validationError = validateSongInput({ content, youtube_url, requireContent: true, requireChord: true });
    if (validationError) return res.status(400).json({ error: validationError });

    const parentId = original.parent_id || original.id;
    const meta = extractMetadata(content);
    const result = Song.createVersion(req.user.id, parentId, meta, content, original.visibility);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/versions', optionalAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const song = Song.findById(id);
    if (!song || song.status !== STATUS.ACTIVE) return res.status(404).json({ error: 'Song not found' });
    if (song.visibility === VISIBILITY.PRIVATE) {
      const isOwner = req.user && req.user.id === song.user_id;
      const isAdmin = req.user && isAdminRole(req.user.role);
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Song not found' });
      }
    }
    const rootId = song.parent_id || song.id;
    const userId = req.user ? req.user.id : 0;
    const versions = Song.getVersions(rootId, userId);
    res.json(versions);
  });

  router.post('/songs/:id/correction', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const original = Song.findById(id);
    if (!original) return res.status(404).json({ error: 'Song not found' });
    if (original.status === STATUS.PENDING) return res.status(400).json({ error: 'Cannot correct a pending correction' });
    if (original.visibility === VISIBILITY.PRIVATE && req.user.id !== original.user_id) {
      return res.status(403).json({ error: 'Cannot submit corrections on private songs' });
    }
    const { content, youtube_url } = req.body;
    const validationError = validateSongInput({ content, youtube_url, requireContent: true, requireChord: true });
    if (validationError) return res.status(400).json({ error: validationError.replace('before saving', 'before submitting') });

    const parentId = original.parent_id || original.id;
    const meta = extractMetadata(content);
    const result = Song.createCorrection(req.user.id, parentId, meta, content);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/corrections', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const song = Song.findById(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    const isOwner = song.user_id === req.user.id;
    if (!isOwner && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the song owner or admins can view corrections' });
    }
    const rootId = song.parent_id || song.id;
    const corrections = Song.getCorrections(rootId);
    res.json(corrections);
  });

  router.put('/corrections/:id/approve', requireAuth, (req, res) => {
    const resolved = resolveCorrectionWithAuth(req, res);
    if (!resolved) return;
    const { correction, originalId } = resolved;
    Song.approveCorrection(correction.id, originalId, correction.content);
    res.json({ success: true });
  });

  router.delete('/corrections/:id', requireAuth, (req, res) => {
    const resolved = resolveCorrectionWithAuth(req, res);
    if (!resolved) return;
    Song.deleteCorrection(resolved.correction.id);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSongsRouter };
