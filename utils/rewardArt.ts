// ONE reward-art resolver — the single owner of the reward jsonb shape and the
// reward_type → art-source mapping that used to be hand-copied across the season
// tab's StoneThumb, YourTakeStrip's RewardArt, the ClaimRewardDialog preview, and
// (for the plain-id variants) SpoilsShowcase + RaceSection.
//
// PURE: the shape resolution lives here so it can't drift between renderers and
// is unit-testable. RENDERING stays in each component — resolveRewardArt returns
// a discriminated art-source KIND (+ the image source when there is one), and
// every call site maps that kind to its own exact JSX (sizes, colors, fallback
// glyphs differ per surface). StoneThumb is the superset; the lighter surfaces
// collapse the kinds they don't draw into their single star fallback.

import type { ImageSourcePropType } from "react-native";
import { HAT_IMAGES } from "@/constants/hats";

// The reward_value jsonb shape varies per reward_type (Supabase jsonb). Legacy
// seeds used category-specific keys (bg_id, aura_id, cape_id); the 20260514020000
// migration normalized those to hat_id, but the type still accepts the legacy keys
// for un-migrated rows. Kept structural + all-optional so callers with their own
// reward types (season.tsx's TierRow, YourTakeStrip's NextReward) pass straight
// through without importing a shared row type.
export type RewardValue =
	| {
			hat_id?: string;
			bg_id?: string;
			aura_id?: string;
			cape_id?: string;
			count?: number;
			amount?: number;
			title?: string;
	  }
	| null
	| undefined;

export interface RewardArtInput {
	reward_type: string;
	reward_value: RewardValue;
}

// Any hats-table item (hat/background/aura/cape/scarf/etc.) resolves to real art
// when its id is set. The set is identical across every former copy — one owner
// now. background/aura/cape live here too: they carry art when migrated (the
// image branch wins) and fall to their art-less glyph only when they don't.
export const WEARABLE_REWARD_TYPES = new Set<string>([
	"hat", "background", "aura", "cape", "scarf",
	"mask", "necklace", "glasses", "bow", "held",
]);

// The id-coalesce. The 20260514020000 migration normalized legacy
// bg_id/aura_id/cape_id keys to hat_id, but fall back to those anyway for
// forward-compat with un-migrated rows.
export function rewardItemId(val: RewardValue): string | null {
	return val?.hat_id ?? val?.bg_id ?? val?.aura_id ?? val?.cape_id ?? null;
}

// A resolved cosmetic sprite by bundled id, or undefined when the id has no art.
// The plain-id surfaces (SpoilsShowcase's shelf, RaceSection's last-race art) that
// carry a bare cosmetic id — not a reward_value — resolve through this.
export function cosmeticImage(id: string): ImageSourcePropType | undefined {
	return HAT_IMAGES[id];
}

// Humanize a cosmetic id ("mud_derby_bg" → "Mud Derby Bg"). The dig's race
// rewards resolve their art through HAT_IMAGES; the id is the only name carried,
// so title-case it rather than ship a raw slug.
export function cosmeticName(id: string): string {
	return id
		.split("_")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

// The discriminated art source. StoneThumb draws every kind; lighter surfaces map
// the ones they don't draw into their own star fallback. goldenTruffle and image
// are kept distinct (both are HAT_IMAGES art) because StoneThumb sizes them
// differently (34 vs 32).
export type RewardArt =
	| { kind: "tickles" }
	| { kind: "snouts" }
	| { kind: "goldenTruffle"; source: ImageSourcePropType }
	| { kind: "image"; source: ImageSourcePropType }
	| { kind: "title" }
	| { kind: "boost" }
	// Legacy background/aura/cape rows that carry NO resolvable art (no hat_id +
	// no HAT_IMAGES entry) — the image branch wins whenever art exists, so these
	// are the art-less fallback glyphs for un-migrated rows, not dead code.
	| { kind: "legacyBackground" }
	| { kind: "legacyAura" }
	| { kind: "legacyCape" }
	| { kind: "special" } // mystery_box | cap_increase | pig_skin
	| { kind: "fallback" };

// Resolve a reward's art source. Mirrors the exact branch ORDER the season tab's
// StoneThumb used — image resolution for wearables (background/aura/cape included)
// beats the art-less legacy glyphs, and golden_truffle only draws when its sprite
// is bundled.
export function resolveRewardArt(reward: RewardArtInput): RewardArt {
	const type = reward.reward_type;
	const itemId = rewardItemId(reward.reward_value);

	if (type === "tickles") return { kind: "tickles" };
	if (type === "snouts") return { kind: "snouts" };
	if (type === "golden_truffle" && HAT_IMAGES.golden_truffle) {
		return { kind: "goldenTruffle", source: HAT_IMAGES.golden_truffle };
	}
	if (WEARABLE_REWARD_TYPES.has(type) && itemId && HAT_IMAGES[itemId]) {
		return { kind: "image", source: HAT_IMAGES[itemId] };
	}
	if (type === "title") return { kind: "title" };
	if (type === "boost") return { kind: "boost" };
	if (type === "background") return { kind: "legacyBackground" };
	if (type === "aura") return { kind: "legacyAura" };
	if (type === "cape") return { kind: "legacyCape" };
	if (type === "mystery_box" || type === "cap_increase" || type === "pig_skin") {
		return { kind: "special" };
	}
	return { kind: "fallback" };
}
