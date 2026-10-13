import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { matchScore } from '@/lib/relations';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { Icon } from './Icon';
import { PersonListItem } from './PersonListItem';
import { Sheet } from './Sheet';
import { EmptyState } from './Surface';
import { AppText } from './Text';

/** A searchable list of people, used both for jump-to and for linking relatives. */
export function PersonPicker({
  visible,
  onClose,
  title,
  subtitle,
  people,
  excludeIds,
  onSelect,
  subtitleFor,
  emptyMessage = 'Nobody matches that search.',
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  people: Person[];
  excludeIds?: ReadonlySet<string>;
  onSelect: (person: Person) => void;
  subtitleFor?: (person: Person) => string | undefined;
  emptyMessage?: string;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const candidates = people.filter((p) => !excludeIds?.has(p.id));
    if (!query.trim()) {
      return [...candidates].sort((a, b) => a.firstName.localeCompare(b.firstName));
    }
    return candidates
      .map((person) => ({ person, score: matchScore(person, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.person);
  }, [excludeIds, people, query]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} scroll={false}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          height: 44,
          paddingHorizontal: theme.space.md,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceAlt,
        }}>
        <Icon name="search" size={17} color={theme.colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, place or work"
          placeholderTextColor={theme.colors.textFaint}
          selectionColor={theme.colors.accent}
          autoCorrect={false}
          style={[
            { flex: 1, color: theme.colors.text, fontSize: 15 },
            { outlineStyle: 'none' } as object,
          ]}
        />
      </View>

      <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
        {results.length === 0 ? (
          <EmptyState title="No matches" message={emptyMessage} />
        ) : (
          results.map((person) => (
            <PersonListItem
              key={person.id}
              person={person}
              subtitle={subtitleFor?.(person)}
              trailing="chevron"
              onPress={() => {
                setQuery('');
                onSelect(person);
              }}
            />
          ))
        )}
        {results.length > 0 ? (
          <AppText variant="caption" tone="faint" style={{ textAlign: 'center', paddingVertical: theme.space.md }}>
            {results.length} {results.length === 1 ? 'person' : 'people'}
          </AppText>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
