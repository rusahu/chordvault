import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsView } from '../SettingsView';
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => call }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, isAdmin: false }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string, fallback?: string) => fallback || key }) }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => ({ demoMode: false }) }));
vi.mock('../../components/GeminiKeySettings', () => ({ GeminiKeySettings: () => null }));
beforeEach(() => { vi.clearAllMocks(); call.mockImplementation((_method: string, path: string) => Promise.resolve(path.endsWith('/languages') ? { languages: [] } : path.endsWith('/ocr-model') ? { model: 'model', models: [] } : { prompt: null, defaultPrompt: '' })); });
const fill = (confirmation: string) => {
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass' } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: confirmation } });
};
it('rejects mismatched passwords without making a write', async () => {
  render(<SettingsView />); fill('different');
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
  expect(await screen.findByText('New passwords do not match')).toBeInTheDocument();
  expect(call.mock.calls.filter(c => c[0] === 'PUT')).toHaveLength(0);
});
it('blocks repeated pending requests and reports a backend error', async () => {
  let reject: (reason: Error) => void = () => {};
  call.mockImplementation((method: string, path: string) => method === 'PUT' ? new Promise((_resolve, fail) => { reject = fail; }) : Promise.resolve(path.endsWith('/languages') ? { languages: [] } : path.endsWith('/ocr-model') ? { models: [] } : { defaultPrompt: '' }));
  render(<SettingsView />); fill('newpass');
  const button = screen.getByRole('button', { name: 'Change Password' });
  fireEvent.click(button); fireEvent.click(button);
  expect(call.mock.calls.filter(c => c[0] === 'PUT')).toHaveLength(1); expect(button).toBeDisabled();
  reject(new Error('Current password incorrect'));
  await screen.findByText('Current password incorrect');
  await waitFor(() => expect(button).toBeEnabled());
});

it('resets passwords and announces a successful save', async () => {
  render(<SettingsView />);
  fill('newpass');
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Password changed successfully');
  expect(call).toHaveBeenCalledWith('PUT', '/api/auth/password', {
    current_password: 'oldpass', new_password: 'newpass',
  });
  expect(screen.getByLabelText('Current Password')).toHaveValue('');
  expect(screen.getByLabelText('New Password')).toHaveValue('');
  expect(screen.getByLabelText('Confirm New Password')).toHaveValue('');
});
it('exposes standalone language removal to keyboard and screen-reader users', async () => {
  call.mockImplementation((_method: string, path: string) => Promise.resolve(path.endsWith('/languages') ? { languages: ['en', 'zh'] } : path.endsWith('/ocr-model') ? { models: [] } : { defaultPrompt: '' }));
  render(<SettingsView />);
  const remove = await screen.findByRole('button', { name: 'Remove Chinese' });
  expect(remove.tabIndex).toBe(0);
  fireEvent.click(remove);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Chinese' })).not.toBeInTheDocument());
  expect(call).toHaveBeenCalledWith('PUT', '/api/settings/languages', { languages: ['en'] });
});
