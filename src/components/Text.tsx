import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant =
  | 'nameXL'
  | 'nameLG'
  | 'nameSM'
  | 'data'
  | 'dataSM'
  | 'sectionLabel'
  | 'relation'
  | 'year'
  | 'yearSM'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption';

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

  return <RNText {...rest} style={[theme.type[variant] as TextStyle, { color }, style]} />;
}
