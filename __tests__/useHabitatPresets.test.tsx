import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useHabitatPresets } from "@/hooks/useHabitatPresets";
const HABITAT_STARTER_POSITIONS = {
  interior_background: "whitewash_room",
  wall: null,
  ceiling: null,
  floor_left: null,
  floor_right: null,
  floor_centerpiece: null,
  surface: null,
} as const;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("useHabitatPresets", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("persists an uncertain save and replays its request id after remount", async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      presets: [],
      activeSlot: null,
    });
    const save = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: "network" })
      .mockResolvedValueOnce({
        ok: true,
        preset: {
          slot: 1,
          name: "Cozy",
          positions: HABITAT_STARTER_POSITIONS,
          revision: 1,
        },
        replayed: true,
      });
    const backend = { fetch, save, activate: jest.fn() } as any;
    let hook: ReturnType<typeof useHabitatPresets> | null = null;
    const Probe = () => {
      hook = useHabitatPresets("account-a", backend);
      return null;
    };
    let tree = TestRenderer.create(<Probe />);
    await flush();
    await act(async () => {
      await hook!.save(1, "Cozy", HABITAT_STARTER_POSITIONS);
    });
    const firstRequestId = save.mock.calls[0][0].requestId;
    act(() => tree.unmount());
    tree = TestRenderer.create(<Probe />);
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].requestId).toBe(firstRequestId);
    expect(await AsyncStorage.getItem("habitat:v1:account-a:preset-pending")).toBeNull();
    act(() => tree.unmount());
  });

  it("does not silently retry activation with a stale live-room revision", async () => {
    const preset = {
      slot: 1 as const,
      name: "Cozy",
      positions: HABITAT_STARTER_POSITIONS,
      revision: 4,
    };
    const backend = {
      fetch: jest.fn().mockResolvedValue({ ok: true, presets: [preset], activeSlot: null }),
      save: jest.fn(),
      activate: jest.fn().mockResolvedValue({ ok: false, reason: "revision_conflict" }),
    } as any;
    let hook: ReturnType<typeof useHabitatPresets> | null = null;
    const Probe = () => {
      hook = useHabitatPresets("account-a", backend);
      return null;
    };
    const tree = TestRenderer.create(<Probe />);
    await flush();
    await act(async () => {
      await hook!.activate(1, 8);
    });
    await act(async () => {
      await hook!.retryConflict();
    });
    expect(backend.activate).toHaveBeenCalledTimes(1);
    expect(backend.activate.mock.calls[0][0]).toMatchObject({
      slot: 1,
      expectedRevision: 8,
      expectedPresetRevision: 4,
    });
    expect(hook!.error).toContain("review the current room");
    act(() => tree.unmount());
  });

  it("retries a preset-only activation conflict with the reviewed preset revision", async () => {
    const oldPreset = {
      slot: 1 as const,
      name: "Cozy",
      positions: HABITAT_STARTER_POSITIONS,
      revision: 4,
    };
    const newPreset = { ...oldPreset, revision: 5 };
    const backend = {
      fetch: jest
        .fn()
        .mockResolvedValueOnce({ ok: true, presets: [oldPreset], activeSlot: null })
        .mockResolvedValue({ ok: true, presets: [newPreset], activeSlot: null }),
      save: jest.fn(),
      activate: jest
        .fn()
        .mockResolvedValueOnce({ ok: false, reason: "preset_revision_conflict" })
        .mockResolvedValueOnce({ ok: true, snapshot: { ownerId: "account-a", revision: 9, positions: HABITAT_STARTER_POSITIONS }, replayed: false }),
    } as any;
    let hook: ReturnType<typeof useHabitatPresets> | null = null;
    const Probe = () => {
      hook = useHabitatPresets("account-a", backend);
      return null;
    };
    const tree = TestRenderer.create(<Probe />);
    await flush();
    await act(async () => { await hook!.activate(1, 8); });
    await act(async () => { await hook!.retryConflict(); });
    expect(backend.activate).toHaveBeenCalledTimes(2);
    expect(backend.activate.mock.calls[1][0]).toMatchObject({
      expectedRevision: 8,
      expectedPresetRevision: 5,
    });
    expect(backend.activate.mock.calls[1][0].requestId).not.toBe(
      backend.activate.mock.calls[0][0].requestId,
    );
    act(() => tree.unmount());
  });

  it("allows only one request while a mutation is pending", async () => {
    let resolve!: (value: unknown) => void;
    const save = jest.fn().mockImplementation(
      () => new Promise((done) => { resolve = done; }),
    );
    const backend = {
      fetch: jest.fn().mockResolvedValue({ ok: true, presets: [], activeSlot: null }),
      save,
      activate: jest.fn(),
    } as any;
    let hook: ReturnType<typeof useHabitatPresets> | null = null;
    const Probe = () => {
      hook = useHabitatPresets("account-a", backend);
      return null;
    };
    const tree = TestRenderer.create(<Probe />);
    await flush();
    let first!: Promise<unknown>;
    act(() => {
      first = hook!.save(1, "One", HABITAT_STARTER_POSITIONS);
      void hook!.save(2, "Two", HABITAT_STARTER_POSITIONS);
    });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ ok: false, reason: "network" });
      await first;
    });
    act(() => tree.unmount());
  });
});
