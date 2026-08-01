import fs from "fs";
import path from "path";

const migration = fs.readFileSync(
	path.join(
		process.cwd(),
		"supabase/migrations/20260799000000_server_clock_commuter_windows.sql",
	),
	"utf8",
);

describe("server-clock commuter migration", () => {
	it("keeps timezone and phase authority on the database", () => {
		expect(migration).toContain("America/New_York");
		expect(migration).toContain("public._patch_clock(v_now)");
		expect(migration).not.toMatch(/p_utc_offset|p_off\b|getTimezoneOffset/);
	});

	it("carries the latest seeded-board and receipt behavior", () => {
		expect(migration).toContain("COALESCE(my_crew, caller_id)");
		expect(migration).toContain("'echo',         my_echo");
		expect(migration).toContain("'blessed',      blessed");
		expect(migration).toContain("'window_ends_at', clock.window_ends_at");
	});

	it("revokes the new helper surface from anonymous callers", () => {
		expect(migration).toMatch(
			/REVOKE ALL ON FUNCTION public\._patch_clock\(timestamptz\) FROM PUBLIC, anon/,
		);
		expect(migration).toMatch(
			/REVOKE ALL ON FUNCTION public\.patch_phase_open\(timestamptz\) FROM PUBLIC, anon/,
		);
	});
});
