import {
	DEFAULT_VISIT_EMOTE_IDS,
	sanitizeVisitEmotes,
	VISIT_EMOTE_IMAGES,
} from "@/utils/visitEmotes";

describe("visit emote catalog", () => {
	it("ships six commissioned, registered stickers", () => {
		expect(DEFAULT_VISIT_EMOTE_IDS).toHaveLength(6);
		for (const id of DEFAULT_VISIT_EMOTE_IDS) {
			expect(VISIT_EMOTE_IMAGES[id]).toBeTruthy();
		}
	});

	it("accepts server ordering while dropping unknown and duplicate ids", () => {
		expect(
			sanitizeVisitEmotes({
				ids: ["sleepy_pig", "not_in_this_binary", "slop_thanks", "sleepy_pig"],
			}),
		).toEqual(["sleepy_pig", "slop_thanks"]);
	});

	it("falls back to the compiled set for malformed or future-only config", () => {
		expect(sanitizeVisitEmotes({ ids: ["future_emote"] })).toEqual(
			DEFAULT_VISIT_EMOTE_IDS,
		);
		expect(sanitizeVisitEmotes(null)).toEqual(DEFAULT_VISIT_EMOTE_IDS);
	});
});
