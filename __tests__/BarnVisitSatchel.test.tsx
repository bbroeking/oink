// The visit under the Satchel (docs/satchel-spec.md) and the host-only tickle
// rule (2026-09-14):
//
//   • the host's pig is the only tickle target; yours waves, no RPC
//   • the count chip under the host counts taps and becomes "tickled out"
//   • the two turn to face each other (PigStage facing: host left, guest right)
//   • the bag strip lifts the matching find; tapping it hands it over, the
//     tallies move by the flat tickles, the receipt names the host first
//   • a wrong find bounces without reaching the server
//   • a server without the Satchel draws no strip and no bubble
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BarnVisitModal } from "@/components/BarnVisitModal";
import { HabitatFriendRoom } from "@/components/habitat/HabitatFriendRoom";
import { rpcAction } from "@/utils/rpc";
import { showToast } from "@/components/ui";

const NEXT_AT = "2026-09-13T10:00:00.000Z";
const EXPIRES = "2030-01-01T00:00:00.000Z";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useFocusEffect: (effect: () => void | (() => void)) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a mock factory loads React after Jest hoisting
    require("react").useEffect(effect, [effect]),
}));
jest.mock("@sentry/react-native", () => ({ captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlag: () => true }));
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
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) },
}));
jest.mock("@/utils/supabase", () => ({ supabase: {
  auth: {
    getUser: jest.fn(async () => ({ data: { user: { id: "me" } } })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
  from: (table: string) => {
    const query: any = { maybeSingle: async () => ({ data: table === "profiles" ? { username: "Maple", tickles_earned: 100, active_pig_id: "rosie", is_vip: false } : null }) };
    for (const method of ["select", "eq", "returns", "is", "order", "limit"]) query[method] = () => query;
    return query;
  },
} }));

type Script = {
  satchel?: unknown;
  wishes?: unknown;
  taps?: unknown[];
  fulfil?: unknown;
};

describe("a visit with the Satchel", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const rpc = jest.mocked(rpcAction);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.useRealTimers();
  });

  const BAG = {
    ok: true,
    cap: 6,
    items: [
      { id: 1, find_id: "river_pebble" },
      { id: 2, find_id: "blue_feather" },
    ],
    met: ["river_pebble", "blue_feather"],
    wish: { find_id: "clover", wish_no: 1, expires_at: EXPIRES },
    shelf: [],
    deliveries: 0,
    keepsakes: [],
  };
  const WISH = {
    ok: true,
    wishes: [{ target_id: "friend", find_id: "blue_feather", wish_no: 3, expires_at: EXPIRES, fulfilled_by_me: false }],
  };

  const script = ({ satchel = BAG, wishes = WISH, taps = [], fulfil }: Script) => {
    let tap = 0;
    rpc.mockImplementation(async (name) => {
      if (name === "barn_visit_status") return { ok: true, visits_left: 3, visit_budget: 3 } as never;
      if (name === "my_satchel") return satchel as never;
      if (name === "friend_wishes") return wishes as never;
      if (name === "fulfil_pig_wish") return fulfil as never;
      const reply = taps[Math.min(tap, taps.length - 1)] ?? { ok: true, taps_left: 3, tap_cap: 5 };
      tap += 1;
      return reply as never;
    });
  };

  const open = async () => {
    await act(async () => {
      tree = TestRenderer.create(
        <BarnVisitModal targetUserId="friend" targetName="Maple" onClose={jest.fn()} />,
      );
    });
    return tree.root.findByType(HabitatFriendRoom);
  };
  const room = () => tree.root.findByType(HabitatFriendRoom);
  // A testID lands on the composite AND its host view; count hosts, press the
  // outermost composite (the one that owns onPress).
  const byTestID = (id: string) =>
    tree.root.findAll((n) => n.props.testID === id && typeof n.type === "string");
  const pressable = (id: string, label: string) =>
    tree.root.findAll((n) => n.props.testID === id && n.props.accessibilityLabel === label && typeof n.type !== "string")[0];
  const calls = (name: string) => rpc.mock.calls.filter(([n]) => n === name);
  const settle = () => act(() => void jest.advanceTimersByTime(600));

  it("only the host's pig tickles; yours waves without reaching the server", async () => {
    script({ taps: [{ ok: true, taps_left: 4, tap_cap: 5 }] });
    const r = await open();
    expect(r.props.hostPig.props.facing).toBe("left");
    expect(r.props.visitorPig.props.facing).toBe("right");

    await act(async () => { await r.props.visitorPig.props.onPress(); });
    expect(calls("tickle_at_barn")).toHaveLength(0);
    expect(room().props.visitorPig.props.reaction?.kind).toBe("wave");

    await act(async () => { await room().props.hostPig.props.onPress(); });
    expect(calls("tickle_at_barn")).toHaveLength(1);
    expect(room().props.hostPig.props.chip).toEqual({ kind: "count", n: 1 });
  });

  it("the chip counts taps, then becomes the tickled-out tag and taps stop reaching the server", async () => {
    script({ taps: [
      { ok: true, taps_left: 1, tap_cap: 2 },
      { ok: true, taps_left: 0, tap_cap: 2, next_at: NEXT_AT },
    ] });
    await open();
    await act(async () => { await room().props.hostPig.props.onPress(); });
    await act(async () => { await room().props.hostPig.props.onPress(); });
    settle();
    expect(room().props.hostPig.props.chip).toEqual({ kind: "spent" });
    expect(room().props.hostPig.props.spent).toBe(true);
    expect(room().props.hostPig.props.mood).toBe("tired");
    // The guest stays content — a happy mood would play front frames and
    // turn it back to the camera; the hearts are the floats.
    expect(room().props.visitorPig.props.mood).toBe("content");

    const before = calls("tickle_at_barn").length;
    await act(async () => { await room().props.hostPig.props.onPress(); });
    expect(calls("tickle_at_barn")).toHaveLength(before);
  });

  it("a refused tap takes the optimistic heart back", async () => {
    script({ taps: [{ ok: false, reason: "cooldown", next_at: NEXT_AT }] });
    await open();
    const hearts = () =>
      tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Maple's hearts"))[0]
        .props.accessibilityLabel;
    expect(hearts()).toBe("Maple's hearts, 100");
    await act(async () => { await room().props.hostPig.props.onPress(); });
    settle();
    expect(hearts()).toBe("Maple's hearts, 100");
  });

  it("lifts the matching find, hands it over, and names the host first", async () => {
    script({
      fulfil: {
        ok: true,
        find_id: "blue_feather",
        tickles: 3,
        giver_tickled: 103,
        host_tickled: 103,
        deliveries: 1,
        keepsake: null,
        next_wish: { find_id: "marble", wish_no: 4, expires_at: EXPIRES },
        bag_count: 1,
      },
    });
    await open();
    expect(byTestID("visit-satchel-strip")).toHaveLength(1);
    // The bubble rides the host pig element (the mocked room renders only the
    // overlay), so read it off the prop.
    const bubble = () => room().props.hostPig.props.bubble.props;
    expect(bubble().wish.find_id).toBe("blue_feather");
    expect(bubble().givenThisVisit).toBe(false);
    expect(byTestID("visit-find-lifted")).toHaveLength(1);
    const lifted = pressable("visit-find-lifted", "Give the blue feather");
    expect(lifted).toBeTruthy();

    await act(async () => { await lifted.props.onPress(); });
    expect(calls("fulfil_pig_wish")).toEqual([["fulfil_pig_wish", { p_host: "friend", p_item_id: 2 }]]);
    expect(byTestID("visit-delivery-sheet")).toHaveLength(1);
    const line = tree.root.findAll((n) =>
      typeof n.props.children === "string" && n.props.children.startsWith("Maple's pig got the blue feather"),
    );
    expect(line.length).toBeGreaterThan(0);
    expect(line[0].props.children).toBe(
      "Maple's pig got the blue feather it was hoping for — you both got 3 tickles.",
    );
    // Both tallies moved by the flat tickles.
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === "Maple's hearts, 103").length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === "Your hearts, 103").length,
    ).toBeGreaterThan(0);
    // The bubble shows the pig's NEXT wish as "next time"; nothing is lifted.
    expect(bubble().wish.find_id).toBe("marble");
    expect(bubble().givenThisVisit).toBe(true);
    expect(byTestID("visit-find-lifted")).toHaveLength(0);
  });

  it("a wrong find bounces without a server call", async () => {
    script({});
    await open();
    const rest = pressable("visit-find", "Try the river pebble");
    expect(rest).toBeTruthy();
    await act(async () => { await rest.props.onPress(); });
    expect(calls("fulfil_pig_wish")).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Not the river pebble") }),
    );
    expect(room().props.hostPig.props.reaction?.kind).toBe("surprise");
  });

  it("a server without the Satchel draws no strip and no bubble", async () => {
    script({ satchel: { ok: false, reason: "network" }, wishes: { ok: false, reason: "network" } });
    await open();
    expect(byTestID("visit-satchel-strip")).toHaveLength(0);
    expect(room().props.hostPig.props.bubble.props.wish).toBeNull();
  });
});
