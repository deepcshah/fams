import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AddRelativeSheet } from '@/components/AddRelativeSheet';
import { Button, IconButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PersonPicker } from '@/components/PersonPicker';
import { PersonPreviewSheet } from '@/components/PersonPreviewSheet';
import { EmptyState, shadow } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { TreeCanvas, type TreeCanvasHandle } from '@/components/tree/TreeCanvas';
import { layoutFamilyTree } from '@/lib/layout';
import { fullName, lineageOf, subsetPeople } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { useTheme } from '@/theme';

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
  const [previewId, setPreviewId] = useState<string | undefined>(undefined);
  const [addForId, setAddForId] = useState<string | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);

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
    setPreviewId(personId);
  }, []);

  const handleLongPress = useCallback((personId: string) => {
    setSelectedId(personId);
    setPreviewId(personId);
  }, []);

  const goToPerson = useCallback((personId: string) => {
    setSelectedId(personId);
    setPreviewId(personId);
    canvasRef.current?.centerOn(personId);
  }, []);

  const hiddenCount = allPeople.length - visiblePeople.length;
  // Only count branches that actually hide somebody — collapsing a couple whose
  // descendants are all reachable another way changes nothing.
  const collapsedCount = layout.units.filter((unit) => unit.collapsed).length;

  if (allPeople.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState
          icon={<Icon name="tree" size={28} color={theme.colors.accent} />}
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
        showPortraits={settings.showPortraits}
        showLifespans={settings.showLifespans}
        onSelect={handleSelect}
        onLongPressPerson={handleLongPress}
        onToggleCollapse={toggleCollapsed}
        initialFocusId={tree.homeId}
        fitInsets={{
          top: insets.top + 72,
          bottom: insets.bottom + 104,
          left: theme.space.lg,
          right: theme.space.lg + 72,
        }}
      />

      {/* Top bar */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: theme.space.md,
          right: theme.space.md,
          gap: theme.space.sm,
        }}
        pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search people"
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => [
              {
                flex: 1,
                height: 46,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.bgElevated,
                borderWidth: 1,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
              shadow(theme.colors.shadow, 1),
            ]}>
            <Icon name="search" size={17} color={theme.colors.textFaint} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {tree.name}
              </AppText>
              <AppText variant="caption" tone="faint" numberOfLines={1}>
                {allPeople.length} {allPeople.length === 1 ? 'person' : 'people'} · {layout.generationRows.length}{' '}
                generations
              </AppText>
            </View>
          </Pressable>
        </View>

        {lineageId && people[lineageId] ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show the whole tree"
            onPress={() => setLineage(undefined)}
            style={[
              {
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingLeft: theme.space.md,
                paddingRight: theme.space.sm,
                height: 32,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.accent,
              },
              shadow(theme.colors.shadow, 1),
            ]}>
            <AppText variant="label" style={{ color: theme.colors.accentText }}>
              {fullName(people[lineageId])}&apos;s branch
              {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
            </AppText>
            <Icon name="close" size={14} color={theme.colors.accentText} />
          </Pressable>
        ) : null}

        {collapsedCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand all collapsed branches"
            onPress={expandAll}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: theme.space.md,
              height: 32,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.bgElevated,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
            <Icon name="chevronDown" size={14} color={theme.colors.textMuted} />
            <AppText variant="label" tone="muted">
              {collapsedCount} collapsed
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {/* Canvas controls */}
      <View
        style={{
          position: 'absolute',
          right: theme.space.md,
          bottom: insets.bottom + 96,
          gap: theme.space.sm,
          alignItems: 'center',
        }}>
        <View
          style={[
            {
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.bgElevated,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            },
            shadow(theme.colors.shadow, 2),
          ]}>
          <IconButton icon="plus" label="Zoom in" variant="ghost" onPress={() => canvasRef.current?.zoomBy(1.3)} />
          <View style={{ height: 1, backgroundColor: theme.colors.border }} />
          <IconButton icon="minus" label="Zoom out" variant="ghost" onPress={() => canvasRef.current?.zoomBy(1 / 1.3)} />
        </View>
        <IconButton
          icon="fit"
          label="Fit the tree on screen"
          onPress={() => canvasRef.current?.fit()}
          style={shadow(theme.colors.shadow, 2)}
        />
        {tree.homeId ? (
          <IconButton
            icon="target"
            label="Centre on me"
            onPress={() => goToPerson(tree.homeId!)}
            style={shadow(theme.colors.shadow, 2)}
          />
        ) : null}
        <IconButton
          icon="plus"
          label="Add a person"
          variant="primary"
          size={54}
          onPress={() => {
            if (selectedId) setAddForId(selectedId);
            else router.push({ pathname: '/edit/[id]', params: { id: 'new' } });
          }}
          style={shadow(theme.colors.shadow, 3)}
        />
      </View>

      <PersonPreviewSheet
        personId={previewId}
        visible={Boolean(previewId)}
        onClose={() => setPreviewId(undefined)}
        onAddRelative={(id) => {
          setPreviewId(undefined);
          setAddForId(id);
        }}
        onGoToPerson={(id) => goToPerson(id)}
        onFocusBranch={(id) => {
          setPreviewId(undefined);
          setLineage(lineageId === id ? undefined : id);
        }}
        lineageActive={Boolean(lineageId && previewId === lineageId)}
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
