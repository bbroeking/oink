import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { feedingNowMs, subscribeFeedingClock } from "@/utils/feedingClock";
import { subscribeFeedingTimeZone } from "@/utils/feedingTimeZone";
import {
  feedingPhaseView,
  nextOpenAtMs,
  patchPhaseOpen,
  phaseClosesAtMs,
  type FeedingPhaseView,
} from "@/utils/rooting";

const DISPLAY_TICK_MS = 15_000;
const SERVER_RESYNC_MS = 60_000;
type Reconcile = (force?: boolean) => void | Promise<void>;

/** Keep Feeding UI on the server-anchored clock while its screen is visible. */
export function useFeedingClock({
  focused,
  reconcile,
}: {
  focused: boolean;
  reconcile: Reconcile;
}): FeedingPhaseView & { refresh: () => void } {
  const [revision, setRevision] = useState(0);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState ?? "active",
  );
  const phaseRef = useRef(patchPhaseOpen(feedingNowMs()));
  // Server time can jump in either direction when the first authoritative
  // anchor arrives. Measure polling cadence on the runtime's monotonic clock.
  const lastResyncRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    phaseRef.current = patchPhaseOpen(feedingNowMs());
    setRevision((revision) => revision + 1);
  }, []);

  // Installing a feeding_state snapshot or changing timezone only repaints.
  // That avoids an install -> reconcile -> install subscription loop.
  useEffect(() => {
    const unsubscribeClock = subscribeFeedingClock(refresh);
    const unsubscribeZone = subscribeFeedingTimeZone(refresh);
    return () => {
      unsubscribeClock();
      unsubscribeZone();
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState !== "active" || !focused) return;
      lastResyncRef.current = performance.now();
      refresh();
      void reconcile(true);
    });
    return () => subscription.remove();
  }, [focused, reconcile, refresh]);

  // Focus is a natural heal point for tabs which remain mounted.
  useEffect(() => {
    if (
      !focused ||
      (AppState.currentState != null && AppState.currentState !== "active")
    )
      return;
    lastResyncRef.current = performance.now();
    void reconcile(true);
  }, [focused, reconcile, refresh]);

  useEffect(() => {
    if (!focused || appState !== "active") return;
    const nowMs = feedingNowMs();
    const open = patchPhaseOpen(nowMs);
    phaseRef.current = open;
    const boundaryMs = open ? phaseClosesAtMs(nowMs) : nextOpenAtMs(nowMs);
    const delayMs = Math.max(1, Math.min(DISPLAY_TICK_MS, boundaryMs - nowMs));
    const timer = setTimeout(() => {
      const tickNowMs = feedingNowMs();
      const nextOpen = patchPhaseOpen(tickNowMs);
      const crossedBoundary = nextOpen !== phaseRef.current;
      const lastResyncAt = lastResyncRef.current;
      phaseRef.current = nextOpen;
      setRevision((revision) => revision + 1);
      if (
        crossedBoundary ||
        lastResyncAt == null ||
        performance.now() - lastResyncAt >= SERVER_RESYNC_MS
      ) {
        lastResyncRef.current = performance.now();
        void reconcile(true);
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [revision, focused, appState, reconcile]);

  // Derive from the current clock during render. A schedule/anchor repaint can
  // therefore never commit a stale phase captured by an earlier timer.
  return { ...feedingPhaseView(feedingNowMs()), refresh };
}
