import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetlistEditView } from '../SetlistEditView';

const mockApiCall = vi.fn();

vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApiCall }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../../hooks/useLocalSetlists', () => ({
  useLocalSetlists: () => ({
    getOne: vi.fn(), addEntry: vi.fn(), updateEntry: vi.fn(), removeEntry: vi.fn(),
    moveEntry: vi.fn(), reorderEntries: vi.fn(), rename: vi.fn(), create: vi.fn(),
    remove: vi.fn(), refresh: vi.fn(), setlists: [],
  }),
}));

const setlist = {
  id: 1, user_id: 1, name: 'SL', visibility: 'private',
  entries: [{ entry_id: 1, song_id: 9, title: 'S', artist: '', content: '{key: C}\n[C]a', target_key: 'B', nashville: 0 }],
};

describe('SetlistEditView key buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockResolvedValue(setlist);
  });

  it('steps the key by name instead of accumulating a delta', async () => {
    render(<SetlistEditView setlistId={1} navigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('S')).toBeTruthy());

    // Entry is pinned to B. One sharp step should assign C directly.
    fireEvent.click(screen.getByText('♯'));

    await waitFor(() => {
      const puts = mockApiCall.mock.calls.filter(c => c[0] === 'PUT');
      expect(puts.length).toBe(1);
    });

    const [, , body] = mockApiCall.mock.calls.find(c => c[0] === 'PUT')!;
    expect(body).toEqual({ target_key: 'C' });
  });

  it('disables the key buttons for a song with no derivable key', async () => {
    mockApiCall.mockResolvedValue({
      ...setlist,
      entries: [{ ...setlist.entries[0], content: 'just lyrics, no chords', target_key: null }],
    });
    render(<SetlistEditView setlistId={1} navigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('S')).toBeTruthy());
    expect(screen.getByText('♭')).toBeDisabled();
    expect(screen.getByText('♯')).toBeDisabled();
  });
});
