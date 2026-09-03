import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { shadow } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { lifespan } from '@/lib/dates';
import { fullName } from '@/lib/relations';
import type { LayoutNode } from '@/lib/layout';
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
  showPortraits: boolean;
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
  showPortraits,
  showLifespans,
  onPress,
  onLongPress,
}: PersonNodeProps) {
  const theme = useTheme();
  const ribbon = theme.generationColor(node.generation);
  const years = showLifespans ? lifespan(person.birthDate, person.deathDate) : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fullName(person)}${years ? `, ${years}` : ''}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(person.id)}
      onLongPress={() => onLongPress(person.id)}
      delayLongPress={280}
      style={({ pressed }) => [
        {
          position: 'absolute',
          left,
          top,
          width: node.width,
          height: node.height,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 12,
          gap: 10,
          opacity: dimmed ? 0.34 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          overflow: 'hidden',
        },
        shadow(theme.colors.shadow, selected ? 2 : 1),
      ]}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: ribbon,
          opacity: person.deathDate ? 0.55 : 1,
        }}
      />

      {showPortraits ? (
        <Avatar
          person={person}
          size={36}
          ring={isHome ? theme.colors.accent : undefined}
          style={{ marginLeft: 2 }}
        />
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 17 }}>
          {fullName(person)}
        </AppText>
        {years ? (
          <AppText variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 11 }}>
            {years}
          </AppText>
        ) : null}
      </View>

      {isHome ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 18,
            height: 18,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.accentSoft,
          }}>
          <Icon name="star" size={11} color={theme.colors.accent} />
        </View>
      ) : null}
    </Pressable>
  );
}

export const PersonNode = memo(PersonNodeBase);
