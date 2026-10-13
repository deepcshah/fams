import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { normalizeDateInput } from '@/lib/dates';
import { childrenOf, fullName, kinshipLabel, parentsOf, partnersOf, siblingsOf } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { SegmentedControl, TextField } from './Field';
import { AppText } from './Text';

const RELATION_LABELS: { key: 'parent' | 'partner' | 'child' | 'sibling'; label: string; icon: IconName }[] = [
  { key: 'parent', label: 'Parent', icon: 'chevronUp' },
  { key: 'partner', label: 'Partner', icon: 'heart' },
  { key: 'sibling', label: 'Sibling', icon: 'swap' },
  { key: 'child', label: 'Child', icon: 'chevronDown' },
];

function SectionHead({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <AppText variant="sectionLabel" tone="faint" style={{ marginTop: theme.space.xl, marginBottom: theme.space.md }}>
      {title}
    </AppText>
  );
}

/**
 * The detail panel's build-mode face. Deliberately the same surface in the same
 * place as the read-only view — flipping the toggle should feel like the page
 * waking up, not like being sent somewhere else. Every field commits on blur so
 * there is no save button to forget.
 */
export function PersonQuickEdit({
  person,
  onGoToPerson,
  onAddRelative,
  onRemove,
  contentInset = 0,
}: {
  person: Person;
  onGoToPerson: (id: string) => void;
  onAddRelative: (id: string, relation: 'parent' | 'partner' | 'child' | 'sibling') => void;
  onRemove: (id: string) => void;
  contentInset?: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const people = useFamilyStore((state) => state.tree.people);
  const updatePerson = useFamilyStore((state) => state.updatePerson);
  const unlinkParent = useFamilyStore((state) => state.unlinkParent);
  const unlinkPartner = useFamilyStore((state) => state.unlinkPartner);

  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName ?? '');
  const [birthDate, setBirthDate] = useState(person.birthDate ?? '');
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? '');
  const [deathDate, setDeathDate] = useState(person.deathDate ?? '');

  // The person can change under us when another card is tapped.
  const [editingId, setEditingId] = useState(person.id);
  if (editingId !== person.id) {
    setEditingId(person.id);
    setFirstName(person.firstName);
    setLastName(person.lastName ?? '');
    setBirthDate(person.birthDate ?? '');
    setBirthPlace(person.birthPlace ?? '');
    setDeathDate(person.deathDate ?? '');
  }

  const deceased = person.deceased || Boolean(person.deathDate);

  const relatives = [
    ...parentsOf(people, person.id).map((p) => ({ person: p, kind: 'parent' as const })),
    ...partnersOf(people, person.id).map((p) => ({ person: p, kind: 'partner' as const })),
    ...siblingsOf(people, person.id).map((p) => ({ person: p, kind: 'sibling' as const })),
    ...childrenOf(people, person.id).map((p) => ({ person: p, kind: 'child' as const })),
  ];

  function unlink(kind: 'parent' | 'partner' | 'sibling' | 'child', otherId: string) {
    if (kind === 'parent') unlinkParent(person.id, otherId);
    if (kind === 'partner') unlinkPartner(person.id, otherId);
    if (kind === 'child') unlinkParent(otherId, person.id);
    if (kind === 'sibling') {
      const other = people[otherId];
      if (!other) return;
      const shared = new Set(person.parentIds);
      updatePerson(otherId, { parentIds: other.parentIds.filter((id) => !shared.has(id)) });
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.space.xl, paddingBottom: theme.space.xxxl + contentInset }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, marginBottom: theme.space.lg }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: theme.colors.accent,
          }}
        />
        <AppText variant="sectionLabel" tone="accent">
          Editing
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <TextField
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          onBlur={() => updatePerson(person.id, { firstName: firstName.trim() || 'Unnamed' })}
          autoCapitalize="words"
          style={{ flex: 1 }}
        />
        <TextField
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          onBlur={() => updatePerson(person.id, { lastName: lastName.trim() || undefined })}
          autoCapitalize="words"
          style={{ flex: 1 }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.md, marginTop: theme.space.md }}>
        <TextField
          label="Born"
          value={birthDate}
          onChangeText={setBirthDate}
          onBlur={() => {
            const next = birthDate ? normalizeDateInput(birthDate) : '';
            setBirthDate(next);
            updatePerson(person.id, { birthDate: next || undefined });
          }}
          placeholder="1985"
          autoCapitalize="none"
          style={{ flex: 1 }}
        />
        <TextField
          label="Birthplace"
          value={birthPlace}
          onChangeText={setBirthPlace}
          onBlur={() => updatePerson(person.id, { birthPlace: birthPlace.trim() || undefined })}
          placeholder="Manchester"
          style={{ flex: 1.4 }}
        />
      </View>

      <View style={{ marginTop: theme.space.md }}>
        <SegmentedControl
          label="Status"
          options={[
            { value: 'living', label: 'Living' },
            { value: 'deceased', label: 'Deceased' },
          ]}
          value={deceased ? 'deceased' : 'living'}
          onChange={(value) =>
            updatePerson(person.id, {
              deceased: value === 'deceased',
              deathDate: value === 'deceased' ? person.deathDate : undefined,
            })
          }
        />
      </View>

      {deceased ? (
        <View style={{ marginTop: theme.space.md }}>
          <TextField
            label="Died"
            value={deathDate}
            onChangeText={setDeathDate}
            onBlur={() => {
              const next = deathDate ? normalizeDateInput(deathDate) : '';
              setDeathDate(next);
              updatePerson(person.id, { deathDate: next || undefined, deceased: true });
            }}
            placeholder="Leave blank if unknown"
            autoCapitalize="none"
          />
        </View>
      ) : null}

      <SectionHead title="Add a relative" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        {RELATION_LABELS.map((relation) => {
          const blocked =
            (relation.key === 'parent' && person.parentIds.length >= 2) ||
            (relation.key === 'sibling' && person.parentIds.length === 0);
          return (
            <Pressable
              key={relation.key}
              accessibilityRole="button"
              accessibilityLabel={`Add a ${relation.label.toLowerCase()}`}
              accessibilityState={{ disabled: blocked }}
              disabled={blocked}
              onPress={() => onAddRelative(person.id, relation.key)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 34,
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radius.pill,
                opacity: blocked ? 0.35 : pressed ? 0.7 : 1,
                backgroundColor: theme.colors.surfaceAlt,
              })}>
              <Icon name={relation.icon} size={13} color={theme.colors.textMuted} />
              <AppText variant="label">{relation.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {relatives.length > 0 ? (
        <>
          <SectionHead title="Connections" />
          {relatives.map(({ person: relative, kind }) => (
            <View
              key={`${kind}_${relative.id}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, paddingVertical: 7 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Go to ${fullName(relative)}`}
                onPress={() => onGoToPerson(relative.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, flex: 1 }}>
                <Avatar person={relative} size={32} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body" numberOfLines={1}>
                    {fullName(relative)}
                  </AppText>
                  <AppText variant="relation" tone="faint" numberOfLines={1}>
                    {kinshipLabel(people, person.id, relative.id)}
                  </AppText>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unlink ${fullName(relative)}`}
                onPress={() => unlink(kind, relative.id)}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? theme.colors.dangerSoft : 'transparent',
                })}>
                <Icon name="link" size={15} color={theme.colors.textFaint} />
              </Pressable>
            </View>
          ))}
          <AppText variant="caption" tone="faint" style={{ marginTop: theme.space.xs }}>
            Unlinking keeps the person in the tree; it only removes the connection.
          </AppText>
        </>
      ) : null}

      <SectionHead title="More" />
      <View style={{ gap: theme.space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Photos, story and moments"
          accessibilityHint="Open the full editor"
          onPress={() => router.push({ pathname: '/edit/[id]', params: { id: person.id } })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 38,
            paddingHorizontal: theme.space.md,
            borderRadius: theme.radius.md,
            backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
          })}>
          <Icon name="pencil" size={14} color={theme.colors.textMuted} />
          <AppText variant="label">Photos, story and moments…</AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove from tree"
          accessibilityHint={`Remove ${fullName(person)} and every connection to them`}
          onPress={() => onRemove(person.id)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 38,
            paddingHorizontal: theme.space.md,
            borderRadius: theme.radius.md,
            backgroundColor: pressed ? theme.colors.dangerSoft : 'transparent',
          })}>
          <Icon name="trash" size={14} color={theme.colors.danger} />
          <AppText variant="label" tone="danger">
            Remove from tree
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
