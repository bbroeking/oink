import React, { useLayoutEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHabitat, type HabitatBackend } from "@/hooks/useHabitat";
import {
  HABITAT_CATALOG,
  HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import type { HabitatOwnerData, HabitatSnapshot } from "@/utils/habitat";

jest.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, [cb]),
}));

const byId = Object.fromEntries(HABITAT_CATALOG.map((i) => [i.id, i]));
const makeSnapshot = (revision = 1): HabitatSnapshot => ({
  ownerId: "a",
  revision,
  positions: Object.fromEntries(
    Object.entries(HABITAT_STARTER_POSITIONS).map(([p, id]) => [
      p,
      id ? byId[id] : null,
    ]),
  ) as HabitatSnapshot["positions"],
});
const makeData = (revision = 1): HabitatOwnerData => ({
  snapshot: makeSnapshot(revision),
  owned: [...HABITAT_CATALOG.filter((i) => !i.isForSale), byId.hay_bale],
  catalog: [...HABITAT_CATALOG],
  currentSnouts: 500,
});
const backend = (overrides: Partial<HabitatBackend> = {}): HabitatBackend => ({
  fetch: jest.fn(async () => ({
    ok: true as const,
    ...makeData(),
  })) as jest.MockedFunction<HabitatBackend["fetch"]>,
  claim: jest.fn(async () => ({
    ok: true as const,
    ...makeData(),
  })) as jest.MockedFunction<HabitatBackend["claim"]>,
  save: jest.fn(async (input) => ({
    ok: true as const,
    snapshot: { ...makeSnapshot(input.expectedRevision + 1) },
    replayed: false,
  })) as jest.MockedFunction<HabitatBackend["save"]>,
  buy: jest.fn(async (itemId, _requestId) => ({
    ok: true as const,
    item: byId[itemId],
    receipt: { snoutCost: 50, balanceAfterPurchase: 450 },
    currentSnouts: 450,
    newlyOwned: true,
    replayed: false,
  })) as jest.MockedFunction<HabitatBackend["buy"]>,
  ...overrides,
});
let current: ReturnType<typeof useHabitat>;
const probes: Record<string, ReturnType<typeof useHabitat>> = {};
function Probe({ id, api }: { id: string | null; api: HabitatBackend }) {
  const value = useHabitat(id, api);
  useLayoutEffect(() => {
    current = value;
  });
  return null;
}
function NamedProbe({ name, api }: { name: string; api: HabitatBackend }) {
  const value = useHabitat("a", api);
  useLayoutEffect(() => {
    probes[name] = value;
  });
  return null;
}
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("useHabitat durable recovery", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });
  it("adopts a preset activation over a clean persisted draft without reporting a conflict", async () => {
    const api = backend();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<Probe id="a" api={api} />); });
    await settle();
    expect(current.dirty).toBe(false);
    const activated = { ...makeData(2), snapshot: { ...makeSnapshot(2), positions: { ...makeSnapshot(2).positions, floor_right: byId.hay_bale } } };
    jest.mocked(api.fetch).mockResolvedValue({ ok: true, ...activated });
    await act(async () => { await current.refresh(); });
    expect(current.conflict).toBeNull();
    expect(current.data?.snapshot.revision).toBe(2);
    expect(current.preview?.positions.floor_right?.id).toBe("hay_bale");
    expect(current.dirty).toBe(false);
    await act(async () => { tree.unmount(); });
  });

  it("still preserves a real unsaved draft when a preset changes the confirmed room", async () => {
    const api = backend();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<Probe id="a" api={api} />); });
    await settle();
    await act(async () => { current.place("floor_right", byId.hay_bale); });
    await settle();
    jest.mocked(api.fetch).mockResolvedValue({ ok: true, ...makeData(2) });
    await act(async () => { await current.refresh(); });
    expect(current.conflict?.preservedDraft.positions.floor_right).toBe("hay_bale");
    expect(current.conflict?.latest.revision).toBe(2);
    await act(async () => { tree.unmount(); });
  });

  it("retries a lost save with the identical request after remount and blocks overwrite", async () => {
    const first = backend({
      save: jest.fn(async () => ({ ok: false as const, reason: "network" })),
    });
    let tree = TestRenderer.create(<Probe id="a" api={first} />);
    await settle();
    await act(async () => {
      current.place("floor_right", byId.hay_bale);
    });
    await act(async () => {
      const result = await current.save();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("network");
    });
    const pending = JSON.parse(
      (await AsyncStorage.getItem("habitat:v1:a:pending"))!,
    );
    expect(pending.input.requestId).toBeTruthy();
    await act(async () => {
      const result = await current.buy(byId.pressed_clover_frame);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("pending_command");
    });
    expect(first.buy).not.toHaveBeenCalled();
    tree.unmount();
    const saved = {
      ...makeSnapshot(2),
      positions: {
        ...makeSnapshot(2).positions,
        floor_left: null,
        floor_right: byId.hay_bale,
      },
    };
    const second = backend({
      fetch: jest
        .fn()
        .mockResolvedValueOnce({ ok: true as const, ...makeData(1) })
        .mockResolvedValueOnce({
          ok: true as const,
          ...makeData(2),
          snapshot: saved,
        }),
      save: jest.fn(async (input) => ({
        ok: true as const,
        snapshot: saved,
        replayed: true,
      })),
    });
    tree = TestRenderer.create(<Probe id="a" api={second} />);
    await settle();
    expect(second.save).toHaveBeenCalledWith(pending.input);
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).toBeNull();
    expect(current.conflict).toBeNull();
    tree.unmount();
  });
  it("retries a lost purchase with the same item and request id", async () => {
    const first = backend({
      buy: jest.fn(async () => ({ ok: false as const, reason: "network" })),
    });
    let tree = TestRenderer.create(<Probe id="a" api={first} />);
    await settle();
    await act(async () => {
      await current.buy(byId.pressed_clover_frame);
    });
    const pending = JSON.parse(
      (await AsyncStorage.getItem("habitat:v1:a:pending"))!,
    );
    tree.unmount();
    const second = backend();
    tree = TestRenderer.create(<Probe id="a" api={second} />);
    await settle();
    expect(second.buy).toHaveBeenCalledWith(pending.itemId, pending.requestId);
    tree.unmount();
  });
  it("turns a persisted draft from an older base revision into a conflict", async () => {
    await AsyncStorage.setItem(
      "habitat:v1:a:draft",
      JSON.stringify({
        positions: { ...HABITAT_STARTER_POSITIONS, floor_right: "hay_bale" },
        history: [],
        baseRevision: 1,
      }),
    );
    const api = backend({
      fetch: jest.fn(async () => ({ ok: true as const, ...makeData(2) })),
    });
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.conflict?.latest.revision).toBe(2);
    expect(current.conflict?.preservedDraft.positions.floor_right).toBe(
      "hay_bale",
    );
    tree.unmount();
  });
  it("restores a same-revision draft after a Shop-style remount", async () => {
    const api = backend();
    let tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    await act(async () => current.place("floor_right", byId.hay_bale));
    await settle();
    tree.unmount();
    tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.draft?.positions.floor_right).toBe("hay_bale");
    expect(current.dirty).toBe(true);
    tree.unmount();
  });
  it("ignores corrupt drafts and never replays malformed pending commands", async () => {
    await AsyncStorage.setItem(
      "habitat:v1:a:draft",
      JSON.stringify({
        positions: { ...HABITAT_STARTER_POSITIONS, floor_right: "hay_bale" },
        baseRevision: 1,
      }),
    );
    await AsyncStorage.setItem(
      "habitat:v1:a:pending",
      JSON.stringify({
        kind: "save",
        accountId: "a",
        input: {
          expectedRevision: 1,
          requestId: "kept-id",
          positions: { floor_right: "hay_bale" },
        },
      }),
    );
    const api = backend();
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.draft).toEqual({
      positions: HABITAT_STARTER_POSITIONS,
      history: [],
      baseRevision: 1,
    });
    expect(api.save).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).toBeNull();
    await act(async () => current.undo());
    tree.unmount();
  });
  it("does not send after persistence fails and releases the mutex for retry", async () => {
    const api = backend();
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    await act(async () => current.place("floor_right", byId.hay_bale));
    const set = jest.mocked(AsyncStorage.setItem);
    set.mockRejectedValueOnce(new Error("disk"));
    await act(async () => {
      const result = await current.save();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("storage");
    });
    expect(api.save).not.toHaveBeenCalled();
    await act(async () => {
      await current.save();
    });
    expect(api.save).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
  it("never sends an old account command after switching during storage", async () => {
    const api = backend();
    let tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    await act(async () => current.place("floor_right", byId.hay_bale));
    const realSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let release!: () => void;
    jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) =>
      key === "habitat:v1:a:pending"
        ? new Promise<void>((resolve) => {
            release = () => {
              void realSet(key, value).then(resolve);
            };
          })
        : realSet(key, value),
    );
    let pending!: Promise<unknown>;
    act(() => {
      pending = current.save();
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(release).toBeDefined();
    act(() => {
      tree.update(<Probe id="b" api={api} />);
    });
    await act(async () => {
      release();
      await pending;
    });
    expect(api.save).not.toHaveBeenCalled();
    tree.unmount();
    jest.mocked(AsyncStorage.setItem).mockImplementation(realSet);
  });
  it("serializes commands across two mounted hooks for the same account", async () => {
    let finish!: (value: {
      ok: true;
      snapshot: HabitatSnapshot;
      replayed: false;
    }) => void;
    const api = backend({
      save: jest.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const tree = TestRenderer.create(
      <>
        <NamedProbe name="interior" api={api} />
        <NamedProbe name="collection" api={api} />
      </>,
    );
    await settle();
    await act(async () => {
      probes.interior.place("floor_right", byId.hay_bale);
      probes.collection.place("floor_right", byId.hay_bale);
    });
    let first!: Promise<unknown>;
    act(() => {
      first = probes.interior.save();
    });
    await new Promise((r) => setTimeout(r, 10));
    await act(async () => {
      const blocked = await probes.collection.buy(byId.pressed_clover_frame);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toBe("pending_command");
    });
    expect(api.buy).not.toHaveBeenCalled();
    finish({ ok: true, snapshot: makeSnapshot(2), replayed: false });
    await act(async () => {
      await first;
    });
    tree.unmount();
  });
  it("recovers a purchase from cache even when both receipt refreshes fail", async () => {
    await AsyncStorage.setItem(
      "habitat:v1:a:confirmed",
      JSON.stringify(makeData()),
    );
    await AsyncStorage.setItem(
      "habitat:v1:a:pending",
      JSON.stringify({
        kind: "buy",
        accountId: "a",
        itemId: "pressed_clover_frame",
        requestId: "receipt-id",
      }),
    );
    const api = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "network" })),
    });
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(api.buy).toHaveBeenCalledWith("pressed_clover_frame", "receipt-id");
    expect(
      current.data?.owned.some((item) => item.id === "pressed_clover_frame"),
    ).toBe(true);
    expect(current.data?.currentSnouts).toBe(450);
    const cached = JSON.parse(
      (await AsyncStorage.getItem("habitat:v1:a:confirmed"))!,
    );
    expect(
      cached.owned.some(
        (item: { id: string }) => item.id === "pressed_clover_frame",
      ),
    ).toBe(true);
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).toBeNull();
    tree.unmount();
  });
  it("replays but retains a pending save when no owner data can be reconciled", async () => {
    const input = {
      expectedRevision: 1,
      requestId: "save-receipt-id",
      positions: { ...HABITAT_STARTER_POSITIONS, floor_right: "hay_bale" },
    };
    await AsyncStorage.setItem(
      "habitat:v1:a:pending",
      JSON.stringify({ kind: "save", accountId: "a", input }),
    );
    const api = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "network" })),
      save: jest.fn(async () => ({
        ok: true as const,
        snapshot: makeSnapshot(2),
        replayed: true,
      })),
    });
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(api.save).toHaveBeenCalledWith(input);
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).not.toBeNull();
    tree.unmount();
  });
  it("persists an acknowledged recovered save before failed refresh and offline remount", async () => {
    const saved = {
      ...makeSnapshot(2),
      positions: {
        ...makeSnapshot(2).positions,
        floor_left: null,
        floor_right: byId.hay_bale,
      },
    };
    const input = {
      expectedRevision: 1,
      requestId: "durable-save-id",
      positions: {
        ...HABITAT_STARTER_POSITIONS,
        floor_left: null,
        floor_right: "hay_bale",
      },
    };
    await AsyncStorage.setItem(
      "habitat:v1:a:confirmed",
      JSON.stringify(makeData(1)),
    );
    await AsyncStorage.setItem(
      "habitat:v1:a:pending",
      JSON.stringify({ kind: "save", accountId: "a", input }),
    );
    const recovering = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "network" })),
      save: jest.fn(async () => ({
        ok: true as const,
        snapshot: saved,
        replayed: true,
      })),
    });
    let tree = TestRenderer.create(<Probe id="a" api={recovering} />);
    await settle();
    expect(current.data?.snapshot.revision).toBe(2);
    expect(current.data?.snapshot.positions.floor_right?.id).toBe("hay_bale");
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).toBeNull();
    tree.unmount();
    const offline = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "network" })),
    });
    tree = TestRenderer.create(<Probe id="a" api={offline} />);
    await settle();
    expect(current.data?.snapshot.revision).toBe(2);
    expect(current.data?.snapshot.positions.floor_right?.id).toBe("hay_bale");
    expect(offline.save).not.toHaveBeenCalled();
    tree.unmount();
  });
  it("prefers equal-revision fresh owner data with earned save grants", async () => {
    const cached = makeData(1);
    cached.owned = cached.owned.filter(
      (item) => !["apple_basket", "firefly_lantern"].includes(item.id),
    );
    await AsyncStorage.setItem(
      "habitat:v1:a:confirmed",
      JSON.stringify(cached),
    );
    await AsyncStorage.setItem(
      "habitat:v1:a:pending",
      JSON.stringify({
        kind: "save",
        accountId: "a",
        input: {
          expectedRevision: 1,
          requestId: "earned-grant-save",
          positions: { ...HABITAT_STARTER_POSITIONS, floor_right: "hay_bale" },
        },
      }),
    );
    const fresh = makeData(2);
    const api = backend({
      save: jest.fn(async () => ({
        ok: true as const,
        snapshot: makeSnapshot(2),
        replayed: true,
      })),
      fetch: jest.fn(async () => ({ ok: true as const, ...fresh })),
    });
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.data?.snapshot.revision).toBe(2);
    expect(current.data?.owned.some((item) => item.id === "apple_basket")).toBe(
      true,
    );
    expect(
      current.data?.owned.some((item) => item.id === "firefly_lantern"),
    ).toBe(true);
    tree.unmount();
  });
  it("keeps a normal acknowledged save through failed read and offline remount", async () => {
    const api = backend({
      fetch: jest
        .fn()
        .mockResolvedValueOnce({ ok: true as const, ...makeData(1) })
        .mockResolvedValue({ ok: false as const, reason: "network" }),
    });
    let tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    await act(async () => current.place("floor_right", byId.hay_bale));
    await act(async () => {
      await current.save();
    });
    expect(current.data?.snapshot.revision).toBe(2);
    tree.unmount();
    const offline = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "network" })),
    });
    tree = TestRenderer.create(<Probe id="a" api={offline} />);
    await settle();
    expect(current.data?.snapshot.revision).toBe(2);
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).toBeNull();
    tree.unmount();
  });
  it("keeps a normal acknowledged purchase in the offline owner cache", async () => {
    const api = backend();
    let tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    await act(async () => {
      await current.buy(byId.pressed_clover_frame);
    });
    tree.unmount();
    const offline = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "network" })),
    });
    tree = TestRenderer.create(<Probe id="a" api={offline} />);
    await settle();
    expect(
      current.data?.owned.some((item) => item.id === "pressed_clover_frame"),
    ).toBe(true);
    expect(current.data?.currentSnouts).toBe(450);
    expect(await AsyncStorage.getItem("habitat:v1:a:pending")).toBeNull();
    tree.unmount();
  });
  it("does not publish a completed fetch after the account changes", async () => {
    let resolveA!: (value: {
      ok: true;
      snapshot: HabitatSnapshot;
      owned: HabitatOwnerData["owned"];
      catalog: HabitatOwnerData["catalog"];
      currentSnouts: number;
    }) => void;
    const dataB = makeData();
    dataB.snapshot = { ...dataB.snapshot, ownerId: "b", revision: 1 };
    const api = backend({
      fetch: jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveA = resolve;
            }),
        )
        .mockResolvedValue({ ok: true as const, ...dataB }),
    });
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    act(() => tree.update(<Probe id="b" api={api} />));
    await settle();
    await act(async () => resolveA({ ok: true, ...makeData(20) }));
    await settle();
    expect(current.data?.snapshot.ownerId).toBe("b");
    tree.unmount();
  });
  it("shows starter welcome once after a successful first claim", async () => {
    const api = backend({
      fetch: jest
        .fn()
        .mockResolvedValueOnce({ ok: false as const, reason: "not_found" })
        .mockResolvedValue({ ok: true as const, ...makeData() }),
    });
    let tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.starterWelcomePending).toBe(true);
    await act(async () => current.dismissStarterWelcome());
    expect(
      await AsyncStorage.getItem("habitat:v1:a:starter-welcome-seen"),
    ).toBe("1");
    tree.unmount();
    tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.starterWelcomePending).toBe(false);
    tree.unmount();
  });
  it("introduces a room provisioned at login or by a friend without replacing its layout", async () => {
    const prepared = makeData(7);
    prepared.snapshot.positions.floor_left = byId.hay_bale;
    const api = backend({
      fetch: jest.fn(async () => ({ ok: true as const, ...prepared })),
    });
    let tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(api.claim).not.toHaveBeenCalled();
    expect(current.starterWelcomePending).toBe(true);
    expect(current.preview?.positions.floor_left?.id).toBe("hay_bale");
    expect(current.data?.snapshot.revision).toBe(7);
    await act(async () => current.dismissStarterWelcome());
    tree.unmount();
    tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(current.starterWelcomePending).toBe(false);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.claim).not.toHaveBeenCalled();
    tree.unmount();
  });
  it("does not claim or show starter welcome for an indeterminate no-data read", async () => {
    const api = backend({
      fetch: jest.fn(async () => ({ ok: false as const, reason: "no_data" })),
    });
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(api.claim).not.toHaveBeenCalled();
    expect(current.starterWelcomePending).toBe(false);
    tree.unmount();
  });
  it("restores starter welcome intent after an interrupted successful claim", async () => {
    await AsyncStorage.setItem("habitat:v1:a:starter-welcome-pending", "1");
    const api = backend();
    const tree = TestRenderer.create(<Probe id="a" api={api} />);
    await settle();
    expect(api.claim).not.toHaveBeenCalled();
    expect(current.starterWelcomePending).toBe(true);
    tree.unmount();
  });
});
