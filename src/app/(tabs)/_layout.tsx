import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';

import { Icon, type IconName } from '@/components/Icon';
import { shadow } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { useTheme } from '@/theme';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Tree', icon: 'tree' },
  people: { label: 'People', icon: 'users' },
  insights: { label: 'Insights', icon: 'sparkle' },
  settings: { label: 'Settings', icon: 'sliders' },
};

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          paddingHorizontal: theme.space.md,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 4,
          backgroundColor: theme.colors.bgElevated,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        shadow(theme.colors.shadow, 2),
      ]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{
              flex: 1,
              maxWidth: 132,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              paddingVertical: 6,
              borderRadius: theme.radius.md,
              backgroundColor: focused ? theme.colors.accentSoft : 'transparent',
            }}>
            <Icon name={meta.icon} size={21} color={focused ? theme.colors.accent : theme.colors.textFaint} />
            <AppText
              variant="caption"
              style={{ fontSize: 11, color: focused ? theme.colors.accent : theme.colors.textFaint }}>
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Tree' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
