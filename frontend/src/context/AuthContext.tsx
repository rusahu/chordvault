import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { User } from '../types';
import { getStoredUser, setStoredUser, removeStoredUser, clearSearchSession } from '../lib/storage';
import { isAdminRole } from '../lib/chords';

import { useWindowEvent } from '@mantine/hooks';
import { offlineLibrary } from '../lib/offlineLibrary';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const login = useCallback((u: User) => {
    const previous = getStoredUser();
    if (previous && previous.id !== u.id) void offlineLibrary.disable(previous.id).catch(() => {});
    setUser(u);
    setStoredUser(u);
    clearSearchSession();
  }, []);

  const logout = useCallback(() => {
    const previous = getStoredUser();
    if (previous) void offlineLibrary.disable(previous.id).catch(() => {});
    setUser(null);
    removeStoredUser();
    clearSearchSession();
  }, []);

  const syncStoredUser = useCallback(() => {
    const next = getStoredUser();
    if (next?.id === user?.id && next?.token === user?.token
      && next?.role === user?.role && next?.username === user?.username) return;
    if (user && user.id !== next?.id) void offlineLibrary.disable(user.id).catch(() => {});
    setUser(next);
    clearSearchSession();
  }, [user]);

  useWindowEvent('storage', event => {
    if (event.key === 'cv_user' || event.key === null) syncStoredUser();
  });
  useWindowEvent('focus', syncStoredUser);

  const isAdmin = useMemo(() => user ? isAdminRole(user.role) : false, [user]);

  const value = useMemo(() => ({ user, isAdmin, login, logout }), [user, isAdmin, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
