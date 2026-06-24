import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Coffee } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { Confetti } from '@/components/anim/Confetti';
import { useTipJar, tipJarSupported, type TipTier } from '@/lib/iap';
import { useDonationStore } from '@/stores/donationStore';
import { openSupport } from '@/lib/support';
import { useMotion } from '@/lib/useMotion';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * "Buy the dev a coffee" — the native StoreKit tip jar (iOS). Reached from the Dashboard
 * support nudge and Settings → Buy the dev a coffee. Android never opens this (it uses the
 * Ko-fi link); if it's somehow reached without IAP support, it falls back to that link.
 */
export default function TipScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.header}>
        <FsText variant="h2">Buy the dev a coffee</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
      </View>
      {tipJarSupported ? <TipJarBody /> : <UnsupportedBody />}
    </SafeAreaView>
  );
}

function Intro() {
  return (
    <>
      <View style={styles.brand}>
        <Coffee color={colors.primary} size={34} />
      </View>
      <FsText variant="bodyMedium" style={styles.lead}>
        Hale is free — no ads, no account, nothing behind a paywall. If it’s useful to you, you can
        buy me a coffee to support development. Totally optional, and it unlocks nothing — everything
        stays free for everyone.
      </FsText>
    </>
  );
}

function TipJarBody() {
  const router = useRouter();
  const { animate, confetti } = useMotion();
  const { tiers, ready, purchasing, thanked, error, buy } = useTipJar();
  const [waited, setWaited] = useState(false);

  // Once a tip lands, snooze the Dashboard nudge (same as the old "Donate" tap did).
  useEffect(() => {
    if (thanked) {
      haptic.success();
      useDonationStore.getState().markDonated();
    }
  }, [thanked]);

  // Give the store a generous window to load before showing "unavailable" — on a
  // personal-team build (no Paid Apps Agreement) products never arrive, which is expected.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (thanked) {
    return (
      <View style={styles.center}>
        {confetti && <Confetti />}
        <View style={styles.brand}>
          <Coffee color={colors.primary} size={40} />
        </View>
        <FsText variant="display" style={{ textAlign: 'center' }}>
          Thanks for the coffee! ☕
        </FsText>
        <FsText variant="bodyMedium" style={styles.lead}>
          It genuinely means a lot and helps keep Hale free for everyone.
        </FsText>
        <View style={{ alignSelf: 'stretch', marginTop: space[4] }}>
          <Button title="You're welcome" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!ready) {
    if (waited) return <UnavailableBody />;
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <FsText variant="caption" style={{ marginTop: space[3] }}>
          Loading…
        </FsText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }}>
      <Intro />
      <View style={{ gap: space[3], marginTop: space[6] }}>
        {tiers.map((t) => (
          <TierRow
            key={t.sku}
            tier={t}
            busy={purchasing === t.sku}
            disabled={purchasing != null}
            animate={animate}
            onPress={() => {
              haptic.tap();
              buy(t.sku);
            }}
          />
        ))}
      </View>
      {error && (
        <FsText variant="caption" style={{ color: colors.danger, textAlign: 'center', marginTop: space[4] }}>
          {error}
        </FsText>
      )}
      <FsText variant="caption" style={styles.fineprint}>
        Purchased through the App Store. A tip is a one-time thank-you — it doesn’t unlock any
        features, and you can give one any time.
      </FsText>
    </ScrollView>
  );
}

function TierRow({
  tier,
  busy,
  disabled,
  animate,
  onPress,
}: {
  tier: TipTier;
  busy: boolean;
  disabled: boolean;
  animate: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.tier, pressed && animate && { opacity: 0.85 }]}>
      <View style={styles.cups}>
        {Array.from({ length: tier.cups }).map((_, i) => (
          <Coffee key={i} color={colors.primary} size={18} />
        ))}
      </View>
      <FsText variant="bodyMedium" style={{ flex: 1 }}>
        {tier.label}
      </FsText>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FsText variant="bodyMedium" style={{ fontWeight: '700', color: colors.primary }}>
          {tier.price}
        </FsText>
      )}
    </Pressable>
  );
}

/** Store products never loaded (e.g. personal-team build / sandbox not yet configured). */
function UnavailableBody() {
  const router = useRouter();
  return (
    <View style={styles.center}>
      <View style={styles.brand}>
        <Coffee color={colors.muted} size={34} />
      </View>
      <FsText variant="bodyMedium" style={styles.lead}>
        The coffee shop is closed right now — in-app purchases aren’t available on this device. Thanks
        for the thought, though!
      </FsText>
      <View style={{ alignSelf: 'stretch', marginTop: space[4] }}>
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

/** Reached on a platform/build without the native tip jar (Expo Go, etc.) — fall back to Ko-fi. */
function UnsupportedBody() {
  const router = useRouter();
  return (
    <View style={styles.center}>
      <Intro />
      <View style={{ alignSelf: 'stretch', marginTop: space[4], gap: space[2] }}>
        <Button
          title="Buy me a coffee"
          onPress={() => {
            useDonationStore.getState().markDonated();
            openSupport();
            router.back();
          }}
        />
        <Button title="Maybe later" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[4],
      paddingTop: space[4],
      paddingBottom: space[2],
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
    brand: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(99,102,241,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: space[4],
    },
    lead: { textAlign: 'center', color: colors.muted },
    tier: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: space[4],
      paddingHorizontal: space[4],
    },
    cups: { flexDirection: 'row', gap: 2, width: 64 },
    fineprint: { textAlign: 'center', color: colors.muted, marginTop: space[6] },
  })
);
