import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
	process.cwd(),
	"supabase/migrations/20260793000000_major_race_tickle_spoils.sql",
);

describe("major weekly Dig-Off tickle spoils", () => {
	const sql = fs.readFileSync(migrationPath, "utf8");

	it("makes every tickle tier meaningful, including participation", () => {
		expect(sql).toContain("WHEN p_rank = 1 THEN 500");
		expect(sql).toContain("WHEN p_rank = 2 THEN 300");
		expect(sql).toContain("WHEN p_rank = 3 THEN 200");
		expect(sql).toContain("THEN 100");
		expect(sql).toContain("WHEN p_rank >= 4 THEN 50");
		expect(sql).toContain("ELSE 25");
	});

	it("does not change Golden Truffle payouts and keeps the helper private", () => {
		expect(sql).not.toContain("_race_truffles_for_rank");
		expect(sql).toMatch(
			/REVOKE ALL ON FUNCTION public\._race_tickles_for_rank\(int, int\)\s+FROM PUBLIC, anon, authenticated;/,
		);
	});
});
