import { useLayoutEffect, useRef, useCallback } from 'react';
import { autoFit } from '../lib/chords';

interface AutoFitOptions {
  enabled: boolean;
  currentFontSize: number;
  currentTwoCol: boolean;
  onApply: (fit: { fontSize: number; twoCol: boolean }) => void;
  /** Dependency array to trigger the fit calculation (e.g. [songContent, index]) */
  deps: unknown[];
}

/**
 * Hook to manage the "Fit" logic for chord sheets.
 * Uses useLayoutEffect to measure and apply layout before the browser paints.
 */
export function useAutoFit({
  enabled,
  currentFontSize,
  currentTwoCol,
  onApply,
  deps
}: AutoFitOptions) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const performFit = useCallback(() => {
    const wrap = sheetRef.current;
    if (!wrap) return;

    const output = wrap.querySelector('#chord-output') as HTMLElement | null;
    if (!output) return;

    const fit = autoFit(wrap, output);
    
    // Only apply if different to avoid potential loops
    if (fit.fontSize !== currentFontSize || fit.twoCol !== currentTwoCol) {
      onApply(fit);
    }
  }, [currentFontSize, currentTwoCol, onApply]);

  // Synchronous layout effect: measures and adjusts before paint
  useLayoutEffect(() => {
    if (enabled) {
      performFit();
    }
    // We intentionally spread deps here because this hook is a wrapper for fit logic 
    // triggered by external state changes (like song navigation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, performFit, ...deps]);

  return { sheetRef, performFit };
}
