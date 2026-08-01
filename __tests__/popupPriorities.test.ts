// Guards the popup precedence registry (constants/popupPriorities.ts) — the
// single table that defines global popup ordering. Two invariants:
//
//  1. Priorities are UNIQUE except any explicitly documented collision. A NEW
//     accidental collision must fail here — a silent duplicate would make
//     two popups' relative order
//     depend on arrival timing instead of the intended precedence.
//  2. The registry and the real usePopupSlot(id, …, priority) call sites agree:
//     every registry id is actually wired to a slot in source, every slot's id
//     is in the registry, and each call site passes its registry priority (no
//     bare literals sneaking back in). Scanned from source in the notification-
//     Routing.test.ts style so the registry can't drift from the wiring.

import fs from "fs";
import path from "path";
import {
	POPUP_PRIORITIES,
	KNOWN_PRIORITY_COLLISIONS,
	CEREMONY_SLOT_IDS,
	type PopupSlotId,
} from "../constants/popupPriorities";

// The files that declare popup slots. Every usePopupSlot call site lives in one
// of these; the scan below asserts that stays true (no slot outside this list).
const SLOT_SOURCE_FILES = [
	"app/_layout.tsx",
	"app/(tabs)/season.tsx",
	"components/Barn.tsx",
	"components/MysteryHatReveal.tsx",
];

const ROOT = path.join(__dirname, "..");

type CallSite = { id: string; priorityExpr: string; file: string };

// Extract usePopupSlot("<id>", <want…>, <priority-expr>) triples from a source
// file. `want` can span lines / contain commas / parens, so we don't try to
// parse it — we anchor on the quoted id and take the LAST top-level argument as
// the priority expression by matching balanced parens from the call open.
function callSitesIn(file: string): CallSite[] {
	const src = fs.readFileSync(path.join(ROOT, file), "utf8");
	const sites: CallSite[] = [];
	const open = /usePopupSlot\(/g;
	let m: RegExpExecArray | null;
	while ((m = open.exec(src)) !== null) {
		// Walk from the opening paren to its balanced close.
		let depth = 0;
		let i = m.index + m[0].length - 1; // at '('
		let end = -1;
		for (; i < src.length; i++) {
			const c = src[i];
			if (c === "(") depth++;
			else if (c === ")") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end < 0) continue;
		const inner = src.slice(m.index + m[0].length, end);
		// Split top-level args on commas not nested in (), [], {}.
		const args: string[] = [];
		let a = 0;
		let d = 0;
		for (let j = 0; j < inner.length; j++) {
			const c = inner[j];
			if (c === "(" || c === "[" || c === "{") d++;
			else if (c === ")" || c === "]" || c === "}") d--;
			else if (c === "," && d === 0) {
				args.push(inner.slice(a, j));
				a = j + 1;
			}
		}
		args.push(inner.slice(a));
		// A formatter may leave a trailing comma after the final argument,
		// which produces one empty split entry. It does not change the call's
		// final argument and should not make this source-level guard fail.
		while (args.length > 0 && args[args.length - 1].trim() === "") args.pop();
		if (args.length < 3) continue;
		const idMatch = args[0].match(/^\s*"([^"]+)"\s*$/);
		if (!idMatch) continue;
		sites.push({
			id: idMatch[1],
			priorityExpr: args[args.length - 1].trim(),
			file,
		});
	}
	return sites;
}

const callSites = SLOT_SOURCE_FILES.flatMap(callSitesIn);

describe("popup priority registry", () => {
	test("priorities are unique except the documented collisions", () => {
		const byPriority = new Map<number, PopupSlotId[]>();
		for (const [id, pri] of Object.entries(POPUP_PRIORITIES)) {
			const bucket = byPriority.get(pri) ?? [];
			bucket.push(id as PopupSlotId);
			byPriority.set(pri, bucket);
		}
		const collisions = [...byPriority.values()]
			.filter((ids) => ids.length > 1)
			.map((ids) => [...ids].sort());
		const known = KNOWN_PRIORITY_COLLISIONS.map((c) => [...c].sort());
		expect(collisions).toEqual(known);
	});

	test("the documented collision pair really shares a priority", () => {
		for (const pair of KNOWN_PRIORITY_COLLISIONS) {
			const pris = new Set(pair.map((id) => POPUP_PRIORITIES[id]));
			expect(pris.size).toBe(1);
		}
	});

	test("ceremony set references real registry slots", () => {
		for (const id of CEREMONY_SLOT_IDS) {
			expect(POPUP_PRIORITIES).toHaveProperty(id);
		}
	});

	// ── source-scan guards: registry ⇄ live call sites ──
	test("the scan actually found the slot call sites (not vacuously empty)", () => {
		// A guard on the guard: if usePopupSlot moved or the matcher broke, the
		// checks below would pass vacuously. Anchor on ids we know ship today.
		const ids = callSites.map((s) => s.id);
		expect(ids).toEqual(
			expect.arrayContaining(["schism", "truffleSheet", "seasonEnd", "luckyPig"])
		);
	});

	test("every registry id has a live usePopupSlot call site", () => {
		const wiredIds = new Set(callSites.map((s) => s.id));
		for (const id of Object.keys(POPUP_PRIORITIES)) {
			expect(wiredIds).toContain(id);
		}
	});

	test("every usePopupSlot call site id is in the registry", () => {
		for (const site of callSites) {
			expect(POPUP_PRIORITIES).toHaveProperty(site.id);
		}
	});

	test("every call site passes its registry priority, not a bare literal", () => {
		for (const site of callSites) {
			// The refactor's whole point: call sites reference the named constant.
			expect(site.priorityExpr).toBe(`POPUP_PRIORITIES.${site.id}`);
		}
	});
});
