import fs from "fs";
import path from "path";

const migration = fs.readFileSync(
	path.join(
		process.cwd(),
		"supabase/migrations/20260826030000_independent_bow_slot.sql",
	),
	"utf8",
);

describe("independent bow slot migration", () => {
	it("adds a profile column with the catalog foreign key", () => {
		expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS active_bow_id text/);
		expect(migration).toMatch(/FOREIGN KEY \(active_bow_id\) REFERENCES public\.hats\(id\)/);
	});

	it("preserves bows previously worn through active_hat_id", () => {
		expect(migration).toMatch(
			/SET active_bow_id = COALESCE\(p\.active_bow_id, p\.active_hat_id\),\s+active_hat_id = NULL/,
		);
		expect(migration).toMatch(/h\.category = 'bow'/);
	});

	it("routes bows independently and returns both slots from home_stats", () => {
		expect(migration).toMatch(/WHEN 'bow'\s+THEN 'active_bow_id'/);
		expect(migration).toMatch(/'active_hat_id', prof\.active_hat_id/);
		expect(migration).toMatch(/'active_bow_id', prof\.active_bow_id/);
		expect(migration).toMatch(/'active_bow', \(SELECT jsonb_build_object/);
	});
});
