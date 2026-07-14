import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import type { SetlistListItem } from '../types';

interface AddToSetlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: number;
  songTitle: string;
  songArtist: string;
  songVisibility?: string;
  transpose: number;
  nashville: boolean;
}

export function AddToSetlistModal({
  isOpen,
  onClose,
  songId,
  songTitle,
  songArtist,
  songVisibility,
  transpose,
  nashville,
}: AddToSetlistModalProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const { setlists, addEntry: lsAddEntry, create: lsCreate } = useLocalSetlists();
  const [userSetlists, setUserSetlists] = useState<SetlistListItem[]>([]);

  const loadSetlists = useCallback(async () => {
    if (user) {
      try {
        const sls = await apiCall<SetlistListItem[]>('GET', '/api/setlists');
        setUserSetlists(sls);
      } catch { /* ignore */ }
    } else {
      const formatted = setlists.map((sl) => ({
        id: sl.id,
        name: sl.name,
        song_count: sl.entries.length,
        visibility: 'private',
        event_date: null,
      }));
      setUserSetlists(formatted);
    }
  }, [user, apiCall, setlists]);

  useEffect(() => {
    if (isOpen) {
      loadSetlists();
    }
  }, [isOpen, loadSetlists]);

  const addToExisting = async (targetId: number | string) => {
    const targetSetlist = userSetlists.find((sl) => sl.id === targetId);
    if (!user) {
      const added = lsAddEntry(String(targetId), {
        song_id: songId,
        title: songTitle,
        artist: songArtist,
        transpose,
        nashville: nashville ? 1 : 0,
      });
      if (added) {
        onClose();
        toast(t('setlist.songAdded'), 'success');
      } else {
        toast('Failed to add song', 'error');
      }
      return;
    }
    if (songVisibility === 'private' && targetSetlist?.visibility === 'public') {
      if (!confirm('This song is private. Other viewers of this public setlist will see it as "[Private Song]". Continue?')) return;
    }
    try {
      await apiCall('POST', `/api/setlists/${targetId}/songs`, {
        song_id: songId,
        transpose,
        nashville,
      });
      onClose();
      toast(t('setlist.songAdded'), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const createAndAdd = async () => {
    const name = prompt(t('setlist.enterName'));
    if (!name?.trim()) return;
    if (!user) {
      const sl = lsCreate(name.trim());
      if (!sl) {
        toast('Max 50 setlists', 'error');
        return;
      }
      lsAddEntry(sl.id, {
        song_id: songId,
        title: songTitle,
        artist: songArtist,
        transpose,
        nashville: nashville ? 1 : 0,
      });
      onClose();
      toast(t('setlist.songAdded'), 'success');
      return;
    }
    try {
      const result = await apiCall<{ id: number }>('POST', '/api/setlists', {
        name: name.trim(),
      });
      await apiCall('POST', `/api/setlists/${result.id}/songs`, {
        song_id: songId,
        transpose,
        nashville,
      });
      onClose();
      toast(t('setlist.songAdded'), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      data-overlay
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="setlist-add-content">
        <div className="view-header">
          <h3 className="view-title">{t('setlist.addToSetlist')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            &#10005;
          </button>
        </div>
        <div className="song-grid">
          <div className="song-card" onClick={createAndAdd}>
            <div className="song-card-info">
              <div className="song-card-title">{t('setlist.newSetlist')}</div>
            </div>
          </div>
          {userSetlists.map((sl) => (
            <div key={sl.id} className="song-card" onClick={() => addToExisting(sl.id)}>
              <div className="song-card-info">
                <div className="song-card-title">{sl.name}</div>
                <div className="song-card-meta">
                  {sl.song_count} {sl.song_count !== 1 ? t('admin.songPlural') : t('admin.song')}
                </div>
                {sl.visibility === 'public' && (
                  <span className="badge badge-tag" style={{ fontSize: 10 }}>
                    Public
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
