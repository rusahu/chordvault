import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { useDisclosure } from '@mantine/hooks';
import { Alert, Badge, Paper, Button, NativeSelect, Group, Box, Text } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useChordRenderer } from '../hooks/useChordRenderer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { Loading } from '../components/Loading';
import { AddToSetlistModal } from '../components/AddToSetlistModal';
import { renderChordPro, songHasKey, autoFit } from '../lib/chords';
import { languageName } from '../lib/languages';
import type { Song, SongVersion, Correction } from '../types';
import { PageTitle } from '../components/PageTitle';

interface SongViewProps {
  songId: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SongView({ songId, navigate }: SongViewProps) {
  const apiCall = useApi();
  const { getSong, getVersions } = useLibraryRead();
  const { readOnly } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const [loadError, setLoadError] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [addToSetlistOpen, addToSetlist] = useDisclosure(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSong(null);
    setLoadError('');
    getSong(songId)
      .then((data) => {
        setSong(data);
        location.hash = `#song/${songId}`;
      })
      .catch((e) => setLoadError(e.message));
  }, [songId, getSong, navigate, user]);

  useEffect(() => {
    if (!song) return;
    getVersions(songId)
      .then((v) => { if (v.length > 1) setVersions(v); })
      .catch(() => {});
    if (user && user.username === song.username) {
      apiCall<Correction[]>('GET', `/api/songs/${songId}/corrections`)
        .then(setCorrections)
        .catch(() => {});
    }
  }, [song, songId, getVersions, apiCall, user]);

  const content = song?.content || '';
  const chord = useChordRenderer(content);
  const { setTargetKey: resetChordKey, setNashville: resetChordNashville } = chord;
  const fontScale = useFontScale();
  const twoColState = useTwoCol();

  const handleAutoFit = () => {
    const result = autoFit();
    fontScale.setFontSizeTo(result.fontSize);
    twoColState.setTwoColTo(result.twoCol);
    window.scrollTo(0, 0);
  };

  // Reset key/nashville when navigating to a different song
  useEffect(() => {
    resetChordKey(null);
    resetChordNashville(false);
  }, [songId, resetChordKey, resetChordNashville]);

  const renderedHtml = useMemo(
    () => renderChordPro(content, chord.transpose, chord.nashville),
    [content, chord.transpose, chord.nashville]
  );

  const shortcuts = useMemo(() => ({
    'ArrowUp': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(1); },
    'ArrowDown': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(-1); },
    '+': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(1); },
    '-': (e: KeyboardEvent) => { e.preventDefault(); chord.stepCurrentKey(-1); },
    '0': () => chord.resetKey(),
    'n': () => chord.toggleNashville(!chord.nashville),
    'N': () => chord.toggleNashville(!chord.nashville),
  }), [chord]);

  useKeyboardShortcuts(shortcuts, !!song);

  const isOwner = user && song && user.username === song.username;

  const handleExportPdf = async () => {
    if (!song || exporting) return;
    setExporting(true);
    try {
      const { exportSongPdf } = await import('../lib/pdf-export');
      const missing = await exportSongPdf(song, {
        transpose: chord.transpose,
        nashville: chord.nashville,
        fontSize: fontScale.fontSize,
      });
      if (missing.length) {
        toast(`PDF exported, but these characters may be missing: ${missing.slice(0, 8).join(' ')}`, 'error');
      } else {
        toast('PDF exported', 'success');
      }
    } catch (e) {
      toast((e as Error).message || 'PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  };



  const approveCorrection = async (id: number) => {
    modals.openConfirmModal({ children: 'Apply this correction? The original song content will be updated.', labels: { confirm: 'Confirm', cancel: 'Cancel' }, onConfirm: async () => {
    try {
      await apiCall('PUT', `/api/corrections/${id}/approve`);
      toast('Correction approved', 'success');
      setSong(null);
      const data = await getSong(songId);
      setSong(data);
    } catch (e) { toast((e as Error).message, 'error'); }

} });
};

  const rejectCorrection = async (id: number) => {
    modals.openConfirmModal({ children: 'Reject and delete this correction?', labels: { confirm: 'Confirm', cancel: 'Cancel' }, onConfirm: async () => {
    try {
      await apiCall('DELETE', `/api/corrections/${id}`);
      toast('Correction rejected', 'success');
      setCorrections((prev) => prev.filter((c) => c.id !== id));
    } catch (e) { toast((e as Error).message, 'error'); }

} });
};

  if (loadError) return <Alert title="Song unavailable" color="red">{loadError}<Button mt="sm" display="block" onClick={() => navigate('browse')}>Back to songs</Button></Alert>;
  if (!song) return <Loading />;

  return (
    <div lang={song.language || undefined}>
      <Box mb="lg">
        <Group justify="space-between" mb="md">
          <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => { location.hash = ''; navigate(user ? 'my-songs' : 'browse'); }}>
            &#8592; {t('songView.back')}
          </Button>
          <Group gap="xs">
            {isOwner && (
              <Button disabled={readOnly} variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => navigate('song-edit', { id: String(song.id) })}>
                &#9998; {t('songView.edit')}
              </Button>
            )}
            {user && !isOwner && song.visibility !== 'private' && (
              <>
                <Button disabled={readOnly} variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => navigate('song-edit', { id: String(song.id) })}>
                  &#43; Create Version
                </Button>
                <Button variant="default" size="xs" className="btn btn-ghost btn-sm" disabled={readOnly} onClick={() => navigate('correction', { id: String(song.id) })}>
                  &#9998; Correction
                </Button>
              </>
            )}
            <Button variant="default" size="xs" className="btn btn-ghost btn-sm" disabled={readOnly} onClick={addToSetlist.open}>
              &#43; {t('songView.addToSetlist')}
            </Button>
          </Group>
        </Group>
        <PageTitle order={1} className="song-view-title">{song.title}</PageTitle>
        {song.artist && <Text size="lg" c="dimmed" mt={4}>{song.artist}</Text>}
        <Group gap="xs" mt="xs">
          {!isOwner && song.username && <span className="song-view-by">@{song.username}</span>}
          {song.bpm && <Badge>{song.bpm} bpm</Badge>}
          {song.language && <Badge title={languageName(song.language)}>{song.language.toUpperCase()}</Badge>}
          {isOwner && song.visibility === 'private' && <Badge leftSection={<IconLock size={14} aria-hidden />}>Private</Badge>}
          {versions.length > 1 && (
            <Group gap="xs" wrap="nowrap">
              <Text component="label" htmlFor="song-version" size="xs" c="dimmed" fw={600}>Version</Text>
              <NativeSelect
                id="song-version" size="xs"
                value={songId}
                onChange={(e) => navigate('song-view', { id: e.target.value })}
              >
                {versions.map((v, idx) => (
                  <option key={v.id} value={v.id}>
                    {idx + 1} (@{v.username}) {v.youtube_url ? '▶' : ''}
                  </option>
                ))}
              </NativeSelect>
            </Group>
          )}
        </Group>
      </Box>

      <Toolbar
        currentKey={chord.currentKey}
        nashville={chord.nashville}
        nashvilleDisabled={!songHasKey(content, chord.transpose)}
        onNashvilleChange={chord.toggleNashville}
        twoCol={twoColState.twoCol}
        onTwoColToggle={twoColState.toggleTwoCol}
        fontSize={fontScale.fontSize}
        onFontChange={fontScale.changeFontSize}
        onReset={() => {
          fontScale.resetFontSize();
          twoColState.setTwoColTo(false);
        }}
        onPickKey={chord.pickKey}
        onAutoFit={handleAutoFit}
        onExportPdf={handleExportPdf}
        renderKey={songId}
      />

      <ChordSheet
        html={renderedHtml}
        twoCol={twoColState.twoCol}
        fontSize={fontScale.fontSize}
      />

      {(song.tags || song.youtube_url) && (
        <Group gap="xs" mt="xs">
          {song.tags && song.tags.split(',').map((tag) => <Badge key={tag}>{tag}</Badge>)}
          {song.youtube_url && <a href={song.youtube_url} target="_blank" rel="noopener" className="yt-link">&#9654; YouTube</a>}
        </Group>
      )}

      {/* Corrections section */}
      {isOwner && corrections.length > 0 && (
        <div className="corrections-section">
          <h3 className="admin-section-title">Pending Corrections ({corrections.length})</h3>
          {corrections.map((c) => (
            <Paper withBorder key={c.id} className="correction-card" bg="var(--ui-card-bg)" radius={12} p={16} mb={12} shadow="sm">
              <Group justify="space-between" gap={8} mb={12} c="dimmed" fz={13}>
                <span>@{c.username} &middot; {new Date(c.created_at).toLocaleDateString()}</span>
                <Group gap={8}>
                  <Button size="xs" className="btn btn-sm" disabled={readOnly} onClick={() => approveCorrection(c.id)}>Approve</Button>
                  <Button color="red" size="xs" className="btn btn-danger btn-sm" disabled={readOnly} onClick={() => rejectCorrection(c.id)}>Reject</Button>
                </Group>
              </Group>
              <div className="correction-preview" dangerouslySetInnerHTML={{ __html: renderChordPro(c.content, 0, false) }} />
            </Paper>
          ))}
        </div>
      )}

      <AddToSetlistModal
        isOpen={addToSetlistOpen}
        onClose={addToSetlist.close}
        songId={songId}
        songTitle={song?.title || ''}
        songArtist={song?.artist || ''}
        songVisibility={song?.visibility}
        targetKey={chord.targetKey}
        nashville={chord.nashville}
      />
    </div>
  );
}
