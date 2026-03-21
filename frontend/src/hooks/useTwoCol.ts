import { useState, useCallback } from 'react';
import { getStoredTwoCol, setStoredTwoCol } from '../lib/storage';

export function useTwoCol() {
  const [twoCol, setTwoCol] = useState(() => getStoredTwoCol());

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
