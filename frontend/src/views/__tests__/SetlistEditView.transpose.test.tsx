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
  entries: [{ entry_id: 1, song_id: 9, title: 'S', artist: '', content: '{key: C}\n[C]a', transpose: 12, nashville: 0 }],
};

describe('SetlistEditView transpose buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockResolvedValue(setlist);
  });

  it('never PUTs a transpose the API would reject, even from the boundary', async () => {
    render(<SetlistEditView setlistId={1} navigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('S')).toBeTruthy());

    // Entry sits at +12, the top of the API's accepted range. One more sharp
    // would push an un-normalized accumulator to 13 and fail the save.
    fireEvent.click(screen.getByText('♯'));

    await waitFor(() => {
      const puts = mockApiCall.mock.calls.filter(c => c[0] === 'PUT');
      expect(puts.length).toBe(1);
    });

    const [, , body] = mockApiCall.mock.calls.find(c => c[0] === 'PUT')!;
    expect(body.transpose).toBe(1);
    expect(body.transpose).toBeGreaterThanOrEqual(-12);
    expect(body.transpose).toBeLessThanOrEqual(12);
  });
});
