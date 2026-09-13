import { feedingNowMs, subscribeFeedingClock } from "@/utils/feedingClock";
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Image,
  StyleSheet,
  Share,
  AccessibilityInfo,
  InteractionManager,
  AppState,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  PATCH_COLS,
  PATCH_ROWS,
  STIR_BUDGET,
  STIR_RUB,
  STIR_SHOVE,
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
  partiallyRevealedFinds,
  gildedSilhouetteDepth,
  ClaimableFind,
  Find,
} from "@/utils/rooting";
import { preload, play, startAmbience, stopAmbience } from "@/utils/sound";
import { observeFieldGuide } from "@/utils/fieldGuide";
import { RootingOutcome, RootingSession } from "@/hooks/useRooting";
import { ReclaimSlam, ReclaimSlamHandle } from "./ReclaimSlam";
import { router } from "expo-router";
import {
  AdaptiveModalScaffold,
  Button,
  CardTitle,
  Glyph,
  Hand,
  Kicker,
  T,
} from "@/components/ui";
import {
  digShareData,
  buildDigShareText,
  bumpDigShareCount,
  type DigShareData,
} from "@/utils/digShare";
import { DigPostcardComposer } from "./DigPostcardComposer";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import { BORDER, RADII, SPACE, TAP_MIN, WHIMSY } from "@/constants/theme";
import { LivingMudSurface } from "./LivingMudSurface";
import {
  LivingMudScene,
  LivingMudPouch,
  livingMudStyles,
} from "./LivingMudScene";
import { LivingMudReceipt, LivingMudRecovery } from "./LivingMudReceipt";
import {
  loadDigProgress,
  saveDigProgress,
  clearDigProgress,
} from "@/utils/digSubmission";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

// ── Art slots ────────────────────────────────────────────────────────────────
// The board itself (mud ramp, finds, reveal chips) is drawn by LivingMudSurface;
// this file only keeps the Hungerer vignette art.
const PATCH_ART = {
  hunger: require("../../assets/images/hunger/great_hungerer_chip.png"), // the gorging Hungerer (real art)
} as const;

// The explainer card's width cap — a reading measure, not a layout step.
const HELP_MAX_WIDTH = 360;

// Board drawing: the height of his-attention's capsule. Geometry, not spacing.
const STIR_TRACK_H = 12;

const TOTAL = PATCH_ROWS * PATCH_COLS;

// The glyph size the receipt's share mark uses.
const LEDGER_GLYPH = 15;

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
  shimmer: MOTE_MACHINE_VISIBLE
    ? "a pocket of tickle-motes drifts free."
    : "a shimmer pocket drifts free.",
  stone: "just a stone.",
  junk_boot: "his old boot. why.",
  junk_wrap: "a licked-clean wrapper. keep it?",
  unique: "something odd — into the pouch.",
};

const FREE_RUB_LINE = "your snout knows the way — a free rub.";

// "The One That Got Away" copy — the session-opening whisper when a carry
// exists. Kind-aware: a carried relic reads "relic", a carried truffle "truffle"
// (the slot only ever holds truffle_l/truffle_d/unique).
function carryNoun(kind: string): string {
  return kind === "unique" ? "relic" : "truffle";
}
function carryOpenLine(kind: string): string {
  return `he reburied the ${carryNoun(kind)} you almost had — look for the gleam.`;
}

// A truffle is buried as a multi-tile cluster (Pokémon-fossil style) — this
// whisper sets the expectation that a peeked cell is PART of a bigger find, so
// clearing the whole cluster (not a single cell) is what claims it.
const PARTIAL_TRUFFLE_LINE = "part of a big one — clear the rest of it!";

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
  onBusyChange?: (busy: boolean) => void;
  onInteractionChange?: (active: boolean) => void;
  registerLeave?: (leave: (() => Promise<void>) | null) => void;
  onRetry?: () => Promise<{
    outcome: RootingOutcome | null;
    failReason?: string;
  }>;
  recoveredOutcome?: RootingOutcome | null;
  preview?: boolean;
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
  onBusyChange,
  onInteractionChange,
  registerLeave,
  onRetry,
  recoveredOutcome,
  preview = false,
}: Props) {
  // The dig is the app's busiest surface, and it is one a Reduce Motion player
  // has to stay inside for a whole feeding. The board's own motion split
  // (informational reveals still happen, decorative flourishes rest) lives in
  // LivingMudSurface; here the flag only steers the receipt. [C-08]
  const { reduceMotion } = useMotionPolicy();
  const { height } = useWindowDimensions();
  const compact = height < 750;
  const board = useMemo(
    () => generateBoard(session.seed, session.uniqueId),
    [session.seed, session.uniqueId],
  );
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
  // Co-op depth: a crewmate already dug this feeding → he's more distracted,
  // so you can stir more before he notices (matches the server's 25-action cap).
  const stirBudget = session.coop ? STIR_BUDGET * 1.25 : STIR_BUDGET;

  // Float layers so rub-splash can take half-layers off neighbors.
  const [layers, setLayers] = useState<number[]>(() => [...board.layers]);
  const [stir, setStir] = useState(0);
  const [collected, setCollected] = useState<Find[]>([]);
  const [whisper, setWhisper] = useState<string | null>(null);
  const [freeReady, setFreeReady] = useState(false);
  const [end, setEnd] = useState<EndState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(
    !session.practice && !!session.userId,
  );
  const [saveFailed, setSaveFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const mounted = useRef(true);
  const progressWrites = useRef<Promise<void>>(Promise.resolve());
  const busyRef = useRef(false);
  const restoredRef = useRef(session.practice || !session.userId);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onBusyChange?.(submitting || restoring);
    return () => onBusyChange?.(false);
  }, [submitting, restoring, onBusyChange]);
  // The "how the dig works" explainer. Two-phase teardown: `helpOpen` is the
  // native Modal's visible flag, `helpMounted` is the mount gate — on close we
  // drop visible first, then unmount a teardown beat later so the native
  // dismissal animation runs before the tree unmounts (the wedge-class contract).
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMounted, setHelpMounted] = useState(false);

  const openMoteMachine = useCallback(() => {
    if (!MOTE_MACHINE_VISIBLE) return;
    Haptics.selectionAsync().catch(() => {});
    onClose();
    InteractionManager.runAfterInteractions(() => {
      router.push("/mote-machine");
    });
  }, [onClose]);

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
  const endedRef = useRef(false);
  const persistProgress = useCallback(() => {
    if (preview || session.practice || !session.userId || !restoredRef.current)
      return progressWrites.current;
    const snapshot = {
      uid: session.userId,
      windowIndex: session.windowIndex,
      seed: session.seed,
      layers: [...layersRef.current],
      collected: [...collectedRef.current],
      actions: stirRef.current,
      dugOrder: [...dugOrderRef.current],
      streak: streakRef.current,
      freeNext: freeNextRef.current,
      savedAt: new Date().toISOString(),
    };
    const next = progressWrites.current
      .catch(() => {})
      .then(() => saveDigProgress(snapshot));
    progressWrites.current = next;
    next.then(
      () => {
        if (mounted.current) setSaveFailed(false);
      },
      () => {
        if (mounted.current) setSaveFailed(true);
      },
    );
    return next;
  }, [preview, session]);

  const discardProgress = useCallback(async () => {
    if (!session.practice && session.userId) {
      await progressWrites.current.catch(() => {});
      await clearDigProgress(session.userId, session.windowIndex).catch(
        () => {},
      );
    }
  }, [session]);

  const leave = useCallback(async () => {
    if (busyRef.current || !restoredRef.current) return;
    try {
      if (!endedRef.current) await persistProgress();
    } catch {
      return;
    } // Keep the live board open when its save failed.
    onClose();
  }, [onClose, persistProgress]);
  useEffect(() => {
    registerLeave?.(leave);
    return () => registerLeave?.(null);
  }, [leave, registerLeave]);

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      try {
        if (!session.practice && session.userId) {
          const saved = await loadDigProgress(
            session.userId,
            session.windowIndex,
            session.seed,
          );
          if (
            saved &&
            alive &&
            saved.actions <= stirBudget &&
            saved.layers.every((n, i) => n <= board.layers[i])
          ) {
            layersRef.current = saved.layers;
            stirRef.current = saved.actions;
            // Reconstruct finds from the board; local JSON never invents a reward.
            const found = new Set<Find>();
            if (clusterRevealed(board.truffleL, saved.layers))
              found.add("truffle_l");
            if (clusterRevealed(board.truffleD, saved.layers))
              found.add("truffle_d");
            board.cells.forEach((cell, i) => {
              if (
                cell &&
                cell.kind !== "truffle_l" &&
                cell.kind !== "truffle_d" &&
                saved.layers[i] <= 0
              )
                found.add(cell.kind);
            });
            collectedRef.current = found;
            dugOrderRef.current = saved.dugOrder;
            streakRef.current = saved.streak;
            freeNextRef.current = saved.freeNext;
            setLayers(saved.layers);
            setStir(saved.actions);
            setCollected([...found]);
            setFreeReady(saved.freeNext);
          }
        }
      } catch {
        if (alive) setSaveFailed(true);
      } finally {
        if (alive) {
          restoredRef.current = true;
          setRestoring(false);
        }
      }
    };
    restore();
    return () => {
      alive = false;
    };
  }, [board, session, stirBudget]);
  useEffect(() => {
    const checkExpiry = () =>
      setExpired(!session.practice && feedingNowMs() >= session.windowEndsAtMs);
    checkExpiry();
    const unsubscribeClock = subscribeFeedingClock(checkExpiry);
    const timer = setInterval(checkExpiry, 1000);
    const sub = AppState.addEventListener("change", (state) => {
      checkExpiry();
      if (state !== "active" && !endedRef.current)
        persistProgress().catch(() => {});
    });
    return () => {
      clearInterval(timer);
      unsubscribeClock();
      sub.remove();
    };
  }, [session, persistProgress]);
  // The reclaim slam — golden joy-motes rip from the gorging Hunger (top-right)
  // to your pouch (bottom) on every find.
  const slamRef = useRef<ReclaimSlamHandle>(null);
  const reclaimBurst = useCallback((intensity: "wisp" | "pop" | "burst") => {
    // caller already fires the find's own haptic on this same beat, so the
    // slam skips its haptic to avoid stacking two buzzes.
    slamRef.current?.slam({ intensity, haptic: false });
  }, []);

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
    async (line: string, retry = false) => {
      if (
        (endedRef.current && !retry) ||
        busyRef.current ||
        !restoredRef.current
      )
        return;
      endedRef.current = true;
      busyRef.current = true;
      setSubmitting(true);
      stopAmbience(600);
      const missed = partiallyRevealedFinds(
        board,
        layersRef.current,
        collectedRef.current,
      );
      let res: { outcome: RootingOutcome | null; failReason?: string };
      try {
        // Pending payload durability is enforced by the submission hook. Progress is
        // saved as well so leaving/relaunching before a submit restores the same board.
        await persistProgress();
      } catch {
        busyRef.current = false;
        setSubmitting(false);
        setEnd({
          line,
          outcome: null,
          failReason: "storage_failed",
          finds: [...collectedRef.current],
          share: digShareData(
            board,
            layersRef.current,
            collectedRef.current,
            session.windowIndex,
            dugOrderRef.current,
          ),
        });
        return;
      }
      try {
        res =
          retry && onRetry && end?.failReason !== "storage_failed"
            ? await onRetry()
            : await onSubmit(claimables(), stirRef.current, missed);
      } catch {
        res = { outcome: null, failReason: "uncertain" };
      }
      const share = digShareData(
        board,
        layersRef.current,
        collectedRef.current,
        session.windowIndex,
        dugOrderRef.current,
      );
      if (res.outcome) await discardProgress();
      if (mounted.current)
        setEnd({
          line,
          outcome: res.outcome,
          failReason: res.failReason,
          finds: [...collectedRef.current],
          share,
        });
      busyRef.current = false;
      if (mounted.current) setSubmitting(false);
      if (res.outcome && !preview) {
        observeFieldGuide("feeding_windows");
        if (
          collectedRef.current.has("truffle_l") ||
          collectedRef.current.has("truffle_d")
        ) {
          observeFieldGuide("truffle");
          observeFieldGuide("golden_truffle");
        }
      }
    },
    [
      onSubmit,
      onRetry,
      end,
      claimables,
      board,
      session.windowIndex,
      persistProgress,
      discardProgress,
      preview,
    ],
  );

  useEffect(() => {
    if (!recoveredOutcome) return;
    endedRef.current = true;
    discardProgress();
    setEnd({
      line: "Your original receipt is back.",
      outcome: recoveredOutcome,
      finds: [...collectedRef.current],
      share: digShareData(
        board,
        layersRef.current,
        collectedRef.current,
        session.windowIndex,
        dugOrderRef.current,
      ),
    });
  }, [recoveredOutcome, discardProgress, board, session.windowIndex]);
  // Collect a fully-uncovered find (the surface draws the reveal itself).
  const collect = useCallback(
    (kind: Find) => {
      if (collectedRef.current.has(kind)) return;
      collectedRef.current.add(kind);
      setCollected([...collectedRef.current]);
      justCollectedRef.current = kind;
      if (kind === "truffle_l" || kind === "truffle_d") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        play("truffle_pop"); // the payoff pop, on the success beat
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
    [reclaimBurst],
  );

  const afterReveal = useCallback(
    (next: number[]) => {
      // Cluster completion + single-cell finds. clusterRevealed (utils/rooting)
      // owns the "every cell of this cluster is cleared" test.
      const revealed = (idx: number) => next[idx] <= 0;
      if (clusterRevealed(board.truffleL, next)) collect("truffle_l");
      if (clusterRevealed(board.truffleD, next)) collect("truffle_d");
      for (let i = 0; i < next.length; i++) {
        const cell = board.cells[i];
        if (!cell || cell.kind === "truffle_l" || cell.kind === "truffle_d")
          continue;
        if (revealed(i)) collect(cell.kind);
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
      if (
        endedRef.current ||
        !restoredRef.current ||
        busyRef.current ||
        (!session.practice && feedingNowMs() >= session.windowEndsAtMs)
      )
        return;
      if (stirRef.current >= stirBudget) return; // ends BETWEEN actions
      if (idx < 0 || idx >= TOTAL) return;
      const wasFree = freeNextRef.current;
      // free re-rub on already-clear tile: no stir. (A gifted rub is allowed to
      // land anywhere the player points, so it doesn't short-circuit here.)
      if (layersRef.current[idx] <= 0 && kind === "rub" && !wasFree) return;

      const cost = wasFree ? 0 : kind === "rub" ? STIR_RUB : STIR_SHOVE;
      if (stirRef.current + cost > stirBudget) {
        setWhisper("He's too alert for a shove. Try a gentle rub.");
        return;
      }
      const before = layersRef.current;
      const next = [...before];
      // Dig math lives in the shared applySplash kernel (utils/rooting) — the
      // SAME physics simulateGreedyClear pins. We diff before/after below to
      // find newly-cleared tiles, so we splash a fresh copy.
      applySplash(next, idx, kind);
      if (kind === "rub") {
        Haptics.selectionAsync().catch(() => {});
        play("scrape"); // quiet scratch through the mud
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        play("creak"); // the loud snout-shove
      }

      // Accepted actions always fit the remaining server-owned budget.
      stirRef.current += cost;
      setStir(stirRef.current);
      if (wasFree) {
        freeNextRef.current = false;
        setFreeReady(false);
      }

      // Each newly-cleared tile is appended to the temporal dig ledger.
      for (let i = 0; i < next.length; i++) {
        if (before[i] > 0 && next[i] <= 0) dugOrderRef.current.push(i);
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
      if (!endedRef.current) persistProgress().catch(() => {});

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
    [afterReveal, board, stirBudget, session, persistProgress],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  // Calm → stirring → he's-lifting-his-snout: the fill greens when he's quiet
  // and reddens as he wakes, so the tension is legible without a number.
  const stirFrac = stir / stirBudget;
  const stage =
    stirFrac < 0.5
      ? "calm"
      : stirFrac < 0.85
        ? "stirring"
        : "he's lifting his snout";
  // Named co-op presence — the crewmates who already dug this feeding, so the
  // Name the concrete co-op benefit instead of the vague "dig deeper" promise.
  const coopNames = joinNames(session.crewDug.map((c) => c.display_name));
  const truffleCount = collected.filter(
    (f) => f === "truffle_l" || f === "truffle_d",
  ).length;

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

  if (end?.outcome)
    return (
      <LivingMudReceipt
        outcome={end.outcome}
        onClose={onClose}
        reduceMotion={reduceMotion}
      >
        {!end.outcome.practice && !preview && (
          <GoldShareResult
            data={end.share}
            goldenInDigs={end.share.goldenInDigs}
            canPostcard
          />
        )}
        {MOTE_MACHINE_VISIBLE &&
          !end.outcome.practice &&
          end.finds.includes("shimmer") && (
            <Button variant="ghost" onPress={openMoteMachine}>
              Use your Mote
            </Button>
          )}
      </LivingMudReceipt>
    );
  if (end || submitting)
    return (
      <LivingMudRecovery
        busy={submitting}
        reason={end?.failReason}
        onRetry={() => finish("Your finds are packed.", true)}
        onClose={onClose}
      />
    );

  return (
    <LivingMudScene
      title="Truffle Patch"
      onBack={leave}
      onHelp={openHelp}
      busy={submitting || restoring}
    >
      <View style={[livingMudStyles.inset, { marginBottom: SPACE.xs }]}>
        <View style={styles.vigRow}>
          <View
            style={[
              styles.stirCol,
              livingMudStyles.paper,
              { padding: SPACE.sm },
            ]}
          >
            <T role="hand">
              {session.practice
                ? "A little practice in the mud"
                : "Brush the mud away"}
            </T>
            <T role="kicker" tone="secondary">
              {restoring ? "Remembering your patch…" : stage}
            </T>
            <View
              style={styles.stirTrack}
              accessibilityRole="progressbar"
              accessibilityLabel="The Hungerer's attention"
              accessibilityValue={{ text: stage }}
            >
              <View
                style={[
                  styles.stirFill,
                  {
                    width: `${Math.min(100, (stir / stirBudget) * 100)}%`,
                    backgroundColor:
                      stirFrac < 0.5
                        ? WHIMSY.sage
                        : stirFrac < 0.85
                          ? WHIMSY.sun
                          : WHIMSY.roseDeep,
                  },
                ]}
              />
            </View>
            {session.coop && (
              <T role="bodySm">
                {coopNames || "A crewmate"} helped — up to 5 extra rubs.
              </T>
            )}
            {session.blessed && <T role="bodySm">A blessing joins this dig.</T>}
            {freeReady && <T role="kicker">Free rub ready</T>}
          </View>
          <Image
            source={PATCH_ART.hunger}
            style={{ width: compact ? 80 : 116, height: compact ? 80 : 116 }}
            resizeMode="contain"
            accessible={false}
          />
        </View>
      </View>
      <LivingMudSurface
        board={board}
        layers={layers}
        collected={collected}
        disabled={submitting || restoring || expired}
        reduceMotion={reduceMotion}
        aspectRatio={compact ? 1.5 : 1.25}
        gildedIndices={[...gildedTiles]}
        gildSilhouetteDepth={gildSilThreshold}
        onAction={({ kind, index }) => applyAction(kind, index)}
        onInteractionChange={onInteractionChange}
      />
      <View style={[livingMudStyles.paper, livingMudStyles.inset]}>
        <T role="hand" align="center">
          {expired
            ? "This Feeding has ended. Pack up to check your result."
            : whisper || "Brush or tap gently. Hold for a bigger shove."}
        </T>
      </View>
      <LivingMudPouch
        count={collected.filter((f) => f !== "stone").length}
        truffleCount={truffleCount}
        compact={compact}
        reduceMotion={reduceMotion}
      />
      <View style={livingMudStyles.footer}>
        {saveFailed && (
          <T role="bodySm">
            Your patch couldn't be saved on this phone. Try again before
            leaving.
          </T>
        )}
        <Button
          size="lg"
          full
          disabled={restoring || submitting}
          onPress={() => finish("You packed up your finds.")}
        >
          {restoring ? "Remembering…" : "Pack up"}
        </Button>
      </View>
      <ReclaimSlam ref={slamRef} />
      {helpMounted && (
        <DigHelpModal
          visible={helpOpen}
          coop={session.coop}
          onClose={closeHelp}
        />
      )}
    </LivingMudScene>
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
    <AdaptiveModalScaffold
      visible={visible}
      onRequestClose={onClose}
      maxWidth={HELP_MAX_WIDTH}
      dismissOnBackdrop
      showCloseButton
      closeLabel="Close dig instructions"
      contentContainerStyle={styles.helpCard}
    >
      <Kicker star={false}>the truffle patch</Kicker>
      <CardTitle style={styles.helpTitle}>how the dig works</CardTitle>
      <View style={styles.helpScrollBody}>
        <HelpSection heading="the goal">
          two truffles are buried in the mud. find both before the Hungerer
          fully stirs and lifts his snout.
        </HelpSection>
        <HelpSection heading="how to dig">
          rub (tap) clears a little mud and stirs him a little. shove (press and
          hold) clears more but wakes him faster. his attention is your only
          clock.
        </HelpSection>
        <HelpSection heading="what you find">
          every find calms his attention. the first truffle you dig mints a
          Golden Truffle;{" "}
          {MOTE_MACHINE_VISIBLE
            ? "more truffles and tickle-motes still count."
            : "more truffles still count."}{" "}
          junk counts too, stones do nothing, and rare relics go to your Burrow
          Book.
        </HelpSection>
        {coop && (
          <HelpSection heading="digging together">
            a crewmate already dug this feeding, so he's more distracted — you
            can rub up to 5 more times before he wakes.
          </HelpSection>
        )}
        <HelpSection heading="leaving">
          leave anytime. the patch keeps your board until the feeding window
          closes — nothing is lost by walking away.
        </HelpSection>
      </View>
      <Button
        variant="lilac"
        onPress={onClose}
        accessibilityLabel="Close dig instructions"
        accessibilityHint="Returns you to the patch. Your board is untouched."
        style={styles.helpBtnClose}
      >
        got it
      </Button>
    </AdaptiveModalScaffold>
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
      <T role="kicker" tone="accent">
        {heading}
      </T>
      <Hand>{children}</Hand>
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
          <Hand
            tone="accent"
            style={styles.goldResultStat}
            accessibilityLabel={`First Golden Truffle found on move ${goldenInDigs}`}
          >
            First truffle: move {goldenInDigs}
          </Hand>
        )}
        <Button
          variant="ghost"
          size="sm"
          onPress={onShare}
          onLongPress={onCopy}
          icon={<Glyph name="sparkle" size={LEDGER_GLYPH} />}
          accessibilityLabel="Share this dig result"
          accessibilityHint="Opens the share sheet. Long press to copy the result."
          accessibilityValue={copied ? { text: "Copied" } : undefined}
        >
          {copied ? "Copied" : "Share"}
        </Button>
      </View>
      {canPostcard && <DigPostcardComposer data={data} />}
    </View>
  );
}

const styles = StyleSheet.create({
  vigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  stirCol: { flex: 1 },
  // His attention: a hand-rolled meter on purpose. It is not a ProgressTrack —
  // the fill RAMPS from sage through sun to roseDeep as he wakes, and the
  // number it stands for is never shown. Tokens everywhere, worded value in
  // the a11y layer.
  stirTrack: {
    height: STIR_TRACK_H,
    borderWidth: BORDER.thin,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
    backgroundColor: WHIMSY.cream,
    overflow: "hidden",
    marginTop: SPACE.xs,
  },
  stirFill: { height: "100%" },

  // ── Lucky result + secondary sharing ─────────────────────────────────────
  shareResult: {
    alignSelf: "stretch",
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  shareMetaRow: {
    minHeight: TAP_MIN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
  goldResultStat: { flexShrink: 1 },

  // ── The "how the dig works" explainer ────────────────────────────────
  // The scaffold owns the scrim, the paper frame and the scroll path now, so
  // this is only the card's inset and the rhythm between its sections.
  helpCard: { padding: SPACE.lg },
  helpTitle: { marginTop: SPACE.xxs, marginBottom: SPACE.sm },
  helpScrollBody: { gap: SPACE.md, paddingBottom: SPACE.xs },
  helpSection: { gap: SPACE.xxs },
  helpBtnClose: { marginTop: SPACE.md, alignSelf: "center" },
});
