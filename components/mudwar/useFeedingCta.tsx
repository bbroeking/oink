// The feeding dig hook — the four-window commuter heartbeat entry point.
//
// `useFeedingCta` is the reusable core: it owns the current-feeding countdown,
// the "already rooted" state, and the Truffle Patch modal (open/submit) — so any
// surface can render its OWN trigger (a Button, a line) and drop the returned
// `modal` element beside it. The SounderHomeCard consumes the hook directly for
// its play/cooldown line.
//
// Digging is crew-gated and purely co-op vs the Great Hungerer: one rooting per
// member per feeding; a missed feeding costs nothing and is never displayed as a
// loss (gift-not-guilt).

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router/react-navigation";
import { router } from "expo-router";
import { AppState, InteractionManager, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRooting } from "@/hooks/useRooting";
import { useFeedingClock } from "@/hooks/useFeedingClock";
import { nextOpenCountdown } from "@/utils/rooting";
import {
  hydrateFeedingScheduleCache,
  refreshFeedingSchedule,
} from "@/utils/feedingConfig";
import { TrufflePatch } from "./TrufflePatch";
import { SnoutDeepDig } from "./SnoutDeepDig";

// The how-it-works sheet opens by itself on a player's FIRST Snout Deep dig,
// then only from the sign. One stamp per account, on the device.
const HELP_SEEN_KEY = (uid: string) => `snout_deep_help_seen:${uid}`;
import { LivingMudReceipt, LivingMudRecovery } from "./LivingMudReceipt";
import { AdaptiveModalScaffold } from "@/components/ui";
import { useUnmanagedModalHold } from "@/components/ui/PopupQueue";

export interface FeedingCta {
  /** True once the caller has rooted this feeding window. */
  dugThisWindow: boolean;
  /** True when the caller has no Sounder (digging is crew-gated). */
  noCrew: boolean;
  /** True while the patch is inside the current commuter window's open span. */
  phaseOpen: boolean;
  /**
   * The live countdown for the current PHASE (never the dug state):
   *  open    → time until the patch closes;
   *  guarded → time until the patch next opens.
   * PAIRING RULE: never print this under "opens in" copy while the phase is
   * open — it's a closes-in then (the founder's wrong-number bug). The banner
   * footer reads bannerDigStatus (utils/rooting), which derives the words and
   * the number together from the phase.
   */
  countdown: string;
  /** A gentle inline note after a failed open (already rooted / no crew / retry). */
  note: string | null;
  /** Open the Truffle Patch dig for this feeding. */
  start: () => Promise<void>;
  /**
   * Open a PRACTICE dig — a fresh board that mints nothing (the onboarding
   * "taste"). Crewless players use this to try the dig before joining; the
   * season-tab onboarding card calls it directly. Ignores the phase gate.
   */
  openPractice: () => void;
  /** DEV-ONLY alias of openPractice for testing outside onboarding. */
  startPractice?: () => void;
  /** The dig modal — render it once beside whatever trigger you show. */
  modal: ReactNode;
}

// Receipts can be recovered by both mounted tab hooks. Once dismissed, the
// other instance must not present the same receipt on the next tab focus.
const dismissedReceipts = new WeakSet<object>();
const dismissedWindows = new Set<string>();
const receiptListeners = new Set<() => void>();

export function useFeedingCta(
  onDug?: () => void,
  /** The player's tickle count (the Barn's earned stamp) for the Snout Deep
   *  tally's before → now; null/omitted when the surface can't know it. */
  tickledBefore: number | null = null,
): FeedingCta {
  const {
    session,
    dugThisWindow,
    noCrew,
    open,
    openPractice,
    submit,
    submitDeep,
    syncRooting,
    clear,
    reconcile,
    submitting: serverBusy,
    submissionUncertain,
    pendingSubmission,
    recoveredOutcome,
    recoveredWindowIndex,
    recoveredUserId,
    retryPendingSubmission,
    recoverSubmission,
  } = useRooting();
  // The dig experience is an unmanaged native Modal (visible={!!session}, below):
  // hold the popup queue while a dig session is open so a foreground poll can't
  // present a queued popup over the patch — the #50152 wedge (issue #4). Covers
  // the nested TrufflePatch + DigHelpModal too.
  const focused = useIsFocused();
  const [, refreshReceipts] = useState(0);
  useEffect(() => {
    const listener = () => refreshReceipts((n) => n + 1);
    receiptListeners.add(listener);
    return () => {
      receiptListeners.delete(listener);
    };
  }, []);
  const receiptVisible =
    !!recoveredOutcome &&
    !dismissedReceipts.has(recoveredOutcome) &&
    (recoveredWindowIndex == null ||
      !dismissedWindows.has(`${recoveredUserId}:${recoveredWindowIndex}`));
  const visible =
    focused &&
    (!!session || receiptVisible || !!pendingSubmission || submissionUncertain);
  useUnmanagedModalHold(visible);
  const [busy, setBusy] = useState(false);
  const [brushing, setBrushing] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState<string | undefined>();
  const leaveRef = useRef<(() => Promise<void>) | null>(null);
  const registerLeave = useCallback((leave: (() => Promise<void>) | null) => {
    leaveRef.current = leave;
  }, []);
  // Snout Deep never locks the door: every action is snapshotted and a
  // submission is durable with its own retry lane (useRooting), so leaving
  // mid-restore or mid-submit loses nothing. The classic patch keeps the
  // gate — its submit is the only copy of the finds. (2026-09-14: a slow
  // submit_rooting_deep left the X and "Back to the Barn" dead.)
  const leaveIsFree = session?.mode === "snout_deep";
  const close = useCallback(() => {
    if ((busy || serverBusy) && !leaveIsFree) return;
    if (recoveredOutcome) dismissedReceipts.add(recoveredOutcome);
    if (recoveredWindowIndex != null)
      dismissedWindows.add(`${recoveredUserId}:${recoveredWindowIndex}`);
    receiptListeners.forEach((listener) => listener());
    clear();
    InteractionManager.runAfterInteractions(() => router.navigate("/(tabs)"));
  }, [
    busy,
    serverBusy,
    leaveIsFree,
    recoveredOutcome,
    recoveredWindowIndex,
    recoveredUserId,
    clear,
  ]);
  const requestClose = useCallback(() => {
    if ((busy || serverBusy) && !leaveIsFree) return;
    if (leaveRef.current) leaveRef.current();
    else close();
  }, [busy, serverBusy, leaveIsFree, close]);
  const retry = useCallback(async () => {
    const result = await retryPendingSubmission();
    setRecoveryReason(result.ok ? undefined : result.reason);
    if (result.ok) {
      onDug?.();
      return { outcome: result.outcome };
    }
    return { outcome: null, failReason: result.reason };
  }, [retryPendingSubmission, onDug]);
  const [note, setNote] = useState<string | null>(null);
  const {
    open: phaseOpen,
    countdown,
    refresh: refreshClock,
  } = useFeedingClock({ focused, reconcile });

  // Server-authoritative schedule sync: cache-hydrate then fetch on mount
  // (the founder's "schedule changes propagate without a binary"). A confirmed
  // CHANGE re-derives the clock this frame and reconciles the dug state — a
  // re-anchor detaches window ids exactly like the 20260744 shift did, and
  // reconcile() heals the flag against the server. Both fail-soft.
  useEffect(() => {
    let alive = true;
    (async () => {
      await hydrateFeedingScheduleCache();
      if (!alive) return;
      refreshClock(); // cached schedule may differ from compiled defaults
      const changed = await refreshFeedingSchedule();
      if (!alive || !changed) return;
      refreshClock();
      reconcile(true);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [reconcile, refreshClock]);

  // The clock hook owns the immediate foreground repaint and state reconcile.
  // This companion listener recovers submissions and refreshes the remotely
  // configurable schedule; a confirmed shift is reconciled without debounce.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      if (focused) recoverSubmission().catch(() => {});
      refreshFeedingSchedule()
        .then((changed) => {
          if (changed) {
            refreshClock();
            reconcile(true);
          }
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [reconcile, focused, recoverSubmission, refreshClock]);

  const start = async () => {
    setNote(null);
    Haptics.selectionAsync().catch(() => {});
    const r = await open();
    refreshClock();
    if (!r.ok) {
      setNote(
        r.reason === "already_rooted"
          ? "You rooted this feeding — he gorges again soon."
          : r.reason === "no_crew"
            ? "join a Sounder to dig for keeps — or try a practice dig first."
            : r.reason === "patch_closed"
              ? `He's guarding the patch — it opens in ${nextOpenCountdown()}.`
              : "The patch is being stubborn — try again.",
      );
    }
  };

  // null = not read yet (never flash the sheet before we know), else whether
  // this account has seen the explanation.
  const [helpSeen, setHelpSeen] = useState<boolean | null>(null);
  const helpUid = session?.mode === "snout_deep" ? session.userId : null;
  useEffect(() => {
    if (!helpUid) return;
    let alive = true;
    setHelpSeen(null);
    AsyncStorage.getItem(HELP_SEEN_KEY(helpUid))
      .then((v) => {
        if (alive) setHelpSeen(v === "1");
      })
      .catch(() => {
        if (alive) setHelpSeen(true);
      });
    return () => {
      alive = false;
    };
  }, [helpUid]);
  const markHelpSeen = useCallback(() => {
    setHelpSeen(true);
    if (helpUid) AsyncStorage.setItem(HELP_SEEN_KEY(helpUid), "1").catch(() => {});
  }, [helpUid]);

  const modal = (
    <AdaptiveModalScaffold
      visible={visible}
      onRequestClose={requestClose}
      // Snout Deep is a MODE you step into, not a card: the whole screen,
      // sliding up. The classic patch keeps its bare card.
      bare={session?.mode !== "snout_deep"}
      fullScreen={session?.mode === "snout_deep"}
      animationType={session?.mode === "snout_deep" ? "slide" : "fade"}
      contentContainerStyle={session?.mode === "snout_deep" ? styles.fullBody : styles.modalBody}
      scrollViewProps={{ scrollEnabled: !brushing }}
    >
      {session && session.mode === "snout_deep" ? (
        // Snout Deep (the server's mode decision at open): the three-layer
        // press-your-luck dig. Same modal, same open/close contract — only
        // the patch inside it differs.
        <SnoutDeepDig
          key={`deep:${session.userId ?? "practice"}:${session.windowIndex}:${session.seed}`}
          session={session}
          onSubmit={submitDeep}
          onSync={syncRooting}
          onClose={close}
          onDug={onDug}
          onBusyChange={setBusy}
          phaseCountdown={phaseOpen ? countdown : undefined}
          helpOnMount={helpSeen === false}
          onHelpSeen={markHelpSeen}
          tickledBefore={tickledBefore}
        />
      ) : session ? (
        <TrufflePatch
          key={`${session.userId ?? "practice"}:${session.windowIndex}:${session.seed}`}
          session={session}
          onSubmit={async (finds, actions, missed) => {
            const r = await submit(finds, actions, missed);
            if (r.ok && r.outcome && !r.outcome.practice) onDug?.();
            return r.ok
              ? { outcome: r.outcome }
              : { outcome: null, failReason: r.reason };
          }}
          onClose={close}
          onBusyChange={setBusy}
          onInteractionChange={setBrushing}
          registerLeave={registerLeave}
          onRetry={retry}
          recoveredOutcome={
            recoveredWindowIndex === session.windowIndex
              ? recoveredOutcome
              : null
          }
        />
      ) : receiptVisible && recoveredOutcome ? (
        <LivingMudReceipt outcome={recoveredOutcome} onClose={close} />
      ) : (
        <LivingMudRecovery
          busy={serverBusy}
          reason={recoveryReason}
          onRetry={retry}
          onClose={close}
        />
      )}
    </AdaptiveModalScaffold>
  );

  return {
    dugThisWindow,
    noCrew,
    phaseOpen,
    countdown,
    note,
    start,
    // The onboarding "taste": crewless players can practice-dig before joining.
    openPractice: () => {
      Haptics.selectionAsync().catch(() => {});
      openPractice();
    },
    // Dev escape hatch for testing the dig outside the 4h open band.
    startPractice: __DEV__ ? () => openPractice() : undefined,
    modal,
  };
}

const styles = StyleSheet.create({
  // The scaffold centres and pads; this only stacks the escape chip above the
  // patch and keeps them from touching.
  modalBody: { justifyContent: "center" },
  // The full-screen dig: no card inset — the patch screen pads itself.
  fullBody: { flexGrow: 1 },
});
