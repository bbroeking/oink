// The Field Guide entries — the eight evergreen economy pages (spec 16).
//
// Each page carries one WHIMSY line (what it is) and one VALUE line (what it does
// or pays). The value line is a function of the live server-config numbers
// (utils/fieldGuideConfig) so it can never lie after a rebalance — entry #8's
// value is computed straight from the feeding schedule.
//
// ART: use existing glyph/sprite art where one fits; where none does, the card
// ships a drawn ink-silhouette placeholder and the needed sprite is logged in
// docs/specs/reports/16-field-guide-art-todo.md for the founder's ImageGen lane.
// NO emoji (law). Echo is deliberately absent (founder cut).

import type { ImageSourcePropType } from "react-native";
import type { GlyphName } from "@/components/ui/Glyph";
import type { FieldGuidePageId } from "@/utils/fieldGuide";
import {
	type FieldGuideNumbers,
	feedingWindowsLine,
} from "@/utils/fieldGuideConfig";
import { HAT_IMAGES } from "@/constants/hats";
import { satchelTuning } from "@/utils/satchel";

const SNOUT_COIN = require("../assets/images/snout-coin.png");

export interface FieldGuideEntry {
	id: FieldGuidePageId;
	/** Player-facing name. */
	name: string;
	/** The whimsy-voice "what it is" line. */
	whimsy: string;
	/** The honest "what it does / pays" line, config-fed. */
	value: (cfg: FieldGuideNumbers) => string;
	/** One of: image (a real sprite), glyph (an existing glyph), or a drawn
	 *  ink-silhouette placeholder (art-todo logged). Exactly one is set. */
	image?: ImageSourcePropType;
	glyph?: GlyphName;
	placeholder?: boolean;
}

/** The Satchel page's value line — the bag cap and the tray size come from the
 *  live tuning (utils/satchel), the once-a-day rule is the server's gate. */
export function satchelLine(): string {
	const t = satchelTuning();
	return `Holds ${t.cap} finds. Hand a friend's pig what it's hoping for and take one of ${t.options} things back. Once a day per friend, and never for sale.`;
}

export const FIELD_GUIDE_ENTRIES: readonly FieldGuideEntry[] = [
	{
		id: "truffle",
		name: "Truffle",
		whimsy:
			"A fat knot of flavor the Hunger buried deep. Rosie can smell one from a field away.",
		value: () =>
			"Dig it from the patch to drain the Hungerer — every truffle you pull mints Golden Truffles.",
		placeholder: true, // needs a raw-truffle sprite (see art-todo)
	},
	{
		id: "golden_truffle",
		name: "Golden Truffle",
		whimsy: "The truffle, polished to a coin. Too pretty to eat, just right to spend.",
		value: (cfg) =>
			`Spend them in the Exchange — cosmetics start at ${cfg.exchangeMinPrice} Golden Truffles.`,
		image: HAT_IMAGES.golden_truffle,
	},
	{
		id: "lucky_number",
		name: "Lucky Number",
		whimsy:
			"Somewhere in the day's tickles hides a golden count. Land on it and the whole herd cheers.",
		value: (cfg) =>
			`${cfg.luckyDailyCount} lucky numbers hide in the herd's daily counter — hit one and +${cfg.luckyPayout} tickles land in your bank.`,
		placeholder: true, // needs a lucky-ticket / golden-number sprite (see art-todo)
	},
	{
		id: "trough",
		name: "Trough",
		whimsy: "A little stone bowl for wishes. Friends fill it until the wish comes true.",
		value: (cfg) =>
			`Friends fund the item; you seed the first ${cfg.troughSeedPct}%. Reach a quarter of a friend's Trough and draw one Barn design a week.`,
		placeholder: true, // needs a stone-trough sprite (see art-todo)
	},
	{
		id: "rituals",
		name: "Rituals",
		whimsy: "Every day has one blessing and one curse.",
		value: () => "Friends cast them on you; you wear them for six hours.",
		glyph: "bless",
	},
	{
		id: "snouts",
		name: "Snouts",
		whimsy: "The coin of the barnyard, minted one happy tap at a time.",
		value: () => "Every tap turns a tickle into a snout. Snouts buy the shop.",
		image: SNOUT_COIN,
	},
	{
		id: "exchange",
		name: "The Exchange",
		whimsy: "A muddy little market where truffles become finery.",
		value: () => "Trade Golden Truffles for cosmetics. Earn-only — no shortcuts, no cash.",
		glyph: "scales",
	},
	{
		id: "feeding_windows",
		name: "Feeding Windows",
		whimsy: "The Hunger only opens its mouth a few times a day. Dig while the window's wide.",
		value: () => feedingWindowsLine(),
		glyph: "sun",
	},
	{
		// The Satchel (docs/satchel-spec.md): the bag a Dig fills, the wish a pig
		// carries, and the swap on a visit. Numbers from satchel_tuning so a
		// retune can never make the page lie.
		id: "satchel",
		name: "The Satchel",
		whimsy: "A little bag that gets heavier every time you dig, and lighter every time you visit.",
		value: () => satchelLine(),
		glyph: "digBag",
	},
];
