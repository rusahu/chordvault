const ChordSheetJS = require('chordsheetjs');
const { normalizeKey, CANONICAL_KEYS } = require('./enharmonic');

const KEY_DIRECTIVE_RE = /\{key\s*:\s*([^}]*)\}/;
const CANONICAL_KEY_SET = new Set(CANONICAL_KEYS);

/**
 * Derives the sounding key of a song after a semitone shift.
 *
 * Used ONLY by the one-time target_key backfill. Deliberately narrow: it reads
 * the {key:} directive rather than running the full parser the frontend uses.
 * Verified to agree with the frontend's getSongKey for all 128 live entries,
 * and every live song carries an explicit key directive.
 *
 * Matches only a lowercase `key` directive, case-sensitively, because that is
 * all ChordProParser recognises on the frontend: {k:}, {Key:} and {KEY:} give
 * it no key at all. Reading them here would backfill a perfectly canonical
 * target_key that the frontend disagrees with, which the migration's gate
 * cannot catch. Those rows derive '' instead and block the column drop.
 *
 * Returns '' when no key can be derived, INCLUDING when the derived spelling
 * isn't one of the CANONICAL_KEYS names (e.g. a stray 'B#' that .normalize()
 * + normalizeKey() didn't resolve to a canonical name) — the migration's
 * verification gate only blocks the column drop on an empty return, so this
 * function must never hand back a name it can't vouch for. CANONICAL_KEYS
 * includes German notation ('H'/'Hm') alongside the 24 major/minor names,
 * since that's a supported {key:} spelling that can legitimately survive an
 * octave-equivalent transpose unchanged.
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
    return CANONICAL_KEY_SET.has(normalized) ? normalized : '';
  } catch {
    return '';
  }
}

module.exports = { songKeyFromContent };
