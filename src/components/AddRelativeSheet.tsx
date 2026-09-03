import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ancestorsOf, descendantsOf, fullName, siblingsOf } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { Icon, type IconName } from './Icon';
import { PersonPicker } from './PersonPicker';
import { Sheet } from './Sheet';
import { AppText } from './Text';

type Relation = 'parent' | 'partner' | 'sibling' | 'child';

const RELATION_META: Record<Relation, { title: string; icon: IconName; blurb: string }> = {
  parent: { title: 'Parent', icon: 'chevronUp', blurb: 'Add a mother or father above' },
  partner: { title: 'Partner', icon: 'heart', blurb: 'Add a spouse or partner alongside' },
  sibling: { title: 'Sibling', icon: 'swap', blurb: 'Add a brother or sister' },
  child: { title: 'Child', icon: 'chevronDown', blurb: 'Add a son or daughter below' },
};

export function AddRelativeSheet({
  anchorId,
  visible,
  onClose,
}: {
  anchorId?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const people = useFamilyStore((state) => state.tree.people);
  const linkParent = useFamilyStore((state) => state.linkParent);
  const linkPartner = useFamilyStore((state) => state.linkPartner);
  const updatePerson = useFamilyStore((state) => state.updatePerson);

  const [linking, setLinking] = useState<Relation | null>(null);
  const [coParentStep, setCoParentStep] = useState(false);

  const anchor = anchorId ? people[anchorId] : undefined;

  const partners = useMemo(
    () => (anchor ? anchor.partnerIds.map((id) => people[id]).filter(Boolean) : []),
    [anchor, people],
  );

  const available: Record<Relation, { enabled: boolean; reason?: string }> = {
    parent: {
      enabled: Boolean(anchor) && (anchor?.parentIds.length ?? 0) < 2,
      reason: 'Both parents are already recorded',
    },
    partner: { enabled: Boolean(anchor) },
    sibling: {
      enabled: Boolean(anchor) && (anchor?.parentIds.length ?? 0) > 0,
      reason: 'Add a parent first so siblings have someone to share',
    },
    child: { enabled: Boolean(anchor) },
  };

  function close() {
    setLinking(null);
    setCoParentStep(false);
    onClose();
  }

  function goToEditor(relation: Relation, coParentId?: string) {
    if (!anchorId) return;
    close();
    router.push({
      pathname: '/edit/[id]',
      params: { id: 'new', relation, anchor: anchorId, ...(coParentId ? { coParent: coParentId } : {}) },
    });
  }

  function chooseRelation(relation: Relation) {
    if (!anchor) return;
    if (relation === 'child' && partners.length > 1) {
      setCoParentStep(true);
      return;
    }
    goToEditor(relation, relation === 'child' && partners.length === 1 ? partners[0].id : undefined);
  }

  function linkExisting(relation: Relation, other: Person) {
    if (!anchor) return;
    if (relation === 'parent') linkParent(anchor.id, other.id);
    if (relation === 'partner') linkPartner(anchor.id, other.id);
    if (relation === 'child') linkParent(other.id, anchor.id);
    if (relation === 'sibling') {
      updatePerson(other.id, {
        parentIds: [...new Set([...other.parentIds, ...anchor.parentIds])].slice(0, 2),
      });
    }
    close();
  }

  const excludeForLinking = useMemo(() => {
    if (!anchor || !linking) return new Set<string>();
    const exclude = new Set<string>([anchor.id]);
    if (linking === 'parent') {
      for (const id of descendantsOf(people, anchor.id)) exclude.add(id);
      for (const id of anchor.parentIds) exclude.add(id);
    }
    if (linking === 'child') {
      for (const id of ancestorsOf(people, anchor.id)) exclude.add(id);
    }
    if (linking === 'partner') {
      for (const id of anchor.partnerIds) exclude.add(id);
    }
    if (linking === 'sibling') {
      for (const sibling of siblingsOf(people, anchor.id)) exclude.add(sibling.id);
    }
    return exclude;
  }, [anchor, linking, people]);

  const everyone = useMemo(() => Object.values(people), [people]);

  if (linking && anchor) {
    return (
      <PersonPicker
        visible
        onClose={() => setLinking(null)}
        title={`Link an existing ${RELATION_META[linking].title.toLowerCase()}`}
        subtitle={`Connect somebody already in the tree to ${fullName(anchor)}.`}
        people={everyone}
        excludeIds={excludeForLinking}
        onSelect={(person) => linkExisting(linking, person)}
        emptyMessage="Everyone eligible is already connected."
      />
    );
  }

  if (coParentStep && anchor) {
    return (
      <Sheet
        visible={visible}
        onClose={close}
        title="Who is the other parent?"
        subtitle={`${fullName(anchor)} has more than one partner on record.`}>
        {partners.map((partner) => (
          <Pressable
            key={partner.id}
            accessibilityRole="button"
            onPress={() => goToEditor('child', partner.id)}
            style={{
              padding: theme.space.lg,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}>
            <AppText variant="bodyStrong">{fullName(partner)}</AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => goToEditor('child')}
          style={{
            padding: theme.space.lg,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}>
          <AppText variant="bodyStrong" tone="muted">
            {fullName(anchor)} only
          </AppText>
        </Pressable>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Add a relative"
      subtitle={anchor ? `Connected to ${fullName(anchor)}` : undefined}>
      {(Object.keys(RELATION_META) as Relation[]).map((relation) => {
        const meta = RELATION_META[relation];
        const state = available[relation];
        return (
          <View key={relation} style={{ opacity: state.enabled ? 1 : 0.45 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                overflow: 'hidden',
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add new ${meta.title}`}
                disabled={!state.enabled}
                onPress={() => chooseRelation(relation)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.md,
                  padding: theme.space.lg,
                }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.accentSoft,
                  }}>
                  <Icon name={meta.icon} size={18} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{meta.title}</AppText>
                  <AppText variant="caption" tone="muted">
                    {state.enabled ? meta.blurb : state.reason}
                  </AppText>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Link an existing ${meta.title}`}
                disabled={!state.enabled}
                onPress={() => setLinking(relation)}
                style={{
                  paddingHorizontal: theme.space.lg,
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                  borderLeftWidth: 1,
                  borderLeftColor: theme.colors.border,
                }}>
                <Icon name="link" size={17} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <AppText variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: theme.space.xs }}>
        Tap a row to create somebody new, or the link icon to connect a person already in the tree.
      </AppText>
    </Sheet>
  );
}
