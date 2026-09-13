// A session-scoped server clock for digging. Wall-clock changes on the phone
// cannot move an established feeding; elapsed time uses the monotonic clock.
// Never persist this anchor: it must be re-established after a process restart.
export interface FeedingClockPayload {
  server_now?: string;
  window_index?: number;
  window_ends_at?: string;
  phase_open?: boolean;
  phase_ends_at?: string;
  opens_at?: string;
}

interface FeedingClockSnapshot {
  nowMs: number;
  windowIndex: number;
  windowEndsAtMs: number;
  phaseOpen: boolean;
  phaseEndsAtMs: number;
  opensAtMs: number;
}

let userId: string | null = null;
let generation = 0;
let requestId = 0;
let latestRequest = -Infinity;
let anchor: { serverMs: number; monotonicMs: number } | null = null;
let snapshot: FeedingClockSnapshot | null = null;
const listeners = new Set<() => void>();

/** Real digs require an anchor; offline/cold display math remains a fallback. */
export function hasFeedingClock(): boolean {
  return anchor !== null;
}

export function feedingNowMs(): number {
  return anchor
    ? anchor.serverMs + Math.max(0, performance.now() - anchor.monotonicMs)
    : Date.now();
}

export function subscribeFeedingClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetFeedingClockSession(nextUserId: string | null): void {
  userId = nextUserId;
  generation += 1;
  latestRequest = -Infinity;
  anchor = null;
  snapshot = null;
  listeners.forEach((listener) => listener());
}

// Capture before issuing the RPC, so a response from a previous account
// session (including A -> B -> A) cannot replace the active player's clock.
export function feedingClockRequest(owner: string | null = userId) {
  const id = owner === userId ? ++requestId : -Infinity;
  if (owner === userId) latestRequest = id;
  return { generation, id, startedAt: performance.now() };
}

export function isCurrentFeedingClockRequest(
  owner: string,
  request: ReturnType<typeof feedingClockRequest>,
): boolean {
  return (
    owner === userId &&
    request.generation === generation &&
    request.id >= latestRequest
  );
}

export function invalidateFeedingClockSnapshot(): void {
  snapshot = null;
}

export function applyFeedingClock(
  owner: string,
  state: FeedingClockPayload,
  request: ReturnType<typeof feedingClockRequest>,
): boolean {
  if (!isCurrentFeedingClockRequest(owner, request)) return false;
  const serverMs = Date.parse(state.server_now ?? "");
  const windowEndsAtMs = Date.parse(state.window_ends_at ?? "");
  const phaseEndsAtMs = Date.parse(state.phase_ends_at ?? "");
  const opensAtMs = Date.parse(state.opens_at ?? "");
  const windowIndex = state.window_index;
  if (
    !Number.isFinite(serverMs) ||
    !Number.isFinite(windowEndsAtMs) ||
    !Number.isFinite(phaseEndsAtMs) ||
    !Number.isFinite(opensAtMs) ||
    typeof windowIndex !== "number" ||
    !Number.isSafeInteger(windowIndex) ||
    typeof state.phase_open !== "boolean" ||
    windowEndsAtMs <= serverMs ||
    phaseEndsAtMs <= serverMs ||
    phaseEndsAtMs > windowEndsAtMs ||
    opensAtMs !== windowEndsAtMs
  ) return false;
  const receivedAt = performance.now();
  // Estimate the return transit time from half the round trip. The next
  // foreground/boundary read corrects network jitter; the RPC still gates play.
  anchor = {
    serverMs: serverMs + Math.max(0, receivedAt - request.startedAt) / 2,
    monotonicMs: receivedAt,
  };
  latestRequest = request.id;
  snapshot = {
    nowMs: serverMs,
    windowIndex,
    windowEndsAtMs,
    phaseOpen: state.phase_open,
    phaseEndsAtMs,
    opensAtMs,
  };
  listeners.forEach((listener) => listener());
  return true;
}

/** The RPC's actual boundaries override a stale cached schedule until rollover.
 * After rollover the schedule mirror projects server time until the next read. */
export function feedingClockSnapshot(nowMs: number): FeedingClockSnapshot | null {
  return snapshot && nowMs >= snapshot.nowMs && nowMs < snapshot.windowEndsAtMs
    ? snapshot
    : null;
}
