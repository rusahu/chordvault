import { useState, useEffect } from 'react';
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
import { detectFormat, toChordPro, ensureKeyDirective } from '../lib/chords';
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

  useEffect(() => {
    if (songId) {
      apiCall<Song>('GET', `/api/songs/${songId}`)
        .then((s) => {
          setSong(s);
          setTitle(s.title);
          setArtist(s.artist || '');
          setContent(s.content);
          setYoutubeUrl(s.youtube_url || '');
          setBpm(s.bpm ? String(s.bpm) : '');
          setTags(s.tags ? s.tags.split(',') : []);
          setLanguage(s.language || '');
          setVisibility(s.visibility === 'private' ? 'private' : 'public');
          updateBadge(s.content);
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
    else if (text?.trim()) setFormatBadge({ text: 'No chords detected', cls: 'format-warn' });
    else setFormatBadge(null);
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    updateBadge(text);
    // Auto-fill title/artist from ChordPro directives
    if (!title) {
      const tm = text.match(/\{title:\s*([^}]+)\}/i);
      if (tm) setTitle(tm[1].trim());
      const am = text.match(/\{artist:\s*([^}]+)\}/i);
      if (am && !artist) setArtist(am[1].trim());
    }
  };

  const save = async () => {
    if (!title.trim()) { toast(t('songEdit.titleRequired'), 'error'); return; }
    if (!content.trim()) { toast(t('songEdit.contentRequired'), 'error'); return; }
    if (content.length > 100000) { toast(t('songEdit.contentTooLarge'), 'error'); return; }
    const bpmNum = bpm ? parseInt(bpm, 10) : null;
    if (bpm && (isNaN(bpmNum!) || bpmNum! < 1 || bpmNum! > 300)) { toast('BPM must be between 1 and 300', 'error'); return; }
    const fmt = detectFormat(content);
    if (!fmt) { toast('No chords detected. Add chords (e.g. [C], [G]) before saving.', 'error'); return; }
    if (!language) { toast('Please select a language', 'error'); return; }

    let finalContent = toChordPro(content);
    finalContent = ensureKeyDirective(finalContent);
    const tagsStr = tags.length > 0 ? tags.join(',') : null;

    try {
      if (song) {
        await apiCall('PUT', `/api/songs/${song.id}`, {
          title: title.trim(), artist: artist.trim(), content: finalContent,
          youtube_url: youtubeUrl.trim(), format_detected: fmt, bpm: bpmNum, tags: tagsStr, language, visibility
        });
        toast(t('songEdit.saved'), 'success');
        navigate('song-view', { id: String(song.id) });
      } else {
        const result = await apiCall<{ id: number }>('POST', '/api/songs', {
          title: title.trim(), artist: artist.trim(), content: finalContent,
          youtube_url: youtubeUrl.trim(), format_detected: fmt, bpm: bpmNum, tags: tagsStr, language, visibility
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
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('songEdit.titlePlaceholder')} />
        </div>
        <div className="field">
          <label>{t('songEdit.artistLabel')}</label>
          <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder={t('songEdit.artistPlaceholder')} />
        </div>
        <div className="field">
          <label>Language</label>
          <LanguagePicker value={language} onChange={setLanguage} preferredLanguages={preferredLanguages} />
        </div>
        <div className="field">
          <label>BPM</label>
          <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="e.g. 120" min="1" max="300" />
        </div>
      </div>
      <div className="field">
        <label>YouTube URL</label>
        <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
      </div>
      <div className="field">
        <label>Tags</label>
        <TagPicker selected={tags} onChange={setTags} />
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
            handleContentChange(text);
            const tm = text.match(/\{title:\s*([^}]+)\}/i);
            if (tm && !title) setTitle(tm[1].trim());
            const am = text.match(/\{artist:\s*([^}]+)\}/i);
            if (am && !artist) setArtist(am[1].trim());
            if (lang) setLanguage(lang);
            requestAnimationFrame(() => window.scrollTo(0, 0));
          }}
          onClose={() => setOcrOpen(false)}
        />
      )}
    </>
  );
}
