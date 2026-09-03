import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/Surface';
import { useTheme } from '@/theme';

export default function NotFoundScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center' }}>
      <EmptyState
        icon={<Icon name="tree" size={26} color={theme.colors.accent} />}
        title="That branch does not exist"
        message="The page you were looking for is not part of this tree."
        action={<Button label="Back to the tree" icon="arrowLeft" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
