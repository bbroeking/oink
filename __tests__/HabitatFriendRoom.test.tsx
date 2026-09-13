import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, Text, type AppStateStatus } from "react-native";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { HabitatFriendRoom } from "@/components/habitat/HabitatFriendRoom";
import { HabitatDoorTransition } from "@/components/habitat/HabitatDoorTransition";
import { fetchFriendHabitat, fetchMyHabitat } from "@/utils/habitat";
import type { HabitatSnapshot } from "@/utils/habitat";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/utils/habitat", () => ({ fetchFriendHabitat: jest.fn(), fetchMyHabitat: jest.fn() }));
jest.mock("@/hooks/useHabitatAccount", () => ({
  useHabitatAccount: () => ({ id: "visitor", loaded: true }),
}));
jest.mock("@/hooks/useHabitatJournal", () => ({
  useHabitatJournal: () => ({
    acquisitions: [],
    wishlist: [],
    newItemIds: new Set(),
    loading: false,
    error: null,
    supported: true,
    refresh: jest.fn(),
    markPresented: jest.fn(),
    markSeen: jest.fn(),
    setWishlisted: jest.fn(),
  }),
}));
jest.mock("@/utils/interactionAnalytics", () => ({
  trackInteraction: jest.fn(),
}));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));
jest.mock("@/components/habitat/HabitatScene", () => ({
  HabitatScene: (props: object) =>
    require("react").createElement("HabitatScene", props),
}));
jest.mock("@/components/habitat/HabitatInspectionSheet", () => ({
  HabitatInspectionSheet: (props: object) =>
    require("react").createElement("HabitatInspectionSheet", props),
}));
jest.mock("@/components/ui/EmptyState", () => ({ LoadingBeat: () => null }));

const snapshot: HabitatSnapshot = {
  ownerId: "friend",
  revision: 2,
  positions: {
    interior_background: {
      id: "warm_plank_barn",
      name: "Warm Plank Barn",
      description: "Warm timber",
      category: "interior_background",
      rarity: "common",
      assetKey: "warm_plank_barn",
    },
    wall: null,
    ceiling: null,
    floor_left: null,
    floor_right: null,
    floor_centerpiece: null,
    surface: null,
  },
};
const fetchRoom = jest.mocked(fetchFriendHabitat);
const fetchOwnRoom = jest.mocked(fetchMyHabitat);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("friend Interior authorization lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() });
    fetchOwnRoom.mockResolvedValue({ ok: false, reason: "not_found" });
  });
  it("renders the committed room and caller-supplied pigs without editing controls", async () => {
    fetchRoom.mockResolvedValue({ ok: true, ...snapshot });
    const unavailable = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatFriendRoom
          ownerId="friend"
          hostPig="host"
          visitorPig="visitor"
          onUnavailable={unavailable}
        />,
      );
    });
    const scene = tree.root.find((node) => node.type === HabitatScene);
    const door = tree.root.find((node) => node.type === HabitatDoorTransition);
    expect(scene.props.snapshot.revision).toBe(2);
    expect(scene.props.hostPig).toBe("host");
    expect(scene.props.visitorPig).toBe("visitor");
    expect(scene.props.editing).toBeUndefined();
    expect(scene.props.cabinet).toBeUndefined();
    expect(door.props.direction).toBe("enter");
    expect(fetchRoom).toHaveBeenCalledWith("friend");
    expect(unavailable).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
  it("centres the full-screen room and keeps an opaque ground at every alignment", async () => {
    fetchRoom.mockResolvedValue({ ok: true, ...snapshot });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={jest.fn()} />);
    });
    // The owner-sized opening is unchanged: the room centres on cream.
    expect(tree.root.find((node) => node.type === HabitatScene).props.anchor).toBe("center");
    expect(tree.root.find((node) => node.type === HabitatDoorTransition).props.ground).not.toBe("transparent");
    act(() => tree.unmount());

    await act(async () => {
      tree = TestRenderer.create(<HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={jest.fn()} anchor="bottom" />);
    });
    // Artwork alignment must never expose a different scene through the doors.
    expect(tree.root.find((node) => node.type === HabitatScene).props.anchor).toBe("bottom");
    expect(tree.root.find((node) => node.type === HabitatDoorTransition).props.ground).not.toBe("transparent");
    act(() => tree.unmount());
  });
  it("opens styled read-only details for the exact snapshot item", async () => {
    fetchRoom.mockResolvedValue({ ok: true, ...snapshot });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={jest.fn()} overlay={<Text testID="visit-controls">Visit controls</Text>} />);
    });
    const placed = snapshot.positions.interior_background!;
    await act(async () => tree.root.findByType(HabitatScene).props.onInspect(placed));
    const sheet = tree.root.findByType("HabitatInspectionSheet" as never);
    expect(sheet.props.item).toEqual(placed);
    const hiddenScene = tree.root.findByProps({ accessibilityElementsHidden: true });
    expect(hiddenScene.findByProps({ testID: "visit-controls" })).toBeTruthy();
    expect(hiddenScene.findAllByType("HabitatInspectionSheet" as never)).toHaveLength(0);
    expect(fetchOwnRoom).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll((node) => node.props.testID === "habitat-buy-button")).toHaveLength(0);
    act(() => tree.unmount());
  });
  it("maps a requested friend-room exit to the reusable closing transition", async () => {
    fetchRoom.mockResolvedValue({ ok: true, ...snapshot });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={jest.fn()} leaving onLeft={jest.fn()} />);
    });
    expect(tree.root.find((node) => node.type === HabitatDoorTransition).props.direction).toBe("exit");
    act(() => tree.unmount());
  });
  it("clears the room and exits when foreground authorization is revoked", async () => {
    let foreground: ((state: AppStateStatus) => void) | undefined;
    const listener = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, callback) => {
        foreground = callback;
        return { remove: jest.fn() };
      });
    fetchRoom
      .mockResolvedValueOnce({ ok: true, ...snapshot })
      .mockResolvedValueOnce({ ok: false, reason: "blocked" });
    const unavailable = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatFriendRoom
          ownerId="friend"
          hostPig="host"
          visitorPig="visitor"
          onUnavailable={unavailable}
        />,
      );
    });
    await act(async () => {
      foreground?.("active");
    });
    expect(
      tree.root.findAll((node) => node.type === HabitatScene),
    ).toHaveLength(0);
    expect(unavailable).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    listener.mockRestore();
  });
  it("does not display a previously read room when a new opening is refused", async () => {
    fetchRoom.mockResolvedValue({ ok: false, reason: "not_friends" });
    const unavailable = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatFriendRoom
          ownerId="friend"
          hostPig="host"
          visitorPig="visitor"
          onUnavailable={unavailable}
        />,
      );
    });
    expect(
      tree.root.findAll((node) => node.type === HabitatScene),
    ).toHaveLength(0);
    expect(unavailable).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
  it("never renders the previous owner's room while the next owner loads", async () => {
    const next = deferred<Awaited<ReturnType<typeof fetchFriendHabitat>>>();
    fetchRoom
      .mockResolvedValueOnce({ ok: true, ...snapshot })
      .mockReturnValueOnce(next.promise);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={jest.fn()} />,
      );
    });
    expect(tree.root.findByType(HabitatScene).props.snapshot.ownerId).toBe("friend");

    await act(async () => {
      tree.update(
        <HabitatFriendRoom ownerId="other-friend" hostPig="other-host" visitorPig="visitor" onUnavailable={jest.fn()} />,
      );
    });
    expect(tree.root.findAllByType(HabitatScene)).toHaveLength(0);

    next.resolve({
      ok: true,
      ...snapshot,
      ownerId: "other-friend",
      revision: 3,
    });
    await act(async () => {
      await next.promise;
    });
    expect(tree.root.findByType(HabitatScene).props.snapshot.ownerId).toBe("other-friend");
    expect(tree.root.findByType(HabitatScene).props.hostPig).toBe("other-host");
    act(() => tree.unmount());
  });
  it("ignores a late first-owner response after switching owners", async () => {
    const first = deferred<Awaited<ReturnType<typeof fetchFriendHabitat>>>();
    fetchRoom
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ok: true, ...snapshot, ownerId: "other-friend" });
    const unavailable = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={unavailable} />,
      );
    });
    await act(async () => {
      tree.update(
        <HabitatFriendRoom ownerId="other-friend" hostPig="other-host" visitorPig="visitor" onUnavailable={unavailable} />,
      );
    });
    expect(tree.root.findByType(HabitatScene).props.snapshot.ownerId).toBe("other-friend");

    first.resolve({ ok: true, ...snapshot });
    await act(async () => {
      await first.promise;
    });
    expect(tree.root.findByType(HabitatScene).props.snapshot.ownerId).toBe("other-friend");
    expect(unavailable).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
  it("rejects a successful response whose owner does not match the request", async () => {
    fetchRoom.mockResolvedValue({ ok: true, ...snapshot, ownerId: "wrong-owner" });
    const unavailable = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatFriendRoom ownerId="friend" hostPig="host" visitorPig="visitor" onUnavailable={unavailable} />,
      );
    });
    expect(tree.root.findAllByType(HabitatScene)).toHaveLength(0);
    expect(unavailable).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});
