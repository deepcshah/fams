import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { IconButton } from './Button';
import { shadow } from './Surface';
import { AppText } from './Text';

/**
 * A bottom sheet on phones that becomes a centred dialog on wide screens, so
 * the same component works for the web build without feeling like a phone app
 * stretched sideways.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: theme.space.lg, paddingTop: title ? 0 : theme.space.lg, gap: theme.space.md }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ padding: theme.space.lg, paddingTop: title ? 0 : theme.space.lg, gap: theme.space.md }}>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Animated.View
          entering={SlideInDown.duration(260).dampingRatio(0.9)}
          exiting={SlideOutDown.duration(180)}
          style={[
            {
              backgroundColor: theme.colors.bgElevated,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              borderBottomLeftRadius: Platform.OS === 'web' ? theme.radius.xl : 0,
              borderBottomRightRadius: Platform.OS === 'web' ? theme.radius.xl : 0,
              paddingBottom: insets.bottom + theme.space.md,
              maxHeight: '86%',
              width: '100%',
              maxWidth: wide ? 720 : 560,
              alignSelf: 'center',
              marginBottom: Platform.OS === 'web' ? theme.space.xl : 0,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
            shadow(theme.colors.shadow, 3),
          ]}>
          <View style={{ alignItems: 'center', paddingTop: theme.space.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderStrong }} />
          </View>

          {title ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: theme.space.md,
                padding: theme.space.lg,
                paddingBottom: theme.space.md,
              }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="title">{title}</AppText>
                {subtitle ? (
                  <AppText variant="body" tone="muted">
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <IconButton icon="close" label="Close" size={34} onPress={onClose} />
            </View>
          ) : null}

          {body}

          {footer ? (
            <View
              style={{
                padding: theme.space.lg,
                paddingTop: theme.space.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
