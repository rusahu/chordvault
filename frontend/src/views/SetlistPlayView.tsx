import { useState, useCallback, useMemo, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useSwipe } from '../hooks/useSwipe';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSetlistPlayer } from '../hooks/useSetlistPlayer';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { SettingsPanel } from '../components/SettingsPanel';
import { Loading } from '../components/Loading';
import { renderChordPro, getSongKey, clampFontSize, songHasKey, slEffective, autoFit } from '../lib/chords';
import { normalizeKey, ALL_KEYS, ALL_KEYS_MINOR } from '../lib/keys';
import { getStoredFontSize, setStoredFontSize, getStoredTwoCol, setStoredTwoCol } from '../lib/storage';
import type { Setlist } from '../types';

interface SetlistPlayViewProps {
  setlistId: number | string;
  isPublic?: boolean;
  isLocal?: boolean;
  initialSetlist?: Setlist;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistPlayView({ setlistId, isPublic, isLocal, initialSetlist, initialIndex, navigate }: SetlistPlayViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  // Global setlist settings
  const [slNashville, setSlNashville] = useState(false);
  const [slHideYt, setSlHideYt] = useState(false);
  const [slOptionsOpen, setSlOptionsOpen] = useState(true);
  const [fontSize, setFontSize] = useState(() => getStoredFontSize());
  const [twoCol, setTwoCol] = useState(() => getStoredTwoCol());

  // Render key for forcing re-render
  const [renderKey, setRenderKey] = useState(0);

  const { setlist, entry, index, total, prev, next, exit, goTo } = useSetlistPlayer({
    setlistId,
    isPublic,
    initialSetlist,
    initialIndex,
    navigate,
    onNavigate: () => { setEditing(false); setRenderKey((k) => k + 1); },
  });

  const content = entry ? (entry.content_override || entry.content) : '';

  // Effective values for current entry
  const effNum = entry ? (slEffective(entry, 'num', slNashville) || entry.nashville) : false;
  const effTwoCol = entry ? slEffective(entry, 'twoCol', twoCol) : twoCol;
  const effFont = entry ? slEffective(entry, 'font', fontSize) : fontSize;
  const keyDisplay = entry ? getSongKey(content, entry.transpose) : '';

  const renderedHtml = useMemo(() => {
    if (!entry) return '';
    return renderChordPro(content, entry.transpose, !!effNum);
  }, [content, entry?.transpose, effNum, renderKey]);

  // Transpose
  const transpose = useCallback((delta: number) => {
    if (!setlist || !entry) return;
    entry.transpose += delta;
    setRenderKey((k) => k + 1);
  }, [setlist, entry]);

  // Per-song overrides
  const toggleEntryNum = useCallback((checked: boolean) => {
    if (!entry) return;
    const globalVal = slNashville || entry.nashville;
    entry._num = (checked === !!globalVal) ? null : (checked ? 1 : 0);
    entry.nashville = checked ? 1 : 0;
    setRenderKey((k) => k + 1);
  }, [entry, slNashville]);

  const toggleEntryTwoCol = useCallback(() => {
    if (!entry) return;
    const current = slEffective(entry, 'twoCol', twoCol);
    entry._twoCol = !current;
    setRenderKey((k) => k + 1);
  }, [entry, twoCol]);

  const changeEntryFont = useCallback((delta: number) => {
    if (!entry) return;
    const current = slEffective(entry, 'font', fontSize) || 0;
    entry._font = clampFontSize(current + delta);
    setRenderKey((k) => k + 1);
  }, [entry, fontSize]);

  // Key picker
  const pickKey = useCallback((targetKey: string) => {
    if (!entry) return;
    const norm = normalizeKey(getSongKey(content, entry.transpose));
    if (targetKey === norm) return;
    const isMinor = norm && norm.endsWith('m') && norm.length > 1;
    const keys = isMinor ? ALL_KEYS_MINOR : ALL_KEYS;
    const fromIdx = keys.indexOf(norm);
    const toIdx = keys.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    let delta = toIdx - fromIdx;
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    transpose(delta);
  }, [entry, content, transpose]);

  // Inline editor
  const openEditor = useCallback(() => {
    if (!entry) return;
    setEditContent(entry.content_override || entry.content);
    setEditing(true);
  }, [entry]);

  const saveEditorToSetlist = async () => {
    if (!setlist || !entry) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, { content_override: editContent });
      entry.content_override = editContent;
      setEditing(false);
      setRenderKey((k) => k + 1);
      toast(t('setlist.editSaved'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const saveEditorAsVersion = async () => {
    if (!setlist || !entry) return;
    try {
      await apiCall('POST', `/api/songs/${entry.song_id}/version`, { content: editContent });
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, { content_override: editContent });
      entry.content_override = editContent;
      setEditing(false);
      setRenderKey((k) => k + 1);
      toast(t('setlist.versionCreated'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  // Swipe
  useSwipe({ onNext: next, onPrev: prev, enabled: !editing && !!setlist, containerRef });

  // Keyboard shortcuts
  const shortcuts = useMemo(() => ({
    'ArrowLeft': (e: KeyboardEvent) => { e.preventDefault(); prev(); },
    'ArrowRight': (e: KeyboardEvent) => { e.preventDefault(); next(); },
    'ArrowUp': (e: KeyboardEvent) => { e.preventDefault(); transpose(1); },
    'ArrowDown': (e: KeyboardEvent) => { e.preventDefault(); transpose(-1); },
    'n': () => { if (entry) toggleEntryNum(!entry.nashville); },
    'N': () => { if (entry) toggleEntryNum(!entry.nashville); },
    'e': () => openEditor(),
    'E': () => openEditor(),
    'Escape': () => { if (editing) setEditing(false); else exit(); },
  }), [prev, next, transpose, entry, toggleEntryNum, openEditor, editing, exit]);

  useKeyboardShortcuts(shortcuts, !!setlist);

  // Global settings changes
  const changeTwoCol = (val: boolean) => { setTwoCol(val); setStoredTwoCol(val); setRenderKey((k) => k + 1); };
  const changeFont = (delta: number) => {
    setFontSize((prev) => { const n = clampFontSize(prev + delta); setStoredFontSize(n); return n; });
    setRenderKey((k) => k + 1);
  };
  const resetFont = () => { setFontSize(0); setStoredFontSize(0); if (entry) entry._font = null; setRenderKey((k) => k + 1); };

  if (!setlist) return <Loading />;
  if (!entry) return <div className="empty"><div className="empty-text">{t('setlist.noSongsYet')}</div></div>;

  const hideYt = slEffective(entry, 'hideYt', slHideYt);

  return (
    <div ref={containerRef}>
      <div className="setlist-play-header">
        <button className="btn btn-ghost btn-sm" onClick={exit}>&#8592; {t('setlist.exit')}</button>
        <span className="setlist-play-indicator">
          {entry.title} ({index + 1}/{total})
          {entry.bpm && <span className="badge badge-bpm">{entry.bpm} bpm</span>}
          {entry.language && <span className="badge badge-lang">{entry.language.toUpperCase()}</span>}
          {!hideYt && entry.youtube_url && (
            <a href={entry.youtube_url} target="_blank" rel="noopener" className="yt-link" title="Watch on YouTube">&#9654; YT</a>
          )}
        </span>
        <button className={`btn btn-ghost btn-sm${slOptionsOpen ? ' active' : ''}`} onClick={() => setSlOptionsOpen((v) => !v)} title="Settings">&#9881;</button>
      </div>

      {slOptionsOpen && (
        <SettingsPanel
          nashville={slNashville}
          onNashvilleChange={(v) => { setSlNashville(v); setRenderKey((k) => k + 1); }}
          hideYt={slHideYt}
          onHideYtChange={(v) => { setSlHideYt(v); setRenderKey((k) => k + 1); }}
          twoCol={twoCol}
          onTwoColChange={changeTwoCol}
          fontSize={fontSize}
          onFontChange={changeFont}
          onFontReset={resetFont}
        />
      )}

      <Toolbar
        currentKey={keyDisplay}
        nashville={!!effNum}
        nashvilleDisabled={!songHasKey(content, entry.transpose)}
        onNashvilleChange={toggleEntryNum}
        twoCol={!!effTwoCol}
        onTwoColToggle={toggleEntryTwoCol}
        fontSize={effFont || 0}
        onFontChange={changeEntryFont}
        onFontReset={() => { if (entry) entry._font = null; setRenderKey((k) => k + 1); }}
        onPickKey={pickKey}
        onAutoFit={() => {
          const fit = autoFit();
          changeFont(fit.fontSize - fontSize);
          changeTwoCol(fit.twoCol);
        }}
        overrides={{
          num: entry._num != null,
          twoCol: entry._twoCol != null,
          font: entry._font != null,
        }}
      />

      {editing ? (
        <div className="setlist-editor">
          <textarea
            className="setlist-edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
          />
          <div className="setlist-editor-actions">
            <button className="btn btn-sm" onClick={saveEditorToSetlist}>{t('setlist.saveToSetlist')}</button>
            <button className="btn btn-ghost btn-sm" onClick={saveEditorAsVersion}>{t('setlist.saveAsVersion')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('songEdit.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="setlist-sheet-row">
          {index > 0 ? (
            <button className="setlist-side-btn setlist-side-prev" onClick={prev}>&#8249;</button>
          ) : <div className="setlist-side-spacer" />}
          {entry?.is_private_placeholder ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">&#128274;</div>
              <div className="empty-text">This song is private</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>The song owner has marked it as private.</div>
            </div>
          ) : (
            <ChordSheet html={renderedHtml} twoCol={!!effTwoCol} fontSize={effFont || 0} />
          )}
          {index < total - 1 ? (
            <button className="setlist-side-btn setlist-side-next" onClick={next}>&#8250;</button>
          ) : <div className="setlist-side-spacer" />}
        </div>
      )}
    </div>
  );
}
