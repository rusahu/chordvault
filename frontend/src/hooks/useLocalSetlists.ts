import { useState, useCallback } from 'react';
import type { LocalSetlist, LocalSetlistEntry } from '../types';
import { getLocalSetlists, saveLocalSetlists } from '../lib/storage';
import { MAX_LOCAL_SETLISTS, MAX_LOCAL_ENTRIES } from '../lib/constants';

export function useLocalSetlists() {
  const [setlists, setSetlists] = useState<LocalSetlist[]>(() => getLocalSetlists());

  const refresh = useCallback(() => {
    setSetlists(getLocalSetlists());
  }, []);

  const create = useCallback((name: string): LocalSetlist | null => {
    const all = getLocalSetlists();
    if (all.length >= MAX_LOCAL_SETLISTS) return null;
    const sl: LocalSetlist = { id: 'local_' + Date.now(), name, entries: [] };
    all.push(sl);
    saveLocalSetlists(all);
    setSetlists(all);
    return sl;
  }, []);

  const remove = useCallback((id: string) => {
    const all = getLocalSetlists().filter((s) => s.id !== id);
    saveLocalSetlists(all);
    setSetlists(all);
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const all = getLocalSetlists();
    const sl = all.find((s) => s.id === id);
    if (sl) { sl.name = name; saveLocalSetlists(all); setSetlists([...all]); }
  }, []);

  const getOne = useCallback((id: string): LocalSetlist | undefined => {
    return getLocalSetlists().find((s) => s.id === id);
  }, []);

  const addEntry = useCallback((id: string, entry: LocalSetlistEntry): boolean => {
    const all = getLocalSetlists();
    const sl = all.find((s) => s.id === id);
    if (!sl || sl.entries.length >= MAX_LOCAL_ENTRIES) return false;
    sl.entries.push(entry);
    saveLocalSetlists(all);
    setSetlists([...all]);
    return true;
  }, []);

  const removeEntry = useCallback((id: string, idx: number) => {
    const all = getLocalSetlists();
    const sl = all.find((s) => s.id === id);
    if (sl) { sl.entries.splice(idx, 1); saveLocalSetlists(all); setSetlists([...all]); }
  }, []);

  const moveEntry = useCallback((id: string, idx: number, dir: number) => {
    const all = getLocalSetlists();
    const sl = all.find((s) => s.id === id);
    if (!sl) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sl.entries.length) return;
    const tmp = sl.entries[idx];
    sl.entries[idx] = sl.entries[newIdx];
    sl.entries[newIdx] = tmp;
    saveLocalSetlists(all);
    setSetlists([...all]);
  }, []);

  const updateEntry = useCallback((id: string, idx: number, updates: Partial<LocalSetlistEntry>) => {
    const all = getLocalSetlists();
    const sl = all.find((s) => s.id === id);
    if (sl && sl.entries[idx]) {
      Object.assign(sl.entries[idx], updates);
      saveLocalSetlists(all);
      setSetlists([...all]);
    }
  }, []);

  return { setlists, refresh, create, remove, rename, getOne, addEntry, removeEntry, moveEntry, updateEntry };
}
