const { db } = require('../db');
const { STATUS, VISIBILITY } = require('../constants');
const { getFtsSearch } = require('../searchUtils');

// Prepared statements for song-related queries (static ones)
const findByIdStmt = db.prepare('SELECT s.*, u.username FROM songs s JOIN users u ON s.user_id = u.id WHERE s.id = ?');

const countVersionStmt = db.prepare(`
  SELECT COUNT(*) as count FROM songs 
  WHERE COALESCE(parent_id, id) = COALESCE(?, ?) AND status = ? AND (visibility = ? OR user_id = ?)
`);

const listByUserStmt = db.prepare(`
  SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.updated_at,
         (SELECT COUNT(*) FROM songs v WHERE COALESCE(v.parent_id, v.id) = COALESCE(s.parent_id, s.id) AND v.status = ? AND v.visibility = ?) as version_count
  FROM songs s
  WHERE s.user_id = ? AND s.visibility = ? AND s.status = ?
  GROUP BY COALESCE(s.parent_id, s.id)
  ORDER BY MAX(s.updated_at) DESC
`);

const createStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, youtube_url, format_detected, bpm, tags, language)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateStmt = db.prepare(`
  UPDATE songs SET title=?, artist=?, key=?, content=?, visibility=?, youtube_url=?, format_detected=?, bpm=?, tags=?, language=?, updated_at=CURRENT_TIMESTAMP
  WHERE id=?
`);

const deleteStmt = db.prepare('DELETE FROM songs WHERE id = ?');
const deleteByOwnerStmt = db.prepare('DELETE FROM songs WHERE id = ? AND user_id = ?');

const createVersionStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, bpm, tags, language)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getVersionsStmt = db.prepare(`
  SELECT s.id, s.title, s.artist, s.key, s.created_at, s.updated_at, s.parent_id, s.youtube_url, u.username
  FROM songs s JOIN users u ON s.user_id = u.id
  WHERE (s.id = ? OR s.parent_id = ?) AND s.status = ? AND (s.user_id = ? OR s.visibility = ?)
  ORDER BY s.created_at ASC
`);

const createCorrectionStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, bpm, tags, status, language)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getCorrectionsStmt = db.prepare(`
  SELECT c.id, c.content, c.youtube_url, c.created_at, u.username
  FROM songs c JOIN users u ON c.user_id = u.id
  WHERE c.parent_id = ? AND c.status = ?
  ORDER BY c.created_at ASC
`);

const getPendingCorrectionsStmt = db.prepare(`
  SELECT c.id, c.title, c.created_at, c.parent_id, u.username as submitter
  FROM songs c JOIN users u ON c.user_id = u.id
  WHERE c.status = ?
  ORDER BY c.created_at ASC
`);

const countSongsStmt = db.prepare('SELECT COUNT(*) as count FROM songs');
const countPendingStmt = db.prepare('SELECT COUNT(*) as count FROM songs WHERE status = ?');
const countNoFormatStmt = db.prepare("SELECT COUNT(*) as count FROM songs WHERE format_detected IS NULL AND content != '' AND status = ?");
const languageDistributionStmt = db.prepare(`
  SELECT language, COUNT(*) as count FROM songs
  WHERE status = ? AND language != ''
  GROUP BY language
  ORDER BY count DESC
`);
const getRecentSongsStmt = db.prepare(`
  SELECT s.id, s.title, s.artist, s.visibility, s.created_at, u.username
  FROM songs s JOIN users u ON s.user_id = u.id
  ORDER BY s.created_at DESC LIMIT ?
`);

// Correction approval transaction
const approveCorrectionTransaction = db.transaction((content, originalId, correctionId) => {
  db.prepare('UPDATE songs SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, originalId);
  db.prepare('DELETE FROM songs WHERE id = ?').run(correctionId);
});

// Import songs transaction
const importSongsTransaction = db.transaction((userId, songs) => {
  const insertSong = db.prepare(`
    INSERT INTO songs (user_id, title, artist, key, content, visibility, youtube_url, bpm, tags, language)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of songs) {
    insertSong.run(userId, r.title, r.artist, r.key, r.content, r.visibility, r.youtube_url, r.bpm, r.tags, r.language);
  }
});

module.exports = {
  // Read operations
  findById: (id) => findByIdStmt.get(id),
  getVersionCount: (parentId, songId, userId) => countVersionStmt.get(parentId, songId, STATUS.ACTIVE, VISIBILITY.PUBLIC, userId).count,
  listByUser: (userId) => listByUserStmt.all(STATUS.ACTIVE, VISIBILITY.PUBLIC, userId, VISIBILITY.PUBLIC, STATUS.ACTIVE),
  getVersions: (rootId, userId) => getVersionsStmt.all(rootId, rootId, STATUS.ACTIVE, userId, VISIBILITY.PUBLIC),
  getCorrections: (rootId) => getCorrectionsStmt.all(rootId, STATUS.PENDING),

  // Dynamic searches
  listForUser(userId, { q, language } = {}) {
    let query = `
      SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.created_at, s.updated_at,
             (SELECT COUNT(*) FROM songs v WHERE COALESCE(v.parent_id, v.id) = COALESCE(s.parent_id, s.id) AND v.status = ? AND (v.visibility = ? OR v.user_id = ?)) as version_count
      FROM songs s
    `;
    const params = [STATUS.ACTIVE, VISIBILITY.PUBLIC, userId];

    if (q?.trim()) {
      query += ' JOIN songs_search ss ON s.id = ss.rowid';
    }

    query += ' WHERE s.user_id = ? AND s.status = ?';
    params.push(userId, STATUS.ACTIVE);

    if (q?.trim()) {
      const search = getFtsSearch(q);
      query += search.sql;
      params.push(...search.params);
    }

    if (language?.trim()) {
      query += ' AND s.language = ?';
      params.push(language.trim());
    }

    query += ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC';
    return db.prepare(query).all(...params);
  },

  listPublic({ q, language, userId = 0 } = {}) {
    let query = `
      SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.updated_at, u.username,
             (SELECT COUNT(*) FROM songs v WHERE COALESCE(v.parent_id, v.id) = COALESCE(s.parent_id, s.id) AND v.status = ? AND (v.visibility = ? OR v.user_id = ?)) as version_count
      FROM songs s JOIN users u ON s.user_id = u.id
    `;
    const params = [STATUS.ACTIVE, VISIBILITY.PUBLIC, userId, VISIBILITY.PUBLIC, STATUS.ACTIVE];

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

    query += ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC LIMIT 100';
    return db.prepare(query).all(...params);
  },

  // Write operations
  create: (userId, meta, content, visibility, formatDetected) => {
    return createStmt.run(userId, meta.title, meta.artist, meta.key, content.trim(), visibility, meta.youtube_url, formatDetected, meta.bpm, meta.tags, meta.language);
  },

  update: (id, meta, content, visibility, formatDetected) => {
    return updateStmt.run(meta.title, meta.artist, meta.key, content, visibility, meta.youtube_url, formatDetected, meta.bpm, meta.tags, meta.language, id);
  },

  delete: (id, userId = null) => {
    if (userId !== null) {
      return deleteByOwnerStmt.run(id, userId);
    }
    return deleteStmt.run(id);
  },

  importSongs: (userId, songs) => {
    importSongsTransaction(userId, songs);
  },

  createVersion: (userId, parentId, meta, content, visibility) => {
    return createVersionStmt.run(userId, meta.title, meta.artist, meta.key, content.trim(), visibility, parentId, meta.youtube_url, meta.bpm, meta.tags, meta.language);
  },

  createCorrection: (userId, parentId, meta, content) => {
    return createCorrectionStmt.run(userId, meta.title, meta.artist, meta.key, content.trim(), VISIBILITY.PUBLIC, parentId, meta.youtube_url, meta.bpm, meta.tags, STATUS.PENDING, meta.language);
  },

  approveCorrection: (correctionId, originalId, content) => {
    approveCorrectionTransaction(content, originalId, correctionId);
    return { success: true };
  },

  deleteCorrection: (correctionId) => {
    return deleteStmt.run(correctionId);
  },

  // Admin stats operations
  count: () => countSongsStmt.get().count,
  countPending: () => countPendingStmt.get(STATUS.PENDING).count,
  countNoFormat: () => countNoFormatStmt.get(STATUS.ACTIVE).count,
  getLanguageDistribution: () => languageDistributionStmt.all(STATUS.ACTIVE),
  getRecent: (limit) => getRecentSongsStmt.all(limit),
  getPendingCorrections: () => getPendingCorrectionsStmt.all(STATUS.PENDING),
};
