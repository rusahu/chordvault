import { describe, it, expect } from 'vitest';
import { formatLocalEntry, enrichLocalEntry } from '../setlists';
import type { LocalSetlistEntry, Song } from '../../types';

// cv_local_setlists entries written before 1.23.0 carry an accumulated
// `transpose` and no target_key. The player reaches them through
// enrichLocalEntry, so that is where the conversion has to happen — there is
// no server gate and no recovery for a local setlist.

const SONG = {
  id: 9,
  title: 'Song',
  artist: 'Artist',
  content: '{key: G}\n[G]a [C]b',
  bpm: null,
  youtube_url: null,
  language: 'en',
} as Song;

const legacy = (e: Partial<LocalSetlistEntry>): LocalSetlistEntry =>
  ({ song_id: 9, title: 'Song', artist: 'Artist', nashville: 0, ...e } as LocalSetlistEntry);

describe('legacy local setlist entries', () => {
  it('converts a legacy transpose to the key it was played in', () => {
    expect(enrichLocalEntry(legacy({ transpose: 2 }), SONG, 0)!.target_key).toBe('A');
  });

  it('converts a legacy downward transpose', () => {
    expect(enrichLocalEntry(legacy({ transpose: -2 }), SONG, 0)!.target_key).toBe('F');
  });

  it('treats a legacy zero transpose as as-written', () => {
    expect(enrichLocalEntry(legacy({ transpose: 0 }), SONG, 0)!.target_key).toBe(null);
  });

  it('treats an entry with neither field as as-written', () => {
    expect(enrichLocalEntry(legacy({}), SONG, 0)!.target_key).toBe(null);
  });

  it('prefers a stored target key over a stale transpose', () => {
    expect(enrichLocalEntry(legacy({ target_key: 'B', transpose: 2 }), SONG, 0)!.target_key).toBe('B');
  });

  it('formatLocalEntry cannot convert: it has no song content', () => {
    // Deliberate. Key stepping is already inert for these entries, and the
    // player always goes through enrichLocalEntry.
    expect(formatLocalEntry(legacy({ transpose: 2 }), 0).target_key).toBe(null);
  });
});
