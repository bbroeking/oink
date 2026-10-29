// The season's fiction, keyed by season id. Season 1 (`snout_season_1`) is The
// Great Hunger, Season 2 (`snout_season_2`) is The Feast. The machinery under
// both is the same (the Truffle Patch, the drum, the pass, the six-stage meter
// with its six stage ids); what moves is the copy and one hero sprite, so the
// Season tab, its story, its guide and the Feed panel read every word from
// here instead of a `s1 ? "The Great Hunger"` literal.
//
// Spec: docs/explorations/2026-10-29-season-2/proposal.md §1.A and §3.1 (1).
//
// CONTRACTS
//   • The six stage ids (gorged … famished) are the server's and never change:
//     old binaries index HUNGER_STAGE_LINE by them. A theme re-words them; it
//     never renames them. In the Feast the meter reads the other way (the
//     Larder FILLS as the herd digs) over the same ids, index 0 = Bare.
//   • An unknown or missing season id falls back to Season 1's theme, so a
//     future season the binary has never heard of never blanks a surface.
//   • Season 1's strings are the words the page printed before this file
//     existed, byte for byte (the tests pin the ones a player sees).
//   • No em dashes and no emoji in any string (lint + tests).
//
// Pure: no React, no rpc. The two image requires are the bundled hero sprites.
import type { ImageSourcePropType } from "react-native";
import type { GlyphName } from "@/components/ui";
import type { HungerStage } from "@/hooks/useHungerMeter";
import { CREW_CAP_WORD } from "@/constants/crews";

export type SeasonThemeId = "snout_season_1" | "snout_season_2";

export interface SeasonStoryBeat {
	g: GlyphName;
	kicker: string;
	line: string;
}

export interface SeasonGuideStep {
	g: GlyphName;
	title: string;
	line: string;
}

export interface SeasonTheme {
	id: SeasonThemeId;
	/** The tab's title and the `?` chooser's title. */
	title: string;
	/** The story and guide sheets' headline. */
	seasonName: string;
	/** The tab's kicker: `day 12 of 56 · the Hungerer is Stuffed`. */
	kicker: (day: number, totalDays: number, levelName: string) => string;
	/** Who the meter is about, for the sentence VoiceOver reads. */
	meterSubject: string;
	/** The six stage words under the meter's six blocks. */
	levelNames: Record<HungerStage, string>;
	/** One whisper per stage. */
	stageCopy: Record<HungerStage, string>;
	/** The one sentence under the Feed panel's meter. */
	meterLine: (lastDay: number) => string;
	/** The story sheet's four beats. */
	story: SeasonStoryBeat[];
	/** The guide's three steps. */
	guideSteps: SeasonGuideStep[];
	/** The guide's ladder: its kicker, the "you are here" tag, its footnote. */
	ladderKicker: string;
	ladderHere: string;
	ladderFoot: string;
	/** The Feed panel's hero and the title row's sprite. */
	heroArt: ImageSourcePropType;
	/** Season 1's opening cinematic tells the Hunger beginning; nothing else may play it. */
	hasIntroCinematic: boolean;
	/**
	 * The season began with a reset (Season 2's "full fresh start"), so a pig
	 * whose snouts / tickle bank / Satchel the flip zeroed is told so, once
	 * (FreshStartCard, fed by the server's my_season_reset()).
	 */
	announcesFreshStart: boolean;
}

const HUNGERER_CHIP = require("../assets/images/hunger/great_hungerer_chip.png");
const ROSIE_HAPPY = require("../assets/images/sprites/rosie/happy_1.png");

const THE_GREAT_HUNGER: SeasonTheme = {
	id: "snout_season_1",
	title: "The Great Hunger",
	seasonName: "The Season of the Hunger",
	kicker: (day, totalDays, levelName) =>
		`day ${day} of ${totalDays} · the Hungerer is ${levelName}`,
	meterSubject: "The Hungerer",
	levelNames: {
		gorged: "Gorged",
		stuffed: "Stuffed",
		full: "Full",
		peckish: "Peckish",
		hungry: "Hungry",
		famished: "Famished",
	},
	// Player-facing stage whisper (Patrick-Hand voice; the vignette shows the
	// feeling, this line names it, never a number, per the taste standard).
	stageCopy: {
		gorged: "He's gorged. The whole valley's joy in his belly.",
		stuffed: "Stuffed, and still smug about it.",
		full: "Full, but the hoard is thinning.",
		peckish: "Peckish. He's noticed the missing truffles.",
		hungry: "Hungry. His crown sits crooked.",
		famished: "Famished. One good shove and he's gone.",
	},
	// Truffles, not finds: the dig credits the meter with the truffles the herd
	// brings home and nothing else (Snout Deep, "truffles only").
	meterLine: (lastDay) =>
		`Every truffle dug back starves him a little. The herd wants him Famished by day ${lastDay}.`,
	story: [
		{
			g: "ghost",
			kicker: "the theft",
			line: "The Great Hungerer crept in one night and ate the valley's tickles, every last one.",
		},
		{
			g: "friends",
			kicker: "the sounders",
			line: `So pigs band into Sounders, ${CREW_CAP_WORD.toLowerCase()} snouts under one banner, because no pig shoos a hog alone.`,
		},
		{
			g: "gem",
			kicker: "the dig",
			line: "He gorges in 8-hour feedings: for the first four hours the patch lies open to sneaky snouts, then he guards it while he digests.",
		},
		{
			g: "crown",
			kicker: "the last feast",
			line: "Every truffle pried back leaves him a little weaker, until the whole herd starves him and takes the valley home.",
		},
	],
	guideSteps: [
		{
			g: "gem",
			title: "Dig every feeding",
			line: "Every 8 hours the Hungerer gorges. Dig the Truffle Patch open through his first four hours, then he guards it the next four while he digests. Whatever you tie off is yours to keep.",
		},
		{
			g: "gift",
			title: "Draw on Monday",
			line: "Every dig drops a ball in Monday's drum. On Monday the drum turns once for you, and the more balls you hold the better your purse tends to be. Nobody else's week changes yours.",
		},
		{
			// His crown, the thing the herd takes at Famished (the story's last
			// beat draws it too).
			g: "crown",
			title: "Starve the Hungerer",
			line: "Every truffle the herd digs back drains him, level by level, until the whole valley starves him to Famished and every digger with ten finds takes his crown.",
		},
	],
	ladderKicker: "steal back the tickles ★",
	ladderHere: " · he is here",
	ladderFoot:
		"He ate the valley's tickles. Every truffle the herd digs up pries them back. Starve him from Gorged to Famished.",
	heroArt: HUNGERER_CHIP,
	hasIntroCinematic: true,
	announcesFreshStart: false,
};

// The Feast. The herd starved him; he slunk off over the ridge, the tickles
// came back up out of the mud, and the pigs set a long table. The meter is
// the Larder now, and it fills.
const THE_FEAST: SeasonTheme = {
	id: "snout_season_2",
	title: "The Feast",
	seasonName: "The Season of the Feast",
	kicker: (day, totalDays, levelName) =>
		`day ${day} of ${totalDays} · the Larder is ${levelName}`,
	meterSubject: "The Larder",
	// Short words: six of them share one row on an SE, sized against
	// "Famished" (StageMeter's WIDEST_LABEL).
	levelNames: {
		gorged: "Bare",
		stuffed: "Sparse",
		full: "Stocked",
		peckish: "Full",
		hungry: "Heaping",
		famished: "Bursting",
	},
	stageCopy: {
		gorged: "The Larder's bare. Every truffle dug goes on the shelf.",
		stuffed: "A few jars on the shelf. It's starting to look like a pantry.",
		full: "Stocked. Somebody already set out the good plates.",
		peckish: "Full shelves, and the whole barn smells like warm bread.",
		hungry: "Heaping. The cellar door won't quite shut.",
		famished: "Bursting. Pull up a chair, the whole valley eats.",
	},
	meterLine: (lastDay) =>
		`Every truffle dug goes in the Larder. Fill it by day ${lastDay} and the whole valley eats.`,
	story: [
		{
			g: "sun",
			kicker: "the lean year ends",
			line: "The herd starved the Great Hungerer. He slunk off over the ridge, and the valley's tickles came back up out of the mud, fat and warm.",
		},
		{
			g: "friends",
			kicker: "the long table",
			line: "So the pigs did what pigs do when a lean year ends. They set a long table, end to end across the valley.",
		},
		{
			g: "truffle",
			kicker: "the larder",
			line: "Every truffle dug in the patch goes into the Larder, and the Larder fills by the week.",
		},
		{
			g: "party",
			kicker: "the feast",
			line: "When the shelves are bursting, the whole valley sits down to eat. Rosie has never been so happy.",
		},
	],
	guideSteps: [
		{
			g: "gem",
			title: "Dig every feeding",
			line: "Every 8 hours the Truffle Patch opens for four hours, then rests the next four. Whatever you tie off is yours to keep.",
		},
		{
			g: "gift",
			title: "Draw on Monday",
			line: "Every dig drops a ball in Monday's drum. On Monday the drum turns once for you, and the more balls you hold the better your purse tends to be. A purse below rare leaves one leftover ball in next week's drum. Nobody else's week changes yours.",
		},
		{
			g: "truffle",
			title: "Fill the Larder",
			line: "Every truffle the herd digs goes on the Larder's shelves, level by level, until it's Bursting and the whole valley sits down to eat.",
		},
	],
	ladderKicker: "fill the larder ★",
	ladderHere: " · the Larder is here",
	ladderFoot:
		"The tickles came back up out of the mud. Every truffle the herd digs goes on the shelf. Fill it from Bare to Bursting.",
	heroArt: ROSIE_HAPPY,
	hasIntroCinematic: false,
	announcesFreshStart: true,
};

export const SEASON_THEMES: Record<SeasonThemeId, SeasonTheme> = {
	snout_season_1: THE_GREAT_HUNGER,
	snout_season_2: THE_FEAST,
};

/** The fiction for a season id; anything unknown (or no season yet) reads as Season 1. */
export function seasonTheme(id: string | null | undefined): SeasonTheme {
	if (id && Object.prototype.hasOwnProperty.call(SEASON_THEMES, id)) {
		return SEASON_THEMES[id as SeasonThemeId];
	}
	return THE_GREAT_HUNGER;
}
