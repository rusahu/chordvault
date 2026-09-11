import { render } from '@testing-library/react';
import { SetlistEntryCard } from '../SetlistEntryCard';
import type { SetlistEntry } from '../../types';

const ENTRY: SetlistEntry = {
  entry_id: 1,
  song_id: 9,
  title: 'Song',
  artist: 'Artist',
  content: '{key: C}\n[C]a [G]b',
  content_override: null,
  target_key: null,
  nashville: 0,
  font: null,
  two_col: null,
  bpm: null,
  youtube_url: null,
  language: 'en',
};

const meta = (entry: SetlistEntry) => {
  const { container } = render(
    <SetlistEntryCard
      entry={entry}
      idx={0}
      isEditable
      isLocal={false}
      onRemove={vi.fn()}
      onStepKey={vi.fn()}
      onClick={vi.fn()}
      t={(k) => k}
    />
  );
  return container.querySelector('.song-card-meta')!.textContent;
};

describe('SetlistEntryCard key display', () => {
  it('shows the stored target key, not the song written key', () => {
    expect(meta({ ...ENTRY, target_key: 'B' })).toBe('Artist · B');
  });

  it('shows the written key when the entry is as-written', () => {
    expect(meta(ENTRY)).toBe('Artist · C');
  });

  it('derives the shift from a content override when there is one', () => {
    // Override is written in E, so pinning to G is a different shift than the
    // song's own key would give.
    expect(meta({ ...ENTRY, content_override: '{key: E}\n[E]a', target_key: 'G' })).toBe('Artist · G');
  });
});
