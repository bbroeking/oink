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
import { GameIcon } from "@/components/ui/GameIcon";
import { RitualBubbleHost, showRitualBubble } from "@/components/ui/RitualBubble";
import { Sticker } from "@/components/ui/Sticker";
import { Hand, T } from "@/components/ui/Text";
import { ART_SIZE, BORDER, PAGE_PAD, RADII, SPACE, UI_COLORS } from "@/constants/theme";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { RITUAL_DOOR } from "@/hooks/useRitualDoor";
import { dailyRitual, type RitualMode } from "@/utils/rituals";

export default function RitualBubblePreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <RitualBubblePreview />;
}

const TARGET = "Bandit";

// The fixture's two doors wear the friend row's own drawing (RITUAL_DOOR's
// fill on the ink outline, the door's mark over its verb), so the preview
// shows a curse as a curse. It used to be the success Button: green "it
// worked" chrome on the one hostile send. (2026-10-04)
function PreviewDoor({
  mode,
  onPress,
  testID,
}: {
  mode: RitualMode;
  onPress: () => void;
  testID: string;
}) {
  const door = RITUAL_DOOR[mode];
  return (
    <Sticker
      color={door.fill}
      rotate={0}
      radius={RADII.md}
      border={BORDER.ink}
      shadow="sm"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${door.verb} ${TARGET}`}
      accessibilityHint="Plays the ritual bubble on this screen only. Nothing is cast"
      testID={testID}
      style={styles.door}
    >
      <GameIcon name={mode} size={ART_SIZE.glyphSm} />
      <T role="label">{`${door.verb} ${TARGET}`}</T>
    </Sticker>
  );
}

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
          <PreviewDoor mode="bless" onPress={bless} testID="preview-bless" />
          <PreviewDoor mode="curse" onPress={curse} testID="preview-curse" />
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
  door: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
});
