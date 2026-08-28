import type { User, LocalSetlist } from '../types';

const KEYS = {
  user: 'cv_user',
  theme: 'cv_theme',
  fontsize: 'cv_fontsize',
  localSetlists: 'cv_local_setlists',
  setlistOverrides: 'cv_setlist_overrides',
  chordDiagramsExpanded: 'cv_chord_diagrams_expanded',
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
  try {
    return parseInt(localStorage.getItem(KEYS.fontsize) || '0') || 0;
  } catch { return 0; }
}

export function setStoredFontSize(size: number): void {
  try {
    localStorage.setItem(KEYS.fontsize, String(size));
  } catch {}
}

export function getChordDiagramsExpanded(): boolean {
  try {
    return localStorage.getItem(KEYS.chordDiagramsExpanded) === 'true';
  } catch { return false; }
}

export function setChordDiagramsExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(KEYS.chordDiagramsExpanded, String(expanded));
  } catch {}
}

export function getLocalSetlists(): LocalSetlist[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.localSetlists) || '[]');
  } catch { return []; }
}

export function saveLocalSetlists(arr: LocalSetlist[]): void {
  localStorage.setItem(KEYS.localSetlists, JSON.stringify(arr));
}

/**
 * Gets personal transpose/Nashville overrides for a specific setlist.
 * Format: { [entryId]: { transpose: number, nashville: boolean, font: number, two_col: boolean } }
 */
export function getSetlistOverrides(setlistId: number | string): Record<string, { transpose?: number; nashville?: boolean; font?: number; two_col?: number | null }> {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS.setlistOverrides) || '{}');
    return all[String(setlistId)] || {};
  } catch { return {}; }
}

/**
 * Saves a personal transpose/Nashville override for a single setlist entry.
 */
export function saveSetlistOverride(
  setlistId: number | string,
  entryId: number | string,
  data: { transpose?: number; nashville?: boolean; font?: number | null; two_col?: number | null }
): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS.setlistOverrides) || '{}');
    const sid = String(setlistId);
    const eid = String(entryId);
    if (!all[sid]) all[sid] = {};
    all[sid][eid] = { ...all[sid][eid], ...data };
    localStorage.setItem(KEYS.setlistOverrides, JSON.stringify(all));
  } catch (e) { console.error('Failed to save setlist override', e); }
}

export function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

export function removeSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
