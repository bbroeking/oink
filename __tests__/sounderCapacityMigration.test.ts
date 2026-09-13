import fs from "fs";
import path from "path";

const migrationPath = path.join(
	__dirname,
	"..",
	"supabase/migrations/20260812020000_sounder_capacity_eight.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("eight-pig Sounder capacity migration", () => {
	it("raises every current membership and reserved-seat gate to eight", () => {
		expect(sql.match(/>= 8 THEN/g)).toHaveLength(6);
		expect(sql).not.toMatch(/>= 4 THEN/);
	});

	it("keeps full Sounders out of discovery", () => {
		expect(sql).toContain("j.member_count BETWEEN 1 AND 7");
	});

	it("carries every current capacity-sensitive RPC", () => {
		for (const signature of [
			"enforce_crew_cap()",
			"invite_to_crew(p_invitee uuid)",
			"accept_crew_invite(p_invite uuid)",
			"request_to_join(p_crew uuid)",
			"accept_join_request(p_request uuid)",
			"join_crew(p_crew uuid)",
			"find_joinable_crews()",
		]) {
			expect(sql).toContain(`FUNCTION public.${signature}`);
		}
	});
});
