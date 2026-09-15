// Dev preview for the ritual bubble — the cast moment. The real thing fires
// once per friend per day from a door that spends an allowance, which is no
// way to watch a 2.4 s animation, so this mounts a host of its own on a
// fixture: a Bless and a Curse button, today's rituals, a stand-in target.
// `?motion=reduced` for Reduce Motion (the host reads the policy above it).
//
//   xcrun simctl openurl <UDID> "ticklethepig://ritual-bubble-preview"
//   xcrun simctl openurl <UDID> "ticklethepig://ritual-bubble-preview?motion=reduced"
import { StyleSheet, View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import { RitualBubbleHost, showRitualBubble } from "@/components/ui/RitualBubble";
import { Hand, T } from "@/components/ui/Text";
import { PAGE_PAD, SPACE, UI_COLORS } from "@/constants/theme";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { dailyRitual } from "@/utils/rituals";

export default function RitualBubblePreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <RitualBubblePreview />;
}

const TARGET = "Bandit";

function RitualBubblePreview() {
  const { motion } = useLocalSearchParams<{ motion?: string | string[] }>();
  const requestedMotion = Array.isArray(motion) ? motion[0] : motion;
  const bless = () => {
    const ritual = dailyRitual("bless");
    showRitualBubble({
      mode: "bless",
      ritual,
      targetName: TARGET,
      announcement: `${ritual.name} sent to ${TARGET}`,
    });
  };
  const curse = () => {
    const ritual = dailyRitual("curse");
    showRitualBubble({
      mode: "curse",
      ritual,
      targetName: TARGET,
      announcement: `${TARGET} has been cursed`,
    });
  };
  return (
    <MotionPolicyProvider reduceMotion={requestedMotion === "reduced"}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.page}>
        <T role="pageTitle">Ritual bubble</T>
        <Hand tone="secondary">
          {requestedMotion === "reduced" ? "Reduce Motion: cross-fade" : "Full motion"}
        </Hand>
        <View style={styles.row}>
          <Button variant="gold" onPress={bless} testID="preview-bless">
            Bless {TARGET}
          </Button>
          <Button variant="success" onPress={curse} testID="preview-curse">
            Curse {TARGET}
          </Button>
        </View>
        <Hand tone="secondary">
          Tap Bless twice quickly to watch the second replace the first.
        </Hand>
      </View>
      {/* This screen's own host: the last host mounted takes the calls, and
          it reads the motion policy above it. */}
      <RitualBubbleHost />
    </MotionPolicyProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: UI_COLORS.canvas,
    paddingHorizontal: PAGE_PAD,
    paddingTop: SPACE.xxl,
    gap: SPACE.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    gap: SPACE.md,
  },
});
