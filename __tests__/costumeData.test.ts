// Full costumes (Halloween 2026), the data seams: the equip RPC call for the
// costume slot (refusals are a no-op patch), the fail-soft side fetch that
// reads profiles.active_costume_id (a server without the column must read as
// "no costume", never a failed Barn / visit / Closet), and the Porch Round
// payload parse.
const mockRpcOutcome = jest.fn();
jest.mock("../utils/rpc", () => ({
	rpcOutcome: (...a: unknown[]) => mockRpcOutcome(...a),
	rpc: jest.fn(),
	rpcAction: jest.fn(),
}));

const mockReturns = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: {
		from: () => ({
			select: () => ({
				in: () => ({ returns: () => mockReturns() }),
			}),
		}),
	},
}));

// One stand-in skin (costume -> pig -> frames), as scripts/gen_costume_frames.mjs
// would emit it.
jest.mock("../constants/costumeFrames.generated", () => ({
	COSTUME_FRAMES: { halloween_2026_hollow_jack_costume: { rosie: { idle_1: 9001 } } },
}));

import { equipCosmetic } from "../utils/cosmetics";
import { costumeSlot, fetchWornCostume, fetchWornCostumes } from "../utils/wornCostumes";
import { parsePorchStops } from "../utils/porchRound";

const HOLLOW_JACK = "halloween_2026_hollow_jack_costume";

describe("equipCosmetic: the costume slot", () => {
	beforeEach(() => mockRpcOutcome.mockReset());

	it("sends the costume category and applies the server's one-column patch", async () => {
		mockRpcOutcome.mockResolvedValue({ ok: true, data: { ok: true, update: { active_costume_id: HOLLOW_JACK } } });
		await expect(equipCosmetic(HOLLOW_JACK, "costume")).resolves.toEqual({ active_costume_id: HOLLOW_JACK });
		expect(mockRpcOutcome).toHaveBeenCalledWith("equip_cosmetic", { p_item_id: HOLLOW_JACK, p_category: "costume" });
	});

	it("a refusal (an older server's costume_rosie_only, or no slot) is a no-op patch", async () => {
		mockRpcOutcome.mockResolvedValue({ ok: true, data: { ok: false, reason: "costume_rosie_only" } });
		await expect(equipCosmetic(HOLLOW_JACK, "costume")).resolves.toEqual({});
		mockRpcOutcome.mockResolvedValue({ ok: true, data: { ok: false, reason: "bad_category" } });
		await expect(equipCosmetic(HOLLOW_JACK, "costume")).resolves.toEqual({});
	});
});

describe("worn costume side fetch", () => {
	beforeEach(() => mockReturns.mockReset());

	it("maps users to their worn costume", async () => {
		mockReturns.mockResolvedValue({
			data: [
				{ id: "u1", active_costume_id: HOLLOW_JACK },
				{ id: "u2", active_costume_id: null },
			],
			error: null,
		});
		await expect(fetchWornCostumes(["u1", "u2", "u1"])).resolves.toEqual({ u1: HOLLOW_JACK });
	});

	it("an unpushed column (or any error) reads as no costume", async () => {
		mockReturns.mockResolvedValue({ data: null, error: { message: "column profiles.active_costume_id does not exist" } });
		await expect(fetchWornCostume("u1")).resolves.toBeNull();
		mockReturns.mockRejectedValue(new Error("offline"));
		await expect(fetchWornCostumes(["u1"])).resolves.toEqual({});
		await expect(fetchWornCostume(null)).resolves.toBeNull();
	});

	it("only a costume this binary carries a skin for becomes a stage slot", () => {
		expect(costumeSlot(HOLLOW_JACK)).toEqual({ id: HOLLOW_JACK, category: "costume", emoji: null });
		expect(costumeSlot("halloween_2027_future_costume")).toBeNull();
		expect(costumeSlot(null)).toBeNull();
	});
});

describe("Porch Round stops carry the costume", () => {
	const base = {
		id: 1,
		page_number: 1,
		stop_number: 1,
		target_user_id: "u1",
		target_name: "Maya",
		visited_at: "2026-10-29T12:00:00Z",
		active_hat_id: "cowboy",
		wallow_count: 0,
	};

	it("reads the costume and the pig when the server sends them", () => {
		const [stop] = parsePorchStops([{ ...base, active_costume_id: HOLLOW_JACK, active_pig_id: "rosie" }]);
		expect(stop.activeCostumeId).toBe(HOLLOW_JACK);
		expect(stop.activePigId).toBe("rosie");
	});

	it("an older server's stop is unchanged", () => {
		const [stop] = parsePorchStops([base]);
		expect(stop).not.toHaveProperty("activeCostumeId");
		expect(stop).not.toHaveProperty("activePigId");
	});
});
