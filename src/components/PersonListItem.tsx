import { Pressable, View } from 'react-native';

import { lifespan } from '@/lib/dates';
import { fullName } from '@/lib/relations';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { AppText } from './Text';

export function PersonListItem({
  person,
  subtitle,
  trailing,
  selected,
  onPress,
}: {
  person: Person;
  subtitle?: string;
  trailing?: 'chevron' | 'check' | 'none';
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const years = lifespan(person.birthDate, person.deathDate);
  const detail = subtitle ?? [years, person.birthPlace].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fullName(person)}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.lg,
        backgroundColor: selected ? theme.colors.accentSoft : pressed ? theme.colors.surfaceAlt : 'transparent',
        borderRadius: theme.radius.md,
      })}>
      <Avatar person={person} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {fullName(person)}
        </AppText>
        {detail ? (
          <AppText variant="relation" tone="faint" numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {trailing === 'check' && selected ? <Icon name="check" size={18} color={theme.colors.accent} /> : null}
      {trailing === 'chevron' ? <Icon name="chevronRight" size={18} color={theme.colors.textFaint} /> : null}
    </Pressable>
  );
}
