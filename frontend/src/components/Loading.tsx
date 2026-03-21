import { useI18n } from '../context/I18nContext';

export function Loading() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="empty-icon">&#9833;</div>
      <p>{t('common.loading')}</p>
    </div>
  );
}
