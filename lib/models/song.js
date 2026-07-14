const { db } = require('../db');
const { STATUS, VISIBILITY } = require('../constants');
const { getFtsSearch } = require('../searchUtils');
const { computeSongHash } = require('../songHash');
const { dedupeSongs } = require('../importDedup');

// Prepared statements for song-related queries (static ones)
const findByIdStmt = db.prepare('SELECT s.*, u.username FROM songs s JOIN users u ON s.user_id = u.id WHERE s.id = ?');

const countVersionStmt = db.prepare(`
  SELECT COUNT(*) as count FROM songs 
  WHERE COALESCE(parent_id, id) = COALESCE(?, ?) AND status = ? AND (visibility = ? OR user_id = ?)
`);


const createStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, youtube_url, format_detected, bpm, tags, language, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateStmt = db.prepare(`
  UPDATE songs SET title=?, artist=?, key=?, content=?, visibility=?, youtube_url=?, format_detected=?, bpm=?, tags=?, language=?, content_hash=?, updated_at=CURRENT_TIMESTAMP
  WHERE id=?
`);

const deleteStmt = db.prepare('DELETE FROM songs WHERE id = ?');
const deleteByOwnerStmt = db.prepare('DELETE FROM songs WHERE id = ? AND user_id = ?');

const createVersionStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, bpm, tags, language, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getVersionsStmt = db.prepare(`
  SELECT s.id, s.title, s.artist, s.key, s.created_at, s.updated_at, s.parent_id, s.youtube_url, u.username
  FROM songs s JOIN users u ON s.user_id = u.id
  WHERE (s.id = ? OR s.parent_id = ?) AND s.status = ? AND (s.user_id = ? OR s.visibility = ?)
  ORDER BY s.created_at ASC
`);

const createCorrectionStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, bpm, tags, status, language, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

const selectUserHashesStmt = db.prepare('SELECT content_hash FROM songs WHERE user_id = ?');

// Correction approval transaction
const approveCorrectionTransaction = db.transaction((content, originalId, correctionId) => {
  db.prepare('UPDATE songs SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, originalId);
  db.prepare('DELETE FROM songs WHERE id = ?').run(correctionId);
});

// Import songs transaction
const insertImportStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, youtube_url, bpm, tags, language, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertImportedTransaction = db.transaction((userId, rows) => {
  for (const r of rows) {
    insertImportStmt.run(
      userId, r.title, r.artist, r.key, r.content, r.visibility,
      r.youtube_url, r.bpm, r.tags, r.language, r.content_hash,
    );
  }
});

module.exports = {
  // Read operations
  findById: (id) => findByIdStmt.get(id),
  getVersionCount: (parentId, songId, userId) => countVersionStmt.get(parentId, songId, STATUS.ACTIVE, VISIBILITY.PUBLIC, userId).count,
  listByUser(targetUserId, { page = null, limit = null } = {}) {
    let selectPart = `
      SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.updated_at,
             (SELECT COUNT(*) FROM songs v WHERE COALESCE(v.parent_id, v.id) = COALESCE(s.parent_id, s.id) AND v.status = ? AND v.visibility = ?) as version_count
    `;
    const selectParams = [STATUS.ACTIVE, VISIBILITY.PUBLIC];

    let bodyPart = `
      FROM songs s
      WHERE s.user_id = ? AND s.visibility = ? AND s.status = ?
    `;
    const bodyParams = [targetUserId, VISIBILITY.PUBLIC, STATUS.ACTIVE];

    if (page !== null && limit !== null) {
      const countQuery = `SELECT COUNT(DISTINCT COALESCE(s.parent_id, s.id)) as count` + bodyPart;
      const totalCount = db.prepare(countQuery).get(...bodyParams).count;

      const songsQuery = selectPart + bodyPart + ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * limit;
      const songs = db.prepare(songsQuery).all(...selectParams, ...bodyParams, limit, offset);

      return {
        songs,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      };
    } else {
      const songsQuery = selectPart + bodyPart + ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC';
      return db.prepare(songsQuery).all(...selectParams, ...bodyParams);
    }
  },
  getVersions: (rootId, userId) => getVersionsStmt.all(rootId, rootId, STATUS.ACTIVE, userId, VISIBILITY.PUBLIC),
  getCorrections: (rootId) => getCorrectionsStmt.all(rootId, STATUS.PENDING),

  // Dynamic searches
  listForUser(userId, { q, language, page = null, limit = null } = {}) {
    let selectPart = `
      SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.created_at, s.updated_at,
             (SELECT COUNT(*) FROM songs v WHERE COALESCE(v.parent_id, v.id) = COALESCE(s.parent_id, s.id) AND v.status = ? AND (v.visibility = ? OR v.user_id = ?)) as version_count
    `;
    const selectParams = [STATUS.ACTIVE, VISIBILITY.PUBLIC, userId];

    let bodyPart = `
      FROM songs s
    `;
    const bodyParams = [];

    if (q?.trim()) {
      bodyPart += ' JOIN songs_search ss ON s.id = ss.rowid';
    }

    bodyPart += ' WHERE s.user_id = ? AND s.status = ?';
    bodyParams.push(userId, STATUS.ACTIVE);

    if (q?.trim()) {
      const search = getFtsSearch(q);
      bodyPart += search.sql;
      bodyParams.push(...search.params);
    }

    if (language?.trim()) {
      bodyPart += ' AND s.language = ?';
      bodyParams.push(language.trim());
    }

    if (page !== null && limit !== null) {
      const countQuery = `SELECT COUNT(DISTINCT COALESCE(s.parent_id, s.id)) as count` + bodyPart;
      const totalCount = db.prepare(countQuery).get(...bodyParams).count;

      const songsQuery = selectPart + bodyPart + ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * limit;
      const songs = db.prepare(songsQuery).all(...selectParams, ...bodyParams, limit, offset);

      return {
        songs,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      };
    } else {
      const songsQuery = selectPart + bodyPart + ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC';
      return db.prepare(songsQuery).all(...selectParams, ...bodyParams);
    }
  },

  listPublic({ q, language, userId = 0, page = null, limit = null } = {}) {
    let selectPart = `
      SELECT s.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.updated_at, u.username,
             (SELECT COUNT(*) FROM songs v WHERE COALESCE(v.parent_id, v.id) = COALESCE(s.parent_id, s.id) AND v.status = ? AND (v.visibility = ? OR v.user_id = ?)) as version_count
    `;
    const selectParams = [STATUS.ACTIVE, VISIBILITY.PUBLIC, userId];

    let bodyPart = `
      FROM songs s JOIN users u ON s.user_id = u.id
    `;
    const bodyParams = [];

    if (q?.trim()) {
      bodyPart += ' JOIN songs_search ss ON s.id = ss.rowid';
    }

    bodyPart += ' WHERE s.visibility = ? AND s.status = ?';
    bodyParams.push(VISIBILITY.PUBLIC, STATUS.ACTIVE);

    if (q?.trim()) {
      const search = getFtsSearch(q);
      bodyPart += search.sql;
      bodyParams.push(...search.params);
    }

    if (language?.trim()) {
      bodyPart += ' AND s.language = ?';
      bodyParams.push(language.trim());
    }

    if (page !== null && limit !== null) {
      const countQuery = `SELECT COUNT(DISTINCT COALESCE(s.parent_id, s.id)) as count` + bodyPart;
      const totalCount = db.prepare(countQuery).get(...bodyParams).count;

      const songsQuery = selectPart + bodyPart + ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * limit;
      const songs = db.prepare(songsQuery).all(...selectParams, ...bodyParams, limit, offset);

      return {
        songs,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      };
    } else {
      const songsQuery = selectPart + bodyPart + ' GROUP BY COALESCE(s.parent_id, s.id) ORDER BY MAX(s.updated_at) DESC LIMIT 100';
      return db.prepare(songsQuery).all(...selectParams, ...bodyParams);
    }
  },

  // Write operations
  create: (userId, meta, content, visibility, formatDetected) => {
    return createStmt.run(userId, meta.title, meta.artist, meta.key, content.trim(), visibility, meta.youtube_url, formatDetected, meta.bpm, meta.tags, meta.language, computeSongHash(content.trim()));
  },

  update: (id, meta, content, visibility, formatDetected) => {
    return updateStmt.run(meta.title, meta.artist, meta.key, content, visibility, meta.youtube_url, formatDetected, meta.bpm, meta.tags, meta.language, computeSongHash(content.trim()), id);
  },

  delete: (id, userId = null) => {
    if (userId !== null) {
      return deleteByOwnerStmt.run(id, userId);
    }
    return deleteStmt.run(id);
  },

  importSongs: (userId, songs) => {
    const existing = new Set(selectUserHashesStmt.all(userId).map((r) => r.content_hash));
    const { toInsert, skipped } = dedupeSongs(existing, songs);
    insertImportedTransaction(userId, toInsert);
    return { imported: toInsert.length, skipped };
  },

  createVersion: (userId, parentId, meta, content, visibility) => {
    return createVersionStmt.run(userId, meta.title, meta.artist, meta.key, content.trim(), visibility, parentId, meta.youtube_url, meta.bpm, meta.tags, meta.language, computeSongHash(content.trim()));
  },

  createCorrection: (userId, parentId, meta, content) => {
    return createCorrectionStmt.run(userId, meta.title, meta.artist, meta.key, content.trim(), VISIBILITY.PUBLIC, parentId, meta.youtube_url, meta.bpm, meta.tags, STATUS.PENDING, meta.language, computeSongHash(content.trim()));
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
