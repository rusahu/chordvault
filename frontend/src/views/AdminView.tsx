import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { Loading } from '../components/Loading';
import type { AdminStats, AdminUser, InviteCode, AdminConfig, Correction } from '../types';
import { useDemo } from '../context/DemoContext';
import { languageName } from '../lib/languages';

interface AdminViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function AdminView({ navigate }: AdminViewProps) {
  const apiCall = useApi();
  const { user, isAdmin } = useAuth();
  const { demoMode } = useDemo();
  const { t, tReplace } = useI18n();
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [config, setConfig] = useState<AdminConfig>({ allowRegistration: true });
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [inviteCode, setInviteCode] = useState('');

  const loadInvites = useCallback(async () => {
    try {
      const inv = await apiCall<InviteCode[]>('GET', '/api/admin/invites');
      setInvites(inv);
    } catch { /* ignore */ }
  }, [apiCall]);

  const load = useCallback(async () => {
    try {
      const [s, u, c, cfg] = await Promise.all([
        apiCall<AdminStats>('GET', '/api/admin/stats'),
        apiCall<AdminUser[]>('GET', '/api/admin/users'),
        apiCall<Correction[]>('GET', '/api/admin/corrections'),
        apiCall<AdminConfig>('GET', '/api/admin/config'),
      ]);
      setStats(s); setUsers(u); setCorrections(c); setConfig(cfg);
      loadInvites();
    } catch (e) { toast((e as Error).message, 'error'); navigate('my-songs'); }
  }, [apiCall, toast, navigate, loadInvites]);

  useEffect(() => {
    if (!isAdmin) { navigate('my-songs'); return; }
    load();
  }, [isAdmin, navigate, load]);

  const toggleReg = async (val: boolean) => {
    try {
      await apiCall('PUT', '/api/admin/config', { allowRegistration: val });
      setConfig({ ...config, allowRegistration: val });
      toast(val ? 'Registration enabled' : 'Registration disabled', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const generateInvite = async () => {
    try {
      const data = await apiCall<{ code: string }>('POST', '/api/admin/invites');
      setInviteCode(data.code);
      loadInvites();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const deleteInvite = async (id: number) => {
    try { await apiCall('DELETE', `/api/admin/invites/${id}`); loadInvites(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const setRole = async (userId: number, role: string) => {
    const action = role === 'admin' ? t('admin.confirmPromote') : t('admin.confirmDemote');
    if (!confirm(action)) return;
    try {
      await apiCall('PUT', `/api/admin/users/${userId}/role`, { role });
      toast(role === 'admin' ? t('admin.userPromoted') : t('admin.userDemoted'), 'success');
      load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const setDisabled = async (userId: number, disabled: boolean) => {
    if (!confirm(disabled ? t('admin.confirmDisable') : t('admin.confirmEnable'))) return;
    try {
      await apiCall('PUT', `/api/admin/users/${userId}/disabled`, { disabled });
      toast(disabled ? t('admin.userDisabled') : t('admin.userEnabled'), 'success');
      load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(tReplace('admin.confirmDeleteUser', { username }))) return;
    try { await apiCall('DELETE', `/api/admin/users/${userId}`); toast(t('admin.userDeleted'), 'success'); load(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const resetPassword = async (userId: number, username: string) => {
    const newPassword = prompt(tReplace('admin.resetPasswordPrompt', { username }));
    if (!newPassword) return;
    if (newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    try {
      await apiCall('PUT', `/api/admin/users/${userId}/password`, { password: newPassword });
      toast(t('admin.passwordReset'), 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const deleteSong = async (songId: number, title: string) => {
    if (!confirm(tReplace('admin.confirmDeleteSong', { title }))) return;
    try { await apiCall('DELETE', `/api/admin/songs/${songId}`); toast(t('admin.songDeleted'), 'success'); load(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  if (!stats) return <Loading />;

  const isOwner = user?.role === 'owner';
  const currentId = user?.id;
  const pending = invites.filter((i) => !i.used_at);

  return (
    <>
      <div className="view-header"><h2 className="view-title">{t('admin.title')}</h2></div>
      <div className="admin-stats">
        <div className="stat-card"><div className="stat-value">{stats.userCount}</div><div className="stat-label">{t('admin.users')}</div></div>
        <div className="stat-card"><div className="stat-value">{stats.songCount}</div><div className="stat-label">{t('admin.songs')}</div></div>
        {stats.pendingCount > 0 && <div className="stat-card stat-warn"><div className="stat-value">{stats.pendingCount}</div><div className="stat-label">Pending corrections</div></div>}
        {stats.noFormatCount > 0 && <div className="stat-card stat-warn"><div className="stat-value">{stats.noFormatCount}</div><div className="stat-label">No chords detected</div></div>}
      </div>

      {stats.languageDistribution && stats.languageDistribution.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 className="admin-section-title">Languages</h3>
          <div className="admin-stats">
            {stats.languageDistribution.map(({ language, count }) => (
              <div key={language} className="stat-card">
                <div className="stat-value">{count}</div>
                <div className="stat-label">{language ? languageName(language) : 'Not set'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="admin-section-title">{t('admin.inviteUsers')}</h3>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <label className="sl-option">
            <span>Open Registration</span>
            <span className="toggle">
              <input type="checkbox" checked={config.allowRegistration} onChange={(e) => toggleReg(e.target.checked)} disabled={demoMode} />
              <span className="toggle-slider" />
            </span>
          </label>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {config.allowRegistration ? 'Anyone can create an account — no email verification, so open to spam. Use invite codes instead.' : 'Registration is closed. Use invite codes to add new users.'}
          </div>
          {demoMode && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Disabled in demo mode</div>}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn" onClick={generateInvite} disabled={demoMode} title={demoMode ? 'Disabled in demo mode' : ''}>{t('admin.generateInvite')}</button>
            {inviteCode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 18, fontWeight: 600, padding: '6px 14px', background: 'var(--accent-bg)', borderRadius: 8, userSelect: 'all' as const, letterSpacing: '0.08em' }}>{inviteCode}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(inviteCode); toast(t('admin.codeCopied'), 'success'); }}>{t('admin.copy')}</button>
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>Generate a single-use code and share it. The person enters it on the sign-in page to create their account.</div>
          {pending.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{t('admin.pendingInvites')}</div>
              {pending.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <code style={{ fontSize: 13 }}>{inv.code}</code>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(inv.created_at).toLocaleDateString()}</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => deleteInvite(inv.id)} disabled={demoMode}>&#10005;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h3 className="admin-section-title">{t('admin.users')}</h3>

      <div className="song-grid" style={{ marginBottom: 28 }}>
        {users.map((u) => {
          const isSelf = u.id === currentId;
          const isTargetOwner = u.role === 'owner';
          const isTargetAdmin = u.role === 'admin';
          const canManage = !isSelf && !isTargetOwner && (isOwner || !isTargetAdmin);

          return (
            <div key={u.id} className="user-card">
              <div className="user-card-top">
                <div className="user-card-info">
                  <div className="song-card-title">@{u.username}{isSelf && <span style={{ color: 'var(--muted)', fontSize: 13 }}> {t('admin.you')}</span>}</div>
                  <div className="song-card-meta">{u.song_count} {u.song_count !== 1 ? t('admin.songPlural') : t('admin.song')} &middot; {t('admin.joined')} {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <div className="user-card-badges">
                  {u.role === 'owner' && <span className="badge badge-owner">owner</span>}
                  {u.role === 'admin' && <span className="badge badge-admin">admin</span>}
                  {u.disabled && <span className="badge badge-disabled">disabled</span>}
                </div>
              </div>
              {canManage && !demoMode && (
                <div className="user-card-actions">
                  {isOwner && (isTargetAdmin
                    ? <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setRole(u.id, 'user'); }}>{t('admin.demote')}</button>
                    : <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setRole(u.id, 'admin'); }}>{t('admin.promote')}</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); resetPassword(u.id, u.username); }}>{t('admin.resetPassword')}</button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setDisabled(u.id, !u.disabled); }}>{u.disabled ? t('admin.enable') : t('admin.disable')}</button>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteUser(u.id, u.username); }}>{t('admin.delete')}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stats.recentSongs.length > 0 && (
        <>
          <h3 className="admin-section-title">{t('admin.recentSongs')}</h3>
          <div className="song-grid">
            {stats.recentSongs.map((s) => (
              <div key={s.id} className="song-card" onClick={() => navigate('song-view', { id: String(s.id) })}>
                <div className="song-card-info">
                  <div className="song-card-title">{s.title}</div>
                  <div className="song-card-meta">{s.artist ? `${s.artist} · ` : ''}@{s.username} &middot; {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                <div className="song-card-actions">
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteSong(s.id, s.title); }}>{t('admin.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {corrections.length > 0 && (
        <>
          <h3 className="admin-section-title">Pending Corrections ({corrections.length})</h3>
          <div className="song-grid">
            {corrections.map((c) => (
              <div key={c.id} className="song-card" onClick={() => navigate('song-view', { id: String(c.parent_id) })}>
                <div className="song-card-info">
                  <div className="song-card-title">{c.title}</div>
                  <div className="song-card-meta">by @{c.submitter} &middot; {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <div className="song-card-actions"><span className="badge badge-pending">pending</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
