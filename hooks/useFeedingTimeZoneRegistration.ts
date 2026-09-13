import { useEffect } from "react";
import { AppState } from "react-native";
import {
  feedingNowMs,
  invalidateFeedingClockSnapshot,
  subscribeFeedingClock,
} from "@/utils/feedingClock";
import { fetchFeedingState } from "@/utils/dig";
import {
  hydrateFeedingTimeZone,
  pendingFeedingTimeZoneRefreshAt,
  registerDeviceFeedingTimeZone,
  resetFeedingTimeZoneSession,
} from "@/utils/feedingTimeZone";

export function useFeedingTimeZoneRegistration(userId: string | null): void {
  useEffect(() => {
    resetFeedingTimeZoneSession(userId);
    if (!userId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attemptedBoundary: number | null = null;
    let sync: () => Promise<void>;
    const schedulePendingRefresh = () => {
      if (timer) clearTimeout(timer);
      const pendingAt = pendingFeedingTimeZoneRefreshAt();
      // A pre-boundary response can arrive after its deadline. Try that
      // boundary once immediately, without spinning if the read fails.
      if (
        pendingAt == null ||
        (pendingAt <= feedingNowMs() && attemptedBoundary === pendingAt)
      ) return;
      timer = setTimeout(
        () => {
          attemptedBoundary = pendingAt;
          invalidateFeedingClockSnapshot();
          void sync();
        },
        Math.max(0, pendingAt - feedingNowMs() + 250),
      );
    };
    sync = async () => {
      if (!alive) return;
      await registerDeviceFeedingTimeZone(userId);
      // Registration may change the effective zone, or supersede a mounted
      // dig CTA's in-flight read. Always obtain its matching server clock.
      if (alive) await fetchFeedingState(userId).catch(() => null);
      if (alive) schedulePendingRefresh();
    };
    const unsubscribeClock = subscribeFeedingClock(schedulePendingRefresh);
    void hydrateFeedingTimeZone(userId).then(() => sync());
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      sub.remove();
      unsubscribeClock();
    };
  }, [userId]);
}
