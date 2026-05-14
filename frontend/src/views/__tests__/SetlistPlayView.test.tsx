import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
      entry: { entry_id: 1, title: 'Song 1', content: 'C G', transpose: 0 },
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

  it('keeps Auto-fit as a persistent mode', async () => {
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    
    const fitBtn = screen.getByTitle(/Auto-fit: adjust font/);
    fireEvent.click(fitBtn);
    
    // Button title should change to "Auto-fit: ON"
    expect(screen.getByTitle(/Auto-fit: ON/)).toBeInTheDocument();
  });

  it('fitAll cycles through songs and updates entries', async () => {
    render(<SetlistPlayView setlistId={1} navigate={navigate} />);
    
    // Open settings panel to find fitAll button
    const settingsBtn = screen.getByTitle('Settings');
    fireEvent.click(settingsBtn);
    
    const fitAllBtn = screen.getByText('Fit ALL songs');
    
    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);
    
    fireEvent.click(fitAllBtn);
    
    // Should finish quickly because delay is 0 in tests
    await waitFor(() => expect(mockUpdateEntry).toHaveBeenCalled(), { timeout: 2000 });
  });
});
