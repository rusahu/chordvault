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

vi.mock('../../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../../lib/storage')>('../../lib/storage');
  return {
    getSetlistOverrides: vi.fn(),
    saveSetlistOverride: vi.fn(),
    migrateOverride: actual.migrateOverride,
  };
});

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
        content: '{key: C}\n[C]a [F]b',
        content_override: null,
        target_key: 'A',
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

  it('does not trigger isModified when session layout options are changed, but triggers when the key changes', async () => {
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

    // Update the target key (should trigger isModified)
    act(() => {
      result.current.updateEntry({ target_key: 'C' });
    });
    expect(result.current.isModified).toBe(true);
  });

  it('saves only the target key to server during saveOnline', async () => {
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

    // Update the target key
    act(() => {
      result.current.updateEntry({ target_key: 'C' });
    });

    mockApiCall.mockResolvedValueOnce({ success: true });

    await act(async () => {
      await result.current.saveOnline(true);
    });

    // Verify PUT request only sends target_key
    expect(mockApiCall).toHaveBeenLastCalledWith(
      'PUT',
      '/api/setlists/1/entries/entry_1',
      { target_key: 'C' }
    );
    expect(result.current.isModified).toBe(false);
  });

  it('saves only the target key locally during saveLocal', async () => {
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

    // Update the target key and session layout
    act(() => {
      result.current.updateEntry({ target_key: 'G', _font: 1 });
    });

    act(() => {
      result.current.saveLocal(true);
    });

    // Verify only target_key is stored
    expect(mockSaveOverride).toHaveBeenCalledWith(1, 'entry_1', {
      target_key: 'G',
    });
    expect(result.current.isModified).toBe(false);
  });

  describe('target key assignment', () => {
    // Scope: this only covers updateEntry's merge, which is where a picked key
    // enters the hook's state. The shift the key produces is computed at render
    // time, not here — see SetlistPlayView.key.test.tsx for that.
    it('replaces the entry target key on every update', async () => {
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      for (const key of ['A', 'G', 'A', 'G', 'C', 'F#']) {
        act(() => { result.current.updateEntry({ target_key: key }); });
        expect(result.current.entry!.target_key).toBe(key);
      }
    });

    it('treats a null target key as an unsaved reset to as-written', async () => {
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      act(() => { result.current.updateEntry({ target_key: null }); });
      expect(result.current.entry!.target_key).toBe(null);
      expect(result.current.isModified).toBe(true);
    });

    it('converts a legacy transpose override on load', async () => {
      mockGetOverrides.mockReturnValue({ entry_1: { transpose: 2 } });
      mockApiCall.mockResolvedValue(mockSetlist);
      const { result } = renderHook(() =>
        useSetlistPlayer({ setlistId: 1, navigate })
      );
      await waitFor(() => expect(result.current.setlist).toBeTruthy());

      // mockSetlist entry_1 content is in C, so +2 is D
      expect(result.current.entry!.target_key).toBe('D');
      expect(mockSaveOverride).toHaveBeenCalled();
    });
  });
});
