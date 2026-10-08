import { useI18n } from './context/I18nContext';
import { usePlaybackLayout } from './hooks/usePlaybackLayout';
import { Alert, Badge } from '@mantine/core';
import { useOffline } from './context/OfflineContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWindowEvent } from '@mantine/hooks';
import { useAuth } from './context/AuthContext';
import { useDemo } from './context/DemoContext';
import { Nav } from './components/Nav';
import { DemoBanner } from './components/DemoBanner';

import { BrowseView } from './views/BrowseView';
import { MySongsView } from './views/MySongsView';
import { SongView } from './views/SongView';
import { SongEditView } from './views/SongEditView';
import { CorrectionView } from './views/CorrectionView';
import { AuthView } from './views/AuthView';
import { SetlistsView } from './views/SetlistsView';
import { PublicSetlistsView } from './views/PublicSetlistsView';
import { SetlistEditView } from './views/SetlistEditView';
import { SetlistPlayView } from './views/SetlistPlayView';
import { AdminView } from './views/AdminView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';
import { api } from './lib/api';
import type { AuthConfig } from './types';

interface Route {
  view: string;
  params: Record<string, string>;
}

function parseHash(): Route {
  const hash = location.hash.slice(1); // remove #
  if (!hash) return { view: 'browse', params: {} };

  // #song/42
  const songMatch = hash.match(/^song\/(\d+)$/);
  if (songMatch) return { view: 'song-view', params: { id: songMatch[1] } };

  // #setlist/42/play or #setlist/local_123/play
  const playMatch = hash.match(/^setlist\/(local_\w+|\d+)\/play(?:\/(\d+))?$/);
  if (playMatch) {
    return {
      view: 'setlist-play',
      params: {
        id: playMatch[1],
        ...(playMatch[1].startsWith('local_') ? { local: '1' } : {}),
        ...(playMatch[2] ? { index: playMatch[2] } : {}),
      },
    };
  }

  // #setlist/42 or #setlist/local_123
  const setlistMatch = hash.match(/^setlist\/(local_\w+|\d+)$/);
  if (setlistMatch) {
    return {
      view: 'setlist-edit',
      params: {
        id: setlistMatch[1],
      },
    };
  }

  return { view: 'browse', params: {} };
}

export function App() {
  const { user } = useAuth();
  const { readOnly } = useOffline();
  const { setDemoMode } = useDemo();
  const locked = useRef(readOnly);
  useEffect(() => { locked.current = readOnly; }, [readOnly]);
  const listIdentity = user?.id ?? 'guest';
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    api<AuthConfig>('GET', '/api/auth/config').then((cfg) => {
      if (cfg.demoMode) setDemoMode(true);
    }).catch(() => {});
  }, [setDemoMode]);

  // Listen for hash changes
  useWindowEvent('hashchange', () => {
    const newRoute = parseHash();
    setRoute((prev) => {
      const isSameView = prev.view === newRoute.view;
      const isSameParams =
        Object.keys(prev.params).length === Object.keys(newRoute.params).length &&
        Object.keys(prev.params).every((k) => prev.params[k] === newRoute.params[k]);

      return isSameView && isSameParams ? prev : newRoute;
    });
  });

  const navigate = useCallback((view: string, params: Record<string, string> = {}) => {
    if ((navigator.onLine === false || locked.current) && ['song-edit', 'correction', 'admin', 'auth'].includes(view)) return;
    // Trigger animation
    setAnimClass('');
    requestAnimationFrame(() => {
      setRoute({ view, params });
      setAnimClass('view-enter');
    });

    // Update hash for deep-linkable views
    if (view === 'song-view' && params.id) location.hash = `#song/${params.id}`;
    else if (view === 'setlist-edit' && params.id) {
      location.hash = `#setlist/${params.id}`;
    }
    else if (view === 'setlist-play' && params.id) {
      let h = `#setlist/${params.id}/play`;
      if (params.index && params.index !== '0') h += `/${params.index}`;
      location.hash = h;
    }
    else if (['browse', 'my-songs', 'setlists', 'admin', 'settings', 'auth', 'about', 'public-setlists'].includes(view)) {
      // Use replaceState to clear hash without triggering hashchange (which would race with the rAF setRoute above)
      history.replaceState(null, '', location.pathname + location.search);
    }
  }, []);



  const renderView = () => {
    const { view, params } = route;

    switch (view) {
      case 'browse':
        return <BrowseView key={listIdentity} navigate={navigate} />;
      case 'my-songs':
        return user ? <MySongsView key={listIdentity} navigate={navigate} /> : <BrowseView key={listIdentity} navigate={navigate} />;
      case 'song-view':
        return params.id ? <SongView songId={parseInt(params.id)} navigate={navigate} /> : <BrowseView key={listIdentity} navigate={navigate} />;
      case 'song-edit':
        return <SongEditView songId={params.id ? parseInt(params.id) : undefined} navigate={navigate} />;
      case 'correction':
        return params.id ? <CorrectionView songId={parseInt(params.id)} navigate={navigate} /> : <BrowseView key={listIdentity} navigate={navigate} />;
      case 'auth':
        return <AuthView navigate={navigate} />;
      case 'setlists':
        return <SetlistsView key={listIdentity} navigate={navigate} />;
      case 'public-setlists':
        return <PublicSetlistsView key={listIdentity} navigate={navigate} />;
      case 'setlist-edit':
        return params.id ? (
          <SetlistEditView
            setlistId={params.id.startsWith('local_') ? params.id : parseInt(params.id)}
            navigate={navigate}
          />
        ) : <SetlistsView key={listIdentity} navigate={navigate} />;
      case 'setlist-play': {
        const initialIdx = params.index ? parseInt(params.index) : undefined;
        return params.id ? (
          <SetlistPlayView
            key={params.id}
            setlistId={params.id.startsWith('local_') ? params.id : parseInt(params.id)}
            isLocal={!!params.local || params.id.startsWith('local_')}
            initialIndex={initialIdx}
            navigate={navigate}
          />
        ) : <SetlistsView key={listIdentity} navigate={navigate} />;
      }
      case 'admin':
        return <AdminView navigate={navigate} />;
      case 'settings':
        return <SettingsView />;
      case 'about':
        return <AboutView navigate={navigate} />;
      default:
        return <BrowseView key={listIdentity} navigate={navigate} />;
    }
  };

  return (
    <>
      <DemoBanner />
      {route.view !== 'setlist-play' && <Nav view={route.view} navigate={navigate} />}
      <main key={listIdentity} id="app" className={animClass}>
        {readOnly && <OfflineStatus playback={route.view === 'setlist-play'} />}
        {renderView()}
      </main>
    </>
  );
}

function OfflineStatus({ playback }: { playback: boolean }) {
  const { state, usingDownload } = useOffline();
  const { t } = useI18n();
  const layout = usePlaybackLayout();
  if (playback) return <Badge pos="fixed" bottom={layout === 'desktop' ? 12 : 90} right={12} style={{ zIndex: 61, pointerEvents: 'none' }} role="status">{t('offline.playbackStatus', 'Offline library · viewing only')}</Badge>;
  return <Alert py="xs" mb="sm" role="status" title={usingDownload ? t('offline.downloaded', 'Downloaded library') : t('offline.disconnected', 'Offline')}>
    {t('offline.viewing', 'Viewing only.')} {state?.downloadedAt ? `${t('offline.updated', 'Last downloaded')} ${new Date(state.downloadedAt).toLocaleString()}.` : t('offline.onlyDownloaded', 'Only downloaded songs are available.')} {t('offline.connectToEdit', 'Connect to make changes.')}
  </Alert>;
}
