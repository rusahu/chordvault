import { OfflineLibrarySettings } from '../components/OfflineLibrarySettings';
import { useOffline } from '../context/OfflineContext';
import { Anchor, Box, Group, Text, Select, Paper, Pill, Button, NativeSelect, PasswordInput, Stack, Textarea, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { LANGUAGES, languageName } from '../lib/languages';
import { useDemo } from '../context/DemoContext';
import { useAuth } from '../context/AuthContext';
import { exportSongsBlob } from '../lib/api';
import { ImportModal } from '../components/ImportModal';
import { GeminiKeySettings } from '../components/GeminiKeySettings';
import { MAX_PREFERRED_LANGUAGES, MAX_OCR_PROMPT, DEFAULT_GEMINI_MODEL } from '../lib/constants';
import { PageTitle } from '../components/PageTitle';

export function SettingsView() {
  const { readOnly } = useOffline();
  const apiCall = useApi();
  const { demoMode } = useDemo();
  const { user, isAdmin } = useAuth();
  const passwordForm = useForm({ initialValues: { currentPw: '', newPw: '', confirmPw: '' }, validate: { currentPw: value => value ? null : 'All fields are required', newPw: value => value.length >= 6 ? null : 'New password must be at least 6 characters', confirmPw: (value, values) => value === values.newPw ? null : 'New passwords do not match' } });
  const { currentPw, newPw, confirmPw } = passwordForm.values;
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; color: string } | null>(null);
  const [preferredLangs, setPreferredLangs] = useState<string[]>([]);
  const [langMsg, setLangMsg] = useState<{ text: string; color: string } | null>(null);
  const [ocrPrompt, setOcrPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [promptMsg, setPromptMsg] = useState<{ text: string; color: string } | null>(null);
  const [ocrModel, setOcrModel] = useState(DEFAULT_GEMINI_MODEL);
  const [modelList, setModelList] = useState<{ id: string; label: string }[]>([]);
  const [modelMsg, setModelMsg] = useState<{ text: string; color: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ text: string; color: string } | null>(null);
  const [showImport, { open: openImport, close: closeImport }] = useDisclosure(false);

  const loadPreferredLangs = useCallback(async () => {
    try {
      const data = await apiCall<{ languages: string[] }>('GET', '/api/settings/languages');
      setPreferredLangs(data.languages);
    } catch {}
  }, [apiCall]);

  const loadOcrPrompt = useCallback(async () => {
    try {
      const data = await apiCall<{ prompt: string | null; defaultPrompt: string }>('GET', '/api/settings/ocr-prompt');
      setDefaultPrompt(data.defaultPrompt);
      if (data.prompt) {
        setOcrPrompt(data.prompt);
        setHasCustomPrompt(true);
      }
    } catch {}
  }, [apiCall]);

  const loadOcrModel = useCallback(async () => {
    try {
      const data = await apiCall<{ model: string; models: { id: string; label: string }[] }>('GET', '/api/settings/ocr-model');
      setOcrModel(data.model);
      setModelList(data.models);
    } catch {}
  }, [apiCall]);

  useEffect(() => { loadOcrPrompt(); loadOcrModel(); }, [loadOcrPrompt, loadOcrModel]);
  useEffect(() => { loadPreferredLangs(); }, [loadPreferredLangs]);

  const changePassword = async () => {
    if (changingPassword) return;
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) { setPwMsg({ text: 'All fields are required', color: 'var(--danger)' }); return; }
    if (newPw.length < 6) { setPwMsg({ text: 'New password must be at least 6 characters', color: 'var(--danger)' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ text: 'New passwords do not match', color: 'var(--danger)' }); return; }
    setChangingPassword(true);
    try {
      await apiCall('PUT', '/api/auth/password', { current_password: currentPw, new_password: newPw });
      setPwMsg({ text: 'Password changed successfully', color: 'var(--success)' });
      passwordForm.reset();
    } catch (e) { setPwMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
    finally { setChangingPassword(false); }
  };

  const saveOcrModel = async (model: string) => {
    setOcrModel(model);
    setModelMsg(null);
    try {
      await apiCall('PUT', '/api/settings/ocr-model', { model });
      setModelMsg({ text: 'Default model saved', color: 'var(--success)' });
    } catch (e) { setModelMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const saveOcrPrompt = async () => {
    setPromptMsg(null);
    if (!ocrPrompt.trim()) { setPromptMsg({ text: 'Prompt cannot be empty', color: 'var(--danger)' }); return; }
    if (ocrPrompt.length > MAX_OCR_PROMPT) { setPromptMsg({ text: `Prompt must be under ${MAX_OCR_PROMPT} characters`, color: 'var(--danger)' }); return; }
    try {
      await apiCall('PUT', '/api/settings/ocr-prompt', { prompt: ocrPrompt });
      setPromptMsg({ text: 'Custom prompt saved', color: 'var(--success)' });
      setHasCustomPrompt(true);
    } catch (e) { setPromptMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const resetOcrPrompt = async () => {
    try {
      await apiCall('DELETE', '/api/settings/ocr-prompt');
      setOcrPrompt('');
      setHasCustomPrompt(false);
      setPromptMsg({ text: 'Reset to default prompt', color: 'var(--success)' });
    } catch (e) { setPromptMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const addLang = async (code: string) => {
    if (preferredLangs.includes(code)) return;
    const updated = [...preferredLangs, code];
    try {
      await apiCall('PUT', '/api/settings/languages', { languages: updated });
      setPreferredLangs(updated);
      setLangMsg({ text: 'Saved', color: 'var(--success)' });
    } catch (e) { setLangMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const removeLang = async (code: string) => {
    const updated = preferredLangs.filter(c => c !== code);
    try {
      await apiCall('PUT', '/api/settings/languages', { languages: updated });
      setPreferredLangs(updated);
      setLangMsg({ text: 'Saved', color: 'var(--success)' });
    } catch (e) { setLangMsg({ text: (e as Error).message, color: 'var(--danger)' }); }
  };

  const handleExport = async () => {
    if (!user?.token) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const { blob, filename } = await exportSongsBlob(user.token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportMsg({ text: (e as Error).message, color: 'var(--danger)' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="lg"><PageTitle className="view-title">Settings</PageTitle></Group>
      <OfflineLibrarySettings />
      <Box component="fieldset" disabled={readOnly} bd={0} p={0} m={0} miw={0} mt="lg">
      <div className="settings-grid">
        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>Change Password</Title>
          {demoMode ? (
            <Text size="sm" c="dimmed">Disabled in demo mode</Text>
          ) : (
            <Stack gap="sm" renderRoot={(props) => <form {...props} onSubmit={passwordForm.onSubmit(changePassword)} />}>
              <PasswordInput label={<>Current Password</>} type="password" {...passwordForm.getInputProps('currentPw')} autoComplete="current-password" />
              <PasswordInput label={<>New Password</>} type="password" {...passwordForm.getInputProps('newPw')} autoComplete="new-password" />
              <PasswordInput label={<>Confirm New Password</>} type="password" {...passwordForm.getInputProps('confirmPw')} autoComplete="new-password" />
              <Button style={{ alignSelf: 'flex-start' }} type="submit" loading={changingPassword} disabled={changingPassword}>Change Password</Button>
              {pwMsg && <Text size="sm" c={pwMsg.color} role={pwMsg.color === 'var(--danger)' ? 'alert' : 'status'}>{pwMsg.text}</Text>}
            </Stack>
          )}
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>My Languages</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Your preferred languages appear at the top of the language picker when creating songs.
          </Text>
          <Stack gap="sm">
            <Group gap="xs">
              {preferredLangs.map(code => (
                <Pill key={code} size="md" withRemoveButton onRemove={() => removeLang(code)} removeButtonProps={{ 'aria-label': `Remove ${languageName(code)}`, 'aria-hidden': false, tabIndex: 0 }}>
                  {languageName(code)}
                </Pill>
              ))}
              {preferredLangs.length === 0 && <Text size="sm" c="dimmed">No languages set</Text>}
            </Group>
            {preferredLangs.length < MAX_PREFERRED_LANGUAGES && (
              <Select searchable label="Add a language" placeholder="Search languages" value={null} data={LANGUAGES.filter(language => !preferredLangs.includes(language.code)).map(language => ({ value: language.code, label: `${language.name} (${language.code})` }))} onChange={(value) => { if (value) void addLang(value); }} />
            )}
            {langMsg && <Text size="sm" c={langMsg.color} role={langMsg.color === 'var(--danger)' ? 'alert' : 'status'}>{langMsg.text}</Text>}
          </Stack>
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>{isAdmin ? 'Import & Export' : 'Export Songs'}</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Download all songs you can access as ChordPro (.cho) files in a zip.
            {isAdmin ? ' As an admin, you can also bulk import ChordPro files into the library.' : ''}
          </Text>
          <Stack gap="sm">
            <Group>
              {isAdmin && (
                <Button size="xs" className="btn btn-sm" onClick={openImport}>Import Songs</Button>
              )}
              <Button size="xs" className="btn btn-sm" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting…' : 'Export Songs'}
              </Button>
            </Group>
            {exportMsg && <Text size="sm" c={exportMsg.color} role={exportMsg.color === 'var(--danger)' ? 'alert' : 'status'}>{exportMsg.text}</Text>}
          </Stack>
          <ImportModal opened={showImport} onClose={closeImport} onDone={() => {}} />
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>OCR: API Key</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Smart OCR uses Google Gemini to extract chords from photos with higher accuracy. Get a free API key at{' '}
            <Anchor href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" inherit>aistudio.google.com/apikey</Anchor>
          </Text>
          <GeminiKeySettings />
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>OCR: Model &amp; Prompt</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Choose which Gemini model to use for OCR and customize the extraction prompt. You can also change the model per-extraction in the OCR modal.
          </Text>
          <Stack gap="sm">
            <Box>
              <NativeSelect label={<>Model</>}
                value={ocrModel}
                onChange={(e) => saveOcrModel(e.target.value)}
              >
                {modelList.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </NativeSelect>
              {modelMsg && <Text size="sm" mt={4} c={modelMsg.color} role={modelMsg.color === 'var(--danger)' ? 'alert' : 'status'}>{modelMsg.text}</Text>}
            </Box>
            <Box>
              <Textarea label={<>Prompt</>}
                value={ocrPrompt}
                onChange={(e) => setOcrPrompt(e.target.value)}
                placeholder={defaultPrompt}
                rows={7}
                maxLength={MAX_OCR_PROMPT}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' } }}
              />
              <Text size="xs" c="dimmed" ta="right" mt={4}>
                {ocrPrompt.length} / {MAX_OCR_PROMPT}
              </Text>
            </Box>
            <Group gap="xs">
              <Button size="xs" className="btn btn-sm" onClick={saveOcrPrompt}>Save Prompt</Button>
              {!ocrPrompt && (
                <Button size="xs" className="btn btn-sm" style={{ background: 'var(--surface-alt, var(--surface))' }} onClick={() => setOcrPrompt(defaultPrompt)}>
                  Copy Default
                </Button>
              )}
              {hasCustomPrompt && (
                <Button color="red" size="xs" className="btn btn-danger btn-sm" onClick={resetOcrPrompt}>Reset to Default</Button>
              )}
            </Group>
            {promptMsg && <Text size="sm" c={promptMsg.color} role={promptMsg.color === 'var(--danger)' ? 'alert' : 'status'}>{promptMsg.text}</Text>}
          </Stack>
        </Paper>
      </div>
      </Box>
    </>
  );
}
