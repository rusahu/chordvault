import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { LANGUAGES, languageName } from '../lib/languages';
import { useDemo } from '../context/DemoContext';
import { MAX_PREFERRED_LANGUAGES, MAX_OCR_PROMPT } from '../lib/constants';

export function SettingsView() {
  const apiCall = useApi();
  const { demoMode } = useDemo();
  const toast = useToast();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; color: string } | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<string>('Checking...');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiMsg, setGeminiMsg] = useState<{ text: string; color: string } | null>(null);
  const [preferredLangs, setPreferredLangs] = useState<string[]>([]);
  const [langSearch, setLangSearch] = useState('');
  const [langMsg, setLangMsg] = useState<{ text: string; color: string } | null>(null);
  const [ocrPrompt, setOcrPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [promptMsg, setPromptMsg] = useState<{ text: string; color: string } | null>(null);

  useEffect(() => { loadGeminiStatus(); loadOcrPrompt(); }, []);
  useEffect(() => { loadPreferredLangs(); }, []);

  const loadPreferredLangs = async () => {
    try {
      const data = await apiCall<{ languages: string[] }>('GET', '/api/settings/languages');
      setPreferredLangs(data.languages);
    } catch {}
  };

  const loadGeminiStatus = async () => {
    try {
      const data = await apiCall<{ hasKey: boolean }>('GET', '/api/settings/gemini-key');
      setGeminiStatus(data.hasKey ? '✓ Key saved' : 'No key set');
    } catch { setGeminiStatus('Could not check status'); }
  };

  const loadOcrPrompt = async () => {
    try {
      const data = await apiCall<{ prompt: string | null; defaultPrompt: string }>('GET', '/api/settings/ocr-prompt');
      setDefaultPrompt(data.defaultPrompt);
      if (data.prompt) {
        setOcrPrompt(data.prompt);
        setHasCustomPrompt(true);
      }
    } catch {}
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) { setPwMsg({ text: 'All fields are required', color: 'var(--danger)' }); return; }
    if (newPw.length < 6) { setPwMsg({ text: 'New password must be at least 6 characters', color: 'var(--danger)' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ text: 'New passwords do not match', color: 'var(--danger)' }); return; }
    try {
      await apiCall('PUT', '/api/auth/password', { current_password: currentPw, new_password: newPw });
      setPwMsg({ text: 'Password changed successfully', color: 'var(--success)' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { setPwMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const saveGeminiKey = async () => {
    setGeminiMsg(null);
    if (!geminiKey.trim()) { setGeminiMsg({ text: 'Enter an API key', color: 'var(--danger)' }); return; }
    try {
      await apiCall('PUT', '/api/settings/gemini-key', { api_key: geminiKey.trim() });
      setGeminiMsg({ text: 'Key saved', color: 'var(--success)' });
      setGeminiKey('');
      loadGeminiStatus();
    } catch (e) { setGeminiMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const removeGeminiKey = async () => {
    try {
      await apiCall('DELETE', '/api/settings/gemini-key');
      setGeminiMsg({ text: 'Key removed', color: 'var(--success)' });
      loadGeminiStatus();
    } catch (e) { setGeminiMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const saveOcrPrompt = async () => {
    setPromptMsg(null);
    if (!ocrPrompt.trim()) { setPromptMsg({ text: 'Prompt cannot be empty', color: 'var(--danger)' }); return; }
    if (ocrPrompt.length > MAX_OCR_PROMPT) { setPromptMsg({ text: `Prompt must be under ${MAX_OCR_PROMPT} characters`, color: 'var(--danger)' }); return; }
    try {
      await apiCall('PUT', '/api/settings/ocr-prompt', { prompt: ocrPrompt });
      setPromptMsg({ text: 'Custom prompt saved', color: 'var(--success)' });
      setHasCustomPrompt(true);
    } catch (e) { setPromptMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const resetOcrPrompt = async () => {
    try {
      await apiCall('DELETE', '/api/settings/ocr-prompt');
      setOcrPrompt('');
      setHasCustomPrompt(false);
      setPromptMsg({ text: 'Reset to default prompt', color: 'var(--success)' });
    } catch (e) { setPromptMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const addLang = async (code: string) => {
    if (preferredLangs.includes(code)) return;
    const updated = [...preferredLangs, code];
    try {
      await apiCall('PUT', '/api/settings/languages', { languages: updated });
      setPreferredLangs(updated);
      setLangSearch('');
      setLangMsg({ text: 'Saved', color: 'var(--success)' });
    } catch (e) { setLangMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const removeLang = async (code: string) => {
    const updated = preferredLangs.filter(c => c !== code);
    try {
      await apiCall('PUT', '/api/settings/languages', { languages: updated });
      setPreferredLangs(updated);
      setLangMsg({ text: 'Saved', color: 'var(--success)' });
    } catch (e) { setLangMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  return (
    <>
      <div className="view-header"><h2 className="view-title">Settings</h2></div>
      <div className="settings-section">
        <h3 className="admin-section-title">Change Password</h3>
        {demoMode ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Disabled in demo mode</div>
        ) : (
          <div className="auth-card" style={{ maxWidth: 400 }}>
            <div className="field"><label>Current Password</label><input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" /></div>
            <div className="field"><label>New Password</label><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></div>
            <div className="field"><label>Confirm New Password</label><input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></div>
            <button className="btn" onClick={changePassword}>Change Password</button>
            {pwMsg && <div style={{ fontSize: 13, marginTop: 12, color: pwMsg.color }}>{pwMsg.text}</div>}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="admin-section-title">OCR Settings</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          Smart OCR uses Google Gemini to extract chords from photos with higher accuracy. Get a free API key at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>aistudio.google.com/apikey</a>
        </p>
        <div className="auth-card" style={{ maxWidth: 400 }}>
          <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--muted)' }}>{geminiStatus}</div>
          <div className="field"><label>Gemini API Key</label><input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." autoComplete="off" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={saveGeminiKey}>Save Key</button>
            <button className="btn btn-danger btn-sm" onClick={removeGeminiKey}>Remove Key</button>
          </div>
          {geminiMsg && <div style={{ fontSize: 13, marginTop: 12, color: geminiMsg.color }}>{geminiMsg.text}</div>}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="admin-section-title">OCR Prompt</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          Customize the instructions sent to Gemini when extracting chords from photos.
          {hasCustomPrompt ? ' You are using a custom prompt.' : ' Using the default prompt.'}
        </p>
        <div className="auth-card" style={{ maxWidth: 600 }}>
          <div className="field">
            <textarea
              value={ocrPrompt}
              onChange={(e) => setOcrPrompt(e.target.value)}
              placeholder={defaultPrompt}
              rows={12}
              maxLength={MAX_OCR_PROMPT}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
              {ocrPrompt.length} / {MAX_OCR_PROMPT}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={saveOcrPrompt}>Save Prompt</button>
            {!ocrPrompt && (
              <button className="btn btn-sm" style={{ background: 'var(--surface-alt, var(--surface))' }} onClick={() => setOcrPrompt(defaultPrompt)}>
                Copy Default
              </button>
            )}
            {hasCustomPrompt && (
              <button className="btn btn-danger btn-sm" onClick={resetOcrPrompt}>Reset to Default</button>
            )}
          </div>
          {promptMsg && <div style={{ fontSize: 13, marginTop: 12, color: promptMsg.color }}>{promptMsg.text}</div>}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="admin-section-title">My Languages</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          Your preferred languages appear at the top of the language picker when creating songs.
        </p>
        <div className="auth-card" style={{ maxWidth: 400 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {preferredLangs.map(code => (
              <span key={code} className="badge badge-tag" style={{ cursor: 'pointer' }} onClick={() => removeLang(code)}>
                {languageName(code)} ✕
              </span>
            ))}
            {preferredLangs.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>No languages set</span>}
          </div>
          {preferredLangs.length < MAX_PREFERRED_LANGUAGES && (
            <div className="field">
              <input
                type="text"
                placeholder="Search to add a language..."
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
              />
              {langSearch && (
                <div className="language-picker-dropdown" style={{ position: 'relative', marginTop: 4 }}>
                  {LANGUAGES
                    .filter(l => !preferredLangs.includes(l.code) &&
                      (l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.code.includes(langSearch.toLowerCase())))
                    .slice(0, 8)
                    .map(l => (
                      <button key={l.code} type="button" className="language-picker-option" onClick={() => addLang(l.code)}>
                        {l.name} <span className="language-picker-code">{l.code}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
          {langMsg && <div style={{ fontSize: 13, marginTop: 12, color: langMsg.color }}>{langMsg.text}</div>}
        </div>
      </div>
    </>
  );
}
