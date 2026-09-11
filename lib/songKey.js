const ChordSheetJS = require('chordsheetjs');
const { normalizeKey } = require('./enharmonic');

const KEY_DIRECTIVE_RE = /\{(?:key|k)\s*:\s*([^}]*)\}/i;

/**
 * Derives the sounding key of a song after a semitone shift.
 *
 * Used ONLY by the one-time target_key backfill. Deliberately narrow: it reads
 * the {key:} directive rather than running the full parser the frontend uses.
 * Verified to agree with the frontend's getSongKey for all 128 live entries,
 * and every live song carries an explicit key directive.
 *
 * Returns '' when no key can be derived; the migration leaves such rows NULL
 * and its verification gate then blocks the column drop.
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
    return normalizeKey(shifted.toString());
  } catch {
    return '';
  }
}

module.exports = { songKeyFromContent };
