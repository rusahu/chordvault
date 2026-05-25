const { db } = require('../db');
const { ROLES } = require('../constants');

// Prepared statements for static invite queries
const countPendingStmt = db.prepare('SELECT COUNT(*) as count FROM invites WHERE used_at IS NULL');
const findByCodeStmt = db.prepare('SELECT * FROM invites WHERE code = ? AND used_at IS NULL');
const createStmt = db.prepare('INSERT INTO invites (code, created_by) VALUES (?, ?)');
const deleteUnusedStmt = db.prepare('DELETE FROM invites WHERE id = ? AND used_at IS NULL');

const listStmt = db.prepare(`
  SELECT i.id, i.code, i.created_at, i.used_at, u.username as created_by_username,
         u2.username as used_by_username
  FROM invites i
  JOIN users u ON i.created_by = u.id
  LEFT JOIN users u2 ON i.used_by = u2.id
  ORDER BY i.created_at DESC LIMIT 50
`);

// Transaction for invite redemption
const redeemInviteTransaction = db.transaction((code, username, passwordHash) => {
  const invite = findByCodeStmt.get(code);
  if (!invite) throw new Error('Invalid or already used invite code');

  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, passwordHash, ROLES.USER);
  const userId = result.lastInsertRowid;

  db.prepare('UPDATE invites SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(userId, invite.id);

  return userId;
});

module.exports = {
  countPending: () => countPendingStmt.get().count,
  findByCode: (code) => findByCodeStmt.get(code),
  create: (code, createdBy) => createStmt.run(code, createdBy),
  list: () => listStmt.all(),
  deleteUnused: (id) => deleteUnusedStmt.run(id),

  redeem: (code, username, passwordHash) => {
    const userId = redeemInviteTransaction(code, username, passwordHash);
    return { lastInsertRowid: userId };
  },
};
