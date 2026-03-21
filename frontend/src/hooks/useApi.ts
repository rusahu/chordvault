import { useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function useApi() {
  const { user } = useAuth();

  const call = useCallback(<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => {
    return api<T>(method, path, body, user?.token);
  }, [user?.token]);

  return call;
}
