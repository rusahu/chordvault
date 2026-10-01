import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SongEditView } from '../SongEditView';

// ─── Mocks ──────────────────────────────────────────────────────────

// Mock CodeMirrorEditor as a textarea that fires onChange
vi.mock('../../components/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock EditorPreview — not needed for sync tests
vi.mock('../../components/EditorPreview', () => ({
  EditorPreview: () => <div data-testid="preview" />,
}));

// Mock OcrModal
vi.mock('../../components/OcrModal', () => ({
  OcrModal: () => null,
}));

// Mock hooks — stable references to avoid infinite re-renders from effect deps
const mockApiCall = vi.fn().mockImplementation((_method: string, path: string) => {
  if (path === '/api/settings/gemini-key') return Promise.resolve({ hasKey: false });
  if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
  if (path === '/api/songs/tags') return Promise.resolve({ tags: ['worship', 'praise'] });
  return Promise.resolve({});
});
const mockUser = { id: 1, username: 'testuser', role: 'owner', token: 'fake' };
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockToast = vi.fn();
const mockToggleTheme = vi.fn();
const mockT = (key: string) => key;
const mockTReplace = (key: string) => key;

vi.mock('../../hooks/useApi', () => ({
  useApi: () => mockApiCall,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAdmin: true, login: mockLogin, logout: mockLogout }),
}));

vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({
    t: mockT,
    tReplace: mockTReplace,
    loaded: true,
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: mockToggleTheme }),
}));

// ─── Tests ──────────────────────────────────────────────────────────

describe('SongEditView two-way sync', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockImplementation((_method: string, path: string) => {
      if (path === '/api/settings/gemini-key') return Promise.resolve({ hasKey: false });
      if (path === '/api/settings/languages') return Promise.resolve({ languages: [] });
      if (path === '/api/songs/tags') return Promise.resolve({ tags: ['worship', 'praise'] });
      return Promise.resolve({});
    });
  });

  async function renderEditor() {
    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(<SongEditView navigate={navigate} />);
    });
    return result!;
  }

  function getEditor(): HTMLTextAreaElement {
    return screen.getByTestId('editor') as HTMLTextAreaElement;
  }

  function getTitleInput(): HTMLInputElement {
    return screen.getByPlaceholderText('songEdit.titlePlaceholder') as HTMLInputElement;
  }

  function getArtistInput(): HTMLInputElement {
    return screen.getByPlaceholderText('songEdit.artistPlaceholder') as HTMLInputElement;
  }

  function getBpmInput(): HTMLInputElement {
    return screen.getByPlaceholderText('e.g. 120') as HTMLInputElement;
  }

  // ─── Field → Editor sync ──────────────────────────────────────

  it('typing in title field adds {title:} directive to editor content', async () => {
    await renderEditor();
    const titleInput = getTitleInput();

    fireEvent.change(titleInput, { target: { value: 'Amazing Grace' } });

    const editor = getEditor();
    expect(editor.value).toContain('{title: Amazing Grace}');
  });

  it('typing in artist field adds {artist:} directive to editor content', async () => {
    await renderEditor();
    const artistInput = getArtistInput();

    fireEvent.change(artistInput, { target: { value: 'John Newton' } });

    const editor = getEditor();
    expect(editor.value).toContain('{artist: John Newton}');
  });

  it('changing BPM field adds {tempo:} directive to editor content', async () => {
    await renderEditor();
    const bpmInput = getBpmInput();

    fireEvent.change(bpmInput, { target: { value: '120' } });

    const editor = getEditor();
    expect(editor.value).toContain('{tempo: 120}');
  });

  it('clearing a field removes the directive from content', async () => {
    await renderEditor();
    const titleInput = getTitleInput();

    // First add a title
    fireEvent.change(titleInput, { target: { value: 'Test Song' } });
    expect(getEditor().value).toContain('{title: Test Song}');

    // Then clear it
    fireEvent.change(titleInput, { target: { value: '' } });
    expect(getEditor().value).not.toContain('{title:');
  });

  it('multiple fields sync independently', async () => {
    await renderEditor();

    fireEvent.change(getTitleInput(), { target: { value: 'My Song' } });
    fireEvent.change(getArtistInput(), { target: { value: 'Artist Name' } });
    fireEvent.change(getBpmInput(), { target: { value: '90' } });

    const content = getEditor().value;
    expect(content).toContain('{title: My Song}');
    expect(content).toContain('{artist: Artist Name}');
    expect(content).toContain('{tempo: 90}');
  });

  // ─── Editor → Field sync ──────────────────────────────────────

  it('typing {artist:} in editor updates artist field (debounced)', async () => {
    await renderEditor();
    const editor = getEditor();

    fireEvent.change(editor, { target: { value: '{artist: John Smith}\n[G]Lyrics' } });

    // The sync is debounced at 150ms — wait for it
    await waitFor(() => {
      expect(getArtistInput().value).toBe('John Smith');
    }, { timeout: 500 });
  });

  it('typing {tempo:} in editor updates BPM field', async () => {
    await renderEditor();
    const editor = getEditor();

    fireEvent.change(editor, { target: { value: '{tempo: 140}\n[G]Lyrics' } });

    await waitFor(() => {
      expect(getBpmInput().value).toBe('140');
    }, { timeout: 500 });
  });

  it('typing {title:} in editor updates title field', async () => {
    await renderEditor();
    const editor = getEditor();

    fireEvent.change(editor, { target: { value: '{title: From Editor}\n[G]Lyrics' } });

    await waitFor(() => {
      expect(getTitleInput().value).toBe('From Editor');
    }, { timeout: 500 });
  });

  it('editor content with multiple directives populates all fields', async () => {
    await renderEditor();
    const editor = getEditor();

    const content = '{title: Test Song}\n{artist: Test Artist}\n{tempo: 100}\n[G]Lyrics here';
    fireEvent.change(editor, { target: { value: content } });

    await waitFor(() => {
      expect(getTitleInput().value).toBe('Test Song');
      expect(getArtistInput().value).toBe('Test Artist');
      expect(getBpmInput().value).toBe('100');
    }, { timeout: 500 });
  });

  // ─── Tag sync ─────────────────────────────────────────────────

  it('typing a custom tag adds {x_tags:} directive to content', async () => {
    await renderEditor();
    const input = screen.getByPlaceholderText('Add a tag…');
    fireEvent.change(input, { target: { value: 'Romantic' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getEditor().value).toContain('{x_tags: Romantic}');
  });

  it('adds suggested and custom tags as comma-separated {x_tags:}', async () => {
    await renderEditor();
    await screen.findByText('worship');
    fireEvent.click(screen.getByText('worship'));
    const input = screen.getByPlaceholderText('Add a tag…');
    fireEvent.change(input, { target: { value: 'Romantic' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getEditor().value).toContain('{x_tags: worship,Romantic}');
  });

  it('prevents case-insensitive duplicates and removes a tag from the song', async () => {
    await renderEditor();
    const input = screen.getByPlaceholderText('Add a tag…');
    fireEvent.change(input, { target: { value: 'Romantic' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'romantic' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getEditor().value).toContain('{x_tags: Romantic}');
    expect(getEditor().value).not.toContain('Romantic,romantic');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Romantic' }));
    expect(getEditor().value).not.toContain('{x_tags:');
  });

  // ─── Directive ordering ───────────────────────────────────────

  it('directives are inserted in correct order (title before artist before tempo)', async () => {
    await renderEditor();

    // Add in reverse order
    fireEvent.change(getBpmInput(), { target: { value: '120' } });
    fireEvent.change(getArtistInput(), { target: { value: 'Bob' } });
    fireEvent.change(getTitleInput(), { target: { value: 'Song' } });

    const content = getEditor().value;
    const titlePos = content.indexOf('{title:');
    const artistPos = content.indexOf('{artist:');
    const tempoPos = content.indexOf('{tempo:');

    expect(titlePos).toBeLessThan(artistPos);
    expect(artistPos).toBeLessThan(tempoPos);
  });
});
