// The Errand's pure rules (utils/errands) — the tuning sanitizer (per FIELD
// fallback, never per document), the back-by clock across midnight, the
// homecoming card's four cases, the row narrowing and the nonce. Native-free:
// the rpc chain is lazily required only inside the async paths.
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
import { ERRAND_TUNING } from "@/constants/errands";
import {
	__resetErrandTuningForTests,
	backAboutLabel,
	backByLabel,
	clockLabel,
	errandDurationLabel,
	errandDurationMs,
	errandRefusalCopy,
	homecomingCopy,
	newErrandNonce,
	pinKicker,
	resultItems,
	sanitizeErrandTuning,
	targetLabel,
	toErrandRow,
	toErrandState,
} from "@/utils/errands";
import { pigPronouns } from "@/utils/pigs";

afterEach(() => __resetErrandTuningForTests());

describe("sanitizeErrandTuning", () => {
	it("rejects a non-object outright", () => {
		expect(sanitizeErrandTuning(null)).toBeNull();
		expect(sanitizeErrandTuning("x")).toBeNull();
	});

	it("installs the fields it has and falls back per FIELD, not per document", () => {
		const t = sanitizeErrandTuning({
			enabled: true,
			duration_hours: { trot2: 3, trot3: "fast" },
			target_odds_pts: { rare: 25 },
			distracted_pts: 999,
			board_cap: 2.7,
			pigs: { rosie: { nose: 3, trot: 9, family: "brook" }, nope: { nose: 2 } },
		})!;
		expect(t.enabled).toBe(true);
		expect(t.durationHours).toEqual({ trot1: 6, trot2: 3, trot3: 2 });
		expect(t.targetOddsPts).toEqual({ common: 60, uncommon: 40, rare: 25 });
		expect(t.noseBonusPts).toEqual(ERRAND_TUNING.noseBonusPts);
		expect(t.anythingWeights).toEqual(ERRAND_TUNING.anythingWeights);
		expect(t.distractedPts).toBe(100); // clamped
		expect(t.boardCap).toBe(2);
		expect(t.pigs.rosie).toEqual({ nose: 3, trot: 2, pockets: 1, glint: 1, family: "brook" });
		expect(t.pigs.copper).toEqual(ERRAND_TUNING.pigs.copper);
	});

	it("keeps the flag OFF unless the row says true", () => {
		expect(sanitizeErrandTuning({})!.enabled).toBe(false);
		expect(sanitizeErrandTuning({ enabled: "true" })!.enabled).toBe(false);
	});

	it("rejects a malformed weights triple field-wise", () => {
		const t = sanitizeErrandTuning({ anything_weights: { glint1: [1, 2], glint2: [5, "x", 7] } })!;
		expect(t.anythingWeights.glint1).toEqual([70, 25, 5]);
		expect(t.anythingWeights.glint2).toEqual([5, 30, 7]);
	});
});

describe("duration", () => {
	it("reads the pig's trot pip against the tuning", () => {
		expect(errandDurationMs("rosie")).toBe(4 * 3_600_000);
		const t = sanitizeErrandTuning({ pigs: { copper: { trot: 3 } }, duration_hours: { trot3: 0.5 } })!;
		expect(errandDurationMs("copper", t)).toBe(30 * 60_000);
		expect(errandDurationLabel("copper", t)).toBe("about 30 min");
		expect(errandDurationLabel("rosie")).toBe("about 4h");
	});
});

describe("backByLabel", () => {
	const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime();

	it("clocks in twelve-hour local time", () => {
		expect(clockLabel(new Date(2026, 8, 18, 19, 40))).toBe("7:40pm");
		expect(clockLabel(new Date(2026, 8, 18, 0, 5))).toBe("12:05am");
		expect(clockLabel(new Date(2026, 8, 18, 12, 0))).toBe("12:00pm");
	});

	it("says today, tomorrow across midnight, and the weekday beyond", () => {
		const now = at(2026, 9, 18, 15, 40);
		expect(backByLabel(new Date(at(2026, 9, 18, 19, 40)).toISOString(), now)).toBe("back by 7:40pm");
		expect(backByLabel(new Date(at(2026, 9, 19, 1, 40)).toISOString(), now)).toBe("back tomorrow 1:40am");
		expect(backByLabel(new Date(at(2026, 9, 21, 9, 0)).toISOString(), now)).toBe("back Monday 9:00am");
	});

	it("is honest once the time has passed, and soft on garbage", () => {
		const now = at(2026, 9, 18, 15, 40);
		expect(backByLabel(new Date(at(2026, 9, 18, 15, 39)).toISOString(), now)).toBe("back any minute");
		expect(backByLabel("nope", now)).toBe("back soon");
	});

	it("shortens for a row", () => {
		const now = at(2026, 9, 18, 15, 40);
		expect(backAboutLabel(new Date(at(2026, 9, 18, 19, 40)).toISOString(), now)).toBe("back ~7:40pm");
		expect(backAboutLabel(new Date(at(2026, 9, 19, 1, 40)).toISOString(), now)).toBe("back ~1:40am");
	});
});

const row = (over: Partial<Parameters<typeof homecomingCopy>[0]> = {}) => ({
	pig_id: "copper" as const,
	target_find_id: "blue_feather" as const,
	for_user_id: "friend-1",
	result_find_ids: ["blue_feather" as const],
	...over,
});

describe("homecomingCopy", () => {
	const maya = { name: "Maya", pigName: "Pickles" };

	it("friend hit: give leads, keep is the ghost, the granted line pays both", () => {
		const c = homecomingCopy(row(), maya);
		expect(c.kicker).toBe("he found it");
		expect(c.title).toBe("a blue feather");
		expect(c.body).toBe("the one Maya's Pickles is hoping for");
		expect(c.primaryLabel).toBe("Give it to Maya");
		expect(c.secondaryLabel).toBe("Keep it");
		expect(c.primaryAction).toBe("give");
		expect(c.grantedLine).toBe("Maya's Pickles has its blue feather · you both got 3 tickles");
	});

	it("anything hit: keep only", () => {
		const c = homecomingCopy(row({ target_find_id: null, for_user_id: null, result_find_ids: ["old_key"] }), null, 4);
		expect(c.kicker).toBe("he found something");
		expect(c.title).toBe("an old key");
		expect(c.primaryLabel).toBe("Keep it");
		expect(c.secondaryLabel).toBeUndefined();
		expect(c.grantedLine).toBe("in your Satchel · 4 finds");
		expect(c.primaryAction).toBe("keep");
	});

	it("empty hands: muddy trotters, the wish stays open", () => {
		const c = homecomingCopy(row({ pig_id: "rosie", result_find_ids: [] }), maya);
		expect(c.kicker).toBe("back");
		expect(c.title).toBe("muddy trotters");
		expect(c.body).toBe("She looked everywhere; the blue feather wasn't there today. Maya's wish is still open.");
		expect(c.primaryLabel).toBe("Ok, Rosie");
		expect(c.primaryAction).toBe("keep");
	});

	it("friend-targeted but distracted: keep only, and says so", () => {
		const c = homecomingCopy(row({ result_find_ids: ["clover"] }), maya);
		expect(c.kicker).toBe("he got distracted");
		expect(c.title).toBe("a four-leaf clover");
		expect(c.body).toContain("not the blue feather Maya's Pickles wanted");
		expect(c.primaryLabel).toBe("Keep it");
		expect(c.secondaryLabel).toBeUndefined();
		expect(c.primaryAction).toBe("keep");
	});

	it("own-wish hit reads as found it, keep only", () => {
		const c = homecomingCopy(row({ for_user_id: null }), null);
		expect(c.kicker).toBe("he found it");
		expect(c.primaryLabel).toBe("Keep it");
		expect(c.primaryAction).toBe("keep");
	});
});

describe("labels", () => {
	it("targetLabel and pinKicker name the friend, the pig, or anything", () => {
		const maya = { name: "Maya", pigName: "Pickles" };
		expect(targetLabel({ target_find_id: "blue_feather", for_user_id: "x" }, maya)).toBe(
			"looking for a blue feather · for Maya's Pickles",
		);
		expect(targetLabel({ target_find_id: "blue_feather", for_user_id: null })).toBe("looking for a blue feather · for your pig");
		expect(targetLabel({ target_find_id: null, for_user_id: null })).toBe("looking for anything");
		expect(pinKicker({ target_find_id: "old_key", for_user_id: "x" }, maya)).toBe("for Maya");
		expect(pinKicker({ target_find_id: "old_key", for_user_id: null })).toBe("for you");
		expect(pinKicker({ target_find_id: null, for_user_id: null })).toBe("anything");
	});

	it("pronouns follow the pig", () => {
		expect(pigPronouns("rosie").subject).toBe("she");
		expect(pigPronouns("biscuit").object).toBe("him");
		expect(pigPronouns("nope").Subject).toBe("She");
	});

	it("refusal copy is a title and at most one line", () => {
		expect(errandRefusalCopy("wish_moved", "Maya").title).toBe("Maya's pig changed its mind");
		expect(errandRefusalCopy("errand_used_today").text).toContain("tomorrow");
		expect(errandRefusalCopy("???").title).toContain("didn't land");
	});
});

describe("shapes", () => {
	it("narrows a row and drops one it cannot draw", () => {
		const r = toErrandRow({
			id: "7",
			pig_id: "pepper",
			target_find_id: "marble",
			for_user_id: null,
			for_wish_no: null,
			started_at: "2026-09-18T10:00:00Z",
			ends_at: "2026-09-18T14:00:00Z",
			status: "back",
			result_find_ids: ["marble", "unknown_thing"],
		})!;
		expect(r.id).toBe(7);
		expect(r.result_find_ids).toEqual(["marble"]);
		expect(resultItems(r)).toEqual([{ id: "marble", kind: "find", name: "glass marble" }]);
		expect(toErrandRow({ id: 1, pig_id: "dragon", status: "out" })).toBeNull();
		expect(toErrandRow({ id: 1, pig_id: "rosie", status: "lost" })).toBeNull();
	});

	it("narrows the state payload and installs the tuning it carries", () => {
		const s = toErrandState({
			ok: true,
			enabled: true,
			away: "rosie",
			today: { rosie: true, copper: false, dragon: true },
			out: [{ id: 1, pig_id: "rosie", status: "out", result_find_ids: [] }],
			board: [{ id: 2, pig_id: "copper", status: "back", result_find_ids: ["clover"] }, { id: 3 }],
			tuning: { board_cap: 2 },
		});
		expect(s.enabled).toBe(true);
		expect(s.away).toBe("rosie");
		expect(s.today).toEqual({ rosie: true });
		expect(s.out).toHaveLength(1);
		expect(s.board).toHaveLength(1);
		expect(s.tuning?.boardCap).toBe(2);
	});

	it("mints a v4-shaped nonce", () => {
		expect(newErrandNonce()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});
