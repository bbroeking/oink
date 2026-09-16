import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

let mockBlur: (() => void) | undefined;
let mockAppStateChange: (state: AppStateStatus) => void;
const mockSession = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock("expo-router/react-navigation", () => ({
  useFocusEffect: (callback: () => (() => void) | undefined) => {
    const { useEffect } = require("react");
    useEffect(() => {
      mockBlur = callback();
      return () => mockBlur?.();
    }, [callback]);
  },
}));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockSession(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));
import { useShopCatalog, type UseShopCatalog } from "@/hooks/useShopCatalog";

let catalog: UseShopCatalog;
let renderer: TestRenderer.ReactTestRenderer;
function Probe() {
  const value = useShopCatalog();
  React.useEffect(() => {
    catalog = value;
  }, [value]);
  return null;
}
async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(<Probe />);
  });
}

describe("shop request lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    AppState.currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        mockAppStateChange = listener;
        return { remove: jest.fn() };
      });
    mockSession
      .mockReset()
      .mockResolvedValue({ data: { session: { user: { id: "player" } } } });
    mockRpc.mockReset().mockImplementation((name) =>
      Promise.resolve({
        data: name === "daily_shop" ? [] : 300,
        error: null,
      }),
    );
    mockFrom.mockReset().mockImplementation((table) => {
      const result = {
        data: table === "profiles" ? { counter: 42 } : [],
        error: null,
      };
      const query = {
        select: () => query,
        eq: () => query,
        order: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
    });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("does not hammer a failed catalog, and allows an explicit retry", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await mount();
    expect(catalog.error).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      await catalog.refresh();
    });
    expect(mockSession).toHaveBeenCalledTimes(2);
  });

  it("pauses while backgrounded and refreshes when returning to the shop", async () => {
    await mount();
    act(() => mockAppStateChange("background"));
    await act(async () => {
      jest.advanceTimersByTime(600_000);
    });
    expect(catalog.resetsIn).toBe(300);
    expect(mockSession).toHaveBeenCalledTimes(1);
    await act(async () => mockAppStateChange("active"));
    expect(mockSession).toHaveBeenCalledTimes(2);
  });

  it("stops hidden-screen rollover requests", async () => {
    await mount();
    act(() => mockBlur?.());
    await act(async () => {
      jest.advanceTimersByTime(600_000);
    });
    expect(mockSession).toHaveBeenCalledTimes(1);
    expect(catalog.resetsIn).toBe(300);
  });

  it("coalesces concurrent refreshes without duplicating the catalog fan-out", async () => {
    let resolveSession!: (result: unknown) => void;
    mockSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    await mount();
    await act(async () => {
      await Promise.all([catalog.refresh(), catalog.refresh()]);
    });
    expect(mockSession).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolveSession({ data: { session: { user: { id: "player" } } } }),
    );
    // daily_shop + shop_resets_in_seconds + sounder_counter_buys — one
    // fan-out, three RPC legs (the counter leg rides the rpc() helper, which
    // reaches the same mocked client).
    expect(mockRpc).toHaveBeenCalledTimes(3);
    expect(catalog.counter).toBe(42);
    expect(catalog.counterBuys).toEqual([]);
  });

  it("keeps a pass-track members piece off the members' shelf, even when owned", async () => {
    // The season-1 premium track carries nine members-only cosmetics with
    // catalog prices (20260727), all pass_exclusive. `allItems` keeps an
    // owned one so the Closet can show it; the shelf must not (the
    // storefront, 2026-09-16: a pass reward is the pass's, never for sale).
    const hat = (id: string, extra: Record<string, unknown>) => ({
      id,
      name: id,
      cost: 4200,
      display_order: 1,
      emoji: null,
      image_path: null,
      category: "hat",
      rarity: "epic",
      members_only: true,
      pass_exclusive: false,
      ...extra,
    });
    mockFrom.mockImplementation((table) => {
      const result = {
        data:
          table === "profiles"
            ? { counter: 42 }
            : table === "hats"
              ? [
                  hat("sovereign_jewel_crown", { pass_exclusive: true }),
                  hat("ermine_coronet", { pass_exclusive: true }),
                  hat("royal_velvet_bow", {}),
                ]
              : table === "user_hats"
                ? [{ hat_id: "sovereign_jewel_crown" }]
                : [],
        error: null,
      };
      const query = {
        select: () => query,
        eq: () => query,
        order: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
    });
    await mount();
    // The owned pass reward stays in the catalog (the Closet's), but the
    // shelf and the buy gate only carry the for-sale piece.
    expect(catalog.allItems.map((i) => i.id)).toEqual([
      "sovereign_jewel_crown",
      "royal_velvet_bow",
    ]);
    expect(catalog.membersShelf.map((i) => i.id)).toEqual(["royal_velvet_bow"]);
    expect(catalog.buyableIds.has("royal_velvet_bow")).toBe(true);
    expect(catalog.buyableIds.has("sovereign_jewel_crown")).toBe(false);
    expect(catalog.buyableIds.has("ermine_coronet")).toBe(false);
  });

  it("recovers from a thrown transport error without remaining stuck loading", async () => {
    mockSession.mockRejectedValueOnce(new Error("connection closed"));
    await mount();
    expect(catalog.loading).toBe(false);
    expect(catalog.error).toBeTruthy();
    await act(async () => {
      await catalog.refresh();
    });
    expect(catalog.error).toBeNull();
    expect(catalog.counter).toBe(42);
  });
});
