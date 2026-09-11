const ChordSheetJS = require('chordsheetjs');
const { normalizeKey, ALL_KEYS, ALL_KEYS_MINOR } = require('./enharmonic');

const KEY_DIRECTIVE_RE = /\{(?:key|k)\s*:\s*([^}]*)\}/i;
const CANONICAL_KEYS = new Set([...ALL_KEYS, ...ALL_KEYS_MINOR]);

/**
 * Derives the sounding key of a song after a semitone shift.
 *
 * Used ONLY by the one-time target_key backfill. Deliberately narrow: it reads
 * the {key:} directive rather than running the full parser the frontend uses.
 * Verified to agree with the frontend's getSongKey for all 128 live entries,
 * and every live song carries an explicit key directive.
 *
 * Returns '' when no key can be derived, INCLUDING when the derived spelling
 * isn't one of the canonical ALL_KEYS/ALL_KEYS_MINOR names (e.g. a stray
 * 'B#' that .normalize() + normalizeKey() didn't resolve to a canonical
 * name) — the migration's verification gate only blocks the column drop on
 * an empty return, so this function must never hand back a name it can't
 * vouch for.
 */
function songKeyFromContent(content, semitones) {
  if (!content) return '';
  const m = content.match(KEY_DIRECTIVE_RE);
  if (!m) return '';
  const raw = m[1].trim();
  if (!raw) return '';
  try {
    const key = ChordSheetJS.Key.parse(raw);
    if (!key) return '';
    const shifted = (semitones ? key.transpose(semitones) : key).normalize();
    const normalized = normalizeKey(shifted.toString());
    return CANONICAL_KEYS.has(normalized) ? normalized : '';
  } catch {
    return '';
  }
}

module.exports = { songKeyFromContent };
