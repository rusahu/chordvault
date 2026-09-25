const { LIMITS } = require('./constants');
const { CANONICAL_KEYS, normalizeKey } = require('./enharmonic');
const { LANGUAGE_CODES } = require('./languages');

function parseId(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function isValidDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

function validateUserCredentials(username, password) {
  if (!username?.trim() || !password) return 'Username and password required';
  if (username.trim().length < LIMITS.USERNAME_MIN || username.trim().length > LIMITS.USERNAME_MAX) return `Username must be ${LIMITS.USERNAME_MIN}-${LIMITS.USERNAME_MAX} characters`;
  if (password.length < LIMITS.PASSWORD_MIN) return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
  return null;
}

function validateSongInput({ title, content, youtube_url, bpm, requireTitle = false, requireContent = false, requireChord = false }) {
  if (requireTitle && !title?.trim()) return 'Title and content are required';
  if (requireContent && !content?.trim()) return 'Title and content are required';
  if (title && title.trim().length > LIMITS.MAX_TITLE) return `Title too long (max ${LIMITS.MAX_TITLE} characters)`;
  if (content && content.length > LIMITS.MAX_CONTENT) return `Song content too large (max ${LIMITS.MAX_CONTENT / 1000}KB)`;
  if (requireChord && content && !/\[[A-G][^\]]*\]/.test(content)) return 'No chords detected. Add chords (e.g. [C], [G]) before saving.';
  if (youtube_url && youtube_url.length > LIMITS.MAX_YOUTUBE_URL) return 'YouTube URL too long';
  if (youtube_url && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(youtube_url)) {
    return 'YouTube URL must be a valid youtube.com or youtu.be link';
  }
  if (bpm !== undefined && bpm !== null && (isNaN(Number(bpm)) || Number(bpm) < LIMITS.MIN_BPM || Number(bpm) > LIMITS.MAX_BPM)) return `BPM must be between ${LIMITS.MIN_BPM} and ${LIMITS.MAX_BPM}`;
  return null;
}

function validateVisibility(visibility) {
  if (visibility !== undefined && visibility !== 'public' && visibility !== 'private') {
    return 'Visibility must be "public" or "private"';
  }
  return null;
}

function validateSetlistInput(name, event_date) {
  if (!name?.trim()) return 'Name is required';
  if (name.trim().length > LIMITS.MAX_SETLIST_NAME) return `Name too long (max ${LIMITS.MAX_SETLIST_NAME} characters)`;
  if (event_date && !isValidDate(event_date)) return 'Invalid date (use YYYY-MM-DD)';
  return null;
}

const CANONICAL_KEY_SET = new Set(CANONICAL_KEYS);

/**
 * The canonical spelling a target key is stored as: trimmed, with awkward
 * enharmonics resolved to the name the key picker and stepKey use. Storing
 * anything else leaves the sharp/flat buttons dead on that entry.
 */
function canonicalTargetKey(key) {
  return normalizeKey(String(key).trim());
}

/**
 * Accepts only the key names the renderer can actually use.
 *
 * Key.parse is far looser — it takes numerals ('1'), solfege ('Do') and
 * lowercase ('a'), none of which the UI can produce. Those persisted fine and
 * then threw inside Key.distance at render time, where getTransposeDelta
 * swallows the error and renders the song as written with live-looking but
 * dead key buttons.
 */
function validateTargetKey(key) {
  if (key === undefined || key === null) return null;
  if (typeof key !== 'string') return 'Target key must be a string or null';
  const trimmed = key.trim();
  if (!trimmed) return 'Target key cannot be empty (use null for as-written)';
  if (trimmed.length > 8) return 'Target key is too long';
  if (!CANONICAL_KEY_SET.has(canonicalTargetKey(trimmed))) return `Invalid key: ${trimmed}`;
  return null;
}

function validateLanguage(code) {
  if (!code || typeof code !== 'string') return 'Language is required';
  if (!LANGUAGE_CODES.has(code)) return 'Invalid language code';
  return null;
}

function validatePreferredLanguages(languages) {
  if (!Array.isArray(languages)) return 'Languages must be an array';
  if (languages.length > LIMITS.MAX_PREFERRED_LANGUAGES) return `Maximum ${LIMITS.MAX_PREFERRED_LANGUAGES} preferred languages`;
  for (const code of languages) {
    if (!LANGUAGE_CODES.has(code)) return `Invalid language code: ${code}`;
  }
  return null;
}

function parsePaginationParams(page, limit) {
  if (page === undefined && limit === undefined) {
    return { page: null, limit: null };
  }
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 20);
  return { page: pageNum, limit: limitNum };
}

module.exports = {
  parseId,
  isValidDate,
  validateUserCredentials,
  validateSongInput,
  validateVisibility,
  validateSetlistInput,
  validateTargetKey,
  canonicalTargetKey,
  validateLanguage,
  validatePreferredLanguages,
  parsePaginationParams,
};
