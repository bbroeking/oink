import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { useFeedingClock } from "@/hooks/useFeedingClock";

let mockClockListener: (() => void) | undefined;
let mockZoneListener: (() => void) | undefined;
let mockServerOffsetMs = 0;

jest.mock("@/utils/feedingClock", () => ({
  feedingNowMs: () => Date.now() + mockServerOffsetMs,
  subscribeFeedingClock: (listener: () => void) => {
    mockClockListener = listener;
    return () => {
      if (mockClockListener === listener) mockClockListener = undefined;
    };
  },
}));
jest.mock("@/utils/feedingTimeZone", () => ({
  subscribeFeedingTimeZone: (listener: () => void) => {
    mockZoneListener = listener;
    return () => {
      if (mockZoneListener === listener) mockZoneListener = undefined;
    };
  },
}));
jest.mock("@/utils/rooting", () => ({
  patchPhaseOpen: (nowMs: number) => nowMs >= 10_000 && nowMs < 20_000,
  phaseClosesAtMs: () => 20_000,
  nextOpenAtMs: (nowMs: number) => (nowMs < 10_000 ? 10_000 : 30_000),
  feedingPhaseView: (nowMs: number) => ({
    open: nowMs >= 10_000 && nowMs < 20_000,
    countdown: String(
      (nowMs >= 10_000 && nowMs < 20_000 ? 20_000 : nowMs < 10_000 ? 10_000 : 30_000) -
        nowMs,
    ),
  }),
}));

let latest!: ReturnType<typeof useFeedingClock>;
function Probe({
  focused = true,
  reconcile,
}: {
  focused?: boolean;
  reconcile: (force?: boolean) => void;
}) {
  const value = useFeedingClock({ focused, reconcile });
  React.useEffect(() => {
    latest = value;
  }, [value]);
  return null;
}

describe("useFeedingClock", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const reconcile = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(0);
    mockServerOffsetMs = 0;
    mockClockListener = undefined;
    mockZoneListener = undefined;
    reconcile.mockReset();
    AppState.currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() } as never;
      });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function mount(focused = true) {
    act(() => {
      renderer = TestRenderer.create(
        <Probe focused={focused} reconcile={reconcile} />,
      );
    });
    reconcile.mockClear();
  }

  it("wakes on the exact open edge instead of waiting for the 15s tick", () => {
    mount();
    expect(latest.open).toBe(false);
    act(() => jest.advanceTimersByTime(9_999));
    expect(latest.open).toBe(false);
    expect(reconcile).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(latest.open).toBe(true);
    expect(reconcile).toHaveBeenCalledWith(true);
  });

  it("wakes on the exact close edge", () => {
    jest.setSystemTime(10_001);
    mount();
    expect(latest.open).toBe(true);
    act(() => jest.advanceTimersByTime(9_999));
    expect(latest.open).toBe(false);
    expect(reconcile).toHaveBeenCalledWith(true);
  });

  it("repaints immediately when a server clock anchor arrives", () => {
    mount();
    mockServerOffsetMs = 10_001;
    act(() => mockClockListener?.());
    expect(latest.open).toBe(true);
    expect(reconcile).not.toHaveBeenCalled();

    mockServerOffsetMs = 0;
    act(() => mockZoneListener?.());
    expect(latest.open).toBe(false);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("refreshes and force-reconciles on foreground", () => {
    mount();
    act(() => {
      AppState.currentState = "background";
      appStateListener?.("background");
    });
    mockServerOffsetMs = 10_001;
    act(() => {
      AppState.currentState = "active";
      appStateListener?.("active");
    });
    expect(latest.open).toBe(true);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(true);
  });

  it("reconciles when a mounted tab receives focus", () => {
    mount(false);
    mockServerOffsetMs = 10_001;
    act(() => renderer.update(<Probe focused reconcile={reconcile} />));
    expect(latest.open).toBe(true);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(true);
  });

  it("resyncs after 60s when the authoritative server clock jumps backward", () => {
    mount();
    mockServerOffsetMs = -86_400_000;
    act(() => mockClockListener?.());
    expect(reconcile).not.toHaveBeenCalled();

    for (let tick = 0; tick < 4; tick += 1) {
      act(() => jest.advanceTimersByTime(15_000));
    }
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(true);
  });

  it("keeps the periodic resync deadline across unrelated parent renders", () => {
    mockServerOffsetMs = -86_400_000;
    mount();

    for (let second = 1; second <= 60; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1_000);
        renderer.update(<Probe focused reconcile={reconcile} />);
      });
    }

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(true);
  });
});
