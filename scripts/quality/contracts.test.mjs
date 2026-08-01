import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	evaluateContracts,
	inspectLayout,
	inspectSecurity,
} from "./contracts.mjs";

function fixture() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "oink-quality-contract-"));
}

function put(root, relative, source) {
	const absolute = path.join(root, relative);
	fs.mkdirSync(path.dirname(absolute), { recursive: true });
	fs.writeFileSync(absolute, source);
}

test("current repository satisfies the locked quality contracts", () => {
	const result = evaluateContracts(process.cwd(), "all");
	assert.equal(result.ok, true, result.failures.join("\n"));
});

test("layout inspection sees shrinking and sub-11pt production text", () => {
	const root = fixture();
	try {
		put(
			root,
			"components/Bad.tsx",
			`<Text adjustsFontSizeToFit style={{ fontSize: 10 }}>bad</Text>`,
		);
		const result = inspectLayout(root);
		assert.equal(result.totals.shrinkToFit, 1);
		assert.equal(result.totals.sub11LiteralFonts, 1);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("security inspection rejects exposed definers and tables without RLS", () => {
	const root = fixture();
	try {
		put(
			root,
			"supabase/migrations/20260799000000_bad.sql",
			`
CREATE TABLE public.secrets (id bigint);
CREATE FUNCTION public.steal() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;
GRANT EXECUTE ON FUNCTION public.steal() TO anon;
`,
		);
		const result = inspectSecurity(root, {
			migrationFloor: "20260775000000",
			allowedAnonFunctions: new Set(),
			maxUnrevokedSecurityDefinerTriggers: 0,
		});
		assert.equal(result.failures.some((item) => item.includes("does not enable RLS")), true);
		assert.equal(result.failures.some((item) => item.includes("no fixed search_path")), true);
		assert.equal(result.failures.some((item) => item.includes("anon execution")), true);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
