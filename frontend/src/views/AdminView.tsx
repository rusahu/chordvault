import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { Loading } from '../components/Loading';
import type { AdminStats, AdminUser, InviteCode, AdminConfig, Correction } from '../types';
import { languageName } from '../lib/languages';

interface AdminViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function AdminView({ navigate }: AdminViewProps) {
  const apiCall = useApi();
  const { user, isAdmin } = useAuth();
  const { t, tReplace } = useI18n();
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [config, setConfig] = useState<AdminConfig>({ allowRegistration: true });
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (!isAdmin) { navigate('my-songs'); return; }
    load();
  }, []);

  const load = async () => {
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
  };

  const loadInvites = async () => {
    try {
      const inv = await apiCall<InviteCode[]>('GET', '/api/admin/invites');
      setInvites(inv);
    } catch { /* ignore */ }
  };

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

      <div className="sl-options-panel" style={{ maxWidth: 400, marginBottom: 24 }}>
        <label className="sl-option">
          <span>Open Registration</span>
          <span className="toggle">
            <input type="checkbox" checked={config.allowRegistration} onChange={(e) => toggleReg(e.target.checked)} />
            <span className="toggle-slider" />
          </span>
        </label>
      </div>

      <h3 className="admin-section-title">{t('admin.users')}</h3>
      <div className="search-row" style={{ marginBottom: 16 }}>
        <button className="btn btn-sm" onClick={generateInvite}>{t('admin.generateInvite')}</button>
        {inviteCode && (
          <span>
            <code style={{ fontSize: 16, padding: '4px 10px', background: 'var(--surface)', borderRadius: 6, userSelect: 'all' as const }}>{inviteCode}</code>
            <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(inviteCode); toast(t('admin.codeCopied'), 'success'); }}>{t('admin.copy')}</button>
          </span>
        )}
      </div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{t('admin.pendingInvites')}:</div>
          {pending.map((inv) => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <code style={{ fontSize: 13 }}>{inv.code}</code>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(inv.created_at).toLocaleDateString()}</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => deleteInvite(inv.id)}>&#10005;</button>
            </div>
          ))}
        </div>
      )}

      <div className="song-grid" style={{ marginBottom: 28 }}>
        {users.map((u) => {
          const isSelf = u.id === currentId;
          const isTargetOwner = u.role === 'owner';
          const isTargetAdmin = u.role === 'admin';
          const canManage = !isSelf && !isTargetOwner && (isOwner || !isTargetAdmin);

          return (
            <div key={u.id} className="song-card" style={{ cursor: 'default' }}>
              <div className="song-card-info">
                <div className="song-card-title">@{u.username}{isSelf && <span style={{ color: 'var(--muted)', fontSize: 13 }}> {t('admin.you')}</span>}</div>
                <div className="song-card-meta">{u.song_count} {u.song_count !== 1 ? t('admin.songPlural') : t('admin.song')} &middot; {t('admin.joined')} {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div className="song-card-actions">
                {u.role === 'owner' && <span className="badge badge-owner">owner</span>}
                {u.role === 'admin' && <span className="badge badge-admin">admin</span>}
                {u.disabled && <span className="badge badge-disabled">disabled</span>}
                {canManage && (
                  <div className="user-card-actions">
                    {isOwner && (isTargetAdmin
                      ? <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setRole(u.id, 'user'); }}>{t('admin.demote')}</button>
                      : <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setRole(u.id, 'admin'); }}>{t('admin.promote')}</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setDisabled(u.id, !u.disabled); }}>{u.disabled ? t('admin.enable') : t('admin.disable')}</button>
                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteUser(u.id, u.username); }}>{t('admin.delete')}</button>
                  </div>
                )}
              </div>
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
