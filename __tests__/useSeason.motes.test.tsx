import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useSeason, type UseSeason } from "@/hooks/useSeason";
import { rpc } from "@/utils/rpc";
import type { SeasonState } from "@/utils/seasonPass";

jest.mock("@/utils/rpc", () => ({ rpc: jest.fn(), rpcAction: jest.fn() }));
jest.mock("@/utils/supabase", () => ({
	supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
jest.mock("expo-router/react-navigation", () => ({
	useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

const mockRpc = jest.mocked(rpc);
const initial: SeasonState = {
	active: true,
	season: { id: "test", name: "Test", total_tiers: 25, xp_per_tier: 100, starts_at: "2026-09-01", ends_at: "2026-10-01", premium_price_cents: 0, premium_plus_price_cents: 0 },
	xp: 500, current_tier: 6, motes: 2, wallow_count: 3, season_wallow_count: 1,
};
let current: UseSeason;
function Probe() {
	const value = useSeason();
	React.useEffect(() => { current = value; }, [value]);
	return null;
}

describe("useSeason Mote receipt reconciliation", () => {
	beforeEach(() => { mockRpc.mockReset(); });
	it("updates the wallet from a successful claim and rejects an older read", async () => {
		mockRpc.mockResolvedValueOnce(initial);
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => { tree = TestRenderer.create(<Probe />); });
		let resolveOld!: (value: SeasonState) => void;
		mockRpc.mockReturnValueOnce(new Promise<SeasonState>((resolve) => { resolveOld = resolve; }));
		let oldRead!: Promise<void>;
		act(() => { oldRead = current.refresh(); });
		mockRpc.mockResolvedValueOnce({ ok: true, reward_type: "motes", motes_granted: 1, motes_balance: 3 });
		await act(async () => { await current.claim(3, "free"); });
		expect(current.state?.motes).toBe(3);
		await act(async () => { resolveOld(initial); await oldRead; });
		expect(current.state?.motes).toBe(3);
		expect(mockRpc).toHaveBeenLastCalledWith("claim_season_tier", { target_tier: 3, target_track: "free", expected_season_id: "test", expected_wallow_lap: 1 });
		act(() => tree.unmount());
	});
	it("updates a claim-all wallet once and never increases it after a refusal", async () => {
		mockRpc.mockResolvedValueOnce(initial);
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => { tree = TestRenderer.create(<Probe />); });
		mockRpc.mockResolvedValueOnce({ ok: true, claimed_count: 2, motes: 2, motes_balance: 4, items: ["2 Motes"] });
		await act(async () => { await current.claimAll([3, 8], "free"); });
		expect(current.state?.motes).toBe(4);
		mockRpc.mockResolvedValueOnce({ ok: false, reason: "already_claimed" });
		await act(async () => { await current.claim(3, "free"); });
		expect(current.state?.motes).toBe(4);
		act(() => tree.unmount());
	});
	it("preserves a stale-pass refusal without changing the wallet", async () => {
		mockRpc.mockResolvedValueOnce(initial);
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => { tree = TestRenderer.create(<Probe />); });
		mockRpc.mockResolvedValueOnce({ ok: false, reason: "pass_changed" });
		await act(async () => {
			const result = await current.claimAll([3], "free");
			expect(result).toMatchObject({ reason: "pass_changed", claimedCount: 0, motes: 0 });
		});
		expect(mockRpc).toHaveBeenLastCalledWith("claim_ready_tiers", {
			target_track: "free", expected_season_id: "test", expected_wallow_lap: 1,
		});
		expect(current.state?.motes).toBe(2);
		act(() => tree.unmount());
	});
	it("keeps the old claim signature until the server exposes Mote support", async () => {
		const legacy = { ...initial };
		delete legacy.motes;
		mockRpc.mockResolvedValueOnce(legacy);
		let tree!: TestRenderer.ReactTestRenderer;
		await act(async () => { tree = TestRenderer.create(<Probe />); });
		mockRpc.mockResolvedValueOnce({ ok: true });
		await act(async () => { await current.claim(5, "free"); });
		expect(mockRpc).toHaveBeenLastCalledWith("claim_season_tier", { target_tier: 5, target_track: "free" });
		mockRpc.mockResolvedValueOnce({ ok: true, claimed_count: 1 });
		await act(async () => { await current.claimAll([10], "free"); });
		expect(mockRpc).toHaveBeenLastCalledWith("claim_ready_tiers", { target_track: "free" });
		act(() => tree.unmount());
	});
});
