import { Alert, Button, Group, Loader, Paper, Stack, Switch, Text, Title } from '@mantine/core';
import { useOffline } from '../context/OfflineContext';
import { useI18n } from '../context/I18nContext';

export function OfflineLibrarySettings() {
  const offline = useOffline();
  const { t } = useI18n();
  const { state, busy, enabled, error, shellError, shellReady } = offline;
  return <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
    <Stack gap="sm">
      <Title order={3} fz={16}>{t('offline.title', 'Offline library')}</Title>
      <Switch label={t('offline.enable', 'Keep my library offline')} checked={enabled}
        onChange={event => { void (event.currentTarget.checked ? offline.enable() : offline.disable()); }} />
      <Text size="sm" c="dimmed">{t('offline.description', 'Download public songs, your private songs and your saved setlists for viewing. Stored on this device. Removed when you sign out.')}</Text>
      {busy && <Group gap="xs" role="status"><Loader size="xs" /><Text size="sm">{t('offline.downloading', 'Downloading library...')}</Text></Group>}
      {enabled && state?.revision && shellReady && <Text size="sm" role="status">
        {state.songCount} {t('offline.songs', 'songs')} · {state.setlistCount} {t('offline.setlists', 'setlists')} · {t('offline.updated', 'Last downloaded')} {new Date(state.downloadedAt!).toLocaleString()}
      </Text>}
      {enabled && !shellReady && !busy && <Text size="sm" role="status">{t('offline.preparing', 'Preparing the app and fonts for offline use...')}</Text>}
      {shellError && <Alert color="red" role="alert">{shellError}</Alert>}
      {enabled && !state?.revision && shellReady && !busy && <Text size="sm">{t('offline.noDownload', 'No completed download on this device. Connect and refresh your library.')}</Text>}
      {error && <Alert color="red" role="alert">{error}{state?.revision ? ` ${t('offline.previous', 'Your previous download is still available.')}` : ''}</Alert>}
      {enabled && <Button variant="default" disabled={busy || !offline.online} onClick={() => { void offline.refresh(true); }}>{t('offline.refresh', 'Refresh now')}</Button>}
    </Stack>
  </Paper>;
}
