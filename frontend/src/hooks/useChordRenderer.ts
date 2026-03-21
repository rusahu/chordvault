import { useState, useCallback, useMemo } from 'react';
import { renderChordPro, getSongKey, songHasKey } from '../lib/chords';
import { normalizeKey, ALL_KEYS, ALL_KEYS_MINOR } from '../lib/keys';

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
    setTranspose((prev) => prev + delta);
  }, []);

  const resetTranspose = useCallback(() => {
    setTranspose(0);
  }, []);

  const toggleNashville = useCallback((checked: boolean) => {
    setNashville(checked);
    if (checked) setTranspose(0);
  }, []);

  const pickKey = useCallback((targetKey: string) => {
    const norm = normalizeKey(currentKey);
    if (targetKey === norm) return;
    const isMinor = norm && norm.endsWith('m') && norm.length > 1;
    const keys = isMinor ? ALL_KEYS_MINOR : ALL_KEYS;
    const fromIdx = keys.indexOf(norm);
    const toIdx = keys.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    let delta = toIdx - fromIdx;
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    setTranspose((prev) => prev + delta);
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
