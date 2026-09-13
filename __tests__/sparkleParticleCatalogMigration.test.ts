import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

describe("Sparkle Particle catalog correction", () => {
	const migration = fs.readFileSync(
		path.join(
			__dirname,
			"..",
			"supabase",
			"migrations",
			"20260826010000_correct_sparkle_particle_description.sql",
		),
		"utf8",
	);

	it("describes the existing particle as a five-point star", () => {
		expect(migration).toContain("WHERE id = 'particle_sparkle'");
		expect(migration).toContain("five-point star");
		expect(migration).not.toContain("four-point");
	});

	it("updates copy only and does not replace artwork or catalog identity", () => {
		expect(migration).toMatch(/UPDATE public\.hats\s+SET description =/);
		expect(migration).not.toMatch(/image_path|INSERT|DELETE/i);
		const artwork = fs.readFileSync(
			path.join(
				__dirname,
				"..",
				"assets",
				"images",
				"tickle-particles",
				"sparkle.png",
			),
		);
		expect(createHash("sha256").update(artwork).digest("hex")).toBe(
			"c7ef922c6febb987b9233c8e49ba9ed553f3f9ee079561192175fd9ff2f6c599",
		);
	});
});
