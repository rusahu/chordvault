import { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { chordProLanguage, chordProHighlightStyle } from '../lib/chordpro-lang';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  darkMode: boolean;
  placeholder?: string;
}

const cvTheme = EditorView.theme({
  '&': {
    fontSize: '15px',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  '.cm-content': { padding: '12px 0', minHeight: '300px' },
  '.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'var(--accent-bg) !important',
  },
  '.cm-activeLine': { backgroundColor: 'var(--ghost-bg)' },
});

const darkTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
}, { dark: true });

const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
}, { dark: false });

export function CodeMirrorEditor({ value, onChange, darkMode, placeholder }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const extensions = [
      cvTheme,
      darkMode ? darkTheme : lightTheme,
      chordProLanguage,
      chordProHighlightStyle,
      bracketMatching(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorView.lineWrapping,
    ];
    if (placeholder) extensions.push(cmPlaceholder(placeholder));

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
  }, [darkMode]);

  // Sync external value changes (OCR import, initial load) into CodeMirror
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    // Skip if value matches what's already in the editor (avoids cursor jump on typing)
    if (value === currentDoc) return;
    view.dispatch({ changes: { from: 0, to: currentDoc.length, insert: value } });
  }, [value]);

  return <div ref={containerRef} className="cm-editor-container" />;
}
