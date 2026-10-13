import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, IconButton } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SegmentedControl, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, Divider, SectionHeader } from '@/components/Surface';
import { AppText } from '@/components/Text';
import type { Invite, Member, Role } from '@/lib/sync';
import { useSyncStore } from '@/store/syncStore';
import { contentMaxWidth, useTheme } from '@/theme';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'viewer', label: 'Can view' },
  { value: 'editor', label: 'Can edit' },
];

function roleWord(role: Role): string {
  return role === 'owner' ? 'Owner' : role === 'editor' ? 'Can edit' : 'Can view';
}

export default function ShareScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const trees = useSyncStore((state) => state.trees);
  const loadMembers = useSyncStore((state) => state.loadMembers);
  const invite = useSyncStore((state) => state.invite);
  const revokeInvite = useSyncStore((state) => state.revokeInvite);
  const setRole = useSyncStore((state) => state.setRole);
  const removeMember = useSyncStore((state) => state.removeMember);
  const message = useSyncStore((state) => state.message);
  const error = useSyncStore((state) => state.error);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRoleChoice] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  const tree = trees.find((item) => item.id === id);

  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await loadMembers(id).catch(() => ({ members: [], invites: [] }));
    setMembers(result.members);
    setInvites(result.invites);
  }, [id, loadMembers]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const result = await loadMembers(id).catch(() => ({ members: [], invites: [] }));
      if (cancelled) return;
      setMembers(result.members);
      setInvites(result.invites);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadMembers]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          paddingTop: insets.top + theme.space.sm,
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.sm,
        }}>
        <IconButton icon="arrowLeft" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <AppText variant="nameLG" numberOfLines={1}>
            Share
          </AppText>
          {tree ? (
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {tree.name}
            </AppText>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.xxxl,
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
        }}
        keyboardShouldPersistTaps="handled">
        <SectionHeader title="Invite someone" />
        <Card style={{ gap: theme.space.md }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="aunt@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <SegmentedControl label="They can" options={ROLE_OPTIONS} value={role} onChange={setRoleChoice} />
          <Button
            label="Send invitation"
            icon="plus"
            disabled={!/.+@.+\..+/.test(email) || busy}
            onPress={async () => {
              if (!id) return;
              setBusy(true);
              await invite(id, email, role);
              setEmail('');
              await refresh();
              setBusy(false);
            }}
          />
          <AppText variant="caption" tone="faint">
            They join the moment they sign in with that address. Nothing is sent until they do — there is no email from
            us beyond their own sign-in code.
          </AppText>
        </Card>

        <SectionHeader title="People with access" />
        <Card padded={false}>
          {members.length === 0 ? (
            <AppText variant="caption" tone="faint" style={{ padding: theme.space.lg }}>
              Just you so far.
            </AppText>
          ) : (
            members.map((member, index) => (
              <View key={member.userId}>
                {index > 0 ? <Divider inset={theme.space.lg} /> : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space.md,
                    paddingHorizontal: theme.space.lg,
                    paddingVertical: theme.space.md,
                  }}>
                  <Icon name="user" size={16} color={theme.colors.textFaint} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body" numberOfLines={1}>
                      {member.email ?? 'Someone'}
                      {member.isYou ? ' (you)' : ''}
                    </AppText>
                    <AppText variant="relation" tone="faint">
                      {roleWord(member.role)}
                    </AppText>
                  </View>
                  {member.role === 'owner' || member.isYou ? null : (
                    <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Make ${member.email ?? 'them'} ${
                          member.role === 'editor' ? 'a viewer' : 'an editor'
                        }`}
                        onPress={async () => {
                          if (!id) return;
                          await setRole(id, member.userId, member.role === 'editor' ? 'viewer' : 'editor');
                          await refresh();
                        }}
                        hitSlop={8}>
                        <Icon name="swap" size={16} color={theme.colors.textMuted} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${member.email ?? 'them'}`}
                        onPress={() => setConfirmRemove(member)}
                        hitSlop={8}>
                        <Icon name="close" size={16} color={theme.colors.danger} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>

        {invites.length > 0 ? (
          <>
            <SectionHeader title="Waiting to join" />
            <Card padded={false}>
              {invites.map((pending, index) => (
                <View key={pending.id}>
                  {index > 0 ? <Divider inset={theme.space.lg} /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.space.md,
                      paddingHorizontal: theme.space.lg,
                      paddingVertical: theme.space.md,
                    }}>
                    <Icon name="clock" size={16} color={theme.colors.textFaint} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="body" numberOfLines={1}>
                        {pending.email}
                      </AppText>
                      <AppText variant="relation" tone="faint">
                        {roleWord(pending.role)}
                      </AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel the invitation to ${pending.email}`}
                      onPress={async () => {
                        await revokeInvite(pending.id);
                        await refresh();
                      }}
                      hitSlop={8}>
                      <Icon name="close" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {error ? (
          <AppText variant="caption" tone="danger" style={{ marginTop: theme.space.lg }}>
            {error}
          </AppText>
        ) : message ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: theme.space.lg }}>
            {message}
          </AppText>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={Boolean(confirmRemove)}
        title={`Remove ${confirmRemove?.email ?? 'this person'}?`}
        message="They lose access to this tree. Anything they already added stays."
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const target = confirmRemove;
          setConfirmRemove(null);
          if (id && target) {
            await removeMember(id, target.userId);
            await refresh();
          }
        }}
      />
    </View>
  );
}
