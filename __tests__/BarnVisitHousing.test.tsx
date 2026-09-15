import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BarnVisitModal } from "@/components/BarnVisitModal";
import { HabitatFriendRoom } from "@/components/habitat/HabitatFriendRoom";
import { StyleSheet } from "react-native";
import { rpc, rpcAction } from "@/utils/rpc";

// The Satchel's read RPCs answer "no such feature" here — the visit under test
// is the tickle visit, on a server without the bag.
const SATCHEL_RPCS = new Set(["my_satchel", "friend_wishes"]);
import { PigStage } from "@/components/ui/PigStage";
import { RITUAL_FX, fxWash, hasPigFx } from "@/constants/ritualFx";
import { recordPorchStop } from "@/utils/porchRound";
import { showToast } from "@/components/ui";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-router/react-navigation", () => ({
  // Keep the real module (NavigationContext, which the pig's focus hook reads)
  // and swap only the focus effect: a mounted sheet/visit is a focused one, so
  // it runs as a plain effect and `useVisitorEffects` does its one read
  // (weekday rituals phase 4).
  ...jest.requireActual("expo-router/react-navigation"),
  useFocusEffect: (effect: () => void | (() => void)) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a mock factory loads React after Jest hoisting
    require("react").useEffect(effect, [effect]),
}));

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
jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(async () => null), rpcAction: jest.fn() }));
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
      : SATCHEL_RPCS.has(name)
        ? { ok: false, reason: "network" }
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
    // The host's pig is the only tickle target; yours waves (2026-09-14).
    expect(room.props.hostPig.props.onPress).not.toBe(room.props.visitorPig.props.onPress);
    expect(rpc.mock.calls.map(([name]) => name).filter((n) => !SATCHEL_RPCS.has(n))).toEqual(["barn_visit_status"]);
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
      if (SATCHEL_RPCS.has(name)) return { ok: false, reason: "network" };
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

  it("only the host's Interior pig tickles; yours waves without reaching the server", async () => {
    await open();
    let room = tree.root.findByType(HabitatFriendRoom);
    expect(room.props.hostPig.props.onPress).not.toBe(room.props.visitorPig.props.onPress);
    await act(async () => { await room.props.hostPig.props.onPress(); });
    expect(rpc).toHaveBeenLastCalledWith("tickle_at_barn", { p_target: "friend" });
    room = tree.root.findByType(HabitatFriendRoom);
    await act(async () => { await room.props.visitorPig.props.onPress(); });
    expect(rpc.mock.calls.filter(([name]) => name === "tickle_at_barn")).toHaveLength(1);
    expect(recordPorchStop).toHaveBeenCalledTimes(1);
    // The two turn to face each other: the host left, the guest right.
    expect(room.props.hostPig.props.facing).toBe("left");
    expect(room.props.visitorPig.props.facing).toBe("right");
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

// ── Phase 4: the visitor sees the host's rituals ────────────────────────
// A curse is a message from a friend, so the caster has to be able to walk over
// and admire it. `active_effects_of` is the whole authorization; the visit folds
// whatever it returns through the same presentation the host's own Barn uses.
describe("a visit wears the host's rituals", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const action = jest.mocked(rpcAction);
  const read = jest.mocked(rpc);

  beforeEach(() => {
    jest.clearAllMocks();
    action.mockImplementation(async (name) => name === "barn_visit_status"
      ? { ok: true, visits_left: 3, visit_budget: 3 }
      : SATCHEL_RPCS.has(name)
        ? { ok: false, reason: "network" }
        : { ok: true, taps_left: 3, tap_cap: 5, visits_left: 2 });
    // It is Friday in the host's Barn: they are carrying the day's blessing AND
    // the day's curse, which the weekday pairing guarantees never collide.
    read.mockImplementation(async (name: string) =>
      name === "active_effects_of"
        ? ([
            { source: "blessing", kind: "golden_hour", expires_at: "2099-01-01T00:00:00Z" },
            { source: "curse", kind: "bacon_bits", expires_at: "2099-01-01T00:00:00Z" },
          ] as never)
        : (null as never),
    );
  });
  afterEach(() => act(() => tree?.unmount()));

  const openOutside = async () => {
    await act(async () => {
      tree = TestRenderer.create(
        <BarnVisitModal targetUserId="friend" targetName="Maple" onClose={jest.fn()} />,
      );
    });
    act(() => tree.root.findAll((n) => n.props.accessibilityLabel === "Outside")[0].props.onPress());
    act(() => tree.root.findByType(HabitatFriendRoom).props.onLeft());
  };

  it("reads the host's effects once, by id", async () => {
    await openOutside();
    const reads = read.mock.calls.filter(([name]) => name === "active_effects_of");
    expect(reads).toHaveLength(1);
    expect(reads[0][1]).toEqual({ p_target: "friend" });
  });

  it("washes the Barn amber and bacon-stripes the host's pig, both at once", async () => {
    await openOutside();

    // Golden Hour: the scene wash, drawn by the same BarnOverlay the host's own
    // Barn draws — one layer, its own zIndex, and never in the way of a tap.
    const wash = tree.root
      .findAllByProps({ testID: "barn-scene-wash" })
      .filter((n) => typeof n.type === "string");
    expect(wash).toHaveLength(1);
    expect(wash[0].props.pointerEvents).toBe("none");
    expect(StyleSheet.flatten(wash[0].props.style).backgroundColor).toBe(
      fxWash(RITUAL_FX.golden_hour.scene!.tint!, RITUAL_FX.golden_hour.scene!.alpha),
    );

    // Bacon Bits + Golden Hour reach the host's stage as ONE merged recipe:
    // the curse's skin and tint, the blessing's glow. (Neither Friday recipe
    // sets `flip`; Topsy-Turvy's channel is asserted in PigStageRitual.)
    const stages = tree.root.findAllByType(PigStage);
    expect(stages).toHaveLength(2);
    const worn = stages.map((s) => s.props.ritual).filter(Boolean);
    expect(worn).toHaveLength(1);
    expect(worn[0]).toMatchObject({
      skin: "bacon",
      tint: RITUAL_FX.bacon_bits.pig!.tint,
      glow: RITUAL_FX.golden_hour.pig!.glow,
    });
  });

  it("leaves the visitor's own pig alone", async () => {
    await openOutside();
    const room = tree.root.findAllByType(HabitatFriendRoom);
    expect(room).toHaveLength(0);
    const stages = tree.root.findAllByType(PigStage);
    // The visitor's pig is the one with no recipe: phase 4 is "admire the
    // curse you cast", not "wear it too".
    expect(stages.filter((s) => s.props.ritual === undefined)).toHaveLength(1);
  });

  it("a dark active_effects_of leaves the Barn plain instead of breaking the visit", async () => {
    read.mockImplementation(async () => null as never);
    await openOutside();
    expect(tree.root.findAllByProps({ testID: "barn-scene-wash" })).toHaveLength(0);
    // The rest presentation is an empty recipe, not a missing one — nothing on
    // either stage draws.
    expect(
      tree.root.findAllByType(PigStage).every((s) => !hasPigFx(s.props.ritual)),
    ).toBe(true);
    // ...and the visit itself is untouched.
    expect(tree.root.findByProps({ testID: "visit-exterior-background" })).toBeTruthy();
  });
});
