import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { IconMusic } from '@tabler/icons-react';
import { Switch, Button, TextInput, Group, Box } from '@mantine/core';
import { useCopyNotification } from '../hooks/useCopyNotification';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { ApiError } from '../lib/api';
import { stepKey } from '../lib/keys';
import { getSongKey } from '../lib/chords';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { formatLocalEntry } from '../lib/setlists';
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
  const { getSetlist } = useLibraryRead();
  const { readOnly } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const copyWithFeedback = useCopyNotification(t('setlist.linkCopied') || 'Link copied to clipboard');
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
  const metadata = useForm({ initialValues: { name: '', visibility: false, event_date: '' } });
  const { setValues: setMetadata } = metadata;

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
      setMetadata({ name: formatted.name, visibility: false, event_date: '' });
      setSetlist(formatted);
      location.hash = `#setlist/${setlistId}`;
      return;
    }

    try {
      let sl: Setlist;
      if (user) {
        try {
          sl = await getSetlist(Number(setlistId));
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
            sl = await getSetlist(Number(setlistId), true);
          } else {
            throw err;
          }
        }
      } else {
        sl = await getSetlist(Number(setlistId), true);
      }
      setMetadata({ name: sl.name, visibility: sl.visibility === 'public', event_date: sl.event_date || '' });
      setSetlist(sl);
      location.hash = `#setlist/${setlistId}`;
    } catch (e) {
      toast((e as Error).message, 'error');
      navigate(user ? 'setlists' : 'public-setlists');
    }
  }, [getSetlist, navigate, setlistId, user, isLocal, getOne, setMetadata]);

  useEffect(() => { load(); }, [load]);

  const {
    items: reorderedEntries,
    dragProps,
    handleProps,
    draggedIdx,
  } = useDragReorder(
    setlist?.entries || [],
    async (newEntries) => {
      if (readOnly || navigator.onLine === false || !setlist) return;

      // Update React state first
      setSetlist((prev) => prev ? { ...prev, entries: newEntries } : null);

      if (isLocal) {
        // A reorder changes order only. useDragReorder permutes the very
        // objects it was given, so their positions in the pre-drag list are the
        // permutation to apply to the stored records — which are then written
        // back untouched, keeping fields this view never loads.
        const saved = lsReorderEntries(String(setlistId), newEntries.map((e) => setlist.entries.indexOf(e)));
        if (!saved) {
          toast(t('setlist.reorderFailed'), 'error');
          load();
        }
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

  const saveMeta = async (values = metadata.values) => {
    if (readOnly || navigator.onLine === false || !setlist) return;
    const nameInput = values.name.trim();
    if (!nameInput) return;

    if (isLocal) {
      if (nameInput.length > 200) return;
      rename(String(setlistId), nameInput);
      setSetlist((prev) => prev ? { ...prev, name: nameInput } : prev);
    } else {
      const vis = values.visibility ? 'public' : 'private';
      const date = values.event_date;
      try {
        await apiCall('PUT', `/api/setlists/${setlistId}`, { name: nameInput, visibility: vis, event_date: date });
        setSetlist((prev) => prev ? { ...prev, name: nameInput, visibility: vis, event_date: date } : prev);
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const deleteSetlist = async () => {
    if (readOnly || navigator.onLine === false) return;
    modals.openConfirmModal({ children: t('setlist.confirmDelete'), labels: { confirm: 'Confirm', cancel: 'Cancel' }, onConfirm: async () => {

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

} });
};

  // Reordering is handled by useDragReorder hook

  const removeEntry = async (entryId: number | string, idx: number) => {
    if (readOnly || navigator.onLine === false) return;
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
    if (readOnly || navigator.onLine === false) return;
    if (isLocal) {
      const added = lsAddEntry(String(setlistId), {
        song_id: song.id,
        title: song.title,
        artist: song.artist || '',
        target_key: null,
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

  const handleStepEntryKey = async (entryId: number | string, idx: number, direction: 1 | -1) => {
    if (readOnly || navigator.onLine === false || !setlist) return;
    const entry = reorderedEntries[idx];
    const content = entry.content_override || entry.content;
    const current = entry.target_key || getSongKey(content, 0);
    if (!current) return;
    const newKey = stepKey(current, direction);

    if (isLocal) {
      lsUpdateEntry(String(setlistId), idx, { target_key: newKey });
      setSetlist((prev) => {
        if (!prev) return null;
        const entries = [...prev.entries];
        entries[idx] = { ...entries[idx], target_key: newKey };
        return { ...prev, entries };
      });
    } else {
      try {
        await apiCall('PUT', `/api/setlists/${setlistId}/entries/${entryId}`, { target_key: newKey });
        setSetlist((prev) => {
          if (!prev) return null;
          const entries = [...prev.entries];
          entries[idx] = { ...entries[idx], target_key: newKey };
          return { ...prev, entries };
        });
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
  };

  const playLocal = (startIndex = 0) => {
    const sl = getOne(String(setlistId));
    if (!sl?.entries.length) return;
    navigate('setlist-play', { id: String(setlistId), local: '1', index: String(startIndex) });
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
    copyWithFeedback(url);
  };

  const isEditable = !readOnly && (isLocal || (setlist?.user_id != null && user != null && setlist.user_id === user.id));

  if (!setlist) return <Loading />;

  return (
    <>
      <Box mb="lg">
        <Group justify="space-between" mb="md">
          <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => navigate(isEditable ? 'setlists' : 'public-setlists')}>&#8592; {t('songView.back')}</Button>
          <Group gap="xs">
            {setlist.entries.length > 0 && (
              <Button size="xs" className="btn btn-sm" onClick={() => handleItemClick(0)}>{t('setlist.play')}</Button>
            )}
            {!isLocal && setlist.visibility === 'public' && (
              <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={copyShareLink}>{t('setlist.share')}</Button>
            )}
            {isEditable && <Button color="red" size="xs" className="btn btn-danger btn-sm" onClick={deleteSetlist}>{t('admin.delete')}</Button>}
          </Group>
        </Group>
        <div className="setlist-name-row">
          {!isEditable ? (
            <div className="setlist-name-input" style={{ border: 'none', background: 'none', padding: 0 }}>{setlist.name}</div>
          ) : (
            <TextInput
              type="text"
              id="setlist-name-input"
              className="setlist-name-input"
              {...metadata.getInputProps('name')}
              onBlur={() => saveMeta()}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          )}
        </div>
        <Group gap={16} mt={12} py={8}>
          {isLocal ? (
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Local Setlist (Saved in Browser)</span>
          ) : !isEditable ? (
            <>
              {setlist.username && <span style={{ fontSize: 13, color: 'var(--muted)' }}>By @{setlist.username}</span>}
              {setlist.event_date && <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>Date: {setlist.event_date}</span>}
            </>
          ) : (
            <>
              <Switch label={t('setlist.visibility')} type="checkbox" id="setlist-visibility" checked={metadata.values.visibility} onChange={(event) => { metadata.setFieldValue('visibility', event.currentTarget.checked); void saveMeta({ ...metadata.values, visibility: event.currentTarget.checked }); }}  />
              <TextInput aria-label={t('setlist.date')} type="date" id="setlist-date" value={metadata.values.event_date} onChange={(event) => { metadata.setFieldValue('event_date', event.currentTarget.value); void saveMeta({ ...metadata.values, event_date: event.currentTarget.value }); }} />
            </>
          )}
        </Group>
      </Box>

      {setlist.entries.length === 0 ? (
        <EmptyState icon={<IconMusic size={56} aria-hidden />} text={t('setlist.noSongsYet')} />
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
              onStepKey={handleStepEntryKey}
              onClick={handleItemClick}
              dragProps={isEditable ? dragProps(idx) : undefined}
              handleProps={isEditable ? handleProps(idx) : undefined}
              isDragging={draggedIdx === idx}
              t={t}
            />
          ))}
        </div>
      )}

      {isEditable && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Button className="btn" onClick={() => setPickerOpen(true)}>{t('setlist.addSongs')}</Button>
        </div>
      )}

      <SongPicker opened={pickerOpen} onPick={addSong} onClose={() => setPickerOpen(false)} />
    </>
  );
}
