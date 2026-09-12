import { render, waitFor } from '@testing-library/react';
import { SetlistPlayView } from '../SetlistPlayView';

// Renders the real view against the real chord library: the only thing mocked
// is the API. This is what covers the branch's actual feature — the player
// deriving its semitone shift from the entry's stored target_key — which every
// other suite either mocks away or reimplements.

const mockApiCall = vi.fn();

vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApiCall }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => vi.fn() }));

const ENTRY = {
  entry_id: 1,
  song_id: 9,
  title: 'Song',
  artist: '',
  content: '{key: C}\n[C]Amazing [G]grace how [F]sweet',
  content_override: null,
  target_key: null as string | null,
  nashville: 0,
  font: null,
  two_col: null,
  bpm: null,
  youtube_url: null,
  language: 'en',
};

const setlistWith = (target_key: string | null) => ({
  id: 1,
  user_id: 1,
  name: 'SL',
  visibility: 'private',
  event_date: null,
  entries: [{ ...ENTRY, target_key }],
});

const renderPlayer = async () => {
  const { container } = render(<SetlistPlayView setlistId={1} navigate={vi.fn()} />);
  await waitFor(() => expect(container.querySelector('#key-display')).toBeTruthy());
  return {
    keyLabel: () => container.querySelector('#key-display')!.textContent,
    chords: () => [...container.querySelectorAll('#chord-output .chord')]
      .map((c) => c.textContent)
      .filter(Boolean),
  };
};

describe('SetlistPlayView target key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the chord sheet in the stored target key, not the written key', async () => {
    mockApiCall.mockResolvedValue(setlistWith('A'));
    const { keyLabel, chords } = await renderPlayer();

    // C -> A is -3 semitones, so C G F sounds as A E D.
    expect(keyLabel()).toBe('KEY A');
    expect(chords()).toEqual(['A', 'E', 'D']);
  });

  it('renders as written when no target key is stored', async () => {
    mockApiCall.mockResolvedValue(setlistWith(null));
    const { keyLabel, chords } = await renderPlayer();

    expect(keyLabel()).toBe('KEY C');
    expect(chords()).toEqual(['C', 'G', 'F']);
  });

  it('keeps a locally saved as-written reset from falling back to the pinned key', async () => {
    // The band member's explicit null must win over the owner's server key.
    localStorage.setItem('cv_setlist_overrides', JSON.stringify({ '1': { '1': { target_key: null } } }));
    mockApiCall.mockResolvedValue(setlistWith('A'));
    const { keyLabel, chords } = await renderPlayer();

    expect(keyLabel()).toBe('KEY C');
    expect(chords()).toEqual(['C', 'G', 'F']);
  });

  it('converts a legacy transpose override instead of ignoring it', async () => {
    localStorage.setItem('cv_setlist_overrides', JSON.stringify({ '1': { '1': { transpose: 2 } } }));
    mockApiCall.mockResolvedValue(setlistWith(null));
    const { keyLabel, chords } = await renderPlayer();

    expect(keyLabel()).toBe('KEY D');
    expect(chords()).toEqual(['D', 'A', 'G']);
  });
});
