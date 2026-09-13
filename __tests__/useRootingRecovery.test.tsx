import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

let mockAuthUid: string | null = "pig-a";
let mockAuthListener: (() => void) | null = null;
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
        data: { session: mockAuthUid ? { user: { id: mockAuthUid } } : null },
      })),
      onAuthStateChange: jest.fn((cb: () => void) => {
        mockAuthListener = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
  },
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
import { supabase } from "@/utils/supabase";

type Hook = ReturnType<typeof useRooting>;
const OPEN = {
  ok: true,
  already: false,
  seed: 12345,
  window_index: 1_000_060_000,
  window_ends_at: "2030-01-01T00:00:00.000Z",
  coop: false,
  blessed: false,
  crew_dug: [],
  unique_id: null,
  carry: null,
};
const RECEIPT = {
  ok: true,
  credited: ["shimmer"],
  truffles: 1,
  echo_names: [],
  echo: false,
  blessed: false,
  drain_total: 99,
  milestone: null,
  unique_found: null,
  carry_caught: null,
  carry_next: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

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

const noReceipt = () => ({
  ok: true,
  data: { ok: false, reason: "no_receipt" },
});

describe("useRooting durable recovery", () => {
  beforeEach(async () => {
    mockAuthUid = "pig-a";
    mockAuthListener = null;
    (supabase.auth.getSession as jest.Mock).mockImplementation(async () => ({
      data: { session: mockAuthUid ? { user: { id: mockAuthUid } } : null },
    }));
    mockRpcAction.mockReset();
    mockRpcOutcome.mockReset().mockResolvedValue(noReceipt());
    mockFeedingState.mockReset().mockResolvedValue(null);
    await AsyncStorage.clear();
  });

  test("commit-then-lost response becomes uncertain, then owner receipt recovers", async () => {
    mockFeedingState.mockResolvedValue({
      window_index: OPEN.window_index,
      dug: false,
      crew_dug: [],
    });
    mockRpcAction.mockImplementation(async (name: string) =>
      name === "open_rooting" ? OPEN : { ok: false, reason: "network" },
    );
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    let failed!: Awaited<ReturnType<Hook["submit"]>>;
    await act(async () => {
      failed = await probe.get().submit([], 0, []);
    });
    expect(failed).toEqual({ ok: false, reason: "uncertain" });
    expect(mockRpcAction).toHaveBeenCalledWith("submit_rooting_checked", {
      p_user_id: "pig-a",
      p_window_index: OPEN.window_index,
      p_finds: [],
      p_actions: 0,
      p_missed: [],
    });
    expect(probe.get().submissionUncertain).toBe(true);
    mockRpcOutcome.mockResolvedValue({ ok: true, data: RECEIPT });
    await act(async () => {
      await probe.get().retryPendingSubmission();
    });
    expect(probe.get().recoveredOutcome?.truffles).toBe(1);
    expect(probe.get().recoveredUserId).toBe("pig-a");
    expect(probe.get().dugThisWindow).toBe(false); // historical fixture window; server id was still adopted internally
    probe.unmount();
  });

  test("storage failure returns before submit RPC", async () => {
    mockRpcAction.mockResolvedValue(OPEN);
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("disk full"),
    );
    let result!: Awaited<ReturnType<Hook["submit"]>>;
    await act(async () => {
      result = await probe.get().submit([], 0, []);
    });
    expect(result).toEqual({ ok: false, reason: "storage_failed" });
    expect(mockRpcAction).toHaveBeenCalledTimes(1); // open only
    probe.unmount();
  });

  test("local cleanup failure cannot downgrade a confirmed server receipt", async () => {
    mockFeedingState.mockResolvedValue({
      window_index: OPEN.window_index,
      dug: false,
      crew_dug: [],
    });
    mockRpcAction.mockImplementation(async (name: string) =>
      name === "open_rooting" ? OPEN : RECEIPT,
    );
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
      new Error("disk full"),
    );
    let result: any;
    await act(async () => {
      result = await probe.get().submit([], 0, []);
    });
    expect(result).toEqual({
      ok: true,
      outcome: expect.objectContaining({ truffles: 1, credited: 1 }),
    });
    expect(probe.get().recoveredOutcome?.truffles).toBe(1);
    expect(
      await AsyncStorage.getItem("rooting_pending_submission_v1:pig-a"),
    ).not.toBeNull();
    expect(
      mockRpcAction.mock.calls.filter(
        ([name]) => name === "submit_rooting_checked",
      ),
    ).toHaveLength(1);
    probe.unmount();
  });

  test("an inconclusive receipt read keeps the durable retry uncertain", async () => {
    mockFeedingState.mockResolvedValue({
      window_index: OPEN.window_index,
      dug: false,
      crew_dug: [],
    });
    mockRpcAction.mockResolvedValue(OPEN);
    mockRpcOutcome.mockResolvedValue({ ok: false, kind: "rpc_error" });
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    let result: any;
    await act(async () => {
      result = await probe.get().submit([], 0, []);
    });
    expect(result).toEqual({ ok: false, reason: "uncertain" });
    expect(probe.get().submissionUncertain).toBe(true);
    expect(
      await AsyncStorage.getItem("rooting_pending_submission_v1:pig-a"),
    ).not.toBeNull();
    expect(mockRpcAction).not.toHaveBeenCalledWith(
      "submit_rooting_checked",
      expect.anything(),
    );
    probe.unmount();
  });

  test("a missing receipt migration fails closed without a legacy submit", async () => {
    mockRpcAction.mockResolvedValue(OPEN);
    mockRpcOutcome.mockResolvedValue({ ok: false, kind: "missing_function" });
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    let result: any;
    await act(async () => {
      result = await probe.get().submit([], 0, []);
    });
    expect(result).toEqual({ ok: false, reason: "migration_required" });
    expect(probe.get().submissionUncertain).toBe(true);
    expect(
      await AsyncStorage.getItem("rooting_pending_submission_v1:pig-a"),
    ).not.toBeNull();
    expect(
      mockRpcAction.mock.calls.filter(
        ([name]) => name === "submit_rooting_checked",
      ),
    ).toHaveLength(0);
    probe.unmount();
  });

  test("account switch during authoritative state read prevents submit", async () => {
    const readingState = deferred<{
      window_index: number;
      dug: boolean;
      crew_dug: never[];
    }>();
    mockRpcAction.mockResolvedValue(OPEN);
    mockFeedingState.mockReturnValue(readingState.promise);
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    let request!: Promise<unknown>;
    act(() => {
      request = probe.get().submit([], 0, []);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockAuthUid = "pig-b";
    readingState.resolve({
      window_index: OPEN.window_index,
      dug: false,
      crew_dug: [],
    });
    let result: any;
    await act(async () => {
      result = await request;
    });
    expect(result.reason).toBe("account_changed");
    expect(
      mockRpcAction.mock.calls.filter(
        ([name]) => name === "submit_rooting_checked",
      ),
    ).toHaveLength(0);
    probe.unmount();
  });

  test("account switch while open is in flight cannot install the old session", async () => {
    const opening = deferred<typeof OPEN>();
    mockRpcAction.mockReturnValue(opening.promise);
    const probe = await mount();
    let request!: Promise<unknown>;
    act(() => {
      request = probe.get().open();
    });
    mockAuthUid = "pig-b";
    opening.resolve(OPEN);
    let result: any;
    await act(async () => {
      result = await request;
    });
    expect(result.reason).toBe("account_changed");
    expect(probe.get().session).toBeNull();
    probe.unmount();
  });

  test("receipt remains readable after authoritative window rollover and is not resubmitted", async () => {
    mockAuthUid = "pig-rollover";
    const oldWindow = OPEN.window_index + 101;
    await AsyncStorage.setItem(
      "rooting_pending_submission_v1:pig-rollover",
      JSON.stringify({
        uid: "pig-rollover",
        windowIndex: oldWindow,
        windowEndsAtMs: 1,
        finds: [],
        actions: 0,
        missed: [],
        savedAt: "2026-09-13T00:00:00Z",
      }),
    );
    mockRpcOutcome.mockResolvedValue({ ok: true, data: RECEIPT });
    mockFeedingState.mockResolvedValue({
      window_index: oldWindow + 1,
      dug: false,
      crew_dug: [],
    });
    const probe = await mount();
    await act(async () => {
      await probe.get().recoverSubmission();
    });
    expect(mockRpcOutcome).toHaveBeenCalledWith("rooting_receipt", {
      p_window_index: oldWindow,
    });
    expect(mockRpcAction).not.toHaveBeenCalledWith(
      "submit_rooting_checked",
      expect.anything(),
    );
    probe.unmount();
  });

  test("two mounted hook instances share one actual submit", async () => {
    mockFeedingState.mockResolvedValue({
      window_index: OPEN.window_index,
      dug: false,
      crew_dug: [],
    });
    const submitted = deferred<typeof RECEIPT>();
    mockRpcAction.mockImplementation((name: string) =>
      name === "open_rooting" ? Promise.resolve(OPEN) : submitted.promise,
    );
    const home = await mount();
    const season = await mount();
    await act(async () => {
      await Promise.all([home.get().open(), season.get().open()]);
    });
    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = home.get().submit([], 0, []);
      b = season.get().submit([], 0, []);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      mockRpcAction.mock.calls.filter(
        ([name]) => name === "submit_rooting_checked",
      ),
    ).toHaveLength(1);
    submitted.resolve(RECEIPT);
    await act(async () => {
      await Promise.all([a, b]);
    });
    expect(home.get().recoveredOutcome?.truffles).toBe(1);
    expect(season.get().recoveredOutcome?.truffles).toBe(1);
    home.unmount();
    season.unmount();
  });

  test("completed open recovers receipt without creating a fresh session", async () => {
    mockRpcAction.mockResolvedValue({ ...OPEN, already: true });
    mockRpcOutcome.mockResolvedValue({ ok: true, data: RECEIPT });
    const probe = await mount();
    let result!: Awaited<ReturnType<Hook["open"]>>;
    await act(async () => {
      result = await probe.get().open();
    });
    expect(result).toEqual({ ok: false, reason: "already_rooted" });
    expect(probe.get().session).toBeNull();
    expect(probe.get().recoveredWindowIndex).toBe(OPEN.window_index);
    expect(probe.get().recoveredUserId).toBe("pig-a");
    probe.unmount();
  });

  test("account switch during receipt read discards the old result", async () => {
    mockRpcAction.mockResolvedValue({ ...OPEN, already: true });
    const reading = deferred<{ ok: true; data: typeof RECEIPT }>();
    mockRpcOutcome.mockReturnValue(reading.promise);
    const probe = await mount();
    let request!: Promise<unknown>;
    act(() => {
      request = probe.get().open();
    });
    await act(async () => {
      await Promise.resolve();
    });
    mockAuthUid = "pig-b";
    reading.resolve({ ok: true, data: RECEIPT });
    await act(async () => {
      await request;
    });
    expect(probe.get().recoveredOutcome).toBeNull();
    probe.unmount();
  });

  test("account switch while submit is in flight discards the old reward", async () => {
    mockFeedingState.mockResolvedValue({
      window_index: OPEN.window_index,
      dug: false,
      crew_dug: [],
    });
    const submitting = deferred<typeof RECEIPT>();
    mockRpcAction.mockImplementation((name: string) =>
      name === "open_rooting" ? Promise.resolve(OPEN) : submitting.promise,
    );
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    let request!: Promise<unknown>;
    act(() => {
      request = probe.get().submit([], 0, []);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockAuthUid = "pig-b";
    submitting.resolve(RECEIPT);
    let result: any;
    await act(async () => {
      result = await request;
    });
    expect(result.reason).toBe("account_changed");
    expect(probe.get().recoveredOutcome).toBeNull();
    probe.unmount();
  });

  test("an open board cannot be submitted after switching accounts", async () => {
    mockRpcAction.mockResolvedValue(OPEN);
    const probe = await mount();
    await act(async () => {
      await probe.get().open();
    });
    mockAuthUid = "pig-b";
    let result: any;
    await act(async () => {
      result = await probe.get().submit([], 0, []);
    });
    expect(result.reason).toBe("account_changed");
    expect(
      mockRpcAction.mock.calls.filter(
        ([name]) => name === "submit_rooting_checked",
      ),
    ).toHaveLength(0);
    probe.unmount();
  });

  test("expired pending without a receipt never submits into the new window", async () => {
    await AsyncStorage.setItem(
      "rooting_pending_submission_v1:pig-a",
      JSON.stringify({
        uid: "pig-a",
        windowIndex: OPEN.window_index,
        windowEndsAtMs: 1,
        finds: [],
        actions: 0,
        missed: [],
        savedAt: "2026-09-13T00:00:00Z",
      }),
    );
    mockFeedingState.mockResolvedValue({
      window_index: OPEN.window_index + 1,
      dug: false,
      crew_dug: [],
    });
    const probe = await mount();
    expect(
      mockRpcAction.mock.calls.filter(
        ([name]) => name === "submit_rooting_checked",
      ),
    ).toHaveLength(0);
    expect(probe.get().submissionUncertain).toBe(false);
    probe.unmount();
  });
});
