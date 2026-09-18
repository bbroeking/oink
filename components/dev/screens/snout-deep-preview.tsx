// Dev preview for Snout Deep — a full local dig on a fixed seed, no server.
// The founder's try-out on the web target (spec §11 step 2): the reducer runs
// under useReducer, the three sheets mount from the screen, and a dev strip
// at the very top shows the rolls. `?seed=` (default 20260913) · `?rules=1|2`
// (default 2 — the wake meter; 1 is build 192's per-action roll) ·
// `?meter=50-110` (the band his sleep depth is drawn from) · `?scope=board|dig`
// (whether a descent quiets him and redraws it, or the meter runs the whole
// dig) · `?coop=1` ·
// `?uncrewed=1` · `?motion=reduced` · `?before=` (the tally's count before the
// dig; default 0 — offline, the tally counts from DIG_FIND_TICKLES and no
// server corrects it) · `?satchel=` what the receipt's bag beat shows: `2`
// (two finds in, the default) · `full` (one in, one turned away) · `none`
// (the pre-Satchel receipt) · `late` (the roll lands a beat after the
// sheet, the way a slow server's receipt does).
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { SnoutDeepPatch } from "@/components/mudwar/SnoutDeepPatch";
import { DigReceiptSheet } from "@/components/mudwar/SnoutDeepSheets";
import { Button, Label, Sticker, T } from "@/components/ui";
import { SPACE, WHIMSY } from "@/constants/theme";
import { WAKE_DIE, WAKE_METER, type WakeMeter } from "@/constants/dig";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { generateLayeredBoard } from "@/utils/rooting";
import {
  decodeAction,
  initialState,
  reconcileReceipt,
  reduce,
  wakeDrawAt,
  wakeThreshold,
  type DigReceipt,
} from "@/utils/snoutDeep";
import type { SatchelRoll } from "@/hooks/useRooting";

// The bag beat's fixtures — the server's `receipt.satchel` as it would land.
type SatchelFixture = "2" | "full" | "none" | "late";
const SATCHEL_ROLLS: Readonly<Record<Exclude<SatchelFixture, "none">, SatchelRoll>> = {
  "2": { found: ["river_pebble", "old_key"], lost: [], count: 3, cap: 6 },
  full: { found: ["clover"], lost: ["marble"], count: 6, cap: 6 },
  late: { found: ["honeycomb"], lost: [], count: 4, cap: 6 },
};
// A slow server: the receipt's roll lands this long after the sheet opens.
const LATE_ROLL_MS = 2400;

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
    rules?: string | string[];
    meter?: string | string[];
    scope?: string | string[];
    help?: string | string[];
    before?: string | string[];
    satchel?: string | string[];
  }>();
  const seedParam = Number(one(params.seed));
  const [seed, setSeed] = useState(
    Number.isFinite(seedParam) && seedParam > 0 ? Math.trunc(seedParam) : DEFAULT_SEED,
  );
  const coop = one(params.coop) === "1";
  // The meter is what this build plays; ?rules=1 is the old game, for a
  // side-by-side. `?meter=lo-hi` and `?scope=` stand in for the tuning row.
  const rules: 1 | 2 = one(params.rules) === "1" ? 1 : 2;
  const wakeMeter: WakeMeter = useMemo(() => {
    const band = /^(\d+)-(\d+)$/.exec(one(params.meter) ?? "");
    const scope = one(params.scope) === "dig" ? "dig" : WAKE_METER.scope;
    return {
      ...WAKE_METER,
      ...(band ? { lo: Number(band[1]), hi: Number(band[2]) } : {}),
      scope,
    };
  }, [params.meter, params.scope]);
  const uncrewed = one(params.uncrewed) === "1";
  const reduceMotion = one(params.motion) === "reduced";
  const helpOnMount = one(params.help) === "1";
  const beforeParam = Number(one(params.before));
  const tickledBefore = Number.isFinite(beforeParam) && beforeParam >= 0 ? Math.trunc(beforeParam) : 0;
  const satchelParam = one(params.satchel);
  const satchel: SatchelFixture =
    satchelParam === "full" || satchelParam === "none" || satchelParam === "late" ? satchelParam : "2";

  // A new seed from the old one, deterministic: the next board is always the
  // same next board, so a report can say "seed N, then Dig again".
  const digAgain = () => setSeed((s) => (s * 7 + 13) % 2147483646 || DEFAULT_SEED);

  return (
    <MotionPolicyProvider reduceMotion={reduceMotion}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Keyed on the seed: a new seed is a new dig, reducer and all. */}
      <LocalDig key={`${seed}:${rules}:${wakeMeter.lo}-${wakeMeter.hi}:${wakeMeter.scope}`} seed={seed} rules={rules} wakeMeter={wakeMeter} coop={coop} uncrewed={uncrewed} reduceMotion={reduceMotion} helpOnMount={helpOnMount} tickledBefore={tickledBefore} satchel={satchel} onDigAgain={digAgain} />
    </MotionPolicyProvider>
  );
}

function LocalDig({
  seed,
  rules,
  wakeMeter,
  coop,
  uncrewed,
  reduceMotion,
  helpOnMount,
  tickledBefore,
  satchel,
  onDigAgain,
}: {
  seed: number;
  rules: 1 | 2;
  wakeMeter: WakeMeter;
  coop: boolean;
  uncrewed: boolean;
  reduceMotion: boolean;
  helpOnMount: boolean;
  tickledBefore: number;
  satchel: SatchelFixture;
  onDigAgain: () => void;
}) {
  const board = useMemo(() => generateLayeredBoard(seed), [seed]);
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState(board, { coop, uncrewed, rules, wakeMeter }),
  );
  const [receipt, setReceipt] = useState<DigReceipt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_SECONDS_LEFT);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const onDone = useCallback(
    (r: DigReceipt) => {
      // The server's receipt, stood in for: the bag roll rides in with the
      // sheet, or a beat later on `late` — the path a slow receipt takes.
      const roll = satchel === "none" ? null : SATCHEL_ROLLS[satchel];
      setReceipt(roll && satchel !== "late" ? reconcileReceipt(r, { satchel: roll }) : r);
      setSheetOpen(true);
      if (roll && satchel === "late") {
        setTimeout(() => setReceipt((cur) => (cur ? reconcileReceipt(cur, { satchel: roll }) : cur)), LATE_ROLL_MS);
      }
    },
    [satchel],
  );

  // The last draw, read straight off the stream — the k-th action drew the
  // k-th number; the reducer keeps only the count.
  const lastEntry = state.actions.length > 0 ? state.actions[state.actions.length - 1] : null;
  const last = lastEntry ? decodeAction(lastEntry) : null;
  const lastDraw = state.wakeIndex > 0 ? wakeDrawAt(seed, state.wakeIndex - 1) : null;
  // Under the meter nothing rolls: the strip reads the bar against his sleep
  // depth instead, and the draws it shows are the ones the stream spent.
  const lastThreshold = last ? wakeThreshold(last.layer, last.verb, state.coop) : null;
  const strip =
    `seed ${seed} · rules ${rules}${
      rules === 2
        ? ` · meter ${state.attention}/${state.sleepDepth} of ${wakeMeter.lo}-${wakeMeter.hi} ${wakeMeter.scope}`
        : ""
    } · ${state.actions.length} actions · wake ${state.wakeIndex}` +
    (lastEntry && lastThreshold != null
      ? rules === 2
        ? ` · last ${lastEntry} +${lastThreshold}`
        : ` · last ${lastEntry} drew ${lastDraw}/${WAKE_DIE} vs ${lastThreshold}${lastDraw != null && lastDraw < lastThreshold ? " WAKE" : ""}`
      : "") +
    (coop ? " · co-op" : "") +
    (uncrewed ? " · uncrewed" : "") +
    (reduceMotion ? " · reduced motion" : "");

  // The in-app dig is a full-screen mode padded by the safe areas
  // (AdaptiveModalScaffold `fullScreen`); the preview sits the same way so a
  // layout check here is the real layout.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
        tickledBefore={tickledBefore}
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
