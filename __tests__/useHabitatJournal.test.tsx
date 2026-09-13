import React, { useLayoutEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useHabitatJournal,
  type HabitatJournalBackend,
} from "@/hooks/useHabitatJournal";

jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) =>
    require("react").useEffect(callback, [callback]),
}));

const acquisition = {
  id: "a".repeat(64),
  itemId: "wallow_keepsake_bronze",
  source: "habitat_prestige",
  grantedAt: "2026-09-10T12:00:00.000Z",
  newlyOwned: true,
  seen: false,
  presented: false,
};
const backend = (
  overrides: Partial<HabitatJournalBackend> = {},
): HabitatJournalBackend => ({
  fetch: jest.fn(async () => ({
    ok: true as const,
    acquisitions: [acquisition],
    wishlist: [],
  })),
  acknowledge: jest.fn(async (ids) => ({
    ok: true as const,
    updated: ids.length,
  })),
  wishlist: jest.fn(async (itemId, saved) => ({
    ok: true as const,
    wishlist: saved ? [itemId] : [],
  })),
  ...overrides,
});

let current: ReturnType<typeof useHabitatJournal>;
function Probe({ id, api }: { id: string | null; api: HabitatJournalBackend }) {
  const value = useHabitatJournal(id, api);
  useLayoutEffect(() => {
    current = value;
  });
  return null;
}
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("useHabitatJournal", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("keeps presented and seen durable locally while a network flush is hung", async () => {
    const id = "hung-network-account";
    await AsyncStorage.setItem(
      `habitat:journal:v1:${id}:ack`,
      JSON.stringify({ presented: [acquisition.id], seen: [] }),
    );
    const never = new Promise<never>(() => {});
    const api = backend({ acknowledge: jest.fn(() => never) });
    const tree = TestRenderer.create(<Probe id={id} api={api} />);
    await settle();

    expect(current.acquisitions[0].presented).toBe(true);
    let saved = false;
    await act(async () => {
      saved = await current.markSeen([acquisition.id]);
    });
    expect(saved).toBe(true);
    expect(current.acquisitions[0]).toMatchObject({
      presented: true,
      seen: true,
    });
    expect(
      JSON.parse((await AsyncStorage.getItem(`habitat:journal:v1:${id}:ack`))!),
    ).toEqual({ presented: [acquisition.id], seen: [acquisition.id] });
    act(() => tree.unmount());
  });

  it("does not let an older account fetch overwrite the current account", async () => {
    const oldFetch = deferred<{
      ok: true;
      acquisitions: (typeof acquisition)[];
      wishlist: string[];
    }>();
    const oldApi = backend({ fetch: jest.fn(() => oldFetch.promise) });
    const newEntry = {
      ...acquisition,
      id: "b".repeat(64),
      itemId: "tiny_radio",
    };
    const newApi = backend({
      fetch: jest.fn(async () => ({
        ok: true as const,
        acquisitions: [newEntry],
        wishlist: ["tiny_radio"],
      })),
    });
    const tree = TestRenderer.create(<Probe id="old" api={oldApi} />);
    await act(async () => {
      tree.update(<Probe id="new" api={newApi} />);
    });
    await settle();
    expect(current.wishlist).toEqual(["tiny_radio"]);

    await act(async () => {
      oldFetch.resolve({
        ok: true,
        acquisitions: [acquisition],
        wishlist: ["old"],
      });
      await oldFetch.promise;
    });
    expect(current.wishlist).toEqual(["tiny_radio"]);
    expect(current.acquisitions[0].id).toBe(newEntry.id);
    act(() => tree.unmount());
  });

  it("deduplicates repeated local acknowledgments without clearing the other kind", async () => {
    const api = backend({
      acknowledge: jest.fn(async () => ({
        ok: false as const,
        reason: "network",
      })),
    });
    const tree = TestRenderer.create(<Probe id="double-ack" api={api} />);
    await settle();
    await act(async () => {
      await Promise.all([
        current.markPresented([acquisition.id, acquisition.id]),
        current.markPresented([acquisition.id]),
      ]);
      await current.markSeen([acquisition.id]);
    });
    expect(
      JSON.parse(
        (await AsyncStorage.getItem("habitat:journal:v1:double-ack:ack"))!,
      ),
    ).toEqual({ presented: [acquisition.id], seen: [acquisition.id] });
    expect(current.newItemIds.has(acquisition.itemId)).toBe(false);
    act(() => tree.unmount());
  });

  it("replays large offline acknowledgment sets within the RPC limit", async () => {
    const id = "large-offline-account";
    const pendingIds = Array.from(
      { length: 205 },
      (_, index) => `receipt-${index}`,
    );
    await AsyncStorage.setItem(
      `habitat:journal:v1:${id}:ack`,
      JSON.stringify({ presented: [], seen: pendingIds }),
    );
    const acknowledge = jest.fn(async (ids) => ({
      ok: true as const,
      updated: ids.length,
    }));
    const tree = TestRenderer.create(
      <Probe id={id} api={backend({ acknowledge })} />,
    );
    await settle();
    await settle();

    expect(acknowledge.mock.calls.map(([ids]) => ids.length)).toEqual([
      100, 100, 5,
    ]);
    expect(
      JSON.parse((await AsyncStorage.getItem(`habitat:journal:v1:${id}:ack`))!),
    ).toEqual({ presented: [], seen: [] });
    act(() => tree.unmount());
  });

  it("does not let an A-to-B-to-A stale flush clear the old account queue", async () => {
    const id = "cycled-account";
    const pendingIds = Array.from(
      { length: 150 },
      (_, index) => `cycled-receipt-${index}`,
    );
    await AsyncStorage.setItem(
      `habitat:journal:v1:${id}:ack`,
      JSON.stringify({ presented: pendingIds, seen: [] }),
    );
    const oldRequest = deferred<{ ok: true; updated: number }>();
    const newRequest = deferred<{ ok: true; updated: number }>();
    const acknowledge = jest
      .fn()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => newRequest.promise);
    const api = backend({ acknowledge });
    const tree = TestRenderer.create(<Probe id={id} api={api} />);
    await settle();
    expect(acknowledge).toHaveBeenCalledTimes(1);

    act(() => tree.update(<Probe id="other-account" api={api} />));
    await settle();
    act(() => tree.update(<Probe id={id} api={api} />));
    await settle();
    expect(acknowledge).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldRequest.resolve({ ok: true, updated: 100 });
      await oldRequest.promise;
    });
    expect(
      JSON.parse((await AsyncStorage.getItem(`habitat:journal:v1:${id}:ack`))!),
    ).toEqual({ presented: pendingIds, seen: [] });
    act(() => tree.unmount());
  });
});
