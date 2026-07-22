import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const migrationPath = path.join(
	ROOT,
	"supabase/migrations/20260760000000_world_cup_rewards.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("World Cup rewards", () => {
	it("grants participation and Spain rewards without retiring flags", () => {
		const achievementGrant = sql.indexOf(
			"INSERT INTO public.user_achievements"
		);
		const spainGrant = sql.indexOf("INSERT INTO public.user_hats");

		expect(achievementGrant).toBeGreaterThan(-1);
		expect(spainGrant).toBeGreaterThan(achievementGrant);
		expect(sql).toContain("p.allegiance_country IS NOT NULL");
		expect(sql).toContain("p.active_flag_id = 'flag_spain'");
		expect(sql).not.toContain("DELETE FROM public.hats");
		expect(sql).not.toContain("CREATE OR REPLACE FUNCTION public.choose_allegiance");
	});

	it("ships the legendary trophy as a held, grant-only item", () => {
		expect(sql).toMatch(
			/\('golden_hog_cup',[\s\S]*?0,\s*473,\s*'held',\s*'legendary'/
		);
		const hats = fs.readFileSync(path.join(ROOT, "constants/hats.ts"), "utf8");
		expect(hats).toContain(
			'golden_hog_cup: require("../assets/images/hats/golden_hog_cup.png")'
		);
	});
});
