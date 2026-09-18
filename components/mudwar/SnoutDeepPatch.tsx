// Snout Deep — the dig screen (spec §5.2). A renderer over the pure reducer
// in utils/snoutDeep.ts: every tap is an event, every pixel is a function of
// state. Top → bottom: the rail, the sleeper strip (rules 2), the verb bar,
// the layer strip, the patch, the whisper, the pouch, the footer. Plain Views, Pressables,
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
  PRESSED,
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
  attentionOf,
  canDescend,
  findAtTile,
  findCopy,
  findRevealLine,
  gtReasons,
  LAYER_NAMES,
  nextSniffAttention,
  nextThreshold,
  meterHazard,
  receipt as buildReceipt,
  shortOdds,
  sniffsLeft,
  wakePercent,
  whisperFor,
  type DigFindTickles,
  type DigReceipt,
  type Find,
  type Layer,
  type SnoutDeepEvent,
  type SnoutDeepState,
  type Verb,
} from "@/utils/snoutDeep";
import { Button, Hand, IconButton, Label, ProgressTrack, Shovel, Snout, Sticker, T, Tag, Trotter } from "../ui";
import { FindMark } from "./FindMark";
import {
  Hungerer,
  HUNGERER_METER_LABEL,
  HUNGERER_STATE_LABEL,
  hungererStateFor,
  type HungererState,
} from "./Hungerer";
import { SnoutDeepHelpSheet } from "./SnoutDeepSheets";

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
// His face at the badge step — a mark beside the rail or the bar, never a
// portrait.
const HUNGERER_FACE = ART_SIZE.badge;
// How long a reveal sticker stays up: two "read one line" beats.
const REVEAL_DWELL_MS = 1600;
// The reveal's lean — a sticker slapped on in a hurry.
const REVEAL_TILT = 1.2;

const VERBS: readonly Verb[] = ["sniff", "rub", "shove"];
// What each verb does, spoken — the picture says it, the hint says it too.
const VERB_HINT: Readonly<Record<Verb, string>> = {
  sniff: "A tap marks a tile with how many finds touch it. Moves no mud.",
  rub: "A tap clears a little mud on a tile and half-clears its neighbours.",
  shove: "A tap clears a tile and half-clears the four around it. Loud. Holding any tile shoves too.",
};
// The verb's picture, at the glyph step — art, so it takes a picture size.
const VERB_ART = ART_SIZE.glyph;

function VerbMark({ verb: v, size }: { verb: Verb; size: number }) {
  if (v === "sniff") return <Snout size={size} />;
  if (v === "rub") return <Trotter size={size} />;
  return <Shovel size={size} />;
}
const VERB_LABEL: Readonly<Record<Verb, string>> = { sniff: "Sniff", rub: "Rub", shove: "Shove" };
// The price under each verb: the chance the NEXT one wakes him, as a percent
// per action — "<1% he wakes", "8% he wakes" — one denominator on every card,
// bigger is louder (2026-09-16; the "1 in N" fractions read backwards). The
// sniff card counts its budget instead while it holds: "free · 3 left" in
// topsoil, "3% · 3 left" below, then its own percent as his attention builds.
// Under the METER (rules 2) a card carries no chance at all: it carries how
// LOUD the action is — "+15" — the same 120ths the bar under his face is
// drawn in, so the card and the bar are one unit (2026-09-17 §5).
function verbSub(state: SnoutDeepState, v: Verb): string {
  const thr = nextThreshold(state, v);
  if (state.rules === 2) {
    const price = thr <= 0 ? "free" : `+${thr}`;
    if (v === "sniff") {
      const left = sniffsLeft(state);
      if (left > 0) return `${price} · ${left} left`;
    }
    return price;
  }
  if (v === "sniff") {
    const left = sniffsLeft(state);
    if (thr <= 0) return `free · ${left} left`;
    if (left > 0) return `${wakePercent(thr)} · ${left} left`;
  }
  return shortOdds(thr);
}
// The meter's tint, by the band his face is in: asleep is sage, stirring is
// sun, an open eye is rose. One tint, two readings — the bar and the face.
const METER_TONE: Readonly<Record<HungererState, "sage" | "sun" | "rose">> = {
  snoring: "sage",
  stirring: "sun",
  oneeye: "rose",
  awake: "rose",
};
/** The card's price under the meter: how loud this verb is, as a number in
 *  the meter's own 120ths — "+1", "+10", "free". The number IS the price; a
 *  slice of bar at card scale (tried 2026-09-17) was two points wide for a
 *  shove and nothing for a rub, and read as a stray tick beside the numeral.
 *  The meter above is the one scale; the cards say how far each verb moves it. */
function VerbPrice({
  state,
  verb: v,
}: {
  state: SnoutDeepState;
  verb: Verb;
}) {
  const loud = nextThreshold(state, v);
  const left = v === "sniff" ? sniffsLeft(state) : 0;
  return (
    <View style={styles.price}>
      <T role="numeral" numberOfLines={1}>
        {loud <= 0 ? "free" : `+${loud}`}
      </T>
      {left > 0 ? (
        <Hand tone="secondary" numberOfLines={1}>{`· ${left} left`}</Hand>
      ) : null}
    </View>
  );
}
// What the tag under his face says while his attention is up.
const ATTENTIVE_LABEL = "noticing you";
const LAYER_CHIP: Readonly<Record<Layer, string>> = { 0: "topsoil", 1: "the mud", 2: "the root" };

export interface SnoutDeepPatchProps {
  state: SnoutDeepState;
  dispatch: (event: SnoutDeepEvent) => void;
  /** Seconds until the patch closes, for the sign; omit to hide the line. */
  secondsLeft?: number;
  /** The open phase's live countdown ("3h 58m") — the same string the Barn's fan row shows. Wins over `secondsLeft`. */
  phaseCountdown?: string;
  /** Open the how-it-works sheet as the screen mounts (a player's first dig). */
  helpOnMount?: boolean;
  /** The player closed the help sheet — stamp it seen. */
  onHelpSeen?: () => void;
  /** The close chip: leave the dig without ending it. */
  onExit: () => void;
  /** Fires once when the dig ends, with what the payoff sheet renders. */
  onDone: (receipt: DigReceipt) => void;
  /** Tickles per find kind — the server's table (open_rooting's dig_finds)
   *  when known; the compiled DIG_FIND_TICKLES otherwise. The Boom's entry is
   *  the catch-up's boom(H) once the server names it (3 when unknown). */
  tickles?: DigFindTickles;
  /** The player's tickle count as the dig opened (the Barn's stamp), for the
   *  tally's before → now; null when the caller can't know it. */
  tickledBefore?: number | null;
}

export function SnoutDeepPatch({
  state,
  dispatch,
  secondsLeft,
  phaseCountdown,
  helpOnMount = false,
  onHelpSeen,
  onExit,
  onDone,
  tickles,
  tickledBefore,
}: SnoutDeepPatchProps) {
  const boomTickles = tickles?.boom;
  const [verb, setVerb] = useState<Verb>("rub");
  const [reveal, setReveal] = useState<Find | null>(null);
  const { width } = useWindowDimensions();

  const woke = state.ended?.reason === "wake";
  const atRoot = state.layer === 2;
  // His attention: the next sniff would cost more than the layer's table
  // says. His face lifts a step and the tag says so — the budget made visible.
  const attentive = !woke && nextSniffAttention(state) > 0;
  // Rules 2: the meter is the truth about how deep he is sleeping, so the
  // BAND picks his face and the layer no longer does (§5).
  const metered = state.rules === 2;
  const { lo, hi } = state.wakeMeter;
  const meter = Math.min(hi, attentionOf(state));
  const face = hungererStateFor(state.layer, woke, attentive, metered ? { attention: meter, lo, hi } : null);
  // What the bar says out loud: where it stands, and — once it is inside the
  // band — the chance the selected verb is the one that reaches him.
  const meterLabel = !metered
    ? undefined
    : meter < lo
      ? `his attention, ${meter} of ${hi}. he sleeps through the first ${lo}.`
      : `his attention, ${meter} of ${hi}. past ${lo} — about a ${Math.round(
          meterHazard(state, verb) * 100,
        )}% chance the next ${VERB_LABEL[verb].toLowerCase()} is the one.`;
  // The word under the strip: what his face is saying, or — while the sniff
  // budget is spent — that he has noticed you, the way the rail's tag used to
  // say it. The band's own stamps carry the numbers.
  const sleeperWord = attentive ? ATTENTIVE_LABEL : HUNGERER_METER_LABEL[face];
  // How much of the track the band covers; the stamps' box is exactly that wide.
  const bandWidth = hi > 0 ? Math.min(Math.max((hi - lo) / hi, 0), 1) : 0;
  // Deeper is shut until this board's truffle is up (§4).
  const deeperOpen = canDescend(state);
  const gt = gtReasons(state).length;
  const gtIfTied = state.uncrewed ? 0 : gt + (state.loose ? 1 : 0) + (atRoot && state.layersTied.includes(1) ? 1 : 0);
  const allFinds = state.board.layers.flatMap((l) => l.finds);
  const findOf = (id: string) => allFinds.find((f) => f.id === id);
  // The stake: the loose truffle and every loose thing, all layers' worth.
  const looseCount = state.looseThings.length + (state.loose ? 1 : 0);
  // The loose well is the whole carried pouch. After a wake it shows what he
  // took (the pouch moved to `missed`; a truffle left in the ground on an
  // earlier layer is not his), in rose, so the last frame says what was lost.
  const looseIds = woke
    ? state.missed.filter((id) => {
        const f = findOf(id);
        return !!f && (!f.food || state.board.layers[state.layer].finds.some((x) => x.id === id));
      })
    : [...(state.loose ? [state.loose] : []), ...state.looseThings];
  const looseFinds = looseIds.map(findOf).filter((f): f is Find => !!f);
  const tiedFinds = allFinds.filter((f) => state.banked.includes(f.id) || state.things.includes(f.id));

  // A thing surfaces → the reveal sticker, for a beat. Tracked by the count of
  // things surfaced (`found` minus the truffles) so a re-render never
  // re-announces one, and a consumable and a collection thing announce alike.
  const thingsFound = state.found.filter((id) => !findOf(id)?.food);
  const thingsFoundCount = thingsFound.length;
  const lastThingId = thingsFound[thingsFound.length - 1] ?? null;
  const thingsSeen = useRef(thingsFoundCount);
  useEffect(() => {
    if (thingsFoundCount <= thingsSeen.current) {
      thingsSeen.current = thingsFoundCount;
      return;
    }
    thingsSeen.current = thingsFoundCount;
    const f = (lastThingId && state.board.layers.flatMap((l) => l.finds).find((x) => x.id === lastThingId)) || null;
    setReveal(f);
    const t = setTimeout(() => setReveal(null), REVEAL_DWELL_MS);
    return () => clearTimeout(t);
  }, [thingsFoundCount, lastThingId, state.board]);

  // The end → the receipt, once.
  const doneFor = useRef<SnoutDeepState["ended"]>(null);
  useEffect(() => {
    if (!state.ended || doneFor.current === state.ended) return;
    doneFor.current = state.ended;
    onDone(buildReceipt(state, { tickles, tickledBefore }));
  }, [state, onDone, tickles, tickledBefore]);

  // The explanation: from the sign, and once by itself on a first dig. The
  // first-dig read lands after mount (the seen stamp is async), so the prop
  // is watched, not read once; it opens the sheet the first time it turns
  // true and never again.
  const [helpOpen, setHelpOpen] = useState(false);
  const helpShown = useRef(false);
  useEffect(() => {
    if (!helpOnMount || helpShown.current) return;
    helpShown.current = true;
    setHelpOpen(true);
  }, [helpOnMount]);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    onHelpSeen?.();
  }, [onHelpSeen]);

  const act = useCallback(
    (v: Verb, tile: number) => dispatch({ type: "act", verb: v, tile }),
    [dispatch],
  );

  // Six columns inside the page pad, the patch rim and five gutters.
  const inner = width - PAGE_PAD * 2 - BORDER.ink * 2 - SPACE.sm * 2;
  const tileW = Math.min(TILE_MAX_W, Math.floor((inner - TILE_GAP * (PATCH_COLS - 1)) / PATCH_COLS));
  const tileH = Math.round(tileW * TILE_RATIO);

  const closesIn = phaseCountdown
    ? `closes in ${phaseCountdown}`
    : secondsLeft != null
      ? `closes in ${formatCountdownHM(secondsLeft)}`
      : null;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
        {/* THE RAIL: the close chip and the sign; under rules 1, his face too. */}
        <View style={styles.header}>
          <IconButton name="x" label="Leave the patch" onPress={onExit} variant="paper" />
          {/* One line each: the sign must not wrap, or the header eats the patch. */}
          <Sticker
            color="paper"
            shadow="sm"
            rotate={TILT.card}
            onPress={() => setHelpOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`The truffle patch${closesIn ? `, ${closesIn}` : ""}. How it works`}
            accessibilityHint="Opens the explanation of the dig"
            style={styles.sign}
          >
            <Label numberOfLines={1}>the truffle patch · Feeding</Label>
            <Hand tone="secondary" numberOfLines={1}>
              {closesIn ? `${closesIn} · ` : ""}how it works ›
            </Hand>
          </Sticker>
          {/* Under the meter his face leaves the rail for the strip below —
              one sleeper on the screen, not two. Rules 1 keeps the column it
              shipped with: the face and the tag that reads the layer. */}
          {metered ? null : (
            <View style={styles.hungerer}>
              <Hungerer state={face} size={HUNGERER_FACE} />
              {/* The tag is the face said in words. */}
              <Tag
                label={attentive ? ATTENTIVE_LABEL : HUNGERER_STATE_LABEL[face]}
                tone={woke ? "roseDeep" : attentive || atRoot ? "rose" : "paper"}
                testID="hungerer-tag"
              />
            </View>
          )}
        </View>

        {/* THE SLEEPER STRIP (rules 2, 2026-09-17): the whole row belongs to
            him — his face on the left as the bar's legend, the bar filling the
            rest. The darker stretch is the band his sleep depth was drawn
            from: everything left of it is certain sleep, its far end a certain
            wake, and each card's "+N" is a step along this same bar. Under it
            one line — the word his face is saying, and the band's two ends
            stamped where they fall, so the numbers sit under the thing they
            number. One object, so a screen reader hears it as one. */}
        {metered ? (
          <View
            testID="sleeper-strip"
            accessible
            accessibilityRole="text"
            accessibilityLabel={`attention ${meter} of ${hi}, band from ${lo}; ${sleeperWord}`}
            style={styles.sleeper}
          >
            <Hungerer state={face} size={HUNGERER_FACE} />
            <View style={styles.sleeperBar}>
              <ProgressTrack
                value={meter}
                max={hi}
                band={{ from: lo, to: hi }}
                tone={METER_TONE[face]}
                height="md"
                announceValue={false}
                accessibilityLabel={meterLabel}
              />
              <View style={styles.sleeperLine}>
                <Hand tone="secondary" numberOfLines={1} style={styles.sleeperWord}>
                  {sleeperWord}
                </Hand>
                {/* The stamps ride a box as wide as the band, so `lo` lands on
                    the band's left end and `hi` on the track's own edge. */}
                <View style={[styles.sleeperStamps, { width: `${bandWidth * 100}%` }]}>
                  <Label tone="secondary">{lo}</Label>
                  <Label tone="secondary">{hi}</Label>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* THE VERB BAR — at the top, where the hand reads it before the mud.
            Three picture buttons: the snout sniffs, the trotter rubs, the
            shovel shoves. The selected one wears sun and the full sticker
            shadow; hold-to-shove works whichever is selected. */}
        <View style={styles.verbBar} accessibilityRole="radiogroup" accessibilityLabel="Verb">
          {VERBS.map((v) => {
            const selected = verb === v;
            return (
              <Pressable
                key={v}
                onPress={() => setVerb(v)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={`${VERB_LABEL[v]}, ${verbSub(state, v)}`}
                accessibilityHint={VERB_HINT[v]}
                style={({ pressed }) => [
                  styles.verbButton,
                  selected && styles.verbButtonSelected,
                  pressed && styles.verbButtonPressed,
                ]}
              >
                <VerbMark verb={v} size={VERB_ART} />
                <Label>{VERB_LABEL[v]}</Label>
                {metered ? (
                  <VerbPrice state={state} verb={v} />
                ) : (
                  <Hand tone={selected ? "primary" : "secondary"} numberOfLines={1}>
                    {verbSub(state, v)}
                  </Hand>
                )}
              </Pressable>
            );
          })}
        </View>

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

        {/* THE POUCH: loose · his if he wakes / tied · yours for keeps. The
            loose well is the whole carried pouch — the truffle and every
            loose thing from every layer — not this layer's alone. */}
        <View style={styles.pouch}>
          <PouchWell
            kicker="loose"
            sub={woke ? "his — he took it" : "his if he wakes"}
            finds={looseFinds}
            empty="nothing loose yet"
            tone={woke ? "rose" : "paper"}
          />
          <PouchWell
            kicker="tied"
            sub="yours for keeps"
            finds={tiedFinds}
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
              {/* Two different acts, said in the labels (2026-09-16; the screen
                  fits a phone without a scroll, so no line under them, and the
                  half-width holds ~18 characters, so no counts — the pouch card
                  above already lists what is loose): the tie LEAVES with what's
                  banked — the gold one; digging deeper RESETS the board one
                  layer down, where he sleeps lighter. The counts stay in the
                  accessibility labels. */}
              <View style={styles.footerHalf}>
                <Button
                  variant="gold"
                  size="sm"
                  full
                  disabled={!!state.ended}
                  onPress={() => dispatch({ type: "tie" })}
                  accessibilityLabel={looseCount > 0 ? `Tie it off, leave with ${looseCount}` : "Tie it off and leave"}
                  accessibilityHint="Banks everything loose, leaves the patch and ends the dig"
                >
                  Tie it off · leave
                </Button>
              </View>
              {/* THE DESCENT GATE (2026-09-17 §4): deeper stays shut until
                  this board's truffle is out of the ground — the layer you
                  are on is the one you finish. The label says which of the
                  two acts is on offer; the reducer refuses either way. */}
              <View style={styles.footerHalf}>
                <Button
                  variant="ghost"
                  size="sm"
                  full
                  disabled={!!state.ended || !deeperOpen}
                  onPress={() => dispatch({ type: "descend" })}
                  accessibilityLabel={
                    deeperOpen
                      ? `Dig deeper, a new board in ${LAYER_NAMES[(state.layer + 1) as Layer]}${
                          looseCount > 0 ? `, carry ${looseCount} down` : ""
                        }`
                      : "Dig deeper, not yet"
                  }
                  accessibilityHint={
                    deeperOpen
                      ? "Banks the loose truffle, carries the loose things down and opens a fresh board one layer down"
                      : "Find this board's truffle first"
                  }
                >
                  {deeperOpen ? "Dig deeper · reset" : "Find the truffle first"}
                </Button>
              </View>
            </>
          )}
        </View>

      </ScrollView>

      {/* THE REVEAL: a sticker slapped over the header for a beat. It floats
          above the scroll — never in its flow — so surfacing a thing does
          not shove the patch under the player's trotter and snap it back
          1.6s later (2026-09-16). Taps pass through it. */}
      {reveal ? (
        <View style={styles.revealOverlay} pointerEvents="none">
          <FindReveal find={reveal} boomTickles={boomTickles} />
        </View>
      ) : null}

      <SnoutDeepHelpSheet visible={helpOpen} onClose={closeHelp} rules={state.rules} />
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
      {cleared && shown ? <FindMark kind={shown.kind} variant={shown.variant} size={TILE_MARK} /> : null}
      {cleared && find && !shown ? <FindMark kind="stone" size={TILE_MARK} /> : null}
      {half && find ? <FindMark kind={find.kind} variant={find.variant} size={TILE_MARK} silhouette /> : null}
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
          <FindMark kind={find.kind} variant={find.variant} size={POUCH_MARK} />
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
          finds.map((f) => <FindMark key={f.id} kind={f.kind} variant={f.variant} size={POUCH_MARK} />)
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
  // The sleeper strip: his face, then the bar for the rest of the row.
  sleeper: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  sleeperBar: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  sleeperLine: { flexDirection: "row", alignItems: "baseline", gap: SPACE.sm },
  sleeperWord: { flex: 1, minWidth: 0 },
  sleeperStamps: { flexDirection: "row", justifyContent: "space-between" },
  // The card's price row: the number, then that much bar.
  price: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs, minWidth: 0 },
  // One slice of the meter, drawn at card scale — same ink edge as the bar.
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
  verbBar: { flexDirection: "row", gap: SPACE.sm },
  // A picture button: the art on top, the verb, its price. Paper at rest;
  // sun with the full sticker shadow when selected.
  verbButton: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: SPACE.xxs,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.xs,
    borderRadius: RADII.lg,
    borderWidth: BORDER.ink,
    borderColor: WHIMSY.ink,
    backgroundColor: WHIMSY.paper,
    ...SHADOW_SM,
  },
  verbButtonSelected: {
    backgroundColor: WHIMSY.sun,
    ...STICKER_SHADOW,
  },
  verbButtonPressed: {
    ...PRESSED,
    elevation: 0,
  },
  // Pinned over the header row, inside the page pad, above everything.
  revealOverlay: {
    position: "absolute",
    top: SPACE.sm,
    left: PAGE_PAD,
    right: PAGE_PAD,
    zIndex: 10,
  },
  reveal: { alignSelf: "stretch" },
  revealSticker: { alignSelf: "stretch" },
  revealRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  revealText: { flex: 1, minWidth: 0 },
});

export const SNOUT_DEEP_REVEAL_DWELL_MS = REVEAL_DWELL_MS;
