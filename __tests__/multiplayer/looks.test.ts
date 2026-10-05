// PigLook → PigStage props, and the player's own card from their profile.

import {
	LOOK_PROFILE_SELECT,
	LOOK_SLOT_CATEGORY,
	PLAIN_LOOK,
	UNNAMED_PIG,
	equippedItemForSlot,
	fetchMyPlayerCard,
	lookFromProfile,
	pigStagePropsForLook,
	playerCardFromProfile,
} from "../../utils/multiplayer/looks";
import type { PigLook } from "../../multiplayer/protocol";

// jest.mock is hoisted above the imports; the factory reads these lazily.
const mockGetSession = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn((_columns: string) => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));

jest.mock("@/utils/supabase", () => ({
	supabase: {
		auth: { getSession: () => mockGetSession() },
		from: (table: string) => mockFrom(table),
	},
}));

const LOOK: PigLook = {
	pigId: "pickles",
	hat: "wizard",
	bow: "pink_bow",
	glasses: "round_glasses",
	mask: null,
	neck: "beta_founder_ribbon",
	held: "magic_wand",
	aura: "gold_aura",
	wallow: 3,
};

describe("pigStagePropsForLook", () => {
	it("maps every slot id to an EquippedItem carrying its slot's category", () => {
		const props = pigStagePropsForLook(LOOK);
		expect(props.pigId).toBe("pickles");
		expect(props.equipped).toEqual({ id: "wizard", category: "hat", emoji: null });
		expect(props.equippedBow).toEqual({ id: "pink_bow", category: "bow", emoji: null });
		expect(props.equippedGlasses).toEqual({ id: "round_glasses", category: "glasses", emoji: null });
		expect(props.equippedMask).toBeNull();
		expect(props.equippedNeck).toEqual({ id: "beta_founder_ribbon", category: "necklace", emoji: null });
		expect(props.equippedHeld).toEqual({ id: "magic_wand", category: "held", emoji: null });
		expect(props.equippedAura).toEqual({ id: "gold_aura", category: "aura", emoji: null });
		expect(props.prestigeLevel).toBe(3);
	});

	it("resolves a hat and a bow exactly as PigAvatar does for a friend's row", () => {
		// components/ui/PigAvatar.tsx: { id: hatId, category: "hat", emoji: null }.
		expect(equippedItemForSlot("hat", "cowboy")).toEqual({ id: "cowboy", category: "hat", emoji: null });
		expect(equippedItemForSlot("bow", "gift_bow")).toEqual({ id: "gift_bow", category: "bow", emoji: null });
	});

	it("takes an exact catalog category when the caller has one", () => {
		const props = pigStagePropsForLook({ ...LOOK, neck: "knit_scarf" }, { knit_scarf: "scarf" });
		expect(props.equippedNeck).toEqual({ id: "knit_scarf", category: "scarf", emoji: null });
		expect(props.equipped?.category).toBe("hat");
	});

	it("degrades to Rosie with empty slots for a missing or malformed look", () => {
		const empty = pigStagePropsForLook(null);
		expect(empty.pigId).toBe("rosie");
		expect(empty.prestigeLevel).toBe(0);
		expect([empty.equipped, empty.equippedBow, empty.equippedNeck, empty.equippedAura].every((x) => x === null)).toBe(true);
		const junk = pigStagePropsForLook({ ...LOOK, pigId: "dragon", hat: 42 as unknown as string, bow: "", wallow: Number.NaN });
		expect(junk.pigId).toBe("rosie");
		expect(junk.equipped).toBeNull();
		expect(junk.equippedBow).toBeNull();
		expect(junk.prestigeLevel).toBe(0);
	});

	it("covers every look slot", () => {
		expect(Object.keys(LOOK_SLOT_CATEGORY).sort()).toEqual(["aura", "bow", "glasses", "hat", "held", "mask", "neck"]);
	});
});

describe("lookFromProfile / playerCardFromProfile", () => {
	const row = {
		username: " Rosie ",
		active_pig_id: "copper",
		is_vip: true,
		active_hat_id: "tophat",
		active_bow_id: null,
		active_glasses_id: "monocle",
		active_mask_id: null,
		active_neck_id: null,
		active_held_id: "controller",
		active_aura_id: null,
		wallow_count: 2.7,
	};

	it("builds the look the server would snapshot", () => {
		expect(lookFromProfile(row)).toEqual({
			pigId: "copper",
			hat: "tophat",
			bow: null,
			glasses: "monocle",
			mask: null,
			neck: null,
			held: "controller",
			aura: null,
			wallow: 2,
		});
	});

	it("shows a companion pig only for a Slop Club member", () => {
		expect(lookFromProfile({ ...row, is_vip: false }).pigId).toBe("rosie");
		expect(lookFromProfile({ ...row, active_pig_id: "unicorn" }).pigId).toBe("rosie");
		expect(lookFromProfile(null)).toEqual(PLAIN_LOOK);
	});

	it("names the card, with a warm fallback", () => {
		expect(playerCardFromProfile("u1", row)).toMatchObject({ userId: "u1", name: "Rosie" });
		expect(playerCardFromProfile("u1", { ...row, username: "   " }).name).toBe(UNNAMED_PIG);
		expect(playerCardFromProfile("u1", null)).toEqual({ userId: "u1", name: UNNAMED_PIG, look: PLAIN_LOOK });
	});

	it("selects every column the look needs", () => {
		for (const column of ["username", "active_pig_id", "is_vip", "active_hat_id", "active_bow_id", "active_glasses_id", "active_mask_id", "active_neck_id", "active_held_id", "active_aura_id", "wallow_count"]) {
			expect(LOOK_PROFILE_SELECT).toContain(column);
		}
	});
});

describe("fetchMyPlayerCard", () => {
	beforeEach(() => {
		mockGetSession.mockReset();
		mockMaybeSingle.mockReset();
		mockFrom.mockClear();
		mockSelect.mockClear();
		mockEq.mockClear();
	});

	it("reads my profile row into my card", async () => {
		mockGetSession.mockResolvedValue({ data: { session: { user: { id: "me-1" } } } });
		mockMaybeSingle.mockResolvedValue({ data: { username: "Rosie", is_vip: false, active_hat_id: "party", wallow_count: 0 } });
		const card = await fetchMyPlayerCard();
		expect(mockFrom).toHaveBeenCalledWith("profiles");
		expect(mockSelect).toHaveBeenCalledWith(LOOK_PROFILE_SELECT);
		expect(mockEq).toHaveBeenCalledWith("id", "me-1");
		expect(card).toEqual({ userId: "me-1", name: "Rosie", look: { ...PLAIN_LOOK, hat: "party" } });
	});

	it("is null with no session, and still a card when the row is missing", async () => {
		mockGetSession.mockResolvedValue({ data: { session: null } });
		expect(await fetchMyPlayerCard()).toBeNull();
		mockGetSession.mockResolvedValue({ data: { session: { user: { id: "me-1" } } } });
		mockMaybeSingle.mockResolvedValue({ data: null });
		expect(await fetchMyPlayerCard("Rosie")).toEqual({ userId: "me-1", name: "Rosie", look: PLAIN_LOOK });
	});
});
