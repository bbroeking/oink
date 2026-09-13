// The end of a visit: the server stops taking taps, the toast says so once, and
// the bottom pill becomes the way out.
//
// The shapes mocked here are the ones `tickle_at_barn` really returns
// (supabase/migrations/20260738700000_barn_tap_xp_nerf.sql, wrapped by
// 20260779000000_prestige_curve_and_visit_window.sql):
//
//   cap not yet hit → { ok: true,  taps_left: n>0, tap_cap, next_at, … }
//   cap-hitting tap → { ok: true,  taps_left: 0,   tap_cap, next_at, … }
//   one tap later   → { ok: false, error: "cooldown", next_at }   ← NOT "tired"
//
// The third shape is the one the screen used to get wrong: it is spelled
// exactly like the arrival lock, so a refused tap opened the nap card instead of
// tiring the visit out.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BarnVisitModal } from "@/components/BarnVisitModal";
import { HabitatFriendRoom } from "@/components/habitat/HabitatFriendRoom";
import { rpcAction } from "@/utils/rpc";
import { showToast } from "@/components/ui";

const TIRED_TOAST = {
  tone: "info",
  title: "All tickled out — head home when you're ready.",
};
const NEXT_AT = "2026-09-13T10:00:00.000Z";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
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
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
jest.mock("@/utils/porchRound", () => ({ recordPorchStop: jest.fn(async () => ({ ok: true, created: false })) }));
jest.mock("@/utils/interactionAnalytics", () => ({ trackInteraction: jest.fn() }));
jest.mock("@/utils/visitEmotes", () => ({ refreshVisitEmotes: jest.fn(async () => {}), visitEmoteIds: () => [], VISIT_EMOTE_META: {}, VISIT_EMOTE_IMAGES: {} }));
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

describe("tickling a barn out", () => {
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

  /** The status probe + a scripted sequence of tickle_at_barn replies. */
  const script = (...replies: unknown[]) => {
    let tap = 0;
    rpc.mockImplementation(async (name) => {
      if (name === "barn_visit_status")
        return { ok: true, visits_left: 3, visit_budget: 3 } as never;
      const reply = replies[Math.min(tap, replies.length - 1)];
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

  const tap = async () => {
    await act(async () => {
      await tree.root.findByType(HabitatFriendRoom).props.hostPig.props.onPress();
    });
  };

  /** Drain the 520ms beat the cap-hitting tap schedules tireOut on. */
  const settle = () => act(() => void jest.advanceTimersByTime(600));

  const pill = (testID: string) =>
    tree.root.findAll((node) => node.props.testID === testID);

  it("flips the pill to Head home and toasts once when the cap is hit", async () => {
    script(
      { ok: true, taps_left: 1, tap_cap: 2 },
      { ok: true, taps_left: 0, tap_cap: 2, next_at: NEXT_AT },
    );
    await open();

    await tap();
    // Mid-visit: nothing has tired out, so the slot stays quiet.
    expect(pill("visit-head-home")).toEqual([]);
    expect(showToast).not.toHaveBeenCalledWith(TIRED_TOAST);

    await tap();
    settle();
    expect(showToast).toHaveBeenCalledWith(TIRED_TOAST);
    // Tickled out: the slot offers the way out.
    expect(pill("visit-head-home").length).toBeGreaterThan(0);
    // Tiring out is a toast, never the nap card — that is for arriving at a
    // barn that is already asleep.
    expect(
      tree.root.findAll((n) => n.props.children === "This barn is napping"),
    ).toEqual([]);
  });

  it("a refused tap neither tickles nor re-toasts", async () => {
    script(
      { ok: true, taps_left: 0, tap_cap: 1, next_at: NEXT_AT },
      { ok: false, reason: "cooldown", next_at: NEXT_AT },
    );
    await open();

    await tap();
    settle();
    expect(showToast).toHaveBeenCalledTimes(1);
    const spent = rpc.mock.calls.filter(([name]) => name === "tickle_at_barn").length;

    // Tapping a tired pig does not even reach the server…
    await tap();
    expect(
      rpc.mock.calls.filter(([name]) => name === "tickle_at_barn"),
    ).toHaveLength(spent);
    // …and says the same thing once, not twice.
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(pill("visit-head-home").length).toBeGreaterThan(0);
  });

  it("reads the server's bare `cooldown` refusal as the spent visit, not a napping barn", async () => {
    // The cap-hitting tap's `next_at` normally stops the next tap client-side,
    // so this is the path a server that refuses WITHOUT having said taps_left:0
    // takes. `cooldown` is the same word the arrival lock uses; only the fact
    // that this session has already tickled tells them apart.
    script(
      { ok: true, taps_left: 3, tap_cap: 4 },
      { ok: false, reason: "cooldown", next_at: NEXT_AT },
    );
    await open();

    await tap();
    await tap();
    settle();
    expect(showToast).toHaveBeenCalledWith(TIRED_TOAST);
    expect(pill("visit-head-home").length).toBeGreaterThan(0);
    expect(
      tree.root.findAll((n) => n.props.children === "This barn is napping"),
    ).toEqual([]);
  });

  it("still opens the nap card when the FIRST tap of a visit is refused", async () => {
    // Nothing has been tickled, so `cooldown` means what it has always meant:
    // the barn was shut when we knocked.
    script({ ok: false, reason: "cooldown", next_at: NEXT_AT });
    await open();

    await tap();
    settle();
    expect(showToast).not.toHaveBeenCalledWith(TIRED_TOAST);
    expect(
      tree.root.findAll((n) => n.props.children === "This barn is napping").length,
    ).toBeGreaterThan(0);
  });
});
