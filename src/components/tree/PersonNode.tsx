import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { AppText } from '@/components/Text';
import { lifespan } from '@/lib/dates';
import { CAPTION_H, PORTRAIT_H, PORTRAIT_W, type LayoutNode } from '@/lib/layout';
import { fullName, initialsOf } from '@/lib/relations';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { seedOf, useJiggle, useJiggleSuppressed } from './useJiggle';

export type AddDirection = 'parent' | 'partner' | 'child';

export type PersonNodeProps = {
  person: Person;
  node: LayoutNode;
  left: number;
  top: number;
  selected: boolean;
  isHome: boolean;
  dimmed: boolean;
  showLifespans: boolean;
  /** Build mode: cards wobble and carry their own editing affordances. */
  building: boolean;
  canAddParent: boolean;
  onPress: (personId: string) => void;
  onLongPress: (personId: string) => void;
  onRemove: (personId: string) => void;
  onAdd: (personId: string, direction: AddDirection) => void;
};

const HANDLE = 22;

function Handle({
  icon,
  label,
  style,
  onPress,
  disabled,
}: {
  icon: 'plus' | 'close';
  label: string;
  style: object;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  // Ink for remove, sage for add: twenty red badges at once reads as an error
  // state rather than an editing one.
  const background = icon === 'close' ? theme.colors.text : theme.colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          position: 'absolute',
          width: HANDLE,
          height: HANDLE,
          borderRadius: HANDLE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
          opacity: disabled ? 0.25 : pressed ? 0.7 : 1,
          borderWidth: 1.5,
          borderColor: theme.colors.canvas,
        },
        style,
      ]}>
      <Icon name={icon} size={12} color={theme.colors.bg} strokeWidth={2.6} />
    </Pressable>
  );
}

function PersonNodeBase({
  person,
  node,
  left,
  top,
  selected,
  isHome,
  dimmed,
  showLifespans,
  building,
  canAddParent,
  onPress,
  onLongPress,
  onRemove,
  onAdd,
}: PersonNodeProps) {
  const theme = useTheme();
  const jiggle = useJiggle(building, seedOf(person.id));
  const stillness = useJiggleSuppressed();
  const years = showLifespans ? lifespan(person.birthDate, person.deathDate, person.deceased) : '';
  const hasPhoto = Boolean(person.photoUri);
  const showHandles = building && selected;

  return (
    <Animated.View
      style={[
        { position: 'absolute', left, top, width: node.width, height: node.height, opacity: dimmed ? 0.26 : 1 },
        jiggle,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fullName(person)}${years ? `, ${years}` : ''}`}
        accessibilityState={{ selected }}
        onPress={() => onPress(person.id)}
        onLongPress={() => onLongPress(person.id)}
        delayLongPress={280}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <View
          style={{
            width: PORTRAIT_W,
            height: PORTRAIT_H,
            borderRadius: theme.radius.sm,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            // A photograph needs no frame; a gap in the archive is drawn as a
            // pale card so the people who were photographed carry the page.
            backgroundColor: hasPhoto ? theme.colors.surfaceSunken : theme.colors.surface,
            borderWidth: hasPhoto && !(building && stillness) ? 0 : StyleSheet.hairlineWidth * 2,
            // With the wobble suppressed, a dashed edge is what says "editable".
            borderStyle: building && stillness ? 'dashed' : 'solid',
            borderColor: building && stillness ? theme.colors.accent : theme.colors.border,
            shadowColor: theme.colors.shadow,
            shadowOpacity: hasPhoto ? 0.14 : 0,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 3 },
            elevation: hasPhoto ? 3 : 0,
          }}>
          {hasPhoto ? (
            <Image
              source={{ uri: person.photoUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={160}
            />
          ) : (
            <AppText variant="nameLG" tone="faint" style={{ letterSpacing: 2 }}>
              {initialsOf(person)}
            </AppText>
          )}

          {selected ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                borderRadius: theme.radius.sm,
                borderWidth: 2,
                borderColor: building ? theme.colors.accent : theme.colors.text,
              }}
              pointerEvents="none"
            />
          ) : null}

          {isHome && !building ? (
            <View
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 13,
                height: 13,
                borderRadius: 7,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accent,
              }}>
              <Icon name="star" size={7.5} color={theme.colors.accentText} strokeWidth={2.4} />
            </View>
          ) : null}
        </View>

        <View style={{ height: CAPTION_H, paddingTop: 7, gap: 1 }}>
          <AppText variant="nameSM" numberOfLines={2}>
            {fullName(person)}
          </AppText>
          {years ? (
            <AppText variant="dataSM" tone="faint" numberOfLines={1}>
              {years}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {building ? (
        <Handle
          icon="close"
          label={`Remove ${fullName(person)}`}
          onPress={() => onRemove(person.id)}
          style={{ top: -HANDLE / 2.4, left: -HANDLE / 2.4 }}
        />
      ) : null}

      {showHandles ? (
        <>
          <Handle
            icon="plus"
            label={`Add a parent above ${fullName(person)}`}
            disabled={!canAddParent}
            onPress={() => onAdd(person.id, 'parent')}
            style={{ top: -HANDLE / 2, left: PORTRAIT_W / 2 - HANDLE / 2 }}
          />
          <Handle
            icon="plus"
            label={`Add a partner beside ${fullName(person)}`}
            onPress={() => onAdd(person.id, 'partner')}
            style={{ top: PORTRAIT_H / 2 - HANDLE / 2, left: PORTRAIT_W - HANDLE / 2 }}
          />
          <Handle
            icon="plus"
            label={`Add a child below ${fullName(person)}`}
            onPress={() => onAdd(person.id, 'child')}
            style={{ top: node.height - HANDLE / 2, left: PORTRAIT_W / 2 - HANDLE / 2 }}
          />
        </>
      ) : null}
    </Animated.View>
  );
}

export const PersonNode = memo(PersonNodeBase);
