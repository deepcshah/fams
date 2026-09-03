import { Platform, Pressable, View, type PressableProps, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { AppText } from './Text';
import { shadow } from './Surface';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

function tap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  fullWidth,
  disabled,
  style,
  onPress,
  ...rest
}: Omit<PressableProps, 'style'> & {
  label: string;
  icon?: IconName;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const height = size === 'sm' ? 34 : size === 'lg' ? 52 : 44;
  const paddingHorizontal = size === 'sm' ? theme.space.md : theme.space.lg;

  const background =
    variant === 'primary'
      ? theme.colors.accent
      : variant === 'danger'
        ? theme.colors.dangerSoft
        : variant === 'secondary'
          ? theme.colors.surfaceAlt
          : 'transparent';
  const foreground =
    variant === 'primary'
      ? theme.colors.accentText
      : variant === 'danger'
        ? theme.colors.danger
        : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={(event) => {
        tap();
        onPress?.(event);
      }}
      {...rest}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal,
          borderRadius: theme.radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.sm,
          backgroundColor: background,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.colors.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        variant === 'primary' ? shadow(theme.colors.shadow, 1) : null,
        style,
      ]}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} color={foreground} /> : null}
      <AppText
        variant={size === 'sm' ? 'label' : 'bodyStrong'}
        style={{ color: foreground }}
        numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  size = 40,
  variant = 'secondary',
  active,
  style,
  onPress,
  ...rest
}: Omit<PressableProps, 'style'> & {
  icon: IconName;
  label: string;
  size?: number;
  variant?: 'primary' | 'secondary' | 'ghost';
  active?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const background = active
    ? theme.colors.accentSoft
    : variant === 'primary'
      ? theme.colors.accent
      : variant === 'ghost'
        ? 'transparent'
        : theme.colors.surface;
  const foreground = active
    ? theme.colors.accent
    : variant === 'primary'
      ? theme.colors.accentText
      : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={(event) => {
        tap();
        onPress?.(event);
      }}
      {...rest}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: active ? theme.colors.accentSoft : theme.colors.border,
          opacity: pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}>
      <Icon name={icon} size={size * 0.48} color={foreground} />
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
  tone = 'default',
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'accent' | 'sage';
}) {
  const theme = useTheme();
  const accent = tone === 'sage' ? theme.colors.sage : theme.colors.accent;
  const softAccent = tone === 'sage' ? theme.colors.sageSoft : theme.colors.accentSoft;
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: Boolean(selected) } : undefined}
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: theme.space.md,
        height: 32,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? softAccent : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? accent : 'transparent',
      }}>
      {icon ? <Icon name={icon} size={14} color={selected ? accent : theme.colors.textMuted} /> : null}
      <AppText variant="label" style={{ color: selected ? accent : theme.colors.textMuted }}>
        {label}
      </AppText>
    </Wrapper>
  );
}
