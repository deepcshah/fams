import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './Text';

export function TextField({
  label,
  hint,
  style,
  multiline,
  ...rest
}: TextInputProps & { label: string; hint?: string; style?: ViewStyle }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: 6 }, style]}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={theme.colors.textFaint}
        selectionColor={theme.colors.accent}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        {...rest}
        style={[
          {
            minHeight: multiline ? 92 : 46,
            borderRadius: theme.radius.md,
            borderWidth: 1.5,
            borderColor: focused ? theme.colors.accent : theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.space.md,
            paddingVertical: multiline ? theme.space.md : Platform.OS === 'ios' ? theme.space.md : theme.space.sm,
            color: theme.colors.text,
            fontSize: 15,
            lineHeight: 21,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
      {hint ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceAlt,
          borderRadius: theme.radius.md,
          padding: 3,
          gap: 3,
        }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderWidth: selected ? StyleSheet.hairlineWidth * 2 : 0,
                borderColor: theme.colors.border,
              }}>
              <AppText variant="label" tone={selected ? 'default' : 'muted'} numberOfLines={1}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingRow({
  title,
  subtitle,
  right,
  onPress,
  leading,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
}) {
  const theme = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.lg,
        minHeight: 56,
      }}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </Wrapper>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <SettingRow
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
          thumbColor={Platform.OS === 'android' ? theme.colors.surface : undefined}
        />
      }
    />
  );
}
