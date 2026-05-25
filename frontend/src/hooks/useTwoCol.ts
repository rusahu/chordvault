import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Determines if the layout should default to two columns based on screen size and orientation.
 * Defaults to 2 columns on desktop (>=1024px) or landscape tablets (>=768px in landscape).
 */
function getLayoutDefault(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isDesktop = window.innerWidth >= 1024;
  const isLandscapeTablet = window.innerWidth >= 768 &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(orientation: landscape)').matches;
    
  return isDesktop || isLandscapeTablet;
}

export function useTwoCol() {
  const [twoCol, setTwoCol] = useState(getLayoutDefault);
  const userHasToggled = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      if (!userHasToggled.current) {
        setTwoCol(getLayoutDefault());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTwoCol = useCallback(() => {
    userHasToggled.current = true;
    setTwoCol((prev) => !prev);
  }, []);

  const setTwoColTo = useCallback((val: boolean) => {
    userHasToggled.current = true;
    setTwoCol(val);
  }, []);

  return { twoCol, toggleTwoCol, setTwoColTo };
}
