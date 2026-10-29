import { applySeasonalOpening, emptySeasonalUnlockState, validateSeasonalCardManifest, type SeasonalCardManifest, type SeasonalPackGrant } from "@/features/cards/domain/seasonalUnlocks";
import { HALLOWEEN_2026_DRAFT_MANIFEST } from "@/features/cards/data/halloweenSeason";

const manifest = (active = true): SeasonalCardManifest => validateSeasonalCardManifest({
	setKey: "halloween_2026_v1", name: "Halloween 2026", mappingVersion: 1, active, packCardLimit: 3,
	cards: [
		{ cardId: "moon_cap", name: "Moon Cap", itemId: "moon_cap", unlockRule: "first_copy" },
		{ cardId: "ghost_story", name: "Ghost Story", unlockRule: "first_copy" },
	],
});

const grant = (ownerId = "pig-a", grantId = "grant-1"): SeasonalPackGrant => ({
	grantId, ownerId, setKey: "halloween_2026_v1", source: "test", sourceRef: grantId,
	cards: [{ cardId: "moon_cap", finish: "standard" }, { cardId: "moon_cap", finish: "foil" }, { cardId: "ghost_story", finish: "standard" }],
});

describe("seasonal card item unlocks", () => {
	it("replays an opening without changing inventory or grants", () => {
		const first = applySeasonalOpening(emptySeasonalUnlockState(), manifest(), grant());
		const replay = applySeasonalOpening(first.state, manifest(), grant());
		expect(replay.state).toBe(first.state);
		expect(replay.receipt).toBe(first.receipt);
	});

	it("grants a mapped item only for the first card copy", () => {
		const result = applySeasonalOpening(emptySeasonalUnlockState(), manifest(), grant());
		expect(result.receipt.cards[0].itemUnlock).toEqual({ itemId: "moon_cap", newlyOwned: true });
		expect(result.receipt.cards[1].itemUnlock).toBeUndefined();
		expect(result.state.inventory["pig-a"].halloween_2026_v1.moon_cap).toBe(2);
	});

	it("keeps ownership isolated between users", () => {
		const first = applySeasonalOpening(emptySeasonalUnlockState(), manifest(), grant("pig-a", "a"));
		const second = applySeasonalOpening(first.state, manifest(), grant("pig-b", "b"));
		expect(second.receipt.cards[0].itemUnlock?.newlyOwned).toBe(true);
		expect(second.state.ownedItems["pig-a"]).toContain("moon_cap");
		expect(second.state.ownedItems["pig-b"]).toContain("moon_cap");
	});

	it("rejects inactive catalogs", () => {
		expect(() => applySeasonalOpening(emptySeasonalUnlockState(), manifest(false), grant())).toThrow("inactive");
	});

	it("rejects unknown cards", () => {
		const bad = { ...grant(), cards: [{ cardId: "not_registered", finish: "standard" as const }] };
		expect(() => applySeasonalOpening(emptySeasonalUnlockState(), manifest(), bad)).toThrow("Unknown seasonal card");
	});

	it("rejects a replay whose fixed ordered contents changed", () => {
		const first = applySeasonalOpening(emptySeasonalUnlockState(), manifest(), grant());
		const changed = { ...grant(), cards: [{ cardId: "ghost_story", finish: "standard" as const }] };
		expect(() => applySeasonalOpening(first.state, manifest(), changed)).toThrow("contents mismatch");
	});

	it("validates all 49 draft first-copy mappings while keeping them inactive", () => {
		expect(HALLOWEEN_2026_DRAFT_MANIFEST.cards).toHaveLength(49);
		expect(HALLOWEEN_2026_DRAFT_MANIFEST.active).toBe(false);
		expect(HALLOWEEN_2026_DRAFT_MANIFEST.cards.every((card) => card.itemId && card.unlockRule === "first_copy")).toBe(true);
	});

	it("grants the original five-card costume fixture once without folding login gifts into the pack", () => {
		const costumeCards = HALLOWEEN_2026_DRAFT_MANIFEST.cards.slice(39, 44);
		expect(costumeCards).toHaveLength(5);
		expect(HALLOWEEN_2026_DRAFT_MANIFEST.cards.slice(44).map((card) => card.cardId)).toEqual([
			"halloween_2026_card_linen_lurker_costume",
			"halloween_2026_card_starspell_costume",
			"halloween_2026_card_bat_nap_costume",
			"halloween_2026_card_little_imp_costume",
			"halloween_2026_card_marshmallow_boo_costume",
		]);
		const costumeManifest = validateSeasonalCardManifest({
			...HALLOWEEN_2026_DRAFT_MANIFEST,
			active: true,
			packCardLimit: 5,
		});
		const costumeGrant: SeasonalPackGrant = {
			grantId: "costume-grant",
			ownerId: "pig-a",
			setKey: costumeManifest.setKey,
			source: "test",
			sourceRef: "costume-grant",
			cards: costumeCards.map(({ cardId }) => ({ cardId, finish: "standard" })),
		};
		const first = applySeasonalOpening(emptySeasonalUnlockState(), costumeManifest, costumeGrant);
		const replay = applySeasonalOpening(first.state, costumeManifest, costumeGrant);
		expect(first.receipt.cards.map((card) => card.itemUnlock)).toEqual(costumeCards.map((card) => ({
			itemId: card.itemId,
			newlyOwned: true,
		})));
		expect(first.state.ownedItems["pig-a"]).toEqual(costumeCards.map((card) => card.itemId));
		expect(replay.state).toBe(first.state);
		expect(replay.receipt).toBe(first.receipt);
	});

	it("counts the same card id independently in another versioned set", () => {
		const first = applySeasonalOpening(emptySeasonalUnlockState(), manifest(), grant("pig-a", "set-one"));
		const nextManifest = { ...manifest(), setKey: "halloween_2027_v1" };
		const nextGrant = { ...grant("pig-a", "set-two"), setKey: "halloween_2027_v1" };
		const second = applySeasonalOpening(first.state, nextManifest, nextGrant);
		expect(second.receipt.cards[0].newlyOwned).toBe(true);
		expect(second.state.inventory["pig-a"].halloween_2026_v1.moon_cap).toBe(2);
		expect(second.state.inventory["pig-a"].halloween_2027_v1.moon_cap).toBe(2);
	});
});
