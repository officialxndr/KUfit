import { View, StyleSheet, Pressable } from 'react-native';
import { Heart, X } from 'lucide-react-native';

import { Card, FsText, Button } from '@/components/ui';
import { useDonationStore, shouldShowDonationPrompt } from '@/stores/donationStore';
import { openSupport } from '@/lib/support';
import { haptic } from '@/lib/haptics';
import { colors, space, themedStyles } from '@/theme/tokens';

/**
 * Gentle, dismissible "Support Hale" nudge on the Dashboard. Renders nothing unless
 * the donation prompt is due (see `shouldShowDonationPrompt`). The X dismisses it
 * forever; "Remind me later" snoozes ~30 days; "Donate" opens the link (and snoozes).
 */
export function DonationBanner() {
  const s = useDonationStore();
  if (!shouldShowDonationPrompt(s)) return null;

  return (
    <Card style={{ marginBottom: space[3] }}>
      <View style={styles.head}>
        <View style={styles.iconWrap}><Heart color={colors.primary} size={18} /></View>
        <View style={{ flex: 1 }}>
          <FsText variant="bodyMedium">Enjoying Hale?</FsText>
          <FsText variant="caption">It's free forever, no ads — an optional donation keeps it that way.</FsText>
        </View>
        <Pressable onPress={() => { haptic.tap(); s.dismissForever(); }} hitSlop={8}>
          <X color={colors.muted} size={16} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
        <View style={{ flex: 1 }}>
          <Button title="Donate" onPress={() => { haptic.tap(); s.markDonated(); openSupport(); }} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Remind me later" variant="ghost" onPress={() => { haptic.tap(); s.remindLater(); }} />
        </View>
      </View>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  iconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center',
  },
}));
