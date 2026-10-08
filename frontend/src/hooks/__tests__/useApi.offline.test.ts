import { renderHook, act } from '@testing-library/react';
import { useApi } from '../useApi';
import { api, ApiError } from '../../lib/api';
const { offline, user, logout } = vi.hoisted(() => ({ offline: { readOnly: false }, user: { id: 1, token: 'fixture' }, logout: vi.fn() }));
vi.mock('../../context/OfflineContext', () => ({ useOffline: () => offline }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user, logout }) }));
vi.mock('../../lib/api', async original => ({ ...await original<typeof import('../../lib/api')>(), api: vi.fn(async () => ({})) }));
afterEach(() => { offline.readOnly = false; vi.restoreAllMocks(); vi.clearAllMocks(); });
it('keeps the reader callback stable and rejects writes in downloaded mode', async () => {
  const hook = renderHook(() => useApi());
  const original = hook.result.current;
  offline.readOnly = true;
  hook.rerender();
  expect(hook.result.current).toBe(original);
  await expect(hook.result.current('PUT', '/api/songs/1', {})).rejects.toThrow('Connect');
  expect(api).not.toHaveBeenCalled();
  await act(async () => { await hook.result.current('GET', '/api/songs/1'); });
  expect(api).toHaveBeenCalledOnce();
});
it('also blocks keyboard/handler writes before the connectivity hook rerenders', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const hook = renderHook(() => useApi());
  await expect(hook.result.current('DELETE', '/api/songs/1')).rejects.toThrow('Connect');
  expect(api).not.toHaveBeenCalled();
});
it('retains the existing logout behavior for expired online credentials', async () => {
  vi.mocked(api).mockRejectedValueOnce(new ApiError('Expired', 401));
  const hook = renderHook(() => useApi());
  await expect(hook.result.current('GET', '/api/songs/1')).rejects.toThrow('Expired');
  expect(logout).toHaveBeenCalledOnce();
});
