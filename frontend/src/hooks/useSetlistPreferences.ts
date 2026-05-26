import { useMemo } from 'react';
import { resolveEffectivePreferences } from '../lib/chords';
import type { SetlistEntry, SetlistPreferences } from '../types';

export function useSetlistPreferences(
  entry: SetlistEntry | null | undefined,
  global: SetlistPreferences
): SetlistPreferences {
  return useMemo(() => {
    return resolveEffectivePreferences(entry, global);
  }, [entry, global]);
}
