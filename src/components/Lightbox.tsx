import { useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { IconButton } from './Button';
import { AppText } from './Text';

/** Full-bleed photo viewer with prev/next, used from the album and the canvas. */
export function Lightbox({
  photos,
  startIndex = 0,
  visible,
  onClose,
  caption,
}: {
  photos: string[];
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
  caption?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);

  // Reset to the tapped photo whenever the viewer is (re)opened. Adjusting
  // state during render is React's own answer to this; an effect would run a
  // frame late and flash the previous photo.
  const openKey = `${visible}:${startIndex}`;
  const [lastOpenKey, setLastOpenKey] = useState(openKey);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setIndex(startIndex);
  }

  if (photos.length === 0) return null;
  const safeIndex = Math.min(Math.max(index, 0), photos.length - 1);
  const step = (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(140)}
        style={{ flex: 1, backgroundColor: theme.colors.lightbox, justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={onClose}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        <Image
          source={{ uri: photos[safeIndex] }}
          style={{
            width: width - 120,
            height: height - insets.top - insets.bottom - 150,
            alignSelf: 'center',
          }}
          contentFit="contain"
          transition={160}
        />

        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <IconButton icon="close" label="Close photo" variant="ghost" onPress={onClose} />
        </View>

        {photos.length > 1 ? (
          <>
            <View style={{ position: 'absolute', left: 14, top: height / 2 - 20 }}>
              <IconButton icon="chevronLeft" label="Previous photo" variant="ghost" onPress={() => step(-1)} />
            </View>
            <View style={{ position: 'absolute', right: 14, top: height / 2 - 20 }}>
              <IconButton icon="chevronRight" label="Next photo" variant="ghost" onPress={() => step(1)} />
            </View>
          </>
        ) : null}

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 20, alignItems: 'center', gap: 4 }}>
          {caption ? (
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.74)' }}>
              {caption}
            </AppText>
          ) : null}
          {photos.length > 1 ? (
            <AppText variant="relation" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {safeIndex + 1} / {photos.length}
            </AppText>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}
