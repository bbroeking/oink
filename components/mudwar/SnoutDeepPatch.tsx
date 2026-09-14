// Snout Deep — the dig screen (spec §5.2). A renderer over the pure reducer
// in utils/snoutDeep.ts: every tap is an event, every pixel is a function of
// state. Top → bottom: the sign and the Hungerer, the layer strip, the patch,
// the whisper, the pouch, the footer, the verb bar. Plain Views, Pressables,
// Animated and react-native-svg only, so the founder's try-out runs on the
// web target; the Skia LivingMudSurface follows once the rules are settled.
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { PATCH_COLS, PATCH_ROWS, SHOVE_HOLD_MS } from "@/constants/dig";
import {
  ART_SIZE,
  BORDER,
  DIG_TILE,
  OPACITY,
  PAGE_PAD,
  RADII,
  SHADOW_SM,
  SPACE,
  STICKER_SHADOW,
  TILT,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { formatCountdownHM } from "@/utils/duration";
import { popIn } from "@/utils/motionRecipes";
import {
  findAtTile,
  findCopy,
  findRevealLine,
  gtReasons,
  LAYER_NAMES,
  receipt as buildReceipt,
  whisperFor,
  type DigReceipt,
  type Find,
  type Layer,
  type SnoutDeepEvent,
  type SnoutDeepState,
  type Verb,
} from "@/utils/snoutDeep";
import { Button, Chip, Hand, IconButton, Label, Sticker, T, Tag } from "../ui";
import { FindMark } from "./FindMark";
import { Hungerer, HUNGERER_STATE_LABEL, hungererStateFor } from "./Hungerer";
import { DecisionSheet } from "./SnoutDeepSheets";

// --- ART -------------------------------------------------------------------
// The patch's drawing geometry. Tiles are 55 × 52 on the canvas; here the
// width is whatever six columns get after the page pad, the patch rim and
// five gutters, and the height keeps the canvas's ratio. The scent disc and
// the mark on a tile are drawing sizes, not spacing steps.
const TILE_RATIO = 52 / 55;
const TILE_MAX_W = 55;
const TILE_GAP = SPACE.xs;
const SCENT_DISC = 20;
const SCENT_OFFSET = -6;
const TILE_MARK = 22;
const POUCH_MARK = ART_SIZE.glyphSm;
// His face at the badge step: the header is one row of 84pt, not a portrait.
const HUNGERER_FACE = ART_SIZE.badge;
// How long a reveal sticker stays up: two "read one line" beats.
const REVEAL_DWELL_MS = 1600;
// The reveal's lean — a sticker slapped on in a hurry.
const REVEAL_TILT = 1.2;

const VERBS: readonly Verb[] = ["sniff", "rub", "shove"];
const VERB_LABEL: Readonly<Record<Verb, string>> = { sniff: "Sniff", rub: "Rub", shove: "Shove" };
// The price under each verb, per layer. Topsoil's sniff is the only free
// action in the dig; from the mud down a sniff is the quietest, never free.
const VERB_SUB: Readonly<Record<Layer, Readonly<Record<Verb, string>>>> = {
  0: { sniff: "free", rub: "quiet", shove: "loud" },
  1: { sniff: "quietest", rub: "quiet", shove: "loud" },
  2: { sniff: "quietest", rub: "quiet", shove: "loud" },
};
const LAYER_CHIP: Readonly<Record<Layer, string>> = { 0: "topsoil", 1: "the mud", 2: "the root" };

export interface SnoutDeepPatchProps {
  state: SnoutDeepState;
  dispatch: (event: SnoutDeepEvent) => void;
  /** Seconds until the patch closes, for the sign; omit to hide the line. */
  secondsLeft?: number;
  /** The open phase's live countdown ("3h 58m") — the same string the Barn's fan row shows. Wins over `secondsLeft`. */
  phaseCountdown?: string;
  /** The close chip: leave the dig without ending it. */
  onExit: () => void;
  /** Fires once when the dig ends, with what the payoff sheet renders. */
  onDone: (receipt: DigReceipt) => void;
  /** The Boom's tickles — the catch-up's boom(H); 3 when unknown. */
  boomTickles?: number;
}

export function SnoutDeepPatch({
  state,
  dispatch,
  secondsLeft,
  phaseCountdown,
  onExit,
  onDone,
  boomTickles,
}: SnoutDeepPatchProps) {
  const [verb, setVerb] = useState<Verb>("rub");
  const [reveal, setReveal] = useState<Find | null>(null);
  const [decisionFor, setDecisionFor] = useState<Layer | null>(null);
  const [decisionSeen, setDecisionSeen] = useState<Layer[]>([]);
  const { width } = useWindowDimensions();

  const woke = state.ended?.reason === "wake";
  const atRoot = state.layer === 2;
  const face = hungererStateFor(state.layer, woke);
  const gt = gtReasons(state).length;
  const gtIfTied = state.uncrewed ? 0 : gt + (state.loose ? 1 : 0) + (atRoot && state.layersTied.includes(1) ? 1 : 0);

  // A thing surfaces → the reveal sticker, for a beat. Tracked by the length
  // of `things` so a re-render never re-announces one.
  const thingsSeen = useRef(state.things.length);
  useEffect(() => {
    if (state.things.length <= thingsSeen.current) {
      thingsSeen.current = state.things.length;
      return;
    }
    thingsSeen.current = state.things.length;
    const id = state.things[state.things.length - 1];
    const f = state.board.layers.flatMap((l) => l.finds).find((x) => x.id === id) ?? null;
    setReveal(f);
    const t = setTimeout(() => setReveal(null), REVEAL_DWELL_MS);
    return () => clearTimeout(t);
  }, [state.things, state.board]);

  // The truffle comes loose → the decision, once per layer (§5.5). Both
  // controls stay in the footer at all times.
  useEffect(() => {
    if (!state.loose || state.ended || decisionSeen.includes(state.layer)) return;
    setDecisionSeen((seen) => [...seen, state.layer]);
    setDecisionFor(state.layer);
  }, [state.loose, state.layer, state.ended, decisionSeen]);

  // The end → the receipt, once.
  const doneFor = useRef<SnoutDeepState["ended"]>(null);
  useEffect(() => {
    if (!state.ended || doneFor.current === state.ended) return;
    doneFor.current = state.ended;
    setDecisionFor(null);
    onDone(buildReceipt(state, boomTickles));
  }, [state, onDone, boomTickles]);

  const act = useCallback(
    (v: Verb, tile: number) => dispatch({ type: "act", verb: v, tile }),
    [dispatch],
  );

  // Six columns inside the page pad, the patch rim and five gutters.
  const inner = width - PAGE_PAD * 2 - BORDER.ink * 2 - SPACE.sm * 2;
  const tileW = Math.min(TILE_MAX_W, Math.floor((inner - TILE_GAP * (PATCH_COLS - 1)) / PATCH_COLS));
  const tileH = Math.round(tileW * TILE_RATIO);

  const layerFinds = state.board.layers[state.layer].finds;
  const closesIn = phaseCountdown
    ? `closes in ${phaseCountdown}`
    : secondsLeft != null
      ? `closes in ${formatCountdownHM(secondsLeft)}`
      : null;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
        {/* HEADER: the close chip and the sign on the left, his face on the right. */}
        <View style={styles.header}>
          <IconButton name="x" label="Leave the patch" onPress={onExit} variant="paper" />
          {/* One line each: the sign must not wrap, or the header eats the patch. */}
          <Sticker color="paper" shadow="sm" rotate={TILT.card} style={styles.sign}>
            <Label numberOfLines={1}>the truffle patch · Feeding</Label>
            {closesIn ? (
              <Hand tone="secondary" numberOfLines={1}>
                {closesIn}
              </Hand>
            ) : null}
          </Sticker>
          <View style={styles.hungerer}>
            <Hungerer state={face} size={HUNGERER_FACE} />
            <Tag label={HUNGERER_STATE_LABEL[face]} tone={woke ? "roseDeep" : atRoot ? "rose" : "paper"} />
          </View>
        </View>

        {/* THE REVEAL: full width, above the layer strip, for a beat. */}
        {reveal ? <FindReveal find={reveal} boomTickles={boomTickles} /> : null}

        {/* THE LAYER STRIP: done = sage · now = sun · below = cream. */}
        <View style={styles.layerStrip} accessibilityRole="text" accessibilityLabel={`layer ${state.layer + 1} of 3, ${LAYER_NAMES[state.layer]}`}>
          {([0, 1, 2] as const).map((l) => (
            <Tag
              key={l}
              label={LAYER_CHIP[l]}
              tone={l < state.layer ? "sage" : l === state.layer ? "sun" : "muted"}
              icon={l < state.layer ? "check" : undefined}
            />
          ))}
        </View>

        {/* THE PATCH. */}
        <View style={[styles.patch, atRoot && styles.patchRoot]}>
          {Array.from({ length: PATCH_ROWS }, (_, r) => (
            <View key={r} style={styles.row}>
              {Array.from({ length: PATCH_COLS }, (_, c) => {
                const idx = r * PATCH_COLS + c;
                return (
                  <TilePressable
                    key={idx}
                    idx={idx}
                    row={r}
                    col={c}
                    width={tileW}
                    height={tileH}
                    depth={state.depths[idx]}
                    scent={state.scent[idx]}
                    find={findAtTile(state, idx)}
                    ended={!!state.ended}
                    verb={verb}
                    onAct={act}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* THE WHISPER. */}
        <Sticker color="cream" shadow="sm" rotate={-TILT.card} style={styles.whisper}>
          <Hand numberOfLines={2}>{whisperFor(state)}</Hand>
        </Sticker>

        {/* THE POUCH: loose · his if he wakes / tied · yours for keeps. */}
        <View style={styles.pouch}>
          <PouchWell
            kicker="loose"
            sub={woke ? "his — he took it" : "his if he wakes"}
            finds={state.loose ? layerFinds.filter((f) => f.id === state.loose) : []}
            empty={atRoot ? "nothing to lose down here" : "nothing loose yet"}
            tone={woke ? "rose" : "paper"}
          />
          <PouchWell
            kicker="tied"
            sub="yours for keeps"
            finds={state.board.layers.flatMap((l) => l.finds).filter((f) => state.banked.includes(f.id) || state.things.includes(f.id))}
            empty="nothing tied yet"
            tone="paper"
          />
        </View>

        {/* THE FOOTER: at the root the tie is the gold primary and Dig deeper is gone. */}
        <View style={styles.footer}>
          {atRoot ? (
            <Button
              variant="gold"
              size="md"
              full
              disabled={!!state.ended}
              onPress={() => dispatch({ type: "tie" })}
              accessibilityLabel={`Tie it off, plus ${gtIfTied} Golden Truffles`}
              accessibilityHint="Banks everything and ends the dig"
            >
              {`Tie it off · +${gtIfTied} Golden Truffle${gtIfTied === 1 ? "" : "s"}`}
            </Button>
          ) : (
            <>
              <View style={styles.footerHalf}>
                <Button
                  variant="ghost"
                  size="sm"
                  full
                  disabled={!!state.ended}
                  onPress={() => dispatch({ type: "tie" })}
                  accessibilityLabel="Tie it off"
                  accessibilityHint="Banks the loose truffle and ends the dig"
                >
                  Tie it off
                </Button>
              </View>
              <View style={styles.footerHalf}>
                <Button
                  variant="ghost"
                  size="sm"
                  full
                  disabled={!!state.ended}
                  onPress={() => dispatch({ type: "descend" })}
                  accessibilityLabel={`Dig deeper, into ${LAYER_NAMES[(state.layer + 1) as Layer]}`}
                  accessibilityHint="Banks the loose truffle and opens the next layer"
                >
                  Dig deeper
                </Button>
              </View>
            </>
          )}
        </View>

        {/* THE VERB BAR: the selected verb on sun; hold-to-shove works regardless. */}
        <View style={styles.verbBar} accessibilityRole="radiogroup" accessibilityLabel="Verb">
          {VERBS.map((v) => (
            <Chip
              key={v}
              role="radio"
              label={VERB_LABEL[v]}
              sub={VERB_SUB[state.layer][v]}
              selected={verb === v}
              tone={verb === v ? "sun" : "paper"}
              onPress={() => setVerb(v)}
              accessibilityLabel={`${VERB_LABEL[v]}, ${VERB_SUB[state.layer][v]}`}
              accessibilityHint="Selects what a tap on the patch does"
              style={styles.verbChip}
            />
          ))}
        </View>
        <Label tone="secondary" style={styles.verbNote}>
          hold a tile to shove
        </Label>
      </ScrollView>

      {decisionFor != null ? (
        <DecisionSheet
          visible
          layer={decisionFor}
          coop={state.coop}
          gtSoFar={state.uncrewed ? 0 : gt + 1}
          onDeeper={() => {
            setDecisionFor(null);
            dispatch({ type: "descend" });
          }}
          onTie={() => {
            setDecisionFor(null);
            dispatch({ type: "tie" });
          }}
          onClose={() => setDecisionFor(null)}
        />
      ) : null}
    </View>
  );
}

// ── The tile ────────────────────────────────────────────────────────────────

function TilePressable({
  idx,
  row,
  col,
  width,
  height,
  depth,
  scent,
  find,
  ended,
  verb,
  onAct,
}: {
  idx: number;
  row: number;
  col: number;
  width: number;
  height: number;
  depth: number;
  scent: number | null;
  find: Find | null;
  ended: boolean;
  verb: Verb;
  onAct: (verb: Verb, tile: number) => void;
}) {
  const cleared = depth <= 0;
  const half = !cleared && depth <= 1;
  const shown = find && find.kind !== "stone" ? find : null;
  const fill = cleared ? WHIMSY.cream : half ? DIG_TILE.mud[0] : depth < 2 ? DIG_TILE.mud[1] : DIG_TILE.mud[2];
  const stateWord = cleared
    ? shown
      ? `cleared, ${findCopy(shown).title}`
      : find
        ? "cleared, a stone"
        : "cleared"
    : half
      ? shown
        ? "half cleared, something under it"
        : find
          ? "half cleared, a stone"
          : "half cleared, nothing under it"
      : "buried";
  return (
    <Pressable
      onPress={() => onAct(verb, idx)}
      onLongPress={() => onAct("shove", idx)}
      delayLongPress={SHOVE_HOLD_MS}
      disabled={ended || cleared}
      accessibilityRole="button"
      accessibilityLabel={`row ${row + 1}, column ${col + 1}, ${stateWord}${scent != null ? `, scent ${scent}` : ""}`}
      accessibilityHint={cleared ? undefined : `${verb === "sniff" ? "Sniffs" : verb === "rub" ? "Rubs" : "Shoves"} this tile; hold to shove`}
      style={({ pressed }) => [
        styles.tile,
        { width, height, backgroundColor: fill },
        cleared && styles.tileCleared,
        pressed && !cleared && styles.tilePressed,
      ]}
    >
      {cleared && shown ? <FindMark kind={shown.kind} size={TILE_MARK} /> : null}
      {cleared && find && !shown ? <FindMark kind="stone" size={TILE_MARK} /> : null}
      {half && find ? <FindMark kind={find.kind} size={TILE_MARK} silhouette /> : null}
      {scent != null ? (
        <View style={styles.scent} pointerEvents="none">
          <Hand numberOfLines={1}>{scent}</Hand>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── The reveal sticker (§5.3) ───────────────────────────────────────────────

function FindReveal({ find, boomTickles }: { find: Find; boomTickles?: number }) {
  const policy = useMotionPolicy();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    scale.setValue(0);
    opacity.setValue(0);
    const anim = popIn(scale, opacity, policy);
    anim.start();
    return () => anim.stop();
  }, [find.id, policy, scale, opacity]);
  const copy = findCopy(find, boomTickles);
  return (
    <Animated.View style={[styles.reveal, { opacity, transform: [{ scale }] }]}>
      <Sticker
        color={copy.tone === "paper" ? "cream" : copy.tone}
        rotate={REVEAL_TILT}
        pad
        accessibilityRole="text"
        accessibilityLabel={findRevealLine(find, boomTickles)}
        style={styles.revealSticker}
      >
        <View style={styles.revealRow}>
          <FindMark kind={find.kind} size={POUCH_MARK} />
          <T role="cardTitle" numberOfLines={2} style={styles.revealText}>
            {findRevealLine(find, boomTickles)}
          </T>
        </View>
      </Sticker>
    </Animated.View>
  );
}

// ── The pouch ───────────────────────────────────────────────────────────────

function PouchWell({
  kicker,
  sub,
  finds,
  empty,
  tone,
}: {
  kicker: string;
  sub: string;
  finds: Find[];
  empty: string;
  tone: "paper" | "rose";
}) {
  return (
    <Sticker
      color={tone}
      shadow="sm"
      rotate={0}
      borderStyle={finds.length === 0 ? "dashed" : "solid"}
      accessibilityRole="text"
      accessibilityLabel={`${kicker}, ${sub}: ${finds.length === 0 ? empty : finds.map((f) => findCopy(f).title).join(", ")}`}
      style={styles.well}
    >
      <View style={styles.wellHead}>
        <Label>{kicker}</Label>
        <Hand tone="secondary" numberOfLines={1} style={styles.wellSub}>
          {sub}
        </Hand>
      </View>
      <View style={styles.wellMarks}>
        {finds.length === 0 ? (
          <Hand tone="disabled" numberOfLines={1}>
            {empty}
          </Hand>
        ) : (
          finds.map((f) => <FindMark key={f.id} kind={f.kind} size={POUCH_MARK} />)
        )}
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: WHIMSY.cream },
  // Tight on purpose: the whole dig fits a 17 Pro's modal without a scroll
  // (header 84 · strip 28 · patch ≈ 270 · whisper 56 · pouch 56 · footer 40 ·
  // verbs 48, plus these gaps). The ScrollView is the safety net for small
  // phones and large type, not the design.
  scroll: {
    paddingHorizontal: PAGE_PAD,
    paddingVertical: SPACE.sm,
    gap: SPACE.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
  },
  sign: {
    flex: 1,
    minWidth: 0,
    gap: SPACE.xxs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  hungerer: { alignItems: "center", gap: SPACE.xs },
  layerStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
  },
  // The patch: a paper-rimmed block of mud; the rim goes rose at the root.
  patch: {
    alignSelf: "center",
    padding: SPACE.sm,
    gap: TILE_GAP,
    borderRadius: RADII.lg,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    backgroundColor: WHIMSY.dirtDeep,
    ...STICKER_SHADOW,
  },
  patchRoot: {
    borderColor: WHIMSY.roseDeep,
    borderWidth: BORDER.heavy,
  },
  row: { flexDirection: "row", gap: TILE_GAP },
  tile: {
    borderRadius: RADII.sm,
    borderWidth: BORDER.hair,
    borderColor: WHIMSY.dirtDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  tileCleared: { borderColor: UI_COLORS.uiMuted },
  tilePressed: { opacity: OPACITY.pressed },
  // The scent: a paper disc with a hand numeral on the tile's top-right corner.
  scent: {
    position: "absolute",
    top: SCENT_OFFSET,
    right: SCENT_OFFSET,
    width: SCENT_DISC,
    height: SCENT_DISC,
    borderRadius: RADII.pill,
    borderWidth: BORDER.thin,
    borderColor: UI_COLORS.border,
    backgroundColor: WHIMSY.paper,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW_SM,
  },
  whisper: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  pouch: { flexDirection: "row", gap: SPACE.md },
  well: { flex: 1, minWidth: 0, gap: SPACE.xxs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  wellHead: { flexDirection: "row", alignItems: "baseline", gap: SPACE.xs, minWidth: 0 },
  wellSub: { flex: 1, minWidth: 0 },
  wellMarks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: POUCH_MARK,
  },
  footer: { flexDirection: "row", gap: SPACE.md },
  footerHalf: { flex: 1, minWidth: 0 },
  verbBar: { flexDirection: "row", gap: SPACE.sm, justifyContent: "center" },
  verbChip: { flex: 1 },
  verbNote: { textAlign: "center" },
  reveal: { alignSelf: "stretch" },
  revealSticker: { alignSelf: "stretch" },
  revealRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  revealText: { flex: 1, minWidth: 0 },
});

export const SNOUT_DEEP_REVEAL_DWELL_MS = REVEAL_DWELL_MS;
