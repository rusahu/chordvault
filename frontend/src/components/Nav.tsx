import { useOffline } from '../context/OfflineContext';
import { ActionIcon, Button, Group, Menu, Text, UnstyledButton, useComputedColorScheme, useMantineColorScheme, useMatches } from '@mantine/core';
import { IconMenu2, IconMoon, IconSun } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import logoSvg from '../assets/logo.svg?raw';

interface NavProps {
  view: string;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function Nav({ view, navigate }: NavProps) {
  const { readOnly } = useOffline();
  const { user, isAdmin, logout } = useAuth();
  const theme = useComputedColorScheme('dark');
  const { toggleColorScheme } = useMantineColorScheme();
  // Phone-only menu items are rendered, not CSS-hidden: Mantine's menu arrow keys stop on hidden items.
  const phone = useMatches({ base: true, xs: false }, { getInitialValueInEffect: false });
  const setlistsActive = ['setlists', 'setlist-edit', 'setlist-play', 'public-setlists'].includes(view);
  return (
    <Group component="nav" id="nav" justify="space-between" wrap="nowrap" gap="xs" pos="relative" mih={64} px={{ base: 12, sm: 24 }} py={6} bg="var(--cv-band)" style={{ zIndex: 100 }}>
      <UnstyledButton className="nav-brand" aria-label="ChordVault home" onClick={() => navigate('browse')}>
        <span className="nav-logo" dangerouslySetInnerHTML={{ __html: logoSvg }} />
        <Text span inherit className="nav-brand-text" visibleFrom="xs">ChordVault</Text>
      </UnstyledButton>
      <Group className="nav-links" id="nav-links" gap={4} wrap="nowrap" justify="flex-end" miw={0}>
        <ActionIcon visibleFrom={user ? 'xs' : undefined} onClick={() => toggleColorScheme()} title="Toggle theme" aria-label="Toggle theme">{theme === 'light' ? <IconMoon size={20} aria-hidden /> : <IconSun size={20} aria-hidden />}</ActionIcon>
        <Button variant={view === 'browse' ? 'default' : 'subtle'} onClick={() => navigate('browse')}>Songs</Button>
        <Button variant={setlistsActive ? 'default' : 'subtle'} onClick={() => navigate(user ? 'setlists' : 'public-setlists')}>Setlists</Button>
        {isAdmin && <Button disabled={readOnly} visibleFrom="xs" variant={view === 'admin' ? 'default' : 'subtle'} onClick={() => navigate('admin')}>Admin</Button>}
        {!user ? <Button disabled={readOnly} variant={view === 'auth' ? 'default' : 'subtle'} onClick={() => navigate('auth')}>Sign in</Button> : (
          <Menu position="bottom-end" shadow="sm">
            <Menu.Target><ActionIcon id="nav-menu-btn" title="Menu" aria-label="Account menu"><IconMenu2 size={20} aria-hidden /></ActionIcon></Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => navigate('my-songs')}>My Songs</Menu.Item>
              <Menu.Item onClick={() => navigate('settings')}>Settings</Menu.Item>
              {phone && isAdmin && <Menu.Item disabled={readOnly} onClick={() => navigate('admin')}>Admin</Menu.Item>}
              {phone && (
                <Menu.Item leftSection={theme === 'light' ? <IconMoon size={16} aria-hidden /> : <IconSun size={16} aria-hidden />} onClick={() => toggleColorScheme()}>
                  {theme === 'light' ? 'Dark theme' : 'Light theme'}
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item onClick={() => { logout(); navigate('browse'); }}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Group>
  );
}
