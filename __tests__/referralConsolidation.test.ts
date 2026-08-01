import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
	path.join(
		ROOT,
		"supabase/migrations/20260783000000_consolidate_referrals.sql"
	),
	"utf8"
);

describe("canonical referral lifecycle", () => {
	it("retires the legacy username and 50-tickle reward entry points", () => {
		expect(migration).toContain(
			"DROP TRIGGER IF EXISTS profiles_referral_milestone_check"
		);
		expect(migration).toContain(
			"DROP FUNCTION IF EXISTS public.attribute_referral(text, text)"
		);
		expect(migration).toContain(
			"DROP FUNCTION IF EXISTS public.check_referral_milestones(uuid)"
		);
	});

	it("backs recruiter views with the canonical completion counter", () => {
		expect(migration).toContain("COALESCE(p.referrals_completed, 0)");
		expect(migration).toContain("COALESCE(referrals_completed, 0)");
		expect(migration).not.toMatch(
			/FROM public\.referral_milestones[\s\S]*WHERE milestone = 'engaged'/
		);
	});
});
