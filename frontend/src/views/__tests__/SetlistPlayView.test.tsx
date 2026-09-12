import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Mock } from 'vitest';
import { SetlistPlayView } from '../SetlistPlayView';
import { useSetlistPlayer } from '../../hooks/useSetlistPlayer';

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../lib/chords', async () => {
  const actual = await vi.importActual('../../lib/chords');
  return {
    ...actual,
    autoFit: vi.fn().mockReturnValue({ fontSize: -1, twoCol: true }),
    renderChordPro: vi.fn().mockReturnValue('<div id="chord-output">Song Content</div>'),
  };
});

vi.mock('../../hooks/useSetlistPlayer', () => ({
  useSetlistPlayer: vi.fn(),
}));

vi.mock('../../hooks/useApi', () => ({
  useApi: () => vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../hooks/useSwipe', () => ({
  useSwipe: vi.fn(),
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

describe('SetlistPlayView Auto-Fit', () => {
  const navigate = vi.fn();
  const mockUpdateEntry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSetlistPlayer as Mock).mockReturnValue({
      setlist: { id: 1, title: 'Test Setlist', entries: [{ entry_id: 1, title: 'Song 1', content: 'C G' }, { entry_id: 2, title: 'Song 2', content: 'D A' }] },
      entry: { entry_id: 1, title: 'Song 1', content: 'C G' },
      index: 0,
      total: 2,
      goTo: vi.fn(),
      prev: vi.fn(),
      next: vi.fn(),
      exit: vi.fn(),
      updateEntry: mockUpdateEntry,
      isModified: false,
      saveOnline: vi.fn(),
      saveLocal: vi.fn(),
    });
  });

  it('applies the fitted layout as a session override', () => {
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);

    fireEvent.click(screen.getByTitle(/Auto-fit for this screen/));

    // autoFit is mocked to return { fontSize: -1, twoCol: true }
    expect(mockUpdateEntry).toHaveBeenCalledWith(expect.objectContaining({ _font: -1 }));
  });
});
