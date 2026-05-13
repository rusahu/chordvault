import { useState, useCallback, useMemo, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useSwipe } from '../hooks/useSwipe';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSetlistPlayer } from '../hooks/useSetlistPlayer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { useAutoFit } from '../hooks/useAutoFit';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { SettingsPanel } from '../components/SettingsPanel';
import { Loading } from '../components/Loading';
import { renderChordPro, getSongKey, clampFontSize, songHasKey, slEffective } from '../lib/chords';
import { normalizeKey, ALL_KEYS, ALL_KEYS_MINOR } from '../lib/keys';
import type { Setlist } from '../types';

interface SetlistPlayViewProps {
  setlistId: number | string;
  isPublic?: boolean;
  isLocal?: boolean;
  initialSetlist?: Setlist;
  initialIndex?: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistPlayView({ setlistId, isPublic, isLocal: _isLocal, initialSetlist, initialIndex, navigate }: SetlistPlayViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Global base preferences
  const [slNashville, setSlNashville] = useState(false);
  const [slHideYt, setSlHideYt] = useState(false);
  const [slOptionsOpen, setSlOptionsOpen] = useState(false);
  const { fontSize: globalFontSize, setFontSizeTo } = useFontScale();
  const { twoCol: globalTwoCol, setTwoColTo } = useTwoCol();

  const [autoFitActive, setAutoFitActive] = useState(false);

  // SESSION FITS: Results of "Auto-Fit" calculations for this session only.
  const [sessionFits, setSessionFits] = useState<Record<number, { fontSize: number, twoCol: boolean }>>({});

  // Render key for forcing re-render
  const [_renderKey, setRenderKey] = useState(0);

  const { setlist, entry, index, total, prev, next, exit, updateEntry, isModified, saveOnline, saveLocal } = useSetlistPlayer({
    setlistId,
    isPublic,
    initialSetlist,
    initialIndex,
    navigate,
    onNavigate: () => { setEditing(false); setRenderKey((k) => k + 1); },
  });

  const content = entry ? (entry.content_override || entry.content) : '';

  const { user } = useAuth();
  const isOwner = setlist?.user_id && user && setlist.user_id === user.id;

  // LAYOUT RESOLUTION LOGIC
  // 1. If Auto-Fit is ON and we have a session fit, use it.
  // 2. Otherwise, check for per-song overrides in the setlist entry.
  // 3. Finally, fall back to global app preferences.
  
  const currentFit = autoFitActive && entry ? sessionFits[Number(entry.entry_id)] : null;

  const effTwoCol = currentFit 
    ? currentFit.twoCol 
    : (entry && entry._twoCol !== null ? !!entry._twoCol : globalTwoCol);
    
  const effFont = currentFit 
    ? currentFit.fontSize 
    : (entry && entry._font !== null ? Number(entry._font) : globalFontSize);

  const effNum = entry ? (slEffective(entry, 'num', slNashville) || entry.nashville) : false;
  const keyDisplay = entry ? getSongKey(content, entry.transpose) : '';

  const entryTranspose = entry?.transpose ?? 0;
  const renderedHtml = useMemo(() => {
    if (!entry) return '';
    return renderChordPro(content, entryTranspose, !!effNum);
  }, [content, effNum, entry, entryTranspose]);

  // Use the robust AutoFit hook
  const { sheetRef, performFit } = useAutoFit({
    enabled: autoFitActive,
    currentFontSize: effFont,
    currentTwoCol: effTwoCol,
    onApply: (fit) => {
      if (entry) {
        setSessionFits(prev => ({ ...prev, [Number(entry.entry_id)]: fit }));
      }
    },
    deps: [index, renderedHtml]
  });

  // Transpose
  const transpose = useCallback((delta: number) => {
    if (!setlist || !entry) return;
    updateEntry({ transpose: entry.transpose + delta });
    setRenderKey((k) => k + 1);
  }, [setlist, entry, updateEntry]);

  // Per-song overrides (Manual)
  const toggleEntryNum = useCallback((checked: boolean) => {
    if (!entry) return;
    const globalVal = slNashville || entry.nashville;
    updateEntry({
      _num: (checked === !!globalVal) ? null : (checked ? 1 : 0),
      nashville: checked ? 1 : 0,
    });
    setRenderKey((k) => k + 1);
  }, [entry, slNashville, updateEntry]);

  const toggleEntryTwoCol = useCallback(() => {
    if (!entry) return;
    if (autoFitActive) {
      setAutoFitActive(false);
      toast('Auto-fit disabled', 'info');
    }
    const current = entry._twoCol !== null ? !!entry._twoCol : globalTwoCol;
    const nextVal = !current;
    
    // If setting to global default, clear override
    updateEntry({ _twoCol: nextVal === globalTwoCol ? null : nextVal });
    setRenderKey((k) => k + 1);
  }, [entry, globalTwoCol, autoFitActive, toast, updateEntry]);

  const changeEntryFont = useCallback((delta: number) => {
    if (!entry) return;
    if (autoFitActive) {
      setAutoFitActive(false);
      toast('Auto-fit disabled', 'info');
    }
    const current = entry._font !== null ? Number(entry._font) : globalFontSize;
    const nextVal = clampFontSize(current + delta);
    
    // If setting to global default, clear override
    updateEntry({ _font: nextVal === globalFontSize ? null : nextVal });
    setRenderKey((k) => k + 1);
  }, [entry, globalFontSize, autoFitActive, toast, updateEntry]);

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
      updateEntry({ content_override: editContent });
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
      updateEntry({ content_override: editContent });
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
  const changeTwoCol = (val: boolean) => {
    if (autoFitActive) {
      setAutoFitActive(false);
      toast('Auto-fit disabled', 'info');
    }
    setTwoColTo(val);
    setRenderKey((k) => k + 1);
  };
  const changeFont = (delta: number) => {
    if (autoFitActive) {
      setAutoFitActive(false);
      toast('Auto-fit disabled', 'info');
    }
    setFontSizeTo(globalFontSize + delta);
    setRenderKey((k) => k + 1);
  };
  const resetFont = () => {
    if (autoFitActive) {
      setAutoFitActive(false);
      toast('Auto-fit disabled', 'info');
    }
    setFontSizeTo(0);
    if (entry) updateEntry({ _font: null });
    setRenderKey((k) => k + 1);
  };

  const handleExportAllPdf = async () => {
    if (!setlist || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { exportSetlistPdf } = await import('../lib/pdf-export');
      await exportSetlistPdf(setlist, { nashville: slNashville, fontSize: effFont });
      toast('Setlist PDF exported', 'success');
    } catch (e) {
      toast((e as Error).message || 'PDF export failed', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const doFit = () => {
    if (autoFitActive) {
      setAutoFitActive(false);
      toast('Auto-fit disabled', 'info');
      return;
    }
    performFit();
    setAutoFitActive(true);
    toast('Auto-fit enabled for setlist', 'success');
  };

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
        <button className="btn btn-ghost btn-sm" onClick={handleExportAllPdf} disabled={exportingPdf} title="Export setlist as PDF">
          {exportingPdf ? '...' : '\u{1F4C4} PDF'}
        </button>
        <button className={`btn btn-ghost btn-sm${slOptionsOpen ? ' active' : ''}`} onClick={() => setSlOptionsOpen((v) => !v)} title="Settings">&#9881;</button>
      </div>

      {slOptionsOpen && (
        <SettingsPanel
          nashville={slNashville}
          onNashvilleChange={(v) => { setSlNashville(v); setRenderKey((k) => k + 1); }}
          hideYt={slHideYt}
          onHideYtChange={(v) => { setSlHideYt(v); setRenderKey((k) => k + 1); }}
          twoCol={effTwoCol}
          onTwoColChange={changeTwoCol}
          fontSize={effFont}
          onFontChange={changeFont}
          onFontReset={resetFont}
          onAutoFit={doFit}
        />
      )}

      <Toolbar
        currentKey={keyDisplay}
        nashville={!!effNum}
        nashvilleDisabled={!songHasKey(content, entry.transpose)}
        onNashvilleChange={toggleEntryNum}
        twoCol={effTwoCol}
        onTwoColToggle={toggleEntryTwoCol}
        fontSize={effFont}
        onFontChange={changeEntryFont}
        onReset={() => {
          if (entry) { updateEntry({ _font: null, _twoCol: null }); }
          setTwoColTo(false); // Restore global default
          setFontSizeTo(0);
          setAutoFitActive(false);
          setRenderKey((k) => k + 1);
        }}
        onPickKey={pickKey}
        onAutoFit={doFit}
        autoFitActive={autoFitActive}
        onSaveOnline={isOwner ? () => saveOnline(false) : undefined}
        onSaveLocal={() => saveLocal(false)}
        isModified={isModified}
        overrides={{
          num: entry._num != null,
          twoCol: entry._twoCol !== null && !!entry._twoCol !== globalTwoCol,
          font: entry._font !== null && Number(entry._font) !== globalFontSize,
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
            <ChordSheet ref={sheetRef} html={renderedHtml} twoCol={effTwoCol} fontSize={effFont} />
          )}
          {index < total - 1 ? (
            <button className="setlist-side-btn setlist-side-next" onClick={next}>&#8250;</button>
          ) : <div className="setlist-side-spacer" />}
        </div>
      )}
    </div>
  );
}
