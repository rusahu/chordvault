import { useState, useCallback, useMemo } from 'react';
import { renderChordPro, getSongKey, songHasKey } from '../lib/chords';
import { getTransposeDelta, normalizeTranspose } from '../lib/keys';

export function useChordRenderer(content: string) {
  const [transpose, setTranspose] = useState(0);
  const [nashville, setNashville] = useState(false);

  const renderedHtml = useMemo(
    () => renderChordPro(content, transpose, nashville),
    [content, transpose, nashville]
  );

  const currentKey = useMemo(
    () => getSongKey(content, transpose),
    [content, transpose]
  );

  const hasKey = useMemo(
    () => songHasKey(content, transpose),
    [content, transpose]
  );

  const doTranspose = useCallback((delta: number) => {
    setTranspose((prev) => normalizeTranspose(prev + delta));
  }, []);

  const resetTranspose = useCallback(() => {
    setTranspose(0);
  }, []);

  const toggleNashville = useCallback((checked: boolean) => {
    setNashville(checked);
    if (checked) setTranspose(0);
  }, []);

  const pickKey = useCallback((targetKey: string) => {
    const delta = getTransposeDelta(currentKey, targetKey);
    if (delta !== 0) {
      setTranspose((prev) => normalizeTranspose(prev + delta));
    }
  }, [currentKey]);

  return {
    transpose,
    setTranspose,
    nashville,
    setNashville,
    renderedHtml,
    currentKey,
    hasKey,
    doTranspose,
    resetTranspose,
    toggleNashville,
    pickKey,
  };
}
