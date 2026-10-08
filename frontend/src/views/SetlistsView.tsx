import { Alert, Tabs, Button, TextInput, ActionIcon, SimpleGrid, Group } from '@mantine/core';
import { useLibraryRead } from '../hooks/useLibraryRead';
import { useOffline } from '../context/OfflineContext';
import { SearchField } from '../components/SearchField';
import { SearchRow } from '../components/SearchRow';
import { IconCalendar, IconPlus, IconMusic } from '@tabler/icons-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import type { SetlistListItem } from '../types';
import { useSearchSessionValue, searchPage } from '../hooks/useSearchSessionValue';
import { PageTitle } from '../components/PageTitle';

interface SetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
  initialTab?: string;
}

export function SetlistsView({ navigate }: SetlistsViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const { readOnly } = useOffline();
  const { querySetlists } = useLibraryRead();
  const ls = useLocalSetlists();

  const activeTab = user ? 'cloud' : 'local';

  const [setlists, setSetlists] = useState<SetlistListItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [savedQuery, saveQuery] = useSearchSessionValue('cv_setlists_query');
  const [query, setQuery] = useState(savedQuery);
  const [savedDateFrom, saveDateFrom] = useSearchSessionValue('cv_setlists_date_from');
  const [dateFrom, setDateFrom] = useState(savedDateFrom);
  const [savedDateTo, saveDateTo] = useSearchSessionValue('cv_setlists_date_to');
  const [dateTo, setDateTo] = useState(savedDateTo);
  const [savedShowDates, saveShowDates] = useSearchSessionValue('cv_setlists_show_dates', 'false');
  const showDates = savedShowDates === 'true';
  const [savedPage, savePage] = useSearchSessionValue('cv_setlists_page', '1');
  const [page, setPage] = useState(() => searchPage(savedPage));
  const [totalPages, setTotalPages] = useState(1);
  const nameRef = useRef<HTMLInputElement>(null);

  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback(async (q = '', from = '', to = '', targetPage = 1) => {
    setLoadError('');
    if (!user) return;
    try {
      const data = await querySetlists({ q, dateFrom: from, dateTo: to, page: targetPage });
      if (!active.current) return;
      setSetlists(data.setlists);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoaded(true);

      saveQuery(q);
      saveDateFrom(from);
      saveDateTo(to);
      savePage(String(data.page));
    } catch (e) { if (active.current) { setLoadError((e as Error).message); setSetlists([]); } }
  }, [querySetlists, user, saveQuery, saveDateFrom, saveDateTo, savePage]);

  useEffect(() => {
    if (activeTab === 'cloud') {
      load(query, dateFrom, dateTo, page);
    } else {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, activeTab]);

  useEffect(() => { if (showNew && nameRef.current) nameRef.current.focus(); }, [showNew]);

  const create = async () => {
    if (readOnly) return;
    if (!newName.trim()) { toast(t('setlist.nameRequired'), 'error'); return; }
    if (newName.length > 200) { toast('Name too long', 'error'); return; }

    if (activeTab === 'local') {
      const sl = ls.create(newName.trim());
      if (!sl) { toast('Max 50 setlists', 'error'); return; }
      toast(t('setlist.created'), 'success');
      navigate('setlist-edit', { id: sl.id });
    } else {
      try {
        const result = await apiCall<{ id: number }>('POST', '/api/setlists', { name: newName.trim() });
        toast(t('setlist.created'), 'success');
        navigate('setlist-edit', { id: String(result.id) });
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const handleClear = () => {
    setQuery('');
    if (activeTab === 'local') {
      saveQuery('');
    } else {
      load('', dateFrom, dateTo, 1);
    }
  };

  const handleSearch = () => {
    if (activeTab === 'cloud') {
      load(query, dateFrom, dateTo, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (activeTab === 'cloud') {
      load(query, dateFrom, dateTo, newPage);
      window.scrollTo(0, 0);
    }
  };

  const localSetlistsToRender = query.trim()
    ? ls.setlists.filter(sl => sl.name.toLowerCase().includes(query.toLowerCase()))
    : ls.setlists;

  return (
    <>
      {loadError && <Alert color="red" mb="sm" role="alert">{loadError}</Alert>}
      <Group justify="space-between" mb="lg">
        <PageTitle className="view-title">{t('setlist.title')}</PageTitle>
        <Button disabled={readOnly} size="xs" className="btn btn-sm" leftSection={<IconPlus size={14} aria-hidden />} onClick={() => setShowNew(true)}>{t('setlist.newSetlist')}</Button>
      </Group>
      <Tabs variant="pills" value="mine" onChange={(tab) => navigate(tab === 'public' ? 'public-setlists' : 'setlists')} className="setlist-tabs">
        <Tabs.List grow><Tabs.Tab value="mine">My Setlists</Tabs.Tab><Tabs.Tab value="public">Public Setlists</Tabs.Tab></Tabs.List>
      </Tabs>
      {!user && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          These setlists are saved in your browser. Sign in to create server-synced setlists.
        </p>
      )}
      {showNew && (
        <SearchRow mb={16}>
          <TextInput aria-label={t('setlist.namePlaceholder')}
            flex={3}
            miw={0}
            ref={nameRef}
            type="text"
            placeholder={t('setlist.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          />
          <Button size="xs" className="btn btn-sm" onClick={create}>{t('setlist.create')}</Button>
          <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>{t('songEdit.cancel')}</Button>
        </SearchRow>
      )}
      <SearchRow>
        <SearchField label={t('setlist.searchPlaceholder')} value={query} onSearch={handleSearch} onClear={handleClear}

          onChange={(val) => {

            setQuery(val);

            if (activeTab === 'local') saveQuery(val);

          }} />
        <Button variant="default" size="sm" onClick={handleSearch}>{t('songs.search')}</Button>
        {activeTab === 'cloud' && (
          <ActionIcon
            size="input-sm"
            variant={showDates ? 'filled' : 'default'}
            aria-label="Filter by date"
            aria-pressed={showDates}
            title="Filter by date"
            onClick={() => {
              const next = !showDates;
              saveShowDates(String(next));
            }}
          >
            <IconCalendar size={18} aria-hidden />
          </ActionIcon>
        )}
      </SearchRow>
      {activeTab === 'cloud' && showDates && (
        <SearchRow mt={-10}>
          <TextInput label={<>From</>} type="date" flex={1} miw={0} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <TextInput label={<>To</>} type="date" flex={1} miw={0} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </SearchRow>
      )}
      <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
        {!loadError && loaded && (
          activeTab === 'cloud' ? (
            setlists.length === 0 ? (
              <EmptyState icon={<IconMusic size={56} aria-hidden />} text={t('setlist.noSetlists')} />
            ) : (
              setlists.map((sl) => (
                <SetlistCard
                  key={sl.id}
                  setlist={sl}
                  onClick={() => navigate('setlist-edit', { id: String(sl.id) })}
                  onPlay={() => navigate('setlist-play', { id: String(sl.id) })}
                />
              ))
            )
          ) : (
            localSetlistsToRender.length === 0 ? (
              <EmptyState icon={<IconMusic size={56} aria-hidden />} text={t('setlist.noSetlists')} />
            ) : (
              localSetlistsToRender.map((sl) => (
                <SetlistCard
                  key={sl.id}
                  setlist={{
                    id: sl.id,
                    name: sl.name,
                    visibility: 'private',
                    song_count: sl.entries.length,
                    event_date: null,
                  }}
                  onClick={() => navigate('setlist-edit', { id: sl.id })}
                  onPlay={() => navigate('setlist-play', { id: sl.id, local: '1' })}
                />
              ))
            )
          )
        )}
      </SimpleGrid>
      {activeTab === 'cloud' && (
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </>
  );
}
