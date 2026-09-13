import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
	path.join(
		process.cwd(),
		"supabase/migrations/20260817000000_auto_apply_weekly_dig_tickles.sql"
	),
	"utf8"
);

describe("weekly Dig-Off tickle application migration", () => {
	test("applies and empties the ordinary banks for the two repaired players", () => {
		expect(migration).toContain("ARRAY['tegdirb', 'briguy']");
		expect(migration).toContain("banked := public.settle_tickles(player_id)");
		expect(migration).toMatch(
			/SET tickles_earned = COALESCE\(tickles_earned, 0\) \+ banked,[\s\S]*counter = COALESCE\(counter, 0\) \+ banked/
		);
		expect(migration).toMatch(/SET item_count = 0/);
		expect(migration).not.toMatch(/SET sponsor_tickle_count = 0/);
	});

	test("fails safely unless each username resolves to one profile", () => {
		expect(migration).toContain(
			"COALESCE(cardinality(player_ids), 0) <> 1"
		);
		expect(migration).toContain("Expected exactly one profile named %");
	});

	test("auto-applies future weekly spoils without touching the bank", () => {
		const payoutFunction = migration.slice(
			migration.indexOf("CREATE OR REPLACE FUNCTION public._race_pay_cycle")
		);

		expect(payoutFunction).toMatch(
			/SET tickles_earned = COALESCE\(tickles_earned, 0\) \+ tix,[\s\S]*counter = COALESCE\(counter, 0\) \+ tix/
		);
		expect(payoutFunction).not.toMatch(/public\.grant_tickles/i);
		expect(payoutFunction).not.toMatch(/UPDATE\s+public\.user_items/i);
		expect(payoutFunction).toContain("'tickles_paid', tix");
	});
});
