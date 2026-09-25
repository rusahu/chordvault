import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetlistEditView } from '../SetlistEditView';

// Local setlists live entirely in localStorage, so these tests use the real
// useLocalSetlists and the real storage. A reorder changes ORDER: it must not
// rewrite the stored records, or every field this view does not load (a
// pre-1.23.0 `transpose` above all) is destroyed the first time anyone drags.

// The mocks must return stable references: SetlistEditView's load() is a
// useCallback over them, so a fresh function per render re-runs the load effect
// forever.
const { mockApiCall, mockToast, t } = vi.hoisted(() => ({
  mockApiCall: vi.fn(),
  mockToast: vi.fn(),
  t: (k: string) => k,
}));

vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApiCall }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));

const STORED = [
  { song_id: 1, title: 'Alpha', artist: '', transpose: 2, nashville: 0 },
  { song_id: 2, title: 'Bravo', artist: '', target_key: 'G', nashville: 0 },
  { song_id: 3, title: 'Charlie', artist: '', target_key: null, nashville: 0 },
];

const stored = () => JSON.parse(localStorage.getItem('cv_local_setlists')!)[0].entries;
const titles = () => stored().map((e: { title: string }) => e.title);

const renderEdit = async () => {
  const { container } = render(<SetlistEditView setlistId="local_1" navigate={vi.fn()} />);
  await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());
  const cards = () => [...container.querySelectorAll('.setlist-song-item')] as HTMLElement[];
  return (from: number, to: number) => {
    fireEvent.dragStart(cards()[from]);
    fireEvent.dragOver(cards()[to]);
    fireEvent.dragEnd(cards()[0]);
  };
};

describe('local setlist reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'cv_local_setlists',
      JSON.stringify([{ id: 'local_1', name: 'SL', entries: STORED }])
    );
  });

  it('keeps a legacy transpose that the view cannot see', async () => {
    const drag = await renderEdit();
    drag(0, 2);

    expect(titles()).toEqual(['Bravo', 'Charlie', 'Alpha']);
    expect(stored()[2].transpose).toBe(2);
    expect(stored()[0].target_key).toBe('G');
  });

  it('tells the user and resyncs when the write is rejected', async () => {
    const drag = await renderEdit();
    // Another tab removed an entry: the permutation no longer fits storage, so
    // the write must be refused rather than corrupting it.
    localStorage.setItem(
      'cv_local_setlists',
      JSON.stringify([{ id: 'local_1', name: 'SL', entries: STORED.slice(0, 2) }])
    );
    drag(0, 1);

    expect(titles()).toEqual(['Alpha', 'Bravo']);
    expect(stored()[0].transpose).toBe(2);
    expect(mockToast).toHaveBeenCalledWith('setlist.reorderFailed', 'error');
    await waitFor(() => expect(screen.queryByText('Charlie')).toBeNull());
  });

  it('maps correctly on a second drag with no reload in between', async () => {
    // entry_id is local_<load index>, so after one reorder the ids the view
    // holds no longer match storage positions. The permutation has to come
    // from the entries themselves, not from those ids.
    const drag = await renderEdit();
    drag(0, 2);
    drag(0, 1);

    expect(titles()).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(stored()[2].transpose).toBe(2);
    expect(stored()[1].target_key).toBe('G');
  });
});
