// The Barn Draw's one surviving lane — the Trough giver's weekly reward. The
// per-crew herd prize retired with the herd race on 2026-09-21
// (docs/design/2026-09-21-season-page-rewrite.md §4); the reveal assertions it
// used to carry for the Trough moved here, where the Trough's own draw lives.
import fs from "node:fs";
import path from "node:path";
import {
	BARN_DRAW_TUNING,
	FEATURED_COLLECTION_COUNT,
	featuredCollectionIndex,
	parseBarnDrawTuning,
	parseBarnPrize,
	parseTroughRewardState,
} from "@/utils/barnDraw";

const ROOT = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("Barn draw — the featured-collection rotation", () => {
	it("starts the ladder at the 2026-09-14 epoch and steps one collection a week", () => {
		expect(featuredCollectionIndex("20260914")).toBe(0);
		expect(featuredCollectionIndex("20260921")).toBe(1);
		expect(featuredCollectionIndex("20260928")).toBe(2);
		expect(featuredCollectionIndex("20261109")).toBe(8);
		expect(featuredCollectionIndex("20261116")).toBe(9);
	});

	it("wraps after ten weeks, the way the server's modulo does", () => {
		expect(featuredCollectionIndex("20261123")).toBe(0);
		expect(featuredCollectionIndex("20261130")).toBe(1);
	});

	it("wraps a pre-epoch week upward instead of going negative", () => {
		// Postgres' `-1 % 10` is -1; both sides take ((w % n) + n) % n.
		expect(featuredCollectionIndex("20260907")).toBe(9);
		expect(featuredCollectionIndex("20260831")).toBe(8);
		expect(featuredCollectionIndex("20260706")).toBe(0);
	});

	it("always lands inside the ladder, and shrugs off a malformed key", () => {
		for (const key of ["20260406", "20270301", "20251229", "20260914"]) {
			const i = featuredCollectionIndex(key);
			expect(i).toBeGreaterThanOrEqual(0);
			expect(i).toBeLessThan(FEATURED_COLLECTION_COUNT);
		}
		expect(featuredCollectionIndex("")).toBe(0);
		expect(featuredCollectionIndex("not-a-week")).toBe(0);
	});
});

describe("Barn draw — the compiled tuning fallback", () => {
	it("mirrors app_settings.barn_draw: 60 / 28 / 12", () => {
		expect(BARN_DRAW_TUNING.tiers).toEqual([
			{ tier: "common", weight: 60 },
			{ tier: "uncommon", weight: 28 },
			{ tier: "rare", weight: 12 },
		]);
	});

	it("takes the server's weights, and falls back on a partial row", () => {
		expect(
			parseBarnDrawTuning({
				tiers: [
					{ tier: "common", weight: 50 },
					{ tier: "uncommon", weight: 30 },
					{ tier: "rare", weight: 20 },
				],
			}).tiers,
		).toEqual([
			{ tier: "common", weight: 50 },
			{ tier: "uncommon", weight: 30 },
			{ tier: "rare", weight: 20 },
		]);
		expect(parseBarnDrawTuning({ tiers: [{ tier: "common", weight: 1 }] }).tiers).toEqual(
			BARN_DRAW_TUNING.tiers,
		);
		expect(parseBarnDrawTuning(null).tiers).toEqual(BARN_DRAW_TUNING.tiers);
	});
});

describe("Barn draw — payload parsing", () => {
	it("reads the Trough giver's weekly state, taken and untaken", () => {
		expect(
			parseTroughRewardState({ ok: true, cycle_key: "20260406", taken: false, reward: null }),
		).toEqual({ cycleKey: "20260406", taken: false, reward: null });
		expect(
			parseTroughRewardState({
				ok: true,
				cycle_key: "20260406",
				taken: true,
				reward: { kind: "tickles", item_id: null, item_name: null, amount: 60 },
			}).reward,
		).toEqual({ kind: "tickles", itemId: null, itemName: null, amount: 60 });
	});

	it("refuses a prize with no honest kind", () => {
		expect(parseBarnPrize(null)).toBeNull();
		expect(parseBarnPrize({ kind: "mystery" })).toBeNull();
		expect(parseBarnPrize({ kind: "habitat", item_id: "x", item_name: "X" })).toEqual({
			kind: "habitat",
			itemId: "x",
			itemName: "X",
			amount: 0,
		});
	});
});

// ── The Trough reveal is wired (moved from herdPrizeReveal.test.ts, 2026-09-21) ──
// The Trough's quarter prize opens the shared furnishing reveal after the
// trough folds away — the fan is the Trough's only door (2026-09-17).
describe("the Trough reveal is wired", () => {
	const shop = read("app/(tabs)/shop.tsx");
	const barn = read("components/Barn.tsx");
	const trough = read("components/TroughSection.tsx");
	const sheet = read("components/season1/DrawRevealSheet.tsx");

	it("the Trough reports the quarter's prize and the Barn folds the trough before the reveal", () => {
		expect(trough).toContain("if (prize) onPrize?.(prize);");
		expect(barn).toContain("setTroughOpen(false);");
		expect(barn).toContain("prizeHandoff.current = setTimeout(() => setTroughPrizeOpen(true), POPUP_HANDOFF_GAP_MS);");
		expect(barn).toContain('kicker="the trough · past your quarter"');
		expect(shop).not.toContain("TroughSheet");
	});

	it("the sheet shows, never claims — the Barn door hands the item over after the modal's gap", () => {
		expect(sheet).not.toMatch(/claim_tier_reward|onClaim/);
		expect(sheet).toContain('router.push({ pathname: "/barn-interior", params: { handItemId: prize.itemId } })');
		expect(sheet).toContain("POPUP_HANDOFF_GAP_MS");
	});
});
