import { useEffect } from "react";
import { AppState } from "react-native";
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
    let sync: () => Promise<void>;
    const schedulePendingRefresh = () => {
      if (timer) clearTimeout(timer);
      const pendingAt = pendingFeedingTimeZoneRefreshAt();
      // A failed boundary read keeps the old cached timestamp. Do not turn
      // that into a zero-delay retry loop while offline; foreground retries.
      if (pendingAt == null || pendingAt <= Date.now()) return;
      timer = setTimeout(
        () => void sync(),
        Math.max(0, pendingAt - Date.now() + 250),
      );
    };
    sync = async () => {
      if (!alive) return;
      await registerDeviceFeedingTimeZone(userId);
      if (alive) schedulePendingRefresh();
    };
    void hydrateFeedingTimeZone(userId).then(() => sync());
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [userId]);
}
