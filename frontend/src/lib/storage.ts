import type { User, LocalSetlist } from '../types';

const KEYS = {
  user: 'cv_user',
  theme: 'cv_theme',
  fontsize: 'cv_fontsize',
  twocol: 'cv_twocol',
  localSetlists: 'cv_local_setlists',
} as const;

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(KEYS.user);
}

export function getStoredTheme(): 'dark' | 'light' {
  return localStorage.getItem(KEYS.theme) === 'light' ? 'light' : 'dark';
}

export function setStoredTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(KEYS.theme, theme);
}

export function getStoredFontSize(): number {
  return parseInt(localStorage.getItem(KEYS.fontsize) || '0') || 0;
}

export function setStoredFontSize(size: number): void {
  localStorage.setItem(KEYS.fontsize, String(size));
}

export function getStoredTwoCol(): boolean {
  return localStorage.getItem(KEYS.twocol) === '1';
}

export function setStoredTwoCol(val: boolean): void {
  localStorage.setItem(KEYS.twocol, val ? '1' : '0');
}

export function getLocalSetlists(): LocalSetlist[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.localSetlists) || '[]');
  } catch { return []; }
}

export function saveLocalSetlists(arr: LocalSetlist[]): void {
  localStorage.setItem(KEYS.localSetlists, JSON.stringify(arr));
}
