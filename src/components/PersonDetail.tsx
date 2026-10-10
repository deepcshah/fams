import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { formatDate, formatYear } from '@/lib/dates';
import { childrenOf, fullName, kinshipLabel, parentsOf, partnersOf, siblingsOf } from '@/lib/relations';
import { buildTimeline, galleryOf } from '@/lib/story';
import { useFamilyStore } from '@/store/familyStore';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Lightbox } from './Lightbox';
import { PlaceTile } from './PlaceTile';
import { AppText } from './Text';

/** "09.03.51" — the compact dotted form used throughout the reference. */
function dotted(date?: string): string {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(date ?? '');
  if (!match) return '';
  const [, year, month, day] = match;
  if (!month) return year;
  if (!day) return `${month.padStart(2, '0')}.${year.slice(2)}`;
  return `${month.padStart(2, '0')}.${day.padStart(2, '0')}.${year.slice(2)}`;
}

function SectionHead({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.space.xl,
        marginBottom: theme.space.md,
      }}>
      <AppText variant="sectionLabel" tone="faint">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={8}>
          <AppText variant="label" tone="accent">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One relative: portrait, name with maiden name, then RELATION · DATE. */
function RelativeRow({
  subject,
  relative,
  onPress,
}: {
  subject: Person;
  relative: Person;
  onPress: () => void;
}) {
  const theme = useTheme();
  const people = useFamilyStore((state) => state.tree.people);
  const relation = kinshipLabel(people, subject.id, relative.id);
  const date = dotted(relative.birthDate);
  const showMaiden = relative.birthName && relative.birthName !== relative.lastName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fullName(relative)}, ${relation}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: 7,
        paddingHorizontal: 8,
        marginHorizontal: -8,
        borderRadius: theme.radius.sm,
        backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
      })}>
      <Avatar person={relative} size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" numberOfLines={1}>
          {fullName(relative)}
          {showMaiden ? <AppText variant="body" tone="faint">{`  (née ${relative.birthName})`}</AppText> : null}
        </AppText>
        <AppText variant="relation" tone="faint" numberOfLines={1}>
          {relation}
          {date ? `  ·  ${date}` : ''}
        </AppText>
      </View>
    </Pressable>
  );
}

export function PersonDetail({
  person,
  onGoToPerson,
  onAddRelative,
  onOpenCanvas,
  extraActions,
  contentInset = 0,
  onBeforeNavigate,
}: {
  person: Person;
  onGoToPerson: (id: string) => void;
  onAddRelative: (id: string) => void;
  onOpenCanvas?: (id: string) => void;
  /**
   * Called before this component navigates. When it is rendered inside a modal
   * sheet the sheet has to come down first, or it stays stacked above whatever
   * we pushed.
   */
  onBeforeNavigate?: () => void;
  /** Screen-level actions appended to the action row (delete, set as me…). */
  extraActions?: ReactNode;
  contentInset?: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const people = useFamilyStore((state) => state.tree.people);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const openEditor = () => {
    onBeforeNavigate?.();
    router.push({ pathname: '/edit/[id]', params: { id: person.id } });
  };

  const family = useMemo(
    () => [
      ...partnersOf(people, person.id),
      ...parentsOf(people, person.id),
      ...siblingsOf(people, person.id),
      ...childrenOf(people, person.id),
    ],
    [people, person.id],
  );

  const timeline = useMemo(() => buildTimeline(person), [person]);
  const gallery = useMemo(() => galleryOf(person), [person]);

  const dateLine = person.deathDate
    ? `${formatYear(person.birthDate) || '?'} – ${formatYear(person.deathDate)}`
    : dotted(person.birthDate);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: theme.space.xl,
        paddingBottom: theme.space.xxxl + contentInset,
      }}
      showsVerticalScrollIndicator={false}>
      <AppText variant="nameXL">{fullName(person)}</AppText>
      {dateLine ? (
        <AppText variant="data" tone="faint" style={{ marginTop: 2 }}>
          {dateLine}
        </AppText>
      ) : null}
      {person.birthPlace ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
          Born in {person.birthPlace}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.lg, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit details"
          onPress={openEditor}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            height: 34,
            paddingHorizontal: theme.space.md,
            borderRadius: theme.radius.pill,
            backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
          })}>
          <Icon name="pencil" size={14} color={theme.colors.textMuted} />
          <AppText variant="label">Edit details</AppText>
        </Pressable>

        {onOpenCanvas ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open the life canvas"
            onPress={() => onOpenCanvas(person.id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              height: 34,
              paddingHorizontal: theme.space.md,
              borderRadius: theme.radius.pill,
              backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
            })}>
            <Icon name="sparkle" size={14} color={theme.colors.textMuted} />
            <AppText variant="label">Life canvas</AppText>
          </Pressable>
        ) : null}
        {extraActions}
      </View>

      <SectionHead title="Family" actionLabel="Add relative" onAction={() => onAddRelative(person.id)} />
      {family.length === 0 ? (
        <AppText variant="caption" tone="faint">
          Nobody linked yet.
        </AppText>
      ) : (
        family.map((relative) => (
          <RelativeRow
            key={relative.id}
            subject={person}
            relative={relative}
            onPress={() => onGoToPerson(relative.id)}
          />
        ))
      )}

      <SectionHead
        title="Photos"
        actionLabel="Add or edit"
        onAction={openEditor}
      />
      {gallery.length === 0 ? (
        <AppText variant="caption" tone="faint">
          No photographs yet.
        </AppText>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {gallery.map((uri, index) => (
            <Pressable
              key={uri}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${index + 1} of ${gallery.length}`}
              onPress={() => setLightbox(index)}
              style={{ width: '31.8%', aspectRatio: 1.18, borderRadius: theme.radius.xs, overflow: 'hidden' }}>
              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={140} />
            </Pressable>
          ))}
        </View>
      )}

      <SectionHead title="Timeline" />
      {timeline.length === 0 ? (
        <AppText variant="caption" tone="faint">
          Nothing recorded yet. Add dates and places on the edit screen.
        </AppText>
      ) : (
        timeline.map((entry, index) => {
          const last = index === timeline.length - 1;
          return (
            <View key={entry.id} style={{ flexDirection: 'row', gap: theme.space.md }}>
              <View style={{ alignItems: 'center', width: 8, paddingTop: 7 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: entry.kind === 'event' ? theme.colors.borderStrong : theme.colors.textMuted,
                  }}
                />
                {last ? null : <View style={{ flex: 1, width: 1, backgroundColor: theme.colors.border }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : theme.space.lg, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <AppText variant="year">{formatYear(entry.date) || '—'}</AppText>
                  {entry.date && formatDate(entry.date) !== formatYear(entry.date) ? (
                    <AppText variant="caption" tone="faint">
                      {formatDate(entry.date).replace(`, ${formatYear(entry.date)}`, '')}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="body" tone="muted">
                  {entry.title}
                </AppText>
                {entry.place ? (
                  <PlaceTile place={entry.place} width={92} height={66} label={false} style={{ marginTop: 5 }} />
                ) : null}
              </View>
            </View>
          );
        })
      )}

      <Lightbox
        photos={gallery}
        startIndex={lightbox ?? 0}
        visible={lightbox !== null}
        onClose={() => setLightbox(null)}
        caption={fullName(person)}
      />
    </ScrollView>
  );
}
