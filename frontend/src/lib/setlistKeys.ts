import { getSongKey } from './chords';
import { getTransposeDelta } from './keys';

/**
 * Semitone shift that renders `content` in `targetKey`.
 *
 * Computed fresh from the song's own key every time, so correcting a song's
 * {key:} directive re-derives the shift instead of silently re-keying the
 * entry. A null/absent target key means "as written" and shifts nothing.
 */
export function entrySemitones(content: string, targetKey: string | null | undefined): number {
  return targetKey ? getTransposeDelta(getSongKey(content, 0), targetKey) : 0;
}

/**
 * Converts a pre-1.23.0 stored `transpose` delta to the key it was sounding in.
 *
 * Absent or 0 means the entry was never transposed, i.e. as-written (null).
 * Shared by both legacy read paths (localStorage overrides and local setlists)
 * so they cannot drift apart.
 */
export function legacyTransposeToTargetKey(content: string, transpose: number | undefined): string | null {
  if (!transpose) return null;
  return getSongKey(content, transpose) || null;
}
