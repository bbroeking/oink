const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }));

import { feedingNowMs } from "@/utils/feedingClock";
import { fetchFeedingState } from "@/utils/dig";
import { applyFeedingSchedule, resetFeedingScheduleForTests } from "@/utils/feedingConfig";
import { resetFeedingTimeZoneSession } from "@/utils/feedingTimeZone";
import { feedingPhaseView, windowIndex } from "@/utils/rooting";
import { isDugThisWindow, initialDigSessionState } from "@/utils/digSession";

// At 07:59 in New York the local feeding is guarded until 08:00. The phone
// incorrectly says 10:00, which must not open the dig or expire its dug flag.
const SERVER_NOW = Date.parse("2026-09-12T11:59:00Z");
const SERVER_WINDOW = 1_000_000_000 + Math.floor(Date.UTC(2026, 8, 11) / 86400000) * 3 + 2;
const STATE = {
  server_now: new Date(SERVER_NOW).toISOString(),
  window_index: SERVER_WINDOW,
  window_ends_at: "2026-09-12T12:00:00Z",
  phase_open: false,
  phase_ends_at: "2026-09-12T12:00:00Z",
  opens_at: "2026-09-12T12:00:00Z",
  feeding_time_zone: "America/New_York",
  dug: true,
  crew_dug: [],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(Date.parse("2026-09-12T14:00:00Z"));
  resetFeedingScheduleForTests();
  applyFeedingSchedule({ mode: "commuter_local", windowSecs: 28800, openSecs: 14400, offsetSecs: 7200 });
  resetFeedingTimeZoneSession("pig-a");
  mockRpc.mockReset().mockResolvedValue(STATE);
});
afterEach(() => {
  resetFeedingTimeZoneSession();
  resetFeedingScheduleForTests();
  jest.useRealTimers();
});

test("dig availability, countdown and dug status follow the user's server clock", async () => {
  await fetchFeedingState("pig-a");
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "1m" });
  expect(windowIndex()).toBe(SERVER_WINDOW);
  expect(isDugThisWindow({ ...initialDigSessionState, dugWindow: SERVER_WINDOW })).toBe(true);
});

test("a phone clock change cannot open the next feeding early", async () => {
  await fetchFeedingState("pig-a");
  jest.setSystemTime(Date.parse("2030-01-01T00:00:00Z"));
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "1m" });
  jest.advanceTimersByTime(59_999);
  expect(feedingPhaseView().open).toBe(false);
  jest.advanceTimersByTime(1);
  expect(feedingPhaseView()).toEqual({ open: true, countdown: "4h 0m" });
  expect(windowIndex()).toBe(SERVER_WINDOW + 1);
  expect(isDugThisWindow({ ...initialDigSessionState, dugWindow: SERVER_WINDOW })).toBe(false);
});

test("the server close is exclusive and an existing session retains its full window", async () => {
  mockRpc.mockResolvedValue({
    ...STATE,
    server_now: "2026-09-12T15:59:59Z",
    window_index: SERVER_WINDOW + 1,
    window_ends_at: "2026-09-12T20:00:00Z",
    phase_open: true,
    phase_ends_at: "2026-09-12T16:00:00Z",
    opens_at: "2026-09-12T20:00:00Z",
  });
  await fetchFeedingState("pig-a");
  expect(feedingPhaseView()).toEqual({ open: true, countdown: "1m" });
  jest.advanceTimersByTime(1000);
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "4h 0m" });
  expect(windowIndex()).toBe(SERVER_WINDOW + 1);
});

test("the response's schedule repairs a stale cached mode before rollover", async () => {
  resetFeedingScheduleForTests();
  mockRpc.mockResolvedValue({ ...STATE, feeding_schedule: { mode: "commuter_local" } });
  await fetchFeedingState("pig-a");
  jest.advanceTimersByTime(60_000);
  expect(windowIndex()).toBe(SERVER_WINDOW + 1);
  expect(feedingPhaseView()).toEqual({ open: true, countdown: "4h 0m" });
});

test("different accounts at the same instant use their own server timezone and phase", async () => {
  await fetchFeedingState("pig-a");
  expect(feedingPhaseView().open).toBe(false);
  resetFeedingTimeZoneSession("pig-b");
  mockRpc.mockResolvedValue({
    ...STATE,
    feeding_time_zone: "Europe/London",
    phase_open: true,
    server_now: "2026-09-12T11:59:00Z",
    window_index: SERVER_WINDOW + 1,
    window_ends_at: "2026-09-12T15:00:00Z",
    phase_ends_at: "2026-09-12T12:30:00Z",
    opens_at: "2026-09-12T15:00:00Z",
  });
  // A server boundary deliberately different from the compiled 12:00 close:
  // its returned timestamp, not a locally reconstructed span, is authoritative.
  await fetchFeedingState("pig-b");
  expect(feedingPhaseView()).toEqual({ open: true, countdown: "31m" });
});

test("a late response from an old account session cannot replace the new clock", async () => {
  let resolve!: (value: typeof STATE) => void;
  mockRpc.mockReturnValueOnce(new Promise<typeof STATE>((r) => { resolve = r; }));
  const pending = fetchFeedingState("pig-a");
  resetFeedingTimeZoneSession("pig-b");
  resetFeedingTimeZoneSession("pig-a");
  await fetchFeedingState("pig-a");
  resolve({ ...STATE, server_now: "2026-09-12T06:00:00Z" });
  await expect(pending).resolves.toBeNull();
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "1m" });
});

test("an older concurrent read cannot replace a newer clock", async () => {
  let resolve!: (value: typeof STATE) => void;
  mockRpc.mockReturnValueOnce(new Promise<typeof STATE>((r) => { resolve = r; }));
  const pending = fetchFeedingState("pig-a");
  await fetchFeedingState("pig-a");
  resolve({ ...STATE, server_now: "2026-09-12T06:00:00Z" });
  await expect(pending).resolves.toBeNull();
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "1m" });
});

test("offline refresh preserves the established clock", async () => {
  await fetchFeedingState("pig-a");
  mockRpc.mockResolvedValue(null);
  jest.advanceTimersByTime(30_000);
  await fetchFeedingState("pig-a");
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "1m" });
  jest.advanceTimersByTime(30_000);
  expect(feedingPhaseView().open).toBe(true);
});


test("the anchor accounts for network transit, excluding local persistence", async () => {
  let resolve!: (value: typeof STATE) => void;
  mockRpc.mockReturnValueOnce(new Promise<typeof STATE>((r) => { resolve = r; }));
  const pending = fetchFeedingState("pig-a");
  jest.advanceTimersByTime(200);
  resolve(STATE);
  await pending;
  expect(feedingNowMs()).toBe(SERVER_NOW + 100);
});

test.each([undefined, "invalid"])("missing/malformed server_now %s preserves the established clock", async (server_now) => {
  await fetchFeedingState("pig-a");
  mockRpc.mockResolvedValue({ ...STATE, server_now });
  await fetchFeedingState("pig-a");
  expect(feedingNowMs()).toBe(SERVER_NOW);
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "1m" });
});

test.each([
  ["2026-03-08T05:00:00Z", "2026-03-08T08:00:00Z", "2026-03-08T12:00:00Z", "3h 0m"],
  ["2026-11-01T04:00:00Z", "2026-11-01T09:00:00Z", "2026-11-01T13:00:00Z", "5h 0m"],
])("the midnight dig follows server DST boundaries at %s", async (server_now, phase_ends_at, window_ends_at, countdown) => {
  mockRpc.mockResolvedValue({ ...STATE, server_now, phase_ends_at, window_ends_at,
    opens_at: window_ends_at, phase_open: true });
  await fetchFeedingState("pig-a");
  expect(feedingPhaseView()).toEqual({ open: true, countdown });
  jest.advanceTimersByTime(Date.parse(phase_ends_at) - Date.parse(server_now));
  expect(feedingPhaseView()).toEqual({ open: false, countdown: "4h 0m" });
});

test("a newer failed read retires an older response without losing the established anchor", async () => {
  await fetchFeedingState("pig-a");
  let resolve!: (value: typeof STATE) => void;
  mockRpc.mockReturnValueOnce(new Promise<typeof STATE>((r) => { resolve = r; }));
  const pending = fetchFeedingState("pig-a");
  mockRpc.mockResolvedValueOnce(null);
  await fetchFeedingState("pig-a");
  resolve({ ...STATE, server_now: "2026-09-12T06:00:00Z" });
  await expect(pending).resolves.toBeNull();
  expect(feedingNowMs()).toBe(SERVER_NOW);
});
