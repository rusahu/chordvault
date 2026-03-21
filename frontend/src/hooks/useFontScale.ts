import { useState, useCallback } from 'react';
import { clampFontSize } from '../lib/chords';
import { getStoredFontSize, setStoredFontSize } from '../lib/storage';

export function useFontScale() {
  const [fontSize, setFontSize] = useState(() => getStoredFontSize());

  const changeFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = clampFontSize(prev + delta);
      setStoredFontSize(next);
      return next;
    });
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSize(0);
    setStoredFontSize(0);
  }, []);

  return { fontSize, changeFontSize, resetFontSize, setFontSize };
}
