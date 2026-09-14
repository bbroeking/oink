import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearPendingDig,
  clearPendingDigIfMatches,
  clearSnoutDeepProgress,
  loadDigProgress,
  loadPendingDig,
  loadSnoutDeepProgress,
  saveDigProgress,
  savePendingDig,
  saveSnoutDeepProgress,
  shareSubmissionAttempt,
} from "../utils/digSubmission";

beforeEach(async () => AsyncStorage.clear());

describe("durable dig submission", () => {
  const pending = {
    uid: "pig-a",
    windowIndex: 1_000_061_999,
    windowEndsAtMs: 2_000_000_000_000,
    finds: ["truffle_l"],
    actions: 12,
    missed: ["unique"],
    savedAt: "2026-09-13T00:00:00.000Z",
  };

  test("persists the exact sanitized payload until authoritative settlement", async () => {
    await savePendingDig(pending);
    await expect(loadPendingDig("pig-a")).resolves.toEqual(pending);
    await clearPendingDig("pig-a");
    await expect(loadPendingDig("pig-a")).resolves.toBeNull();
  });

  test("pending submissions cannot leak across accounts", async () => {
    await savePendingDig(pending);
    await expect(loadPendingDig("pig-b")).resolves.toBeNull();
    await expect(loadPendingDig("pig-a")).resolves.toEqual(pending);
  });

  test("stale cleanup cannot delete a newer pending submission", async () => {
    await savePendingDig(pending);
    const newer = {
      ...pending,
      savedAt: "2026-09-13T00:01:00.000Z",
      actions: 13,
    };
    await savePendingDig(newer);
    await expect(clearPendingDigIfMatches(pending)).resolves.toBe(false);
    await expect(loadPendingDig("pig-a")).resolves.toEqual(newer);
  });

  test("a newer save queued during matching cleanup survives", async () => {
    await savePendingDig(pending);
    const newer = {
      ...pending,
      savedAt: "2026-09-13T00:02:00.000Z",
      actions: 14,
    };
    let releaseRead!: (raw: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          releaseRead = resolve;
        }),
    );
    const clearing = clearPendingDigIfMatches(pending);
    await new Promise((resolve) => setImmediate(resolve));
    const saving = savePendingDig(newer);
    releaseRead(JSON.stringify(pending));
    await expect(clearing).resolves.toBe(true);
    await saving;
    await expect(loadPendingDig("pig-a")).resolves.toEqual(newer);
  });

  test("mounted tabs share one in-flight submission per account/window", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = jest.fn(async () => {
      await held;
      return "receipt";
    });
    const first = shareSubmissionAttempt("pig-a", pending.windowIndex, run);
    const second = shareSubmissionAttempt("pig-a", pending.windowIndex, run);
    expect(first).toBe(second);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toBe("receipt");
  });

  test("rejects malformed persisted payloads", async () => {
    await AsyncStorage.setItem(
      "rooting_pending_submission_v1:pig-a",
      JSON.stringify({ ...pending, actions: "twelve" }),
    );
    await expect(loadPendingDig("pig-a")).resolves.toBeNull();
  });

  test("logical progress restores only for the same account, window and seed", async () => {
    const progress = {
      uid: "pig-a",
      windowIndex: pending.windowIndex,
      seed: 42,
      layers: Array.from({ length: 30 }, (_, i) => (i < 2 ? 3 - i : 0)),
      collected: ["shimmer"],
      actions: 4,
      dugOrder: [2, 4, 8],
      streak: 2,
      freeNext: true,
      savedAt: pending.savedAt,
    };
    await saveDigProgress(progress);
    await expect(
      loadDigProgress("pig-a", pending.windowIndex, 42),
    ).resolves.toEqual(progress);
    await expect(
      loadDigProgress("pig-b", pending.windowIndex, 42),
    ).resolves.toBeNull();
    await expect(
      loadDigProgress("pig-a", pending.windowIndex + 1, 42),
    ).resolves.toBeNull();
    await expect(
      loadDigProgress("pig-a", pending.windowIndex, 43),
    ).resolves.toBeNull();
  });

  test("rejects progress with the wrong board size or unsafe action state", async () => {
    const key = `rooting_progress_v1:pig-a:${pending.windowIndex}`;
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        uid: "pig-a",
        windowIndex: pending.windowIndex,
        seed: 42,
        layers: [1, 2],
        collected: [],
        actions: 26,
        dugOrder: [30],
        streak: -1,
        freeNext: false,
        savedAt: pending.savedAt,
      }),
    );
    await expect(
      loadDigProgress("pig-a", pending.windowIndex, 42),
    ).resolves.toBeNull();
  });
});

// ── Snout Deep (20260913060000) ──────────────────────────────────────────────
describe("Snout Deep pending payload + progress snapshot", () => {
  const deep = {
    uid: "pig-a",
    windowIndex: 1_000_061_999,
    windowEndsAtMs: 2_000_000_000_000,
    finds: ["l0:truffle_d"],
    actions: 3,
    missed: ["l1:truffle_l"],
    savedAt: "2026-09-13T00:00:00.000Z",
    deep: { actions: ["s0:0", "r0:1", "h1:4"], layer: 1, things: ["l0:boom"] },
  };

  test("a deep payload round-trips with its log", async () => {
    await savePendingDig(deep);
    await expect(loadPendingDig("pig-a")).resolves.toEqual(deep);
  });

  test("rejects a deep payload whose log breaks the server contract", async () => {
    const bad = [
      { ...deep.deep, actions: ["x0:0"] },
      { ...deep.deep, actions: ["s0:30"] },
      { ...deep.deep, layer: 3 },
      { ...deep.deep, actions: new Array(46).fill("s0:0") },
      { ...deep.deep, things: [1] },
    ];
    for (const d of bad) {
      await AsyncStorage.setItem(
        "rooting_pending_submission_v1:pig-a",
        JSON.stringify({ ...deep, deep: d }),
      );
      await expect(loadPendingDig("pig-a")).resolves.toBeNull();
    }
  });

  test("the { layer, actions } snapshot restores only for the same account, window and seed", async () => {
    const snap = {
      uid: "pig-a",
      windowIndex: 42,
      seed: 20260913,
      layer: 1,
      actions: ["s0:0", "r0:1"],
      finds: ["l0:truffle_d"],
      savedAt: "2026-09-13T00:00:00.000Z",
    };
    await saveSnoutDeepProgress(snap);
    await expect(loadSnoutDeepProgress("pig-a", 42, 20260913)).resolves.toEqual(snap);
    await expect(loadSnoutDeepProgress("pig-b", 42, 20260913)).resolves.toBeNull();
    await expect(loadSnoutDeepProgress("pig-a", 43, 20260913)).resolves.toBeNull();
    await expect(loadSnoutDeepProgress("pig-a", 42, 1)).resolves.toBeNull();
    await clearSnoutDeepProgress("pig-a", 42);
    await expect(loadSnoutDeepProgress("pig-a", 42, 20260913)).resolves.toBeNull();
  });
});
