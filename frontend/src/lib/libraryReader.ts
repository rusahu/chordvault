import { ApiError } from './api';

export async function readLibraryResource<T>(online: boolean, network: () => Promise<T>, saved: () => Promise<T>, invalidate: () => Promise<void>): Promise<T> {
  if (!online) return saved();
  try { return await network(); }
  catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 403 || error.status === 404) await invalidate();
      if (error.status < 500) throw error;
    } else if (!(error instanceof TypeError) && !(error instanceof DOMException && error.name === 'TimeoutError')) throw error;
    return saved();
  }
}
