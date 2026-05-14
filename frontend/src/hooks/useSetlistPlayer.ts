import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApi } from './useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSetlistOverrides, saveSetlistOverride } from '../lib/storage';
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
  const initialIndexRef = useRef(initialIndex || 0);
  const [savedState, setSavedState] = useState({
    transpose: initialSetlist?.entries[initialIndex || 0]?.transpose || 0,
  });

  useEffect(() => {
    const endpoint = isPublic ? `/api/setlists/public/${setlistId}` : `/api/setlists/${setlistId}`;
    apiCall<Setlist>('GET', endpoint)
      .then((sl) => {
        // Merge local overrides
        const overrides = getSetlistOverrides(sl.id);
        sl.entries = sl.entries.map((en) => {
          const ov = overrides[String(en.entry_id)];
          if (ov) {
            return {
              ...en,
              transpose: ov.transpose ?? en.transpose,
              // Number notation is now view-only
            };
          }
          return en;
        });

        setSetlist(sl);
        const startIdx = initialIndexRef.current;
        if (sl.entries[startIdx]) {
          const e = sl.entries[startIdx];
          setSavedState({
            transpose: e.transpose,
          });
        }
      })
      .catch((e) => { toast(e.message, 'error'); navigate(user ? 'setlists' : 'browse'); });
  }, [setlistId, apiCall, isPublic, navigate, toast, user]);

  const entry: SetlistEntry | null = setlist?.entries[index] || null;
  const total = setlist?.entries.length || 0;

  const isModified = useMemo(() => {
    if (!entry) return false;
    return entry.transpose !== savedState.transpose;
  }, [entry, savedState]);

  /**
   * Saves the current transpose settings to the server (only for owners).
   */
  const saveOnline = useCallback(async (silent = false) => {
    if (!setlist || !entry || !user || setlist.user_id !== user.id) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, {
        transpose: entry.transpose,
        // Nashville/Font/TwoCol removed from save payload
      });
      setSavedState({ 
        transpose: entry.transpose, 
      });
      if (!silent) toast('Key saved to cloud', 'success');
    } catch (e) {
      if (!silent) toast((e as Error).message, 'error');
    }
  }, [setlist, entry, apiCall, user, toast]);

  /**
   * Saves the current transpose settings locally in the browser.
   */
  const saveLocal = useCallback((silent = false) => {
    if (!setlist || !entry) return;
    saveSetlistOverride(setlist.id, entry.entry_id, {
      transpose: entry.transpose,
    });
    setSavedState({ 
      transpose: entry.transpose, 
    });
    if (!silent) toast('Key saved locally', 'success');
  }, [setlist, entry, toast]);

  const autoSave = useCallback((currentEntry: SetlistEntry | null, currentSavedState: any) => {
    if (!currentEntry) return;
    const modified = currentEntry.transpose !== currentSavedState.transpose;

    if (!modified) return;
    const isOwner = setlist?.user_id && user && setlist.user_id === user.id;
    if (isOwner) saveOnline(true);
    else saveLocal(true);
  }, [setlist, user, saveOnline, saveLocal]);

  const goTo = useCallback((newIdx: number) => {
    if (!setlist) return;

    if (newIdx < 0 || newIdx >= setlist.entries.length) {
      // Revert URL to current valid index
      if (!setlist.isLocal) {
        let h = `#setlist/${setlistId}/play`;
        if (isPublic) h += '/public';
        if (index > 0) h += `/${index}`;
        history.replaceState(null, '', location.pathname + location.search + h);
      }
      return;
    }

    autoSave(entry, savedState);
    setIndex(newIdx);
    onNavigate?.();
    const newEntry = setlist.entries[newIdx];
    setSavedState({
      transpose: newEntry.transpose,
    });

    if (!setlist.isLocal) {
      let h = `#setlist/${setlistId}/play`;
      if (isPublic) h += '/public';
      if (newIdx > 0) h += `/${newIdx}`;
      history.replaceState(null, '', location.pathname + location.search + h);
    }

    // Scroll after React re-renders the new song content
    // We use a small timeout to ensure the DOM has actually updated and stabilized
    setTimeout(() => {
      window.scrollTo(0, 0);
      const output = document.querySelector('.chord-sheet-wrap');
      if (output) output.scrollTo(0, 0);
    }, 40);
  }, [setlist, autoSave, onNavigate, setlistId, isPublic, index]);

  useEffect(() => {
    const onHash = () => {
      const match = location.hash.match(/^#setlist\/\d+\/play(?:\/public)?(?:\/(\d+))?$/);
      if (match) {
        const urlIdx = match[1] ? parseInt(match[1]) : 0;
        if (urlIdx !== index) {
          goTo(urlIdx);
        }
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [goTo, index]);

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  const updateEntry = useCallback((updates: Partial<SetlistEntry>) => {
    setSetlist((prev) => {
      if (!prev) return null;
      const newEntries = [...prev.entries];
      newEntries[index] = { ...newEntries[index], ...updates };
      return { ...prev, entries: newEntries };
    });
  }, [index]);

  const exit = useCallback(() => {
    autoSave(entry, savedState);
    if (setlist?.isLocal) { location.hash = ''; navigate('local-setlists'); }
    else if (setlist?.user_id && user && setlist.user_id === user.id) { navigate('setlist-edit', { id: String(setlist.id) }); }
    else { location.hash = ''; navigate(user ? 'setlists' : 'browse'); }
  }, [setlist, autoSave, navigate, user]);

  return { setlist, entry, index, total, goTo, prev, next, exit, autoSave, updateEntry, isModified, saveOnline, saveLocal };
}
