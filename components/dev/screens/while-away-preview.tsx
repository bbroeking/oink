// Dev preview for the "while you were away" recap — the reveal family's
// sheet with a scrolling list of tilted rows. The real modal only presents
// when the server reports events since the last launch, so this mounts it on
// a fixture: enough rows to scroll (the bleed gutter's whole reason), one of
// each event class, a two-line headline. `?motion=reduced` for Reduce Motion.
import { useState } from "react";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { WhileAwayModal, type WhileAwayEvent } from "@/components/WhileAwayModal";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";

export default function WhileAwayPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <WhileAwayPreview />;
}

const EVENTS: WhileAwayEvent[] = [
  { source: "system", announcementId: 1, title: "Someone visited your Barn!", body: "the piggler came by and tickled your pig!", route: "/(tabs)/friends" },
  { source: "system", announcementId: 2, title: "Someone visited your Barn!", body: "tegdirB came by and tickled your pig!", route: "/(tabs)/friends" },
  { source: "system", announcementId: 3, title: "Someone visited your Barn!", body: "the piggler came by and tickled your pig!", route: "/(tabs)/friends" },
  { source: "system", announcementId: 4, title: "Someone visited your Barn!", body: "coopatroopa came by and tickled your pig!", route: "/(tabs)/friends" },
  { source: "blessing", kind: "warm_tea", from: "Jen" },
  { source: "curse", kind: "sluggish_snout", from: "Marco" },
  { source: "trade_fulfilled", amount: 3, from: "Pip" },
];

function WhileAwayPreview() {
  const { motion } = useLocalSearchParams<{ motion?: string | string[] }>();
  const requestedMotion = Array.isArray(motion) ? motion[0] : motion;
  const [visible, setVisible] = useState(true);
  return (
    <MotionPolicyProvider reduceMotion={requestedMotion === "reduced"}>
      <Stack.Screen options={{ headerShown: false }} />
      <WhileAwayModal
        visible={visible}
        events={EVENTS}
        onDismiss={() => setVisible(false)}
        onNavigate={() => setVisible(false)}
      />
    </MotionPolicyProvider>
  );
}
