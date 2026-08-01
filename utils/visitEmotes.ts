import { createConfigCell } from "@/utils/configCell";

export const VISIT_EMOTE_IMAGES = {
	slop_thanks: require("../assets/images/visit-emotes/slop_thanks.png"),
	snout_boop: require("../assets/images/visit-emotes/snout_boop.png"),
	confetti_oink: require("../assets/images/visit-emotes/confetti_oink.png"),
	mud_bath: require("../assets/images/visit-emotes/mud_bath.png"),
	sleepy_pig: require("../assets/images/visit-emotes/sleepy_pig.png"),
	golden_wave: require("../assets/images/visit-emotes/golden_wave.png"),
} as const;

export type VisitEmoteId = keyof typeof VISIT_EMOTE_IMAGES;

export const VISIT_EMOTE_META: Record<
	VisitEmoteId,
	{ label: string; sendLine: string }
> = {
	slop_thanks: { label: "Thanks!", sendLine: "left a warm thank-you" },
	snout_boop: { label: "Boop", sendLine: "left a snout boop" },
	confetti_oink: { label: "Hooray!", sendLine: "left a little celebration" },
	mud_bath: { label: "Cozy", sendLine: "left cozy mud-bath wishes" },
	sleepy_pig: { label: "Nap well", sendLine: "wished your pig sweet dreams" },
	golden_wave: { label: "Bye!", sendLine: "left a golden goodbye" },
};

export const DEFAULT_VISIT_EMOTE_IDS = Object.freeze(
	Object.keys(VISIT_EMOTE_IMAGES) as VisitEmoteId[],
);

function sanitizeVisitEmotes(raw: unknown): VisitEmoteId[] {
	const ids =
		raw && typeof raw === "object" && Array.isArray((raw as { ids?: unknown }).ids)
			? (raw as { ids: unknown[] }).ids
			: [];
	const seen = new Set<VisitEmoteId>();
	for (const id of ids) {
		if (
			typeof id === "string" &&
			Object.prototype.hasOwnProperty.call(VISIT_EMOTE_IMAGES, id)
		) {
			seen.add(id as VisitEmoteId);
		}
	}
	return seen.size > 0 ? [...seen] : [...DEFAULT_VISIT_EMOTE_IDS];
}

const emoteCell = createConfigCell<VisitEmoteId[]>({
	key: "visit_emotes",
	fallback: DEFAULT_VISIT_EMOTE_IDS,
	sanitize: sanitizeVisitEmotes,
	equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
	cacheKey: "visit_emotes_v1",
	minRefreshMs: 60_000,
});

export const visitEmoteIds = emoteCell.read;
export const refreshVisitEmotes = emoteCell.refresh;
export const resetVisitEmotesForTests = emoteCell.resetForTests;
export { sanitizeVisitEmotes };
