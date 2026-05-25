import { useState, useCallback } from 'react';

export function useTwoCol() {
  const [twoCol, setTwoCol] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isWide = window.innerWidth >= 1024;
    const isLandscapeTablet = window.innerWidth >= 768 &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(orientation: landscape)').matches;
    return isWide || isLandscapeTablet;
  });

  const toggleTwoCol = useCallback(() => {
    setTwoCol((prev) => !prev);
  }, []);

  const setTwoColTo = useCallback((val: boolean) => {
    setTwoCol(val);
  }, []);

  return { twoCol, toggleTwoCol, setTwoCol, setTwoColTo };
}
