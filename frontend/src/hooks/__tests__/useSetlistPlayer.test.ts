import { renderHook, act, waitFor } from '@testing-library/react';
import { useSetlistPlayer } from '../useSetlistPlayer';
import { getSetlistOverrides, saveSetlistOverride } from '../../lib/storage';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

const mockApiCall = vi.fn();
const mockUser = { id: 1 };
const mockToast = vi.fn();

vi.mock('../useApi', () => ({
  useApi: () => mockApiCall,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../lib/storage', () => ({
  getSetlistOverrides: vi.fn(),
  saveSetlistOverride: vi.fn(),
}));

describe('useSetlistPlayer Hook', () => {
  const navigate = vi.fn();
  const mockGetOverrides = getSetlistOverrides as Mock;
  const mockSaveOverride = saveSetlistOverride as Mock;

  const mockSetlist = {
    id: 1,
    user_id: 1,
    name: 'Test Setlist',
    entries: [
      {
        entry_id: 'entry_1',
        song_id: 101,
        title: 'Song 1',
        artist: 'Artist 1',
        content: 'C G Am F',
        content_override: null,
        transpose: 2,
        nashville: 1,
        font: 2,
        two_col: 1,
        bpm: 120,
        youtube_url: null,
        language: 'en',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockReset();
    mockGetOverrides.mockReturnValue({});
  });

  it('forces font, two_col to null and nashville to 0 on setlist load to protect against legacy values', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.setlist).not.toBeNull();
    });

    const entry = result.current.setlist!.entries[0];
    expect(entry.font).toBeNull();
    expect(entry.two_col).toBeNull();
    expect(entry.nashville).toBe(0);
  });

  it('does not trigger isModified when session layout options are changed, but triggers when transpose changes', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.entry).not.toBeNull();
    });

    expect(result.current.isModified).toBe(false);

    // Update session font scale override
    act(() => {
      result.current.updateEntry({ _font: 3 });
    });
    expect(result.current.isModified).toBe(false);

    // Update session column layout override
    act(() => {
      result.current.updateEntry({ _twoCol: true });
    });
    expect(result.current.isModified).toBe(false);

    // Update transposition override (should trigger isModified)
    act(() => {
      result.current.updateEntry({ transpose: 3 });
    });
    expect(result.current.isModified).toBe(true);
  });

  it('saves only key transposition to server during saveOnline', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.entry).not.toBeNull();
    });

    // Update transposition
    act(() => {
      result.current.updateEntry({ transpose: 5 });
    });
 
    mockApiCall.mockResolvedValueOnce({ success: true });
 
    await act(async () => {
      await result.current.saveOnline(true);
    });

    // Verify PUT request only sends transpose
    expect(mockApiCall).toHaveBeenLastCalledWith(
      'PUT',
      '/api/setlists/1/entries/entry_1',
      { transpose: 5 }
    );
    expect(result.current.isModified).toBe(false);
  });

  it('saves only key transposition locally during saveLocal', async () => {
    mockApiCall.mockResolvedValue(mockSetlist);

    const { result } = renderHook(() =>
      useSetlistPlayer({
        setlistId: 1,
        navigate,
      })
    );

    await waitFor(() => {
      expect(result.current.entry).not.toBeNull();
    });

    // Update transposition and session layout
    act(() => {
      result.current.updateEntry({ transpose: -1, _font: 1 });
    });

    act(() => {
      result.current.saveLocal(true);
    });

    // Verify only transpose is stored
    expect(mockSaveOverride).toHaveBeenCalledWith(1, 'entry_1', {
      transpose: -1,
    });
    expect(result.current.isModified).toBe(false);
  });

  describe('transpose normalization', () => {
    // Regression: repeated key picks used to accumulate unbounded (a downward
    // pick returns +10, not -2), pushing transpose past the API's +/-12 guard
    // while the displayed key looked perfectly ordinary.
    it('keeps an accumulated transpose inside the persistable range', async () => {
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      // Alternating G <-> A via the key picker: deltas arrive as +2 then +10.
      for (let i = 0; i < 6; i++) {
        const delta = i % 2 === 0 ? 2 : 10;
        const current = result.current.entry!.transpose;
        act(() => { result.current.updateEntry({ transpose: current + delta }); });
        expect(result.current.entry!.transpose).toBeGreaterThanOrEqual(-12);
        expect(result.current.entry!.transpose).toBeLessThanOrEqual(12);
      }
    });

    it('does not flag a legacy stored value as modified when the key is unchanged', async () => {
      // mockSetlist entry_1 stores transpose 2; simulate a legacy non-canonical
      // row by round-tripping up then down, which canonicalises the live value.
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      act(() => { result.current.updateEntry({ transpose: result.current.entry!.transpose + 12 }); });
      expect(result.current.entry!.transpose).toBe(2);
      expect(result.current.isModified).toBe(false);
    });

    it('canonicalises a drifted localStorage override on load', async () => {
      // Pre-v1.22.2 the override store could hold an out-of-range value; loading
      // it raw meant Save Online failed immediately, before any key change.
      mockGetOverrides.mockReturnValue({ entry_1: { transpose: 14 } });
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      expect(result.current.entry!.transpose).toBe(2);
      expect(result.current.entry!.transpose).toBeLessThanOrEqual(12);
    });

    it('leaves non-transpose updates untouched', async () => {
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());
      const before = result.current.entry!.transpose;
      act(() => { result.current.updateEntry({ nashville: 0 }); });
      expect(result.current.entry!.transpose).toBe(before);
      expect(result.current.entry!.nashville).toBe(0);
    });
  });
});
