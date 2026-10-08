import { Alert, Button, SimpleGrid, Group } from '@mantine/core';
import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconPlus, IconGuitarPick } from '@tabler/icons-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../context/I18nContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import type { SongListItem } from '../types';
import { useSearchSessionValue, searchPage } from '../hooks/useSearchSessionValue';
import { PageTitle } from '../components/PageTitle';

interface MySongsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function MySongsView({ navigate }: MySongsViewProps) {
  const { t } = useI18n();
  const { readOnly } = useOffline();
  const { querySongs } = useLibraryRead();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [savedQuery, saveQuery] = useSearchSessionValue('cv_mysongs_query');
  const [query, setQuery] = useState(savedQuery);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedPage, savePage] = useSearchSessionValue('cv_mysongs_page', '1');
  const [page, setPage] = useState(() => searchPage(savedPage));
  const [totalPages, setTotalPages] = useState(1);

  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback((q = '', targetPage = 1) => {
    setLoadError('');
    querySongs({ q: q.trim(), own: true, page: targetPage })
      .then((data) => {
        if (!active.current) return;
        setSongs(data.songs);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setLoaded(true);
        saveQuery(q);
        savePage(String(data.page));
      })
      .catch((e) => { if (active.current) { setLoadError(e.message); setSongs([]); } });
  }, [querySongs, saveQuery, savePage]);

  useEffect(() => {
    load(query, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const handleClear = () => {
    setQuery('');
    load('', 1);
  };

  const doSearch = () => load(query, 1);

  const handlePageChange = (newPage: number) => {
    load(query, newPage);
    window.scrollTo(0, 0);
  };

  return (
    <>
      {loadError && <Alert color="red" mb="sm" role="alert">{loadError}</Alert>}
      <Group justify="space-between" mb="lg">
        <PageTitle className="view-title">{t('songs.mySongs')}</PageTitle>
      </Group>
      <SearchRow>
        <SearchField label={t('songs.searchPlaceholder')} value={query} onChange={setQuery} onSearch={doSearch} onClear={handleClear} />
        <Button variant="default" size="sm" onClick={doSearch}>{t('songs.search')}</Button>
        <Button size="sm" w={{ base: '100%', xs: 'auto' }} leftSection={<IconPlus size={16} aria-hidden />} disabled={readOnly} onClick={() => navigate('song-edit')}>{t('songs.newSong')}</Button>
      </SearchRow>
      <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
        {!loadError && loaded && songs.length === 0 ? (
          <EmptyState
            icon={<IconGuitarPick size={56} aria-hidden />}
            text={query ? t('songs.noMatches') : t('songs.noSongs')}
            action={!readOnly && !query ? { label: t('songs.addFirst'), onClick: () => navigate('song-edit') } : undefined}
          />
        ) : (
          songs.map((s) => (
            <SongCard
              key={s.id}
              song={s}
              isOwner
              onClick={() => navigate('song-view', { id: String(s.id) })}
              onEdit={readOnly ? undefined : () => navigate('song-edit', { id: String(s.id) })}
            />
          ))
        )}
      </SimpleGrid>
      <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </>
  );
}
