import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { PersonListItem } from '@/components/PersonListItem';
import { Card, Divider, EmptyState, SectionHeader } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { ageOf, daysUntilBirthday, formatDate } from '@/lib/dates';
import { computeGenerations } from '@/lib/layout';
import { computeStats, fullName } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { contentMaxWidth, useTheme } from '@/theme';

function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const theme = useTheme();
  return (
    <Card style={{ flexGrow: 1, flexBasis: '46%', gap: theme.space.sm }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.accentSoft,
        }}>
        <Icon name={icon} size={16} color={theme.colors.accent} />
      </View>
      <AppText variant="display" style={{ fontSize: 25, lineHeight: 30 }}>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </Card>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const people = useFamilyStore((state) => state.tree.people);
  const treeName = useFamilyStore((state) => state.tree.name);
  const loadSample = useFamilyStore((state) => state.loadSample);

  const all = useMemo(() => Object.values(people), [people]);
  const generations = useMemo(() => computeGenerations(all), [all]);
  const stats = useMemo(
    () => computeStats(people, generations, (person) => ageOf(person)?.years ?? null),
    [generations, people],
  );

  const upcomingBirthdays = useMemo(
    () =>
      all
        .filter((person) => !person.deathDate)
        .map((person) => ({ person, days: daysUntilBirthday(person.birthDate) }))
        .filter((entry): entry is { person: (typeof all)[number]; days: number } => entry.days !== null)
        .sort((a, b) => a.days - b.days)
        .slice(0, 5),
    [all],
  );

  if (all.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState
          icon={<Icon name="sparkle" size={26} color={theme.colors.accent} />}
          title="Nothing to measure yet"
          message="Insights appear once there are a few people in your tree."
          action={<Button label="Load a sample family" icon="sparkle" onPress={loadSample} />}
        />
      </View>
    );
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
      showsVerticalScrollIndicator={false}>
      <AppText variant="nameLG">Insights</AppText>
      <AppText variant="caption" tone="faint" style={{ marginTop: 4 }}>
        {treeName}
      </AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md, marginTop: theme.space.xl }}>
        <StatTile icon="users" value={String(stats.total)} label="People in the tree" />
        <StatTile icon="tree" value={String(stats.generations)} label="Generations recorded" />
        <StatTile icon="heart" value={String(stats.couples)} label="Couples" />
        <StatTile
          icon="star"
          value={stats.averageChildren > 0 ? stats.averageChildren.toFixed(1) : '—'}
          label="Children per parent"
        />
      </View>

      {upcomingBirthdays.length > 0 ? (
        <>
          <SectionHeader title="Coming up" />
          <Card padded={false}>
            {upcomingBirthdays.map((entry, index) => (
              <View key={entry.person.id}>
                {index > 0 ? <Divider inset={72} /> : null}
                <PersonListItem
                  person={entry.person}
                  subtitle={
                    entry.days === 0
                      ? 'Birthday today 🎉'
                      : `${entry.days} ${entry.days === 1 ? 'day' : 'days'} · ${formatDate(entry.person.birthDate, 'short')}`
                  }
                  trailing="chevron"
                  onPress={() => router.push({ pathname: '/person/[id]', params: { id: entry.person.id } })}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {stats.oldestLiving || stats.longestLife ? (
        <>
          <SectionHeader title="Milestones" />
          <View style={{ gap: theme.space.md }}>
            {stats.oldestLiving ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
                <Avatar person={stats.oldestLiving.person} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="sectionLabel" tone="faint">
                    Oldest living
                  </AppText>
                  <AppText variant="bodyStrong">{fullName(stats.oldestLiving.person)}</AppText>
                  <AppText variant="caption" tone="muted">
                    {stats.oldestLiving.age} years old
                  </AppText>
                </View>
              </Card>
            ) : null}
            {stats.longestLife ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
                <Avatar person={stats.longestLife.person} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="sectionLabel" tone="faint">
                    Longest life
                  </AppText>
                  <AppText variant="bodyStrong">{fullName(stats.longestLife.person)}</AppText>
                  <AppText variant="caption" tone="muted">
                    {stats.longestLife.age} years
                  </AppText>
                </View>
              </Card>
            ) : null}
          </View>
        </>
      ) : null}

      {stats.surnames.length > 0 ? (
        <>
          <SectionHeader title="Family names" />
          <Card style={{ gap: theme.space.md }}>
            {stats.surnames.slice(0, 6).map((entry) => {
              const share = entry.count / stats.total;
              return (
                <View key={entry.name} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="label">{entry.name}</AppText>
                    <AppText variant="label" tone="muted">
                      {entry.count}
                    </AppText>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceAlt }}>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        width: `${Math.max(6, share * 100)}%`,
                        backgroundColor: theme.colors.accent,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader title="At a glance" />
      <Card style={{ gap: theme.space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="body" tone="muted">
            Living
          </AppText>
          <AppText variant="bodyStrong">{stats.living}</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="body" tone="muted">
            Remembered
          </AppText>
          <AppText variant="bodyStrong">{stats.deceased}</AppText>
        </View>
        {stats.earliestBirthYear ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" tone="muted">
              Earliest birth year
            </AppText>
            <AppText variant="bodyStrong">{stats.earliestBirthYear}</AppText>
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}
