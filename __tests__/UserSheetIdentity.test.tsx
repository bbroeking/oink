/* eslint-disable @typescript-eslint/no-require-imports -- mock factories load render primitives after Jest hoisting */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UserSheet } from "@/components/UserSheet";
import { rpc, rpcAction } from "@/utils/rpc";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/ui/ProfileIdentity", () => ({
  ProfileIdentity: ({ username }: { username: string }) =>
    require("react").createElement(require("react-native").Text, null, username),
}));
jest.mock("@/components/ui/PrestigeAvatar", () => ({ PrestigeAvatar: () => null }));
jest.mock("@/components/ui/EmptyState", () => ({
  LoadingBeat: ({ label }: { label: string }) =>
    require("react").createElement(require("react-native").Text, null, label),
  EmptyState: ({ title, sub, action }: { title?: string; sub?: string; action?: React.ReactNode }) =>
    require("react").createElement(
      require("react-native").View,
      null,
      require("react").createElement(require("react-native").Text, null, title),
      require("react").createElement(require("react-native").Text, null, sub),
      action,
    ),
}));
jest.mock("@/components/BarnVisitModal", () => ({
  BarnVisitModal: (props: object) => require("react").createElement("BarnVisitModal", props),
}));
jest.mock("@/components/RitualPicker", () => ({ RitualPicker: () => null }));
jest.mock("@/components/TickleBreakdownSheet", () => ({ TickleBreakdownSheet: () => null }));
jest.mock("@/components/ui/PopupQueue", () => ({ useUnmanagedModalHold: jest.fn() }));
jest.mock("@/hooks/useCrew", () => ({ useCrew: () => ({ crew: { members: [] } }) }));
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlag: () => true }));
jest.mock("@/utils/pairBonds", () => ({ pairBondWith: jest.fn(async () => null), bondBreakdown: jest.fn() }));
jest.mock("@/utils/friendships", () => ({
  acceptFriendRequest: jest.fn(), cancelFriendRequest: jest.fn(),
  friendActionMessage: jest.fn(), sendFriendRequest: jest.fn(),
}));
jest.mock("@/utils/moderation", () => ({ blockUser: jest.fn(), reportUser: jest.fn() }));
jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(), rpcAction: jest.fn() }));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    from: jest.fn(() => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq"])
        query[method] = jest.fn(() => query);
      query.maybeSingle = jest.fn(async () => ({ data: { tickles_earned: 1, wallow_count: 0 }, error: null }));
      return query;
    }),
  },
}));

// The sheet is the `Sheet` panel now, which reads safe-area insets.
const METRICS = {
  frame: { x: 0, y: 0, width: 320, height: 568 },
  insets: { top: 20, left: 0, right: 0, bottom: 16 },
};
const inSafeArea = (node: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const stats = (id: string, username: string) => ({
  user_id: id, username, discriminator: null, active_hat_id: null,
  active_title_id: null, active_title_name: null, active_title_placement: null,
  given_total: 0, received_total: 0, generous_tier_name: null,
  greedy_tier_name: null, friendship_status: "friends", alignment_score: 0,
  alignment_label: "Balanced",
});

describe("UserSheet target identity", () => {
  it("ignores out-of-order profile and visit eligibility from the previous target", async () => {
    const profileA = deferred<unknown>();
    const profileB = deferred<unknown>();
    const gateA = deferred<unknown>();
    const gateB = deferred<unknown>();
    jest.mocked(rpc).mockImplementation((name, args) => {
      if (name === "my_tickle_trades") return Promise.resolve([]) as never;
      if (name === "public_user_stats")
        return ((args as { target_user_id: string }).target_user_id === "a"
          ? profileA.promise
          : profileB.promise) as never;
      return Promise.resolve(null) as never;
    });
    jest.mocked(rpcAction).mockImplementation((_name, args) =>
      ((args as { p_target: string }).p_target === "a" ? gateA.promise : gateB.promise) as never,
    );
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        inSafeArea(<UserSheet targetUserId="a" onDismiss={jest.fn()} />),
      );
    });
    await act(async () => {
      tree.update(
        inSafeArea(<UserSheet targetUserId="b" onDismiss={jest.fn()} />),
      );
    });
    await act(async () => {
      profileA.resolve([stats("a", "Alice")]);
      gateA.resolve({ ok: true, locked: true, next_at: new Date(Date.now() + 60_000).toISOString() });
      await Promise.all([profileA.promise, gateA.promise]);
    });
    expect(tree.root.findAllByProps({ children: "Alice" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "Visit Barn" })).toHaveLength(0);

    await act(async () => {
      profileB.resolve([stats("b", "Bob")]);
      gateB.resolve({ ok: true, locked: false, resting: false });
      await Promise.all([profileB.promise, gateB.promise]);
    });
    expect(tree.root.findByProps({ children: "Bob" })).toBeTruthy();
    const visit = tree.root.findByProps({ children: "Visit Barn" });
    let visitButton = visit.parent;
    while (visitButton && typeof visitButton.props.onPress !== "function")
      visitButton = visitButton.parent;
    expect(visitButton).toBeTruthy();
    act(() => visitButton!.props.onPress());
    expect(tree.root.findByType("BarnVisitModal" as never).props).toMatchObject({
      targetUserId: "b",
      targetName: "Bob",
    });
    act(() => tree.unmount());
  });

  it("a failed profile fetch is an error with a retry, never a forever loader", async () => {
    let profileCalls = 0;
    jest.mocked(rpc).mockImplementation((name) => {
      if (name === "my_tickle_trades") return Promise.resolve([]) as never;
      if (name === "public_user_stats") {
        profileCalls += 1;
        // First read fails (rpc resolves null); the retry succeeds.
        return Promise.resolve(
          profileCalls === 1 ? null : [stats("a", "Alice")],
        ) as never;
      }
      return Promise.resolve(null) as never;
    });
    jest.mocked(rpcAction).mockResolvedValue({ ok: false } as never);

    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        inSafeArea(<UserSheet targetUserId="a" onDismiss={jest.fn()} />),
      );
    });

    // Not the loading beat, and the written error copy is reachable.
    expect(tree.root.findAllByProps({ children: "peeking in" })).toHaveLength(0);
    expect(
      tree.root.findByProps({ children: "Couldn't load this pig" }),
    ).toBeTruthy();

    await act(async () => {
      tree.root.findByProps({ testID: "user-sheet-retry" }).props.onPress();
    });
    expect(profileCalls).toBe(2);
    expect(tree.root.findByProps({ children: "Alice" })).toBeTruthy();
    act(() => tree.unmount());
  });
});
