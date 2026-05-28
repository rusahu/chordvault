import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useSwipe } from '../hooks/useSwipe';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSetlistPlayer } from '../hooks/useSetlistPlayer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { SettingsPanel } from '../components/SettingsPanel';
import { Loading } from '../components/Loading';
import { renderChordPro, getSongKey, clampFontSize, songHasKey, resolveEffectivePreferences, autoFit } from '../lib/chords';
import { useSetlistPreferences } from '../hooks/useSetlistPreferences';
import { getTransposeDelta } from '../lib/keys';
import type { Setlist } from '../types';

interface SetlistPlayViewProps {
  setlistId: number | string;
  isLocal?: boolean;
  initialSetlist?: Setlist;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistPlayView({ setlistId, isLocal: _isLocal, initialSetlist, initialIndex, navigate }: SetlistPlayViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Global setlist settings
  const [slNashville, setSlNashville] = useState(false);
  const [slHideYt, setSlHideYt] = useState(false);
  const [slOptionsOpen, setSlOptionsOpen] = useState(false);
  const fontScale = useFontScale();
  const twoColState = useTwoCol();
  const [autoFitActive, setAutoFitActive] = useState(false);

  const { setlist, entry, index, total, prev, next, exit, updateEntry, isModified, saveOnline, saveLocal } = useSetlistPlayer({
    setlistId,
    isLocal: _isLocal,
    initialSetlist,
    initialIndex,
    navigate,
    onNavigate: () => { 
      setEditing(false); 
    },
  });

  // Handle auto-fit logic
  useEffect(() => {
    setAutoFitActive(false);
  }, [index]);

  const content = entry ? (entry.content_override || entry.content) : '';

  const { user } = useAuth();
  const isOwner = setlist?.user_id && user && setlist.user_id === user.id;

  // Effective values for current entry
  const globalPrefs = useMemo(() => ({
    nashville: slNashville,
    twoCol: twoColState.twoCol,
    fontSize: fontScale.fontSize,
    hideYt: slHideYt,
  }), [slNashville, twoColState.twoCol, fontScale.fontSize, slHideYt]);

  const effectivePrefs = useSetlistPreferences(entry, globalPrefs);
  const effNum = effectivePrefs.nashville;
  const effTwoCol = effectivePrefs.twoCol;
  const effFont = effectivePrefs.fontSize;
  const hideYt = effectivePrefs.hideYt;
  const keyDisplay = entry ? getSongKey(content, entry.transpose) : '';

  const entryTranspose = entry?.transpose ?? 0;
  const renderedHtml = useMemo(() => {
    if (!entry) return '';
    return renderChordPro(content, entryTranspose, !!effNum);
  }, [content, effNum, entry, entryTranspose]);

  // Transpose
  const transpose = useCallback((delta: number) => {
    if (!setlist || !entry) return;
    updateEntry({ transpose: entry.transpose + delta });
  }, [setlist, entry, updateEntry]);

  // Per-song overrides
  const toggleEntryNum = useCallback((checked: boolean) => {
    if (!entry) return;
    const globalVal = slNashville;
    updateEntry({
      _num: (checked === !!globalVal) ? null : (checked ? 1 : 0),
    });
  }, [entry, slNashville, updateEntry]);

  const toggleEntryTwoCol = useCallback(() => {
    if (!entry) return;
    const prefs = resolveEffectivePreferences(entry, {
      nashville: slNashville,
      twoCol: twoColState.twoCol,
      fontSize: fontScale.fontSize,
      hideYt: slHideYt,
    });
    const nextVal = !prefs.twoCol;
    updateEntry({ _twoCol: nextVal === (!!twoColState.twoCol) ? null : nextVal });
  }, [entry, slNashville, twoColState.twoCol, fontScale.fontSize, slHideYt, updateEntry]);

  const changeEntryFont = useCallback((delta: number) => {
    if (!entry) return;
    const prefs = resolveEffectivePreferences(entry, {
      nashville: slNashville,
      twoCol: twoColState.twoCol,
      fontSize: fontScale.fontSize,
      hideYt: slHideYt,
    });
    const nextVal = clampFontSize(prefs.fontSize + delta);
    updateEntry({ _font: nextVal === fontScale.fontSize ? null : nextVal });
  }, [entry, slNashville, twoColState.twoCol, fontScale.fontSize, slHideYt, updateEntry]);

  // Key picker
  const pickKey = useCallback((targetKey: string) => {
    if (!entry) return;
    const currentKey = getSongKey(content, entry.transpose);
    const delta = getTransposeDelta(currentKey, targetKey);
    if (delta !== 0) {
      transpose(delta);
    }
  }, [entry, content, transpose]);

  // Inline editor
  const openEditor = useCallback(() => {
    if (!entry || setlist?.isLocal) return;
    setEditContent(entry.content_override || entry.content);
    setEditing(true);
  }, [entry, setlist]);

  const saveEditorToSetlist = async () => {
    if (!setlist || !entry) return;
    try {
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, { content_override: editContent });
      updateEntry({ content_override: editContent });
      setEditing(false);
      toast(t('setlist.editSaved'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const saveEditorAsVersion = async () => {
    if (!setlist || !entry) return;
    try {
      await apiCall('POST', `/api/songs/${entry.song_id}/version`, { content: editContent });
      await apiCall('PUT', `/api/setlists/${setlist.id}/entries/${entry.entry_id}`, { content_override: editContent });
      updateEntry({ content_override: editContent });
      setEditing(false);
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

  const resetFont = () => {
    fontScale.resetFontSize();
    if (entry) updateEntry({ _font: null });
  };

  const handleExportAllPdf = async () => {
    if (!setlist || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { exportSetlistPdf } = await import('../lib/pdf-export');
      await exportSetlistPdf(setlist, { nashville: slNashville, fontSize: fontScale.fontSize });
      toast('Setlist PDF exported', 'success');
    } catch (e) {
      toast((e as Error).message || 'PDF export failed', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const doFit = () => {
    setAutoFitActive(true);
    // Use a small timeout to let the autoFit() calculation run with visual feedback
    setTimeout(() => {
      const result = autoFit();
      updateEntry({ 
        _font: result.fontSize === fontScale.fontSize ? null : result.fontSize,
        _twoCol: result.twoCol === !!twoColState.twoCol ? null : result.twoCol
      });
      setAutoFitActive(false);
    }, 100);
  };

  if (!setlist) return <Loading />;
  if (!entry) return <div className="empty"><div className="empty-text">{t('setlist.noSongsYet')}</div></div>;

  // hideYt resolved in effectivePrefs above

  return (
    <div ref={containerRef} className="setlist-play-container">
      <div className="setlist-play-header">
        <div className="setlist-play-header-left">
          <button className="btn-exit" onClick={exit}>&#8592; {t('setlist.exit').toUpperCase()}</button>
        </div>

        <div className="setlist-play-center">
          <button 
            className={`nav-circle-btn${index === 0 ? ' disabled' : ''}`} 
            onClick={index > 0 ? prev : undefined} 
            title="Previous Song"
          >
            &lt;
          </button>
          
          <span className="setlist-play-indicator">
            {entry.title} ({index + 1}/{total})
          </span>

          <button 
            className={`nav-circle-btn${index === total - 1 ? ' disabled' : ''}`} 
            onClick={index < total - 1 ? next : undefined} 
            title="Next Song"
          >
            &gt;
          </button>
        </div>

        <div className="setlist-play-header-right">
          {entry.bpm && <span className="badge badge-bpm">{entry.bpm} bpm</span>}
          {!hideYt && entry.youtube_url && (
            <a href={entry.youtube_url} target="_blank" rel="noopener" className="yt-link" title="Watch on YouTube">&#9654; YT</a>
          )}
        </div>
      </div>

      <Toolbar
        currentKey={keyDisplay}
        nashville={!!effNum}
        nashvilleDisabled={!songHasKey(content, entry.transpose)}
        onNashvilleChange={toggleEntryNum}
        twoCol={!!effTwoCol}
        onTwoColToggle={toggleEntryTwoCol}
        fontSize={effFont || 0}
        onFontChange={changeEntryFont}
        onReset={() => {
          if (entry) { updateEntry({ _font: null, _twoCol: null }); }
          setAutoFitActive(false);
        }}
        onPickKey={pickKey}
        onAutoFit={doFit}
        autoFitActive={autoFitActive}
        onSaveOnline={isOwner ? () => saveOnline(false) : undefined}
        onSaveLocal={() => saveLocal(false)}
        onExportPdf={handleExportAllPdf}
        onToggleSettings={() => setSlOptionsOpen((v) => !v)}
        settingsActive={slOptionsOpen}
        isModified={isModified}
        renderKey={index}
        overrides={{
          num: entry._num != null,
          twoCol: entry._twoCol != null,
          font: entry._font != null,
        }}
      />

      {slOptionsOpen && (
        <SettingsPanel
          nashville={slNashville}
          onNashvilleChange={setSlNashville}
          hideYt={slHideYt}
          onHideYtChange={setSlHideYt}
          twoCol={twoColState.twoCol}
          onTwoColChange={twoColState.setTwoColTo}
          fontSize={fontScale.fontSize}
          onFontChange={fontScale.changeFontSize}
          onFontReset={resetFont}
        />
      )}

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
        <>
          {entry?.is_private_placeholder ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">&#128274;</div>
              <div className="empty-text">This song is private</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>The song owner has marked it as private.</div>
            </div>
          ) : (
            <ChordSheet 
              html={renderedHtml} 
              twoCol={!!effTwoCol} 
              fontSize={effFont || 0} 
              autoFit={autoFitActive} 
            />
          )}
        </>
      )}
    </div>
  );
}
