import fs from "fs";
import path from "path";

describe("player_dig_stats migration", () => {
	const sql = fs.readFileSync(
		path.join(
			__dirname,
			"../supabase/migrations/20260813000000_player_dig_stats.sql",
		),
		"utf8",
	);

	it("counts only submitted digs from the canonical rooting fields", () => {
		expect(sql).toMatch(/submitted_at IS NOT NULL/);
		expect(sql).toMatch(/sum\(r\.credited_finds\)/i);
		expect(sql).toMatch(/'shimmer' = ANY/i);
		expect(sql).toMatch(/r\.echo_credited/);
		expect(sql).not.toMatch(/echo_claims/);
	});

	it("is authenticated-only and respects profile blocks", () => {
		expect(sql).toMatch(/auth\.uid\(\)/);
		expect(sql).toMatch(/public\.are_blocked\(caller_id, target_id\)/);
		expect(sql).toMatch(
			/REVOKE ALL ON FUNCTION public\.player_dig_stats\(uuid\) FROM PUBLIC, anon/,
		);
		expect(sql).toMatch(
			/GRANT EXECUTE ON FUNCTION public\.player_dig_stats\(uuid\) TO authenticated/,
		);
	});
});
