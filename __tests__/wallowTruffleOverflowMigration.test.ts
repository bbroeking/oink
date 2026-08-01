import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
	process.cwd(),
	"supabase/migrations/20260784000000_wallow_truffle_overflow.sql",
);

describe("Wallow Golden Truffle overflow migration", () => {
	const sql = fs.readFileSync(migrationPath, "utf8");

	it("keeps overflow recoverable and owner-readable without client writes", () => {
		expect(sql).toContain("CREATE TABLE public.golden_truffle_overflow");
		expect(sql).toContain('CREATE POLICY "View own Golden Truffle overflow"');
		expect(sql).toContain(
			"GRANT SELECT ON public.golden_truffle_overflow TO authenticated",
		);
		expect(sql).not.toMatch(
			/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*golden_truffle_overflow[^;]*authenticated/i,
		);
	});

	it("makes a capped Wallow reward succeed and records its claim", () => {
		expect(sql).toContain("<> 'truffle_cap'");
		expect(sql).toContain(
			"INSERT INTO public.user_wallow_tier_claims",
		);
		expect(sql).toContain("'golden_truffle_overflow', overflowed");
		expect(sql).toContain("'ok', true");
	});

	it("revokes the renamed implementation helper from client roles", () => {
		expect(sql).toMatch(
			/REVOKE ALL ON FUNCTION public\._claim_wallow_tier_cap_limited_20260784\(int\)\s+FROM PUBLIC, anon, authenticated;/,
		);
	});
});
