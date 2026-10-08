import { useOffline, useOfflineActivity } from '../context/OfflineContext';
import { Button, useComputedColorScheme, Group, Title, Text, Paper } from '@mantine/core';
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { showStatusNotification as toast } from '../lib/notifications';
import { CodeMirrorEditor } from '../components/CodeMirrorEditor';
import { detectFormat, toChordPro, ensureKeyDirective } from '../lib/chords';
import type { Song } from '../types';

interface CorrectionViewProps {
  songId: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function CorrectionView({ songId, navigate }: CorrectionViewProps) {
  const apiCall = useApi();
  const { readOnly } = useOffline();
  useOfflineActivity(true);
  const theme = useComputedColorScheme('dark');
  const [content, setContent] = useState('');

  useEffect(() => {
    apiCall<Song>('GET', `/api/songs/${songId}`)
      .then((s) => setContent(s.content))
      .catch((e) => { toast(e.message, 'error'); navigate('browse'); });
  }, [songId, apiCall, navigate]);

  const submit = async () => {
    if (readOnly) return;
    const trimmed = content.trim();
    if (!trimmed) { toast('Content is required', 'error'); return; }
    if (trimmed.length > 100000) { toast('Content too large', 'error'); return; }
    if (!detectFormat(trimmed)) { toast('No chords detected. Add chords (e.g. [C], [G]) before submitting.', 'error'); return; }
    let final = toChordPro(trimmed);
    final = ensureKeyDirective(final);
    try {
      await apiCall('POST', `/api/songs/${songId}/correction`, { content: final });
      toast('Correction submitted for review', 'success');
      navigate('song-view', { id: String(songId) });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <Group mb="lg">
        <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => navigate('song-view', { id: String(songId) })}>&#8592; Cancel</Button>
        <Title order={2} size="h3" flex="1 1 160px">Submit Correction</Title>
        <Button size="xs" className="btn btn-sm" disabled={readOnly} onClick={submit}>Submit</Button>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">
        Edit the chords below. Your correction will be reviewed by the song owner before being applied.
      </Text>
      <Paper withBorder radius="md" mb="sm" style={{ overflow: 'hidden' }}>
          <CodeMirrorEditor
            value={content}
            onChange={setContent}
            darkMode={theme === 'dark'}
            placeholder="Corrected chord sheet..."
          />
      </Paper>
    </>
  );
}
