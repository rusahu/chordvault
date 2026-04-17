const Database = require('better-sqlite3');

const db = new Database('./data/chordvault.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'user',
    disabled      INTEGER DEFAULT 0,
    gemini_api_key TEXT DEFAULT NULL,
    gemini_prompt  TEXT DEFAULT NULL,
    preferred_languages TEXT DEFAULT NULL,
    gemini_model   TEXT DEFAULT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS songs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    artist          TEXT DEFAULT '',
    key             TEXT DEFAULT '',
    content         TEXT NOT NULL,
    visibility      TEXT DEFAULT 'public',
    parent_id       INTEGER REFERENCES songs(id) ON DELETE SET NULL,
    youtube_url     TEXT DEFAULT NULL,
    format_detected TEXT DEFAULT NULL,
    bpm             INTEGER DEFAULT NULL,
    tags            TEXT DEFAULT NULL,
    language        TEXT NOT NULL DEFAULT '',
    status          TEXT DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS setlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    visibility TEXT DEFAULT 'private',
    event_date TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS setlist_songs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    setlist_id       INTEGER REFERENCES setlists(id) ON DELETE CASCADE,
    song_id          INTEGER REFERENCES songs(id) ON DELETE CASCADE,
    position         INTEGER NOT NULL,
    transpose        INTEGER DEFAULT 0,
    nashville        INTEGER DEFAULT 0,
    content_override TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS invites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_by    INTEGER REFERENCES users(id) DEFAULT NULL,
    used_at    DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Indexes for common queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_songs_user_status ON songs(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_songs_visibility_status ON songs(visibility, status);
  CREATE INDEX IF NOT EXISTS idx_songs_parent_id ON songs(parent_id);
  CREATE INDEX IF NOT EXISTS idx_setlists_user ON setlists(user_id);
  CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist ON setlist_songs(setlist_id, position);
  CREATE INDEX IF NOT EXISTS idx_songs_language ON songs(language);
`);

// Seed data
db.prepare("UPDATE users SET role = 'owner' WHERE id = (SELECT MIN(id) FROM users)").run();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

function isRegistrationAllowed() {
  return getSetting('allow_registration') === '1';
}

{
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'allow_registration'").get();
  if (!existing) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('allow_registration', '0')").run();
  }
}

// Migrate: add gemini_model column if missing (for existing databases)
{
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('gemini_model')) {
    db.exec("ALTER TABLE users ADD COLUMN gemini_model TEXT DEFAULT NULL");
  }
}

const stmts = {
  getUserById: db.prepare('SELECT id, username, role, disabled FROM users WHERE id = ?'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  countUsers: db.prepare('SELECT COUNT(*) as count FROM users'),
  getFullUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
};

const deleteUserTransaction = db.transaction((id) => {
  db.prepare('DELETE FROM songs WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
});

module.exports = {
  db,
  stmts,
  getSetting,
  setSetting,
  isRegistrationAllowed,
  deleteUserTransaction,
};
