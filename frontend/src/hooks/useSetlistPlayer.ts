import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './useApi';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSetlistOverrides, saveSetlistOverride, migrateOverride } from '../lib/storage';
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

/**
 * Merges the browser's stored overrides onto freshly loaded entries.
 *
 * A stored override wins even when its target_key is null: null means "play as
 * written", which is a choice the user saved, so it must not fall back to the
 * server's pinned key. An override holding no key decision at all (only layout
 * fields) leaves the entry's own key alone. Legacy records are converted to a
 * target key and written back.
 */
function applyStoredOverrides(setlistId: number | string, entries: SetlistEntry[]) {
  const overrides = getSetlistOverrides(setlistId);
  const targetKeys: Record<string, string | null> = {};
  const merged = entries.map((en) => {
    const raw = overrides[String(en.entry_id)];
    const ov = raw ? migrateOverride(raw, en.content_override || en.content) : undefined;
    if (raw && raw.transpose !== undefined) {
      saveSetlistOverride(setlistId, en.entry_id, ov!);
    }
    const storedKey = raw && ('target_key' in raw || 'transpose' in raw);
    const targetKey = (storedKey ? ov!.target_key : en.target_key) ?? null;
    targetKeys[String(en.entry_id)] = targetKey;
    return { ...en, target_key: targetKey, font: null, two_col: null, nashville: 0 };
  });
  return { entries: merged, targetKeys };
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
  
  const [savedTargetKeys, setSavedTargetKeys] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isLocal) {
      if (initialSetlist) {
        const { entries, targetKeys } = applyStoredOverrides(initialSetlist.id, initialSetlist.entries);
        setSetlist({
          ...initialSetlist,
          entries,
          isLocal: true,
        });
        setSavedTargetKeys(targetKeys);
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

              const merged = applyStoredOverrides(enriched.id, enriched.entries);
              enriched.entries = merged.entries;

              setSetlist(enriched);
              setSavedTargetKeys(merged.targetKeys);
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
        const merged = applyStoredOverrides(sl.id, sl.entries);
        sl.entries = merged.entries;

        setSetlist(sl);
        setSavedTargetKeys(merged.targetKeys);
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
    return entry.target_key !== (savedTargetKeys[String(entry.entry_id)] ?? null);
  }, [entry, savedTargetKeys]);

  /**
   * Saves the current key setting to the server (only for owners).
   */
  const saveOnline = useCallback(async (silent = false) => {
    if (!setlist || !entry || !user || setlist.user_id !== user.id) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, {
        target_key: entry.target_key,
      });
      setSavedTargetKeys(prev => ({
        ...prev,
        [String(entry.entry_id)]: entry.target_key
      }));
      if (!silent) toast('Key saved to cloud', 'success');
    } catch (e) {
      if (!silent) toast((e as Error).message, 'error');
    }
  }, [setlist, entry, apiCall, user, toast]);

  /**
   * Saves the current key setting locally in the browser.
   */
  const saveLocal = useCallback((silent = false) => {
    if (!setlist || !entry) return;
    saveSetlistOverride(setlist.id, entry.entry_id, {
      target_key: entry.target_key,
    });
    setSavedTargetKeys(prev => ({
      ...prev,
      [String(entry.entry_id)]: entry.target_key
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
