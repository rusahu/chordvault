import { Alert, Button, Box, Text, Textarea } from '@mantine/core';
import { useOffline } from '../context/OfflineContext';
import { useState, useCallback, useMemo, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useSwipe } from '../hooks/useSwipe';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSetlistPlayer } from '../hooks/useSetlistPlayer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { ChordSheet } from '../components/ChordSheet';
import type { ToolbarProps } from '../components/Toolbar';
import { usePlaybackLayout } from '../hooks/usePlaybackLayout';
import { PlaybackTopBar } from '../components/PlaybackTopBar';
import { PlaybackDock, type PlaybackNav } from '../components/PlaybackDock';
import { PlaybackMoreMenu } from '../components/PlaybackMoreMenu';
import { SettingsPanel } from '../components/SettingsPanel';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { renderChordPro, getSongKey, clampFontSize, songHasKey, resolveEffectivePreferences, autoFit } from '../lib/chords';
import { useSetlistPreferences } from '../hooks/useSetlistPreferences';
import { stepKey } from '../lib/keys';
import { entrySemitones } from '../lib/setlistKeys';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const { readOnly } = useOffline();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Global setlist settings
  const [slNashville, setSlNashville] = useState(false);
  const [slHideYt, setSlHideYt] = useState(false);
  const fontScale = useFontScale();
  const twoColState = useTwoCol();
  const layout = usePlaybackLayout();

  const { loadError, setlist, entry, index, total, prev, next, exit, updateEntry, isModified, saveOnline, saveLocal } = useSetlistPlayer({
    setlistId,
    isLocal: _isLocal,
    initialSetlist,
    initialIndex,
    navigate,
    onNavigate: () => {
      setEditing(false);
    },
  });

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
  const semitones = useMemo(() => entrySemitones(content, entry?.target_key), [entry?.target_key, content]);

  const keyDisplay = entry ? getSongKey(content, semitones) : '';

  const renderedHtml = useMemo(() => {
    if (!entry) return '';
    return renderChordPro(content, semitones, !!effNum);
  }, [content, effNum, entry, semitones]);

  // Key stepping
  const stepEntryKey = useCallback((direction: 1 | -1) => {
    if (!entry) return;
    const current = entry.target_key || getSongKey(content, 0);
    if (!current) return;
    updateEntry({ target_key: stepKey(current, direction) });
  }, [entry, content, updateEntry]);

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
    updateEntry({ target_key: targetKey });
  }, [entry, updateEntry]);

  // Inline editor
  const openEditor = useCallback(() => {
    if (readOnly || !entry || setlist?.isLocal) return;
    setEditContent(entry.content_override || entry.content);
    setEditing(true);
  }, [entry, setlist, readOnly]);

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
    'ArrowUp': (e: KeyboardEvent) => { e.preventDefault(); stepEntryKey(1); },
    'ArrowDown': (e: KeyboardEvent) => { e.preventDefault(); stepEntryKey(-1); },
    'n': () => { if (entry) toggleEntryNum(!effNum); },
    'N': () => { if (entry) toggleEntryNum(!effNum); },
    'e': () => openEditor(),
    'E': () => openEditor(),
    'Escape': () => { if (editing) setEditing(false); else exit(); },
  }), [prev, next, stepEntryKey, entry, effNum, toggleEntryNum, openEditor, editing, exit]);

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
      const missing = await exportSetlistPdf(setlist, {
        nashville: slNashville,
        fontSize: fontScale.fontSize,
      });
      if (missing.length) {
        toast(
          `Setlist PDF exported, but these characters may be missing: ${missing.slice(0, 8).join(' ')}`,
          'error',
        );
      } else {
        toast('Setlist PDF exported', 'success');
      }
    } catch (e) {
      toast((e as Error).message || 'PDF export failed', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const doFit = () => {
    const result = autoFit();
    updateEntry({
      _font: result.fontSize === fontScale.fontSize ? null : result.fontSize,
      _twoCol: result.twoCol === !!twoColState.twoCol ? null : result.twoCol
    });
    window.scrollTo(0, 0);
  };

  if (loadError) return <Alert title="Setlist unavailable" color="red">{loadError}<Button mt="sm" display="block" onClick={() => navigate('setlists')}>Back to setlists</Button></Alert>;
  if (!setlist) return <Loading />;
  if (!entry) return <EmptyState text={t('setlist.noSongsYet')} />;

  const resetEntryLayout = () => { if (entry) updateEntry({ _font: null, _twoCol: null }); };
  const canReset = entry._font != null || entry._twoCol != null;
  const toolbar: ToolbarProps = {
    currentKey: keyDisplay,
    nashville: !!effNum,
    nashvilleDisabled: !songHasKey(content, semitones),
    onNashvilleChange: toggleEntryNum,
    twoCol: !!effTwoCol,
    onTwoColToggle: toggleEntryTwoCol,
    fontSize: effFont || 0,
    onFontChange: changeEntryFont,
    onReset: resetEntryLayout,
    onPickKey: pickKey,
    onAutoFit: doFit,
    onSaveOnline: !readOnly && isOwner ? () => saveOnline(false) : undefined,
    onSaveLocal: readOnly ? undefined : () => saveLocal(false),
    onExportPdf: handleExportAllPdf,
    settingsPanel: (
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
    ),
    isModified,
    renderKey: index,
    overrides: { num: entry._num != null, twoCol: entry._twoCol != null, font: entry._font != null },
    canReset,
  };
  const nav: PlaybackNav = { onPrev: prev, onNext: next, hasPrev: index > 0, hasNext: index < total - 1 };
  const more = (
    <PlaybackMoreMenu nashville={!!effNum} nashvilleDisabled={toolbar.nashvilleDisabled} onNashvilleChange={toggleEntryNum}
      onExportPdf={handleExportAllPdf} onReset={resetEntryLayout} canReset={canReset}
      bpm={entry.bpm} youtubeUrl={hideYt ? null : entry.youtube_url} />
  );

  return (
    <div ref={containerRef} className={`setlist-play-container${layout === 'desktop' ? '' : ' has-dock'}`}>
      <PlaybackTopBar layout={layout} title={entry.title} position={`${index + 1} of ${total}, ${setlist.name}`}
        nav={nav} onExit={exit} toolbar={toolbar} more={more}
        bpm={entry.bpm} youtubeUrl={hideYt ? null : entry.youtube_url} />


      {editing ? (
        <div className="setlist-editor">
          <Textarea
            className="setlist-edit-textarea"
            aria-label="Setlist chord sheet"
            rows={12}
            styles={{ input: { minHeight: 300, fontFamily: 'var(--font-mono)', lineHeight: 1.7 } }}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
          />
          <div className="setlist-editor-actions">
            <Button size="xs" className="btn btn-sm" onClick={saveEditorToSetlist}>{t('setlist.saveToSetlist')}</Button>
            <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={saveEditorAsVersion}>{t('setlist.saveAsVersion')}</Button>
            <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('songEdit.cancel')}</Button>
          </div>
        </div>
      ) : (
        <>
          {entry?.is_private_placeholder ? (
            <Box mt={40}>
              <EmptyState icon={<Text span fz={56} aria-hidden>🔒</Text>} text={entry.not_downloaded ? "This song is not downloaded. Connect and refresh your library." : <>This song is private<Text span display="block" size="sm" mt="xs">The song owner has marked it as private.</Text></>} />
            </Box>
          ) : (
            <ChordSheet
              html={renderedHtml}
              twoCol={!!effTwoCol}
              fontSize={effFont || 0}
            />
          )}
        </>
      )}
      {layout !== 'desktop' && <PlaybackDock layout={layout} nav={nav} toolbar={toolbar} />}
    </div>
  );
}
