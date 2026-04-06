import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Setlist, SetlistEntry } from '../types';

interface UseSetlistPlayerOptions {
  setlistId: number | string;
  isPublic?: boolean;
  initialSetlist?: Setlist;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
  onNavigate?: () => void;
}

export function useSetlistPlayer({
  setlistId,
  isPublic,
  initialSetlist,
  initialIndex,
  navigate,
  onNavigate,
}: UseSetlistPlayerOptions) {
  const apiCall = useApi();
  const { user } = useAuth();
  const toast = useToast();

  const [setlist, setSetlist] = useState<Setlist | null>(initialSetlist || null);
  const [index, setIndex] = useState(initialIndex || 0);
  const origRef = useRef({ transpose: 0, nashville: 0 });

  useEffect(() => {
    if (initialSetlist) return;
    const endpoint = isPublic ? `/api/setlists/public/${setlistId}` : `/api/setlists/${setlistId}`;
    apiCall<Setlist>('GET', endpoint)
      .then((sl) => {
        setSetlist(sl);
        if (sl.entries[0]) {
          origRef.current = { transpose: sl.entries[0].transpose, nashville: sl.entries[0].nashville };
        }
      })
      .catch((e) => { toast(e.message, 'error'); navigate(user ? 'setlists' : 'browse'); });
  }, [setlistId, apiCall, initialSetlist, isPublic, navigate, toast, user]);

  const entry: SetlistEntry | null = setlist?.entries[index] || null;
  const total = setlist?.entries.length || 0;

  const autoSave = useCallback(async () => {
    if (!setlist || !entry) return;
    if (entry.transpose !== origRef.current.transpose || entry.nashville !== origRef.current.nashville) {
      if (setlist.isLocal) {
        // Local setlists saved to localStorage by parent
      } else {
        try {
          await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, {
            transpose: entry.transpose, nashville: !!entry.nashville
          });
        } catch { /* silent */ }
      }
    }
  }, [setlist, entry, apiCall]);

  const goTo = useCallback((newIdx: number) => {
    if (!setlist || newIdx < 0 || newIdx >= setlist.entries.length) return;
    autoSave();
    setIndex(newIdx);
    onNavigate?.();
    const newEntry = setlist.entries[newIdx];
    origRef.current = { transpose: newEntry.transpose, nashville: newEntry.nashville };
    // Scroll after React re-renders the new song content
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [setlist, autoSave, onNavigate]);

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  const exit = useCallback(() => {
    autoSave();
    if (setlist?.isLocal) { location.hash = ''; navigate('local-setlists'); }
    else if (setlist?.user_id && user && setlist.user_id === user.id) { navigate('setlist-edit', { id: String(setlist.id) }); }
    else { location.hash = ''; navigate(user ? 'setlists' : 'browse'); }
  }, [setlist, autoSave, navigate, user]);

  return { setlist, entry, index, total, goTo, prev, next, exit, autoSave };
}
