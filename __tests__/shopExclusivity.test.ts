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
const SHOP_TSX = path.join(ROOT, "app", "(tabs)", "shop.tsx");
const WAR_COSMETICS = "20260650000000_mud_war_cosmetics.sql";

const sqlFiles = () =>
	fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

describe("cost-0 items never leak into the shop", () => {
	it("the active daily_shop() definition still filters cost > 0", () => {
		// The last migration (alphabetically) that redefines daily_shop() is the
		// one Postgres actually runs.
		const defs = sqlFiles().filter((f) =>
			fs
				.readFileSync(path.join(MIGRATIONS, f), "utf8")
				.includes("FUNCTION public.daily_shop")
		);
		expect(defs.length).toBeGreaterThan(0);
		const active = fs.readFileSync(path.join(MIGRATIONS, defs[defs.length - 1]), "utf8");
		expect(active).toMatch(/cost\s*>\s*0/);
	});

	it("the Browse grid hides unowned cost-0 items", () => {
		const tsx = fs.readFileSync(SHOP_TSX, "utf8");
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

// Battle-pass tier rewards are EARNED, never sold — a structural separation
// (not the manual cost=0 convention) so every future season is covered the
// moment its tiers are seeded. Source of truth: season_tiers; enforced by the
// pass_exclusive flag (synced by trigger) in daily_shop/buy_hat + Browse.
describe("battle-pass rewards can never enter the shop (all seasons)", () => {
	const activeDef = (fnName: string) => {
		const defs = sqlFiles().filter((f) =>
			fs
				.readFileSync(path.join(MIGRATIONS, f), "utf8")
				.includes(`FUNCTION public.${fnName}`)
		);
		expect(defs.length).toBeGreaterThan(0);
		return fs.readFileSync(path.join(MIGRATIONS, defs[defs.length - 1]), "utf8");
	};
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
		expect(fs.readFileSync(SHOP_TSX, "utf8")).toMatch(/!\s*r\.pass_exclusive/);
	});
});
