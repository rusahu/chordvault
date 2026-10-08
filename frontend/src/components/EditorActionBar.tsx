import { useOffline } from '../context/OfflineContext';
import { ActionIcon, Button, Group, Menu, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconChevronDown, IconTrash } from '@tabler/icons-react';

interface EditorActionBarProps {
  title: string;
  dirty: boolean;
  onLeave: () => void;
  saveLabel: string;
  onSave: () => void;
  onSaveAsVersion?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
}

export function EditorActionBar({ title, dirty, onLeave, saveLabel, onSave, onSaveAsVersion, onDelete, t }: EditorActionBarProps) {
  const { readOnly } = useOffline();
  const hasMenu = !!(onSaveAsVersion || onDelete);
  return (
    <Group component="header" className="editor-action-bar" wrap="nowrap" gap="xs" pos="sticky" top={0} px="sm" py="xs" mb="lg" bg="var(--cv-band)" style={{ zIndex: 50, borderRadius: 14 }}>
      <ActionIcon size="input-md" aria-label={t('songEdit.back')} title={t('songEdit.back')} onClick={onLeave}>
        <IconArrowLeft size={22} aria-hidden />
      </ActionIcon>
      <Stack gap={0} flex={1} miw={0}>
        <Title order={1} fz={{ base: 18, sm: 21 }} lh={1.15} style={{ overflowWrap: 'anywhere' }}>{title}</Title>
        {dirty && <Text span size="sm" c="dimmed" fw={500}>{t('songEdit.unsaved')}</Text>}
      </Stack>
      <Button variant="default" visibleFrom="xs" onClick={onLeave}>{t('songEdit.cancel')}</Button>
      <Group gap={1} wrap="nowrap">
        <Button disabled={readOnly} variant="filled" onClick={onSave} styles={hasMenu ? { root: { borderStartEndRadius: 0, borderEndEndRadius: 0 } } : undefined}>{saveLabel}</Button>
        {hasMenu && (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon disabled={readOnly} variant="filled" size="input-sm" aria-label={t('songEdit.moreActions')} title={t('songEdit.moreActions')} styles={{ root: { borderStartStartRadius: 0, borderEndStartRadius: 0 } }}>
                <IconChevronDown size={18} aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {onSaveAsVersion && <Menu.Item onClick={onSaveAsVersion}>{t('songEdit.saveAsNewVersion')}</Menu.Item>}
              {onSaveAsVersion && onDelete && <Menu.Divider />}
              {onDelete && <Menu.Item color="red" leftSection={<IconTrash size={16} aria-hidden />} onClick={onDelete}>{t('songEdit.deleteSong')}</Menu.Item>}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Group>
  );
}
