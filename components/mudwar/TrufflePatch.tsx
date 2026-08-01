// The Truffle Patch — the 8h feeding-window dig session (Season 1's heartbeat
// minigame; crowned 2026-07-03, see SKILL.md decision log).
//
// One chill scratch-to-dig board: rub (quiet, +1 stir) or snout-shove (loud,
// +3 stir) through 1–3 layers of mud; truffle-cluster silhouettes peek through
// the last layer; at full stir the Hunger lifts his snout and the session ends
// GRACEFULLY between actions — everything uncovered is already yours. There is
// no fail state, only "clean and quiet" vs "he stirred".
//
// Cozy skill layer (2026-07 legibility pass): warm/cold whispers hint at the
// nearest still-buried sweet find, and three useful reveals in a row gift a
// FREE rub (0 stir) — skill is rewarded as efficiency, nothing is ever taken.
//
// Board layout comes from utils/rooting.generateBoard(seed) — the server hands
// the seed (open_rooting) and re-validates the finds (submit_rooting), so this
// component is presentation + gesture only. The proximity/streak helpers are
// pure and READ-ONLY over the parity-locked board (never mutate its contents).

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  Share,
  AccessibilityInfo,
  type DimensionValue,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  PATCH_COLS,
  PATCH_ROWS,
  STIR_BUDGET,
  STIR_RUB,
  STIR_SHOVE,
  SHOVE_HOLD_MS,
} from "@/constants/dig";
import {
  generateBoard,
  claimableFinds,
  applySplash,
  clusterRevealed,
  nearestFindDistance,
  warmthWhisper,
  revealedSweetCell,
  nextStreak,
  tileIndexAt,
  clusterBox,
  partiallyRevealedFinds,
  gildedSilhouetteDepth,
  ClaimableFind,
  ClusterBox,
  Find,
} from "@/utils/rooting";
import { preload, play, startAmbience, stopAmbience } from "@/utils/sound";
import {
  scheduleOpenReminder,
  type OpenReminderResult,
} from "@/utils/pushNotifications";
import { nextOpenCountdown } from "@/utils/rooting";
import { observeFieldGuide } from "@/utils/fieldGuide";
import { RootingOutcome, RootingSession } from "@/hooks/useRooting";
import { ReclaimSlam, ReclaimSlamHandle } from "./ReclaimSlam";
import { HAT_IMAGES } from "@/constants/hats";
import { UNIQUE_BY_ID, UNIQUE_IMAGES } from "@/constants/uniques";
import { router } from "expo-router";
import { Glyph } from "@/components/ui/Glyph";
import { Icon } from "@/components/ui/Icon";
import {
  digShareData,
  buildDigShareText,
  bumpDigShareCount,
  type DigShareData,
} from "@/utils/digShare";
import { DigPostcardComposer } from "./DigPostcardComposer";
import {
  FONTS,
  WHIMSY,
  RADII,
  SPACE,
  TYPE,
  STICKER_SHADOW,
  SHADOW_SM,
  MODAL_BACKDROP_BG,
} from "@/constants/theme";

// ── Art slots ────────────────────────────────────────────────────────────────
// The reward the game uncovers is the SAME golden-truffle icon the Truffle
// Exchange mints and prices (HAT_IMAGES.golden_truffle) — so the dig's payoff
// visually equals the currency it becomes (was mud_pie, which read as a cake).
// Mud tints are a sanctioned palette exception: WHIMSY has no earth tones, and
// the patch IS mud (matches the mocks' approved exception in the taste pass).
const PATCH_ART = {
  truffle: HAT_IMAGES.golden_truffle,
  hunger: require("../../assets/images/hunger/great_hungerer_chip.png"), // the gorging Hungerer (real art)
  mote: require("../../assets/images/tickle-particles/bubble.png"), // shimmer glow base
  stone: require("../../assets/images/patch/stone.png"), // the dud find (real sprite)
  // Junk finds reuse the relic sprites — same objects in the fiction, and the
  // drawn-View placeholders read as UI glitches the moment they surfaced.
  junk_boot: require("../../assets/images/uniques/old_boot.png"),
  junk_wrap: require("../../assets/images/uniques/licked_wrapper.png"),
  mud: ["#c2a077", "#a5825f", "#8a6b4f"] as const, // layer 1 → 3 (shallow → deep)
  silhouette: "rgba(42,31,21,0.55)",
} as const;

const TOTAL = PATCH_ROWS * PATCH_COLS;

// Crack marks for a partially-dug clod — thin rotated ink strokes (same ink
// rgba as the silhouette) so progress reads without touching the mud tints.
// Derived deterministically from the tile index so a clod's cracks stay put
// across re-renders instead of jittering. 2 cracks appear once the clod is
// scratched, a 3rd once it's dug more than halfway down.
interface CrackSpec {
  left: DimensionValue;
  top: DimensionValue;
  w: number;
  rot: string;
}
const CRACK_SPECS: CrackSpec[][] = Array.from({ length: TOTAL }, (_, i) => {
  // cheap per-tile hash → stable pseudo-random placement/rotation
  const h = (i * 2654435761) >>> 0;
  const pick = (shift: number, mod: number) => (h >> shift) % mod;
  const pct = (n: number): DimensionValue => `${n}%`;
  return [
    {
      left: pct(22 + pick(0, 20)),
      top: pct(26 + pick(3, 18)),
      w: 9 + pick(6, 5),
      rot: `${-34 + pick(9, 30)}deg`,
    },
    {
      left: pct(44 + pick(11, 22)),
      top: pct(52 + pick(14, 20)),
      w: 8 + pick(17, 5),
      rot: `${18 + pick(20, 40)}deg`,
    },
    {
      left: pct(30 + pick(22, 24)),
      top: pct(40 + pick(25, 22)),
      w: 7 + pick(3, 5),
      rot: `${58 + pick(1, 34)}deg`,
    },
  ];
});

// Single source of truth for the board's border — the layout math (inner
// content width, hit-test inset, overlay offsets) and styles.board.borderWidth
// read the SAME const so they can never drift and re-introduce the wrap bug.
const BOARD_BORDER = 2;

// A claimed cluster becomes one prize sprite, but never a board-covering one.
// Both buried shapes span two tiles; 1.6 tiles keeps the payoff prominent while
// leaving neighboring finds and the named reveal chip legible.
const TRUFFLE_REVEAL_TILES = 1.6;

// The explainer's two-phase-teardown beat — the native Modal drops `visible`
// then stays mounted this long so its fade-out finishes before unmount (same
// contract as PopupQueue's POPUP_TEARDOWN_MS).
const HELP_TEARDOWN_MS = 260;

// Warm, named list for the echo callouts ("Jen", "Jen and Marco", "Jen, Marco
// and 2 more") — the Connect payoff is felt through actual crewmate names.
function joinNames(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean[0]}, ${clean[1]} and ${clean.length - 2} more`;
}

// The whisper line shown when a find is actually pouched (the warm-fiction beat).
const FIND_LINES: Record<Find, string> = {
  truffle_l: "a fat truffle — into the pouch.",
  truffle_d: "another truffle. he'll miss that one.",
  shimmer: "a pocket of tickle-motes drifts free.",
  stone: "just a stone.",
  junk_boot: "his old boot. why.",
  junk_wrap: "a licked-clean wrapper. keep it?",
  unique: "something odd — into the pouch.",
};

// The named chip that pops in AT the tile the instant a find is uncovered — so
// the reward is legible on the reveal itself, not only in the easy-to-miss
// whisper line below the board.
// The named reveal chip. "unique" is a generic fallback — the actual relic NAME
// (e.g. "The Milk Tooth!") is supplied at the chip from the board's uniqueDef.
const REVEAL_LABELS: Record<Find, string> = {
  truffle_l: "Golden Truffle!",
  truffle_d: "Golden Truffle!",
  shimmer: "tickle-motes!",
  stone: "just a stone",
  junk_boot: "his old boot — junk",
  junk_wrap: "a licked wrapper — junk",
  unique: "a relic!",
};

const FREE_RUB_LINE = "your snout knows the way — a free rub.";

// "The One That Got Away" copy. The session-opening whisper (a carry exists),
// and the two end-card lines (the carried find caught, or a new miss re-buried).
// Each is kind-aware: a carried relic reads "relic", a carried truffle "truffle"
// (the slot only ever holds truffle_l/truffle_d/unique), and self-explanatory —
// "gilded" is retired here so it never blurs with the crew echo bonus.
function carryNoun(kind: string): string {
  return kind === "unique" ? "relic" : "truffle";
}
function carryOpenLine(kind: string): string {
  return `he reburied the ${carryNoun(kind)} you almost had — look for the gleam.`;
}
function carryCaughtLine(kind: string, gild: number): string {
  return `you finished the ${carryNoun(kind)} you almost found last feeding. it weakened the Hungerer ${gild} extra ${gild === 1 ? "time" : "times"}.`;
}
function carryNextLine(kind: string, gild: number): string {
  return `you almost found another ${carryNoun(kind)}. it returns next feeding — finish it to weaken the Hungerer ${gild} extra ${gild === 1 ? "time" : "times"}.`;
}

// A truffle is buried as a multi-tile cluster (Pokémon-fossil style) — this
// whisper sets the expectation that a peeked cell is PART of a bigger find, so
// clearing the whole cluster (not a single cell) is what claims it.
const PARTIAL_TRUFFLE_LINE = "part of a big one — clear the rest of it!";

// The honest bank-failure line. The server refuses a submit for knowable
// reasons — say the real one instead of a generic shrug. Anything transport-
// shaped (network / no_data / unknown) keeps the armful-remembered promise,
// which is true: the open rooting row survives for a retry within the window.
function failLine(reason?: string): string {
  switch (reason) {
    case "already_rooted":
      return "you'd already dug this feeding — nothing new to bank. back next feeding.";
    case "no_open_rooting":
      return "the patch didn't recognize this dig — nothing banked. it opens fresh next feeding.";
    case "patch_closed":
      return "the feeding closed before you trotted home — nothing banked this time.";
    case "no_crew":
      return "the dig is Sounder-gated — join a Sounder and the patch will bank your digs.";
    default:
      return "couldn't bank that dig — the patch will remember your armful.";
  }
}

interface Props {
  session: RootingSession;
  // Resolves with the banked outcome, or null plus the server's refusal
  // reason (already_rooted, no_open_rooting, …) so the end card can say
  // WHY nothing banked instead of a generic shrug.
  onSubmit: (
    finds: ClaimableFind[],
    actions: number,
    missed: ClaimableFind[],
  ) => Promise<{ outcome: RootingOutcome | null; failReason?: string }>;
  onClose: () => void;
  onEndChange?: (ended: boolean) => void;
  // Whether the feeding window is currently OPEN — drives the real-dig
  // end-card's "oink me when it opens" notify chip (only offered when the
  // next dig is a wait, i.e. the window is guarded/closed). Practice digs
  // never show it. Defaults to true (a dev/practice open has no phase gate).
  phaseOpen?: boolean;
}

interface EndState {
  line: string;
  outcome: RootingOutcome | null;
  // Server refusal reason when outcome is null — drives the honest
  // failure line (an account switch mid-dig lands here as no_open_rooting).
  failReason?: string;
  finds: Find[];
  // The spoiler-light text-grid share payload (wedge 5b) — derived once at
  // finish from this dig's board + final layers, so the receipt's share button
  // is a pure render off already-known data.
  share: DigShareData;
}

export function TrufflePatch({
  session,
  onSubmit,
  onClose,
  onEndChange,
  phaseOpen = true,
}: Props) {
  const board = useMemo(
    () => generateBoard(session.seed, session.uniqueId),
    [session.seed, session.uniqueId],
  );
  // The relic this board carries (for reveal chip name + collect sound), or null.
  const uniqueDef = board.unique ? UNIQUE_BY_ID[board.unique.id] : null;
  // "The One That Got Away": the carried miss re-buried on this board (gilded).
  // Its silhouette shows a mud layer earlier per gild, plus a sun-toned gleam.
  // A truffle carry gilds its whole cluster; a unique carry gilds the relic cell
  // (only when THIS board's relic IS the carried one — open_rooting re-buries it).
  const carry = session.carry;
  const gildedTiles = useMemo(() => {
    const tiles = new Set<number>();
    if (!carry) return tiles;
    if (carry.kind === "truffle_l")
      for (const i of board.truffleL) tiles.add(i);
    else if (carry.kind === "truffle_d")
      for (const i of board.truffleD) tiles.add(i);
    else if (
      carry.kind === "unique" &&
      board.unique &&
      board.unique.id === carry.uniqueId
    )
      tiles.add(board.unique.idx);
    return tiles;
  }, [carry, board]);
  // The silhouette depth threshold for a gilded tile (plain is <= 1).
  const gildSilThreshold = gildedSilhouetteDepth(carry?.gild);
  // Cluster geometry for the one-big-sprite render — a multi-tile truffle reads
  // as ONE dug-up find, not N golden icons.
  const truffleLBox = useMemo(() => clusterBox(board.truffleL), [board]);
  const truffleDBox = useMemo(() => clusterBox(board.truffleD), [board]);
  // Co-op depth: a crewmate already dug this feeding → he's more distracted,
  // so you can stir more before he notices (matches the server's 25-action cap).
  const stirBudget = session.coop ? STIR_BUDGET * 1.25 : STIR_BUDGET;

  // Float layers so rub-splash can take half-layers off neighbors.
  const [layers, setLayers] = useState<number[]>(() => [...board.layers]);
  const [stir, setStir] = useState(0);
  const [collected, setCollected] = useState<Find[]>([]);
  const [whisper, setWhisper] = useState<string | null>(null);
  const [freeReady, setFreeReady] = useState(false);
  const [revealBeat, setRevealBeat] = useState<{
    id: number;
    kind: Find;
    idx: number;
  } | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The "how the dig works" explainer. Two-phase teardown: `helpOpen` is the
  // native Modal's visible flag, `helpMounted` is the mount gate — on close we
  // drop visible first, then unmount a teardown beat later so the native
  // dismissal animation runs before the tree unmounts (the wedge-class contract).
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMounted, setHelpMounted] = useState(false);
  // Once the dig ends the board + his-attention meter are corpses — the receipt
  // below is the whole story now. We fold them so the payoff rides above the
  // fold; `patchOpen` is the "peek at the patch" toggle for the board only (the
  // meter's story is finished, so it never comes back). Default collapsed.
  const [patchOpen, setPatchOpen] = useState(false);

  useEffect(() => {
    onEndChange?.(!!end);
    return () => onEndChange?.(false);
  }, [end, onEndChange]);

  const layersRef = useRef(layers);
  // The TEMPORAL dig ledger (spec 10): tile indices in the order they actually
  // cleared, appended live as each action lands. digShareData reads it to place
  // "found the golden in N digs" at the player's real Nth dig — board order
  // would let a lucky layout lie about how long the golden took. Tiles cleared
  // by one action's splash are appended in ascending index order (a stable,
  // deterministic tiebreak inside a single simultaneous action).
  const dugOrderRef = useRef<number[]>([]);
  const stirRef = useRef(0);
  const collectedRef = useRef<Set<Find>>(new Set());
  const justCollectedRef = useRef<Find | null>(null);
  const streakRef = useRef(0); // consecutive useful reveals
  const freeNextRef = useRef(false); // is the next action a free rub?
  const revealBeatId = useRef(0);
  const endedRef = useRef(false);
  const boardW = useRef(0);
  // Float tile size in a ref so the once-created PanResponder reads the LIVE
  // value (it closes over the first render) instead of a stale `tile` state.
  const tileSize = useRef(0);
  const [tile, setTile] = useState(0);

  // Per-tile pop-in on reveal (native-driven scale/fade of the uncovered find).
  const revealAnims = useRef(
    Array.from({ length: TOTAL }, () => new Animated.Value(0)),
  ).current;
  const stirAnim = useRef(new Animated.Value(0)).current;
  const popAnim = useRef(new Animated.Value(0)).current;
  // One persistent pop-in per truffle cluster — the dug-up truffle that sits on
  // the board for the rest of the session (scale 0.5→1 + fade), replacing the
  // per-cell chunks once the whole cluster is excavated.
  const bigTruffleAnim = useRef({
    truffle_l: new Animated.Value(0),
    truffle_d: new Animated.Value(0),
  }).current;
  const revealBeatAnim = useRef(new Animated.Value(0)).current;
  // Shove telegraph — the tile under a press-and-hold "charges" (scale-down +
  // darken) so the loud scoop feels wound-up before it lands, and springs back
  // on release or when the hold degrades into a scrub. Charge only STARTS ~120ms
  // in (a tap or quick scrub never charges), and this NEVER stirs or reveals.
  const pressAnim = useRef(new Animated.Value(0)).current;
  const [pressedTile, setPressedTile] = useState(-1);
  const pressedTileRef = useRef(-1);
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wind the charge up on the currently-pressed tile; releaseCharge springs it
  // back and clears the pending timer. Both live in refs so the once-created
  // PanResponder can call them without going stale.
  const startCharge = useCallback(
    (idx: number) => {
      if (chargeTimer.current) clearTimeout(chargeTimer.current);
      pressedTileRef.current = idx;
      setPressedTile(idx);
      pressAnim.setValue(0);
      // ~120ms in, only if the finger is still holding this same tile.
      chargeTimer.current = setTimeout(() => {
        if (pressedTileRef.current !== idx) return;
        Animated.timing(pressAnim, {
          toValue: 1,
          duration: SHOVE_HOLD_MS - 120,
          useNativeDriver: false, // drives backgroundColor too
        }).start();
      }, 120);
    },
    [pressAnim],
  );
  const releaseCharge = useCallback(() => {
    if (chargeTimer.current) {
      clearTimeout(chargeTimer.current);
      chargeTimer.current = null;
    }
    pressedTileRef.current = -1;
    Animated.spring(pressAnim, {
      toValue: 0,
      useNativeDriver: false,
      speed: 26,
      bounciness: 8,
    }).start(() => {
      if (pressedTileRef.current === -1) setPressedTile(-1);
    });
  }, [pressAnim]);
  useEffect(
    () => () => {
      if (chargeTimer.current) clearTimeout(chargeTimer.current);
    },
    [],
  );
  // The reclaim slam — golden joy-motes rip from the gorging Hunger (top-right)
  // to your pouch (bottom) on every find, and he flinches as the joy tears free.
  const slamRef = useRef<ReclaimSlamHandle>(null);
  const fleckRef = useRef<DirtFlecksHandle>(null);
  const hungerFlinch = useRef(new Animated.Value(0)).current;
  const reclaimBurst = useCallback(
    (intensity: "wisp" | "pop" | "burst") => {
      // caller already fires the find's own haptic on this same beat, so the
      // slam skips its haptic to avoid stacking two buzzes.
      slamRef.current?.slam({ intensity, haptic: false });
      hungerFlinch.setValue(0);
      Animated.sequence([
        Animated.spring(hungerFlinch, {
          toValue: 1,
          useNativeDriver: true,
          speed: 40,
          bounciness: 16,
        }),
        Animated.timing(hungerFlinch, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [hungerFlinch],
  );

  // Pop-in the named reveal chip at the uncovered tile.
  useEffect(() => {
    if (!revealBeat) return;
    revealBeatAnim.setValue(0);
    Animated.sequence([
      Animated.spring(revealBeatAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 12,
      }),
      Animated.delay(1300),
      Animated.timing(revealBeatAnim, {
        toValue: 2,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [revealBeat, revealBeatAnim]);

  // Warm the SFX players + start the cozy bog ambience bed on mount; fade it
  // out when the session leaves the screen.
  useEffect(() => {
    preload();
    startAmbience();
    return () => stopAmbience();
  }, []);

  // "The One That Got Away": if the caller carries a miss, open the session with
  // the warm whisper that he re-buried the one they almost had. The first dig
  // action overwrites it with the live warm/cold hint.
  useEffect(() => {
    if (session.carry) setWhisper(carryOpenLine(session.carry.kind));
  }, [session.carry]);

  const claimables = useCallback(
    (): ClaimableFind[] => claimableFinds(board, collectedRef.current),
    [board],
  );

  const finish = useCallback(
    async (line: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      stopAmbience(600); // the session is over — the end card is quiet.
      // p_actions is the STIR SPENT (free rubs add 0), which is bounded by the
      // budget (≤20 solo / ≤25 coop) — so it can never trip the server's
      // action cap even after a run of free rubs.
      // p_missed: carry-eligible finds partially revealed (a cell cleared) but
      // never collected — the ones that got away, re-buried gilded next feeding.
      const missed = partiallyRevealedFinds(
        board,
        layersRef.current,
        collectedRef.current,
      );
      const res = await onSubmit(claimables(), stirRef.current, missed);
      const outcome = res.outcome;
      setSubmitting(false);
      // The share grid reflects the FINAL board state (dug tiles + what they
      // found) — computed here where board + layers + collected are all known.
      // dugOrderRef carries the TEMPORAL dig sequence for the "golden in N
      // digs" headline (spec 10) — N is the player's real Nth dig.
      const share = digShareData(
        board,
        layersRef.current,
        collectedRef.current,
        session.windowIndex,
        dugOrderRef.current,
      );
      setEnd({
        line,
        outcome,
        failReason: res.failReason,
        finds: [...collectedRef.current],
        share,
      });
      // Field Guide (fail-soft, idempotent): finishing a dig meets Feeding
      // Windows; pulling a truffle mints golden, so it meets both the Truffle
      // and Golden Truffle pages.
      observeFieldGuide("feeding_windows");
      if (
        collectedRef.current.has("truffle_l") ||
        collectedRef.current.has("truffle_d")
      ) {
        observeFieldGuide("truffle");
        observeFieldGuide("golden_truffle");
      }
    },
    [onSubmit, claimables, board, session.windowIndex],
  );

  // Collect a fully-uncovered find; pops the named reveal chip at `tileIdx`.
  const collect = useCallback(
    (kind: Find, tileIdx: number) => {
      if (collectedRef.current.has(kind)) return;
      collectedRef.current.add(kind);
      setCollected([...collectedRef.current]);
      justCollectedRef.current = kind;
      revealBeatId.current += 1;
      setRevealBeat({ id: revealBeatId.current, kind, idx: tileIdx });
      if (kind === "truffle_l" || kind === "truffle_d") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        play("truffle_pop"); // the payoff pop, on the success beat
        popAnim.setValue(0);
        Animated.spring(popAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 14,
        }).start();
        // The one big dug-up truffle pops in over the whole cluster.
        Animated.spring(bigTruffleAnim[kind], {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 12,
        }).start();
        reclaimBurst("pop");
      } else if (kind === "unique") {
        // A relic — success haptic + the shimmer chime; it tears joy loose too.
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        play("shimmer");
        reclaimBurst("pop");
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        // a shimmer frees a wisp of tickle-motes; junk/stone tear nothing loose.
        if (kind === "shimmer") {
          play("shimmer");
          reclaimBurst("wisp");
        } else if (kind === "junk_boot" || kind === "junk_wrap") {
          play("pouch_clink"); // junk still clinks into the pouch
        }
        // stone: no cue — just a stone.
      }
    },
    [popAnim, reclaimBurst, bigTruffleAnim],
  );

  const afterReveal = useCallback(
    (next: number[]) => {
      // Cluster completion + single-cell finds. clusterRevealed (utils/rooting)
      // owns the "every cell of this cluster is cleared" test.
      const revealed = (idx: number) => next[idx] <= 0;
      if (clusterRevealed(board.truffleL, next))
        collect("truffle_l", board.truffleL[0]);
      if (clusterRevealed(board.truffleD, next))
        collect("truffle_d", board.truffleD[0]);
      for (let i = 0; i < next.length; i++) {
        const cell = board.cells[i];
        if (!cell || cell.kind === "truffle_l" || cell.kind === "truffle_d")
          continue;
        if (revealed(i)) collect(cell.kind, i);
      }
      const bothTruffles =
        collectedRef.current.has("truffle_l") &&
        collectedRef.current.has("truffle_d");
      if (bothTruffles) {
        finish("clean and quiet — the Hungerer never noticed.");
      } else if (stirRef.current >= stirBudget) {
        finish("the Hungerer stirred, so you stopped digging.");
      }
    },
    [board, collect, finish, stirBudget],
  );

  const applyAction = useCallback(
    (kind: "rub" | "shove", idx: number) => {
      if (endedRef.current) return;
      if (stirRef.current >= stirBudget) return; // ends BETWEEN actions
      if (idx < 0 || idx >= TOTAL) return;
      const wasFree = freeNextRef.current;
      // free re-rub on already-clear tile: no stir. (A gifted rub is allowed to
      // land anywhere the player points, so it doesn't short-circuit here.)
      if (layersRef.current[idx] <= 0 && kind === "rub" && !wasFree) return;

      const before = layersRef.current;
      const next = [...before];
      // Dig math lives in the shared applySplash kernel (utils/rooting) — the
      // SAME physics simulateGreedyClear pins. We diff before/after below to pop
      // newly-cleared tiles, so we splash a fresh copy. r/c feed the fleck burst.
      applySplash(next, idx, kind);
      const r = Math.floor(idx / PATCH_COLS);
      const c = idx % PATCH_COLS;
      if (kind === "rub") {
        Haptics.selectionAsync().catch(() => {});
        play("scrape"); // quiet scratch through the mud
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        play("creak"); // the loud snout-shove
      }

      // Stir cost — a gifted rub is free (0 stir); the budget is the only clock.
      const cost = wasFree ? 0 : kind === "rub" ? STIR_RUB : STIR_SHOVE;
      stirRef.current += cost;
      setStir(stirRef.current);
      Animated.timing(stirAnim, {
        toValue: Math.min(1, stirRef.current / stirBudget),
        duration: 160,
        useNativeDriver: false,
      }).start();
      if (wasFree) {
        freeNextRef.current = false;
        setFreeReady(false);
      }

      // Pop-in newly uncovered tiles + kick up a few dirt flecks at the tile;
      // each newly-cleared tile is also appended to the temporal dig ledger.
      for (let i = 0; i < next.length; i++) {
        if (before[i] > 0 && next[i] <= 0) {
          dugOrderRef.current.push(i);
          Animated.spring(revealAnims[i], {
            toValue: 1,
            useNativeDriver: true,
            speed: 16,
            bounciness: 10,
          }).start();
        }
      }
      if (tile > 0) {
        // boardArea coords: the board's content box starts BOARD_BORDER in.
        fleckRef.current?.burst(
          BOARD_BORDER + c * tile + tile / 2,
          BOARD_BORDER + r * tile + tile / 2,
        );
      }

      layersRef.current = next;
      setLayers(next);

      // Quiet-streak bookkeeping (pure helper): a run of useful reveals gifts
      // the next rub for free.
      const useful = revealedSweetCell(board, before, next);
      const { streak, freeNext } = nextStreak(streakRef.current, useful);
      streakRef.current = streak;
      const earnedFree = freeNext && !wasFree;
      freeNextRef.current = freeNext;
      if (freeNext) setFreeReady(true);

      // Reveal + collect (afterReveal sets justCollectedRef + the reveal chip).
      justCollectedRef.current = null;
      afterReveal(next);

      // Did this action newly peek a truffle cell whose cluster is NOT yet
      // complete? (a cell that just cleared, is a truffle, but its whole
      // cluster isn't collected) — sets the "part of a big one" expectation.
      const peekedPartialTruffle = (["truffle_l", "truffle_d"] as const).some(
        (kind) => {
          if (collectedRef.current.has(kind)) return false; // cluster claimed
          const cluster =
            kind === "truffle_l" ? board.truffleL : board.truffleD;
          return cluster.some((i) => before[i] > 0 && next[i] <= 0);
        },
      );

      // Whisper priority: a newly-earned free rub > a find just pouched > the
      // "part of a big one" partial-cluster beat > the warm/cold proximity hint.
      if (earnedFree) {
        setWhisper(FREE_RUB_LINE);
      } else if (justCollectedRef.current) {
        setWhisper(FIND_LINES[justCollectedRef.current]);
      } else if (peekedPartialTruffle) {
        setWhisper(PARTIAL_TRUFFLE_LINE);
      } else {
        setWhisper(warmthWhisper(nearestFindDistance(board, next, idx)));
      }
    },
    [afterReveal, board, revealAnims, stirAnim, stirBudget, tile],
  );

  // ── One PanResponder over the whole grid ────────────────────────────────
  const gesture = useRef({
    startT: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastSign: 0,
    reversals: 0,
    movedFar: false,
    rubs: 0,
  });
  // Reads the LIVE float tile size from the ref (the PanResponder closes over
  // the first render) and the shared pure helper, so render + hit-test math
  // can never drift.
  const tileAt = useCallback(
    (x: number, y: number): number =>
      tileIndexAt(x, y, tileSize.current, BOARD_BORDER),
    [],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const g = gesture.current;
        g.startT = Date.now();
        g.startX = evt.nativeEvent.locationX;
        g.startY = evt.nativeEvent.locationY;
        g.lastX = g.startX;
        g.lastSign = 0;
        g.reversals = 0;
        g.movedFar = false;
        g.rubs = 0;
        // Begin charging the tile under the finger (the shove telegraph).
        startCharge(tileAt(g.startX, g.startY));
      },
      onPanResponderMove: (evt) => {
        const g = gesture.current;
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;
        const dx = x - g.lastX;
        const dist = Math.hypot(x - g.startX, y - g.startY);
        // 14px thumb-jitter tolerance before a hold degrades into a scrub.
        if (dist > 14 && !g.movedFar) {
          g.movedFar = true;
          // The hold became a scrub — cancel the wound-up shove telegraph.
          releaseCharge();
        }
        if (Math.abs(dx) > 3) {
          const sign = dx > 0 ? 1 : -1;
          if (g.lastSign !== 0 && sign !== g.lastSign) {
            g.reversals += 1;
            // Every 2 direction reversals = one rub, live, on the tile
            // under the finger — scrubbing feels immediate.
            if (g.reversals % 2 === 0) {
              g.rubs += 1;
              applyAction("rub", tileAt(x, y));
            }
          }
          g.lastSign = sign;
        }
        g.lastX = x;
      },
      onPanResponderRelease: (evt) => {
        const g = gesture.current;
        const dt = Date.now() - g.startT;
        const idx = tileAt(
          evt.nativeEvent.locationX,
          evt.nativeEvent.locationY,
        );
        releaseCharge(); // the wound-up tile springs back as the scoop lands
        if (!g.movedFar && dt >= SHOVE_HOLD_MS) {
          applyAction("shove", idx); // the big scoop lands where you release
        } else if (g.rubs === 0 && !g.movedFar && dt < 250) {
          applyAction("rub", idx); // a plain tap is one rub
        }
      },
      onPanResponderTerminate: () => {
        // Gesture stolen (scroll/modal) — spring the telegraph back; stir only
        // moves on completed actions.
        releaseCharge();
      },
    }),
  ).current;

  // ── Render ───────────────────────────────────────────────────────────────
  const stirW = stirAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  // Calm → stirring → he's-lifting-his-snout: the fill greens when he's quiet
  // and reddens as he wakes, so the tension is legible without a number.
  const stirColor = stirAnim.interpolate({
    inputRange: [0, 0.5, 0.85, 1],
    outputRange: [WHIMSY.sage, WHIMSY.sun, WHIMSY.roseDeep, WHIMSY.roseDeep],
  });
  const stirFrac = stir / stirBudget;
  const stage =
    stirFrac < 0.5
      ? "calm"
      : stirFrac < 0.85
        ? "stirring"
        : "he's lifting his snout";
  const hungerWobble =
    stirFrac >= 0.85 ? "-3.5deg" : stirFrac >= 0.5 ? "-2deg" : "0deg";
  // Named co-op presence — the crewmates who already dug this feeding, so the
  // Name the concrete co-op benefit instead of the vague "dig deeper" promise.
  const coopNames = joinNames(session.crewDug.map((c) => c.display_name));
  const truffleCount = collected.filter(
    (f) => f === "truffle_l" || f === "truffle_d",
  ).length;
  const endReward = end?.outcome?.truffles ?? 0;

  // Explainer open/close — mount then show; on close drop visible and unmount a
  // teardown beat later (matches the app's two-phase dialog teardown so the
  // native Modal never unmounts mid-dismissal).
  const openHelp = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setHelpMounted(true);
    setHelpOpen(true);
  }, []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    setTimeout(() => setHelpMounted(false), HELP_TEARDOWN_MS);
  }, []);

  useEffect(() => {
    if (whisper) AccessibilityInfo.announceForAccessibility(whisper);
  }, [whisper]);

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>
            {end
              ? end.outcome?.practice
                ? "PRACTICE COMPLETE"
                : end.outcome
                  ? "DIG COMPLETE"
                  : "DIG ENDED"
              : "THE TRUFFLE PATCH"}
          </Text>
          <Text
            style={styles.title}
            accessibilityRole={end ? "header" : undefined}
          >
            {end
              ? end.outcome?.practice
                ? endReward > 0
                  ? `a real dig would earn ${endReward} Golden ${
                      endReward === 1 ? "Truffle" : "Truffles"
                    }.`
                  : "practice complete."
                : end.outcome
                  ? endReward > 0
                    ? `${endReward} Golden ${
                        endReward === 1 ? "Truffle" : "Truffles"
                      } in your pouch.`
                    : "your dig is complete."
                  : "nothing made it to your pouch."
              : "the Hungerer's gorging — dig quick, dig quiet."}
          </Text>
        </View>
        {!end && (
          <Pressable
            onPress={openHelp}
            hitSlop={10}
            style={styles.helpBtn}
            accessibilityRole="button"
            accessibilityLabel="How the dig works"
          >
            <Icon name="scroll" size={20} color={WHIMSY.ink} />
          </Pressable>
        )}
      </View>
      {session.practice && !end && (
        <View style={styles.practice}>
          <Text style={styles.practiceText}>
            practice dig — nothing banks, all the fun
          </Text>
        </View>
      )}

      {/* The Hunger vignette + stir meter — the live tension of the dig. It
			    goes dead the instant the session ends, so it drops entirely once
			    the end card is up (unlike the board, it never comes back). */}
      {!end && (
        <View style={styles.vigRow}>
          <View style={styles.stirCol}>
            <View style={styles.stirLabelRow}>
              <Text style={styles.stirLabel}>his attention</Text>
              <Text style={styles.stirStage}>{stage}</Text>
            </View>
            {coopNames ? (
              <Text style={styles.depthChip}>
                {coopNames} dug this feeding — up to 5 more rubs
              </Text>
            ) : session.coop ? (
              <Text style={styles.depthChip}>
                a crewmate dug this feeding — up to 5 more rubs
              </Text>
            ) : null}
            {session.blessed && (
              <Text style={styles.depthChip}>blessed — luckier digs</Text>
            )}
            <View style={styles.stirTrack}>
              <Animated.View
                style={[
                  styles.stirFill,
                  { width: stirW, backgroundColor: stirColor },
                ]}
              />
              {/* stage ticks at the calm→stirring and stirring→waking lines */}
              <View style={[styles.stirTick, { left: "50%" }]} />
              <View style={[styles.stirTick, { left: "85%" }]} />
            </View>
            {freeReady && (
              <View style={styles.freeChip}>
                <Glyph name="sparkle" size={13} />
                <Text style={styles.freeChipText}>free rub ready</Text>
              </View>
            )}
          </View>
          <Animated.Image
            source={PATCH_ART.hunger}
            style={[
              styles.hunger,
              {
                transform: [
                  { rotate: hungerWobble },
                  {
                    scale: hungerFlinch.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.86],
                    }),
                  },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>
      )}

      {/* The board (+ non-clipped overlay for reveal chips / dirt flecks).
			    Always shown mid-dig; once the dig ends it only shows when the
			    player peeks (patchOpen). Collapsing it after `end` is safe — end
			    mounts only after the final action's reveal has resolved. */}
      {(!end || patchOpen) && (
        <View style={styles.boardArea}>
          <View
            style={styles.board}
            onLayout={(e) => {
              // layout.width is the BORDER box — strip both borders to get the
              // inner content width, then split it evenly. Float (NOT floored):
              // flooring six tiles overran the content box and wrapped the 6th
              // into a dead 7th column; flex rows below make wrapping impossible,
              // and RN renders fractional sizes cleanly.
              boardW.current = e.nativeEvent.layout.width;
              const inner = e.nativeEvent.layout.width - BOARD_BORDER * 2;
              const t = inner / PATCH_COLS;
              tileSize.current = t;
              setTile(t);
            }}
            {...pan.panHandlers}
          >
            {tile > 0 &&
              Array.from({ length: PATCH_ROWS }, (_, r) => (
                // Explicit rows of flex tiles: a fixed PATCH_ROWS × PATCH_COLS
                // grid that CANNOT wrap regardless of rounding (the old flat
                // flexWrap layout dropped the 6th tile to a new row).
                <View key={r} style={styles.boardRow}>
                  {Array.from({ length: PATCH_COLS }, (_, c) => {
                    const i = r * PATCH_COLS + c;
                    const depth = layers[i];
                    const cell = board.cells[i];
                    const revealed = depth <= 0;
                    // A gilded tile (the one that got away) silhouettes a mud layer
                    // earlier per gild stack, and wears a sun-toned gleam.
                    const gilded = gildedTiles.has(i);
                    const silThreshold = gilded ? gildSilThreshold : 1;
                    const silhouette =
                      !revealed && depth <= silThreshold && !!cell;
                    // Crack texture: a buried clod dug BELOW its original depth
                    // (board.layers = the started depth) but not yet cleared shows
                    // 2–3 ink cracks so progress reads without shifting the tint.
                    const startedDepth = board.layers[i];
                    const partiallyDug = !revealed && depth < startedDepth;
                    const crackCount = partiallyDug
                      ? depth <= startedDepth / 2
                        ? 3
                        : 2
                      : 0;
                    // Shove telegraph: this buried clod is the one under a
                    // press-and-hold, so it charges (scale-down + darken).
                    const charging = pressedTile === i && !revealed;
                    // Once a truffle cluster is fully claimed, its per-cell
                    // chunks give way to the ONE big dug-up sprite (below).
                    const clusterClaimed =
                      !!cell &&
                      (cell.kind === "truffle_l" ||
                        cell.kind === "truffle_d") &&
                      collected.includes(cell.kind);
                    const tint =
                      PATCH_ART.mud[
                        Math.min(2, Math.max(0, Math.ceil(depth) - 1))
                      ];
                    const scale = revealAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.55, 1],
                    });
                    const squareName = `Patch square, row ${r + 1}, column ${c + 1}`;
                    const squareLabel = !revealed
                      ? squareName
                      : cell
                        ? `${squareName}. ${REVEAL_LABELS[cell.kind]}`
                        : `${squareName}. Cleared mud`;
                    const canDigSquare = !end && !revealed;
                    return (
                      // pointerEvents="none": touches must land on the BOARD view,
                      // not the tile — on the new architecture locationX/Y is
                      // relative to the touched child, so a tile-target touch made
                      // tileAt() read every tap as (0,0) (the top-left-cell bug).
                      // Accessibility activation is independent of pointer events:
                      // VoiceOver focuses a square, double-taps to rub, or chooses
                      // "Snout shove" from the actions rotor.
                      <View
                        key={i}
                        pointerEvents="none"
                        style={styles.tile}
                        accessible
                        accessibilityRole={canDigSquare ? "button" : "text"}
                        accessibilityLabel={squareLabel}
                        accessibilityHint={
                          canDigSquare
                            ? "Double tap to rub quietly. Use the actions rotor to snout shove."
                            : undefined
                        }
                        accessibilityValue={
                          canDigSquare
                            ? {
                                text: `${depth} ${depth === 1 ? "layer" : "layers"} of mud`,
                              }
                            : undefined
                        }
                        accessibilityState={
                          canDigSquare ? undefined : { disabled: !!end }
                        }
                        accessibilityActions={
                          canDigSquare
                            ? [
                                { name: "activate", label: "Rub quietly" },
                                { name: "shove", label: "Snout shove" },
                              ]
                            : undefined
                        }
                        onAccessibilityAction={
                          canDigSquare
                            ? (event) => {
                                if (event.nativeEvent.actionName === "shove") {
                                  applyAction("shove", i);
                                } else if (
                                  event.nativeEvent.actionName === "activate"
                                ) {
                                  applyAction("rub", i);
                                }
                              }
                            : undefined
                        }
                      >
                        <Animated.View
                          style={[
                            styles.clod,
                            !revealed && { backgroundColor: tint },
                            revealed && styles.clodCleared,
                            charging && {
                              transform: [
                                {
                                  scale: pressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 0.94],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          {/* Cracks + charge-darken sit UNDER the find art, over the tint. */}
                          {crackCount > 0 &&
                            CRACK_SPECS[i]
                              .slice(0, crackCount)
                              .map((s, k) => (
                                <View
                                  key={k}
                                  style={[
                                    styles.crack,
                                    {
                                      left: s.left,
                                      top: s.top,
                                      width: s.w,
                                      transform: [{ rotate: s.rot }],
                                    },
                                  ]}
                                />
                              ))}
                          {charging && (
                            <Animated.View
                              pointerEvents="none"
                              style={[
                                styles.chargeDarken,
                                {
                                  opacity: pressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 0.28],
                                  }),
                                },
                              ]}
                            />
                          )}
                          {silhouette && (
                            // Uniform lump for EVERY buried find — you can't tell truffle
                            // from stone from relic until you commit. Mystery is the point.
                            // A gilded lump (the one that got away) wears a sun-toned gleam
                            // so its earlier-showing silhouette reads as the shinier prize.
                            <View
                              style={[
                                styles.silhouette,
                                gilded && styles.silhouetteGild,
                              ]}
                            >
                              {gilded && (
                                <View
                                  style={styles.gildGleam}
                                  pointerEvents="none"
                                />
                              )}
                            </View>
                          )}
                          {revealed && cell && !clusterClaimed && (
                            <Animated.View
                              style={[
                                styles.findWrap,
                                {
                                  transform: [{ scale }],
                                  opacity: revealAnims[i],
                                },
                              ]}
                            >
                              <RevealedCell
                                kind={cell.kind}
                                size={tile}
                                uniqueId={board.unique?.id ?? null}
                              />
                            </Animated.View>
                          )}
                        </Animated.View>
                      </View>
                    );
                  })}
                </View>
              ))}
          </View>

          {/* Flecks sit over the mud but under prizes and their nameplate. */}
          <DirtFlecks ref={fleckRef} />
          {/* One big dug-up truffle per claimed cluster — the sprite that says
				    "you unearthed ONE find", replacing the per-cell chunks. */}
          {tile > 0 && collected.includes("truffle_l") && truffleLBox && (
            <BigTruffle
              box={truffleLBox}
              tile={tile}
              anim={bigTruffleAnim.truffle_l}
            />
          )}
          {tile > 0 && collected.includes("truffle_d") && truffleDBox && (
            <BigTruffle
              box={truffleDBox}
              tile={tile}
              anim={bigTruffleAnim.truffle_d}
            />
          )}
          {/* Render the nameplate last so prize art never covers what was found. */}
          {revealBeat && tile > 0 && (
            <RevealChip
              beat={revealBeat}
              tile={tile}
              boardW={boardW.current}
              anim={revealBeatAnim}
              uniqueDef={uniqueDef}
            />
          )}
        </View>
      )}

      {/* Whisper + running tally — the LIVE state during the dig. Once the
			    end card shows it becomes the honest receipt, so these hide (they'd
			    only duplicate it a beat later). Zero-value chips never render —
			    "0 motes freed" is noise, not a tally. */}
      {!end && (
        <>
          {whisper && <Text style={styles.whisper}>{whisper}</Text>}
          {(truffleCount > 0 || collected.includes("shimmer")) && (
            <View style={styles.pouchRow}>
              {truffleCount > 0 && (
                <PouchChip
                  icon={
                    <Image
                      source={PATCH_ART.truffle}
                      style={styles.chipIconImg}
                      resizeMode="contain"
                    />
                  }
                  label="pouch"
                  count={truffleCount}
                />
              )}
              {collected.includes("shimmer") && (
                <PouchChip
                  icon={<Glyph name="sparkle" size={16} />}
                  label="motes freed"
                  count={1}
                />
              )}
            </View>
          )}
        </>
      )}

      {/* End card */}
      {end && (
        <>
          <EndCard
            end={end}
            submitting={submitting}
            onClose={onClose}
            phaseOpen={phaseOpen}
            blessed={end.outcome?.blessed ?? session.blessed}
          />
          {/* The finished board is optional context, so its disclosure
					    follows the receipt instead of interrupting the payoff. */}
          <Pressable
            onPress={() => setPatchOpen((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.patchToggle,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              patchOpen ? "Hide the finished patch" : "View the finished patch"
            }
            accessibilityState={{ expanded: patchOpen }}
          >
            <Text style={styles.patchToggleText}>
              {patchOpen ? "hide finished patch ‹" : "view finished patch ›"}
            </Text>
          </Pressable>
        </>
      )}

      {/* Reclaim slam overlay — golden joy-motes from the Hunger to your pouch. */}
      <ReclaimSlam ref={slamRef} />

      {/* "How the dig works" explainer — goal, actions, scoring, in-voice. */}
      {helpMounted && (
        <DigHelpModal
          visible={helpOpen}
          coop={session.coop}
          onClose={closeHelp}
        />
      )}
    </View>
  );
}

// ── The "how the dig works" explainer ────────────────────────────────────────
// A small scrollable card that spells out the goal + the scoring the reveal
// chips and meter only hint at. Sectioned, 1–2 lines each, storybook voice.
// Two-phase teardown lives with the caller (helpMounted / helpOpen split).
function DigHelpModal({
  visible,
  coop,
  onClose,
}: {
  visible: boolean;
  coop: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.helpBackdrop} onPress={onClose}>
        <Pressable style={styles.helpCardWrap} onPress={() => {}}>
          <View style={styles.helpCard}>
            <Text style={styles.helpKicker}>THE TRUFFLE PATCH</Text>
            <Text style={styles.helpTitle}>how the dig works</Text>
            <ScrollView
              style={styles.helpScroll}
              contentContainerStyle={styles.helpScrollBody}
              showsVerticalScrollIndicator={false}
            >
              <HelpSection heading="the goal">
                two truffles are buried in the mud. find both before the
                Hungerer fully stirs and lifts his snout.
              </HelpSection>
              <HelpSection heading="how to dig">
                rub (tap) clears a little mud and stirs him a little. shove
                (press and hold) clears more but wakes him faster. his attention
                is your only clock.
              </HelpSection>
              <HelpSection heading="what you find">
                every find calms his attention. the first truffle you dig mints
                a Golden Truffle; more truffles and tickle-motes still count.
                junk counts too, stones do nothing, and rare relics go to your
                Burrow Book.
              </HelpSection>
              {coop && (
                <HelpSection heading="digging together">
                  a crewmate already dug this feeding, so he's more distracted —
                  you can rub up to 5 more times before he wakes.
                </HelpSection>
              )}
              <HelpSection heading="leaving">
                leave anytime. the patch keeps your board until the feeding
                window closes — nothing is lost by walking away.
              </HelpSection>
            </ScrollView>
            <Pressable
              onPress={onClose}
              style={styles.helpBtnClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close dig instructions"
            >
              <Text style={styles.helpBtnCloseText}>got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HelpSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.helpSection}>
      <Text style={styles.helpSectionHead}>{heading}</Text>
      <Text style={styles.helpSectionBody}>{children}</Text>
    </View>
  );
}

// ── The itemized end card ────────────────────────────────────────────────────
// One honest line per thing that happened, each with its icon — the raw data
// points read as opaque without them. The first-truffle rule is spelled out
// inline whenever more truffles were dug than minted.
function EndCard({
  end,
  submitting,
  onClose,
  phaseOpen,
  blessed,
}: {
  end: EndState;
  submitting: boolean;
  onClose: () => void;
  phaseOpen: boolean;
  // Whether a blessing rode with this dig — drives the "+1 blessed truffle"
  // line. Server-authoritative when the migration is pushed (outcome.blessed),
  // falling back to the session's open-time blessing so the line still shows
  // against an un-pushed server.
  blessed: boolean;
}) {
  const outcome = end.outcome;
  const dug = end.finds.filter(
    (f) => f === "truffle_l" || f === "truffle_d",
  ).length;
  const practice = !!outcome?.practice;
  const echoBonus = !!outcome && dug > 0 && outcome.echo ? 1 : 0;
  const blessingBonus = !!outcome && blessed && dug > 0 ? 1 : 0;
  const patchReward = outcome
    ? Math.max(0, outcome.truffles - echoBonus - blessingBonus)
    : 0;
  // What a REAL dig of this armful would have minted (the economy mints the
  // first truffle of the dig). `outcome.truffles` already carries that count
  // in practice mode, so the "you'd have kept N" line stays truthful.
  const wouldKeep = outcome?.truffles ?? 0;
  useEffect(() => {
    const message = outcome
      ? practice
        ? "Practice complete. Nothing was banked."
        : `Dig complete. ${outcome.truffles} Golden ${
            outcome.truffles === 1 ? "Truffle" : "Truffles"
          } added to your pouch.`
      : `Dig ended. ${failLine(end.failReason)}`;
    AccessibilityInfo.announceForAccessibility(message);
  }, [end.failReason, outcome, practice]);

  return (
    <View style={styles.endCard} accessible={false}>
      <Text style={styles.endStory}>{end.line}</Text>
      {outcome ? (
        <View style={styles.endLines}>
          {/* PRACTICE: no real mint happened — instead show what a real dig
					    WOULD have banked, so the value of joining is concrete. */}
          {practice ? (
            <>
              <EndLine
                icon={
                  <Image
                    source={PATCH_ART.truffle}
                    style={styles.endIconImg}
                    resizeMode="contain"
                  />
                }
              >
                {dug === 2
                  ? "You uncovered both buried truffles."
                  : `You uncovered ${dug} of the 2 buried truffles.`}
              </EndLine>
              {outcome.snoutGift != null && outcome.snoutGift > 0 && (
                <EndLine
                  icon={
                    <Image
                      source={PATCH_ART.truffle}
                      style={styles.endIconImg}
                      resizeMode="contain"
                    />
                  }
                >
                  One Golden Truffle to start your pouch — a gift.
                </EndLine>
              )}
              <Text style={styles.endPractice}>
                {wouldKeep > 0
                  ? "Practice only — nothing was added to your pouch."
                  : "Practice only — nothing was earned this time."}
              </Text>
            </>
          ) : (
            <>
              {dug > 0 && (
                <EndLine
                  icon={
                    <Image
                      source={PATCH_ART.truffle}
                      style={styles.endIconImg}
                      resizeMode="contain"
                    />
                  }
                  // Keep the receipt's headline about the banked currency,
                  // then name the patch result in one plain subline. Echo and
                  // blessing bonuses remain itemized below when they apply.
                  sub={
                    dug === 1
                      ? "You uncovered 1 of the 2 buried truffles."
                      : "You uncovered both buried truffles."
                  }
                >
                  {patchReward > 0
                    ? `From the patch: +${patchReward} Golden ${
                        patchReward === 1 ? "Truffle" : "Truffles"
                      }`
                    : "Your truffle was uncovered."}
                </EndLine>
              )}
              {/* Crew echo. Only a truffle you MINTED earns the +1 (echo), so the
							    minted-bonus line gates on dug > 0. When you dug nothing but a
							    crewmate did, the line turns into an invitation instead of a
							    payoff. The names-empty branch covers a server +1 whose crewmate
							    submitted-but-minted-nothing (echo true, echo_names empty). */}
              {dug > 0 && outcome.echo ? (
                <EndLine icon={<Glyph name="heart" size={15} />} accent>
                  {outcome.echoNames && outcome.echoNames.length > 0
                    ? `Sounder bonus from ${joinNames(
                        outcome.echoNames,
                      )}: +1 Golden Truffle`
                    : "Sounder bonus: +1 Golden Truffle"}
                </EndLine>
              ) : dug === 0 &&
                outcome.echoNames &&
                outcome.echoNames.length > 0 ? (
                <EndLine icon={<Glyph name="heart" size={15} />} accent>
                  {joinNames(outcome.echoNames)} dug this feeding too — find a
                  truffle next feeding to earn +1 bonus Golden Truffle.
                </EndLine>
              ) : null}
              {/* Blessing +1 — invisible before this; now its own line so the
							    minted count above is fully accounted for. */}
              {blessed && dug > 0 && (
                <EndLine icon={<Glyph name="sparkle" size={15} />} accent>
                  Blessing bonus: +1 Golden Truffle
                </EndLine>
              )}
              <EndLine
                icon={
                  <Icon
                    name="star"
                    size={16}
                    color={WHIMSY.accent}
                    filled
                  />
                }
              >
                Season Pass: +20 XP
              </EndLine>
              <EndLine icon={<Glyph name="heart" size={15} />}>
                {outcome.credited === 0
                  ? "No finds made it home this time — the Hungerer and Dig-Off stay put."
                  : outcome.credited === 1
                    ? "Your find weakened the Hungerer and counted in the Dig-Off."
                    : `Your ${outcome.credited} finds weakened the Hungerer and counted in the Dig-Off.`}
              </EndLine>
              {outcome.credited > 0 && (
                <EndLine icon={<Glyph name="sparkle" size={15} />} accent>
                  {"You qualified for this stage's 15-Truffle reward and Monday's Dig-Off spoils."}
                </EndLine>
              )}
              {outcome.uniqueFound && (
                <UniqueEndLine found={outcome.uniqueFound} />
              )}
              {outcome.carryCaught && (
                <EndLine icon={<Glyph name="sparkle" size={15} />}>
                  {carryCaughtLine(
                    outcome.carryCaught.kind,
                    outcome.carryCaught.gild,
                  )}
                </EndLine>
              )}
              {outcome.carryNext && (
                <EndLine icon={<Glyph name="sparkle" size={15} />} accent>
                  {carryNextLine(
                    outcome.carryNext.kind,
                    outcome.carryNext.gild,
                  )}
                </EndLine>
              )}
              {outcome.milestone && (
                <EndLine icon={<Glyph name="star" size={15} />}>
                  A milestone fell — the whole barnyard weakens the Hungerer.
                </EndLine>
              )}
            </>
          )}
        </View>
      ) : (
        <Text style={styles.endLineText}>{failLine(end.failReason)}</Text>
      )}
      {/* The retention hinge: after a REAL dig, if the next window is a wait,
			    offer one local oink at the next open (highest-intent moment). */}
      {!practice && !phaseOpen && <NotifyChip />}
      <Pressable
        onPress={onClose}
        disabled={submitting}
        style={({ pressed }) => [
          styles.endPrimary,
          pressed && styles.endBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Back to the season"
        accessibilityState={{ disabled: submitting }}
      >
        <Text style={styles.endPrimaryText}>
          {submitting ? "Trotting home…" : "Back to the season ›"}
        </Text>
      </Pressable>
      {/* Sharing is optional, so it follows the primary completion action.
			    The lucky stat is readable content, not part of the share target. */}
      {outcome != null && !practice && (
        <GoldShareResult
          data={end.share}
          goldenInDigs={end.share.goldenInDigs}
          canPostcard={!outcome.practice}
        />
      )}
    </View>
  );
}

// ── The lucky result + optional share action (wedges 5b + 5c) ────────────────
// The result is content, not a giant share target. A sun strip keeps the lucky
// beat celebratory; a separate secondary control opens the native share sheet.
// Long-press copy remains available and is now named in the accessibility hint.
function GoldShareResult({
  data,
  goldenInDigs,
  canPostcard,
}: {
  data: DigShareData;
  goldenInDigs: number | null;
  canPostcard: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const onShare = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    bumpDigShareCount();
    Share.share({ message: buildDigShareText(data) }).catch(() => {});
  }, [data]);

  const onCopy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    bumpDigShareCount();
    Clipboard.setStringAsync(buildDigShareText(data)).catch(() => {});
    setCopied(true);
    AccessibilityInfo.announceForAccessibility("Dig result copied.");
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  }, [data]);

  const hasGolden = goldenInDigs != null;
  return (
    <View style={styles.shareResult}>
      <View style={styles.shareMetaRow}>
        {hasGolden && (
          <Text
            style={styles.goldResultStat}
            accessibilityLabel={`First Golden Truffle found on move ${goldenInDigs}`}
          >
            First truffle: move {goldenInDigs}
          </Text>
        )}
        <Pressable
          onPress={onShare}
          onLongPress={onCopy}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Share this dig result"
          accessibilityHint="Opens the share sheet. Long press to copy the result."
          style={({ pressed }) => [
            styles.shareButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Glyph name="sparkle" size={15} />
          <Text style={styles.shareButtonText} accessibilityLiveRegion="polite">
            {copied ? "Copied" : "Share"}
          </Text>
        </Pressable>
      </View>
      {canPostcard && <DigPostcardComposer data={data} />}
    </View>
  );
}

// ── "oink me when it opens" — the notify opt-in chip ─────────────────────────
// A small paper sticker-chip that schedules ONE local push at the next feeding
// window open. Confirmed state reads "we'll oink you ›"; a permission decline
// falls to a soft note (no nag, no error). Reuses the shared schedule helper so
// the season-tab onboarding card can offer the exact same opt-in.
function NotifyChip() {
  const [state, setState] = useState<"idle" | "busy" | OpenReminderResult>(
    "idle",
  );
  const onPress = useCallback(async () => {
    if (state === "busy" || state === "scheduled") return;
    Haptics.selectionAsync().catch(() => {});
    setState("busy");
    const r = await scheduleOpenReminder();
    setState(r);
  }, [state]);

  if (state === "scheduled") {
    return (
      <View style={styles.notifyDone}>
        <Glyph name="heart" size={13} />
        <Text style={styles.notifyDoneText}>
          we'll oink you when the patch opens ›
        </Text>
      </View>
    );
  }
  if (state === "denied") {
    return (
      <Text style={styles.notifyNote}>
        no oinks without notifications on — the patch opens in{" "}
        {nextOpenCountdown()}.
      </Text>
    );
  }
  if (state === "unavailable") {
    return (
      <Text style={styles.notifyNote}>
        the patch opens in {nextOpenCountdown()}.
      </Text>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.notifyChip, pressed && { opacity: 0.7 }]}
      hitSlop={8}
      disabled={state === "busy"}
      accessibilityRole="button"
      accessibilityLabel={
        state === "busy"
          ? "Setting a patch reminder"
          : "Remind me when the patch opens"
      }
      accessibilityState={{
        disabled: state === "busy",
        busy: state === "busy",
      }}
    >
      <Glyph name="sparkle" size={13} />
      <Text style={styles.notifyChipText}>
        {state === "busy" ? "setting a reminder…" : "oink me when it opens"}
      </Text>
    </Pressable>
  );
}

// A single receipt row: a fixed-width icon column on the left, then the outcome
// line, with an optional quieter subline beneath it (e.g. the first-mint rule).
// Left-aligned so every row's icon and text stack in the same two columns —
// the eye scans one ledger, not a centered prose block.
function EndLine({
  icon,
  children,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  sub?: React.ReactNode;
  // A warm-accent line (the Connect/carry payoff beats) — the row's headline
  // text takes the accent hand voice instead of plain ink.
  accent?: boolean;
}) {
  return (
    <View style={styles.endLine}>
      <View style={styles.endIconCol}>{icon}</View>
      <View style={styles.endLineTextCol}>
        <Text style={[styles.endLineText, accent && styles.endLineAccent]}>
          {children}
        </Text>
        {sub != null && <Text style={styles.endSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// The relic line on the end card — a Pressable that routes into the Burrow Book,
// with the relic's art + name; new entries light the Book, dupes bump a count.
function UniqueEndLine({
  found,
}: {
  found: { id: string; new: boolean; found_count: number };
}) {
  const def = UNIQUE_BY_ID[found.id];
  const name = def?.name ?? "a relic";
  const sub = found.new
    ? "new entry in the Burrow Book"
    : `found again (×${found.found_count})`;
  // Its OWN tappable sticker row: the relic art sits in the same icon column as
  // the other receipt lines, the name reads as the headline, the Burrow-Book
  // note as the subline, and a chevron on the right says "tap to open" — no
  // underlined link wrapping across two centered lines with an orphaned icon.
  return (
    <Pressable
      onPress={() => router.push("/dig-collection")}
      style={({ pressed }) => [
        styles.discoveryRow,
        pressed && { opacity: 0.8 },
      ]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${sub}`}
      accessibilityHint="Opens the Burrow Book"
    >
      <View style={styles.endIconCol}>
        {UNIQUE_IMAGES[found.id] ? (
          <Image
            source={UNIQUE_IMAGES[found.id]}
            style={styles.endIconImg}
            resizeMode="contain"
          />
        ) : (
          <Glyph name="star" size={15} />
        )}
      </View>
      <View style={styles.endLineTextCol}>
        <Text style={[styles.endLineText, styles.discoveryName]}>{name}</Text>
        <Text style={styles.endSub}>{sub}</Text>
      </View>
      <Icon name="arrowRight" size={16} color={WHIMSY.accent} />
    </Pressable>
  );
}

// ── The named reveal chip (pops in at the tile) ──────────────────────────────
function RevealChip({
  beat,
  tile,
  boardW,
  anim,
  uniqueDef,
}: {
  beat: { id: number; kind: Find; idx: number };
  tile: number;
  boardW: number;
  anim: Animated.Value;
  uniqueDef: { id: string; name: string } | null;
}) {
  const r = Math.floor(beat.idx / PATCH_COLS);
  const c = beat.idx % PATCH_COLS;
  const opacity = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 0],
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [6, -14, -26],
  });
  const scale = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.6, 1, 1],
  });
  // A unique names itself with its relic image + the relic's actual name.
  const isUnique = beat.kind === "unique" && uniqueDef;
  const icon =
    beat.kind === "truffle_l" || beat.kind === "truffle_d" ? (
      <Image
        source={PATCH_ART.truffle}
        style={styles.revealIconImg}
        resizeMode="contain"
      />
    ) : beat.kind === "shimmer" ? (
      <Glyph name="sparkle" size={13} />
    ) : isUnique && UNIQUE_IMAGES[uniqueDef.id] ? (
      <Image
        source={UNIQUE_IMAGES[uniqueDef.id]}
        style={styles.revealIconImg}
        resizeMode="contain"
      />
    ) : beat.kind === "stone" ||
      beat.kind === "junk_boot" ||
      beat.kind === "junk_wrap" ? (
      // Every find's chip carries its art — a text-only chip left players
      // unsure what they'd just dug up.
      <Image
        source={PATCH_ART[beat.kind]}
        style={styles.revealIconImg}
        resizeMode="contain"
      />
    ) : null;
  const label = isUnique ? `${uniqueDef.name}!` : REVEAL_LABELS[beat.kind];
  // Clip fix: a chip on an edge tile (or a long relic name like "The Milk
  // Tooth!") used to spill past boardArea's overflow:hidden and get chopped.
  // The chip is center-anchored on its tile center, capped at ~60% of the
  // board width, and its center clamped so the whole capped chip stays inside
  // the board bounds — near-edge reveals slide inward instead of clipping.
  const maxW = Math.max(tile, boardW * 0.6);
  const half = maxW / 2;
  const tileCenterX = BOARD_BORDER + c * tile + tile / 2;
  const centerX = Math.min(
    Math.max(tileCenterX, BOARD_BORDER + half),
    boardW - BOARD_BORDER - half,
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.revealChipWrap,
        // boardArea coords: the board's content box starts BOARD_BORDER in.
        // width:0 + alignItems:center anchors the chip on `centerX`.
        { left: centerX, top: BOARD_BORDER + r * tile },
      ]}
    >
      <Animated.View
        style={[
          styles.revealChip,
          { maxWidth: maxW, opacity, transform: [{ translateY }, { scale }] },
        ]}
      >
        {icon}
        <Text
          style={styles.revealChipText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── The one big dug-up truffle (per completed cluster) ───────────────────────
// A multi-tile truffle is ONE find, so once its cluster is fully excavated we
// pop a single large truffle over the whole cluster — the dug-up prize sitting
// on the board — instead of N golden icons. Persistent for the rest of the
// session; positioned/sized from the pure clusterBox geometry.
function BigTruffle({
  box,
  tile,
  anim,
}: {
  box: ClusterBox;
  tile: number;
  anim: Animated.Value;
}) {
  // The old bounding-box rule grew the L-shaped prize to 2.24 tiles wide and
  // obscured nearby finds. Keep one consistent, capped prize scale instead.
  const side = tile * TRUFFLE_REVEAL_TILES;
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bigTruffleWrap,
        {
          // boardArea coords: the board's content box starts BOARD_BORDER in;
          // center the sprite on the cluster centroid.
          left: BOARD_BORDER + box.cx * tile - side / 2,
          top: BOARD_BORDER + box.cy * tile - side / 2,
          width: side,
          height: side,
          opacity: anim,
          transform: [{ scale }],
        },
      ]}
    >
      <Image
        source={PATCH_ART.truffle}
        style={styles.bigTruffleImg}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

// ── Find art (legible, sticker-styled — no dessert cakes, no flat discs) ─────
function RevealedCell({
  kind,
  size,
  uniqueId,
}: {
  kind: Find;
  size: number;
  uniqueId: string | null;
}) {
  if (kind === "unique" && uniqueId && UNIQUE_IMAGES[uniqueId]) {
    // The relic sits proud on the mud at the standard findImg treatment.
    return (
      <Image
        source={UNIQUE_IMAGES[uniqueId]}
        style={styles.findImg}
        resizeMode="contain"
      />
    );
  }
  if (kind === "truffle_l" || kind === "truffle_d") {
    // A truffle PIECE renders as an ink SILHOUETTE — the not-yours-yet
    // vocabulary the Burrow Book already uses for undiscovered relics. Any
    // golden piece (even small/dim) read as a second whole truffle and made
    // the "1 of 2 dug" count feel wrong; gold now only ever means CAUGHT
    // (the BigTruffle pop). A mound overlay was tried too — broken blob.
    return (
      <Image
        source={PATCH_ART.truffle}
        style={[
          styles.truffleChunk,
          { transform: [{ translateY: size * 0.06 }] },
        ]}
        resizeMode="contain"
        tintColor={WHIMSY.ink}
      />
    );
  }
  if (kind === "shimmer") return <ShimmerFind size={size} />;
  if (kind === "stone") {
    // Real sprite — a border-radius pebble read as a UI glitch
    // (a stray hover state) the moment it surfaced.
    return (
      <Image
        source={PATCH_ART.stone}
        style={styles.stoneImg}
        resizeMode="contain"
      />
    );
  }
  return <JunkFind kind={kind} />;
}

// A layered shimmer: a soft golden glow + a translucent tickle-mote bubble + a
// hand-drawn sparkle on top (not a flat yellow disc).
function ShimmerFind({ size }: { size: number }) {
  return (
    <View style={styles.shimmerWrap}>
      <View style={styles.shimmerGlow} />
      <Image
        source={PATCH_ART.mote}
        style={styles.shimmerBubble}
        resizeMode="contain"
      />
      <Glyph
        name="sparkle"
        size={Math.round(size * 0.42)}
        style={styles.shimmerSpark}
      />
      <Glyph
        name="sparkle"
        size={Math.round(size * 0.2)}
        style={styles.shimmerSparkSm}
      />
    </View>
  );
}

// Junk renders with its real sprite; the reveal chip names it on the beat.
function JunkFind({ kind }: { kind: Find }) {
  const art = kind === "junk_boot" ? PATCH_ART.junk_boot : PATCH_ART.junk_wrap;
  return <Image source={art} style={styles.findImg} resizeMode="contain" />;
}

function PouchChip({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.chip}>
      {icon}
      <Text style={styles.chipCount}>{count}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ── Dirt flecks ──────────────────────────────────────────────────────────────
// Tiny mud specks kicked up on each rub — same imperative-spawn / native-driven
// vocabulary as ReclaimSlam / the Barn HeartFloats, kept light (3 per burst,
// hard-capped render list) so fast scrubbing can't flood it.
interface DirtFlecksHandle {
  burst: (x: number, y: number) => void;
}
interface Fleck {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  anim: Animated.Value;
}
const DirtFlecks = forwardRef<DirtFlecksHandle, object>(
  function DirtFlecks(_props, ref) {
    const [flecks, setFlecks] = useState<Fleck[]>([]);
    const nextId = useRef(0);
    const burst = useCallback((x: number, y: number) => {
      const add: Fleck[] = [];
      for (let i = 0; i < 3; i++) {
        const id = nextId.current++;
        const anim = new Animated.Value(0);
        const ang = Math.random() * Math.PI * 2;
        const reach = 9 + Math.random() * 13;
        const f: Fleck = {
          id,
          x,
          y,
          dx: Math.cos(ang) * reach,
          dy: Math.sin(ang) * reach - 5,
          size: 3 + Math.random() * 3,
          anim,
        };
        add.push(f);
        Animated.timing(anim, {
          toValue: 1,
          duration: 340 + Math.random() * 160,
          useNativeDriver: true,
        }).start(() => setFlecks((m) => m.filter((z) => z.id !== id)));
      }
      // slice keeps the render list bounded even under a rapid scrub.
      setFlecks((cur) => [...cur, ...add].slice(-24));
    }, []);
    useImperativeHandle(ref, () => ({ burst }), [burst]);
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {flecks.map((f) => {
          const translateX = f.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [f.x, f.x + f.dx],
          });
          const translateY = f.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [f.y, f.y + f.dy + 14],
          });
          const opacity = f.anim.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [0.85, 0.65, 0],
          });
          return (
            <Animated.View
              key={f.id}
              style={[
                styles.fleck,
                {
                  width: f.size,
                  height: f.size,
                  borderRadius: f.size / 2,
                  marginLeft: -f.size / 2,
                  marginTop: -f.size / 2,
                  opacity,
                  transform: [{ translateX }, { translateY }],
                },
              ]}
            />
          );
        })}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: WHIMSY.paper,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.xl,
    padding: SPACE.lg,
    ...STICKER_SHADOW,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
  },
  headerText: { flex: 1 },
  // The explainer affordance — a small paper sticker-chip so the "how it works"
  // scroll reads as a tappable control beside the title, not a stray glyph.
  helpBtn: {
    marginTop: 2,
    backgroundColor: WHIMSY.paper,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingHorizontal: 6,
    paddingVertical: 5,
    ...SHADOW_SM,
  },
  kicker: {
    ...TYPE.kickerPill,
    color: WHIMSY.mute,
  },
  title: {
    ...TYPE.cardTitle,
    color: WHIMSY.ink,
    marginTop: 2,
    marginBottom: SPACE.sm,
  },
  practice: {
    alignSelf: "flex-start",
    backgroundColor: WHIMSY.lilac,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    marginBottom: SPACE.sm,
  },
  practiceText: { ...TYPE.hand, color: WHIMSY.ink },
  vigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  stirCol: { flex: 1 },
  stirLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stirLabel: { ...TYPE.kicker, color: WHIMSY.mute },
  stirStage: { ...TYPE.kicker, color: WHIMSY.accent },
  stirTrack: {
    height: 12,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    backgroundColor: WHIMSY.cream,
    overflow: "hidden",
    marginTop: SPACE.xs,
  },
  stirFill: { height: "100%" },
  stirTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: "rgba(42,31,21,0.25)",
  },
  freeChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: SPACE.xs,
    backgroundColor: WHIMSY.sun,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 1,
    ...SHADOW_SM,
  },
  freeChipText: { ...TYPE.kicker, color: WHIMSY.ink },
  hunger: { width: 44, height: 44 },
  boardArea: { position: "relative" },
  board: {
    // A column of PATCH_ROWS rows — no flexWrap, so the grid can't drop a
    // tile to a phantom column. BORDER width MUST match BOARD_BORDER (the
    // layout math strips exactly this many px per side).
    borderWidth: BOARD_BORDER,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    overflow: "hidden",
    backgroundColor: WHIMSY.cream2,
  },
  boardRow: {
    flexDirection: "row",
  },
  // flex:1 + aspectRatio:1 makes each tile an even square share of its row —
  // wrapping is structurally impossible regardless of rounding.
  tile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Inset rounded clod (per RADII) so each tile reads as its own mud clump.
  clod: {
    flex: 1,
    alignSelf: "stretch",
    margin: 1.5,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: "rgba(42,31,21,0.18)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  clodCleared: {
    backgroundColor: WHIMSY.cream2,
    borderColor: "rgba(42,31,21,0.1)",
  },
  findWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  silhouette: {
    width: "62%",
    height: "52%",
    borderRadius: RADII.sm,
    backgroundColor: PATCH_ART.silhouette,
    alignItems: "center",
    justifyContent: "center",
  },
  // A gilded lump — the one that got away, re-buried shinier. A warm sun-toned
  // rim so the earlier-showing silhouette reads as the prize you almost had.
  silhouetteGild: {
    borderWidth: 1.5,
    borderColor: WHIMSY.sun,
  },
  // The sun glow behind a gilded lump — same shimmer-glow vocabulary as the
  // tickle-mote reveal, so "gilded" reads in the game's existing gleam language.
  gildGleam: {
    position: "absolute",
    width: "72%",
    height: "72%",
    borderRadius: 999,
    backgroundColor: WHIMSY.sun,
    opacity: 0.45,
  },
  // A partially-dug clod's crack: a thin ink stroke (same earth-ink family as
  // the silhouette) so progress reads without changing the mud tint.
  crack: {
    position: "absolute",
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(42,31,21,0.32)",
  },
  // The shove-telegraph darken — a native-driven ink wash over the charging clod.
  chargeDarken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(42,31,21,1)",
  },
  findImg: { width: "82%", height: "82%" },
  // A half-sunk truffle chunk: smaller + dimmer than a full find (the nudge-down
  // is applied inline off the tile size), so a peeked cell reads as a piece.
  truffleChunk: { width: "58%", height: "58%", opacity: 0.55 },
  // The one big dug-up truffle sitting over a claimed cluster.
  bigTruffleWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    ...SHADOW_SM,
  },
  bigTruffleImg: { width: "100%", height: "100%" },

  // Shimmer — layered glow + tickle-mote bubble + sparkle.
  shimmerWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  shimmerGlow: {
    position: "absolute",
    width: "70%",
    height: "70%",
    borderRadius: 999,
    backgroundColor: WHIMSY.sun,
    opacity: 0.5,
  },
  shimmerBubble: {
    position: "absolute",
    width: "72%",
    height: "72%",
    opacity: 0.85,
  },
  shimmerSpark: { position: "absolute" },
  shimmerSparkSm: { position: "absolute", right: "18%", top: "20%" },

  // Stone — real sprite, sized like the other find art.
  stoneImg: { width: "62%", height: "62%" },

  depthChip: {
    ...TYPE.kicker,
    fontSize: 11,
    color: WHIMSY.accent,
  },
  whisper: {
    ...TYPE.hand,
    fontSize: 13,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.sm,
  },

  // Reveal chip — named pop-in over the tile. width:0 + alignItems:center makes
  // the chip center on the wrap's `left` (the clamped tile-center), so a capped
  // chip never spills past the board's overflow:hidden clip.
  revealChipWrap: {
    position: "absolute",
    width: 0,
    alignItems: "center",
    zIndex: 2,
  },
  revealChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: WHIMSY.paper,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    ...SHADOW_SM,
  },
  // flexShrink lets a long relic name ellipsize inside the chip's maxWidth
  // instead of forcing the chip wider than the board.
  revealChipText: {
    ...TYPE.kicker,
    fontSize: 12,
    color: WHIMSY.ink,
    flexShrink: 1,
  },
  revealIconImg: { width: 14, height: 14 },

  pouchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACE.sm,
    marginTop: SPACE.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: WHIMSY.paper,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    ...SHADOW_SM,
  },
  chipIconImg: { width: 18, height: 18 },
  chipCount: { ...TYPE.numeral, fontSize: 14, color: WHIMSY.ink },
  chipLabel: { ...TYPE.hand, fontSize: 12, color: WHIMSY.mute },

  fleck: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: PATCH_ART.mud[2],
  },

  endCard: {
    marginTop: SPACE.xs,
    alignItems: "center",
  },
  endStory: {
    ...TYPE.hand,
    color: WHIMSY.mute,
    textAlign: "center",
  },
  // The receipt: left-aligned ledger rows, each with a shared icon column so
  // every line's mark and text align in the same two columns (was a centered
  // prose stack that read flat).
  endLines: { alignSelf: "stretch", marginTop: SPACE.md, gap: SPACE.sm },
  endLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
  },
  // Fixed-width icon column — every row's mark lands on the same left edge.
  endIconCol: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  endLineTextCol: { flex: 1 },
  endLineText: {
    ...TYPE.bodySm,
    color: WHIMSY.ink,
  },
  // The warm-accent payoff rows (the carry / echo Connect beats).
  endLineAccent: { color: WHIMSY.accent, fontFamily: FONTS.bodyExtra },
  // The quieter subline beneath a row's headline (the first-mint rule, the
  // "N of 2 dug" tally, the Burrow-Book note).
  endSub: {
    ...TYPE.hand,
    fontSize: 12,
    color: WHIMSY.mute,
    marginTop: 1,
  },
  endIconImg: { width: 16, height: 16 },
  endPractice: {
    ...TYPE.bodySm,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.sm,
  },
  // The Burrow-Book discovery — its OWN tappable sticker row: paper surface,
  // ink border, small hard shadow, the relic art in the same icon column as the
  // ledger, its name as the headline, a chevron on the right (was an underlined
  // link wrapping across two centered lines with an orphaned icon).
  discoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginTop: SPACE.xs,
    backgroundColor: WHIMSY.paper,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    ...SHADOW_SM,
  },
  discoveryName: {
    ...TYPE.cardTitle,
    fontSize: 15,
    color: WHIMSY.accent,
  },
  endPrimary: {
    alignSelf: "stretch",
    minHeight: 44,
    marginTop: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.roseDeep,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.xxl,
    ...SHADOW_SM,
  },
  endBtnPressed: { opacity: 0.55 },
  endPrimaryText: {
    ...TYPE.body,
    fontFamily: FONTS.bodyExtra,
    color: WHIMSY.ink,
    textAlign: "center",
  },

  // ── Lucky result + secondary sharing ─────────────────────────────────────
  shareResult: {
    alignSelf: "stretch",
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  shareMetaRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
  goldResultStat: {
    ...TYPE.hand,
    color: WHIMSY.accent,
    flexShrink: 1,
  },
  shareButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: WHIMSY.paper,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.xxl,
    ...SHADOW_SM,
  },
  shareButtonText: { ...TYPE.label, color: WHIMSY.accent },

  // ── The peek-at-the-patch toggle (end-state board fold) ──────────────────
  // A quiet, centered text control that stands in for the folded board once the
  // dig ends — muted ink in the tracked label voice so it reads as a gentle
  // "there's more if you want it," never a loud CTA competing with the receipt.
  patchToggle: {
    alignSelf: "center",
    marginTop: SPACE.sm,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    alignItems: "center",
    justifyContent: "center",
  },
  patchToggleText: { ...TYPE.label, color: WHIMSY.mute },

  // ── The "oink me when it opens" notify opt-in ────────────────────────────
  // A tappable paper sticker-chip in the sun tone (the game's "reminder/gift"
  // accent — same family as the free-rub chip) so the opt-in reads as a warm
  // offer, not an alert.
  notifyChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: SPACE.xs,
    marginTop: SPACE.md,
    backgroundColor: WHIMSY.sun,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    ...SHADOW_SM,
  },
  notifyChipText: { ...TYPE.hand, fontSize: 13, color: WHIMSY.ink },
  // The confirmed state — quieter (no fill), same warm hand voice.
  notifyDone: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: SPACE.xs,
    marginTop: SPACE.md,
  },
  notifyDoneText: { ...TYPE.hand, fontSize: 13, color: WHIMSY.accent },
  // The soft decline/unavailable note — a gentle line, never an error.
  notifyNote: {
    ...TYPE.hand,
    fontSize: 12,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.md,
  },

  // ── The "how the dig works" explainer ────────────────────────────────
  helpBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MODAL_BACKDROP_BG,
    padding: SPACE.lg,
  },
  helpCardWrap: { width: "100%", maxWidth: 360 },
  helpCard: {
    backgroundColor: WHIMSY.paper,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.xl,
    padding: SPACE.lg,
    ...STICKER_SHADOW,
  },
  helpKicker: { ...TYPE.kickerPill, color: WHIMSY.mute },
  helpTitle: {
    ...TYPE.cardTitle,
    color: WHIMSY.ink,
    marginTop: 2,
    marginBottom: SPACE.sm,
  },
  // Cap the height so a small screen scrolls the sections instead of overflowing.
  helpScroll: { maxHeight: 340 },
  helpScrollBody: { gap: SPACE.md, paddingBottom: SPACE.xs },
  helpSection: { gap: 2 },
  helpSectionHead: { ...TYPE.kicker, color: WHIMSY.accent },
  helpSectionBody: { ...TYPE.hand, color: WHIMSY.ink },
  helpBtnClose: {
    marginTop: SPACE.md,
    alignSelf: "center",
    backgroundColor: WHIMSY.lilac,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    ...SHADOW_SM,
  },
  helpBtnCloseText: { ...TYPE.cardTitle, fontSize: 15, color: WHIMSY.ink },
});
