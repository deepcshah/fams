import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, IconButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Lightbox } from '@/components/Lightbox';
import { PanZoom, type PanZoomHandle } from '@/components/PanZoom';
import { PersonDetailSurface } from '@/components/PersonDetailSurface';
import { PlaceTile } from '@/components/PlaceTile';
import { EmptyState, shadow } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { formatYear } from '@/lib/dates';
import { fullName, initialsOf } from '@/lib/relations';
import { scatterLayout, type ScatterItem } from '@/lib/scatter';
import { buildTimeline, galleryOf } from '@/lib/story';
import { useFamilyStore } from '@/store/familyStore';
import { detailPanelWidth, useTheme } from '@/theme';

const PADDING = 220;
const HERO_W = 230;
const HERO_H = 282;
const CAPTION_H = 34;

type Card =
  | { kind: 'photo'; id: string; uri: string; width: number; height: number }
  | { kind: 'place'; id: string; place: string; year: string; title: string; width: number; height: number }
  | { kind: 'note'; id: string; year: string; title: string; width: number; height: number };

/**
 * One person's life as a table of scattered photographs, places and moments.
 * The tree answers "who"; this answers "what happened", and it is the view
 * people actually linger in.
 */
export default function LifeCanvasScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewportRef = useRef<PanZoomHandle>(null);

  const person = useFamilyStore((state) => (id ? state.tree.people[id] : undefined));
  const [zoom, setZoom] = useState(1);
  // Docked beside the canvas on desktop; on a phone the sheet would cover the
  // very thing you navigated here to look at, so it starts closed.
  const [detailOpen, setDetailOpen] = useState(theme.wide);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const gallery = useMemo(() => (person ? galleryOf(person) : []), [person]);
  const timeline = useMemo(() => (person ? buildTimeline(person) : []), [person]);

  const cards = useMemo<Card[]>(() => {
    if (!person) return [];
    const out: Card[] = [];

    // Dated moments: a place tile when we know where, a plain note otherwise.
    timeline.forEach((entry) => {
      const year = formatYear(entry.date);
      if (entry.place) {
        out.push({
          kind: 'place',
          id: `place_${entry.id}`,
          place: entry.place,
          year,
          title: entry.title,
          width: 164,
          height: 164 + CAPTION_H,
        });
      } else if (year) {
        out.push({ kind: 'note', id: `note_${entry.id}`, year, title: entry.title, width: 176, height: 76 });
      }
    });

    // Photographs, in a few sizes so the scatter does not read as a grid.
    gallery
      .filter((uri) => uri !== person.photoUri)
      .forEach((uri, index) => {
        const landscape = index % 3 !== 1;
        out.push({
          kind: 'photo',
          id: `photo_${index}`,
          uri,
          width: landscape ? 244 : 178,
          height: landscape ? 168 : 224,
        });
      });

    return out;
  }, [gallery, person, timeline]);

  const scatter = useMemo(() => {
    const hero: ScatterItem = { id: '__hero', width: HERO_W, height: HERO_H + CAPTION_H };
    return scatterLayout(hero, cards, { gap: 34 });
  }, [cards]);

  const offsetX = PADDING - scatter.bounds.minX;
  const offsetY = PADDING - scatter.bounds.minY;

  const fitSignature = `${Math.round(scatter.width)}x${Math.round(scatter.height)}:${ready}`;
  const lastFit = useRef('');
  useEffect(() => {
    if (!ready || lastFit.current === fitSignature) return;
    const first = lastFit.current === '';
    lastFit.current = fitSignature;
    viewportRef.current?.fit(!first);
  }, [fitSignature, ready]);

  const openPhoto = useCallback(
    (uri: string) => setLightbox(Math.max(0, gallery.indexOf(uri))),
    [gallery],
  );

  if (!person) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center' }}>
        <EmptyState
          title="Nobody here"
          message="This person is no longer in the tree."
          action={<Button label="Back to the tree" icon="arrowLeft" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  const panelOpen = detailOpen && theme.wide;
  const heroPlacement = scatter.byId.__hero;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }} onLayout={() => setReady(true)}>
      <PanZoom
        ref={viewportRef}
        innerWidth={scatter.width}
        innerHeight={scatter.height}
        padding={PADDING}
        onScaleChange={setZoom}
        fitInsets={{
          top: insets.top + 60,
          bottom: insets.bottom + 72,
          left: theme.space.lg,
          right: theme.space.lg + (panelOpen ? detailPanelWidth + theme.space.md : 0),
        }}>
        {/* Hero portrait */}
        <View
          style={{
            position: 'absolute',
            left: heroPlacement.x + offsetX,
            top: heroPlacement.y + offsetY,
            width: HERO_W,
          }}>
          <Pressable
            accessibilityRole={person.photoUri ? 'imagebutton' : 'image'}
            accessibilityLabel={fullName(person)}
            disabled={!person.photoUri}
            onPress={() => person.photoUri && openPhoto(person.photoUri)}
            style={[
              {
                width: HERO_W,
                height: HERO_H,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: person.photoUri ? theme.colors.surfaceSunken : theme.colors.surface,
                borderWidth: person.photoUri ? 0 : StyleSheet.hairlineWidth * 2,
                borderColor: theme.colors.border,
              },
              shadow(theme.colors.shadow, 2),
            ]}>
            {person.photoUri ? (
              <Image source={{ uri: person.photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <AppText variant="nameXL" tone="faint" style={{ fontSize: 44, lineHeight: 52 }}>
                {initialsOf(person)}
              </AppText>
            )}
          </Pressable>
          <View style={{ paddingTop: 10 }}>
            <AppText variant="nameLG">{fullName(person)}</AppText>
            <AppText variant="data" tone="faint">
              {person.deathDate
                ? `${formatYear(person.birthDate) || '?'} – ${formatYear(person.deathDate)}`
                : formatYear(person.birthDate)}
            </AppText>
          </View>
        </View>

        {/* Everything else */}
        {cards.map((card) => {
          const place = scatter.byId[card.id];
          if (!place) return null;
          const left = place.x + offsetX;
          const top = place.y + offsetY;

          if (card.kind === 'photo') {
            return (
              <Pressable
                key={card.id}
                accessibilityRole="imagebutton"
                accessibilityLabel="Open photograph"
                onPress={() => openPhoto(card.uri)}
                style={[
                  {
                    position: 'absolute',
                    left,
                    top,
                    width: card.width,
                    height: card.height,
                    borderRadius: theme.radius.sm,
                    overflow: 'hidden',
                    backgroundColor: theme.colors.surfaceSunken,
                  },
                  shadow(theme.colors.shadow, 1),
                ]}>
                <Image
                  source={{ uri: card.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={160}
                />
              </Pressable>
            );
          }

          if (card.kind === 'place') {
            return (
              <View key={card.id} style={{ position: 'absolute', left, top, width: card.width }}>
                <PlaceTile place={card.place} width={card.width} height={card.width} />
                <View style={{ flexDirection: 'row', gap: 7, paddingTop: 8 }}>
                  {card.year ? <AppText variant="yearSM" style={{ fontSize: 10 }}>{card.year}</AppText> : null}
                  <AppText variant="caption" tone="faint" numberOfLines={2} style={{ flex: 1, fontSize: 11 }}>
                    {card.title}
                  </AppText>
                </View>
              </View>
            );
          }

          return (
            <View key={card.id} style={{ position: 'absolute', left, top, width: card.width, gap: 4 }}>
              <AppText variant="year">{card.year}</AppText>
              <AppText variant="caption" tone="muted" numberOfLines={3}>
                {card.title}
              </AppText>
            </View>
          );
        })}
      </PanZoom>

      {cards.length === 0 ? (
        <View style={{ position: 'absolute', left: 0, right: panelOpen ? detailPanelWidth : 0, top: 0, bottom: 0, justifyContent: 'center' }} pointerEvents="box-none">
          <EmptyState
            title="No story recorded yet"
            message="Add photographs and life events on the edit screen and they will appear here."
            action={
              <Button
                label="Add to this life"
                icon="plus"
                onPress={() => router.push({ pathname: '/edit/[id]', params: { id: person.id } })}
              />
            }
          />
        </View>
      ) : null}

      {/* Back */}
      <View style={{ position: 'absolute', top: insets.top + theme.space.md, left: theme.space.lg }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Family tree"
          accessibilityHint="Go back to the family tree"
          onPress={() => router.back()}
          style={({ pressed }) => [
            {
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
            },
            shadow(theme.colors.shadow, 1),
          ]}>
          <Icon name="chevronLeft" size={16} color={theme.colors.text} />
          <AppText variant="label">Family tree</AppText>
        </Pressable>
      </View>

      {/* Zoom register */}
      <View
        style={[
          {
            position: 'absolute',
            left: theme.space.lg,
            bottom: insets.bottom + theme.space.lg,
            flexDirection: 'row',
            alignItems: 'center',
            height: 40,
            paddingHorizontal: 6,
            gap: 2,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          shadow(theme.colors.shadow, 1),
        ]}>
        <IconButton icon="minus" label="Zoom out" size={28} variant="ghost" onPress={() => viewportRef.current?.zoomBy(1 / 1.3)} />
        <AppText variant="relation" tone="muted" style={{ width: 44, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </AppText>
        <IconButton icon="plus" label="Zoom in" size={28} variant="ghost" onPress={() => viewportRef.current?.zoomBy(1.3)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fit"
          accessibilityHint="Frame the whole canvas on screen"
          onPress={() => viewportRef.current?.fit()}
          style={{ paddingHorizontal: theme.space.md, height: 28, justifyContent: 'center' }}>
          <AppText variant="label" tone="muted">
            Fit
          </AppText>
        </Pressable>
      </View>

      {detailOpen ? null : (
        <View style={{ position: 'absolute', right: theme.space.lg, bottom: insets.bottom + theme.space.lg }}>
          <IconButton
            icon="user"
            label="Show details"
            onPress={() => setDetailOpen(true)}
            style={shadow(theme.colors.shadow, 1)}
          />
        </View>
      )}

      <PersonDetailSurface
        personId={detailOpen ? person.id : undefined}
        topInset={insets.top + 44}
        onClose={() => setDetailOpen(false)}
        onGoToPerson={(pid) => router.push({ pathname: '/life/[id]', params: { id: pid } })}
        onAddRelative={() => router.push({ pathname: '/person/[id]', params: { id: person.id } })}
      />

      <Lightbox
        photos={gallery}
        startIndex={lightbox ?? 0}
        visible={lightbox !== null}
        onClose={() => setLightbox(null)}
        caption={fullName(person)}
      />
    </View>
  );
}
