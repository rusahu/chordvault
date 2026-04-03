import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { TagPicker } from '../components/TagPicker';
import { LanguagePicker } from '../components/LanguagePicker';
import { OcrModal } from '../components/OcrModal';
import { CodeMirrorEditor } from '../components/CodeMirrorEditor';
import { EditorPreview } from '../components/EditorPreview';
import { detectFormat, toChordPro, ensureKeyDirective, extractDirective, updateDirective } from '../lib/chords';
import type { Song } from '../types';

interface SongEditViewProps {
  songId?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SongEditView({ songId, navigate }: SongEditViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [song, setSong] = useState<Song | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [bpm, setBpm] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>([]);
  const [formatBadge, setFormatBadge] = useState<{ text: string; cls: string } | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const { theme } = useTheme();
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [forceRender, setForceRender] = useState(0);
  const syncSource = useRef<'editor' | 'field' | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract all directives from content → update form fields (debounced for editor typing)
  const syncContentToFields = useCallback((text: string) => {
    setTitle(extractDirective(text, 'title') || '');
    setArtist(extractDirective(text, 'artist') || '');
    const tempo = extractDirective(text, 'tempo');
    setBpm(tempo && /^\d+$/.test(tempo) ? tempo : '');
    setYoutubeUrl(extractDirective(text, 'x_youtube') || '');
    const tagStr = extractDirective(text, 'x_tags');
    setTags(tagStr ? tagStr.split(',').map(t => t.trim()).filter(Boolean) : []);
    setLanguage(extractDirective(text, 'x_language') || '');
  }, []);

  useEffect(() => {
    if (songId) {
      apiCall<Song>('GET', `/api/songs/${songId}`)
        .then((s) => {
          setSong(s);
          setVisibility(s.visibility === 'private' ? 'private' : 'public');
          updateBadge(s.content);
          // Inject missing directives from DB columns into content for old songs
          let c = s.content;
          if (s.title && !extractDirective(c, 'title')) c = updateDirective(c, 'title', s.title);
          if (s.artist && !extractDirective(c, 'artist')) c = updateDirective(c, 'artist', s.artist);
          if (s.bpm && !extractDirective(c, 'tempo')) c = updateDirective(c, 'tempo', String(s.bpm));
          if (s.youtube_url && !extractDirective(c, 'x_youtube')) c = updateDirective(c, 'x_youtube', s.youtube_url);
          if (s.tags && !extractDirective(c, 'x_tags')) c = updateDirective(c, 'x_tags', s.tags);
          if (s.language && !extractDirective(c, 'x_language')) c = updateDirective(c, 'x_language', s.language);
          setContent(c);
          syncContentToFields(c);
        })
        .catch((e) => { toast(e.message, 'error'); navigate('my-songs'); });
    }
  }, [songId]);

  useEffect(() => {
    if (user) {
      apiCall<{ hasKey: boolean }>('GET', '/api/settings/gemini-key')
        .then((d) => setHasGeminiKey(d.hasKey))
        .catch(() => {});
      apiCall<{ languages: string[] }>('GET', '/api/settings/languages')
        .then((d) => setPreferredLanguages(d.languages))
        .catch(() => {});
    }
  }, []);

  const updateBadge = (text: string) => {
    const fmt = detectFormat(text);
    if (fmt) setFormatBadge({ text: fmt, cls: 'format-ok' });
    else if (text?.trim()) setFormatBadge({ text: 'No chords detected — add chords in [brackets] e.g. [G]lyrics', cls: 'format-warn' });
    else setFormatBadge(null);
  };

  // Editor content changed → sync to form fields (debounced 150ms)
  const handleContentChange = (text: string) => {
    setContent(text);
    updateBadge(text);
    if (syncSource.current === 'field') return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncSource.current = 'editor';
      syncContentToFields(text);
      syncSource.current = null;
    }, 150);
  };

  // Form field changed → update directive in content (instant)
  const handleFieldChange = (directive: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (syncSource.current === 'editor') return;
    syncSource.current = 'field';
    setContent(prev => updateDirective(prev, directive, value || null));
    syncSource.current = null;
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    if (syncSource.current === 'editor') return;
    syncSource.current = 'field';
    const val = newTags.length > 0 ? newTags.join(',') : null;
    setContent(prev => updateDirective(prev, 'x_tags', val));
    syncSource.current = null;
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (syncSource.current === 'editor') return;
    syncSource.current = 'field';
    setContent(prev => updateDirective(prev, 'x_language', lang || null));
    syncSource.current = null;
  };

  const save = async () => {
    if (!extractDirective(content, 'title')?.trim()) { toast(t('songEdit.titleRequired'), 'error'); return; }
    if (!content.trim()) { toast(t('songEdit.contentRequired'), 'error'); return; }
    if (content.length > 100000) { toast(t('songEdit.contentTooLarge'), 'error'); return; }
    const bpmVal = extractDirective(content, 'tempo');
    if (bpmVal && (isNaN(parseInt(bpmVal, 10)) || parseInt(bpmVal, 10) < 1 || parseInt(bpmVal, 10) > 300)) {
      toast('BPM must be between 1 and 300', 'error'); return;
    }
    const fmt = detectFormat(content);
    if (!fmt) { toast('No chords detected. Add chords in [brackets] before the syllable, e.g. [G]Amazing [C]grace', 'error'); return; }
    if (!extractDirective(content, 'x_language')) { toast('Please select a language', 'error'); return; }

    let finalContent = toChordPro(content);
    finalContent = ensureKeyDirective(finalContent);

    try {
      if (song) {
        await apiCall('PUT', `/api/songs/${song.id}`, {
          content: finalContent, format_detected: fmt, visibility
        });
        toast(t('songEdit.saved'), 'success');
        navigate('song-view', { id: String(song.id) });
      } else {
        const result = await apiCall<{ id: number }>('POST', '/api/songs', {
          content: finalContent, format_detected: fmt, visibility
        });
        toast(t('songEdit.created'), 'success');
        navigate('song-view', { id: String(result.id) });
      }
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const deleteSong = async () => {
    if (!song || !confirm(t('songEdit.confirmDelete'))) return;
    try {
      await apiCall('DELETE', `/api/songs/${song.id}`);
      toast(t('songEdit.deleted'));
      navigate('my-songs');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const cancel = () => {
    if (song) navigate('song-view', { id: String(song.id) });
    else navigate('my-songs');
  };

  return (
    <>
      <div className="edit-header">
        <button className="btn btn-ghost btn-sm" onClick={cancel}>&#8592; {t('songEdit.cancel')}</button>
        <h2>{song ? t('songEdit.editSong') : t('songEdit.newSong')}</h2>
        <button className="btn btn-sm" onClick={save}>{t('songEdit.save')}</button>
      </div>
      <div className="edit-cols">
        <div className="field">
          <label>{t('songEdit.titleLabel')}</label>
          <input type="text" value={title} onChange={(e) => handleFieldChange('title', e.target.value, setTitle)} placeholder={t('songEdit.titlePlaceholder')} />
        </div>
        <div className="field">
          <label>{t('songEdit.artistLabel')}</label>
          <input type="text" value={artist} onChange={(e) => handleFieldChange('artist', e.target.value, setArtist)} placeholder={t('songEdit.artistPlaceholder')} />
        </div>
        <div className="field">
          <label>Language</label>
          <LanguagePicker value={language} onChange={handleLanguageChange} preferredLanguages={preferredLanguages} />
        </div>
        <div className="field">
          <label>BPM</label>
          <input type="number" value={bpm} onChange={(e) => handleFieldChange('tempo', e.target.value, setBpm)} placeholder="e.g. 120" min="1" max="300" />
        </div>
      </div>
      <div className="field">
        <label>YouTube URL</label>
        <input type="url" value={youtubeUrl} onChange={(e) => handleFieldChange('x_youtube', e.target.value, setYoutubeUrl)} placeholder="https://youtube.com/watch?v=..." />
      </div>
      <div className="field">
        <label>Tags</label>
        <TagPicker selected={tags} onChange={handleTagsChange} />
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span className="toggle">
            <input
              type="checkbox"
              checked={visibility === 'public'}
              onChange={(e) => setVisibility(e.target.checked ? 'public' : 'private')}
            />
            <span className="toggle-slider" />
          </span>
          Public {visibility === 'private' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>&#128274; Only you can see this song</span>}
        </label>
      </div>
      <div className="field">
        <div className="chordpro-hint-row">
          <p className="chordpro-hint" dangerouslySetInnerHTML={{ __html: t('songEdit.chordproHint') + ' You can also paste chords-over-lyrics or Ultimate Guitar format — it will be auto-converted.' }} />
          {formatBadge && <span className={`format-badge ${formatBadge.cls}`}>{formatBadge.text}</span>}
        </div>
        {user && (
          <div className="ocr-row">
            <button className="btn btn-sm btn-ghost" onClick={() => { setOcrOpen(true); window.scrollTo(0, 0); }}>&#128247; Import from image or PDF</button>
          </div>
        )}
        <div className="editor-tabs" role="tablist">
          <button
            className={`editor-tab${editorTab === 'edit' ? ' active' : ''}`}
            role="tab"
            aria-selected={editorTab === 'edit'}
            onClick={() => setEditorTab('edit')}
          >Edit</button>
          <button
            className={`editor-tab${editorTab === 'preview' ? ' active' : ''}`}
            role="tab"
            aria-selected={editorTab === 'preview'}
            onClick={() => { setEditorTab('preview'); setForceRender((n) => n + 1); }}
          >Preview</button>
        </div>
        <div className="editor-split">
          <div className={`cm-editor-wrap${editorTab === 'preview' ? ' editor-hidden' : ''}`} role="tabpanel">
            <CodeMirrorEditor
              value={content}
              onChange={handleContentChange}
              darkMode={theme === 'dark'}
              placeholder={'Paste any format:\n\nChordPro:  [G]Let it [D]be\n\nOr chords over lyrics:\n  G        D\n  Let it be'}
            />
          </div>
          <div className={`editor-preview-wrap${editorTab === 'edit' ? ' editor-hidden' : ''}`} role="tabpanel">
            <EditorPreview content={content} forceRender={forceRender} />
          </div>
        </div>
      </div>
      {song && (
        <>
          <hr className="divider" />
          <button className="btn btn-danger btn-sm" onClick={deleteSong}>{t('songEdit.deleteSong')}</button>
        </>
      )}
      {ocrOpen && (
        <OcrModal
          hasGeminiKey={hasGeminiKey}
          onResult={(text, lang) => {
            let c = text;
            if (lang && !extractDirective(c, 'x_language')) c = updateDirective(c, 'x_language', lang);
            setContent(c);
            updateBadge(c);
            syncContentToFields(c);
            requestAnimationFrame(() => window.scrollTo(0, 0));
          }}
          onClose={() => setOcrOpen(false)}
        />
      )}
    </>
  );
}
