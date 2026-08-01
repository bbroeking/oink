import {
	launchEventSourcesSucceeded,
	systemAnnouncementRoute,
	toWhileAwaySystemEvent,
} from "../utils/whileAway";

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
	test("trough_nudge with a drive_id routes to the Shop tab", () => {
		expect(systemAnnouncementRoute("trough_nudge", { drive_id: "drive-123" })).toBe(
			"/shop?trough=open"
		);
	});

	test("trough_nudge WITHOUT a drive_id has no destination (null)", () => {
		expect(systemAnnouncementRoute("trough_nudge", {})).toBeNull();
		expect(systemAnnouncementRoute("trough_nudge", null)).toBeNull();
		expect(systemAnnouncementRoute("trough_nudge", { drive_id: "" })).toBeNull();
	});

	test("an unknown / admin-note kind has no destination (null)", () => {
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
			title: "A friend needs your help!",
			body: "Chip in to land the item",
			route: "/shop?trough=open",
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
});
