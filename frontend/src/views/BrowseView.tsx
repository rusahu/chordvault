import { Alert, ActionIcon, Button, NativeSelect, SimpleGrid, Box, Title, Text, Group } from '@mantine/core';
import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconAdjustmentsHorizontal, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import type { SongListItem } from '../types';
import { LANGUAGES } from '../lib/languages';
import { useSearchSessionValue, searchPage } from '../hooks/useSearchSessionValue';

interface BrowseViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function BrowseView({ navigate }: BrowseViewProps) {
  const { querySongs } = useLibraryRead();
  const { readOnly } = useOffline();
  const { user } = useAuth();
  const { t } = useI18n();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [savedQuery, saveQuery] = useSearchSessionValue('cv_browse_query');
  const [query, setQuery] = useState(savedQuery);
  const [savedLangFilter, saveLangFilter] = useSearchSessionValue('cv_browse_lang');
  const [langFilter, setLangFilter] = useState(savedLangFilter);
  const [savedShowFilters, saveShowFilters] = useSearchSessionValue('cv_browse_show_filters', 'false');
  const showFilters = savedShowFilters === 'true';
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedPage, savePage] = useSearchSessionValue('cv_browse_page', '1');
  const [page, setPage] = useState(() => searchPage(savedPage));
  const [totalPages, setTotalPages] = useState(1);

  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback(async (q = '', lang = '', targetPage = 1) => {
    setLoadError('');
    try {
      const data = await querySongs({ q, language: lang, page: targetPage });
      if (!active.current) return;
      setSongs(data.songs);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoaded(true);

      saveQuery(q);
      saveLangFilter(lang);
      savePage(String(data.page));
    } catch (e) { if (active.current) { setLoadError((e as Error).message); setSongs([]); } }
  }, [querySongs, saveQuery, saveLangFilter, savePage]);

  useEffect(() => {
    load(query, langFilter, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const handleClear = () => {
    setQuery('');
    load('', langFilter, 1);
  };

  const doSearch = () => load(query, langFilter, 1);

  const handlePageChange = (newPage: number) => {
    load(query, langFilter, newPage);
    window.scrollTo(0, 0);
  };

  const showHero = !user && !query && !langFilter && !loadError && loaded && songs.length === 0 && page === 1;

  return (
    <>
      {loadError && <Alert color="red" mb="sm" role="alert">{loadError}</Alert>}
      {showHero ? (
        <Box ta="center" px="md" pt={48} pb={36} mb="xs">
          <Title order={1} size={42} c="var(--cv-brand)" mb="xs">&#9833; ChordVault</Title>
          <Text size="lg" mb={6}>{t('hero.tagline')}</Text>
          <Text size="sm" c="dimmed" maw={360} mx="auto">{t('hero.cta')}</Text>
          <Group mt="md" gap="sm" justify="center">
            <Button className="btn" onClick={() => navigate('auth')}>{t('auth.signIn')}</Button>
            <Button variant="default" className="btn btn-ghost" onClick={() => navigate('about')}>Learn more</Button>
          </Group>
        </Box>
      ) : (
        <>
          <SearchRow>
            <SearchField label={t('songs.searchPlaceholder')} value={query} onChange={setQuery} onSearch={doSearch} onClear={handleClear} />
            <Button variant="default" size="sm" onClick={doSearch}>{t('songs.search')}</Button>
            <ActionIcon
              size="input-sm"
              variant={showFilters || langFilter ? 'filled' : 'default'}
              aria-label="Filters"
              aria-pressed={showFilters}
              title="Filters"
              onClick={() => {
                const next = !showFilters;
                saveShowFilters(String(next));
              }}
            >
              <IconAdjustmentsHorizontal size={18} aria-hidden />
            </ActionIcon>
            {user && (
              <Button size="sm" w={{ base: '100%', xs: 'auto' }} leftSection={<IconPlus size={16} aria-hidden />} disabled={readOnly} onClick={() => navigate('song-edit')}>New Song</Button>
            )}
          </SearchRow>
          {showFilters && (
            <div className="search-filters">
              <NativeSelect
                className="language-filter"
                value={langFilter}
                onChange={(e) => { setLangFilter(e.target.value); load(query, e.target.value, 1); }}
              >
                <option value="">All languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </NativeSelect>
            </div>
          )}
          <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
            {!loadError && loaded && songs.length === 0 ? (
              <EmptyState icon={<IconSearch size={56} aria-hidden />} text={t('songs.noPublicSongs')} />
            ) : (
              songs.map((s) => (
                <SongCard
                  key={s.id}
                  song={s}
                  isOwner={user?.username === s.username}
                  onClick={() => navigate('song-view', { id: String(s.id) })}
                  onEdit={readOnly ? undefined : () => navigate('song-edit', { id: String(s.id) })}
                />
              ))
            )}
          </SimpleGrid>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  );
}
