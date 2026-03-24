import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useDemo } from '../context/DemoContext';
import { api } from '../lib/api';
import type { AuthConfig, AuthResponse } from '../types';

interface AuthViewProps {
  navigate: (view: string) => void;
}

export function AuthView({ navigate }: AuthViewProps) {
  const { login } = useAuth();
  const { demoMode } = useDemo();
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<'login' | 'register' | 'invite'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AuthConfig>({ allowRegistration: true, invitesEnabled: false, turnstileSiteKey: null, demoMode: false });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const inviteRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<AuthConfig>('GET', '/api/auth/config').then((cfg) => {
      setConfig(cfg);
      if (cfg.demoMode) {
        setUsername('demo');
        setPassword('demopass123');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'invite' && inviteRef.current) inviteRef.current.focus();
    else if (userRef.current) userRef.current.focus();
  }, [tab]);

  useEffect(() => {
    const siteKey = config.turnstileSiteKey;
    if (!siteKey || tab === 'login') return;
    setTurnstileToken(null);

    const scriptId = 'cf-turnstile-script';
    const renderWidget = () => {
      if (turnstileRef.current && (window as any).turnstile) {
        while (turnstileRef.current.firstChild) turnstileRef.current.removeChild(turnstileRef.current.firstChild);
        (window as any).turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
        });
      }
    };

    if (document.getElementById(scriptId)) {
      renderWidget();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [config.turnstileSiteKey, tab]);

  const submit = async () => {
    setError('');
    if (tab === 'invite') {
      if (!inviteCode || !username || !password) { setError(t('auth.fillAllFields')); return; }
      try {
        const data = await api<AuthResponse>('POST', '/api/auth/redeem-invite', { code: inviteCode, username, password, turnstile_token: turnstileToken });
        login(data);
        navigate('browse');
      } catch (e) { setError((e as Error).message); }
      return;
    }
    if (!username || !password) { setError(t('auth.fillAllFields')); return; }
    try {
      const effectiveTab = !config.allowRegistration ? 'login' : tab;
      const endpoint = effectiveTab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = effectiveTab === 'login' ? { username, password } : { username, password, turnstile_token: turnstileToken };
      const data = await api<AuthResponse>('POST', endpoint, body);
      login(data);
      navigate('browse');
    } catch (e) { setError((e as Error).message); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); };
  const showTabs = config.allowRegistration;
  const showInviteLink = !config.allowRegistration && config.invitesEnabled && tab !== 'invite';

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">{t('auth.logo')}</div>
        <div className="auth-tagline">{t('auth.tagline')}</div>
        {showTabs && (
          <div className="auth-tabs">
            <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>{t('auth.signIn')}</button>
            <button className={`auth-tab${tab !== 'login' ? ' active' : ''}`} onClick={() => setTab('register')}>{t('auth.register')}</button>
          </div>
        )}
        {tab === 'invite' && (
          <div className="field">
            <label>{t('auth.inviteCode')}</label>
            <input type="text" ref={inviteRef} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder={t('auth.inviteCodePlaceholder')} autoComplete="off" onKeyDown={onKeyDown} />
          </div>
        )}
        <div className="field">
          <label>{t('auth.username')}</label>
          <input type="text" ref={userRef} id="auth-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('auth.usernamePlaceholder')} autoComplete="username" onKeyDown={onKeyDown} />
        </div>
        <div className="field">
          <label>{t('auth.password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} onKeyDown={onKeyDown} />
        </div>
        {config.turnstileSiteKey && tab !== 'login' && <div ref={turnstileRef} style={{ marginTop: 8 }} />}
        <button className="btn btn-full" id="auth-submit" style={{ marginTop: 8 }} onClick={submit}>
          {tab === 'invite' ? t('auth.createAccount') : (tab === 'login' || !showTabs ? t('auth.signIn') : t('auth.createAccount'))}
        </button>
        {showInviteLink && (
          <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={() => setTab('invite')}>{t('auth.haveInvite')}</button>
        )}
        {tab === 'invite' && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }} style={{ fontSize: 13, color: 'var(--muted)' }}>{t('auth.backToLogin')}</a>
          </div>
        )}
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</div>}
      </div>
    </div>
  );
}
