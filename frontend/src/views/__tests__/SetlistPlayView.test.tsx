import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetlistPlayView } from '../SetlistPlayView';
import * as chords from '../../lib/chords';
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
    (useSetlistPlayer as any).mockReturnValue({
      setlist: { id: 1, title: 'Test Setlist', entries: [{ entry_id: 1, title: 'Song 1', content: 'C G' }, { entry_id: 2, title: 'Song 2', content: 'D A' }] },
      entry: { entry_id: 1, title: 'Song 1', content: 'C G', transpose: 0 },
      index: 0,
      total: 2,
      prev: vi.fn(),
      next: vi.fn(),
      exit: vi.fn(),
      updateEntry: mockUpdateEntry,
    });
  });

  it('toggles autoFitActive and calls autoFit when enabled', async () => {
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    
    const fitBtn = screen.getByTitle(/Auto-fit: adjust font/);
    
    // Enable Auto-Fit
    fireEvent.click(fitBtn);
    
    expect(chords.autoFit).toHaveBeenCalled();
    expect(screen.getByTitle(/Auto-fit: ON/)).toBeInTheDocument();
  });

  it('disables autoFitActive when manual font change happens', async () => {
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    
    const fitBtn = screen.getByTitle(/Auto-fit: adjust font/);
    fireEvent.click(fitBtn); // Enable
    
    expect(screen.getByTitle(/Auto-fit: ON/)).toBeInTheDocument();
    
    const fontPlusBtn = screen.getByText('A+');
    fireEvent.click(fontPlusBtn);
    
    expect(screen.getByTitle(/Auto-fit: adjust font/)).toBeInTheDocument();
    expect(screen.queryByTitle(/Auto-fit: ON/)).not.toBeInTheDocument();
  });

  it('automatically calls autoFit when swiping to a new song while mode is active', async () => {
    const { rerender } = render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    
    const fitBtn = screen.getByTitle(/Auto-fit: adjust font/);
    fireEvent.click(fitBtn); // Enable
    expect(chords.autoFit).toHaveBeenCalledTimes(1);
    
    // Simulate swiping to next song (index 1)
    (useSetlistPlayer as any).mockReturnValue({
      setlist: { id: 1, title: 'Test Setlist', entries: [{ entry_id: 1, title: 'Song 1', content: 'C G' }, { entry_id: 2, title: 'Song 2', content: 'D A' }] },
      entry: { entry_id: 2, title: 'Song 2', content: 'D A', transpose: 0 },
      index: 1,
      total: 2,
      prev: vi.fn(),
      next: vi.fn(),
      exit: vi.fn(),
      updateEntry: mockUpdateEntry,
    });
    
    rerender(<SetlistPlayView setlistId={1} navigate={navigate} />);
    
    await waitFor(() => {
      expect(chords.autoFit).toHaveBeenCalledTimes(2);
    });
  });
});
