import { StyleSheet, View, type ViewStyle } from 'react-native';

import { initialsOf } from '@/lib/relations';
import { Photo } from './Photo';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { AppText } from './Text';

/**
 * A small portrait. Square-ish rather than circular, and uncoloured, so a
 *列 of these reads as a contact sheet: the photographs carry all the colour
 * and the people with none recede politely into the paper.
 */
export function Avatar({
  person,
  size = 36,
  ring,
  style,
}: {
  person?: Person;
  size?: number;
  ring?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const hasPhoto = Boolean(person?.photoUri);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.max(4, size * 0.16),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: hasPhoto ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
          borderWidth: ring ? 1.5 : hasPhoto ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor: ring ?? theme.colors.border,
        },
        style,
      ]}>
      {hasPhoto ? (
        <Photo uri={person!.photoUri} style={{ width: '100%', height: '100%' }} transition={140} />
      ) : (
        <AppText
          variant="nameSM"
          tone="faint"
          style={{ fontSize: Math.max(8, size * 0.3), lineHeight: Math.max(11, size * 0.38) }}>
          {initialsOf(person)}
        </AppText>
      )}
    </View>
  );
}
