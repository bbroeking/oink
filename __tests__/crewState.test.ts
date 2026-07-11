// Regression test for fetchCrewState's hoist of the nested milestone fields.
//
// The deployed crew_state() RPC nests `lifetime_finds` / `milestones_claimed`
// UNDER the `crew` object; the flat CrewState contract puts them at the top
// level. fetchCrewState hoists them at the chokepoint — this pins that so the
// milestone bar can't silently fall back to 0/[] again.
//
// crews.ts pulls in the rpc → supabase chain (AsyncStorage native module); mock
// both, the same way race.test.ts stubs the module boundary.

const mockRpc = jest.fn();
jest.mock("../utils/rpc", () => ({
	rpc: (...args: unknown[]) => mockRpc(...args),
	rpcAction: jest.fn(),
}));
jest.mock("../utils/supabase", () => ({ supabase: { from: jest.fn() } }));

import { fetchCrewState } from "../utils/crews";

beforeEach(() => {
	mockRpc.mockReset();
});

describe("fetchCrewState — nested milestone hoist", () => {
	it("hoists lifetime_finds / milestones_claimed out of the nested crew object", async () => {
		mockRpc.mockResolvedValue({
			crew: {
				id: "c1",
				name: "Alpha",
				leader_id: "u1",
				is_bot: false,
				lifetime_finds: 4,
				milestones_claimed: [1, 2],
			},
			members: [],
			invitesIn: [],
			invitesOut: [],
		});
		const s = await fetchCrewState();
		expect(s.lifetime_finds).toBe(4);
		expect(s.milestones_claimed).toEqual([1, 2]);
		expect(s.crew?.name).toBe("Alpha");
	});

	it("falls back to top-level fields when the server already flattens them", async () => {
		mockRpc.mockResolvedValue({
			crew: { id: "c1", name: "Alpha", leader_id: "u1", is_bot: false },
			members: [],
			invitesIn: [],
			invitesOut: [],
			lifetime_finds: 7,
			milestones_claimed: [3],
		});
		const s = await fetchCrewState();
		expect(s.lifetime_finds).toBe(7);
		expect(s.milestones_claimed).toEqual([3]);
	});

	it("coerces junk to 0 / [] defensively", async () => {
		mockRpc.mockResolvedValue({
			crew: {
				id: "c1",
				name: "Alpha",
				leader_id: "u1",
				is_bot: false,
				lifetime_finds: -5,
				milestones_claimed: "nope",
			},
			members: [],
			invitesIn: [],
			invitesOut: [],
		});
		const s = await fetchCrewState();
		expect(s.lifetime_finds).toBe(0);
		expect(s.milestones_claimed).toEqual([]);
	});

	it("yields the empty state when the RPC returns null", async () => {
		mockRpc.mockResolvedValue(null);
		const s = await fetchCrewState();
		expect(s.crew).toBeNull();
		expect(s.members).toEqual([]);
		expect(s.invitesIn).toEqual([]);
		expect(s.invitesOut).toEqual([]);
		expect(s.lifetime_finds).toBe(0);
		expect(s.milestones_claimed).toEqual([]);
	});
});
