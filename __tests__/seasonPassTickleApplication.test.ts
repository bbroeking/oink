import fs from "fs";
import path from "path";

const migration = fs.readFileSync(
	path.join(
		process.cwd(),
		"supabase/migrations/20260812010000_auto_apply_season_pass_tickles.sql"
	),
	"utf8"
);

describe("season-pass tickle application migration", () => {
	test("applies ordinary and bundled tickles directly to the player", () => {
		expect(migration).toContain("reward_type_lc = 'tickles'");
		expect(migration).toContain("reward_value ? 'tickles'");
		expect(migration).toMatch(
			/SET tickles_earned = tickles_earned \+ applied_tickles,[\s\S]*counter = counter \+ applied_tickles/
		);
		expect(migration).toContain("'tickles_applied', applied_tickles");
	});

	test("never credits the spendable tickle bank", () => {
		const functionSql = migration.slice(
			migration.indexOf("CREATE OR REPLACE FUNCTION public.claim_tier_reward")
		);
		expect(functionSql).not.toMatch(/UPDATE\s+public\.user_items/i);
		expect(functionSql).not.toMatch(/PERFORM\s+public\.grant_tickles/i);
	});

	test("keeps the RPC restricted to authenticated players", () => {
		expect(migration).toContain(
			"REVOKE ALL ON FUNCTION public.claim_tier_reward(int, text) FROM PUBLIC, anon;"
		);
		expect(migration).toContain(
			"GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;"
		);
	});
});
