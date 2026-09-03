import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'overline';
type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'danger' | 'inverse';

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
};

export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const color =
    tone === 'muted'
      ? theme.colors.textMuted
      : tone === 'faint'
        ? theme.colors.textFaint
        : tone === 'accent'
          ? theme.colors.accent
          : tone === 'danger'
            ? theme.colors.danger
            : tone === 'inverse'
              ? theme.colors.accentText
              : theme.colors.text;

  const base = theme.type[variant] as TextStyle;
  return <RNText {...rest} style={[base, { color }, style]} />;
}
