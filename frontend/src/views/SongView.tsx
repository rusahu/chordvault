import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useChordRenderer } from '../hooks/useChordRenderer';
import { useFontScale } from '../hooks/useFontScale';
import { useTwoCol } from '../hooks/useTwoCol';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ChordSheet } from '../components/ChordSheet';
import { Toolbar } from '../components/Toolbar';
import { Loading } from '../components/Loading';
import { renderChordPro, songHasKey, autoFit } from '../lib/chords';
import { languageName } from '../lib/languages';
import type { Song, SongVersion, Correction, SongListItem, SetlistListItem } from '../types';

interface SongViewProps {
  songId: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SongView({ songId, navigate }: SongViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [song, setSong] = useState<Song | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [addToSetlistOpen, setAddToSetlistOpen] = useState(false);
  const [userSetlists, setUserSetlists] = useState<SetlistListItem[]>([]);

  useEffect(() => {
    setSong(null);
    apiCall<Song>('GET', `/api/songs/${songId}`)
      .then((data) => {
        setSong(data);
        location.hash = `#song/${songId}`;
      })
      .catch((e) => { toast(e.message, 'error'); navigate(user ? 'my-songs' : 'browse'); });
  }, [songId]);

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
  }, [song, songId]);

  const content = song?.content || '';
  const chord = useChordRenderer(content);
  const fontScale = useFontScale();
  const twoColState = useTwoCol();

  // Re-render when content changes (reset transpose)
  useEffect(() => {
    if (song) {
      chord.setTranspose(0);
      chord.setNashville(false);
    }
  }, [songId]);

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

  const showAddToSetlist = async () => {
    if (user) {
      try {
        const sls = await apiCall<SetlistListItem[]>('GET', '/api/setlists');
        setUserSetlists(sls);
      } catch { /* ignore */ }
    }
    setAddToSetlistOpen(true);
  };

  const addToExisting = async (setlistId: number) => {
    const targetSetlist = userSetlists.find((sl) => sl.id === setlistId);
    if (song?.visibility === 'private' && targetSetlist?.visibility === 'public') {
      if (!confirm('This song is private. Other viewers of this public setlist will see it as "[Private Song]". Continue?')) return;
    }
    try {
      await apiCall('POST', `/api/setlists/${setlistId}/songs`, {
        song_id: songId, transpose: chord.transpose, nashville: chord.nashville
      });
      setAddToSetlistOpen(false);
      toast(t('setlist.songAdded'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const createAndAdd = async () => {
    const name = prompt(t('setlist.enterName'));
    if (!name?.trim()) return;
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
    <>
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
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('correction', { id: String(song.id) })}>
                &#9998; Correction
              </button>
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
        </div>
        {versions.length > 1 && (
          <div className="song-versions">
            <span className="transpose-label">{t('setlist.versions')}:</span>
            {versions.map((v) => (
              <button
                key={v.id}
                className={`btn btn-ghost btn-sm${v.id === songId ? ' active' : ''}`}
                onClick={() => navigate('song-view', { id: String(v.id) })}
              >
                {v.youtube_url && <span style={{ color: 'var(--accent)' }} title="Has YouTube video">&#9654; </span>}
                {v.title}{v.parent_id ? ' (v)' : ''}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}> @{v.username}</span>
              </button>
            ))}
          </div>
        )}
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
        onReset={() => { fontScale.resetFontSize(); twoColState.setTwoColTo(false); }}
        onPickKey={chord.pickKey}
        onAutoFit={() => {
          const before = { fontSize: fontScale.fontSize, twoCol: twoColState.twoCol };
          const fit = autoFit();
          fontScale.setFontSizeTo(fit.fontSize);
          twoColState.setTwoColTo(fit.twoCol);
          if (fit.fontSize === before.fontSize && fit.twoCol === before.twoCol) {
            toast('Already fitted', 'info');
          } else {
            const parts = [];
            if (fit.twoCol) parts.push('multi-column');
            if (fit.fontSize !== 0) parts.push(`font ${fit.fontSize > 0 ? '+' : ''}${fit.fontSize}`);
            toast(parts.length ? `Fitted: ${parts.join(', ')}` : 'Fitted to default', 'success');
          }
        }}
      />

      <ChordSheet html={renderedHtml} twoCol={twoColState.twoCol} fontSize={fontScale.fontSize} />

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
        <div className="setlist-add-overlay" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setAddToSetlistOpen(false); }}>
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
    </>
  );
}
