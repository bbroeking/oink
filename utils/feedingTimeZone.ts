import { DIG_TIME_ZONE } from "@/constants/dig";

const CACHE_PREFIX = "feeding_time_zone_v1:";

type CivilTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
};

type TimeZoneState = {
  ok?: boolean;
  feeding_time_zone?: unknown;
  pending_feeding_time_zone?: unknown;
  pending_effective_at?: unknown;
  feeding_time_zone_changed_at?: unknown;
};

let effectiveZone = DIG_TIME_ZONE;
let activeUserId: string | null = null;
let pendingRefreshAtMs: number | null = null;
const listeners = new Set<() => void>();

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function feedingTimeZone(): string {
  return effectiveZone;
}

export function applyEffectiveFeedingTimeZone(zone: unknown): boolean {
  if (!isIanaTimeZone(zone) || zone === effectiveZone) return false;
  effectiveZone = zone;
  listeners.forEach((listener) => listener());
  return true;
}

export function subscribeFeedingTimeZone(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pendingFeedingTimeZoneRefreshAt(): number | null {
  return pendingRefreshAtMs;
}

export function resetFeedingTimeZoneSession(
  userId: string | null = null,
): void {
  activeUserId = userId;
  pendingRefreshAtMs = null;
  if (effectiveZone !== DIG_TIME_ZONE) {
    effectiveZone = DIG_TIME_ZONE;
    listeners.forEach((listener) => listener());
  }
}

function civilParts(epochMs: number, timeZone: string): CivilTime {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function zonedCivilParts(epochMs: number, timeZone: string): CivilTime {
  return civilParts(
    epochMs,
    isIanaTimeZone(timeZone) ? timeZone : DIG_TIME_ZONE,
  );
}

function civilStamp(civil: CivilTime): number {
  return Date.UTC(
    civil.year,
    civil.month - 1,
    civil.day,
    civil.hour,
    civil.minute,
    civil.second ?? 0,
  );
}

/** Convert an IANA-zone wall clock to an instant. Folds choose the later,
 * standard-time instant to match PostgreSQL `timestamp AT TIME ZONE`; gaps
 * move forward by the size of the gap. */
export function zonedCivilToEpochMs(
  civil: CivilTime,
  timeZone: string,
): number {
  const zone = isIanaTimeZone(timeZone) ? timeZone : DIG_TIME_ZONE;
  const wanted = civilStamp(civil);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = wanted + hours * 3600000;
    offsets.add(civilStamp(civilParts(sample, zone)) - sample);
  }
  const candidates = [...offsets]
    .map((offset) => wanted - offset)
    .filter((candidate) => civilStamp(civilParts(candidate, zone)) === wanted)
    .sort((a, b) => a - b);
  if (candidates.length > 0) return candidates[candidates.length - 1];

  // Missing local time: the offset before the transition preserves elapsed
  // wall time across the gap (02:30 becomes 03:30 for a one-hour spring jump).
  const before = wanted - 36 * 3600000;
  const offsetBefore = civilStamp(civilParts(before, zone)) - before;
  return wanted - offsetBefore;
}

function applyServerState(userId: string, state: TimeZoneState): boolean {
  if (activeUserId !== userId) return false;
  const pendingAt =
    typeof state.pending_effective_at === "string"
      ? new Date(state.pending_effective_at).getTime()
      : NaN;
  pendingRefreshAtMs =
    isIanaTimeZone(state.pending_feeding_time_zone) &&
    Number.isFinite(pendingAt) &&
    pendingAt > Date.now()
      ? pendingAt
      : null;
  return applyEffectiveFeedingTimeZone(state.feeding_time_zone);
}

export async function applyFeedingStateTimeZone(
  userId: string,
  state: TimeZoneState,
): Promise<boolean> {
  if (!isIanaTimeZone(state.feeding_time_zone) || activeUserId !== userId) {
    return false;
  }
  const changed = applyServerState(userId, state);
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${userId}`,
      state.feeding_time_zone,
    );
  } catch {}
  return changed;
}

export async function hydrateFeedingTimeZone(userId: string): Promise<boolean> {
  activeUserId = userId;
  effectiveZone = DIG_TIME_ZONE;
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (activeUserId !== userId) return false;
    return applyEffectiveFeedingTimeZone(cached);
  } catch {
    return false;
  }
}

export async function registerDeviceFeedingTimeZone(
  userId: string,
): Promise<boolean> {
  if (activeUserId !== userId) return false;
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!isIanaTimeZone(deviceZone)) return false;
  try {
    const { rpc } = require("@/utils/rpc") as typeof import("@/utils/rpc");
    const state = await rpc<TimeZoneState>("set_feeding_time_zone", {
      p_time_zone: deviceZone,
    });
    if (activeUserId !== userId || !state) return false;
    return await applyFeedingStateTimeZone(userId, state);
  } catch {
    // Older backends do not have the RPC yet; Eastern remains the safe clock.
    return false;
  }
}

export function resetFeedingTimeZoneForTests(): void {
  resetFeedingTimeZoneSession();
}
