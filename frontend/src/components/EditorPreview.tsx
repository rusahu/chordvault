import { useState, useMemo, useEffect, useRef } from 'react';
import { renderChordPro, songHasKey } from '../lib/chords';
import { ChordSheet } from './ChordSheet';
import { KeyPicker } from './KeyPicker';
import { normalizeKey, getTransposeDelta } from '../lib/keys';

interface EditorPreviewProps {
  content: string;
  debounceMs?: number;
  forceRender?: number;
}

export function EditorPreview({ content, debounceMs = 300, forceRender }: EditorPreviewProps) {
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [nashville, setNashville] = useState(false);
  const [keyPickerVisible, setKeyPickerVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedContent(content), debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content, debounceMs]);

  // Force immediate render on mobile tab switch
  useEffect(() => {
    if (forceRender !== undefined) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setDebouncedContent(contentRef.current);
    }
  }, [forceRender]);

  // Derive current key from {key:} directive
  const currentKey = useMemo(() => {
    const m = debouncedContent.match(/\{key:\s*([^}]+)\}/i);
    return m ? normalizeKey(m[1].trim()) : '';
  }, [debouncedContent]);

  const transpose = useMemo(
    () => (targetKey && currentKey ? getTransposeDelta(currentKey, targetKey) : 0),
    [currentKey, targetKey]
  );

  const html = useMemo(
    () => renderChordPro(debouncedContent, transpose, nashville),
    [debouncedContent, transpose, nashville]
  );

  const nashvilleDisabled = !songHasKey(debouncedContent, transpose);

  // KeyPicker.onPickKey receives a key string — assign it directly
  const handlePickKey = (pickedKey: string) => {
    if (!currentKey) return;
    setTargetKey(pickedKey);
  };

  if (!debouncedContent.trim()) {
    return (
      <div className="editor-preview">
        <div className="editor-preview-empty">Start typing to see a live preview</div>
      </div>
    );
  }

  return (
    <div className="editor-preview">
      <div className="editor-preview-toolbar">
        {currentKey && (
          <button className="btn btn-ghost btn-sm" onClick={() => setKeyPickerVisible(!keyPickerVisible)}>
            Key: {currentKey}
          </button>
        )}
        <button
          className={`btn btn-ghost btn-sm${nashville ? ' active' : ''}`}
          onClick={() => setNashville(!nashville)}
          disabled={nashvilleDisabled}
          title="Nashville numbers"
        >
          #
        </button>
        {targetKey && (
          <button className="btn btn-ghost btn-sm" onClick={() => setTargetKey(null)} title="Reset transpose">
            &#8634;
          </button>
        )}
      </div>
      {currentKey && (
        <KeyPicker currentKey={currentKey} onPickKey={handlePickKey} visible={keyPickerVisible} />
      )}
      <ChordSheet html={html} />
    </div>
  );
}
