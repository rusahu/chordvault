import { useCallback, useEffect, useRef } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

import { useOffline } from '../context/OfflineContext';

export function useApi() {
  const { user, logout } = useAuth();
  const { readOnly } = useOffline();
  const locked = useRef(readOnly);
  useEffect(() => { locked.current = readOnly; }, [readOnly]);

  const call = useCallback(<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => {
    if (method !== 'GET' && (locked.current || navigator.onLine === false)) return Promise.reject(new Error('Connect to the server to make changes.'));
    return api<T>(method, path, body, user?.token).catch((err) => {
      if (user && err instanceof ApiError && err.status === 401) {
        logout();
      }
      throw err;
    });
  }, [user, logout]);

  return call;
}
