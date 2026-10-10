import { Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideInRight, SlideOutDown, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFamilyStore } from '@/store/familyStore';
import { detailPanelWidth, useTheme } from '@/theme';

import { IconButton } from './Button';
import { PersonDetail } from './PersonDetail';
import { shadow } from './Surface';

/**
 * The person detail. A floating panel docked to the right on desktop, the same
 * content as a bottom sheet on a phone — the reference is a desktop tool, and
 * a side panel is what lets you keep the tree in view while you read.
 */
export function PersonDetailSurface({
  personId,
  onClose,
  onGoToPerson,
  onAddRelative,
  onOpenCanvas,
  topInset = 0,
}: {
  personId?: string;
  onClose: () => void;
  onGoToPerson: (id: string) => void;
  onAddRelative: (id: string) => void;
  onOpenCanvas?: (id: string) => void;
  topInset?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const person = useFamilyStore((state) => (personId ? state.tree.people[personId] : undefined));

  if (!person) return null;

  const body = (
    <PersonDetail
      person={person}
      onGoToPerson={onGoToPerson}
      onAddRelative={onAddRelative}
      onOpenCanvas={onOpenCanvas}
      onBeforeNavigate={theme.wide ? undefined : onClose}
    />
  );

  const closeButton = (
    <View style={{ position: 'absolute', top: theme.space.md, right: theme.space.md, zIndex: 2 }}>
      {/* The panel scrolls under this, so it needs its own ground. */}
      <IconButton icon="close" label="Close details" size={30} onPress={onClose} />
    </View>
  );

  if (theme.wide) {
    return (
      <Animated.View
        entering={SlideInRight.duration(240)}
        exiting={SlideOutRight.duration(180)}
        style={[
          {
            position: 'absolute',
            top: topInset + theme.space.md,
            right: theme.space.md,
            bottom: insets.bottom + theme.space.md,
            width: detailPanelWidth,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          },
          shadow(theme.colors.shadow, 3),
        ]}>
        {closeButton}
        {body}
      </Animated.View>
    );
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(140)}
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close details"
          onPress={onClose}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Animated.View
          entering={SlideInDown.duration(250).dampingRatio(0.92)}
          exiting={SlideOutDown.duration(180)}
          style={[
            {
              maxHeight: '88%',
              paddingBottom: insets.bottom,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginBottom: Platform.OS === 'web' ? theme.space.lg : 0,
              marginHorizontal: Platform.OS === 'web' ? theme.space.lg : 0,
              borderBottomLeftRadius: Platform.OS === 'web' ? theme.radius.xl : 0,
              borderBottomRightRadius: Platform.OS === 'web' ? theme.radius.xl : 0,
            },
            shadow(theme.colors.shadow, 3),
          ]}>
          <View style={{ alignItems: 'center', paddingTop: theme.space.sm }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderStrong }} />
          </View>
          {closeButton}
          {body}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
