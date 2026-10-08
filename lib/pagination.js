function queryList(db, {
  sql, params = [], countSql, countParams = [],
  page = null, limit = null, resultKey, unpagedLimit = null,
}) {
  if (page === null || limit === null) {
    return unpagedLimit === null
      ? db.prepare(sql).all(...params)
      : db.prepare(`${sql} LIMIT ?`).all(...params, unpagedLimit);
  }
  const total = db.prepare(countSql).get(...countParams).count;
  const rows = db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
  return { [resultKey]: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { queryList };
