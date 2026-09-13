import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
	path.join(
		process.cwd(),
		"supabase/migrations/20260829010000_perfect_feeding_week.sql"
	),
	"utf8"
);

describe("perfect Feeding week migration", () => {
	it("defines the one-time achievement, title, and 500-snout reward", () => {
		expect(sql).toContain("'every_last_feeding', 'perfect_feeding_week'");
		expect(sql).toContain("'the_unmissable', 'the Unmissable', 'post'");
		expect(sql).toContain("'the_unmissable', NULL, 500, 'bell'");
	});

	it("awards attendance from server-defined windows and remains idempotent", () => {
		expect(sql).toContain("race_cycle_feeding_windows(p_cycle)");
		expect(sql).toContain("count(DISTINCT d.window_index) = expected_windows");
		expect(sql).toContain("ON CONFLICT (user_id, achievement_id) DO NOTHING");
		expect(sql).toContain("AFTER INSERT ON public.cycle_payouts");
	});

	it("queues one next-login announcement for every current real player", () => {
		expect(sql).toContain("INSERT INTO public.system_announcements");
		expect(sql).toContain("'release', 'perfect-feeding-week'");
		expect(sql).toContain("'screen', 'achievements'");
		expect(sql).toContain("COALESCE(p.is_test, false) = false");
		expect(sql).toContain("Show up for every scheduled Feeding");
	});
});
