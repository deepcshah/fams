import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './Text';

export function Card({
  style,
  padded = true,
  tone = 'surface',
  ...rest
}: ViewProps & { padded?: boolean; tone?: 'surface' | 'alt' | 'outline' }) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: tone === 'alt' ? theme.colors.surfaceAlt : tone === 'outline' ? 'transparent' : theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: theme.colors.border,
          padding: padded ? theme.space.lg : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
}

export function Divider({ style, inset = 0 }: { style?: ViewStyle; inset?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.colors.border, marginLeft: inset },
        style,
      ]}
    />
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.space.sm,
        marginTop: theme.space.xl,
      }}>
      <AppText variant="overline" tone="faint" style={{ textTransform: 'uppercase' }}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.space.xxxl, paddingHorizontal: theme.space.xl, gap: theme.space.sm }}>
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceAlt,
            marginBottom: theme.space.sm,
          }}>
          {icon}
        </View>
      ) : null}
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: theme.space.md }}>{action}</View> : null}
    </View>
  );
}

/** Cross-platform elevation that looks the same on web as it does on native. */
export function shadow(color: string, level: 1 | 2 | 3 = 1): ViewStyle {
  const config = {
    1: { radius: 8, y: 2, opacity: 0.08, elevation: 2 },
    2: { radius: 18, y: 6, opacity: 0.12, elevation: 6 },
    3: { radius: 32, y: 14, opacity: 0.18, elevation: 12 },
  }[level];

  if (Platform.OS === 'android') {
    return { elevation: config.elevation };
  }
  return {
    shadowColor: color,
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.y },
  };
}
