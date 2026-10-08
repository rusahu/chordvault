import { liveQuery } from 'dexie';
import { useDocumentVisibility } from '@mantine/hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNetwork, useWindowEvent } from '@mantine/hooks';
import { useAuth } from './AuthContext';
import { offlineLibrary } from '../lib/offlineLibrary';
import { downloadOfflineLibrary } from '../lib/offlineDownload';
import { getStoredUser } from '../lib/storage';
import { ApiError } from '../lib/api';
import type { OfflineState } from '../types/offline';

const noop = () => {};
const OfflineContext = createContext({
  state: undefined as OfflineState | undefined, busy: false, error: '', shellError: '', shellReady: false,
  activity: false, enabled: false, readOnly: false, usingDownload: false, online: true,
  refresh: async (_force = false) => {}, enable: async () => {}, disable: async () => {},
  reportSource: (_downloaded: boolean) => {}, setShellReady: (_ready: boolean) => {},
  setShellError: (_message: string) => {}, holdRefresh: (_hold: boolean) => noop,
});

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const network = useNetwork();
  const visibility = useDocumentVisibility();
  const [activity, setActivity] = useState(false);
  const [state, setState] = useState<OfflineState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shellError, setShellError] = useState('');
  const [shellReady, setShellReady] = useState(false);
  const [usingDownload, setUsingDownload] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const holds = useRef(0);
  const mounted = useRef(true);
  const readState = useCallback(async () => {
    const next = await offlineLibrary.status();
    if (mounted.current) setState(next);
    return next;
  }, []);
  const reportSource = useCallback((downloaded: boolean) => setUsingDownload(downloaded), []);
  const enabled = !!user && state?.accountId === user.id && state.enabled;
  const refresh = useCallback(async (force = false) => {
    if (!mounted.current || !user || navigator.onLine === false || controller.current || (!force && holds.current)) return;
    if (getStoredUser()?.id !== user.id) return;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const current = await offlineLibrary.state();
      if (abort.signal.aborted || !mounted.current || getStoredUser()?.id !== user.id ||
          !current?.enabled || current.accountId !== user.id || (!force && holds.current)) return;
      if (!force && current.checkedAt && Date.now() - current.checkedAt < 300_000) return;
      setBusy(true);
      setError('');
      const updated = await downloadOfflineLibrary(user, offlineLibrary, AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]));
      if (updated && !abort.signal.aborted) setUsingDownload(false);
    } catch (err) {
      if (!abort.signal.aborted && mounted.current) {
        setError(err instanceof Error ? err.message : 'Could not download library');
        if (err instanceof ApiError && err.status === 401) logout();
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        if (mounted.current) { setBusy(false); await readState().catch(() => {}); }
      }
    }
  }, [user, logout, readState]);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const holdRefresh = useCallback((hold: boolean) => {
    if (!hold) return noop;
    holds.current++;
    setActivity(true);
    return () => { holds.current--; setActivity(holds.current > 0); if (!holds.current) void refreshRef.current(); };
  }, []);
  const enable = useCallback(async () => {
    if (!user || getStoredUser()?.id !== user.id) return;
    setError('');
    try {
      if (!('serviceWorker' in navigator) || !window.isSecureContext || !import.meta.env.PROD) {
        throw new Error('Offline downloads need the built app over HTTPS or localhost.');
      }
      await offlineLibrary.enable(user.id);
      await readState();
      void navigator.storage?.persist?.().catch(() => false);
      await refresh(true);
    } catch (err) { setError((err as Error).message); }
  }, [user, readState, refresh]);
  const disable = useCallback(async () => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    try {
      if (user) await offlineLibrary.disable(user.id);
      setError('');
      setUsingDownload(false);
      await readState();
    } catch (err) { setError((err as Error).message); }
  }, [user, readState]);
  useEffect(() => {
    const subscription = liveQuery(() => offlineLibrary.status()).subscribe({ next: setState, error: err => { setState(undefined); setError(`Offline storage unavailable: ${err.message}`); } });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { if (visibility === 'visible') void refreshRef.current(); }, [visibility]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    let active = true;
    controller.current?.abort();
    controller.current = null;
    void readState().then(async current => {
      if (!active || getStoredUser()?.id !== user?.id) return;
      if (current && current.accountId !== user?.id) {
        await offlineLibrary.disable(current.accountId);
        await readState();
      } else if (user) void refreshRef.current();
    }).catch(err => { if (active) setError(`Offline storage unavailable: ${err.message}`); });
    return () => { active = false; controller.current?.abort(); };
  }, [user, readState]);
  useWindowEvent('online', () => { void refreshRef.current(); });
  useWindowEvent('focus', () => { void readState().then(() => refreshRef.current()).catch(() => {}); });
  useWindowEvent('storage', (event) => {
    if (event.key === 'cv_user') { controller.current?.abort(); void readState().catch(() => {}); }
  });
  const value = useMemo(() => ({ state: state?.accountId === user?.id ? state : undefined,
    activity, busy, error, shellError, shellReady, enabled, usingDownload, online: network.online,
    readOnly: !network.online || usingDownload, refresh, enable, disable, reportSource,
    setShellReady, setShellError, holdRefresh,
  }), [activity, state, user?.id, busy, error, shellError, shellReady, enabled, usingDownload, network.online, refresh, enable, disable, reportSource, holdRefresh]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { return useContext(OfflineContext); }

export function useOfflineActivity(active: boolean) {
  const { holdRefresh } = useOffline();
  useEffect(() => holdRefresh(active), [active, holdRefresh]);
}
