import { useState, useCallback, useRef } from 'react';
import { extractDirective, updateDirective, detectFormat } from '../lib/chords';

export interface SongEditorState {
  title: string;
  artist: string;
  content: string;
  youtubeUrl: string;
  bpm: string;
  tags: string[];
  language: string;
  formatBadge: { text: string; cls: string } | null;
}

export function useSongEditor(initialContent: string = '') {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [bpm, setBpm] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [formatBadge, setFormatBadge] = useState<{ text: string; cls: string } | null>(null);

  const syncSource = useRef<'editor' | 'field' | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBadge = useCallback((text: string) => {
    const fmt = detectFormat(text);
    if (fmt) setFormatBadge({ text: fmt, cls: 'format-ok' });
    else if (text?.trim()) setFormatBadge({ text: 'No chords detected — add chords in [brackets] e.g. [G]lyrics', cls: 'format-warn' });
    else setFormatBadge(null);
  }, []);

  const syncContentToFields = useCallback((text: string) => {
    setTitle(extractDirective(text, 'title') || '');
    setArtist(extractDirective(text, 'artist') || '');
    const tempo = extractDirective(text, 'tempo');
    setBpm(tempo && /^\d+$/.test(tempo) ? tempo : '');
    setYoutubeUrl(extractDirective(text, 'x_youtube') || '');
    const tagStr = extractDirective(text, 'x_tags');
    setTags(tagStr ? tagStr.split(',').map(t => t.trim()).filter(Boolean) : []);
    setLanguage(extractDirective(text, 'x_language') || '');
    updateBadge(text);
  }, [updateBadge]);

  const setInitialContent = useCallback((text: string) => {
    setContent(text);
    syncContentToFields(text);
  }, [syncContentToFields]);

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    updateBadge(text);
    if (syncSource.current === 'field') return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncSource.current = 'editor';
      syncContentToFields(text);
      syncSource.current = null;
    }, 150);
  }, [syncContentToFields, updateBadge]);

  const handleFieldChange = useCallback((directive: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (syncSource.current === 'editor') return;
    syncSource.current = 'field';
    setContent(prev => updateDirective(prev, directive, value || null));
    syncSource.current = null;
  }, []);

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    if (syncSource.current === 'editor') return;
    syncSource.current = 'field';
    const val = newTags.length > 0 ? newTags.join(',') : null;
    setContent(prev => updateDirective(prev, 'x_tags', val));
    syncSource.current = null;
  }, []);

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
    if (syncSource.current === 'editor') return;
    syncSource.current = 'field';
    setContent(prev => updateDirective(prev, 'x_language', lang || null));
    syncSource.current = null;
  }, []);

  return {
    state: { title, artist, content, youtubeUrl, bpm, tags, language, formatBadge },
    setInitialContent,
    handleContentChange,
    handleFieldChange,
    handleTagsChange,
    handleLanguageChange,
    // Direct setters for individual fields if needed for UI components
    setTitle,
    setArtist,
    setYoutubeUrl,
    setBpm,
    setTags,
    setLanguage
  };
}
