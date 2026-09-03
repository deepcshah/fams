import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

import { initialsOf } from '@/lib/relations';
import { useTheme } from '@/theme';
import type { Person } from '@/types';

import { AppText } from './Text';

const HUES = [12, 34, 55, 96, 152, 188, 214, 262, 292, 330];

function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return HUES[hash % HUES.length];
}

export function Avatar({
  person,
  size = 44,
  showPhoto = true,
  ring,
  style,
}: {
  person?: Person;
  size?: number;
  showPhoto?: boolean;
  ring?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const hue = hueFor(person ? person.id + person.firstName : 'unknown');
  const saturation = theme.isDark ? 32 : 46;
  const lightness = theme.isDark ? 26 : 88;
  const textLightness = theme.isDark ? 78 : 30;
  const deceased = Boolean(person?.deathDate);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
          borderWidth: ring ? 2 : 1,
          borderColor: ring ?? theme.colors.border,
          overflow: 'hidden',
        },
        style,
      ]}>
      {showPhoto && person?.photoUri ? (
        <Image
          source={{ uri: person.photoUri }}
          style={{ width: '100%', height: '100%', opacity: deceased ? 0.88 : 1 }}
          contentFit="cover"
          transition={140}
        />
      ) : (
        <AppText
          style={{
            fontSize: size * 0.38,
            lineHeight: size * 0.46,
            fontWeight: '700',
            letterSpacing: 0.3,
            color: `hsl(${hue}, ${saturation + 12}%, ${textLightness}%)`,
          }}>
          {initialsOf(person)}
        </AppText>
      )}
    </View>
  );
}
