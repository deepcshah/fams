import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ageOf, lifespan } from '@/lib/dates';
import { childrenOf, fullName, kinshipLabel, parentsOf, partnersOf, siblingsOf } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { Avatar } from './Avatar';
import { Button, IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { AppText } from './Text';

function Row({ icon, children }: { icon: IconName; children: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      <Icon name={icon} size={15} color={theme.colors.textFaint} />
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}

function RelativeStrip({
  label,
  people,
  onPick,
}: {
  label: string;
  people: Person[];
  onPick: (id: string) => void;
}) {
  const theme = useTheme();
  if (people.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="overline" tone="faint">
        {label.toUpperCase()}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.sm }}>
        {people.map((person) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${fullName(person)}`}
            onPress={() => onPick(person.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingRight: theme.space.md,
              paddingLeft: 6,
              paddingVertical: 6,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
            }}>
            <Avatar person={person} size={26} />
            <AppText variant="label" numberOfLines={1}>
              {person.firstName}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function PersonPreviewSheet({
  personId,
  visible,
  onClose,
  onAddRelative,
  onGoToPerson,
  onFocusBranch,
  lineageActive,
}: {
  personId?: string;
  visible: boolean;
  onClose: () => void;
  onAddRelative: (id: string) => void;
  onGoToPerson: (id: string) => void;
  onFocusBranch: (id: string) => void;
  lineageActive: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const people = useFamilyStore((state) => state.tree.people);
  const homeId = useFamilyStore((state) => state.tree.homeId);
  const setHome = useFamilyStore((state) => state.setHome);

  const person = personId ? people[personId] : undefined;

  const relatives = useMemo(() => {
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

  if (!person) return null;

  const age = ageOf(person);
  const years = lifespan(person.birthDate, person.deathDate);

  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, marginTop: theme.space.sm }}>
        <Avatar person={person} size={62} ring={homeId === person.id ? theme.colors.accent : undefined} />
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="title" numberOfLines={2}>
            {fullName(person)}
          </AppText>
          {kinship ? (
            <AppText variant="label" style={{ color: theme.colors.accent }}>
              Your {kinship}
            </AppText>
          ) : homeId === person.id ? (
            <AppText variant="label" style={{ color: theme.colors.accent }}>
              This is you
            </AppText>
          ) : null}
          {years ? (
            <AppText variant="caption" tone="muted">
              {years}
              {age ? ` · ${age.years} ${age.atDeath ? 'years lived' : 'years old'}` : ''}
            </AppText>
          ) : null}
        </View>
        <IconButton icon="close" label="Close" size={34} onPress={onClose} />
      </View>

      <View style={{ gap: 6, marginTop: theme.space.md }}>
        {person.birthName && person.birthName !== person.lastName ? <Row icon="user">{`née ${person.birthName}`}</Row> : null}
        {person.birthPlace ? <Row icon="pin">{person.birthPlace}</Row> : null}
        {person.occupation ? <Row icon="briefcase">{person.occupation}</Row> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.lg, flexWrap: 'wrap' }}>
        <Button
          label="Profile"
          icon="user"
          size="sm"
          onPress={() => {
            onClose();
            router.push({ pathname: '/person/[id]', params: { id: person.id } });
          }}
        />
        <Button label="Add relative" icon="plus" size="sm" variant="secondary" onPress={() => onAddRelative(person.id)} />
        <Button
          label={lineageActive ? 'Show everyone' : 'Focus branch'}
          icon="eye"
          size="sm"
          variant="secondary"
          onPress={() => onFocusBranch(person.id)}
        />
        {homeId === person.id ? null : (
          <Button label="Set as me" icon="star" size="sm" variant="ghost" onPress={() => setHome(person.id)} />
        )}
      </View>

      <View style={{ gap: theme.space.md, marginTop: theme.space.lg }}>
        <RelativeStrip label="Parents" people={relatives.parents} onPick={onGoToPerson} />
        <RelativeStrip label="Partners" people={relatives.partners} onPick={onGoToPerson} />
        <RelativeStrip label="Siblings" people={relatives.siblings} onPick={onGoToPerson} />
        <RelativeStrip label="Children" people={relatives.children} onPick={onGoToPerson} />
      </View>
    </Sheet>
  );
}
