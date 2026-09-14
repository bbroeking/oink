// Dev preview for Snout Deep — a full local dig on a fixed seed, no server.
// The founder's try-out on the web target (spec §11 step 2): the reducer runs
// under useReducer, the three sheets mount from the screen, and a dev strip
// at the very top shows the rolls. `?seed=` (default 20260913) · `?coop=1` ·
// `?uncrewed=1` · `?motion=reduced`.
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { SnoutDeepPatch } from "@/components/mudwar/SnoutDeepPatch";
import { DigReceiptSheet } from "@/components/mudwar/SnoutDeepSheets";
import { Button, Label, Sticker, T } from "@/components/ui";
import { SPACE, WHIMSY } from "@/constants/theme";
import { WAKE_DIE } from "@/constants/dig";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { generateLayeredBoard } from "@/utils/rooting";
import {
  decodeAction,
  initialState,
  reduce,
  wakeDrawAt,
  wakeThreshold,
  type DigReceipt,
} from "@/utils/snoutDeep";

const DEFAULT_SEED = 20260913;
// A Feeding's "closes in" for the sign: 2h 10m, ticking.
const PREVIEW_SECONDS_LEFT = 2 * 3600 + 10 * 60;


export default function SnoutDeepPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <SnoutDeepPreview />;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function SnoutDeepPreview() {
  const params = useLocalSearchParams<{
    seed?: string | string[];
    coop?: string | string[];
    uncrewed?: string | string[];
    motion?: string | string[];
    help?: string | string[];
  }>();
  const seedParam = Number(one(params.seed));
  const [seed, setSeed] = useState(
    Number.isFinite(seedParam) && seedParam > 0 ? Math.trunc(seedParam) : DEFAULT_SEED,
  );
  const coop = one(params.coop) === "1";
  const uncrewed = one(params.uncrewed) === "1";
  const reduceMotion = one(params.motion) === "reduced";
  const helpOnMount = one(params.help) === "1";

  // A new seed from the old one, deterministic: the next board is always the
  // same next board, so a report can say "seed N, then Dig again".
  const digAgain = () => setSeed((s) => (s * 7 + 13) % 2147483646 || DEFAULT_SEED);

  return (
    <MotionPolicyProvider reduceMotion={reduceMotion}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Keyed on the seed: a new seed is a new dig, reducer and all. */}
      <LocalDig key={seed} seed={seed} coop={coop} uncrewed={uncrewed} reduceMotion={reduceMotion} helpOnMount={helpOnMount} onDigAgain={digAgain} />
    </MotionPolicyProvider>
  );
}

function LocalDig({
  seed,
  coop,
  uncrewed,
  reduceMotion,
  helpOnMount,
  onDigAgain,
}: {
  seed: number;
  coop: boolean;
  uncrewed: boolean;
  reduceMotion: boolean;
  helpOnMount: boolean;
  onDigAgain: () => void;
}) {
  const board = useMemo(() => generateLayeredBoard(seed), [seed]);
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(board, { coop, uncrewed }));
  const [receipt, setReceipt] = useState<DigReceipt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_SECONDS_LEFT);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const onDone = useCallback((r: DigReceipt) => {
    setReceipt(r);
    setSheetOpen(true);
  }, []);

  // The last draw, read straight off the stream — the k-th action drew the
  // k-th number; the reducer keeps only the count.
  const lastEntry = state.actions.length > 0 ? state.actions[state.actions.length - 1] : null;
  const last = lastEntry ? decodeAction(lastEntry) : null;
  const lastDraw = state.wakeIndex > 0 ? wakeDrawAt(seed, state.wakeIndex - 1) : null;
  const lastThreshold = last ? wakeThreshold(last.layer, last.verb, state.coop) : null;
  const strip =
    `seed ${seed} · ${state.actions.length} actions · wake ${state.wakeIndex}` +
    (lastEntry && lastDraw != null && lastThreshold != null
      ? ` · last ${lastEntry} drew ${lastDraw}/${WAKE_DIE} vs ${lastThreshold}${lastDraw < lastThreshold ? " WAKE" : ""}`
      : "") +
    (coop ? " · co-op" : "") +
    (uncrewed ? " · uncrewed" : "") +
    (reduceMotion ? " · reduced motion" : "");

  return (
    <View style={styles.page}>
      <View style={styles.devStrip} accessibilityRole="text">
        <Label tone="onDarkAccent">{strip}</Label>
      </View>
      {/* On the web target the window is a desktop; the dig is a phone screen,
          so it plays in a phone-wide column instead of stretching across. */}
      <View style={styles.phone}>
      <SnoutDeepPatch
        state={state}
        dispatch={dispatch}
        secondsLeft={secondsLeft}
        onExit={onDigAgain}
        onDone={onDone}
        helpOnMount={helpOnMount}
      />
      {state.ended && !sheetOpen ? (
        <View style={styles.again} pointerEvents="box-none">
          <Sticker color="sun" pad style={styles.againCard}>
            <T role="cardTitle">the dig is over</T>
            <Button
              variant="gold"
              size="md"
              full
              onPress={onDigAgain}
              accessibilityLabel="Dig again with a new seed"
              accessibilityHint="Starts a fresh dig on the next seed"
            >
              Dig again (new seed)
            </Button>
            <Button
              variant="handLink"
              size="sm"
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Show the receipt again"
            >
              show the receipt ›
            </Button>
          </Sticker>
        </View>
      ) : null}
      {receipt ? (
        <DigReceiptSheet
          visible={sheetOpen}
          receipt={receipt}
          onPrimary={() => setSheetOpen(false)}
          onSecondary={() => setSheetOpen(false)}
          onJoin={() => setSheetOpen(false)}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      </View>
    </View>
  );
}

// The phone the dig is drawn for — the reveal family's frame width.
const PHONE_W = 390;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: WHIMSY.cream },
  phone: {
    flex: 1,
    width: "100%",
    maxWidth: PHONE_W,
    alignSelf: "center",
  },
  devStrip: {
    backgroundColor: WHIMSY.bark,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  again: {
    position: "absolute",
    left: SPACE.lg,
    right: SPACE.lg,
    bottom: SPACE.xl,
    alignItems: "center",
  },
  againCard: { alignSelf: "stretch", gap: SPACE.sm },
});
