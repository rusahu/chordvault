import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { formatLocalEntry, enrichLocalSetlistSongs } from '../lib/setlists';
import { SongPicker } from '../components/SongPicker';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { SetlistEntryCard } from '../components/SetlistEntryCard';
import type { Setlist, SongListItem } from '../types';
import { useDragReorder } from '../hooks/useDragReorder';

interface SetlistEditViewProps {
  setlistId: number | string;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistEditView({ setlistId, navigate }: SetlistEditViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const {
    getOne,
    rename,
    remove,
    removeEntry: lsRemoveEntry,
    addEntry: lsAddEntry,
    updateEntry: lsUpdateEntry,
    reorderEntries: lsReorderEntries,
  } = useLocalSetlists();
  
  const isLocal = typeof setlistId === 'string' && setlistId.startsWith('local_');
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (isLocal) {
      const sl = getOne(String(setlistId));
      if (!sl) { navigate(user ? 'setlists' : 'public-setlists'); return; }
      
      const formatted: Setlist = {
        id: sl.id,
        name: sl.name,
        entries: sl.entries.map((e, idx) => formatLocalEntry(e, idx)),
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
  }, [apiCall, toast, navigate, setlistId, user, isLocal, getOne]);

  useEffect(() => { load(); }, [load]);

  const {
    items: reorderedEntries,
    dragProps,
    handleProps,
    draggedIdx,
  } = useDragReorder(
    setlist?.entries || [],
    async (newEntries) => {
      if (!setlist) return;

      // Update React state first
      setSetlist((prev) => prev ? { ...prev, entries: newEntries } : null);

      if (isLocal) {
        const localEntries = newEntries.map((e) => ({
          song_id: e.song_id,
          title: e.title,
          artist: e.artist,
          transpose: e.transpose,
          nashville: e.nashville,
        }));
        lsReorderEntries(String(setlistId), localEntries);
      } else {
        try {
          await apiCall('PUT', `/api/setlists/${setlistId}/reorder`, {
            entry_ids: newEntries.map((e) => e.entry_id),
          });
        } catch (e) {
          toast((e as Error).message, 'error');
          load();
        }
      }
    }
  );

  const saveMeta = async () => {
    if (!setlist) return;
    const nameInput = (document.getElementById('setlist-name-input') as HTMLInputElement)?.value.trim();
    if (!nameInput) return;

    if (isLocal) {
      if (nameInput.length > 200) return;
      rename(String(setlistId), nameInput);
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
      remove(String(setlistId));
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

  // Reordering is handled by useDragReorder hook

  const removeEntry = async (entryId: number | string, idx: number) => {
    if (isLocal) {
      lsRemoveEntry(String(setlistId), idx);
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
      const added = lsAddEntry(String(setlistId), {
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
    const entry = reorderedEntries[idx];
    const newTranspose = (entry.transpose ?? 0) + delta;

    if (isLocal) {
      lsUpdateEntry(String(setlistId), idx, { transpose: newTranspose });
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
    const sl = getOne(String(setlistId));
    if (!sl || sl.entries.length === 0) return;
    try {
      const entries = await enrichLocalSetlistSongs(sl.entries, apiCall);
      if (entries.length === 0) { toast('No songs could be loaded', 'error'); return; }
      const enrichedSetlist: Setlist = {
        id: String(setlistId),
        name: sl.name,
        entries,
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
          {reorderedEntries.map((entry, idx) => (
            <SetlistEntryCard
              key={entry.entry_id}
              entry={entry}
              idx={idx}
              isEditable={isEditable}
              isLocal={isLocal}
              onRemove={removeEntry}
              onTranspose={handleTransposeEntry}
              onClick={handleItemClick}
              dragProps={dragProps(idx)}
              handleProps={handleProps(idx)}
              isDragging={draggedIdx === idx}
              t={t}
            />
          ))}
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
