import { useCallback } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function useApi() {
  const { user, logout } = useAuth();

  const call = useCallback(<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => {
    return api<T>(method, path, body, user?.token).catch((err) => {
      if (user && err instanceof ApiError && err.status === 401) {
        logout();
      }
      throw err;
    });
  }, [user, logout]);

  return call;
}
