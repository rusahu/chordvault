/**
 * seed-data.mjs — Seeds ChordVault with demo data via direct DB access.
 *
 * Usage: node scripts/seed-data.mjs
 *
 * Creates a hidden _system owner and a demo admin user with sample data.
 * Uses CommonJS require for better-sqlite3 and bcryptjs (bundled in node_modules).
 */

import { createRequire } from 'module';
import crypto from 'crypto';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = './data/chordvault.db';

// Open DB — server.js hasn't started yet, so we init tables ourselves
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables (same schema as lib/db.js)
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
  CREATE INDEX IF NOT EXISTS idx_songs_user_status ON songs(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_songs_visibility_status ON songs(visibility, status);
  CREATE INDEX IF NOT EXISTS idx_songs_parent_id ON songs(parent_id);
  CREATE INDEX IF NOT EXISTS idx_setlists_user ON setlists(user_id);
  CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist ON setlist_songs(setlist_id, position);
  CREATE INDEX IF NOT EXISTS idx_songs_language ON songs(language);
`);

// Settings
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('allow_registration', '0')").run();

// Step 1: Create hidden _system owner
const systemPassword = crypto.randomBytes(32).toString('hex');
const systemHash = bcrypt.hashSync(systemPassword, 10);
console.log('Creating hidden owner: _system');
db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('_system', ?, 'owner')").run(systemHash);
const systemUser = db.prepare("SELECT id FROM users WHERE username = '_system'").get();
console.log(`  Created _system (id: ${systemUser.id}, role: owner)`);

// Step 2: Create demo admin user
const demoHash = bcrypt.hashSync('demopass123', 10);
console.log('Creating demo admin user...');
db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('demo', ?, 'admin')").run(demoHash);
const demoUser = db.prepare("SELECT id FROM users WHERE username = 'demo'").get();
console.log(`  Created demo (id: ${demoUser.id}, role: admin)`);

// Step 3: Create songs owned by demo user
const songs = [
  {
    title: 'Amazing Grace',
    artist: 'John Newton',
    content: `{title: Amazing Grace}\n{artist: John Newton}\n{key: G}\n\n{start_of_verse: Verse 1}\n[G]Amazing grace, how [G7]sweet the [C]sound\nThat [C]saved a [G]wretch like [Em]me[D]\n[G]I once was lost, but [G7]now am [C]found\nWas [C]blind but [G]now [D]I [G]see\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[G]'Twas grace that [G7]taught my [C]heart to fear\nAnd [C]grace my [G]fears re[Em]lieved[D]\n[G]How precious [G7]did that [C]grace appear\nThe [C]hour I [G]first [D]be[G]lieved\n{end_of_verse}\n\n{start_of_verse: Verse 3}\n[G]Through many [G7]dangers, [C]toils and snares\nI [C]have al[G]ready [Em]come[D]\n[G]'Tis grace hath [G7]brought me [C]safe thus far\nAnd [C]grace will [G]lead [D]me [G]home\n{end_of_verse}`,
    key: 'G', language: 'en', tags: 'hymn,worship', bpm: 72, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=Jbe7OruLk8I',
  },
  {
    title: 'How Great Is Our God',
    artist: 'Chris Tomlin',
    content: `{title: How Great Is Our God}\n{artist: Chris Tomlin}\n{key: C}\n\n{start_of_verse: Verse 1}\n[C]The splendor of the King\n[Am7]Clothed in majesty\nLet all the [Fmaj7]earth rejoice\nAll the earth rejoice\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[C]He wraps Himself in light\n[Am7]And darkness tries to hide\nAnd trembles [Fmaj7]at His voice\nTrembles at His voice\n{end_of_verse}\n\n{start_of_chorus}\n[C]How great is our God\nSing with me [Am7]how great is our God\n[Fmaj7]And all will see how great\n[G]How great is our God\n{end_of_chorus}\n\n{start_of_bridge: Bridge}\n[Am7]Name above all [C]names\n[Fmaj7]Worthy of all [G]praise\n[Am7]My heart will sing\nHow [F]great [G]is our [C]God\n{end_of_bridge}`,
    key: 'C', language: 'en', tags: 'worship', bpm: 78, format_detected: 'ChordPro',
  },
  {
    title: '10,000 Reasons (Bless the Lord)',
    artist: 'Matt Redman',
    content: `{title: 10,000 Reasons (Bless the Lord)}\n{artist: Matt Redman}\n{key: G}\n\n{start_of_chorus}\n[G]Bless the [D/F#]Lord, O my [Em]soul, [C]O my soul\n[G]Worship His [D]holy [C]name\nSing like [Em]never be[C]fore, [G]O my [D]soul\nI'll [C]worship Your [D]holy [G]name\n{end_of_chorus}\n\n{start_of_verse: Verse 1}\nThe [G]sun comes [D/F#]up, it's a [Em]new day [C]dawning\n[G]It's time to [D]sing Your [Em]song a[C]gain\nWhat[G]ever may [D/F#]pass and what[Em]ever lies be[C]fore me\n[G]Let me be [D]singing when the [C]evening [D]comes\n{end_of_verse}\n\n{start_of_verse: Verse 2}\nYou're [G]rich in [D/F#]love and You're [Em]slow to [C]anger\nYour [G]name is [D]great and Your [Em]heart is [C]kind\nFor [G]all Your [D/F#]goodness I will [Em]keep on [C]singing\n[G]Ten thousand [D]reasons for my [C]heart to [D]find\n{end_of_verse}`,
    key: 'G', language: 'en', tags: 'worship,opener', bpm: 74, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=DXDGE_lRI0E',
  },
  {
    title: 'Good Good Father',
    artist: 'Chris Tomlin',
    content: `{title: Good Good Father}\n{artist: Chris Tomlin}\n{key: A}\n\n{start_of_verse: Verse 1}\n[A]Oh, I've heard a [E/G#]thousand stories\nOf [F#m7]what they think You're [D]like\nBut [A]I've heard the [E/G#]tender whisper\nOf [F#m7]love in the dead of [D]night\nAnd [A]You tell me [E/G#]that You're pleased\nAnd [F#m7]that I'm never a[D]lone\n{end_of_verse}\n\n{start_of_chorus}\nYou're a [A]good, good [E]Father\nIt's [F#m7]who You are, [D]it's who You are\n[A]It's who You [E]are\nAnd [A]I'm loved by [E]You\nIt's [F#m7]who I am, [D]it's who I am\n[A]It's who I [E]am\n{end_of_chorus}\n\n{start_of_bridge: Bridge}\n[A]You are [E]perfect in [F#m7]all of Your [D]ways\n[A]You are [E]perfect in [F#m7]all of Your [D]ways\n[A]You are [E]perfect in [F#m7]all of Your [D]ways to us\n{end_of_bridge}`,
    key: 'A', language: 'en', tags: 'worship,closer', bpm: 68, format_detected: 'ChordPro',
  },
  {
    title: 'Build My Life',
    artist: 'Housefires',
    content: `{title: Build My Life}\n{artist: Housefires}\n{key: E}\n\n{start_of_verse: Verse 1}\n[E]Worthy of [B]every song we could [C#m7]ever sing\n[A2]Worthy of all the praise we could ever bring\n[E]Worthy of [B]every breath we could [C#m7]ever breathe\nWe [A2]live for You\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[E]Jesus, the [B]name above every [C#m7]other name\n[A2]Jesus, the only one who could ever save\n[E]Worthy of [B]every breath we could [C#m7]ever breathe\nWe [A2]live for You, we live for You\n{end_of_verse}\n\n{start_of_chorus}\n[E]Holy, there is [B]no one like You\n[C#m7]There is none be[A2]side You\n[E]Open up my [B]eyes in wonder and show me\n[C#m7]Who You are and [A2]fill me\nWith Your heart and [E]lead me in Your [B]love to those a[C#m7]round me[A2]\n{end_of_chorus}\n\n{start_of_bridge: Bridge}\nI will [E]build my [B]life upon Your love\nIt is a [C#m7]firm foun[A2]dation\nI will [E]put my [B]trust in You alone\nAnd I [C#m7]will not be [A2]shaken\n{end_of_bridge}`,
    key: 'E', language: 'en', tags: 'worship,communion', bpm: 68, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=Z2kpCMH1mKE',
  },
  {
    title: 'Silent Night',
    artist: 'Franz Gruber',
    content: `{title: Silent Night}\n{artist: Franz Gruber}\n{key: C}\n\n{start_of_verse: Verse 1}\n[C]Silent night, holy [C]night\n[G7]All is calm, [C]all is bright\n[F]Round yon Virgin [C]Mother and Child\n[F]Holy Infant so [C]tender and mild\n[G7]Sleep in heavenly [Am]peace[F]\n[C]Sleep [G7]in heavenly [C]peace\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[C]Silent night, holy [C]night\n[G7]Shepherds quake [C]at the sight\n[F]Glories stream from [C]heaven afar\n[F]Heavenly hosts sing [C]Alleluia\n[G7]Christ the Savior is [Am]born[F]\n[C]Christ [G7]the Savior is [C]born\n{end_of_verse}\n\n{start_of_verse: Verse 3}\n[C]Silent night, holy [C]night\n[G7]Son of God, [C]love's pure light\n[F]Radiant beams from [C]Thy holy face\n[F]With the dawn of re[C]deeming grace\n[G7]Jesus, Lord, at Thy [Am]birth[F]\n[C]Jesus, [G7]Lord, at Thy [C]birth\n{end_of_verse}`,
    key: 'C', language: 'en', tags: 'hymn,christmas', bpm: 60, format_detected: 'ChordPro',
  },
];

const insertSong = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, language, tags, bpm, format_detected, youtube_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('\nCreating songs...');
const songIds = [];
for (const s of songs) {
  const result = insertSong.run(
    demoUser.id, s.title, s.artist, s.key, s.content,
    s.language, s.tags, s.bpm, s.format_detected, s.youtube_url || null
  );
  songIds.push(result.lastInsertRowid);
  console.log(`  ✓ ${s.title} (id: ${result.lastInsertRowid})`);
}

// Step 4: Create setlists
const insertSetlist = db.prepare(`
  INSERT INTO setlists (user_id, name, visibility, event_date)
  VALUES (?, ?, ?, ?)
`);
const insertSetlistSong = db.prepare(`
  INSERT INTO setlist_songs (setlist_id, song_id, position, transpose)
  VALUES (?, ?, ?, 0)
`);

console.log('\nCreating setlists...');

const sl1 = insertSetlist.run(demoUser.id, 'Sunday Morning Worship — March 23', 'public', '2026-03-23');
console.log(`  ✓ Sunday Morning Worship (id: ${sl1.lastInsertRowid}, public)`);
for (let i = 0; i < 4 && i < songIds.length; i++) {
  insertSetlistSong.run(sl1.lastInsertRowid, songIds[i], i);
}
console.log('    Added 4 songs');

const sl2 = insertSetlist.run(demoUser.id, 'Christmas Eve Service', 'public', '2025-12-24');
console.log(`  ✓ Christmas Eve Service (id: ${sl2.lastInsertRowid}, public)`);
if (songIds[5]) insertSetlistSong.run(sl2.lastInsertRowid, songIds[5], 0);
if (songIds[0]) insertSetlistSong.run(sl2.lastInsertRowid, songIds[0], 1);
console.log('    Added 2 songs');

const sl3 = insertSetlist.run(demoUser.id, 'Personal Practice', 'private', '2026-03-19');
console.log(`  ✓ Personal Practice (id: ${sl3.lastInsertRowid}, private)`);
if (songIds[4]) insertSetlistSong.run(sl3.lastInsertRowid, songIds[4], 0);

db.close();
console.log('\n✅ Seed complete!');
