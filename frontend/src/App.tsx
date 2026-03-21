import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { Nav } from './components/Nav';
import { Toast } from './components/Toast';
import { Loading } from './components/Loading';
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
import { LocalSetlistsView } from './views/LocalSetlistsView';
import { LocalSetlistEditView } from './views/LocalSetlistEditView';
import { AdminView } from './views/AdminView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';
import type { Setlist } from './types';

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

  // #setlist/42/play or #setlist/42/play/public
  const playMatch = hash.match(/^setlist\/(\d+)\/play(\/public)?$/);
  if (playMatch) return { view: 'setlist-play', params: { id: playMatch[1], ...(playMatch[2] ? { public: '1' } : {}) } };

  // #setlist/42
  const setlistMatch = hash.match(/^setlist\/(\d+)$/);
  if (setlistMatch) return { view: 'setlist-edit', params: { id: setlistMatch[1] } };

  return { view: 'browse', params: {} };
}

export function App() {
  const { user } = useAuth();
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [animClass, setAnimClass] = useState('');

  // Listen for hash changes
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((view: string, params: Record<string, string> = {}) => {
    // Trigger animation
    setAnimClass('');
    requestAnimationFrame(() => {
      setRoute({ view, params });
      setAnimClass('view-enter');
    });

    // Update hash for deep-linkable views
    if (view === 'song-view' && params.id) location.hash = `#song/${params.id}`;
    else if (view === 'setlist-edit' && params.id) location.hash = `#setlist/${params.id}`;
    else if (view === 'setlist-play' && params.id && !params.local) location.hash = `#setlist/${params.id}/play${params.public === '1' ? '/public' : ''}`;
    else if (['browse', 'my-songs', 'setlists', 'admin', 'settings', 'auth', 'about', 'public-setlists', 'local-setlists'].includes(view)) {
      // Use replaceState to clear hash without triggering hashchange (which would race with the rAF setRoute above)
      history.replaceState(null, '', location.pathname + location.search);
    }
  }, []);

  // Deep-link initial routing with auth context
  useEffect(() => {
    const initial = parseHash();
    if (initial.view === 'setlist-edit' && !user) {
      // Redirect unauthenticated users trying to edit setlists
      setRoute({ view: 'browse', params: {} });
    }
  }, []);

  const renderView = () => {
    const { view, params } = route;

    switch (view) {
      case 'browse':
        return <BrowseView navigate={navigate} />;
      case 'my-songs':
        return user ? <MySongsView navigate={navigate} /> : <BrowseView navigate={navigate} />;
      case 'song-view':
        return params.id ? <SongView songId={parseInt(params.id)} navigate={navigate} /> : <BrowseView navigate={navigate} />;
      case 'song-edit':
        return <SongEditView songId={params.id ? parseInt(params.id) : undefined} navigate={navigate} />;
      case 'correction':
        return params.id ? <CorrectionView songId={parseInt(params.id)} navigate={navigate} /> : <BrowseView navigate={navigate} />;
      case 'auth':
        return <AuthView navigate={navigate} />;
      case 'setlists':
        return user ? <SetlistsView navigate={navigate} /> : <BrowseView navigate={navigate} />;
      case 'public-setlists':
        return <PublicSetlistsView navigate={navigate} />;
      case 'setlist-edit':
        return params.id ? <SetlistEditView setlistId={parseInt(params.id)} navigate={navigate} /> : <SetlistsView navigate={navigate} />;
      case 'setlist-play': {
        if (params._setlist) {
          // Local setlist play with pre-loaded data
          try {
            const sl = JSON.parse(params._setlist) as Setlist;
            return <SetlistPlayView setlistId={sl.id} isLocal initialSetlist={sl} navigate={navigate} />;
          } catch { /* fall through */ }
        }
        const isPublic = params.public === '1';
        const initialIdx = params.index ? parseInt(params.index) : undefined;
        return params.id ? (
          <SetlistPlayView
            setlistId={params.local ? params.id : parseInt(params.id)}
            isPublic={isPublic}
            isLocal={!!params.local}
            initialIndex={initialIdx}
            navigate={navigate}
          />
        ) : <SetlistsView navigate={navigate} />;
      }
      case 'local-setlists':
        return <LocalSetlistsView navigate={navigate} />;
      case 'local-setlist-edit':
        return params.id ? <LocalSetlistEditView setlistId={params.id} navigate={navigate} /> : <LocalSetlistsView navigate={navigate} />;
      case 'admin':
        return <AdminView navigate={navigate} />;
      case 'settings':
        return <SettingsView />;
      case 'about':
        return <AboutView navigate={navigate} />;
      default:
        return <BrowseView navigate={navigate} />;
    }
  };

  return (
    <>
      <Nav view={route.view} navigate={navigate} />
      <main id="app" className={animClass}>
        {renderView()}
      </main>
      <Toast />
    </>
  );
}
