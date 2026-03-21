import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { SongPicker } from '../components/SongPicker';
import { EmptyState } from '../components/EmptyState';
import type { LocalSetlist, SongListItem, Setlist } from '../types';

interface LocalSetlistEditViewProps {
  setlistId: string;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function LocalSetlistEditView({ setlistId, navigate }: LocalSetlistEditViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const ls = useLocalSetlists();
  const [setlist, setSetlist] = useState<LocalSetlist | undefined>(ls.getOne(setlistId));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const sl = ls.getOne(setlistId);
    if (!sl) { navigate('local-setlists'); return; }
    setSetlist(sl);
  }, [setlistId, ls.setlists]);

  if (!setlist) return null;

  const refresh = () => setSetlist(ls.getOne(setlistId));

  const renameSetlist = (name: string) => {
    if (!name.trim() || name.length > 200) return;
    ls.rename(setlistId, name.trim());
  };

  const deleteSetlist = () => {
    if (!confirm(t('setlist.confirmDelete'))) return;
    ls.remove(setlistId);
    toast(t('setlist.deleted'), 'success');
    navigate('local-setlists');
  };

  const addSong = (song: SongListItem) => {
    ls.addEntry(setlistId, { song_id: song.id, title: song.title, artist: song.artist || '', transpose: 0, nashville: 0 });
    toast(t('setlist.songAdded'), 'success');
    setPickerOpen(false);
  };

  const playLocal = async () => {
    const sl = ls.getOne(setlistId);
    if (!sl || sl.entries.length === 0) return;
    try {
      const fetches = sl.entries.map((e) => apiCall<any>('GET', `/api/songs/${e.song_id}`).catch(() => null));
      const results = await Promise.all(fetches);
      const entries = results.map((song, i) => {
        if (!song) return null;
        const e = sl.entries[i];
        return {
          song_id: song.id, entry_id: `local_${i}`, title: song.title, artist: song.artist || '',
          content: song.content, content_override: null, transpose: e.transpose || 0, nashville: e.nashville || 0,
          bpm: song.bpm || null, youtube_url: song.youtube_url || null,
        };
      }).filter(Boolean);
      if (entries.length === 0) { toast('No songs could be loaded', 'error'); return; }
      const enrichedSetlist: Setlist = { id: setlistId, name: sl.name, entries: entries as any, isLocal: true, visibility: 'private', event_date: null };
      navigate('setlist-play', { id: setlistId, local: '1', _setlist: JSON.stringify(enrichedSetlist) });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <div className="song-view-header">
        <div className="song-view-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('local-setlists')}>&#8592; {t('songView.back')}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {setlist.entries.length > 0 && <button className="btn btn-sm" onClick={playLocal}>{t('setlist.play')}</button>}
            <button className="btn btn-danger btn-sm" onClick={deleteSetlist}>{t('admin.delete')}</button>
          </div>
        </div>
        <div className="setlist-name-row">
          <input
            type="text"
            className="setlist-name-input"
            defaultValue={setlist.name}
            onBlur={(e) => renameSetlist(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        </div>
      </div>

      {setlist.entries.length === 0 ? (
        <EmptyState icon="&#127926;" text={t('setlist.noSongsYet')} />
      ) : (
        <div className="song-grid">
          {setlist.entries.map((entry, idx) => (
            <div key={idx} className="song-card setlist-song-item">
              <div className="setlist-song-pos">{idx + 1}</div>
              <div className="song-card-info" onClick={() => navigate('song-view', { id: String(entry.song_id) })}>
                <div className="song-card-title">
                  {entry.title}
                  {entry.nashville ? <span className="badge badge-nashville">#</span> : null}
                </div>
                <div className="song-card-meta">{entry.artist || ''}</div>
              </div>
              <div className="song-card-actions setlist-entry-actions">
                <div className="setlist-reorder">
                  {idx > 0 ? (
                    <button className="btn btn-ghost btn-sm setlist-arrow" onClick={(e) => { e.stopPropagation(); ls.moveEntry(setlistId, idx, -1); }} title="Move up">&#9650;</button>
                  ) : <span className="setlist-arrow-placeholder" />}
                  {idx < setlist.entries.length - 1 ? (
                    <button className="btn btn-ghost btn-sm setlist-arrow" onClick={(e) => { e.stopPropagation(); ls.moveEntry(setlistId, idx, 1); }} title="Move down">&#9660;</button>
                  ) : <span className="setlist-arrow-placeholder" />}
                </div>
                <div className="setlist-entry-controls">
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); ls.updateEntry(setlistId, idx, { transpose: entry.transpose - 1 }); }}>&#9837;</button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); ls.updateEntry(setlistId, idx, { transpose: entry.transpose + 1 }); }}>&#9839;</button>
                  <button className={`btn btn-ghost btn-sm${entry.nashville ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); ls.updateEntry(setlistId, idx, { nashville: entry.nashville ? 0 : 1 }); }}>{t('songView.nashville')}</button>
                </div>
                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); ls.removeEntry(setlistId, idx); toast(t('setlist.songRemoved'), 'success'); }}>&#10005;</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn" onClick={() => setPickerOpen(true)}>{t('setlist.addSongs')}</button>
      </div>

      {pickerOpen && <SongPicker onPick={addSong} onClose={() => setPickerOpen(false)} />}
    </>
  );
}
