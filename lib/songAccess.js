const { VISIBILITY } = require('./constants');
const { canManageSong } = require('./auth');

function canViewSongVisibility(user, song) {
  return song.visibility === VISIBILITY.PUBLIC || canManageSong(user, song.user_id);
}

function maskSetlistEntry(entry, user) {
  if (!canViewSongVisibility(user, { visibility: entry.visibility, user_id: entry.song_user_id })) {
    return {
      entry_id: entry.entry_id, song_id: entry.song_id, position: entry.position,
      target_key: null, nashville: 0, content_override: null,
      title: '[Private Song]', artist: '', content: '', key: '',
      youtube_url: null, bpm: null, tags: null, language: '',
      username: '', is_private_placeholder: true,
    };
  }
  const { song_user_id: _, ...safe } = entry;
  return safe;
}

module.exports = { canViewSongVisibility, maskSetlistEntry };
