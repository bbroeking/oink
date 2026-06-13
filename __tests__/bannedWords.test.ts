// Username moderation pre-check. The lists tested here MUST stay in
// sync with supabase/migrations/20260641000000_username_moderation.sql
// (the DB trigger is the authoritative copy of the policy).

import { isUsernameAllowed } from "../constants/bannedWords";

describe("isUsernameAllowed", () => {
	test("plain friendly names pass", () => {
		for (const name of ["Brian", "piglet99", "Mud_Queen", "rosiefan"]) {
			expect(isUsernameAllowed(name)).toEqual({ ok: true });
		}
	});

	test("classic false-positive set passes (Tier 2 is exact-only)", () => {
		for (const name of [
			"cassandra",
			"scunthorpe",
			"bassman",
			"grass",
			"hancock",
			"sussex",
			"essex",
			"matsushita",
			"shiitake",
			"cockburn",
			"dickson",
			"hellen",
			"analyst",
			"classic",
			"assassin",
			"therapist",
			"torpedo",
			"hololive",
			"cucumber",
		]) {
			expect(isUsernameAllowed(name)).toEqual({ ok: true });
		}
	});

	test("Tier 1 substrings blocked anywhere, any casing", () => {
		for (const name of ["BitchKing", "xX_dickhead_Xx", "AssholePig"]) {
			expect(isUsernameAllowed(name)).toEqual({
				ok: false,
				reason: "banned",
			});
		}
	});

	test("leet, separators and fullwidth lookalikes normalize before matching", () => {
		for (const name of ["b1tch", "b!tch", "b.i.t.c.h", "f u c k", "a$$hole", "ｆｕｃｋ", "sh１t"]) {
			expect(isUsernameAllowed(name)).toEqual({
				ok: false,
				reason: "banned",
			});
		}
	});

	test("Tier 2 blocks whole-name matches only", () => {
		expect(isUsernameAllowed("cunt")).toEqual({ ok: false, reason: "banned" });
		expect(isUsernameAllowed("C0ck")).toEqual({ ok: false, reason: "banned" });
		expect(isUsernameAllowed("rapist")).toEqual({ ok: false, reason: "banned" });
		// ...but their innocent superstrings pass.
		expect(isUsernameAllowed("hancock")).toEqual({ ok: true });
		expect(isUsernameAllowed("therapist")).toEqual({ ok: true });
	});

	test("reserved barn names blocked exactly, not as substrings", () => {
		expect(isUsernameAllowed("Rosie")).toEqual({ ok: false, reason: "reserved" });
		expect(isUsernameAllowed("admin")).toEqual({ ok: false, reason: "reserved" });
		expect(isUsernameAllowed("m0d")).toEqual({ ok: false, reason: "reserved" });
		expect(isUsernameAllowed("rosiefan")).toEqual({ ok: true });
		expect(isUsernameAllowed("demo_rosie")).toEqual({ ok: true });
	});
});
