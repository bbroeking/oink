// tallyFromRpc — the pure fold from claim_ready_tiers' jsonb tally into the
// screen-facing ClaimAllTally. The hook's claimAll delegates to this, so the
// key-mapping contract (claimed_count/failed/tickles/items 1:1, mysteries → the
// LAST element as lastMystery) and its fail-soft defaults are pinned here.

import { tallyFromRpc } from "@/hooks/useSeason";

describe("tallyFromRpc", () => {
	it("folds a full server tally, surfacing the LAST mystery only", () => {
		const last = { granted_hat_id: "reed_hat", granted_hat_name: "Reed Hat" };
		const raw = {
			ok: true,
			claimed_count: 3,
			failed: 1,
			tickles: 250,
			items: ["Reed Hat", "Mud Boots"],
			mysteries: [{ granted_hat_id: "old_hat" }, last],
		};
		expect(tallyFromRpc(raw)).toEqual({
			claimedCount: 3,
			failed: 1,
			tickles: 250,
			items: ["Reed Hat", "Mud Boots"],
			lastMystery: last,
		});
	});

	it("maps an empty mysteries array to a null lastMystery", () => {
		const raw = {
			ok: true,
			claimed_count: 2,
			failed: 0,
			tickles: 100,
			items: ["Mud Boots"],
			mysteries: [],
		};
		expect(tallyFromRpc(raw).lastMystery).toBeNull();
	});

	it("fail-softs an {ok:false} refusal (no tally fields) to a zeroed tally", () => {
		const raw = { ok: false, reason: "no_active_season" };
		expect(tallyFromRpc(raw)).toEqual({
			claimedCount: 0,
			failed: 0,
			tickles: 0,
			items: [],
			lastMystery: null,
		});
	});

	it("fail-softs missing keys and a null response to zeros", () => {
		expect(tallyFromRpc(null)).toEqual({
			claimedCount: 0,
			failed: 0,
			tickles: 0,
			items: [],
			lastMystery: null,
		});
		expect(tallyFromRpc({})).toEqual({
			claimedCount: 0,
			failed: 0,
			tickles: 0,
			items: [],
			lastMystery: null,
		});
	});

	it("tolerates a foreign non-array items/mysteries shape", () => {
		const raw = {
			ok: true,
			claimed_count: 1,
			tickles: 5,
			items: undefined,
			mysteries: undefined,
		} as unknown as Parameters<typeof tallyFromRpc>[0];
		const t = tallyFromRpc(raw);
		expect(t.items).toEqual([]);
		expect(t.lastMystery).toBeNull();
		expect(t.claimedCount).toBe(1);
		expect(t.tickles).toBe(5);
	});
});
