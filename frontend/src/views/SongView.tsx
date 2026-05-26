import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { useChordRenderer } from '../hooks/useChordRenderer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { Loading } from '../components/Loading';
import { renderChordPro, songHasKey, autoFit } from '../lib/chords';
import { languageName } from '../lib/languages';
import type { Song, SongVersion, Correction, SetlistListItem } from '../types';

interface SongViewProps {
  songId: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SongView({ songId, navigate }: SongViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const ls = useLocalSetlists();
  const [song, setSong] = useState<Song | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [addToSetlistOpen, setAddToSetlistOpen] = useState(false);
  const [userSetlists, setUserSetlists] = useState<SetlistListItem[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSong(null);
    apiCall<Song>('GET', `/api/songs/${songId}`)
      .then((data) => {
        setSong(data);
        location.hash = `#song/${songId}`;
      })
      .catch((e) => { toast(e.message, 'error'); navigate(user ? 'my-songs' : 'browse'); });
  }, [songId, apiCall, navigate, toast, user]);

  useEffect(() => {
    if (!song) return;
    apiCall<SongVersion[]>('GET', `/api/songs/${songId}/versions`)
      .then((v) => { if (v.length > 1) setVersions(v); })
      .catch(() => {});
    if (user && user.username === song.username) {
      apiCall<Correction[]>('GET', `/api/songs/${songId}/corrections`)
        .then(setCorrections)
        .catch(() => {});
    }
  }, [song, songId, apiCall, user]);

  const content = song?.content || '';
  const chord = useChordRenderer(content);
  const { setTranspose: resetChordTranspose, setNashville: resetChordNashville } = chord;
  const fontScale = useFontScale();
  const twoColState = useTwoCol();
  const [autoFitActive, setAutoFitActive] = useState(false);

  const handleAutoFit = () => {
    setAutoFitActive(true);
    setTimeout(() => {
      const result = autoFit();
      fontScale.changeFontSize(result.fontSize);
      twoColState.setTwoColTo(result.twoCol);
      setAutoFitActive(false);
    }, 100);
  };

  // Reset transpose/nashville when navigating to a different song
  useEffect(() => {
    resetChordTranspose(0);
    resetChordNashville(false);
  }, [songId, resetChordTranspose, resetChordNashville]);

  const renderedHtml = useMemo(
    () => renderChordPro(content, chord.transpose, chord.nashville),
    [content, chord.transpose, chord.nashville]
  );

  const shortcuts = useMemo(() => ({
    'ArrowUp': (e: KeyboardEvent) => { e.preventDefault(); chord.doTranspose(1); },
    'ArrowDown': (e: KeyboardEvent) => { e.preventDefault(); chord.doTranspose(-1); },
    '+': (e: KeyboardEvent) => { e.preventDefault(); chord.doTranspose(1); },
    '-': (e: KeyboardEvent) => { e.preventDefault(); chord.doTranspose(-1); },
    '0': () => chord.resetTranspose(),
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
      await exportSongPdf(song, renderedHtml, {
        transpose: chord.transpose,
        fontSize: fontScale.fontSize,
      });
      toast('PDF exported', 'success');
    } catch (e) {
      toast((e as Error).message || 'PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const showAddToSetlist = async () => {
    if (user) {
      try {
        const sls = await apiCall<SetlistListItem[]>('GET', '/api/setlists');
        setUserSetlists(sls);
      } catch { /* ignore */ }
    } else {
      const formatted = ls.setlists.map((sl) => ({
        id: sl.id,
        name: sl.name,
        song_count: sl.entries.length,
        visibility: 'private',
        event_date: null,
      }));
      setUserSetlists(formatted);
    }
    setAddToSetlistOpen(true);
  };

  const addToExisting = async (targetId: number | string) => {
    const targetSetlist = userSetlists.find((sl) => sl.id === targetId);
    if (!user) {
      const added = ls.addEntry(String(targetId), {
        song_id: songId,
        title: song?.title || '',
        artist: song?.artist || '',
        transpose: chord.transpose,
        nashville: chord.nashville ? 1 : 0
      });
      if (added) {
        setAddToSetlistOpen(false);
        toast(t('setlist.songAdded'), 'success');
      } else {
        toast('Failed to add song', 'error');
      }
      return;
    }
    if (song?.visibility === 'private' && targetSetlist?.visibility === 'public') {
      if (!confirm('This song is private. Other viewers of this public setlist will see it as "[Private Song]". Continue?')) return;
    }
    try {
      await apiCall('POST', `/api/setlists/${targetId}/songs`, {
        song_id: songId, transpose: chord.transpose, nashville: chord.nashville
      });
      setAddToSetlistOpen(false);
      toast(t('setlist.songAdded'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const createAndAdd = async () => {
    const name = prompt(t('setlist.enterName'));
    if (!name?.trim()) return;
    if (!user) {
      const sl = ls.create(name.trim());
      if (!sl) { toast('Max 50 setlists', 'error'); return; }
      ls.addEntry(sl.id, {
        song_id: songId,
        title: song?.title || '',
        artist: song?.artist || '',
        transpose: chord.transpose,
        nashville: chord.nashville ? 1 : 0
      });
      setAddToSetlistOpen(false);
      toast(t('setlist.songAdded'), 'success');
      return;
    }
    try {
      const result = await apiCall<{ id: number }>('POST', '/api/setlists', { name: name.trim() });
      await apiCall('POST', `/api/setlists/${result.id}/songs`, {
        song_id: songId, transpose: chord.transpose, nashville: chord.nashville
      });
      setAddToSetlistOpen(false);
      toast(t('setlist.songAdded'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const approveCorrection = async (id: number) => {
    if (!confirm('Apply this correction? The original song content will be updated.')) return;
    try {
      await apiCall('PUT', `/api/corrections/${id}/approve`);
      toast('Correction approved', 'success');
      setSong(null);
      const data = await apiCall<Song>('GET', `/api/songs/${songId}`);
      setSong(data);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const rejectCorrection = async (id: number) => {
    if (!confirm('Reject and delete this correction?')) return;
    try {
      await apiCall('DELETE', `/api/corrections/${id}`);
      toast('Correction rejected', 'success');
      setCorrections((prev) => prev.filter((c) => c.id !== id));
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  if (!song) return <Loading />;

  return (
    <div lang={song.language || undefined}>
      <div className="song-view-header">
        <div className="song-view-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => { location.hash = ''; navigate(user ? 'my-songs' : 'browse'); }}>
            &#8592; {t('songView.back')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {isOwner && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('song-edit', { id: String(song.id) })}>
                &#9998; {t('songView.edit')}
              </button>
            )}
            {user && !isOwner && song.visibility !== 'private' && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('song-edit', { id: String(song.id) })}>
                  &#43; Create Version
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('correction', { id: String(song.id) })}>
                  &#9998; Correction
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm" onClick={showAddToSetlist}>
              &#43; {t('songView.addToSetlist')}
            </button>
          </div>
        </div>
        <h1 className="song-view-title">{song.title}</h1>
        {song.artist && <div className="song-view-artist">{song.artist}</div>}
        <div className="song-view-meta">
          {!isOwner && song.username && <span className="song-view-by">@{song.username}</span>}
          {song.bpm && <span className="badge badge-bpm">{song.bpm} bpm</span>}
          {song.language && <span className="badge badge-lang" title={languageName(song.language)}>{song.language.toUpperCase()}</span>}
          {isOwner && song.visibility === 'private' && <span className="badge badge-private">&#128274; Private</span>}
          {versions.length > 1 && (
            <div className="version-selector-container">
              <span className="version-selector-label">Version</span>
              <select
                className="version-select-compact"
                value={songId}
                onChange={(e) => navigate('song-view', { id: e.target.value })}
              >
                {versions.map((v, idx) => (
                  <option key={v.id} value={v.id}>
                    {idx + 1} (@{v.username}) {v.youtube_url ? '▶' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

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
        autoFitActive={autoFitActive}
        onExportPdf={handleExportPdf}
        renderKey={songId}
      />

      <ChordSheet 
        html={renderedHtml} 
        twoCol={twoColState.twoCol} 
        fontSize={fontScale.fontSize} 
        autoFit={autoFitActive} 
      />

      {(song.tags || song.youtube_url) && (
        <div className="song-view-meta song-view-meta-bottom">
          {song.tags && song.tags.split(',').map((tag) => <span key={tag} className="badge badge-tag">{tag}</span>)}
          {song.youtube_url && <a href={song.youtube_url} target="_blank" rel="noopener" className="yt-link">&#9654; YouTube</a>}
        </div>
      )}

      {/* Corrections section */}
      {isOwner && corrections.length > 0 && (
        <div className="corrections-section">
          <h3 className="admin-section-title">Pending Corrections ({corrections.length})</h3>
          {corrections.map((c) => (
            <div key={c.id} className="correction-card">
              <div className="correction-card-header">
                <span>@{c.username} &middot; {new Date(c.created_at).toLocaleDateString()}</span>
                <div className="correction-actions">
                  <button className="btn btn-sm" onClick={() => approveCorrection(c.id)}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectCorrection(c.id)}>Reject</button>
                </div>
              </div>
              <div className="correction-preview" dangerouslySetInnerHTML={{ __html: renderChordPro(c.content, 0, false) }} />
            </div>
          ))}
        </div>
      )}

      {/* Add to setlist overlay */}
      {addToSetlistOpen && (
        <div className="setlist-add-overlay" data-overlay style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setAddToSetlistOpen(false); }}>
          <div className="setlist-add-content">
            <div className="view-header">
              <h3 className="view-title">{t('setlist.addToSetlist')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddToSetlistOpen(false)}>&#10005;</button>
            </div>
            <div className="song-grid">
              <div className="song-card" onClick={createAndAdd}>
                <div className="song-card-info"><div className="song-card-title">{t('setlist.newSetlist')}</div></div>
              </div>
              {userSetlists.map((sl) => (
                <div key={sl.id} className="song-card" onClick={() => addToExisting(sl.id)}>
                  <div className="song-card-info">
                    <div className="song-card-title">{sl.name}</div>
                    <div className="song-card-meta">{sl.song_count} {sl.song_count !== 1 ? t('admin.songPlural') : t('admin.song')}</div>
                    {sl.visibility === 'public' && <span className="badge badge-tag" style={{ fontSize: 10 }}>Public</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
