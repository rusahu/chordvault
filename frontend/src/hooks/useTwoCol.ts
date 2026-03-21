import { useState, useCallback, useEffect } from 'react';
import { applyTwoCol } from '../lib/chords';
import { getStoredTwoCol, setStoredTwoCol } from '../lib/storage';

export function useTwoCol(shouldApply = true) {
  const [twoCol, setTwoCol] = useState(() => getStoredTwoCol());

  useEffect(() => {
    if (shouldApply && twoCol) {
      // Small delay to let DOM render first
      const timer = setTimeout(() => applyTwoCol(), 0);
      return () => clearTimeout(timer);
    }
  }, [twoCol, shouldApply]);

  const toggleTwoCol = useCallback(() => {
    setTwoCol((prev) => {
      const next = !prev;
      setStoredTwoCol(next);
      return next;
    });
  }, []);

  const setTwoColTo = useCallback((val: boolean) => {
    setTwoCol(val);
    setStoredTwoCol(val);
  }, []);

  return { twoCol, toggleTwoCol, setTwoCol, setTwoColTo };
}
