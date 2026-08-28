import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

export function GeminiKeySettings() {
  const apiCall = useApi();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiCall<{ hasKey: boolean }>('GET', '/api/settings/gemini-key');
      setHasKey(data.hasKey);
    } catch {
      setHasKey(null);
      setMessage({ text: 'Could not check key status', color: 'var(--danger)' });
    }
  }, [apiCall]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const saveKey = async () => {
    setMessage(null);
    if (!geminiKey.trim()) {
      setMessage({ text: 'Enter an API key', color: 'var(--danger)' });
      return;
    }
    try {
      await apiCall('PUT', '/api/settings/gemini-key', { api_key: geminiKey.trim() });
      setHasKey(true);
      setGeminiKey('');
      setMessage({ text: hasKey ? 'Key replaced' : 'Key saved', color: 'var(--success)' });
    } catch (error) {
      setMessage({ text: (error as Error).message, color: 'var(--danger)' });
    }
  };

  const removeKey = async () => {
    try {
      await apiCall('DELETE', '/api/settings/gemini-key');
      setHasKey(false);
      setGeminiKey('');
      setMessage({ text: 'Key removed', color: 'var(--success)' });
    } catch (error) {
      setMessage({ text: (error as Error).message, color: 'var(--danger)' });
    }
  };

  return (
    <div className="auth-card">
      <div className={`gemini-key-status${hasKey ? ' configured' : ''}`} role="status">
        {hasKey === null ? 'Checking key status…' : hasKey ? '✓ Key configured' : 'No key configured'}
      </div>
      <div className="field">
        <label htmlFor="gemini-api-key">{hasKey ? 'Replace Gemini API Key' : 'Gemini API Key'}</label>
        <input
          id="gemini-api-key"
          type="password"
          value={geminiKey}
          onChange={(event) => setGeminiKey(event.target.value)}
          placeholder={hasKey ? '•••••••••••• (saved key)' : 'Paste your Gemini API key here'}
          autoComplete="off"
        />
      </div>
      <div className="flex-row">
        <button className="btn btn-sm" onClick={saveKey}>
          {hasKey ? 'Replace Key' : 'Save Key'}
        </button>
        {hasKey && (
          <button className="btn btn-danger btn-sm" onClick={removeKey}>
            Remove Key
          </button>
        )}
      </div>
      {message && (
        <div className="field-message" style={{ color: message.color }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
