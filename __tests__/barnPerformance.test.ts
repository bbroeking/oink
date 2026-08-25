import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const barn = fs.readFileSync(path.join(ROOT, "components/Barn.tsx"), "utf8");
const homeStats = fs.readFileSync(path.join(ROOT, "hooks/useHomeStats.ts"), "utf8");

describe("Barn core-loop performance contracts", () => {
	test("reconciles a tickle burst once instead of refetching all stats per tap", () => {
		expect(homeStats).toContain("scheduleRefresh");
		expect(barn).toContain("scheduleStatsRefresh()");

		const successfulTicklePath = barn.slice(
			barn.indexOf("const handleIncrement"),
			barn.indexOf("const handleAvailableTap"),
		);
		expect(successfulTicklePath).not.toContain("fetchStats();");
	});

	test("uses the locally cached session identity on the repeat-tap path", () => {
		const successfulTicklePath = barn.slice(
			barn.indexOf("const handleIncrement"),
			barn.indexOf("const handleAvailableTap"),
		);
		expect(successfulTicklePath).toContain("supabase.auth.getSession()");
		expect(successfulTicklePath).not.toContain("supabase.auth.getUser()");
	});

	test("batches each particle burst into one add and one cleanup commit", () => {
		const heartFloats = barn.slice(
			barn.indexOf("const HeartFloats"),
			barn.indexOf("HeartFloats.displayName"),
		);
		expect(heartFloats).toContain("Animated.parallel");
		expect(heartFloats.match(/setFloats\(/g)).toHaveLength(2);
	});
});
