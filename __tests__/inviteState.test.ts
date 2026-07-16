// Pure-logic tests for the invite / join client rules (components/sounder/
// inviteState.ts) — extracted from SounderCard + JoinableSounders. Covers
// stale-invite detection, the seat-count subline, the one-Sounder-at-a-time
// messaging path, and the found/join/accept failure copy. The reason codes
// mirror the crew RPCs in supabase/migrations/*_sounder*.sql.

import {
	isInviteStale,
	seatsLine,
	createError,
	acceptInviteResult,
	joinError,
	askError,
	ASK_LIMIT_HINT,
	MAX_OPEN_ASKS,
} from "../components/sounder/inviteState";
import { CREW_CAP } from "../constants/crews";

const inv = (id: string, crew_id: string) => ({ id, crew_id });

// ── isInviteStale ────────────────────────────────────────────────────────────

describe("isInviteStale", () => {
	it("is fresh with no known size and no recorded bounce", () => {
		expect(isInviteStale(inv("i1", "c1"), new Set(), new Map())).toBe(false);
	});

	it("goes stale once its accept bounced with crew_full (id in staleIds)", () => {
		expect(isInviteStale(inv("i1", "c1"), new Set(["i1"]), new Map())).toBe(true);
	});

	it("goes stale when the inviting crew is known to be at cap", () => {
		const sizes = new Map([["c1", CREW_CAP]]);
		expect(isInviteStale(inv("i1", "c1"), new Set(), sizes)).toBe(true);
	});

	it("stays fresh when the inviting crew still has a seat", () => {
		const sizes = new Map([["c1", CREW_CAP - 1]]);
		expect(isInviteStale(inv("i1", "c1"), new Set(), sizes)).toBe(false);
	});

	it("keys the size on the invite's own crew_id, not another crew's", () => {
		const sizes = new Map([["other", CREW_CAP]]);
		expect(isInviteStale(inv("i1", "c1"), new Set(), sizes)).toBe(false);
	});
});

// ── seatsLine ────────────────────────────────────────────────────────────────

describe("seatsLine", () => {
	it("undefined when the member count is unknown", () => {
		expect(seatsLine(undefined)).toBeUndefined();
	});

	it("singular at one seat left", () => {
		expect(seatsLine(CREW_CAP - 1)).toBe("one seat left at the trough");
	});

	it("spells small vacancies out", () => {
		// CREW_CAP is 4: a solo founder (1) has three open seats, a pair two.
		expect(seatsLine(1)).toBe("room for three more snouts");
		expect(seatsLine(2)).toBe("room for two more snouts");
	});

	it("undefined when the crew is full (no seat to advertise)", () => {
		expect(seatsLine(CREW_CAP)).toBeUndefined();
		expect(seatsLine(CREW_CAP + 1)).toBeUndefined();
	});
});

// ── createError ──────────────────────────────────────────────────────────────

describe("createError", () => {
	it("maps the known found-a-Sounder reasons", () => {
		expect(createError("already_in_crew")).toMatch(/already in a Sounder/i);
		expect(createError("bad_name")).toMatch(/1–24 characters/);
	});
	it("falls back for an unknown reason", () => {
		expect(createError("nope")).toBe("Couldn't create your Sounder.");
		expect(createError(undefined)).toBe("Couldn't create your Sounder.");
	});
});

// ── acceptInviteResult — the one-Sounder path ────────────────────────────────

describe("acceptInviteResult", () => {
	it("crew_full flips the row stale (no note)", () => {
		expect(acceptInviteResult("crew_full")).toEqual({ kind: "stale" });
	});

	it("already_in_crew surfaces the one-Sounder-at-a-time note", () => {
		const r = acceptInviteResult("already_in_crew");
		expect(r.kind).toBe("note");
		expect(r.kind === "note" && r.note).toMatch(/one Sounder at a time/i);
	});

	it("any other failure surfaces a generic retry note", () => {
		const r = acceptInviteResult("boom");
		expect(r).toEqual({ kind: "note", note: "Couldn't join — try again." });
	});
});

// ── joinError (open-Sounder join) ────────────────────────────────────────────

describe("joinError", () => {
	it("distinguishes filled, mid-war, and already-crewed", () => {
		expect(joinError("crew_full")).toMatch(/filled up/i);
		expect(joinError("crew_in_war")).toMatch(/mid-war/i);
		expect(joinError("already_in_crew")).toMatch(/already in a Sounder/i);
	});
	it("falls back for an unknown reason", () => {
		expect(joinError(undefined)).toBe("Couldn't join — try another Sounder.");
	});
});

// ── askError (knock-to-join) ─────────────────────────────────────────────────

describe("askError", () => {
	it("distinguishes the knock-specific refusals", () => {
		expect(askError("crew_full")).toMatch(/filled up/i);
		expect(askError("already_in_crew")).toMatch(/already in a Sounder/i);
		expect(askError("already_asked")).toMatch(/already knocked/i);
		expect(askError("too_many_asks")).toBe(ASK_LIMIT_HINT);
	});
	it("falls back for an unknown reason", () => {
		expect(askError(undefined)).toBe("Couldn't send that ask — try another Sounder.");
	});
	it("caps open asks at three", () => {
		expect(MAX_OPEN_ASKS).toBe(3);
		expect(ASK_LIMIT_HINT).toMatch(/three doors knocked/i);
	});
});
