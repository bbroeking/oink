import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BarnVisitModal } from "@/components/BarnVisitModal";
import { HabitatFriendRoom } from "@/components/habitat/HabitatFriendRoom";
import { rpcAction } from "@/utils/rpc";
import { recordPorchStop } from "@/utils/porchRound";
import { showToast } from "@/components/ui";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
let authListener: ((event: string, session: { user: { id: string } } | null) => void) | undefined;

jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/hooks/useMotionPolicy", () => ({
  MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
  useMotionPolicy: () => ({
    reduceMotion: true,
    allowDecorativeMotion: false,
    largeTransition: "crossfade",
    duration: (_standard: number, reduced = 150) => reduced,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock("@/components/ui", () => ({
  ...jest.requireActual("@/components/ui"),
  showToast: jest.fn(),
}));
jest.mock("@/components/ui/PigStage", () => ({ PigStage: () => null }));
jest.mock("@/components/habitat/HabitatFriendRoom", () => ({ HabitatFriendRoom: ({ overlay }: { overlay?: React.ReactNode }) => overlay ?? null }));
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
jest.mock("@/utils/porchRound", () => ({ recordPorchStop: jest.fn(async () => ({ ok: true, created: false })) }));
jest.mock("@/utils/interactionAnalytics", () => ({ trackInteraction: jest.fn() }));
jest.mock("@/utils/visitEmotes", () => ({ refreshVisitEmotes: jest.fn(async () => {}), visitEmoteIds: () => [], VISIT_EMOTE_META: {}, VISIT_EMOTE_IMAGES: {} }));
jest.mock("@/utils/supabase", () => ({ supabase: {
  auth: {
    getUser: jest.fn(async () => ({ data: { user: { id: "me" } } })),
    onAuthStateChange: jest.fn((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
  },
  from: (table: string) => {
    const query: any = { maybeSingle: async () => ({ data: table === "profiles" ? { username: "Maple", tickles_earned: 100, active_pig_id: "rosie", is_vip: false } : null }) };
    for (const method of ["select", "eq", "returns", "is", "order", "limit"]) query[method] = () => query;
    return query;
  },
} }));

describe("existing Visit with a saved Barn Interior", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const rpc = jest.mocked(rpcAction);
  beforeEach(() => {
    jest.clearAllMocks();
    authListener = undefined;
    rpc.mockImplementation(async (name) => name === "barn_visit_status"
      ? { ok: true, visits_left: 3, visit_budget: 3 }
      : { ok: true, taps_left: 3, tap_cap: 5, visits_left: 2 });
  });
  afterEach(() => act(() => tree?.unmount()));
  const renderVisit = async (targetUserId = "friend", targetName = "Maple") => {
    await act(async () => { tree = TestRenderer.create(<BarnVisitModal targetUserId={targetUserId} targetName={targetName} onClose={jest.fn()} />); });
  };
  const open = async (targetUserId = "friend", targetName = "Maple") => {
    await renderVisit(targetUserId, targetName);
    return tree.root.findByType(HabitatFriendRoom);
  };

  it("keeps indoor arrival opaque while the visit loads", async () => {
    act(() => {
      tree = TestRenderer.create(<BarnVisitModal targetUserId="friend" targetName="Maple" onClose={jest.fn()} />);
    });
    expect(tree.root.findAllByProps({ testID: "visit-exterior-background" })).toHaveLength(0);
    expect(tree.root.findAllByType(HabitatFriendRoom)).toHaveLength(0);
    expect(tree.root.findByProps({ label: "knocking on the barn door" })).toBeTruthy();
    await act(async () => {});
    expect(tree.root.findByType(HabitatFriendRoom)).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "visit-exterior-background" })).toHaveLength(0);
  });

  it("shows only the active background, keeping the room through its exit", async () => {
    await open();
    expect(tree.root.findAllByProps({ testID: "visit-exterior-background" })).toHaveLength(0);
    act(() => tree.root.findAll((n) => n.props.accessibilityLabel === "Outside")[0].props.onPress());
    expect(tree.root.findByType(HabitatFriendRoom).props.leaving).toBe(true);
    expect(tree.root.findAllByProps({ testID: "visit-exterior-background" })).toHaveLength(0);
    act(() => tree.root.findByType(HabitatFriendRoom).props.onLeft());
    expect(tree.root.findAllByType(HabitatFriendRoom)).toHaveLength(0);
    expect(tree.root.findByProps({ testID: "visit-exterior-background" })).toBeTruthy();
    act(() => tree.root.findAll((n) => n.props.accessibilityLabel === "Inside")[0].props.onPress());
    expect(tree.root.findByType(HabitatFriendRoom)).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "visit-exterior-background" })).toHaveLength(0);
  });

  it("opens directly in the saved two-pig room without spending the Visit", async () => {
    const room = await open();
    expect(room.props.ownerId).toBe("friend");
    expect(room.props.hostPig).toBeTruthy();
    expect(room.props.visitorPig).toBeTruthy();
    expect(room.props.hostPig.props.onPress).toBe(room.props.visitorPig.props.onPress);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["barn_visit_status"]);
    expect(recordPorchStop).not.toHaveBeenCalled();
  });

  it("names the room for a screen reader and the header for everyone else", async () => {
    await open();
    // The stage carries the spoken identity…
    expect(
      tree.root.findByProps({ accessibilityLabel: "Visiting Maple's Barn" }),
    ).toBeTruthy();
    // …and the visible name appears exactly once, on the header plaque. The
    // INSIDE plaque that used to repeat it is deleted.
    expect(
      tree.root.findAll(
        (n) => typeof n.type === "string" && n.props.children === "Maple's Barn",
      ),
    ).toHaveLength(1);
    expect(tree.root.findAll((n) => n.props.children === "INSIDE")).toEqual([]);
  });

  it("closes and ignores an in-flight tickle after direct account replacement", async () => {
    let resolveTickle!: (value: { ok: true; taps_left: number }) => void;
    rpc.mockImplementation(async (name) => {
      if (name === "barn_visit_status")
        return { ok: true, visits_left: 3, visit_budget: 3 };
      return new Promise((resolve) => {
        resolveTickle = resolve;
      });
    });
    const close = jest.fn();
    await act(async () => {
      tree = TestRenderer.create(
        <BarnVisitModal targetUserId="friend" targetName="Maple" onClose={close} />,
      );
    });
    let tickle!: Promise<unknown>;
    act(() => {
      tickle = tree.root.findByType(HabitatFriendRoom).props.hostPig.props.onPress();
    });
    await act(async () => {
      authListener?.("SIGNED_IN", { user: { id: "replacement" } });
    });
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveTickle({ ok: true, taps_left: 2 });
      await tickle;
    });
    expect(recordPorchStop).not.toHaveBeenCalled();
  });

  it("defaults inside again when the visit reopens or changes target", async () => {
    await open();
    act(() => tree.root.findAll((n) => n.props.accessibilityLabel === "Outside")[0].props.onPress());
    expect(tree.root.findByType(HabitatFriendRoom).props.leaving).toBe(true);
    act(() => tree.root.findByType(HabitatFriendRoom).props.onLeft());
    expect(tree.root.findAllByType(HabitatFriendRoom)).toHaveLength(0);

    await act(async () => {
      tree.update(<BarnVisitModal targetUserId="other-friend" targetName="Hazel" onClose={jest.fn()} />);
    });
    expect(tree.root.findByType(HabitatFriendRoom).props.ownerId).toBe("other-friend");

    act(() => tree.unmount());
    await open();
    expect(tree.root.findByType(HabitatFriendRoom).props.ownerId).toBe("friend");
  });

  it("remounts the owner-scoped visit so actions switch to the new host", async () => {
    await open();
    const firstRoom = tree.root.findByType(HabitatFriendRoom);
    const firstTickle = firstRoom.props.hostPig.props.onPress;
    await act(async () => {
      tree.update(
        <BarnVisitModal targetUserId="other-friend" targetName="Hazel" onClose={jest.fn()} />,
      );
    });
    const nextRoom = tree.root.findByType(HabitatFriendRoom);
    expect(nextRoom.props.ownerId).toBe("other-friend");
    expect(nextRoom.props.hostPig.props.label).toBe("Maple");

    await act(async () => {
      await nextRoom.props.hostPig.props.onPress();
    });
    expect(rpc).toHaveBeenLastCalledWith("tickle_at_barn", {
      p_target: "other-friend",
    });

    // Even a retained element callback remains bound to its original owner;
    // the live tree cannot accidentally reuse it for the new host.
    expect(firstTickle).not.toBe(nextRoom.props.hostPig.props.onPress);
  });

  it("both Interior pigs retain the same tickle action", async () => {
    await open();
    let room = tree.root.findByType(HabitatFriendRoom);
    expect(room.props.hostPig.props.onPress).toBe(room.props.visitorPig.props.onPress);
    await act(async () => { await room.props.hostPig.props.onPress(); });
    expect(rpc).toHaveBeenLastCalledWith("tickle_at_barn", { p_target: "friend" });
    room = tree.root.findByType(HabitatFriendRoom);
    await act(async () => { await room.props.visitorPig.props.onPress(); });
    expect(rpc.mock.calls.filter(([name]) => name === "tickle_at_barn")).toHaveLength(2);
    expect(recordPorchStop).toHaveBeenCalledTimes(1);
  });

  it("falls back outside when the saved room is unavailable", async () => {
    await renderVisit();
    expect(tree.root.findAllByType(HabitatFriendRoom)).toHaveLength(1);
    act(() => tree.root.findByType(HabitatFriendRoom).props.onUnavailable());
    expect(tree.root.findAllByType(HabitatFriendRoom)).toHaveLength(0);
    // A refusal is a toast, not a line of text wedged under the toggle.
    expect(showToast).toHaveBeenCalledWith({
      tone: "info",
      title: "Their room isn't open right now.",
    });
    act(() => tree.root.findAll((n) => n.props.accessibilityLabel === "Inside")[0].props.onPress());
    expect(tree.root.findByType(HabitatFriendRoom).props.ownerId).toBe("friend");
  });
});
