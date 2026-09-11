import { useState, useCallback, useMemo } from 'react';
import { renderChordPro, getSongKey, songHasKey } from '../lib/chords';
import { stepKey } from '../lib/keys';
import { entrySemitones } from '../lib/setlistKeys';

export function useChordRenderer(content: string) {
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [nashville, setNashville] = useState(false);

  const sourceKey = useMemo(() => getSongKey(content, 0), [content]);
  const transpose = useMemo(() => entrySemitones(content, targetKey), [content, targetKey]);

  const renderedHtml = useMemo(
    () => renderChordPro(content, transpose, nashville),
    [content, transpose, nashville]
  );

  const currentKey = useMemo(() => getSongKey(content, transpose), [content, transpose]);
  const hasKey = useMemo(() => songHasKey(content, transpose), [content, transpose]);

  const stepCurrentKey = useCallback((direction: 1 | -1) => {
    setTargetKey((prev) => {
      const base = prev || sourceKey;
      return base ? stepKey(base, direction) : prev;
    });
  }, [sourceKey]);

  const resetKey = useCallback(() => setTargetKey(null), []);

  const toggleNashville = useCallback((checked: boolean) => {
    setNashville(checked);
    if (checked) setTargetKey(null);
  }, []);

  const pickKey = useCallback((key: string) => setTargetKey(key), []);

  return {
    targetKey, setTargetKey, transpose, nashville, setNashville,
    renderedHtml, currentKey, hasKey, stepCurrentKey, resetKey, toggleNashville, pickKey,
  };
}
