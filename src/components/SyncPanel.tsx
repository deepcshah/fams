import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useFamilyStore } from '@/store/familyStore';
import { useSyncStore } from '@/store/syncStore';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { SettingRow, TextField } from './Field';
import { Icon } from './Icon';
import { Card, Divider } from './Surface';
import { AppText } from './Text';

function relativeTime(at?: number): string {
  if (!at) return 'never';
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

function StatusDot({ tone }: { tone: 'ok' | 'busy' | 'bad' | 'off' }) {
  const theme = useTheme();
  const color =
    tone === 'ok'
      ? theme.colors.accent
      : tone === 'busy'
        ? theme.colors.textMuted
        : tone === 'bad'
          ? theme.colors.danger
          : theme.colors.borderStrong;
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

/** Sign in, choose which tree this device follows, and share it. */
export function SyncPanel() {
  const theme = useTheme();
  const router = useRouter();

  const treeName = useFamilyStore((state) => state.tree.name);
  const peopleCount = useFamilyStore((state) => Object.keys(state.tree.people).length);

  const configured = useSyncStore((state) => state.configured);
  const user = useSyncStore((state) => state.user);
  const status = useSyncStore((state) => state.status);
  const message = useSyncStore((state) => state.message);
  const error = useSyncStore((state) => state.error);
  const trees = useSyncStore((state) => state.trees);
  const activeTreeId = useSyncStore((state) => state.activeTreeId);
  const role = useSyncStore((state) => state.role);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const awaitingCodeFor = useSyncStore((state) => state.awaitingCodeFor);

  const sendCode = useSyncStore((state) => state.sendCode);
  const verifyCode = useSyncStore((state) => state.verifyCode);
  const cancelCode = useSyncStore((state) => state.cancelCode);
  const signOut = useSyncStore((state) => state.signOut);
  const publishCurrentTree = useSyncStore((state) => state.publishCurrentTree);
  const connectTree = useSyncStore((state) => state.connectTree);
  const disconnect = useSyncStore((state) => state.disconnect);
  const syncNow = useSyncStore((state) => state.syncNow);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  // Leaving the code step should not leave a stale code behind.
  const [lastStep, setLastStep] = useState(awaitingCodeFor);
  if (lastStep !== awaitingCodeFor) {
    setLastStep(awaitingCodeFor);
    setCode('');
  }

  const active = useMemo(() => trees.find((tree) => tree.id === activeTreeId), [activeTreeId, trees]);

  if (!configured) {
    return (
      <Card style={{ gap: theme.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <StatusDot tone="off" />
          <AppText variant="bodyStrong">On this device only</AppText>
        </View>
        <AppText variant="caption" tone="muted">
          No backend is configured, so nothing leaves this device. To turn on accounts, sharing and photo backup, set
          EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY and run supabase/schema.sql in your project.
        </AppText>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card style={{ gap: theme.space.lg }}>
        <View style={{ gap: 4 }}>
          <AppText variant="bodyStrong">Sign in</AppText>
          <AppText variant="caption" tone="muted">
            We email you a six-digit code. No password to forget, and your tree keeps working on this device either
            way.
          </AppText>
        </View>

        {awaitingCodeFor ? (
          <>
            <TextField
              label={`Code sent to ${awaitingCodeFor}`}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              autoCapitalize="none"
              autoComplete="one-time-code"
            />
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <Button
                label="Sign in"
                icon="check"
                disabled={code.trim().length < 6 || status === 'working'}
                onPress={() => verifyCode(code)}
              />
              <Button label="Use another email" variant="ghost" onPress={cancelCode} />
            </View>
          </>
        ) : (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Button
              label="Email me a code"
              icon="check"
              disabled={!/.+@.+\..+/.test(email) || status === 'working'}
              onPress={() => sendCode(email)}
            />
          </>
        )}

        {error ? (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        ) : message ? (
          <AppText variant="caption" tone="muted">
            {message}
          </AppText>
        ) : null}
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.space.md }}>
      <Card padded={false}>
        <SettingRow
          title={user.email ?? 'Signed in'}
          subtitle={
            active
              ? `Following “${active.name}” · ${role ?? 'viewer'} · synced ${relativeTime(lastSyncedAt)}`
              : 'This device is not following a tree yet'
          }
          leading={<StatusDot tone={status === 'working' ? 'busy' : status === 'error' ? 'bad' : active ? 'ok' : 'off'} />}
          right={<Button label="Sign out" size="sm" variant="ghost" onPress={signOut} />}
        />
      </Card>

      {active ? (
        <Card style={{ gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
            <Button
              label={status === 'working' ? 'Syncing…' : 'Sync now'}
              icon="swap"
              size="sm"
              disabled={status === 'working'}
              onPress={() => syncNow()}
            />
            {role === 'owner' ? (
              <Button
                label="Share"
                icon="users"
                size="sm"
                variant="secondary"
                onPress={() => router.push({ pathname: '/share/[id]', params: { id: active.id } })}
              />
            ) : null}
            <Button label="Stop following" size="sm" variant="ghost" onPress={disconnect} />
          </View>
          {role === 'viewer' ? (
            <AppText variant="caption" tone="muted">
              You have view access, so changes you make here stay on this device.
            </AppText>
          ) : null}
        </Card>
      ) : (
        <Card style={{ gap: theme.space.md }}>
          <AppText variant="bodyStrong">Back up this tree</AppText>
          <AppText variant="caption" tone="muted">
            “{treeName}” with {peopleCount} {peopleCount === 1 ? 'person' : 'people'} is on this device only. Publishing
            copies it to your account so other devices and the people you invite can see it.
          </AppText>
          <Button label="Publish this tree" icon="upload" onPress={() => publishCurrentTree(treeName)} />
        </Card>
      )}

      {trees.length > 0 ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.lg, paddingBottom: theme.space.sm }}>
            <AppText variant="sectionLabel" tone="faint">
              Your trees
            </AppText>
          </View>
          {trees.map((tree, index) => (
            <View key={tree.id}>
              {index > 0 ? <Divider inset={theme.space.lg} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Follow ${tree.name}`}
                accessibilityState={{ selected: tree.id === activeTreeId }}
                onPress={() => connectTree(tree.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.md,
                  paddingHorizontal: theme.space.lg,
                  paddingVertical: theme.space.md,
                  backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
                })}>
                <Icon
                  name={tree.id === activeTreeId ? 'check' : 'tree'}
                  size={16}
                  color={tree.id === activeTreeId ? theme.colors.accent : theme.colors.textFaint}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body">{tree.name}</AppText>
                  <AppText variant="relation" tone="faint">
                    {tree.role}
                  </AppText>
                </View>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : message ? (
        <AppText variant="caption" tone="muted">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}
