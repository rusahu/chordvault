import type { User, LocalSetlist } from '../types';
import { legacyTransposeToTargetKey } from './setlistKeys';

const KEYS = {
  user: 'cv_user',
  theme: 'cv_theme',
  fontsize: 'cv_fontsize',
  localSetlists: 'cv_local_setlists',
  setlistOverrides: 'cv_setlist_overrides',
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

export function getLocalSetlists(): LocalSetlist[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.localSetlists) || '[]');
  } catch { return []; }
}

export function saveLocalSetlists(arr: LocalSetlist[]): void {
  localStorage.setItem(KEYS.localSetlists, JSON.stringify(arr));
}

export interface SetlistOverride {
  target_key?: string | null;
  transpose?: number;          // legacy, read-only
  nashville?: boolean;
  font?: number;
  two_col?: number | null;
}

/**
 * Gets personal key/Nashville overrides for a specific setlist.
 * Format: { [entryId]: { target_key: string | null, nashville: boolean, font: number, two_col: boolean } }
 * May also contain legacy { transpose: number, ... } records; pass through
 * migrateOverride() before use.
 */
export function getSetlistOverrides(setlistId: number | string): Record<string, SetlistOverride> {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS.setlistOverrides) || '{}');
    return all[String(setlistId)] || {};
  } catch { return {}; }
}

/**
 * Saves a personal key/Nashville override for a single setlist entry.
 */
export function saveSetlistOverride(
  setlistId: number | string,
  entryId: number | string,
  data: SetlistOverride
): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS.setlistOverrides) || '{}');
    const sid = String(setlistId);
    const eid = String(entryId);
    if (!all[sid]) all[sid] = {};
    all[sid][eid] = { ...all[sid][eid], ...data };
    delete all[sid][eid].transpose; // legacy field never written going forward; drop it on every save
    localStorage.setItem(KEYS.setlistOverrides, JSON.stringify(all));
  } catch (e) { console.error('Failed to save setlist override', e); }
}

/**
 * Converts a stored override to the target-key shape.
 *
 * Overrides predating 1.23.0 hold an accumulated `transpose` and were never
 * range-checked, so a value that drifted before the fix can still be sitting
 * in a browser. Converting on read means no saved personal key is lost.
 */
export function migrateOverride(
  override: SetlistOverride,
  content: string
): SetlistOverride {
  const { transpose, ...rest } = override;
  if (rest.target_key !== undefined) return rest;
  return { ...rest, target_key: legacyTransposeToTargetKey(content, transpose) };
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
