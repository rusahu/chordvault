import type { User } from '../types';
import { ApiError } from './api';
import { offlineLibrary } from './offlineLibrary';

export async function downloadOfflineLibrary(user: User, library = offlineLibrary, signal?: AbortSignal) {
  const ticket = await library.beginRefresh(user.id);
  if (!ticket) return false;
  const current = await library.state();
  const headers: Record<string, string> = { Authorization: `Bearer ${user.token}` };
  if (current?.revision) headers['If-None-Match'] = current.revision;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('/api/offline-library', { headers, signal, cache: 'no-store' });
    if (response.status === 304) {
      if (await library.markChecked(ticket, response.headers.get('etag') || '')) return true;
      delete headers['If-None-Match'];
      continue;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) await library.disable(user.id, ticket);
      throw new ApiError(`Library download failed (${response.status})`, response.status);
    }
    const snapshot: unknown = await response.json();
    if (signal?.aborted) throw signal.reason;
    return library.replaceDownload(ticket, snapshot, response.headers.get('etag') || '');
  }
  throw new Error('Could not verify downloaded library. Try refreshing again.');
}
