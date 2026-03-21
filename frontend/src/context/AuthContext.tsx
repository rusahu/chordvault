import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { User } from '../types';
import { getStoredUser, setStoredUser, removeStoredUser } from '../lib/storage';
import { isAdminRole } from '../lib/chords';

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
    setUser(u);
    setStoredUser(u);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    removeStoredUser();
  }, []);

  const isAdmin = useMemo(() => user ? isAdminRole(user.role) : false, [user]);

  const value = useMemo(() => ({ user, isAdmin, login, logout }), [user, isAdmin, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
