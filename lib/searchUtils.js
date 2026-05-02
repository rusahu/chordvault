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

module.exports = { getFtsSearch, getLikeSearch };
