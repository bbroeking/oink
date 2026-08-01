// Guards that war-exclusive / earned cosmetics (cost = 0) can never leak into
// the buyable shop. cost = 0 is the "not for sale" sentinel: the default barn,
// season-pass hats, referral rewards, and the Mud War cosmetics all rely on it.
//
// Three runtime filters enforce this (daily_shop() `cost > 0`, the Browse grid
// `cost > 0 || owned`, and buy_hat rejecting cost <= 0). The fragile one is
// daily_shop(): it's CREATE OR REPLACE'd often, and a regen from a stale base
// would silently drop the `cost > 0` line and flood the daily drop with free
// items (the carry-latest-def footgun). These tests fail the build if any of
// the three guards disappears, or if a Mud War cosmetic is accidentally priced.

import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
// The Browse-grid cost>0 / pass_exclusive filter lives in the catalog fetch
// hook (extracted from shop.tsx's inline load — candidate C10).
const CATALOG_HOOK = path.join(ROOT, "hooks", "useShopCatalog.ts");
const WAR_COSMETICS = "20260650000000_mud_war_cosmetics.sql";

const sqlFiles = () =>
	fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

const activeDef = (fnName: string) => {
	const defs = sqlFiles().filter((f) =>
		fs
			.readFileSync(path.join(MIGRATIONS, f), "utf8")
			.includes(`FUNCTION public.${fnName}`)
	);
	expect(defs.length).toBeGreaterThan(0);
	return fs.readFileSync(path.join(MIGRATIONS, defs[defs.length - 1]), "utf8");
};

describe("cost-0 items never leak into the shop", () => {
	it("the active daily_shop() definition still filters cost > 0", () => {
		expect(activeDef("daily_shop")).toMatch(/cost\s*>\s*0/);
	});

	it("the active buy_hat() rejects cost-0 items", () => {
		expect(activeDef("buy_hat")).toMatch(/hat_cost\s*<=\s*0/);
	});

	it("the active mystery-box picker only draws positive-cost items", () => {
		expect(activeDef("grant_mystery_box")).toMatch(/h\.cost\s*>\s*0/);
	});

	it("the Browse grid hides unowned cost-0 items", () => {
		const tsx = fs.readFileSync(CATALOG_HOOK, "utf8");
		// `(r.cost > 0 && !r.pass_exclusive) || ownedSet.has(r.id)` — the cost
		// guard may now be ANDed with the pass-exclusive guard, so match loosely.
		expect(tsx).toMatch(/cost\s*>\s*0[\s\S]{0,60}ownedSet\.has/);
	});

	it("every Mud War cosmetic is cost 0 (war-exclusive, not for sale)", () => {
		const sql = fs.readFileSync(path.join(MIGRATIONS, WAR_COSMETICS), "utf8");
		// Each row ends "...'emoji', COST, DISPLAY_ORDER, 'category'..." with the
		// Mud War display_order block in the 400s.
		const rows = [...sql.matchAll(/,\s*(\d+),\s*(4\d\d),\s*'/g)];
		expect(rows.length).toBe(25);
		for (const [, cost] of rows) expect(cost).toBe("0");
	});
});

describe("Golden Ticket cosmetics stay redemption-only", () => {
	const redemptionOnlySeeds = [
		"20260733000000_release_party_crown.sql",
		"20260734000000_ticket_takers_cap.sql",
	];

	it.each(redemptionOnlySeeds)("%s seeds the cosmetic at cost 0", (file) => {
		const sql = fs.readFileSync(path.join(MIGRATIONS, file), "utf8");
		expect(sql).toMatch(
			/INSERT INTO public\.hats[\s\S]*?VALUES[\s\S]*?,\s*0,\s*47[01],/
		);
	});

	it("both have a global ten-owner supply policy", () => {
		const sql = fs.readFileSync(
			path.join(MIGRATIONS, "20260776000000_cosmetic_owner_caps.sql"),
			"utf8"
		);
		expect(sql).toMatch(
			/WHERE h\.id IN \('release_party_crown', 'ticket_takers_cap'\)/
		);
		expect(sql).toMatch(/SELECT h\.id,\s*10,\s*COUNT/);
		expect(sql).toMatch(/BEFORE INSERT ON public\.user_hats/);
		expect(sql).toMatch(/issued_count\s*>=\s*supply\.max_owners/);
	});
});

// Battle-pass tier rewards are EARNED, never sold — a structural separation
// (not the manual cost=0 convention) so every future season is covered the
// moment its tiers are seeded. Source of truth: season_tiers; enforced by the
// pass_exclusive flag (synced by trigger) in daily_shop/buy_hat + Browse.
describe("battle-pass rewards can never enter the shop (all seasons)", () => {
	const allSql = () =>
		sqlFiles()
			.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), "utf8"))
			.join("\n");

	it("the active daily_shop() excludes pass_exclusive hats", () => {
		expect(activeDef("daily_shop")).toMatch(/NOT\s+\w*\.?pass_exclusive/);
	});

	it("the active buy_hat() rejects pass_exclusive hats", () => {
		expect(activeDef("buy_hat")).toMatch(/pass_exclusive/);
	});

	it("a trigger syncs pass_exclusive from season_tiers (future seasons auto-apply)", () => {
		const sql = allSql();
		expect(sql).toMatch(/TRIGGER\s+\w+\s+AFTER[\s\S]*?ON\s+public\.season_tiers/);
		expect(sql).toMatch(/pass_exclusive\s*=\s*true/);
	});

	it("the Browse grid also hides unowned pass_exclusive items", () => {
		expect(fs.readFileSync(CATALOG_HOOK, "utf8")).toMatch(/!\s*r\.pass_exclusive/);
	});
});
