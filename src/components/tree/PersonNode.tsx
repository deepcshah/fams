import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Icon } from '@/components/Icon';
import { AppText } from '@/components/Text';
import { lifespan } from '@/lib/dates';
import { CAPTION_H, PORTRAIT_H, PORTRAIT_W, type LayoutNode } from '@/lib/layout';
import { fullName, initialsOf } from '@/lib/relations';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

export type PersonNodeProps = {
  person: Person;
  node: LayoutNode;
  left: number;
  top: number;
  selected: boolean;
  isHome: boolean;
  dimmed: boolean;
  showLifespans: boolean;
  onPress: (personId: string) => void;
  onLongPress: (personId: string) => void;
};

function PersonNodeBase({
  person,
  node,
  left,
  top,
  selected,
  isHome,
  dimmed,
  showLifespans,
  onPress,
  onLongPress,
}: PersonNodeProps) {
  const theme = useTheme();
  const years = showLifespans ? lifespan(person.birthDate, person.deathDate) : '';
  const hasPhoto = Boolean(person.photoUri);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fullName(person)}${years ? `, ${years}` : ''}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(person.id)}
      onLongPress={() => onLongPress(person.id)}
      delayLongPress={280}
      style={({ pressed }) => ({
        position: 'absolute',
        left,
        top,
        width: node.width,
        height: node.height,
        opacity: dimmed ? 0.26 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
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
          borderWidth: hasPhoto ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor: theme.colors.border,
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
              borderColor: theme.colors.text,
            }}
            pointerEvents="none"
          />
        ) : null}

        {isHome ? (
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
  );
}

export const PersonNode = memo(PersonNodeBase);
