import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AddRelativeSheet } from '@/components/AddRelativeSheet';
import { Button, IconButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PersonDetailSurface } from '@/components/PersonDetailSurface';
import { PersonPicker } from '@/components/PersonPicker';
import { EmptyState, shadow } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { TreeCanvas, type TreeCanvasHandle } from '@/components/tree/TreeCanvas';
import { layoutFamilyTree } from '@/lib/layout';
import { fullName, lineageOf, subsetPeople } from '@/lib/relations';
import { detailPanelWidth, useTheme } from '@/theme';
import { useFamilyStore } from '@/store/familyStore';

export default function TreeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canvasRef = useRef<TreeCanvasHandle>(null);

  const tree = useFamilyStore((state) => state.tree);
  const settings = useFamilyStore((state) => state.settings);
  const collapsedUnitIds = useFamilyStore((state) => state.collapsedUnitIds);
  const lineageId = useFamilyStore((state) => state.lineageId);
  const setLineage = useFamilyStore((state) => state.setLineage);
  const toggleCollapsed = useFamilyStore((state) => state.toggleCollapsed);
  const expandAll = useFamilyStore((state) => state.expandAll);
  const loadSample = useFamilyStore((state) => state.loadSample);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | undefined>(undefined);
  const [addForId, setAddForId] = useState<string | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const people = tree.people;
  const allPeople = useMemo(() => Object.values(people), [people]);

  const visiblePeople = useMemo(() => {
    if (!lineageId || !people[lineageId]) return allPeople;
    return subsetPeople(people, lineageOf(people, lineageId));
  }, [allPeople, lineageId, people]);

  const collapsedSet = useMemo(() => new Set(collapsedUnitIds), [collapsedUnitIds]);

  const layout = useMemo(
    () => layoutFamilyTree(visiblePeople, { collapsedUnitIds: collapsedSet, unions: tree.unions }),
    [collapsedSet, tree.unions, visiblePeople],
  );

  const handleSelect = useCallback((personId: string) => {
    setSelectedId(personId);
    setDetailId(personId);
  }, []);

  const goToPerson = useCallback((personId: string) => {
    setSelectedId(personId);
    setDetailId(personId);
    canvasRef.current?.centerOn(personId);
  }, []);

  const hiddenCount = allPeople.length - visiblePeople.length;
  const collapsedCount = layout.units.filter((unit) => unit.collapsed).length;
  const panelOpen = Boolean(detailId) && theme.wide;

  if (allPeople.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.canvas, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState
          icon={<Icon name="tree" size={26} color={theme.colors.accent} />}
          title="Start your family tree"
          message="Add yourself first, then grow outwards — parents above, partners beside, children below."
          action={
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <Button
                label="Add the first person"
                icon="plus"
                onPress={() => router.push({ pathname: '/edit/[id]', params: { id: 'new' } })}
              />
              <Button label="Try a sample" icon="sparkle" variant="ghost" onPress={loadSample} />
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <TreeCanvas
        ref={canvasRef}
        layout={layout}
        people={people}
        selectedId={selectedId}
        homeId={tree.homeId}
        showLifespans={settings.showLifespans}
        onSelect={handleSelect}
        onLongPressPerson={handleSelect}
        onToggleCollapse={toggleCollapsed}
        onScaleChange={setZoom}
        initialFocusId={tree.homeId}
        fitInsets={{
          top: insets.top + 64,
          bottom: insets.bottom + 108,
          left: theme.space.lg,
          right: theme.space.lg + (panelOpen ? detailPanelWidth + theme.space.md : 64),
        }}
      />

      {/* Masthead */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + theme.space.md,
          left: theme.space.xl,
          right: theme.space.xl,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.space.md,
        }}
        pointerEvents="box-none">
        <View style={{ flex: 1, gap: 6 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.md, flexWrap: 'wrap' }}>
            <AppText variant="nameLG" numberOfLines={1}>
              {tree.name}
            </AppText>
            <AppText variant="caption" tone="faint">
              {allPeople.length} {allPeople.length === 1 ? 'person' : 'people'}
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }} pointerEvents="box-none">
            {lineageId && people[lineageId] ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show the whole tree"
                onPress={() => setLineage(undefined)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: theme.space.md,
                  paddingRight: theme.space.sm,
                  height: 28,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.accent,
                }}>
                <AppText variant="relation" style={{ color: theme.colors.accentText }}>
                  {fullName(people[lineageId])}
                  {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
                </AppText>
                <Icon name="close" size={12} color={theme.colors.accentText} />
              </Pressable>
            ) : null}

            {collapsedCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Expand all collapsed branches"
                onPress={expandAll}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: theme.space.md,
                  height: 28,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}>
                <Icon name="chevronDown" size={12} color={theme.colors.textMuted} />
                <AppText variant="relation" tone="muted">
                  {collapsedCount} collapsed
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <IconButton
          icon="search"
          label="Search people"
          onPress={() => setSearchOpen(true)}
          style={shadow(theme.colors.shadow, 1)}
        />
      </View>

      {/* Zoom register, bottom left */}
      <View
        style={[
          {
            position: 'absolute',
            left: theme.space.xl,
            bottom: insets.bottom + 92,
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
        <IconButton icon="minus" label="Zoom out" size={28} variant="ghost" onPress={() => canvasRef.current?.zoomBy(1 / 1.3)} />
        <AppText variant="relation" tone="muted" style={{ width: 44, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </AppText>
        <IconButton icon="plus" label="Zoom in" size={28} variant="ghost" onPress={() => canvasRef.current?.zoomBy(1.3)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fit the tree on screen"
          onPress={() => canvasRef.current?.fit()}
          style={{ paddingHorizontal: theme.space.md, height: 28, justifyContent: 'center' }}>
          <AppText variant="label" tone="muted">
            Fit
          </AppText>
        </Pressable>
      </View>

      {/* Actions, bottom right */}
      <View
        style={{
          position: 'absolute',
          right: panelOpen ? detailPanelWidth + theme.space.xl : theme.space.xl,
          bottom: insets.bottom + 92,
          gap: theme.space.sm,
          alignItems: 'center',
        }}>
        {tree.homeId ? (
          <IconButton
            icon="target"
            label="Centre on me"
            onPress={() => goToPerson(tree.homeId!)}
            style={shadow(theme.colors.shadow, 1)}
          />
        ) : null}
        <IconButton
          icon="plus"
          label="Add a person"
          variant="primary"
          size={50}
          onPress={() => {
            if (selectedId) setAddForId(selectedId);
            else router.push({ pathname: '/edit/[id]', params: { id: 'new' } });
          }}
          style={shadow(theme.colors.shadow, 2)}
        />
      </View>

      <PersonDetailSurface
        personId={detailId}
        topInset={insets.top + 56}
        onClose={() => setDetailId(undefined)}
        onGoToPerson={goToPerson}
        onAddRelative={(id) => {
          if (!theme.wide) setDetailId(undefined);
          setAddForId(id);
        }}
        onOpenCanvas={(id) => {
          if (!theme.wide) setDetailId(undefined);
          router.push({ pathname: '/life/[id]', params: { id } });
        }}
      />

      <AddRelativeSheet anchorId={addForId} visible={Boolean(addForId)} onClose={() => setAddForId(undefined)} />

      <PersonPicker
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Jump to somebody"
        subtitle="Search the whole tree and the canvas will fly to them."
        people={allPeople}
        onSelect={(person) => {
          setSearchOpen(false);
          if (lineageId && !layout.nodeById[person.id]) setLineage(undefined);
          goToPerson(person.id);
        }}
      />
    </View>
  );
}
