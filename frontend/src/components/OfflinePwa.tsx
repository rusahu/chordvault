import { useI18n } from '../context/I18nContext';
import { useEffect, useState } from 'react';
import { Alert } from '@mantine/core';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOffline } from '../context/OfflineContext';

function Registration() {
  const { t } = useI18n();
  const { setShellReady, setShellError, activity } = useOffline();
  const { needRefresh: [needRefresh, setNeedRefresh] } = useRegisterSW({
    immediate: true,
    onRegisteredSW: () => {
      void navigator.serviceWorker.ready.then(async () => {
        const assets = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map(script => script.src);
        const available = assets.length > 0 && (await Promise.all(assets.map(url => caches.match(url)))).every(Boolean);
        setShellReady(available);
        setShellError(available ? '' : 'This app version is not downloaded. Reconnect and reopen ChordVault before using it offline.');
      }).catch(error => setShellError(`Offline app preparation failed: ${error.message}`));
    },
    onRegisterError: error => setShellError(`Offline app preparation failed: ${error.message}`),
  });
  return needRefresh && !activity ? <Alert withCloseButton onClose={() => setNeedRefresh(false)}>
    {t('offline.updateReady', 'Update ready. Close all ChordVault windows and reopen to apply after your session.')}
  </Alert> : null;
}

export function OfflinePwa() {
  const { enabled } = useOffline();
  const [existing, setExisting] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(reg => setExisting(!!reg)).catch(() => {});
  }, []);
  return import.meta.env.PROD && (enabled || existing) ? <Registration /> : null;
}
