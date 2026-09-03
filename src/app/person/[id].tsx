import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AddRelativeSheet } from '@/components/AddRelativeSheet';
import { Avatar } from '@/components/Avatar';
import { Button, Chip, IconButton } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon, type IconName } from '@/components/Icon';
import { PersonListItem } from '@/components/PersonListItem';
import { Card, Divider, EmptyState, SectionHeader } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { ageOf, daysUntilBirthday, formatDate, lifespan } from '@/lib/dates';
import { childrenOf, fullName, kinshipLabel, parentsOf, partnersOf, siblingsOf } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { contentMaxWidth, useTheme } from '@/theme';
import { unionKey, type Person, type UnionStatus } from '@/types';

const UNION_LABEL: Record<UnionStatus, string> = {
  married: 'Married',
  partners: 'Partners',
  engaged: 'Engaged',
  separated: 'Separated',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.md, paddingVertical: theme.space.sm }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceAlt,
        }}>
        <Icon name={icon} size={16} color={theme.colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="caption" tone="faint">
          {label}
        </AppText>
        <AppText variant="body">{value}</AppText>
      </View>
    </View>
  );
}

function FamilyGroup({
  title,
  people,
  onPick,
  subtitleFor,
  empty,
}: {
  title: string;
  people: Person[];
  onPick: (id: string) => void;
  subtitleFor?: (person: Person) => string | undefined;
  empty?: string;
}) {
  const theme = useTheme();
  return (
    <View>
      <SectionHeader title={title} />
      <Card padded={false}>
        {people.length === 0 ? (
          <AppText variant="body" tone="faint" style={{ padding: theme.space.lg }}>
            {empty ?? 'None recorded'}
          </AppText>
        ) : (
          people.map((person, index) => (
            <View key={person.id}>
              {index > 0 ? <Divider inset={72} /> : null}
              <PersonListItem
                person={person}
                subtitle={subtitleFor?.(person)}
                trailing="chevron"
                onPress={() => onPick(person.id)}
              />
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

export default function PersonScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const people = useFamilyStore((state) => state.tree.people);
  const unions = useFamilyStore((state) => state.tree.unions);
  const homeId = useFamilyStore((state) => state.tree.homeId);
  const setHome = useFamilyStore((state) => state.setHome);
  const setLineage = useFamilyStore((state) => state.setLineage);
  const deletePerson = useFamilyStore((state) => state.deletePerson);

  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const person = id ? people[id] : undefined;

  const family = useMemo(() => {
    if (!person) return { parents: [], partners: [], siblings: [], children: [] };
    return {
      parents: parentsOf(people, person.id),
      partners: partnersOf(people, person.id),
      siblings: siblingsOf(people, person.id),
      children: childrenOf(people, person.id),
    };
  }, [people, person]);

  const kinship = useMemo(() => {
    if (!person || !homeId || homeId === person.id) return undefined;
    return kinshipLabel(people, homeId, person.id);
  }, [homeId, people, person]);

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

  const age = ageOf(person);
  const years = lifespan(person.birthDate, person.deathDate);
  const birthdayIn = person.deathDate ? null : daysUntilBirthday(person.birthDate);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + theme.space.xxxl,
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.space.lg }}>
          <IconButton icon="arrowLeft" label="Go back" onPress={() => router.back()} />
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <IconButton
              icon="pencil"
              label="Edit this person"
              onPress={() => router.push({ pathname: '/edit/[id]', params: { id: person.id } })}
            />
            <IconButton icon="trash" label="Remove this person" onPress={() => setConfirmDelete(true)} />
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Avatar person={person} size={104} ring={homeId === person.id ? theme.colors.accent : undefined} />
          <AppText variant="display" style={{ textAlign: 'center' }}>
            {fullName(person)}
          </AppText>
          {person.birthName && person.birthName !== person.lastName ? (
            <AppText variant="body" tone="muted">
              née {person.birthName}
            </AppText>
          ) : null}
          {person.nickname ? (
            <AppText variant="body" tone="muted">
              “{person.nickname}”
            </AppText>
          ) : null}

          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
            {years ? <Chip label={years} icon="calendar" /> : null}
            {age ? <Chip label={age.atDeath ? `${age.years} years lived` : `${age.years} years old`} icon="clock" /> : null}
            {kinship ? <Chip label={`Your ${kinship}`} icon="users" selected tone="accent" /> : null}
            {homeId === person.id ? <Chip label="This is you" icon="star" selected /> : null}
          </View>

          {birthdayIn !== null && birthdayIn <= 30 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: theme.space.xs,
                paddingHorizontal: theme.space.md,
                height: 30,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.sageSoft,
              }}>
              <Icon name="cake" size={14} color={theme.colors.sage} />
              <AppText variant="label" style={{ color: theme.colors.sage }}>
                {birthdayIn === 0 ? 'Birthday is today' : `Birthday in ${birthdayIn} ${birthdayIn === 1 ? 'day' : 'days'}`}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.xl, flexWrap: 'wrap' }}>
          <Button label="Add relative" icon="plus" onPress={() => setAddOpen(true)} />
          <Button
            label="Show in tree"
            icon="tree"
            variant="secondary"
            onPress={() => {
              setLineage(undefined);
              router.dismissTo('/');
            }}
          />
          {homeId === person.id ? null : (
            <Button label="Set as me" icon="star" variant="ghost" onPress={() => setHome(person.id)} />
          )}
        </View>

        {person.bio ? (
          <>
            <SectionHeader title="Story" />
            <Card>
              <AppText variant="body" style={{ lineHeight: 23 }}>
                {person.bio}
              </AppText>
            </Card>
          </>
        ) : null}

        <SectionHeader title="Details" />
        <Card padded={false} style={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm }}>
          {person.birthDate ? <Fact icon="cake" label="Born" value={formatDate(person.birthDate)} /> : null}
          {person.birthPlace ? <Fact icon="pin" label="Birthplace" value={person.birthPlace} /> : null}
          {person.deathDate ? <Fact icon="calendar" label="Died" value={formatDate(person.deathDate)} /> : null}
          {person.occupation ? <Fact icon="briefcase" label="Work" value={person.occupation} /> : null}
          {!person.birthDate && !person.birthPlace && !person.deathDate && !person.occupation ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/edit/[id]', params: { id: person.id } })}
              style={{ paddingVertical: theme.space.md }}>
              <AppText variant="body" tone="faint">
                Nothing recorded yet — tap to add dates, places and work.
              </AppText>
            </Pressable>
          ) : null}
        </Card>

        <FamilyGroup title="Parents" people={family.parents} onPick={(pid) => router.push({ pathname: '/person/[id]', params: { id: pid } })} />
        <FamilyGroup
          title="Partners"
          people={family.partners}
          onPick={(pid) => router.push({ pathname: '/person/[id]', params: { id: pid } })}
          subtitleFor={(partner) => {
            const union = unions[unionKey(person.id, partner.id)];
            if (!union) return undefined;
            return union.since ? `${UNION_LABEL[union.status]} · ${formatDate(union.since)}` : UNION_LABEL[union.status];
          }}
        />
        <FamilyGroup title="Siblings" people={family.siblings} onPick={(pid) => router.push({ pathname: '/person/[id]', params: { id: pid } })} />
        <FamilyGroup title="Children" people={family.children} onPick={(pid) => router.push({ pathname: '/person/[id]', params: { id: pid } })} />
      </ScrollView>

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
