import {
	groupBarnVisits,
	launchEventSourcesSucceeded,
	systemAnnouncementRoute,
	toWhileAwaySystemEvent,
	visitGroupCopy,
	visitorNameOf,
	type WhileAwayVisitGroup,
} from "../utils/whileAway";
import type { WhileAwayEvent } from "../components/WhileAwayModal";

describe("launchEventSourcesSucceeded — conservative away marker gate", () => {
	test("accepts successful empty event sources", () => {
		expect(
			launchEventSourcesSucceeded([{ error: null }, { error: null }, { error: null }], [])
		).toBe(true);
	});

	test("rejects any failed table or announcement source", () => {
		expect(
			launchEventSourcesSucceeded(
				[{ error: null }, { error: new Error("offline") }, { error: null }],
				[]
			)
		).toBe(false);
		expect(
			launchEventSourcesSucceeded([{ error: null }, { error: null }, { error: null }], null)
		).toBe(false);
	});
});

describe("systemAnnouncementRoute — announcement kind → deep-link route", () => {
	test("trough_nudge with a drive_id routes to the Barn tab (the fan's Trough row)", () => {
		expect(systemAnnouncementRoute("trough_nudge", { drive_id: "drive-123" })).toBe("/");
	});

	test("trough_nudge WITHOUT a drive_id has no destination (null)", () => {
		expect(systemAnnouncementRoute("trough_nudge", {})).toBeNull();
		expect(systemAnnouncementRoute("trough_nudge", null)).toBeNull();
		expect(systemAnnouncementRoute("trough_nudge", { drive_id: "" })).toBeNull();
		expect(systemAnnouncementRoute("trough_nudge", { screen: "shop" })).toBeNull();
	});

	test("feature announcements use an allow-listed screen destination", () => {
		expect(systemAnnouncementRoute("feature_update", { screen: "achievements" })).toBe(
			"/achievements"
		);
		expect(systemAnnouncementRoute("feature_update", { screen: "not-a-screen" })).toBeNull();
	});

	test("an admin note without a screen has no destination (null)", () => {
		expect(systemAnnouncementRoute("barn_note", { drive_id: "drive-123" })).toBeNull();
		expect(systemAnnouncementRoute(undefined, undefined)).toBeNull();
	});
});

describe("toWhileAwaySystemEvent — row → While-Away system event", () => {
	test("threads the drive_id through to a tappable route", () => {
		const event = toWhileAwaySystemEvent({
			id: 42,
			kind: "trough_nudge",
			title: "A friend needs your help!",
			body: "Chip in to land the item",
			data: { drive_id: "drive-abc" },
		});
		expect(event).toEqual({
			source: "system",
			announcementId: 42,
			kind: "trough_nudge",
			title: "A friend needs your help!",
			body: "Chip in to land the item",
			route: "/",
			emoteId: null,
		});
	});

	test("threads a barn visit's parting emote into the existing note row", () => {
		const event = toWhileAwaySystemEvent({
			id: 51,
			kind: "barn_visit",
			title: "A note from your Barn",
			body: "Seb came by and left a parting note.",
			data: { emote_id: "snout_boop" },
		});
		expect(event.route).toBeNull();
		expect(event.emoteId).toBe("snout_boop");
	});

	test("a nudge missing its drive_id yields a non-pressable event (route null)", () => {
		const event = toWhileAwaySystemEvent({
			id: 7,
			kind: "trough_nudge",
			title: "t",
			body: "b",
			data: {},
		});
		expect(event.route).toBeNull();
	});

	test("a plain admin note carries title/body but no route", () => {
		const event = toWhileAwaySystemEvent({
			id: 9,
			kind: "barn_note",
			title: "A note from the barn",
			body: "hello",
			data: {},
		});
		expect(event.route).toBeNull();
		expect(event.title).toBe("A note from the barn");
		expect(event.announcementId).toBe(9);
	});

	test("a feature update can open Achievements", () => {
		const event = toWhileAwaySystemEvent({
			id: 10,
			kind: "feature_update",
			title: "Never miss a Feeding",
			body: "Earn Every Last Feeding.",
			data: { release: "perfect-feeding-week", screen: "achievements" },
		});
		expect(event.route).toBe("/achievements");
	});
});

// The recap folds a run of plain Barn visits into one row that names who came,
// each name once; a visit that left a parting note keeps its own row (it
// carries the visitor's sticker). (polish pass, 2026-10-04)
describe("groupBarnVisits — the recap's Barn-visit fold", () => {
	const visit = (id: number, name: string, extra: Partial<WhileAwayEvent> = {}): WhileAwayEvent => ({
		source: "system",
		announcementId: id,
		kind: "barn_visit",
		title: "Someone visited your Barn!",
		body: `${name} came by and tickled your pig!`,
		route: null,
		emoteId: null,
		...extra,
	} as WhileAwayEvent);
	const blessing: WhileAwayEvent = { source: "blessing", kind: "golden_hour", from: "Jen" };

	test("reads the visitor out of the server's body", () => {
		expect(visitorNameOf("Noah E came by and tickled your pig!")).toBe("Noah E");
		expect(visitorNameOf("A friend came by and left a parting note.")).toBeNull();
	});

	test("one visit is left as it is", () => {
		const events = [visit(1, "tegdirB"), blessing];
		expect(groupBarnVisits(events)).toEqual(events);
	});

	test("folds every plain visit into one row at the first visit's place, each name once", () => {
		const rows = groupBarnVisits([
			visit(1, "the piggler"),
			visit(2, "tegdirB"),
			blessing,
			visit(3, "the piggler"),
			visit(4, "coopatroopa"),
		]);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			source: "visits",
			key: "visits-1",
			names: ["the piggler", "tegdirB", "coopatroopa"],
			count: 4,
			route: null,
		});
		expect(rows[1]).toBe(blessing);
	});

	test("a visit that left a parting note keeps its own row", () => {
		const note = visit(3, "Seb", {
			title: "A note from your Barn",
			body: "Seb came by and left a parting note.",
			emoteId: "snout_boop",
		} as Partial<WhileAwayEvent>);
		const rows = groupBarnVisits([visit(1, "a"), visit(2, "b"), note]);
		expect(rows).toHaveLength(2);
		expect(rows[1]).toBe(note);
	});

	test("the folded row speaks in the server's voice, names first", () => {
		const group = (names: string[], count = names.length): WhileAwayVisitGroup => ({
			source: "visits",
			key: "visits-1",
			names,
			count,
			route: null,
		});
		expect(visitGroupCopy(group(["the piggler"], 2))).toEqual({
			title: "Someone visited your Barn!",
			body: "the piggler came by twice and tickled your pig!",
		});
		expect(visitGroupCopy(group(["a", "b"])).body).toBe("a and b came by and tickled your pig!");
		expect(visitGroupCopy(group(["the piggler", "tegdirB", "coopatroopa"], 4))).toEqual({
			title: "3 pigs visited your Barn!",
			body: "the piggler, tegdirB and coopatroopa came by and tickled your pig!",
		});
		expect(visitGroupCopy(group(["a", "b", "c", "d", "e"])).body).toBe(
			"a, b, c and 2 more came by and tickled your pig!",
		);
	});
});
