import fs from "fs";
import path from "path";

const migration = fs.readFileSync(
	path.join(
		process.cwd(),
		"supabase/migrations/20260798000000_fix_archery_bow_slot.sql",
	),
	"utf8",
);

describe("archery bow slot migration", () => {
	it("classifies the archery bow as a held item", () => {
		expect(migration).toMatch(
			/UPDATE public\.hats\s+SET category = 'held'\s+WHERE id = 'archery_bow'/,
		);
	});

	it("moves an already-equipped archery bow from the hat slot to the held slot", () => {
		expect(migration).toMatch(
			/SET active_held_id = 'archery_bow',\s+active_hat_id = NULL\s+WHERE active_hat_id = 'archery_bow'/,
		);
	});
});
