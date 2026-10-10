import { useMemo, useState } from 'react';
import { SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Chip, IconButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PersonListItem } from '@/components/PersonListItem';
import { Divider, EmptyState, shadow } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { dateSortKey } from '@/lib/dates';
import { computeGenerations } from '@/lib/layout';
import { fullName, kinshipLabel, matchScore } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { contentMaxWidth, useTheme } from '@/theme';
import type { Person } from '@/types';

type SortMode = 'name' | 'generation' | 'birth';

const GENERATION_NAMES = ['Eldest generation', 'Second generation', 'Third generation', 'Fourth generation', 'Fifth generation'];

export default function PeopleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const people = useFamilyStore((state) => state.tree.people);
  const homeId = useFamilyStore((state) => state.tree.homeId);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('generation');

  const all = useMemo(() => Object.values(people), [people]);
  const generations = useMemo(() => computeGenerations(all), [all]);

  const filtered = useMemo(() => {
    if (!query.trim()) return all;
    return all
      .map((person) => ({ person, score: matchScore(person, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.person);
  }, [all, query]);

  const sections = useMemo(() => {
    if (query.trim()) {
      return [{ title: `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`, data: filtered }];
    }

    if (sort === 'generation') {
      const buckets = new Map<number, Person[]>();
      for (const person of filtered) {
        const generation = generations[person.id] ?? 0;
        const bucket = buckets.get(generation);
        if (bucket) bucket.push(person);
        else buckets.set(generation, [person]);
      }
      return [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([generation, data]) => ({
          title: GENERATION_NAMES[generation] ?? `Generation ${generation + 1}`,
          data: data.sort((a, b) => dateSortKey(a.birthDate) - dateSortKey(b.birthDate)),
        }));
    }

    if (sort === 'birth') {
      const sorted = [...filtered].sort((a, b) => dateSortKey(a.birthDate) - dateSortKey(b.birthDate));
      return [{ title: 'Oldest first', data: sorted }];
    }

    const buckets = new Map<string, Person[]>();
    for (const person of filtered) {
      const letter = (person.lastName?.[0] ?? person.firstName[0] ?? '#').toUpperCase();
      const bucket = buckets.get(letter);
      if (bucket) bucket.push(person);
      else buckets.set(letter, [person]);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([letter, data]) => ({
        title: letter,
        data: data.sort((a, b) => fullName(a).localeCompare(fullName(b))),
      }));
  }, [filtered, generations, query, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + theme.space.md,
          paddingHorizontal: theme.space.lg,
          gap: theme.space.md,
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="nameLG">People</AppText>
          <IconButton
            icon="plus"
            label="Add a person"
            variant="primary"
            onPress={() => router.push({ pathname: '/edit/[id]', params: { id: 'new' } })}
          />
        </View>

        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.sm,
              height: 46,
              paddingHorizontal: theme.space.md,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
            shadow(theme.colors.shadow, 1),
          ]}>
          <Icon name="search" size={17} color={theme.colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search names, places, work"
            placeholderTextColor={theme.colors.textFaint}
            selectionColor={theme.colors.accent}
            autoCorrect={false}
            style={[{ flex: 1, color: theme.colors.text, fontSize: 15 }, { outlineStyle: 'none' } as object]}
          />
          {query ? <IconButton icon="close" label="Clear search" size={26} variant="ghost" onPress={() => setQuery('')} /> : null}
        </View>

        {query.trim() ? null : (
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <Chip label="By generation" selected={sort === 'generation'} onPress={() => setSort('generation')} />
            <Chip label="A–Z" selected={sort === 'name'} onPress={() => setSort('name')} />
            <Chip label="By birth" selected={sort === 'birth'} onPress={() => setSort('birth')} />
          </View>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: theme.space.sm,
          paddingTop: theme.space.md,
          paddingBottom: insets.bottom + 110,
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
        }}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon={<Icon name="users" size={26} color={theme.colors.accent} />}
            title={query ? 'No matches' : 'Nobody here yet'}
            message={query ? 'Try a different name or place.' : 'Add your first relative to get started.'}
            action={
              query ? undefined : (
                <Button
                  label="Add a person"
                  icon="plus"
                  onPress={() => router.push({ pathname: '/edit/[id]', params: { id: 'new' } })}
                />
              )
            }
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingHorizontal: theme.space.md, paddingTop: theme.space.lg, paddingBottom: theme.space.xs }}>
            <AppText variant="sectionLabel" tone="faint">
              {section.title.toUpperCase()}
            </AppText>
          </View>
        )}
        ItemSeparatorComponent={() => <Divider inset={72} />}
        renderItem={({ item }) => (
          <PersonListItem
            person={item}
            subtitle={homeId && homeId !== item.id ? kinshipLabel(people, homeId, item.id) : undefined}
            trailing="chevron"
            selected={homeId === item.id}
            onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })}
          />
        )}
      />
    </View>
  );
}
