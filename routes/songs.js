const express = require('express');
const { db } = require('../lib/db');
const { requireAuth, optionalAuth, isAdminRole } = require('../lib/auth');
const { STATUS, VISIBILITY, LIMITS } = require('../lib/constants');
const { parseId, validateSongInput, validateVisibility, validateLanguage } = require('../lib/validation');
const { LANGUAGE_CODES } = require('../lib/languages');
const { getFtsSearch } = require('../lib/searchUtils');

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
  const correction = db.prepare('SELECT * FROM songs WHERE id = ? AND status = ?').get(id, STATUS.PENDING);
  if (!correction) { res.status(404).json({ error: 'Pending correction not found' }); return null; }
  const originalId = correction.parent_id;
  if (!originalId) { res.status(400).json({ error: 'Correction has no parent song' }); return null; }
  const original = db.prepare('SELECT * FROM songs WHERE id = ?').get(originalId);
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
    const { q, language } = req.query;
    let query = 'SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.created_at, s.updated_at FROM songs s';
    const params = [req.user.id, STATUS.ACTIVE];

    if (q?.trim()) {
      query += ' JOIN songs_search ss ON s.id = ss.rowid';
    }

    query += ' WHERE s.user_id = ? AND s.status = ?';

    if (q?.trim()) {
      const search = getFtsSearch(q);
      query += search.sql;
      params.push(...search.params);
    }

    if (language?.trim()) {
      query += ' AND s.language = ?';
      params.push(language.trim());
    }

    query += ' ORDER BY s.updated_at DESC';
    res.json(db.prepare(query).all(...params));
  });

  router.get('/songs/public', (req, res) => {
    const { q, language } = req.query;
    let query = `
      SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.updated_at, u.username
      FROM songs s JOIN users u ON s.user_id = u.id
    `;
    const params = [VISIBILITY.PUBLIC, STATUS.ACTIVE];

    if (q?.trim()) {
      query += ' JOIN songs_search ss ON s.id = ss.rowid';
    }

    query += ' WHERE s.visibility = ? AND s.status = ?';

    if (q?.trim()) {
      const search = getFtsSearch(q);
      query += search.sql;
      params.push(...search.params);
    }

    if (language?.trim()) {
      query += ' AND s.language = ?';
      params.push(language.trim());
    }

    query += ' ORDER BY s.updated_at DESC LIMIT 100';
    res.json(db.prepare(query).all(...params));
  });

  router.get('/users/:username/songs', (req, res) => {
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const songs = db.prepare(
      'SELECT id, title, artist, key, bpm, tags, language, updated_at FROM songs WHERE user_id = ? AND visibility = ? AND status = ? ORDER BY updated_at DESC'
    ).all(user.id, VISIBILITY.PUBLIC, STATUS.ACTIVE);
    res.json(songs);
  });

  router.get('/songs/:id', optionalAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const song = db.prepare('SELECT s.*, u.username FROM songs s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.status === STATUS.PENDING) {
      const isSubmitter = req.user && req.user.id === song.user_id;
      const isOriginalOwner = req.user && song.parent_id && db.prepare('SELECT user_id FROM songs WHERE id = ?').get(song.parent_id)?.user_id === req.user.id;
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
    res.json(song);
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
    const result = db.prepare(
      'INSERT INTO songs (user_id, title, artist, key, content, visibility, youtube_url, format_detected, bpm, tags, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, meta.title, meta.artist, meta.key, content.trim(), finalVisibility, meta.youtube_url, fmt, meta.bpm, meta.tags, meta.language);
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

    const insertSong = db.prepare(
      'INSERT INTO songs (user_id, title, artist, key, content, visibility, youtube_url, bpm, tags, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const importAll = db.transaction((rows) => {
      for (const r of rows) {
        insertSong.run(req.user.id, r.title, r.artist, r.key, r.content, r.visibility, r.youtube_url, r.bpm, r.tags, r.language);
      }
    });

    try {
      importAll(valid);
      res.json({ imported: valid.length, errors });
    } catch (e) {
      console.error('Import failed:', e.message);
      res.status(500).json({ error: 'Import failed. Please check your data and try again.' });
    }
  });

  router.put('/songs/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const existing = db.prepare('SELECT * FROM songs WHERE id = ? AND user_id = ?').get(id, req.user.id);
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
    db.prepare(
      'UPDATE songs SET title=?, artist=?, key=?, content=?, visibility=?, youtube_url=?, format_detected=?, bpm=?, tags=?, language=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(meta.title, meta.artist, meta.key, finalContent, finalVisibility, meta.youtube_url, fmt, meta.bpm, meta.tags, meta.language, id);
    res.json({ success: true });
  });

  router.delete('/songs/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const isAdmin = isAdminRole(req.user.role);
    const query = isAdmin
      ? 'DELETE FROM songs WHERE id = ?'
      : 'DELETE FROM songs WHERE id = ? AND user_id = ?';
    const params = isAdmin ? [id] : [id, req.user.id];
    const result = db.prepare(query).run(...params);
    if (!result.changes) return res.status(404).json({ error: 'Song not found or not yours' });
    res.json({ success: true });
  });

  router.post('/songs/:id/version', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const original = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
    if (!original || original.status !== STATUS.ACTIVE) return res.status(404).json({ error: 'Song not found' });
    if (original.user_id !== req.user.id && !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
    const { content, youtube_url } = req.body;
    const validationError = validateSongInput({ content, youtube_url, requireContent: true, requireChord: true });
    if (validationError) return res.status(400).json({ error: validationError });

    const parentId = original.parent_id || original.id;
    const meta = extractMetadata(content);
    const result = db.prepare(
      'INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, bpm, tags, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, meta.title || original.title, meta.artist || original.artist, meta.key || original.key, content.trim(), original.visibility, parentId, meta.youtube_url || original.youtube_url, meta.bpm || original.bpm, meta.tags || original.tags, meta.language || original.language);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/versions', optionalAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const song = db.prepare('SELECT * FROM songs WHERE id = ? AND status = ?').get(id, STATUS.ACTIVE);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.visibility === VISIBILITY.PRIVATE) {
      const isOwner = req.user && req.user.id === song.user_id;
      const isAdmin = req.user && isAdminRole(req.user.role);
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Song not found' });
      }
    }
    const rootId = song.parent_id || song.id;
    const userId = req.user ? req.user.id : 0;
    const versions = db.prepare(`
      SELECT s.id, s.title, s.artist, s.key, s.created_at, s.updated_at, s.parent_id, s.youtube_url, u.username
      FROM songs s JOIN users u ON s.user_id = u.id
      WHERE (s.id = ? OR s.parent_id = ?) AND s.status = ? AND (s.user_id = ? OR s.visibility = ?)
      ORDER BY s.created_at ASC
    `).all(rootId, rootId, STATUS.ACTIVE, userId, VISIBILITY.PUBLIC);
    res.json(versions);
  });

  router.post('/songs/:id/correction', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const original = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
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
    const result = db.prepare(
      'INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, bpm, tags, status, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, meta.title || original.title, meta.artist || original.artist, meta.key || original.key, content.trim(), VISIBILITY.PUBLIC, parentId, meta.youtube_url || original.youtube_url, meta.bpm || original.bpm, meta.tags || original.tags, STATUS.PENDING, meta.language || original.language);
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/songs/:id/corrections', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid song ID' });
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    const isOwner = song.user_id === req.user.id;
    if (!isOwner && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Only the song owner or admins can view corrections' });
    }
    const rootId = song.parent_id || song.id;
    const corrections = db.prepare(`
      SELECT c.id, c.content, c.youtube_url, c.created_at, u.username
      FROM songs c JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ? AND c.status = ?
      ORDER BY c.created_at ASC
    `).all(rootId, STATUS.PENDING);
    res.json(corrections);
  });

  router.put('/corrections/:id/approve', requireAuth, (req, res) => {
    const resolved = resolveCorrectionWithAuth(req, res);
    if (!resolved) return;
    const { correction, originalId } = resolved;
    const tx = db.transaction(() => {
      db.prepare('UPDATE songs SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(correction.content, originalId);
      db.prepare('DELETE FROM songs WHERE id = ?').run(correction.id);
    });
    tx();
    res.json({ success: true });
  });

  router.delete('/corrections/:id', requireAuth, (req, res) => {
    const resolved = resolveCorrectionWithAuth(req, res);
    if (!resolved) return;
    db.prepare('DELETE FROM songs WHERE id = ?').run(resolved.correction.id);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createSongsRouter };
