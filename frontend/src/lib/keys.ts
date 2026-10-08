import * as ChordSheetJS from 'chordsheetjs';

import { ALL_KEYS, ALL_KEYS_MINOR, ENHARMONIC_MAP, normalizeKey } from '../../../shared/music-keys.mjs';
export { ALL_KEYS, ALL_KEYS_MINOR, ENHARMONIC_MAP, normalizeKey };

export function normalizeChord(chord: string): string {
  if (!chord) return chord;
  return chord.replace(/[A-G][b#]?m?/g, (m) => ENHARMONIC_MAP[m] || m);
}

/**
 * Collapses a semitone shift onto the canonical -5..+6 window.
 *
 * Transpose is only meaningful modulo 12 (chord symbols carry no octave).
 * `getTransposeDelta` computes a single shift fresh at render time from a
 * `target_key`, but `Key.distance` only ever counts upward, so this keeps
 * that shift the shortest signed distance between the two keys.
 *
 * Twelve distinct values, not thirteen: -6 and +6 name the same key, so the
 * tritone is always canonicalised upward as +6.
 */
function normalizeTranspose(semitones: number): number {
  const wrapped = ((semitones % 12) + 12) % 12;
  return wrapped > 6 ? wrapped - 12 : wrapped;
}

/** Shortest signed distance between two keys. Negative when down is nearer. */
export function getTransposeDelta(fromKey: string, toKey: string): number {
  try {
    return normalizeTranspose(ChordSheetJS.Key.distance(fromKey, toKey));
  } catch {
    return 0;
  }
}

/**
 * Returns the key one semitone above or below `key`, preserving major/minor.
 *
 * Replaces the old accumulate-a-delta arrow handlers: stepping between key
 * names cannot drift out of range the way a running total could.
 */
export function stepKey(key: string, direction: 1 | -1): string {
  try {
    const parsed = ChordSheetJS.Key.parse(normalizeKey(key));
    if (!parsed) return key;
    const stepped = normalizeKey(parsed.transpose(direction).normalize().toString());
    if (ALL_KEYS.includes(stepped) || ALL_KEYS_MINOR.includes(stepped)) return stepped;
  } catch { /* not a key this can step */ }
  return key;
}
