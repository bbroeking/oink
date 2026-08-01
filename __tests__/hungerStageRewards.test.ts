import * as fs from "fs";
import * as path from "path";

const migration = fs.readFileSync(
	path.join(
		__dirname,
		"..",
		"supabase",
		"migrations",
		"20260775000000_hunger_stage_rewards.sql"
	),
	"utf8"
);

describe("Great Hunger stage rewards", () => {
	it("pays all five server transitions", () => {
		expect(migration).toContain("('stuffed'::text,  600::bigint");
		expect(migration).toContain("('full'::text,    1800::bigint");
		expect(migration).toContain("('peckish'::text, 3600::bigint");
		expect(migration).toContain("('hungry'::text,  6000::bigint");
		expect(migration).toContain("('famished'::text,9000::bigint");
		expect(migration).toContain("15,");
	});

	it("is stage-participation-gated, idempotent, and quiet in the foreground", () => {
		expect(migration).toContain("credited_finds > 0");
		expect(migration).toContain(
			"hunger_stage_key = v_stage.contribution_stage"
		);
		expect(migration).toContain("capture_hunger_stage_before_drain");
		expect(migration).toContain("stamp_rooting_hunger_stage");
		expect(migration).toContain("PRIMARY KEY (stage_key, user_id)");
		expect(migration).toContain("ON CONFLICT (stage_key, user_id) DO NOTHING");
		expect(migration).toContain("'foreground', 'quiet'");
	});

	it("does not blast pushes when an already-reached stage is backfilled", () => {
		expect(migration).toContain("grant_reached_hunger_stage_rewards(false)");
	});
});
