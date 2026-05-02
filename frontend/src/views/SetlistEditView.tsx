import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SongPicker } from '../components/SongPicker';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { getSongKey } from '../lib/chords';
import type { Setlist, SongListItem } from '../types';

interface SetlistEditViewProps {
  setlistId: number;
  isPublic?: boolean;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistEditView({ setlistId, isPublic, navigate }: SetlistEditViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const endpoint = isPublic ? `/api/setlists/public/${setlistId}` : `/api/setlists/${setlistId}`;
      const sl = await apiCall<Setlist>('GET', endpoint);
      setSetlist(sl);
      location.hash = isPublic ? `#setlist/${setlistId}/public` : `#setlist/${setlistId}`;
    } catch (e) {
      toast((e as Error).message, 'error');
      navigate(isPublic ? 'public-setlists' : 'setlists');
    }
  }, [apiCall, toast, navigate, setlistId, isPublic]);

  useEffect(() => { load(); }, [load]);

  const saveMeta = async () => {
    if (!setlist) return;
    const nameInput = (document.getElementById('setlist-name-input') as HTMLInputElement)?.value.trim();
    if (!nameInput) return;
    const vis = (document.getElementById('setlist-visibility') as HTMLInputElement)?.checked ? 'public' : 'private';
    const date = (document.getElementById('setlist-date') as HTMLInputElement)?.value || '';
    try {
      await apiCall('PUT', `/api/setlists/${setlistId}`, { name: nameInput, visibility: vis, event_date: date });
      setSetlist((prev) => prev ? { ...prev, name: nameInput, visibility: vis, event_date: date } : prev);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const deleteSetlist = async () => {
    if (!confirm(t('setlist.confirmDelete'))) return;
    try {
      await apiCall('DELETE', `/api/setlists/${setlistId}`);
      toast(t('setlist.deleted'), 'success');
      location.hash = '';
      navigate('setlists');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const moveEntry = async (idx: number, dir: number) => {
    if (!setlist) return;
    const entries = [...setlist.entries];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= entries.length) return;
    [entries[idx], entries[newIdx]] = [entries[newIdx], entries[idx]];
    setSetlist({ ...setlist, entries });
    try {
      await apiCall('PUT', `/api/setlists/${setlistId}/reorder`, { entry_ids: entries.map((e) => e.entry_id) });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const removeEntry = async (entryId: number | string) => {
    try {
      await apiCall('DELETE', `/api/setlists/${setlistId}/entries/${entryId}`);
      setSetlist((prev) => prev ? { ...prev, entries: prev.entries.filter((e) => e.entry_id !== entryId) } : prev);
      toast(t('setlist.songRemoved'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const addSong = async (song: SongListItem) => {
    try {
      await apiCall('POST', `/api/setlists/${setlistId}/songs`, { song_id: song.id });
      toast(t('setlist.songAdded'), 'success');
      setPickerOpen(false);
      load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  if (!setlist) return <Loading />;

  return (
    <>
      <div className="song-view-header">
        <div className="song-view-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(isPublic ? 'public-setlists' : 'setlists')}>&#8592; {t('songView.back')}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {setlist.entries.length > 0 && (
              <button className="btn btn-sm" onClick={() => navigate('setlist-play', { id: String(setlistId), ...(isPublic ? { public: '1' } : {}) })}>{t('setlist.play')}</button>
            )}
            {!isPublic && <button className="btn btn-danger btn-sm" onClick={deleteSetlist}>{t('admin.delete')}</button>}
          </div>
        </div>
        <div className="setlist-name-row">
          {isPublic ? (
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
          {isPublic ? (
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
              <div key={entry.entry_id} className="song-card setlist-song-item" onClick={() => navigate('setlist-play', { id: String(setlistId), index: String(idx), ...(isPublic ? { public: '1' } : {}) })}>
                {!isPublic && (
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
                    {!isPublic && entry.content_override && <span className="badge badge-edited">{t('setlist.edited')}</span>}
                  </div>
                  <div className="song-card-meta">
                    {entry.artist ? `${entry.artist} · ` : ''}{keyDisplay}
                  </div>
                </div>
                {!isPublic && (
                  <button
                    className="setlist-remove-btn"
                    onClick={(e) => { e.stopPropagation(); removeEntry(entry.entry_id); }}
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

      {!isPublic && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button className="btn" onClick={() => setPickerOpen(true)}>{t('setlist.addSongs')}</button>
        </div>
      )}

      {pickerOpen && <SongPicker onPick={addSong} onClose={() => setPickerOpen(false)} />}
    </>
  );
}
