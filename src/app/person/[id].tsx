import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AddRelativeSheet } from '@/components/AddRelativeSheet';
import { Button, IconButton } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { PersonDetail } from '@/components/PersonDetail';
import { EmptyState } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { fullName } from '@/lib/relations';
import { contentMaxWidth, useTheme } from '@/theme';
import { useFamilyStore } from '@/store/familyStore';

function PillAction({ label, icon, onPress }: { label: string; icon: 'star' | 'tree'; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        height: 34,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.pill,
        backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
      })}>
      <Icon name={icon} size={14} color={theme.colors.textMuted} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

export default function PersonScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const person = useFamilyStore((state) => (id ? state.tree.people[id] : undefined));
  const homeId = useFamilyStore((state) => state.tree.homeId);
  const setHome = useFamilyStore((state) => state.setHome);
  const setLineage = useFamilyStore((state) => state.setLineage);
  const deletePerson = useFamilyStore((state) => state.deletePerson);

  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!person) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center' }}>
        <EmptyState
          title="This person is no longer in the tree"
          message="They may have been removed."
          action={<Button label="Back to the tree" icon="arrowLeft" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + theme.space.sm,
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.sm,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the family tree"
          onPress={() => router.back()}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 36,
            paddingLeft: theme.space.sm,
            paddingRight: theme.space.md,
            borderRadius: theme.radius.pill,
            backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          })}>
          <Icon name="chevronLeft" size={16} color={theme.colors.text} />
          <AppText variant="label">Family tree</AppText>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <IconButton
            icon="pencil"
            label="Edit this person"
            size={36}
            onPress={() => router.push({ pathname: '/edit/[id]', params: { id: person.id } })}
          />
          <IconButton icon="trash" label="Remove this person" size={36} onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth }}>
        <PersonDetail
          person={person}
          contentInset={insets.bottom}
          onGoToPerson={(pid) => router.push({ pathname: '/person/[id]', params: { id: pid } })}
          onAddRelative={() => setAddOpen(true)}
          onOpenCanvas={(pid) => router.push({ pathname: '/life/[id]', params: { id: pid } })}
          extraActions={
            <>
              <PillAction
                label="Show in tree"
                icon="tree"
                onPress={() => {
                  setLineage(undefined);
                  router.dismissTo('/');
                }}
              />
              {homeId === person.id ? null : (
                <PillAction label="Set as me" icon="star" onPress={() => setHome(person.id)} />
              )}
            </>
          }
        />
      </View>

      <AddRelativeSheet anchorId={person.id} visible={addOpen} onClose={() => setAddOpen(false)} />

      <ConfirmDialog
        visible={confirmDelete}
        title={`Remove ${fullName(person)}?`}
        message="They will be taken out of the tree and unlinked from every relative. This cannot be undone."
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deletePerson(person.id);
          router.back();
        }}
      />
    </View>
  );
}
