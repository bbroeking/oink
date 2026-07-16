// Guards the one-word bug that silently killed ALL server pushes for two
// months: send_push_to_user must call net.http_post (where pg_net actually
// installs its function), never extensions.http_post (which does not exist —
// pg_net ignores CREATE EXTENSION's WITH SCHEMA clause for its objects, and
// every push caller fail-softs, so the mistake produces no error anywhere).
// The db-harness stubs send_push_to_user entirely, so it can never catch
// this; a static check on the newest migration definition can.

import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

function newestDefinitionOf(fnSignature: string): { file: string; body: string } {
	const files = fs
		.readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort(); // timestamped names — lexicographic == chronological
	let hit: { file: string; body: string } | null = null;
	for (const f of files) {
		const body = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
		if (body.includes(fnSignature)) hit = { file: f, body };
	}
	if (!hit) throw new Error(`no migration defines ${fnSignature}`);
	return hit;
}

describe("send_push_to_user delivery path", () => {
	it("newest definition posts via net.http_post, not extensions.http_post", () => {
		const { file, body } = newestDefinitionOf(
			"CREATE OR REPLACE FUNCTION public.send_push_to_user"
		);
		// Slice from the LAST definition in that file (a carried-def migration
		// may define it once; the original file defines it once — either way,
		// judge the final CREATE OR REPLACE the file leaves behind). Matching
		// the CREATE line specifically keeps the trailing GRANT (which also
		// names the function) from truncating the slice.
		const defStart = body.lastIndexOf(
			"CREATE OR REPLACE FUNCTION public.send_push_to_user"
		);
		const def = body.slice(defStart);
		expect(def).toContain("net.http_post(");
		expect(def).not.toContain("extensions.http_post(");
		// Sanity: the guard is examining the file we expect to win.
		expect(file >= "20260741000000_fix_push_http_post.sql").toBe(true);
	});
});
