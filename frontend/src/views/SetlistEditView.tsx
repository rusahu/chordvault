import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { SongPicker } from '../components/SongPicker';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { getSongKey } from '../lib/chords';
import type { Setlist, SetlistEntry, SongListItem, Song } from '../types';

interface SetlistEditViewProps {
  setlistId: number | string;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistEditView({ setlistId, navigate }: SetlistEditViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const ls = useLocalSetlists();
  
  const isLocal = typeof setlistId === 'string' && setlistId.startsWith('local_');
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (isLocal) {
      const sl = ls.getOne(String(setlistId));
      if (!sl) { navigate(user ? 'setlists' : 'public-setlists'); return; }
      
      const formatted: Setlist = {
        id: sl.id,
        name: sl.name,
        entries: sl.entries.map((e, idx) => ({
          entry_id: `local_${idx}`,
          song_id: e.song_id,
          title: e.title,
          artist: e.artist || '',
          transpose: e.transpose || 0,
          nashville: e.nashville || 0,
          content: '',
          content_override: null,
          font: null,
          two_col: null,
          bpm: null,
          youtube_url: null,
          language: 'en',
        })),
        isLocal: true,
        visibility: 'private',
        event_date: null,
      };
      setSetlist(formatted);
      location.hash = `#setlist/${setlistId}`;
      return;
    }

    try {
      let sl: Setlist;
      if (user) {
        try {
          sl = await apiCall<Setlist>('GET', `/api/setlists/${setlistId}`);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
            sl = await apiCall<Setlist>('GET', `/api/setlists/public/${setlistId}`);
          } else {
            throw err;
          }
        }
      } else {
        sl = await apiCall<Setlist>('GET', `/api/setlists/public/${setlistId}`);
      }
      setSetlist(sl);
      location.hash = `#setlist/${setlistId}`;
    } catch (e) {
      toast((e as Error).message, 'error');
      navigate(user ? 'setlists' : 'public-setlists');
    }
  }, [apiCall, toast, navigate, setlistId, user, isLocal, ls]);

  useEffect(() => { load(); }, [load]);

  const saveMeta = async () => {
    if (!setlist) return;
    const nameInput = (document.getElementById('setlist-name-input') as HTMLInputElement)?.value.trim();
    if (!nameInput) return;

    if (isLocal) {
      if (nameInput.length > 200) return;
      ls.rename(String(setlistId), nameInput);
      setSetlist((prev) => prev ? { ...prev, name: nameInput } : prev);
    } else {
      const vis = (document.getElementById('setlist-visibility') as HTMLInputElement)?.checked ? 'public' : 'private';
      const date = (document.getElementById('setlist-date') as HTMLInputElement)?.value || '';
      try {
        await apiCall('PUT', `/api/setlists/${setlistId}`, { name: nameInput, visibility: vis, event_date: date });
        setSetlist((prev) => prev ? { ...prev, name: nameInput, visibility: vis, event_date: date } : prev);
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const deleteSetlist = async () => {
    if (!confirm(t('setlist.confirmDelete'))) return;

    if (isLocal) {
      ls.remove(String(setlistId));
      toast(t('setlist.deleted'), 'success');
      location.hash = '';
      navigate(user ? 'setlists' : 'public-setlists');
    } else {
      try {
        await apiCall('DELETE', `/api/setlists/${setlistId}`);
        toast(t('setlist.deleted'), 'success');
        location.hash = '';
        navigate('setlists');
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const moveEntry = async (idx: number, dir: number) => {
    if (!setlist) return;

    if (isLocal) {
      ls.moveEntry(String(setlistId), idx, dir);
      const sl = ls.getOne(String(setlistId));
      if (sl) {
        setSetlist((prev) => prev ? {
          ...prev,
            entries: sl.entries.map((e, idx) => ({
              entry_id: `local_${idx}`,
              song_id: e.song_id,
              title: e.title,
              artist: e.artist || '',
              transpose: e.transpose || 0,
              nashville: e.nashville || 0,
              content: '',
              content_override: null,
              font: null,
              two_col: null,
              bpm: null,
              youtube_url: null,
              language: 'en',
            })),
        } : null);
      }
    } else {
      const entries = [...setlist.entries];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= entries.length) return;
      [entries[idx], entries[newIdx]] = [entries[newIdx], entries[idx]];
      setSetlist({ ...setlist, entries });
      try {
        await apiCall('PUT', `/api/setlists/${setlistId}/reorder`, { entry_ids: entries.map((e) => e.entry_id) });
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const removeEntry = async (entryId: number | string, idx: number) => {
    if (isLocal) {
      ls.removeEntry(String(setlistId), idx);
      setSetlist((prev) => prev ? { ...prev, entries: prev.entries.filter((_, i) => i !== idx) } : prev);
      toast(t('setlist.songRemoved'), 'success');
    } else {
      try {
        await apiCall('DELETE', `/api/setlists/${setlistId}/entries/${entryId}`);
        setSetlist((prev) => prev ? { ...prev, entries: prev.entries.filter((e) => e.entry_id !== entryId) } : prev);
        toast(t('setlist.songRemoved'), 'success');
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const addSong = async (song: SongListItem) => {
    if (isLocal) {
      const added = ls.addEntry(String(setlistId), {
        song_id: song.id,
        title: song.title,
        artist: song.artist || '',
        transpose: 0,
        nashville: 0
      });
      if (added) {
        toast(t('setlist.songAdded'), 'success');
        setPickerOpen(false);
        load();
      } else {
        toast('Failed to add song', 'error');
      }
    } else {
      try {
        await apiCall('POST', `/api/setlists/${setlistId}/songs`, { song_id: song.id });
        toast(t('setlist.songAdded'), 'success');
        setPickerOpen(false);
        load();
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const handleTransposeEntry = async (entryId: number | string, idx: number, delta: number) => {
    if (!setlist) return;
    const entry = setlist.entries[idx];
    const newTranspose = (entry.transpose ?? 0) + delta;

    if (isLocal) {
      ls.updateEntry(String(setlistId), idx, { transpose: newTranspose });
      setSetlist((prev) => {
        if (!prev) return null;
        const entries = [...prev.entries];
        entries[idx] = { ...entries[idx], transpose: newTranspose };
        return { ...prev, entries };
      });
    } else {
      try {
        await apiCall('PUT', `/api/setlists/${setlistId}/entries/${entryId}`, { transpose: newTranspose });
        setSetlist((prev) => {
          if (!prev) return null;
          const entries = [...prev.entries];
          entries[idx] = { ...entries[idx], transpose: newTranspose };
          return { ...prev, entries };
        });
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
  };

  const playLocal = async (startIndex = 0) => {
    const sl = ls.getOne(String(setlistId));
    if (!sl || sl.entries.length === 0) return;
    try {
      const fetches = sl.entries.map((e) => apiCall<Song>('GET', `/api/songs/${e.song_id}`).catch(() => null));
      const results = await Promise.all(fetches);
      const entries = results.map((song, i) => {
        if (!song) return null;
        const e = sl.entries[i];
        return {
          song_id: song.id,
          entry_id: `local_${i}`,
          title: song.title,
          artist: song.artist || '',
          content: song.content,
          content_override: null,
          transpose: e.transpose ?? 0,
          nashville: e.nashville ?? 0,
          font: null,
          two_col: null,
          bpm: song.bpm || null,
          youtube_url: song.youtube_url || null,
          language: song.language || 'en',
        };
      }).filter(Boolean);
      if (entries.length === 0) { toast('No songs could be loaded', 'error'); return; }
      const enrichedSetlist: Setlist = {
        id: String(setlistId),
        name: sl.name,
        entries: entries as SetlistEntry[],
        isLocal: true,
        visibility: 'private',
        event_date: null
      };
      navigate('setlist-play', {
        id: String(setlistId),
        local: '1',
        index: String(startIndex),
        _setlist: JSON.stringify(enrichedSetlist)
      });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const handleItemClick = (idx: number) => {
    if (isLocal) {
      playLocal(idx);
    } else {
      navigate('setlist-play', { id: String(setlistId), index: String(idx) });
    }
  };

  const copyShareLink = () => {
    const url = window.location.origin + window.location.pathname + `#setlist/${setlistId}`;
    navigator.clipboard.writeText(url)
      .then(() => toast(t('setlist.linkCopied') || 'Link copied to clipboard', 'success'))
      .catch(() => toast('Failed to copy link', 'error'));
  };

  const isEditable = isLocal || (setlist?.user_id != null && user != null && setlist.user_id === user.id);

  if (!setlist) return <Loading />;

  return (
    <>
      <div className="song-view-header">
        <div className="song-view-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(isEditable ? 'setlists' : 'public-setlists')}>&#8592; {t('songView.back')}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {setlist.entries.length > 0 && (
              <button className="btn btn-sm" onClick={() => handleItemClick(0)}>{t('setlist.play')}</button>
            )}
            {!isLocal && setlist.visibility === 'public' && (
              <button className="btn btn-ghost btn-sm" onClick={copyShareLink}>{t('setlist.share')}</button>
            )}
            {isEditable && <button className="btn btn-danger btn-sm" onClick={deleteSetlist}>{t('admin.delete')}</button>}
          </div>
        </div>
        <div className="setlist-name-row">
          {!isEditable ? (
            <div className="setlist-name-input" style={{ border: 'none', background: 'none', padding: 0 }}>{setlist.name}</div>
          ) : (
            <input
              type="text"
              id="setlist-name-input"
              className="setlist-name-input"
              defaultValue={setlist.name}
              onBlur={saveMeta}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          )}
        </div>
        <div className="setlist-meta-row">
          {isLocal ? (
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Local Setlist (Saved in Browser)</span>
          ) : !isEditable ? (
            <>
              {setlist.username && <span style={{ fontSize: 13, color: 'var(--muted)' }}>By @{setlist.username}</span>}
              {setlist.event_date && <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>Date: {setlist.event_date}</span>}
            </>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <span className="toggle">
                  <input type="checkbox" id="setlist-visibility" defaultChecked={setlist.visibility === 'public'} onChange={saveMeta} />
                  <span className="toggle-slider" />
                </span>
                {t('setlist.visibility')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 12 }}>{t('setlist.date')}</span>
                <input type="date" id="setlist-date" defaultValue={setlist.event_date || ''} onChange={saveMeta} />
              </label>
            </>
          )}
        </div>
      </div>

      {setlist.entries.length === 0 ? (
        <EmptyState icon="&#127926;" text={t('setlist.noSongsYet')} />
      ) : (
        <div className="setlist-entries" id="setlist-entries">
          {setlist.entries.map((entry, idx) => {
            const keyDisplay = getSongKey(entry.content_override || entry.content, entry.transpose);
            return (
              <div key={entry.entry_id} className="song-card setlist-song-item" onClick={() => handleItemClick(idx)}>
                {isEditable && (
                  <div className="setlist-reorder" onClick={(e) => e.stopPropagation()}>
                    {idx > 0 ? (
                      <button className="setlist-arrow-btn" onClick={() => moveEntry(idx, -1)} title="Move up">&#9650;</button>
                    ) : <span className="setlist-arrow-btn disabled" />}
                    {idx < setlist.entries.length - 1 ? (
                      <button className="setlist-arrow-btn" onClick={() => moveEntry(idx, 1)} title="Move down">&#9660;</button>
                    ) : <span className="setlist-arrow-btn disabled" />}
                  </div>
                )}
                <div className="setlist-song-pos">{idx + 1}</div>
                <div className="song-card-info">
                  <div className="song-card-title">
                    {entry.title}
                    {entry.visibility === 'private' && <span className="badge badge-private" title="Private">&#128274;</span>}
                    {!isLocal && isEditable && entry.content_override && <span className="badge badge-edited">{t('setlist.edited')}</span>}
                  </div>
                  <div className="song-card-meta">
                    {entry.artist ? `${entry.artist} · ` : ''}{keyDisplay}
                  </div>
                </div>
                {isEditable && (
                  <div className="setlist-entry-controls" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleTransposeEntry(entry.entry_id, idx, -1)}>&#9837;</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleTransposeEntry(entry.entry_id, idx, 1)}>&#9839;</button>
                  </div>
                )}
                {isEditable && (
                  <button
                    className="setlist-remove-btn"
                    onClick={(e) => { e.stopPropagation(); removeEntry(entry.entry_id, idx); }}
                    title="Remove"
                  >
                    &#10005;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isEditable && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button className="btn" onClick={() => setPickerOpen(true)}>{t('setlist.addSongs')}</button>
        </div>
      )}

      {pickerOpen && <SongPicker onPick={addSong} onClose={() => setPickerOpen(false)} />}
    </>
  );
}
