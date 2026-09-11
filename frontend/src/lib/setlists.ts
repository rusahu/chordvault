import { legacyTransposeToTargetKey } from './setlistKeys';
import type { LocalSetlistEntry, SetlistEntry, Song } from '../types';

/**
 * Format a minimal local setlist entry from storage into a SetlistEntry.
 * Used for listing and metadata views where song contents are not yet loaded.
 *
 * A legacy `transpose` is NOT converted here: with no song content there is no
 * key to convert it against. Null is safe for these views because key stepping
 * is already inert without a derivable key (getSongKey('', 0) === ''); the
 * player converts the legacy value in enrichLocalEntry, where content exists.
 */
export function formatLocalEntry(e: LocalSetlistEntry, idx: number): SetlistEntry {
  return {
    entry_id: `local_${idx}`,
    song_id: e.song_id,
    title: e.title,
    artist: e.artist || '',
    target_key: e.target_key ?? null,
    nashville: e.nashville || 0,
    content: '',
    content_override: null,
    font: null,
    two_col: null,
    bpm: null,
    youtube_url: null,
    language: 'en',
  };
}

/**
 * Enrich a local setlist entry with song data.
 * Used when initializing playback or editing views requiring full song details.
 */
export function enrichLocalEntry(e: LocalSetlistEntry, song: Song | null, idx: number): SetlistEntry | null {
  if (!song) return null;
  return {
    song_id: song.id,
    entry_id: `local_${idx}`,
    title: song.title,
    artist: song.artist || '',
    content: song.content,
    content_override: null,
    // Entries saved before 1.23.0 hold an accumulated `transpose` and no
    // target_key; converting on read keeps the key they were played in. The
    // test is presence, not nullishness: a stored null is an explicit
    // "as written" and must win over a leftover transpose, the same precedence
    // migrateOverride applies to localStorage overrides.
    target_key: e.target_key !== undefined ? e.target_key : legacyTransposeToTargetKey(song.content, e.transpose),
    nashville: e.nashville ?? 0,
    font: null,
    two_col: null,
    bpm: song.bpm || null,
    youtube_url: song.youtube_url || null,
    language: song.language || 'en',
  };
}

/**
 * Asynchronously fetches full song details for the entries of a local setlist
 * and returns the list of enriched SetlistEntry objects.
 */
export async function enrichLocalSetlistSongs(
  entries: LocalSetlistEntry[],
  apiCall: <T>(method: string, path: string) => Promise<T>
): Promise<SetlistEntry[]> {
  const uniqueSongIds = Array.from(new Set(entries.map((e) => e.song_id)));
  const cache: Record<number, Song | null> = {};

  const fetches = uniqueSongIds.map((id) =>
    apiCall<Song>('GET', `/api/songs/${id}`)
      .then((song) => {
        cache[id] = song;
      })
      .catch(() => {
        cache[id] = null;
      })
  );
  await Promise.all(fetches);

  return entries
    .map((e, i) => enrichLocalEntry(e, cache[e.song_id], i))
    .filter(Boolean) as SetlistEntry[];
}
