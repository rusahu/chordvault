const { db } = require('../db');
const { maskSetlistEntry } = require('../songAccess');
const { getSearchVariants } = require('../searchUtils');

const songsQuery = db.prepare(`
  SELECT s.id, s.user_id, s.title, s.artist, s.key, s.content, s.visibility,
         s.parent_id, s.youtube_url, s.format_detected, s.bpm, s.tags,
         s.language, s.status, s.created_at, s.updated_at, u.username,
         ss.lyrics AS search_lyrics, ss.pinyin AS search_pinyin
  FROM songs s JOIN users u ON u.id = s.user_id
  LEFT JOIN songs_search ss ON ss.rowid = s.id
  WHERE s.status = 'active' AND (s.visibility = 'public' OR s.user_id = ?)
  ORDER BY s.id
`);
const setlistsQuery = db.prepare('SELECT id, user_id, name, visibility, event_date, created_at, updated_at FROM setlists WHERE user_id = ? ORDER BY id');
const entriesQuery = db.prepare(`
  SELECT e.setlist_id, e.id AS entry_id, e.song_id, e.position, e.target_key,
         e.nashville, e.font, e.two_col, e.content_override,
         s.title, s.artist, s.content, s.key, s.youtube_url, s.bpm, s.tags,
         s.language, s.visibility, s.status, s.user_id AS song_user_id, u.username
  FROM setlist_songs e JOIN setlists sl ON sl.id = e.setlist_id
  JOIN songs s ON s.id = e.song_id JOIN users u ON u.id = s.user_id
  WHERE sl.user_id = ? ORDER BY e.setlist_id, e.position, e.id
`);

function searchForms(text) {
  const { qClean, qTrad, qSimp } = getSearchVariants(text || '');
  return [...new Set([qClean, qTrad, qSimp].map(s => s.toLowerCase().replace(/\s+/g, ' ').trim()))];
}

const snapshot = db.transaction((user) => {
  const catalog = [];
  const songs = songsQuery.all(user.id).map(({ search_lyrics, search_pinyin, ...song }) => {
    const familyId = song.parent_id ?? song.id;
    const { content: _, ...metadata } = song;
    catalog.push({ ...metadata, familyId, search: {
      title: searchForms(song.title), artist: searchForms(song.artist),
      lyrics: searchForms(search_lyrics), pinyin: search_pinyin || '',
    } });
    return { ...song, familyId };
  });
  const bySetlist = new Map();
  for (const { setlist_id, status, ...entry } of entriesQuery.all(user.id)) {
    const safe = status === 'active' ? maskSetlistEntry(entry, user)
      : maskSetlistEntry({ ...entry, visibility: 'private', song_user_id: -1 }, null);
    if (!bySetlist.has(setlist_id)) bySetlist.set(setlist_id, []);
    bySetlist.get(setlist_id).push(safe);
  }
  const setlists = setlistsQuery.all(user.id).map(sl => {
    const entries = bySetlist.get(sl.id) || [];
    return { ...sl, entries, song_count: entries.length, username: user.username };
  });
  return { schemaVersion: 1, accountId: user.id, songs, catalog, setlists };
});

module.exports = { snapshot };
