// What each Snout Says picture is called and how it is drawn, plus the
// board's copy. No new art: every picture is a glyph the player already
// collects (components/ui/Glyph.tsx: the twelve finds and the fifteen dig
// things). The finds keep the Satchel's own names (constants/satchel.ts);
// the dig things take warm names for what their glyph shows (the dig's
// "furnishing" is drawn as a lantern, so here it is the barn lantern).
//
//   name         inside a sentence, after "the": "the honeycomb chip"
//   withArticle  after "of": "which one reminds them of an apple?"
//   short        a tile or bubble label: "honeycomb"
import { satchelFind } from "@/constants/satchel";
import type { GlyphName } from "@/components/ui";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { SnoutSaysOutcome, SnoutSaysRecord } from "@/multiplayer/games/snout_says/rules";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import type { Seat } from "@/multiplayer/types";

export interface PictureArt {
	glyph: GlyphName;
	name: string;
	withArticle: string;
	short: string;
}

type Drawn = Omit<PictureArt, "name" | "withArticle"> & Partial<Pick<PictureArt, "name" | "withArticle">>;

const ART: Readonly<Record<PictureId, Drawn>> = {
	// The finds: names from the Satchel catalog.
	river_pebble: { glyph: "findRiverPebble", short: "pebble" },
	blue_feather: { glyph: "findBlueFeather", short: "feather" },
	clover: { glyph: "findClover", short: "clover" },
	snail_shell: { glyph: "findSnailShell", short: "shell" },
	brass_button: { glyph: "findBrassButton", short: "button" },
	wool_tuft: { glyph: "findWoolTuft", short: "wool" },
	red_berries: { glyph: "findRedBerries", short: "berries" },
	pinecone: { glyph: "findPinecone", short: "pinecone" },
	old_key: { glyph: "findOldKey", short: "key" },
	honeycomb: { glyph: "findHoneycomb", short: "honeycomb" },
	marble: { glyph: "findMarble", short: "marble" },
	tin_whistle: { glyph: "findTinWhistle", short: "whistle" },
	// The dig things: named for the picture.
	acorn: { glyph: "digAcorn", name: "clockwork acorn", withArticle: "a clockwork acorn", short: "acorn" },
	apple: { glyph: "digApple", name: "apple", withArticle: "an apple", short: "apple" },
	bag: { glyph: "digBag", name: "satchel", withArticle: "a satchel", short: "satchel" },
	boom: { glyph: "digBoom", name: "tickle boom", withArticle: "a tickle boom", short: "boom" },
	boot: { glyph: "digBoot", name: "old boot", withArticle: "an old boot", short: "boot" },
	bow: { glyph: "digBow", name: "pink bow", withArticle: "a pink bow", short: "bow" },
	cap: { glyph: "digCap", name: "bottle cap", withArticle: "a bottle cap", short: "bottle cap" },
	charm: { glyph: "digCharm", name: "heart charm", withArticle: "a heart charm", short: "charm" },
	furnishing: { glyph: "digFurnishing", name: "barn lantern", withArticle: "a barn lantern", short: "lantern" },
	horseshoe: { glyph: "digHorseshoe", name: "horseshoe", withArticle: "a horseshoe", short: "horseshoe" },
	pouch: { glyph: "digPouch", name: "snout pouch", withArticle: "a snout pouch", short: "pouch" },
	relic: { glyph: "digRelic", name: "snout stone", withArticle: "a snout stone", short: "snout stone" },
	scroll: { glyph: "digScroll", name: "scroll", withArticle: "a scroll", short: "scroll" },
	shimmer: { glyph: "digShimmer", name: "shimmer crystal", withArticle: "a shimmer crystal", short: "crystal" },
	tea: { glyph: "digTea", name: "flask of warm tea", withArticle: "a flask of warm tea", short: "tea" },
};

export function pictureArt(id: PictureId): PictureArt {
	const art = ART[id];
	const find = satchelFind(id);
	return {
		glyph: art.glyph,
		short: art.short,
		name: art.name ?? find?.name ?? art.short,
		withArticle: art.withArticle ?? find?.withArticle ?? `a ${art.short}`,
	};
}

/** "the honeycomb chip" */
export function theName(id: PictureId): string {
	return `the ${pictureArt(id).name}`;
}

// ── Seats ───────────────────────────────────────────────────────────────────

export function seatName(room: RoomSnapshot<unknown>, seat: Seat): string {
	return room.seats.find((s) => s.seat === seat)?.name ?? "a pig";
}

/** "Clover", "Clover and Pip", "Clover, Pip and Bun". */
export function listWords(words: readonly string[]): string {
	if (words.length <= 1) return words[0] ?? "";
	return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// ── Outcomes ────────────────────────────────────────────────────────────────

export const OUTCOME_WORD: Readonly<Record<SnoutSaysOutcome, string>> = {
	knew: "knew",
	nearly: "nearly",
	got_away: "got away",
	mud: "in the mud",
};

/** The hand line under the outcome word. Never a seat's name. */
export function outcomeLine(record: Pick<SnoutSaysRecord, "outcome" | "score">): string {
	switch (record.outcome) {
		case "knew":
			return `a nose that knew. +${record.score}`;
		case "nearly":
			return `on the second sniff. +${record.score}`;
		case "got_away":
			return "that one got away.";
		case "mud":
		default:
			return "no guess this round.";
	}
}

export function tallyLine(total: number, max: number): string {
	return `${total} of ${max} so far`;
}

// ── The Guesser's hand line ─────────────────────────────────────────────────

/**
 * What the Guesser reads over the spread. `who` names the one Nose on a
 * two-pig table ("Clover"); bigger tables say "them".
 */
export function guessPrompt(clues: readonly PictureId[], who: string | null): string {
	if (clues.length === 0) return "nothing landed, so three tiles fogged over.";
	const them = who ?? "them";
	if (clues.length === 1) return `which one reminds ${them} of ${pictureArt(clues[0]).withArticle}?`;
	return `${listWords(clues.map((c) => pictureArt(c).withArticle))}. which one do they mean?`;
}

// ── The result bands ────────────────────────────────────────────────────────

export interface Band {
	title: string;
	line: string;
}

/** The warm line by outcome band (spec §4.2, bands of 12; an async table's
 *  six scale to the same fractions). Every band reads as something the
 *  table did together, never as a grade. */
export function bandFor(total: number, max: number): Band {
	const of = `${total} of ${max}`;
	const twelfths = max > 0 ? (total * 12) / max : 0;
	if (total <= 0) return { title: "Nothing landed, nothing lost.", line: `${of}. that was a strange tray.` };
	if (twelfths >= 10) return { title: "One language, no words.", line: `${of}. snout says: again?` };
	if (twelfths >= 6) return { title: "Most of them landed.", line: `${of}. the misses were the funny part.` };
	return { title: "A few landed.", line: `${of}. snouts are hard to read.` };
}

/** A table that lost a pig before the end. */
export function leftBand(total: number): Band {
	return { title: "We'll finish this one another time.", line: `${total} so far.` };
}
