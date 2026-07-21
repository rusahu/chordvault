const OpenCC = require('opencc-js');

// Initialize converters once to avoid reloading dictionaries
const convertToTrad = OpenCC.Converter({ from: 'cn', to: 'tw' });
const convertToSimp = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * Generates search variants for Chinese queries.
 * @param {string} q - The raw search query
 * @returns {object} { qClean, qTrad, qSimp, hasVariants }
 */
function getSearchVariants(q) {
  const qClean = q.trim();
  const qTrad = convertToTrad(qClean);
  const qSimp = convertToSimp(qClean);
  return { qClean, qTrad, qSimp, hasVariants: qTrad !== qSimp };
}

// FTS5's trigram tokenizer indexes 3-char sequences, so MATCH cannot hit on
// queries shorter than this — a real limitation for 2-char CJK words (e.g. 喜樂).
const FTS_MIN_LEN = 3;

/**
 * Returns SQL snippet and params for SQLite FTS5 MATCH search.
 * @param {string} q - The search query
 * @returns {object} { sql, params }
 */
function getFtsSearch(q) {
  const { qClean, qTrad, qSimp, hasVariants } = getSearchVariants(q);
  const escapeFts = (str) => str.replace(/"/g, '""');

  if (hasVariants) {
    return {
      sql: ' AND songs_search MATCH ?',
      params: [`"${escapeFts(qTrad)}" OR "${escapeFts(qSimp)}"`],
    };
  }
  return {
    sql: ' AND songs_search MATCH ?',
    params: [`"${escapeFts(qClean)}"`],
  };
}

/**
 * Unified song search clause. Long queries use the FTS5 trigram index;
 * short queries (< FTS_MIN_LEN) fall back to LIKE, which trigram can't index.
 * @param {string} q - The search query
 * @returns {object} { join, sql, params } — `join` is the FROM-clause join to
 *   append before WHERE (empty string when no join is needed); `sql` is the
 *   AND-clause; `params` are the bound values.
 */
function getSongSearch(q) {
  const variants = getSearchVariants(q);

  let base;
  if (variants.qClean.length >= FTS_MIN_LEN) {
    const fts = getFtsSearch(q);
    base = { join: ' JOIN songs_search ss ON s.id = ss.rowid', sql: fts.sql, params: fts.params };
  } else {
    base = getShortSongSearch(variants);
  }

  return { ...base, ...getRelevanceOrder(variants) };
}

/**
 * Relevance ranking for a search query. bm25() is unusable here (degenerate on a
 * trigram index, and illegal inside the GROUP BY aggregate), so rank by WHERE the
 * term hits: title (2) > artist (1) > lyrics-only (0). Recency stays as tiebreak.
 * Works on both the FTS and LIKE paths since it only reads s.title / s.artist.
 * @param {object} variants - { qClean, qTrad, qSimp, hasVariants } from getSearchVariants
 * @returns {object} { orderBy, orderParams } — orderBy is a trailing ORDER BY prefix
 */
function getRelevanceOrder({ qClean, qTrad, qSimp, hasVariants }) {
  const forms = hasVariants ? [qTrad, qSimp] : [qClean];
  const cond = (col) => forms.map(() => `${col} LIKE ?`).join(' OR ');
  const likes = forms.map((f) => `%${f}%`);

  return {
    orderBy: `MAX(CASE WHEN ${cond('s.title')} THEN 2 WHEN ${cond('s.artist')} THEN 1 ELSE 0 END) DESC, `,
    orderParams: [...likes, ...likes],
  };
}

/**
 * Short-query (< FTS_MIN_LEN) fallback for song search. The trigram index can't
 * be used below 3 chars, so we LIKE-scan the songs_search columns directly —
 * reusing that table means lyrics are already stripped of [chords]/{directives},
 * matching the FTS scope (title + artist + lyrics) exactly. Trad/Simp variants
 * are honored so a query in either script finds titles stored in the other.
 * @param {object} variants - { qClean, qTrad, qSimp, hasVariants } from getSearchVariants
 * @returns {object} { join, sql, params }
 */
function getShortSongSearch({ qClean, qTrad, qSimp, hasVariants }) {
  const cols = ['ss.title', 'ss.artist', 'ss.lyrics'];
  const forms = hasVariants ? [qTrad, qSimp] : [qClean];

  const groups = [];
  const params = [];
  for (const form of forms) {
    groups.push(cols.map((c) => `${c} LIKE ?`).join(' OR '));
    params.push(...cols.map(() => `%${form}%`));
  }

  return {
    join: ' JOIN songs_search ss ON s.id = ss.rowid',
    sql: ` AND (${groups.join(' OR ')})`,
    params,
  };
}

/**
 * Returns SQL snippet and params for standard LIKE search.
 * @param {string} q - The search query
 * @param {string} column - The column name to search (default 's.name')
 * @returns {object} { sql, params }
 */
function getLikeSearch(q, column = 's.name') {
  const { qClean, qTrad, qSimp, hasVariants } = getSearchVariants(q);

  if (hasVariants) {
    return {
      sql: ` AND (${column} LIKE ? OR ${column} LIKE ?)`,
      params: [`%${qTrad}%`, `%${qSimp}%`],
    };
  }
  return {
    sql: ` AND ${column} LIKE ?`,
    params: [`%${qClean}%`],
  };
}

module.exports = { getFtsSearch, getLikeSearch, getSongSearch };
