// Snout Deep, bound to a real Feeding — the session adapter around the pure
// dig (utils/snoutDeep) and its renderer (SnoutDeepPatch), for the modal
// useFeedingCta owns. The dev route (app/snout-deep-preview) is the same
// pieces with no server; this file is what a Feeding adds:
//   · the board from the session's seed (+ the relic the server rolled);
//   · restore — `{ layer, actions }` (spec §10) from the device snapshot, else
//     the server's synced log, replayed through the reducer;
//   · a snapshot after every action, a sync_rooting every 5th action and on
//     background (the close cron ties an abandoned dig at that log);
//   · the window closing under an open dig → the reducer's `close` (a tie);
//   · the end → useRooting.submitDeep, then the receipt sheet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import type { DeepSubmission, RootingOutcome, RootingSession } from "@/hooks/useRooting";
import type { RpcResult } from "@/utils/rpc";
import { feedingNowMs } from "@/utils/feedingClock";
import { generateLayeredBoard } from "@/utils/rooting";
import {
  clearSnoutDeepProgress,
  loadSnoutDeepProgress,
  saveSnoutDeepProgress,
} from "@/utils/digSubmission";
import {
  initialState,
  reduce,
  replay,
  type DigReceipt,
  type SnoutDeepEvent,
  type SnoutDeepState,
} from "@/utils/snoutDeep";
import { SnoutDeepPatch } from "./SnoutDeepPatch";
import { DigReceiptSheet } from "./SnoutDeepSheets";

// The log syncs to the server every this-many actions (spec §6).
export const SNOUT_DEEP_SYNC_EVERY = 5;
// Where the uncrewed receipt's "truffles are for herds — find yours ›" goes.
const JOIN_PATH = "/(tabs)/season";

export interface SnoutDeepDigProps {
  session: RootingSession;
  /** useRooting.submitDeep — the durable pending payload + submit_rooting_deep. */
  onSubmit: (deep: DeepSubmission) => Promise<RpcResult<{ outcome: RootingOutcome }>>;
  /** useRooting.syncRooting — fire-and-forget. */
  onSync: (layer: number, actions: string[], finds: string[]) => Promise<void>;
  /** Leave the patch (the close chip, the receipt's primary). */
  onClose: () => void;
  /** A real (non-practice) dig landed on the server. */
  onDug?: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** The open phase's live countdown from the feeding clock, for the sign. */
  phaseCountdown?: string;
}

export function SnoutDeepDig({
  session,
  onSubmit,
  onSync,
  onClose,
  onDug,
  onBusyChange,
  phaseCountdown,
}: SnoutDeepDigProps) {
  const board = useMemo(
    () => generateLayeredBoard(session.seed, session.uniqueId),
    [session.seed, session.uniqueId],
  );
  const opts = useMemo(
    () => ({ coop: session.coop, uncrewed: session.uncrewed ?? false }),
    [session.coop, session.uncrewed],
  );
  const [state, setState] = useState<SnoutDeepState>(() => initialState(board, opts));
  const dispatch = useCallback(
    (event: SnoutDeepEvent) => setState((s) => reduce(s, event)),
    [],
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const [restored, setRestored] = useState(false);
  const [receipt, setReceipt] = useState<DigReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastSyncedRef = useRef(0);

  useEffect(() => {
    onBusyChange?.(submitting || !restored);
    return () => onBusyChange?.(false);
  }, [submitting, restored, onBusyChange]);

  // ── Restore: the device snapshot, else the server's synced log ────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      let snapshot: { layer: number; actions: string[] } | null = null;
      try {
        if (session.userId) {
          const saved = await loadSnoutDeepProgress(
            session.userId,
            session.windowIndex,
            session.seed,
          );
          if (saved) snapshot = saved;
        }
      } catch {
        // a broken snapshot is the same as none — the server's log is next
      }
      if (!snapshot && session.synced && session.synced.actions.length > 0) {
        snapshot = session.synced;
      }
      if (!alive) return;
      if (snapshot) {
        let next = replay(board, opts, snapshot.actions);
        while (next.layer < snapshot.layer && !next.ended) {
          next = reduce(next, { type: "descend" });
        }
        lastSyncedRef.current = next.actions.length;
        setState(next);
      }
      setRestored(true);
    })();
    return () => {
      alive = false;
    };
  }, [board, opts, session]);

  // ── Snapshot after every change; sync every 5th action ────────────────────
  useEffect(() => {
    if (!restored || state.ended || !session.userId) return;
    saveSnoutDeepProgress({
      uid: session.userId,
      windowIndex: session.windowIndex,
      seed: session.seed,
      layer: state.layer,
      actions: state.actions,
      finds: state.banked,
      savedAt: new Date().toISOString(),
    }).catch(() => {});
    const n = state.actions.length;
    if (n > 0 && n % SNOUT_DEEP_SYNC_EVERY === 0 && n !== lastSyncedRef.current) {
      lastSyncedRef.current = n;
      onSync(state.layer, state.actions, state.banked).catch(() => {});
    }
  }, [restored, state.ended, state.layer, state.actions, state.banked, session, onSync]);

  // On background: sync whatever the log holds now.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") return;
      const cur = stateRef.current;
      if (cur.ended || cur.actions.length === lastSyncedRef.current) return;
      lastSyncedRef.current = cur.actions.length;
      onSync(cur.layer, cur.actions, cur.banked).catch(() => {});
    });
    return () => sub.remove();
  }, [onSync]);

  // ── The sign's countdown; the window closing ends the dig as a tie ────────
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((session.windowEndsAtMs - feedingNowMs()) / 1000)),
  );
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((session.windowEndsAtMs - feedingNowMs()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !stateRef.current.ended) {
        // The server ties the row at its synced log when the window closes
        // (close_open_rootings); push the last few actions first so the
        // cron's tie is this dig, not the one from five actions ago.
        const cur = stateRef.current;
        if (cur.actions.length !== lastSyncedRef.current) {
          lastSyncedRef.current = cur.actions.length;
          onSync(cur.layer, cur.actions, cur.banked).catch(() => {});
        }
        dispatch({ type: "close" });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.windowEndsAtMs, dispatch, onSync]);

  // ── The end → submit, then the receipt ────────────────────────────────────
  const onDone = useCallback(
    (r: DigReceipt) => {
      setReceipt(r);
      const cur = stateRef.current;
      setSubmitting(true);
      onSubmit({
        actions: cur.actions,
        layer: cur.layer,
        banked: cur.banked,
        missed: cur.missed,
        things: cur.things,
      })
        .then(async (result) => {
          if (result.ok) {
            onDug?.();
            if (session.userId) {
              await clearSnoutDeepProgress(session.userId, session.windowIndex).catch(() => {});
            }
          }
        })
        .catch(() => {})
        .finally(() => setSubmitting(false));
    },
    [onSubmit, onDug, session.userId, session.windowIndex],
  );

  const join = useCallback(() => {
    onClose();
    router.push(JOIN_PATH);
  }, [onClose]);

  return (
    <>
      <SnoutDeepPatch
        state={state}
        dispatch={dispatch}
        secondsLeft={secondsLeft}
        phaseCountdown={phaseCountdown}
        onExit={onClose}
        onDone={onDone}
      />
      {receipt ? (
        <DigReceiptSheet
          visible
          receipt={receipt}
          onPrimary={onClose}
          onJoin={join}
          onClose={onClose}
        />
      ) : null}
    </>
  );
}
