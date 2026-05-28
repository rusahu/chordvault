import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './useApi';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSetlistOverrides, saveSetlistOverride } from '../lib/storage';
import { enrichLocalSetlistSongs } from '../lib/setlists';
import type { Setlist, SetlistEntry } from '../types';

interface UseSetlistPlayerOptions {
  setlistId: number | string;
  isLocal?: boolean;
  initialSetlist?: Setlist;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
  onNavigate?: () => void;
}

export function useSetlistPlayer({
  setlistId,
  isLocal,
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
  
  const [savedTransposes, setSavedTransposes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isLocal) {
      if (initialSetlist) {
        const overrides = getSetlistOverrides(initialSetlist.id);
        const transposes: Record<string, number> = {};
        const entries = initialSetlist.entries.map((en) => {
          const ov = overrides[String(en.entry_id)];
          const transpose = ov?.transpose ?? en.transpose;
          transposes[String(en.entry_id)] = transpose;
          return {
            ...en,
            transpose,
            font: null,
            two_col: null,
            nashville: 0,
          };
        });
        setSetlist({
          ...initialSetlist,
          entries,
          isLocal: true,
        });
        setSavedTransposes(transposes);
      } else {
        // Fallback: load local setlist from storage and fetch song contents
        import('../lib/storage').then(({ getLocalSetlists }) => {
          const sl = getLocalSetlists().find((s) => s.id === setlistId);
          if (!sl) {
            toast('Local setlist not found', 'error');
            navigate('setlists');
            return;
          }
          enrichLocalSetlistSongs(sl.entries, apiCall)
            .then((entries) => {

              const enriched: Setlist = {
                id: setlistId,
                name: sl.name,
                entries,
                isLocal: true,
                visibility: 'private',
                event_date: null,
              };

              const overrides = getSetlistOverrides(enriched.id);
              const transposes: Record<string, number> = {};
              enriched.entries = enriched.entries.map((en) => {
                const ov = overrides[String(en.entry_id)];
                const transpose = ov?.transpose ?? en.transpose;
                transposes[String(en.entry_id)] = transpose;
                return {
                  ...en,
                  transpose,
                  font: null,
                  two_col: null,
                  nashville: 0,
                };
              });

              setSetlist(enriched);
              setSavedTransposes(transposes);
            })
            .catch((err) => {
              toast(err.message, 'error');
              navigate('setlists');
            });
        });
      }
      return;
    }

    const loadSetlist = async () => {
      try {
        let sl: Setlist;
        if (user) {
          try {
            sl = await apiCall<Setlist>('GET', `/api/setlists/${setlistId}`);
          } catch (err) {
            if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
              sl = await apiCall<Setlist>('GET', `/api/setlists/public/${setlistId}`);
            } else {
              throw err;
            }
          }
        } else {
          sl = await apiCall<Setlist>('GET', `/api/setlists/public/${setlistId}`);
        }

        // Merge local overrides
        const overrides = getSetlistOverrides(sl.id);
        const transposes: Record<string, number> = {};
        sl.entries = sl.entries.map((en) => {
          const ov = overrides[String(en.entry_id)];
          const transpose = ov?.transpose ?? en.transpose;
          transposes[String(en.entry_id)] = transpose;
          return {
            ...en,
            transpose,
            font: null,
            two_col: null,
            nashville: 0,
          };
        });

        setSetlist(sl);
        setSavedTransposes(transposes);
      } catch (e) {
        toast((e as Error).message, 'error');
        navigate(user ? 'setlists' : 'browse');
      }
    };

    loadSetlist();
  }, [setlistId, apiCall, isLocal, initialSetlist, navigate, toast, user]);

  const entry: SetlistEntry | null = setlist?.entries[index] || null;
  const total = setlist?.entries.length || 0;

  const isModified = useMemo(() => {
    if (!entry) return false;
    return entry.transpose !== (savedTransposes[String(entry.entry_id)] ?? 0);
  }, [entry, savedTransposes]);

  /**
   * Saves the current transpose settings to the server (only for owners).
   */
  const saveOnline = useCallback(async (silent = false) => {
    if (!setlist || !entry || !user || setlist.user_id !== user.id) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, {
        transpose: entry.transpose,
      });
      setSavedTransposes(prev => ({
        ...prev,
        [String(entry.entry_id)]: entry.transpose
      }));
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
    setSavedTransposes(prev => ({
      ...prev,
      [String(entry.entry_id)]: entry.transpose
    }));
    if (!silent) toast('Key saved locally', 'success');
  }, [setlist, entry, toast]);

  const goTo = useCallback((newIdx: number) => {
    if (!setlist) return;

    if (newIdx < 0 || newIdx >= setlist.entries.length) {
      // Revert URL to current valid index
      if (!setlist.isLocal) {
        let h = `#setlist/${setlistId}/play`;
        if (index > 0) h += `/${index}`;
        history.replaceState(null, '', location.pathname + location.search + h);
      }
      return;
    }

    setIndex(newIdx);
    onNavigate?.();

    if (!setlist.isLocal) {
      let h = `#setlist/${setlistId}/play`;
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
  }, [setlist, onNavigate, setlistId, index]);

  useEffect(() => {
    const onHash = () => {
      const match = location.hash.match(/^#setlist\/(?:local_\w+|\d+)\/play(?:\/(\d+))?$/);
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
    if (setlist) { navigate('setlist-edit', { id: String(setlist.id) }); }
  }, [setlist, navigate]);

  return { setlist, entry, index, total, goTo, prev, next, exit, updateEntry, isModified, saveOnline, saveLocal };
}
