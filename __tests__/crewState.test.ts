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
		expect(s.joinRequestsIn).toEqual([]);
		expect(s.joinRequestsOut).toEqual([]);
		expect(s.lifetime_finds).toBe(0);
		expect(s.milestones_claimed).toEqual([]);
	});
});

describe("fetchCrewState — knock-to-join arrays", () => {
	it("maps snake_case join_requests_in/out onto the camelCase CrewState", async () => {
		mockRpc.mockResolvedValue({
			crew: { id: "c1", name: "Alpha", leader_id: "u1", is_bot: false },
			members: [],
			invitesIn: [],
			invitesOut: [],
			join_requests_in: [{ id: "r1", requester_id: "u9", username: "askerA" }],
			join_requests_out: [],
		});
		const s = await fetchCrewState();
		expect(s.joinRequestsIn).toEqual([
			{ id: "r1", requester_id: "u9", username: "askerA" },
		]);
		expect(s.joinRequestsOut).toEqual([]);
	});

	it("surfaces the crewless caller's outgoing asks", async () => {
		mockRpc.mockResolvedValue({
			crew: null,
			members: [],
			invitesIn: [],
			invitesOut: [],
			join_requests_in: [],
			join_requests_out: [{ id: "r2", crew_id: "c7", crew_name: "The Rooters" }],
		});
		const s = await fetchCrewState();
		expect(s.joinRequestsOut).toEqual([
			{ id: "r2", crew_id: "c7", crew_name: "The Rooters" },
		]);
		expect(s.joinRequestsIn).toEqual([]);
	});

	it("defaults to [] when the server predates the migration (missing fields)", async () => {
		mockRpc.mockResolvedValue({
			crew: null,
			members: [],
			invitesIn: [],
			invitesOut: [],
		});
		const s = await fetchCrewState();
		expect(s.joinRequestsIn).toEqual([]);
		expect(s.joinRequestsOut).toEqual([]);
	});

	it("coerces a non-array join_requests field to []", async () => {
		mockRpc.mockResolvedValue({
			crew: null,
			members: [],
			invitesIn: [],
			invitesOut: [],
			join_requests_in: "nope",
			join_requests_out: null,
		});
		const s = await fetchCrewState();
		expect(s.joinRequestsIn).toEqual([]);
		expect(s.joinRequestsOut).toEqual([]);
	});
});
