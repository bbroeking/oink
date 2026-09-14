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
//   · the end → the tally sheet at once, from the client's tickle table
//     (the server's dig_finds when open_rooting named it), then
//     useRooting.submitDeep; the server's receipt corrects the per-find
//     tickles and the count before / after when it lands — the sheet's
//     roll-up re-aims, it never restarts.
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
  reconcileReceipt,
  reduce,
  replay,
  resolveDigFindTickles,
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
  /** Show the how-it-works sheet as the dig opens (the player's first Snout Deep dig). */
  helpOnMount?: boolean;
  /** The player closed that sheet — stamp it seen for this account. */
  onHelpSeen?: () => void;
  /** The player's tickle count as the dig opened (the Barn's stamp), for the
   *  tally's before → now; null when the caller can't know it. */
  tickledBefore?: number | null;
}

export function SnoutDeepDig({
  session,
  onSubmit,
  onSync,
  onClose,
  onDug,
  onBusyChange,
  phaseCountdown,
  helpOnMount,
  onHelpSeen,
  tickledBefore = null,
}: SnoutDeepDigProps) {
  const board = useMemo(
    () => generateLayeredBoard(session.seed, session.uniqueId),
    [session.seed, session.uniqueId],
  );
  const opts = useMemo(
    () => ({ coop: session.coop, uncrewed: session.uncrewed ?? false }),
    [session.coop, session.uncrewed],
  );
  // The find tickle table: the server's (open_rooting's dig_finds) over the
  // compiled fallback — what the tally counts with until the receipt lands.
  const tickles = useMemo(() => resolveDigFindTickles(session.digFinds), [session.digFinds]);
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
          // A snapshot saved before the server opened this row belongs to
          // an earlier row (the dig was reset) — the server's log wins.
          const stale =
            saved != null &&
            session.openedAtMs != null &&
            Date.parse(saved.savedAt) < session.openedAtMs;
          if (saved && !stale) snapshot = saved;
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
      // The loose pouch (2026-09-14): `banked` is what the tie swept in
      // (truffles + consumables), `missed` the carry truffles and every
      // consumable lost on a wake, `things` the kept collection pieces.
      onSubmit({
        actions: cur.actions,
        layer: cur.layer,
        banked: cur.banked,
        missed: cur.missed,
        things: cur.things,
      })
        .then(async (result) => {
          if (result.ok) {
            // The server's tally corrects the client's: per-find tickles by
            // id, the total, the count before / after.
            const o = result.outcome;
            setReceipt((cur) =>
              cur
                ? reconcileReceipt(cur, {
                    tickles: o.tickles,
                    ticklesTotal: o.ticklesTotal,
                    tickledBefore: o.tickledBefore,
                    tickledNow: o.tickledNow,
                    satchel: o.satchel ?? null,
                  })
                : cur,
            );
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
        helpOnMount={helpOnMount}
        onHelpSeen={onHelpSeen}
        onExit={onClose}
        onDone={onDone}
        tickles={tickles}
        tickledBefore={tickledBefore}
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
