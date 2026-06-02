import { AlertTriangle } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, FsText } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

/**
 * Non-blocking informational caution for aggressive/unsafe goals (below BMR,
 * faster than ~2 lb/week, very low calories). Renders nothing when `message`
 * is empty. Always shown — independent of the coaching-nudges toggle.
 */
export function GoalWarning({ message, style }: { message?: string | null; style?: object }) {
  if (!message) return null;
  return (
    <Card outlined style={{ marginBottom: space[3], flexDirection: 'row', gap: space[2], alignItems: 'flex-start', ...style }}>
      <AlertTriangle color={colors.warning} size={16} style={{ marginTop: 1 }} />
      <FsText variant="caption" style={{ color: colors.warning, flex: 1 }}>{message}</FsText>
    </Card>
  );
}
