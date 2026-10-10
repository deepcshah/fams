import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SegmentedControl, SettingRow, TextField, ToggleRow } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { PersonPicker } from '@/components/PersonPicker';
import { Card, Divider, SectionHeader } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { fullName } from '@/lib/relations';
import { exportTreeJson, pickTreeJson } from '@/lib/transfer';
import { useFamilyStore, type ColorSchemePreference } from '@/store/familyStore';
import { contentMaxWidth, useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const tree = useFamilyStore((state) => state.tree);
  const settings = useFamilyStore((state) => state.settings);
  const updateSettings = useFamilyStore((state) => state.updateSettings);
  const renameTree = useFamilyStore((state) => state.renameTree);
  const setHome = useFamilyStore((state) => state.setHome);
  const exportPayload = useFamilyStore((state) => state.exportPayload);
  const importTree = useFamilyStore((state) => state.importTree);
  const loadSample = useFamilyStore((state) => state.loadSample);
  const clearTree = useFamilyStore((state) => state.clearTree);

  const [name, setName] = useState(tree.name);
  const [status, setStatus] = useState<string | null>(null);
  const [homePickerOpen, setHomePickerOpen] = useState(false);
  const [confirm, setConfirm] = useState<'clear' | 'sample' | null>(null);
  const [busy, setBusy] = useState(false);

  const people = Object.values(tree.people);
  const home = tree.homeId ? tree.people[tree.homeId] : undefined;

  async function handleExport() {
    setBusy(true);
    const result = await exportTreeJson(JSON.stringify(exportPayload(), null, 2), tree.name);
    setStatus(result.message);
    setBusy(false);
  }

  async function handleImport() {
    setBusy(true);
    const picked = await pickTreeJson();
    if (!picked.ok) {
      setStatus(picked.message);
      setBusy(false);
      return;
    }
    const result = importTree(picked.text);
    setStatus(result.ok ? `Imported ${result.count} people.` : result.error);
    if (result.ok) setName(useFamilyStore.getState().tree.name);
    setBusy(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{
        paddingHorizontal: theme.space.lg,
        paddingTop: insets.top + theme.space.md,
        paddingBottom: insets.bottom + 110,
        alignSelf: 'center',
        width: '100%',
        maxWidth: contentMaxWidth,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <AppText variant="nameLG">Settings</AppText>

      <SectionHeader title="This tree" />
      <Card style={{ gap: theme.space.lg }}>
        <TextField
          label="Tree name"
          value={name}
          onChangeText={setName}
          onBlur={() => renameTree(name)}
          placeholder="The Nwosu–Hart Family"
        />
        <View style={{ gap: 6 }}>
          <AppText variant="label" tone="muted">
            Who are you?
          </AppText>
          <Button
            label={home ? fullName(home) : 'Choose yourself in the tree'}
            icon="star"
            variant="secondary"
            fullWidth
            onPress={() => setHomePickerOpen(true)}
          />
          <AppText variant="caption" tone="faint">
            Relationships elsewhere in the app are described relative to this person.
          </AppText>
        </View>
      </Card>

      <SectionHeader title="Appearance" />
      <Card padded={false} style={{ paddingVertical: theme.space.sm }}>
        <View style={{ padding: theme.space.lg, paddingBottom: theme.space.sm }}>
          <SegmentedControl<ColorSchemePreference>
            label="Theme"
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={settings.colorScheme}
            onChange={(value) => updateSettings({ colorScheme: value })}
          />
        </View>
        <Divider inset={theme.space.lg} />
        <ToggleRow
          title="Years on cards"
          subtitle="Show birth and death years under each name"
          value={settings.showLifespans}
          onChange={(value) => updateSettings({ showLifespans: value })}
        />
      </Card>

      <SectionHeader title="Your data" />
      <Card padded={false}>
        <SettingRow
          title="Export tree"
          subtitle="Save everything as a JSON file you own"
          leading={<Icon name="download" size={20} color={theme.colors.textMuted} />}
          right={<Button label="Export" size="sm" variant="secondary" disabled={busy} onPress={handleExport} />}
        />
        <Divider inset={theme.space.lg} />
        <SettingRow
          title="Import tree"
          subtitle="Replace this tree with a previously exported file"
          leading={<Icon name="upload" size={20} color={theme.colors.textMuted} />}
          right={<Button label="Import" size="sm" variant="secondary" disabled={busy} onPress={handleImport} />}
        />
        <Divider inset={theme.space.lg} />
        <SettingRow
          title="Load the sample family"
          subtitle="Four generations to explore"
          leading={<Icon name="sparkle" size={20} color={theme.colors.textMuted} />}
          right={<Button label="Load" size="sm" variant="ghost" onPress={() => setConfirm('sample')} />}
        />
        <Divider inset={theme.space.lg} />
        <SettingRow
          title="Start over"
          subtitle={`Remove all ${people.length} people`}
          leading={<Icon name="trash" size={20} color={theme.colors.danger} />}
          right={<Button label="Clear" size="sm" variant="danger" onPress={() => setConfirm('clear')} />}
        />
      </Card>

      {status ? (
        <Card style={{ marginTop: theme.space.md, flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Icon name="info" size={18} color={theme.colors.accent} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            {status}
          </AppText>
        </Card>
      ) : null}

      <SectionHeader title="About" />
      <Card style={{ gap: theme.space.sm }}>
        <AppText variant="bodyStrong">Fams {Constants.expoConfig?.version ?? ''}</AppText>
        <AppText variant="body" tone="muted">
          Everything lives on this device. Nothing is uploaded, and the export file is plain JSON so your family
          history is never locked in.
        </AppText>
      </Card>

      <PersonPicker
        visible={homePickerOpen}
        onClose={() => setHomePickerOpen(false)}
        title="Which one is you?"
        subtitle="Pick yourself and the app will name everybody else relative to you."
        people={people}
        onSelect={(person) => {
          setHome(person.id);
          setHomePickerOpen(false);
        }}
      />

      <ConfirmDialog
        visible={confirm !== null}
        title={confirm === 'clear' ? 'Remove everyone?' : 'Replace this tree with the sample?'}
        message={
          confirm === 'clear'
            ? 'Every person, photo and connection in this tree will be deleted. Export first if you want a copy.'
            : 'Your current tree will be replaced by the four-generation sample family.'
        }
        confirmLabel={confirm === 'clear' ? 'Remove everyone' : 'Load sample'}
        destructive={confirm === 'clear'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'clear') {
            clearTree();
            setName('My Family');
            setStatus('Tree cleared.');
          } else {
            loadSample();
            setName(useFamilyStore.getState().tree.name);
            setStatus('Sample family loaded.');
          }
          setConfirm(null);
        }}
      />
    </ScrollView>
  );
}
