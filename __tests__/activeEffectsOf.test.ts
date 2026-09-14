// `fetchActiveEffectsOf` — the visitor-side read behind "go and admire the
// curse you cast" (weekday rituals, 2026-09-14, plan phase 4).
//
// Three claims, all load-bearing:
//   1. It calls `active_effects_of` with `p_target`, and takes back kinds only —
//      the server deliberately returns no sender, and nothing here invents one.
//   2. It NEVER throws and never resolves anything but an array. The RPC is
//      dark until the migration is pushed, and a visit that blows up because a
//      friend's Barn could not be read is a worse bug than a plain Barn.
//   3. Blessings sort before curses, the same order `fetchActiveEffects` hands
//      the merge, so a visitor folds the host's recipes in the host's own order.
//
// Expiry is NOT this function's job: the SQL already excludes expired rows, and
// the client's own clock has its say in `useVisitorEffects` (see its test).

import {
	fetchActiveEffectsOf,
	type VisitorEffect,
} from "../utils/activeEffects";

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const row = (
	source: VisitorEffect["source"],
	kind: string,
	expires_at = "2026-09-18T18:00:00Z",
): VisitorEffect => ({ source, kind, expires_at });

describe("fetchActiveEffectsOf", () => {
	beforeEach(() => mockRpc.mockReset());

	test("asks active_effects_of for one target", async () => {
		mockRpc.mockResolvedValue({ data: [], error: null });
		await fetchActiveEffectsOf("host-uuid");
		expect(mockRpc).toHaveBeenCalledWith("active_effects_of", {
			p_target: "host-uuid",
		});
	});

	test("hands back the kinds the server sent, and no sender", async () => {
		mockRpc.mockResolvedValue({
			data: [row("curse", "bacon_bits")],
			error: null,
		});
		const rows = await fetchActiveEffectsOf("host-uuid");
		expect(rows).toEqual([
			{
				source: "curse",
				kind: "bacon_bits",
				expires_at: "2026-09-18T18:00:00Z",
			},
		]);
		expect(Object.keys(rows[0]).sort()).toEqual([
			"expires_at",
			"kind",
			"source",
		]);
	});

	test("blessings sort before curses", async () => {
		mockRpc.mockResolvedValue({
			data: [
				row("curse", "bacon_bits"),
				row("blessing", "golden_hour"),
				row("curse", "hiccups"),
				row("blessing", "cloud_nine"),
			],
			error: null,
		});
		const rows = await fetchActiveEffectsOf("host-uuid");
		expect(rows.map((r) => r.source)).toEqual([
			"blessing",
			"blessing",
			"curse",
			"curse",
		]);
		expect(rows.slice(0, 2).map((r) => r.kind)).toEqual([
			"golden_hour",
			"cloud_nine",
		]);
	});

	test("a dark RPC (migration unpushed) is an empty Barn, not a crash", async () => {
		mockRpc.mockResolvedValue({
			data: null,
			error: {
				code: "PGRST202",
				message: "Could not find the function public.active_effects_of",
			},
		});
		await expect(fetchActiveEffectsOf("host-uuid")).resolves.toEqual([]);
	});

	test("a non-friend, a blocked visitor and a transport blip all read as rest", async () => {
		mockRpc.mockResolvedValue({ data: [], error: null });
		expect(await fetchActiveEffectsOf("stranger")).toEqual([]);
		mockRpc.mockResolvedValue({ data: null, error: null });
		expect(await fetchActiveEffectsOf("stranger")).toEqual([]);
		mockRpc.mockResolvedValue({
			data: null,
			error: { message: "Network request failed" },
		});
		expect(await fetchActiveEffectsOf("stranger")).toEqual([]);
	});

	test("a shape the dark RPC never promised is still an array", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
		await expect(fetchActiveEffectsOf("host-uuid")).resolves.toEqual([]);
	});

	test("does not mutate the row array the transport handed it", async () => {
		const data = [row("curse", "bacon_bits"), row("blessing", "golden_hour")];
		mockRpc.mockResolvedValue({ data, error: null });
		await fetchActiveEffectsOf("host-uuid");
		expect(data.map((r) => r.source)).toEqual(["curse", "blessing"]);
	});
});
