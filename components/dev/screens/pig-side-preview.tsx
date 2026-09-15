// Dev preview for two things the visit screen does that are awkward to reach
// live: (1) a WORN ITEM on a TURNED pig — the three-quarter `face` families
// take the item's side sprite when one exists (tools/gen_side_items.py);
// (2) the TICKLE reaction on a turned pig — the visit's own sequence
// (surprise, then happy 420 ms later) on the host pig, so a vanishing pig can
// be reproduced without a friend, a lock or a server.
//
//   xcrun simctl openurl <UDID> "ticklethepig://pig-side-preview"
//   xcrun simctl openurl <UDID> "ticklethepig://pig-side-preview?motion=reduced"
//
// Front / Side toggles `facing`; Standing / Sitting toggles the rest pose;
// Item cycles every item with side art first, then a few front-only ones (so
// the fallback shows too); Tickle fires the reaction.
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import { PigStage, type EquippedItem } from "@/components/ui/PigStage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Hand, T } from "@/components/ui/Text";
import type { PigReaction } from "@/components/ui/pigRendererContract";
import { HAT_IMAGES, HAT_REL } from "@/constants/hats";
import { HAT_SIDE_IMAGES } from "@/constants/hat_side.generated";
import { PAGE_PAD, SPACE, UI_COLORS } from "@/constants/theme";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { PIG_IDS, type PigId } from "@/utils/pigs";

export default function PigSidePreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <PigSidePreview />;
}

type Facing = "front" | "side";
type Rest = "stand" | "sit";
// The visit's own beat between the surprise take and the happy answer.
const HAPPY_AFTER_MS = 420;
// Front-only items shown after the side-art ones, so the fallback is visible.
const FRONT_ONLY_SAMPLE = 3;

function categoryOf(id: string): "hat" | "bow" | "glasses" {
  const anchor = HAT_REL[id]?.anchor;
  if (anchor === "neck") return "bow";
  if (anchor === "eyes") return "glasses";
  return "hat";
}

function PigSidePreview() {
  const { motion } = useLocalSearchParams<{ motion?: string | string[] }>();
  const requestedMotion = Array.isArray(motion) ? motion[0] : motion;
  const [facing, setFacing] = useState<Facing>("side");
  const [rest, setRest] = useState<Rest>("sit");
  const [pigIdx, setPigIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [reaction, setReaction] = useState<PigReaction | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const items = useMemo(() => {
    const side = Object.keys(HAT_SIDE_IMAGES).sort();
    const frontOnly = Object.keys(HAT_IMAGES)
      .filter((id) => !(id in HAT_SIDE_IMAGES) && !id.startsWith("flag_") && HAT_REL[id])
      .sort()
      .slice(0, FRONT_ONLY_SAMPLE);
    return [...side, ...frontOnly];
  }, []);
  const itemId = items[itemIdx % Math.max(1, items.length)];
  const hasSide = !!itemId && itemId in HAT_SIDE_IMAGES;
  const item: EquippedItem | null = itemId ? { id: itemId, category: categoryOf(itemId), emoji: null } : null;
  const pigId: PigId = PIG_IDS[pigIdx % PIG_IDS.length];

  const tickle = () => {
    // Exactly the visit's hand-off: a surprise take, then happy a beat later.
    setReaction({ id: ++seq.current, kind: "surprise" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setReaction({ id: ++seq.current, kind: "happy" }), HAPPY_AFTER_MS);
  };

  return (
    <MotionPolicyProvider reduceMotion={requestedMotion === "reduced"}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.page}>
        <T role="pageTitle">Pig side preview</T>
        <Hand tone="secondary">
          {itemId ?? "no items"} · {hasSide ? "side sprite" : "front sprite (no side art yet)"} · {pigId}
        </Hand>

        <View style={styles.stage} testID="pig-side-stage">
          <PigStage
            pigId={pigId}
            pigAnimation={rest === "sit" ? "sit" : "idle"}
            pigMood="content"
            facing={facing === "side" ? "left" : undefined}
            pigReaction={reaction}
            onPigComplete={() => setReaction(null)}
            equipped={item?.category === "hat" ? item : null}
            equippedBow={item?.category === "bow" ? item : null}
            equippedGlasses={item?.category === "glasses" ? item : null}
          />
        </View>

        <SegmentedControl
          label="Facing"
          value={facing}
          onChange={setFacing}
          options={[
            { value: "front", label: "Front" },
            { value: "side", label: "Side" },
          ]}
        />
        <SegmentedControl
          label="Rest"
          value={rest}
          onChange={setRest}
          options={[
            { value: "stand", label: "Standing" },
            { value: "sit", label: "Sitting" },
          ]}
        />
        <View style={styles.row}>
          <Button variant="primary" onPress={() => setItemIdx((i) => i + 1)} testID="preview-next-item">
            Next item
          </Button>
          <Button variant="primary" onPress={() => setPigIdx((i) => i + 1)} testID="preview-next-pig">
            Next pig
          </Button>
          <Button variant="gold" onPress={tickle} testID="preview-tickle">
            Tickle
          </Button>
        </View>
        <Hand tone="secondary">
          Tickle plays the visit's surprise → happy on this pig. The pig must stay drawn through both.
        </Hand>
      </View>
    </MotionPolicyProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: UI_COLORS.canvas,
    paddingHorizontal: PAGE_PAD,
    paddingTop: SPACE.xxl,
    gap: SPACE.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACE.sm,
  },
});
