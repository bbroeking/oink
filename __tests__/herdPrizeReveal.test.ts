// The Barn Draw reaches the player (2026-09-16 ruling): the Race panel's row
// says the last result, a win of mine opens the shared reveal once, and the
// Trough's quarter prize opens the same sheet after the trough folds away.
import fs from "node:fs";
import path from "node:path";
import { herdPrizeLine, type HerdPrizeState } from "@/utils/barnDraw";

const ROOT = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const week = { cycleKey: "20260921", seedHash: "abc" };
const last = {
	cycleKey: "20260914",
	seed: "seed",
	crewId: "c1",
	winnerUserId: "u-jen",
	winnerName: "Jen",
	kind: "habitat" as const,
	itemId: "lantern",
	itemName: "Lantern",
	amount: 0,
	entrants: ["u-jen", "u-me"],
};

describe("herdPrizeLine", () => {
	it("says the rule before a crew has drawn", () => {
		const s: HerdPrizeState = { week, last: null };
		expect(herdPrizeLine(s, "u-me")).toBe("one furnishing per herd, every Monday · dig once to be in");
	});
	it("names a crewmate's draw", () => {
		expect(herdPrizeLine({ week, last }, "u-me")).toBe("Jen drew the Lantern last Monday");
	});
	it("says you when it came up me", () => {
		expect(herdPrizeLine({ week, last }, "u-jen")).toBe("you drew the Lantern last Monday");
	});
	it("says the purse when the winner owned every design", () => {
		const s: HerdPrizeState = { week, last: { ...last, kind: "tickles", itemId: null, itemName: null, amount: 150 } };
		expect(herdPrizeLine(s, "u-me")).toBe("Jen drew a purse of 150 tickles last Monday");
	});
	it("never names who slept", () => {
		expect(herdPrizeLine({ week, last }, "u-me")).not.toMatch(/slept|missed/);
	});
});

describe("the reveal is wired", () => {
	const season = read("app/(tabs)/season.tsx");
	const shop = read("app/(tabs)/shop.tsx");
	const trough = read("components/TroughSection.tsx");
	const sheet = read("components/season1/DrawRevealSheet.tsx");
	const hook = read("hooks/useHerdPrize.ts");

	it("the Season screen opens a win of mine once and lets the row open the last result", () => {
		expect(season).toContain("useHerdPrize(uid, s1)");
		expect(season).toContain("if (herdPrize.unseenWin) setHerdPrizeOpen(true);");
		expect(season).toContain("if (herdPrize.unseenWin) herdPrize.dismissWin();");
		expect(season).toContain('kicker="the barn draw · monday"');
		expect(season).toContain("onOpenHerdPrize={herdPrize.state?.last ? () => setHerdPrizeOpen(true) : undefined}");
	});
	it("the hook remembers the week under one key and only counts a win after the seen set loaded", () => {
		expect(hook).toContain('const SEEN_KEY = "herd_prize_seen";');
		expect(hook).toContain("seen && last && uid && last.winnerUserId === uid && !seen.has(last.cycleKey)");
	});
	it("the Trough reports the quarter's prize and the Shop folds the trough before the reveal", () => {
		expect(trough).toContain("if (prize) onPrize?.(prize);");
		expect(shop).toContain("setTroughOpen(false);");
		expect(shop).toContain("prizeHandoff.current = setTimeout(() => setPrizeOpen(true), POPUP_HANDOFF_GAP_MS);");
		expect(shop).toContain('kicker="the trough · past your quarter"');
	});
	it("the sheet shows, never claims — the Barn door hands the item over after the modal's gap", () => {
		expect(sheet).not.toMatch(/claim_tier_reward|onClaim/);
		expect(sheet).toContain('router.push({ pathname: "/barn-interior", params: { handItemId: prize.itemId } })');
		expect(sheet).toContain("POPUP_HANDOFF_GAP_MS");
	});
	it("the server line deep-links to season and the migration carries the resolve verbatim", () => {
		const mig = read("supabase/migrations/20260917120000_herd_prize_announce.sql");
		expect(mig).toContain("'screen', 'season'");
		expect(mig).toContain("CARRY-LATEST-DEF");
		expect(mig).toMatch(/EXCEPTION WHEN OTHERS THEN NULL/);
	});
});
