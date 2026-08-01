// Privacy-light first-party interaction analytics.
//
// This is the only client write seam for product events. The vocabulary is
// intentionally closed: call sites cannot send usernames, messages, arbitrary
// property keys, or nested payloads. The server repeats every validation before
// accepting an event; these checks keep mistakes from reaching the network.

import { rpcAction } from "./rpc";

export const ANALYTICS_EVENT_SURFACES = {
	barn_opened: ["barn", "visit"],
	barn_tickle_succeeded: ["visit"],
	visit_stamp_left: ["visit", "guestbook"],
	guestbook_opened: ["barn", "guestbook"],
	porch_round_started: ["porch_round"],
	porch_stop_completed: ["porch_round", "visit"],
	porch_round_completed: ["porch_round"],
	ritual_picker_opened: ["ritual", "visit"],
	blessing_cast: ["ritual", "visit"],
	curse_cast: ["ritual"],
	kindness_card_offered: ["visit"],
	kindness_card_left: ["visit"],
	kindness_card_opened: ["inbox"],
	rooting_opened: ["feeding"],
	rooting_submitted: ["feeding"],
	find_revealed: ["feeding"],
	dig_postcard_created: ["feeding", "share"],
	dig_postcard_opened: ["inbox"],
	dig_postcard_cheered: ["inbox"],
	lounge_entered: ["lounge"],
	emote_sent: ["lounge"],
	seat_claimed: ["lounge"],
	item_previewed: ["shop", "closet"],
	item_bought: ["shop"],
	item_equipped: ["shop", "closet"],
	season_opened: ["season"],
	bounty_claimed: ["season"],
	tier_claimed: ["season"],
	share_created: ["share"],
	share_sheet_completed: ["share"],
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_SURFACES;
export type AnalyticsSurface =
	(typeof ANALYTICS_EVENT_SURFACES)[AnalyticsEventName][number];

export type AnalyticsTargetKind =
	| "barn"
	| "bounty"
	| "find"
	| "item"
	| "pig"
	| "postcard"
	| "tier";

export type AnalyticsResult =
	| "cancelled"
	| "completed"
	| "failed"
	| "succeeded"
	| "unavailable";

export interface AnalyticsProperties {
	count?: number;
	is_member?: boolean;
	item_kind?: "background" | "habitat" | "pig" | "wearable";
	share_method?: "copy" | "native_sheet" | "save";
	source?: "cta" | "inbox" | "notification" | "organic";
	variant?: string;
}

export interface InteractionEvent {
	eventName: AnalyticsEventName;
	surface: AnalyticsSurface;
	targetKind?: AnalyticsTargetKind;
	targetUserId?: string;
	result?: AnalyticsResult;
	contentId?: string;
	experiment?: string;
	properties?: AnalyticsProperties;
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TOKEN_RE = /^[a-z0-9][a-z0-9_.:-]*$/i;
const PROPERTY_KEYS = new Set<keyof AnalyticsProperties>([
	"count",
	"is_member",
	"item_kind",
	"share_method",
	"source",
	"variant",
]);

export function createAnalyticsSessionId(random: () => number = Math.random): string {
	const hex = Array.from({ length: 32 }, () =>
		Math.floor(random() * 16).toString(16)
	);
	hex[12] = "4";
	hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex
		.slice(12, 16)
		.join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

// One pseudonymous session per app process. It is deliberately not persisted:
// a restart is a new session and no device identifier is collected.
export const analyticsSessionId = createAnalyticsSessionId();

function validToken(value: unknown, maxLength = 80): boolean {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value.length <= maxLength &&
		SAFE_TOKEN_RE.test(value)
	);
}

function validProperties(properties: unknown): properties is AnalyticsProperties {
	if (properties == null) return true;
	if (typeof properties !== "object" || Array.isArray(properties)) return false;

	for (const [key, value] of Object.entries(properties)) {
		if (!PROPERTY_KEYS.has(key as keyof AnalyticsProperties)) return false;
		if (key === "count") {
			if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10_000)
				return false;
		} else if (key === "is_member") {
			if (typeof value !== "boolean") return false;
		} else if (!validToken(value, 40)) {
			return false;
		}
	}
	return true;
}

export function isValidInteractionEvent(event: InteractionEvent): boolean {
	const surfaces = ANALYTICS_EVENT_SURFACES[event.eventName] as
		| readonly string[]
		| undefined;
	if (!surfaces?.includes(event.surface)) return false;
	if (event.targetUserId != null && !UUID_RE.test(event.targetUserId)) return false;
	if (event.targetKind != null && !validToken(event.targetKind, 40)) return false;
	if (event.result != null && !validToken(event.result, 40)) return false;
	if (event.contentId != null && !validToken(event.contentId)) return false;
	if (event.experiment != null && !validToken(event.experiment)) return false;
	return validProperties(event.properties);
}

/**
 * Records one allow-listed event. Analytics must never interrupt play, so an
 * invalid payload, unpushed migration, offline request, or server refusal all
 * resolve to false instead of throwing.
 */
export async function trackInteraction(event: InteractionEvent): Promise<boolean> {
	if (!isValidInteractionEvent(event)) return false;

	try {
		const result = await rpcAction("record_interaction_event", {
			p_session_id: analyticsSessionId,
			p_event_name: event.eventName,
			p_surface: event.surface,
			p_target_kind: event.targetKind ?? null,
			p_target_user_id: event.targetUserId ?? null,
			p_result: event.result ?? null,
			p_content_id: event.contentId ?? null,
			p_experiment: event.experiment ?? null,
			p_properties: event.properties ?? {},
		});
		return result.ok;
	} catch {
		return false;
	}
}
