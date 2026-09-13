import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { applyFeedingClock, feedingClockRequest, resetFeedingClockSession } from "@/utils/feedingClock";
import { AppState } from "react-native";
import { useFeedingTimeZoneRegistration } from "@/hooks/useFeedingTimeZoneRegistration";
jest.mock("@/utils/dig", () => ({ fetchFeedingState: jest.fn(async () => null) }));
import {
  hydrateFeedingTimeZone,
  pendingFeedingTimeZoneRefreshAt,
  registerDeviceFeedingTimeZone,
  resetFeedingTimeZoneSession,
} from "@/utils/feedingTimeZone";

jest.mock("@/utils/feedingTimeZone", () => ({
  hydrateFeedingTimeZone: jest.fn(() => Promise.resolve(false)),
  pendingFeedingTimeZoneRefreshAt: jest.fn(() => null),
  registerDeviceFeedingTimeZone: jest.fn(() => Promise.resolve(false)),
  resetFeedingTimeZoneSession: jest.fn(),
}));

const hydrate = hydrateFeedingTimeZone as jest.MockedFunction<
  typeof hydrateFeedingTimeZone
>;
const pendingAt = pendingFeedingTimeZoneRefreshAt as jest.MockedFunction<
  typeof pendingFeedingTimeZoneRefreshAt
>;
const register = registerDeviceFeedingTimeZone as jest.MockedFunction<
  typeof registerDeviceFeedingTimeZone
>;
const reset = resetFeedingTimeZoneSession as jest.MockedFunction<
  typeof resetFeedingTimeZoneSession
>;

function Probe({ userId }: { userId: string | null }) {
  useFeedingTimeZoneRegistration(userId);
  return null;
}

describe("useFeedingTimeZoneRegistration", () => {
  let appStateListener: ((state: string) => void) | null;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-12T12:00:00Z"));
    appStateListener = null;
    remove.mockReset();
    hydrate.mockReset().mockResolvedValue(false);
    pendingAt.mockReset().mockReturnValue(null);
    register.mockReset().mockResolvedValue(false);
    reset.mockReset();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener as (state: string) => void;
        return { remove } as never;
      });
  });

  afterEach(() => {
    resetFeedingClockSession(null);
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("a response arriving after its pending boundary triggers one immediate refresh", async () => {
    pendingAt.mockReturnValue(Date.now() - 1);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<Probe userId="pig-a" />); });
    expect(register).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(register).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(register).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });

  test("server clock sync reschedules a pending timezone boundary on a slow phone", async () => {
    const serverNow = Date.now() + 2 * 3600_000;
    pendingAt.mockReturnValue(serverNow + 60_000);
    resetFeedingClockSession("pig-a");
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<Probe userId="pig-a" />); });
    expect(register).toHaveBeenCalledTimes(1);
    act(() => {
      applyFeedingClock("pig-a", {
        server_now: new Date(serverNow).toISOString(),
        window_index: 123,
        phase_open: false,
        phase_ends_at: new Date(serverNow + 3600_000).toISOString(),
        window_ends_at: new Date(serverNow + 3600_000).toISOString(),
        opens_at: new Date(serverNow + 3600_000).toISOString(),
      }, feedingClockRequest());
    });
    await act(async () => { jest.advanceTimersByTime(60_250); });
    expect(register).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });

  test("a pending zone discovered on foreground refreshes once at its boundary", async () => {
    const boundary = Date.now() + 60_000;
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<Probe userId="pig-a" />);
    });
    expect(reset).toHaveBeenCalledWith("pig-a");
    expect(hydrate).toHaveBeenCalledWith("pig-a");
    expect(register).toHaveBeenCalledTimes(1);

    pendingAt.mockReturnValue(boundary);
    await act(async () => appStateListener?.("active"));
    expect(register).toHaveBeenCalledTimes(2);

    // The boundary RPC fails/returns no state, leaving the now-past pending
    // timestamp cached. The hook must make this one attempt and stop.
    register.mockResolvedValueOnce(false);
    await act(async () => {
      jest.advanceTimersByTime(60_250);
      await Promise.resolve();
    });
    expect(register).toHaveBeenCalledTimes(3);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(register).toHaveBeenCalledTimes(3);

    act(() => tree.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
