import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { AppText } from './Text';

/**
 * A confirmation dialog that behaves the same everywhere — React Native's
 * `Alert` is a no-op on the web, so the app never relies on it.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onCancel} scroll={false}>
      <View style={{ gap: theme.space.sm, marginTop: theme.space.md }}>
        <AppText variant="title">{title}</AppText>
        {message ? (
          <AppText variant="body" tone="muted">
            {message}
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.lg }}>
        <Button label={cancelLabel} variant="ghost" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          style={{ flex: 1 }}
          onPress={onConfirm}
        />
      </View>
    </Sheet>
  );
}
