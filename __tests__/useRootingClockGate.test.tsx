// The open gate in useRooting.open(): a server-accepted open followed by a
// failed initial feeding-clock read must NOT start a real board on an
// untrusted phone clock (hooks/useRooting.ts, "clock_unavailable"). Reopening
// once the clock syncs is safe. Ported from the server-clock release line's
// useRootingClockGate.test.tsx; the other cases there are covered elsewhere.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

let mockClockReady = true;
const mockRpcAction = jest.fn();
const mockRpcOutcome = jest.fn();
const mockFeedingState = jest.fn();

jest.mock("@/utils/rpc", () => ({
  rpcAction: (...args: unknown[]) => mockRpcAction(...args),
  rpcOutcome: (...args: unknown[]) => mockRpcOutcome(...args),
}));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: "pig-a" } } },
      })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));
jest.mock("@/utils/feedingClock", () => ({
  ...jest.requireActual("@/utils/feedingClock"),
  hasFeedingClock: () => mockClockReady,
}));
jest.mock("@/utils/dig", () => ({
  fetchFeedingState: (...args: unknown[]) => mockFeedingState(...args),
}));
jest.mock("@/utils/sounderPath", () => ({
  markFirstRealDig: jest.fn(async () => {}),
}));
jest.mock("@/utils/pushNotifications", () => ({
  cancelOpenReminder: jest.fn(async () => {}),
}));

import { useRooting } from "@/hooks/useRooting";

type Hook = ReturnType<typeof useRooting>;

const OPEN = {
  ok: true,
  already: false,
  seed: 123,
  window_index: 1_000_060_000,
  window_ends_at: "2030-01-01T00:00:00.000Z",
  coop: false,
  blessed: false,
  crew_dug: [],
  unique_id: null,
  carry: null,
};

async function mount() {
  let value!: Hook;
  function Probe() {
    value = useRooting();
    return null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Probe />);
  });
  return { get: () => value, unmount: () => act(() => tree.unmount()) };
}

describe("useRooting server-clock open gate", () => {
  beforeEach(async () => {
    mockClockReady = true;
    mockRpcAction.mockReset();
    mockRpcOutcome.mockReset().mockResolvedValue({
      ok: true,
      data: { ok: false, reason: "no_receipt" },
    });
    mockFeedingState.mockReset().mockResolvedValue(null);
    await AsyncStorage.clear();
  });

  test("keeps a successful server open retryable when the initial clock sync fails", async () => {
    mockClockReady = false;
    mockRpcAction.mockImplementation(async (name: string) =>
      name === "open_rooting" ? OPEN : { ok: false, reason: "network" },
    );
    const probe = await mount();

    let result!: Awaited<ReturnType<Hook["open"]>>;
    await act(async () => {
      result = await probe.get().open();
    });
    expect(result).toEqual({ ok: false, reason: "clock_unavailable" });
    expect(probe.get().session).toBeNull();

    mockClockReady = true;
    await act(async () => {
      result = await probe.get().open();
    });
    expect(result.ok).toBe(true);
    expect(probe.get().session).not.toBeNull();
    expect(probe.get().session?.seed).toBe(OPEN.seed);

    probe.unmount();
  });
});
