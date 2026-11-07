// Bullion's Market — every sentence the market says, as pure functions.
//
// Bullion speaks in the first person and short ("I buy a little under the
// price and sell a little over. That's my cut."). Receipts lead with what
// happened and carry the one number that teaches the market: where the price
// went, or how much a pig beat the counter by. Lifted from the round-4
// prototype's copy, so the shipped market reads the way it was playtested.
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import { MARKET_TUNING, fmtPrice, gainWord, type MarketTuning } from "@/constants/market";
import { findPlural } from "@/utils/trader";
import {
	isIndefinite,
	pigName,
	type MarketFind,
	type MarketFriend,
	type MarketNotice,
	type MarketOffer,
	type MarketOutcome,
	type MarketTrade,
} from "@/utils/market";

export type BullionPose = "stand" | "counter" | "gavel" | "cheer" | "shrug";

export interface MarketReceipt {
	pose: BullionPose;
	title: string;
	line?: string;
	/** A ribbon across the card ("beat the counter"). */
	ribbon?: string;
	tone: "plain" | "moment" | "meh";
}

const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function findName(id: SatchelFindId): string {
	return satchelFind(id)?.name ?? "find";
}

/** "3 pinecones", "a tin whistle" — a set of a find. One is said with its
 *  article, as the server's pushes say it. */
export function setOf(id: SatchelFindId, size: number): string {
	return size === 1 ? (satchelFind(id)?.withArticle ?? `a ${findName(id)}`) : `${size} ${findPlural(id)}`;
}

/** A set after "your" or "Maya's": "your 3 pinecones", "your tin whistle". */
export function ownSetOf(id: SatchelFindId, size: number): string {
	return size === 1 ? findName(id) : `${size} ${findPlural(id)}`;
}

/** "1 old key" / "2 old keys". */
export function qtyOf(id: SatchelFindId, n: number): string {
	return `${n} ${n === 1 ? findName(id) : findPlural(id)}`;
}

// ── The tunables, in words ───────────────────────────────────────────────────
// Every number the market quotes in a sentence comes off `state.tuning`, so a
// rebalance (set sizes, the price's step, listing hours) never leaves a stale
// sentence behind.

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** "three of a common, two of an uncommon, or a rare on its own" (or "four of
 *  a common, three of the rest" when two rarities agree). Said after "A set
 *  is", on its own as a sentence, and as a kicker. */
export function setSizeWords(t: MarketTuning = MARKET_TUNING): string {
	const { common, uncommon, rare } = t.setSize;
	const of = (n: number, which: string) => (n === 1 ? `${which} on its own` : `${numberWord(n)} of ${which}`);
	if (common === uncommon && uncommon === rare) return of(common, "any find");
	if (uncommon === rare) return `${of(common, "a common")}, ${uncommon === 1 ? "the rest on their own" : `${numberWord(uncommon)} of the rest`}`;
	return `${of(common, "a common")}, ${of(uncommon, "an uncommon")}, or ${of(rare, "a rare")}`;
}

/** "a set of 3" / "one at a time": how one find trades, for a label. */
export function setSizeLabel(size: number): string {
	return size === 1 ? "one at a time" : `a set of ${size}`;
}

/** Why you cannot hand over a set: "You have 2 of 3." / "You have no tin whistles." */
export function shortOfSet(id: SatchelFindId, held: number, size: number): string {
	return size === 1 ? `You have no ${findPlural(id)}.` : `You have ${held} of ${size}.`;
}

/** 0.05 → "5%". */
export function pctWord(x: number): string {
	return `${Math.round(x * 1000) / 10}%`;
}

/** A pig sale's pull, as far as it goes: "a third", "half", or a percent. */
export function pullWord(x: number): string {
	const near = (y: number) => Math.abs(x - y) < 0.005;
	if (near(1 / 2)) return "half";
	if (near(1 / 3)) return "a third";
	if (near(1 / 4)) return "a quarter";
	if (near(2 / 3)) return "two thirds";
	return pctWord(x);
}

/** A listing's life: "48 hours", "an hour". */
export function hoursWord(h: number): string {
	return h === 1 ? "an hour" : `${h} hours`;
}

/** The span the ledger (spent / took in) covers: the server keeps one
 *  running total from the market's first day. */
export const LEDGER_SPAN = "since the market opened";

/** One pig's share of Bullion's daily shelf, said before and after the tap. */
export function shelfLimitWords(perPig: number | null): { title: string; line: string } {
	if (perPig === 0) return { title: "Nothing from my shelf today, friend", line: "Come back tomorrow." };
	return { title: `${cap1(numberWord(perPig ?? 1))} from my shelf a day, friend`, line: "Come back tomorrow." };
}

/** Why a set costs more than the bank can hold, said where it matters. */
export function capLine(cap: number): string {
	return `You hold up to ${cap} ready; selling a set can bank more.`;
}

/** Short names for the find picker. */
export const SHORT_NAME: Readonly<Record<SatchelFindId, string>> = {
	river_pebble: "pebble",
	blue_feather: "feather",
	clover: "clover",
	snail_shell: "snail",
	brass_button: "button",
	wool_tuft: "wool",
	red_berries: "berries",
	pinecone: "pinecone",
	old_key: "old key",
	honeycomb: "honeycomb",
	marble: "marble",
	tin_whistle: "whistle",
};

/** Bullion's tips, turned in sequence on the market home. */
export const BULLION_TIPS: readonly string[] = [
	"Every find has one price. Trade it with me right now, or with a pig for a better deal.",
	"I buy a little under the price and sell a little over. That's my cut.",
	"Price it between my two prices and you'll both beat my counter.",
	"Every set you buy from me pushes the price up. Every set you sell pulls it down.",
	"When it's quiet the price wiggles, then wanders back home.",
	"A swap doesn't move the price. A sale between pigs nudges it.",
	"Every pig's Ghost Sheep fancies something different. That's why we trade!",
];

/** What Bullion says on the market home: yesterday's news, or a tip. */
export function bullionSays(
	turn: number,
	yesterday: { findId: SatchelFindId; sets: number; lo: number; hi: number } | null,
): string {
	if (turn % 2 === 0 && yesterday && yesterday.sets > 0) {
		return `${cap1(findPlural(yesterday.findId))} were busy yesterday: ${yesterday.sets} ${yesterday.sets === 1 ? "set" : "sets"}, the price between ${fmtPrice(yesterday.lo)} and ${fmtPrice(yesterday.hi)}.`;
	}
	return BULLION_TIPS[Math.floor(turn / 2) % BULLION_TIPS.length];
}

// The second and third cards say nothing a rebalance can change.
const ONBOARDING_REST: readonly { title: string; say: string }[] = [
	{
		title: "Prices move.",
		say: "Every set you buy from me pushes the price up. Every set you sell pulls it down. When it's quiet the price wiggles, then wanders back home. I buy a little under the price and sell a little over: that's my cut.",
	},
	{
		title: "Or trade with a pig.",
		say: "Post your set on the noticeboard at your own price, or swap it straight up. Price it between my two prices and you'll both beat my counter. That's how you sell high.",
	},
];

/** The three onboarding cards, in Bullion's voice; the set sizes off `tuning`. */
export function onboardingCards(t: MarketTuning = MARKET_TUNING): readonly { title: string; say: string }[] {
	return [
		{
			title: "Buy or sell any set, any time.",
			say: `Hand me a set and I'll pay you on the spot. Need a set? I've always got one. ${cap1(setSizeWords(t))}.`,
		},
		...ONBOARDING_REST,
	];
}

/** One trade on the market home's ticker. */
export function tickerLine(tr: MarketTrade, size: number): { tag: "you" | "counter" | "board" | "town" | "swap"; text: string } {
	const set = setOf(tr.findId, size);
	const mine = tr.buyer?.you || tr.seller?.you;
	if (tr.kind === "counter") {
		const text =
			tr.side === "buy"
				? `${cap1(pigName(tr.buyer))} bought ${set} from Bullion · ${tr.price}`
				: `${cap1(pigName(tr.seller))} sold Bullion ${set} · ${tr.price}`;
		return { tag: mine ? "you" : tr.how === "board" ? "board" : "counter", text: tr.how === "board" ? `${text} · daily shelf` : text };
	}
	if (tr.kind === "pig") {
		return { tag: mine ? "you" : "board", text: `${cap1(pigName(tr.buyer))} bought ${set} from ${pigName(tr.seller)} · ${tr.price}` };
	}
	if (tr.kind === "print") {
		return { tag: "town", text: `${cap1(tr.who ?? "the townsfolk")} ${tr.dir === "up" ? "bought" : "sold"} ${set} · ${tr.price}` };
	}
	return {
		tag: mine ? "you" : "swap",
		text: `${cap1(pigName(tr.buyer))} swapped ${tr.wantFindId ? qtyOf(tr.wantFindId, tr.wantQty ?? 1) : "a find"} for ${set}`,
	};
}

/** One trade on a find's "last trades" list. */
export function tradeLine(tr: MarketTrade, viewing: SatchelFindId, size: number): { text: string; tag: string } {
	if (tr.kind === "counter") {
		return tr.side === "buy"
			? { text: `${cap1(pigName(tr.buyer))} bought from Bullion${tr.how === "board" ? "’s daily shelf" : ""}`, tag: tr.how === "board" ? "board" : "counter" }
			: { text: `${cap1(pigName(tr.seller))} sold to Bullion`, tag: "counter" };
	}
	if (tr.kind === "pig") return { text: `${cap1(pigName(tr.buyer))} bought from ${pigName(tr.seller)}`, tag: "board" };
	if (tr.kind === "print") return { text: `${cap1(tr.who ?? "the townsfolk")} ${tr.dir === "up" ? "bought" : "sold"}`, tag: "town" };
	const gave = tr.wantFindId ? qtyOf(tr.wantFindId, tr.wantQty ?? 1) : "a find";
	// "these" is the find being viewed: the set they got, or what they gave.
	const these = (n: number) => (n === 1 ? (satchelFind(viewing)?.withArticle ?? "one") : "these");
	return tr.findId === viewing
		? { text: `${cap1(pigName(tr.buyer))} swapped ${gave} for ${these(size)}`, tag: "swap" }
		: { text: `${cap1(pigName(tr.buyer))} swapped ${these(tr.wantQty ?? 1)} for ${setOf(tr.findId, size)}`, tag: "swap" };
}

function costLine(tr: MarketTrade): string {
	const price = tr.price ?? 0;
	if (tr.cost == null) return `you dug ${tr.qty === 1 ? "it" : "them"} up · +${price}`;
	return `paid ${tr.cost} · sold for ${price} · ${gainWord(price - tr.cost)}`;
}

function moveLine(tr: MarketTrade): string {
	return tr.from != null && tr.to != null ? `${fmtPrice(tr.from)} → ${fmtPrice(tr.to)}` : "";
}

/** The receipt for a trade YOU made or that happened to your listing. A buy
 *  never quotes the Ghost Sheep: his double is for finds you did not buy
 *  (2026-11 balance pass), so a bought set pays him the plain price. */
export function tradeReceipt(tr: MarketTrade): MarketReceipt {
	const set = setOf(tr.findId, tr.qty);
	const yours = ownSetOf(tr.findId, tr.qty);
	const mv = moveLine(tr);
	if (tr.kind === "counter") {
		if (tr.side === "sell") {
			const crossed = tr.how === "crossed" && tr.listed != null;
			return {
				pose: "gavel",
				title: `Bullion bought your ${yours} for ${tr.price}`,
				line: crossed
					? `His buying price reached your ${tr.listed}: a listing at or under it sells to him, at his price.`
					: `${costLine(tr)} · the price went ${mv}`,
				tone: "plain",
			};
		}
		const crossed = tr.how === "crossed" && tr.listed != null;
		return {
			pose: "gavel",
			title: crossed ? `Bullion sold you ${set} for ${tr.price}` : `You bought ${set} from Bullion for ${tr.price}`,
			line: crossed ? `His selling price came down to your ${tr.listed}: you got his price.` : `${tr.how === "board" ? "From his daily shelf · " : ""}the price went ${mv}`,
			tone: "plain",
		};
	}
	if (tr.kind === "pig") {
		if (tr.seller?.you) {
			const by = cap1(pigName(tr.buyer));
			const plus = (tr.price ?? 0) - (tr.bid ?? 0);
			return {
				pose: "cheer",
				ribbon: plus > 0 ? "beat the counter" : undefined,
				title: `${by} bought your ${yours} for ${tr.price}`,
				line:
					plus > 0
						? `Bullion would have paid ${tr.bid} · +${plus} ${tr.how === "listing" ? "for listing it" : "for selling to a pig"}`
						: plus === 0
							? "The same as Bullion pays."
							: `${-plus} under what Bullion pays (${tr.bid}).`,
				tone: "plain",
			};
		}
		const from = cap1(pigName(tr.seller));
		const saved = (tr.ask ?? 0) - (tr.price ?? 0);
		return {
			pose: "cheer",
			title: tr.how === "wanted" ? `${from} sold you ${set} for ${tr.price}` : `You bought ${set} from ${pigName(tr.seller)} for ${tr.price}`,
			line: `Bullion charges ${tr.ask}${saved > 0 ? ` · ${saved} saved buying from a pig` : ""}`,
			tone: "plain",
		};
	}
	if (tr.kind === "swap") {
		const gave = tr.wantFindId ? qtyOf(tr.wantFindId, tr.wantQty ?? 1) : "a find";
		if (tr.seller?.you) {
			return { pose: "cheer", title: `${cap1(pigName(tr.buyer))} took your swap`, line: `Gave ${set}, got ${gave} · straight up`, tone: "plain" };
		}
		return { pose: "cheer", title: `You swapped ${gave} for ${set}`, line: "Straight up: no tickles, and the price stays put.", tone: "plain" };
	}
	return { pose: "stand", title: "A trade", tone: "plain" };
}

/** A one-time moment: the first quiet price you watch wander home. */
export function quietMoment(findId: SatchelFindId, price: number, usual: number): MarketReceipt {
	return {
		pose: "stand",
		title: `Nobody's traded ${findPlural(findId)} for a while`,
		line: `The price is wandering home: ${fmtPrice(price)} now, and ${usual} is usual.`,
		tone: "moment",
	};
}

/** A one-time moment: the first time a pig pays you more than Bullion would have. */
export function soldHighMoment(tr: MarketTrade): MarketReceipt | null {
	if (tr.kind !== "pig" || !tr.seller?.you || tr.price == null || tr.bid == null) return null;
	const plus = tr.price - tr.bid;
	if (plus <= 0) return null;
	return {
		pose: "cheer",
		title: "Nice selling.",
		line: `${cap1(pigName(tr.buyer))} paid ${plus} more than I would have.`,
		tone: "moment",
	};
}

/** The receipt a NOTICE wears (things that happened while you were away).
 *  `friends` names the friend a private listing was offered to. */
export function noticeReceipt(n: MarketNotice, t: MarketTuning = MARKET_TUNING, friends: readonly MarketFriend[] = []): MarketReceipt | null {
	const o: MarketOffer | null = n.offer;
	if ((n.kind === "filled" || n.kind === "crossed" || n.kind === "swapped") && n.trade) {
		return tradeReceipt(n.trade);
	}
	if (!o) return null;
	// A listing's qty is its set size, straight from the server.
	const set = setOf(o.findId, o.qty);
	const yours = ownSetOf(o.findId, o.qty);
	// The one friend a listing was offered to left the game: it came down, and
	// a held set came home (a wanted ad set nothing aside).
	if (n.kind === "expired" && o.ended === "target_left") {
		const name = friends.find((f) => f.id === o.targetId)?.name ?? null;
		return {
			pose: "stand",
			title: name ? `Your offer to ${name} came home` : "Your private offer came home",
			line: o.side === "buy" ? "They've left the game, so I took your wanted ad down." : "They've left the game, so your set is back in your bag.",
			tone: "meh",
		};
	}
	if (n.kind === "expired") {
		const life = hoursWord(t.offerHours);
		if (o.side === "sell") return { pose: "shrug", title: `Your ${yours} came home`, line: `Nobody took ${o.qty === 1 ? "it" : "them"} at ${o.price} in ${life}.`, tone: "meh" };
		if (o.side === "buy") return { pose: "shrug", title: `Your wanted ad for ${findPlural(o.findId)} ran out`, line: `Nobody sold at ${o.price} in ${life}.`, tone: "meh" };
		return { pose: "shrug", title: "Your swap ran out", line: `Your ${yours} ${o.qty === 1 ? "is" : "are"} back in your bag.`, tone: "meh" };
	}
	// The season's fresh start ended a listing pinned before it. A wanted ad
	// set nothing aside; a for-sale or swap set was part of the bag that reset.
	if (n.kind === "reset") {
		if (o.side === "buy") {
			return {
				pose: "stand",
				title: `Your wanted ad for ${findPlural(o.findId)} came down`,
				line: "Season 2 started every bank and bag fresh, so I cleared the board. Post a new one whenever you like.",
				tone: "meh",
			};
		}
		return {
			pose: "stand",
			title: o.side === "swap" ? "Your swap went with the fresh start" : `Your ${yours} went with the fresh start`,
			line: "Season 2 swept every bag clean, so I took your listing down and the set went with it. Pin a fresh one whenever you're ready.",
			tone: "meh",
		};
	}
	if (n.kind === "lapsed") {
		return { pose: "shrug", title: `Your wanted ad for ${findPlural(o.findId)} lapsed`, line: `A seller came, but you had fewer than ${o.price} tickles ready.`, tone: "meh" };
	}
	if (n.kind === "for_you") {
		const what = o.side === "swap" && o.wantFindId ? `${set} for ${qtyOf(o.wantFindId, o.wantQty ?? 1)}` : `${set} for ${o.price}`;
		return { pose: "stand", title: "A friend sent you an offer", line: `${cap1(what)} · on the noticeboard, For you`, tone: "plain" };
	}
	return null;
}

/** A write that never heard back: it may have traded. Said inside the open
 *  sheet, where the retry is (the retry replays the same trade). */
export const LOST_ANSWER = Object.freeze({
	title: "Couldn't hear back from Bullion",
	line: "Check your bag before you try again.",
});

/** A refusal, in Bullion's voice. */
export function refusalReceipt(res: Extract<MarketOutcome, { ok: false }>, findId: SatchelFindId | null, openOffers: number, dailyPosts: number): MarketReceipt {
	const meh = (title: string, line?: string): MarketReceipt => ({ pose: "shrug", title, line, tone: "meh" });
	switch (res.reason) {
		case "price_moved":
			return meh("The price moved", res.now != null ? `It's ${res.now} now. Take another look.` : "Take another look.");
		case "not_enough_tickles":
			return meh("Not enough tickles ready", `You have ${res.ready ?? 0}; it needs ${res.needed ?? "more"}.`);
		case "not_a_set":
			return meh(
				res.setSize === 1 ? "A set is just one" : `A set is ${res.setSize ?? "a few"}`,
				`You have ${findId ? qtyOf(findId, res.held ?? 0) : `${res.held ?? 0} of those`}.`,
			);
		case "too_many_offers":
			return meh(`You have ${openOffers} listings up`, "Take one down to pin another.");
		case "too_many_today":
			return meh(`That's ${dailyPosts} listings today`, "Try again tomorrow.");
		case "not_enough":
			return meh(`You need ${res.needed ?? "more"}`, `You have ${res.held ?? 0}.`);
		case "lapsed":
			return meh("That wanted ad lapsed", "The pig had tickled its tickles away.");
		case "not_found":
			return meh("That listing is gone", "Another pig got there first.");
		case "own_offer":
			return meh("That one's yours", "Take it down from Your listings instead.");
		case "not_a_friend":
			return meh("Only friends", "A listing can go to everyone, or to one friend.");
		case "counter_limit":
			return meh("That's enough at my counter today", "Come back tomorrow.");
		case "shelf_limit": {
			const w = shelfLimitWords(res.limit ?? null);
			return meh(w.title, w.line);
		}
		case "no_bank":
			return meh("Your tickle bank isn't ready", "Tickle your pig once, then come back.");
		case "closed":
			return meh("The market's shut", "Bullion's packed up for now.");
		case "network":
		case "no_data":
		case "timeout":
			// It may have traded: never say it didn't.
			return meh(LOST_ANSWER.title, LOST_ANSWER.line);
		default:
			return meh("That didn't go through", "Take another look.");
	}
}

/** The first price you move: shown once, ever. */
export function movedMoment(tr: MarketTrade, t: MarketTuning = MARKET_TUNING): MarketReceipt {
	const how =
		tr.kind === "counter"
			? tr.how === "board"
				? "Every set bought from me nudges it."
				: "Every set at my counter nudges it."
			: `A pig sale nudges it ${pullWord(t.price.pigPull)} of the way.`;
	return { pose: "cheer", title: "You moved the price!", line: `${cap1(findPlural(tr.findId))} ${moveLine(tr)}. ${how}`, tone: "moment" };
}

/** Taking a listing down didn't work, and why. */
export function takeDownReceipt(reason: string | null): MarketReceipt {
	if (reason === "not_found") {
		return { pose: "shrug", title: "That listing is already down", line: "It sold, ran out, or came down already.", tone: "meh" };
	}
	if (isIndefinite({ ok: false, reason })) {
		return { pose: "shrug", title: LOST_ANSWER.title, line: "It may still be up. Look at Your listings before you try again.", tone: "meh" };
	}
	if (reason === "not_authenticated") {
		return { pose: "shrug", title: "You're signed out", line: "Sign in again, then take it down.", tone: "meh" };
	}
	return { pose: "shrug", title: "That listing didn't come down", line: "Take another look.", tone: "meh" };
}

/** Your listing is up. */
export function pinnedReceipt(offer: MarketOffer, f: MarketFind | null, t: MarketTuning = MARKET_TUNING): MarketReceipt {
	return {
		pose: "stand",
		title: "Pinned to the noticeboard",
		line:
			offer.side === "swap"
				? `Straight up, for ${hoursWord(t.offerHours)}. Take it down any time.`
				: `${offer.side === "sell" ? "For sale" : "Wanted"} at ${offer.price}${f ? `: Bullion pays ${f.bid}, charges ${f.ask}` : ""}.`,
		tone: "plain",
	};
}

/** The onboarding's last step for a pig with no full set yet: what to do first. */
export function firstStepsCard(t: MarketTuning, canBuy: boolean): MarketReceipt {
	return {
		pose: "counter",
		title: "First, a full set",
		line: `A set is ${setSizeWords(t)}. ${
			canBuy ? "Keep digging, or buy one from me right here." : "Keep digging: when one fills, bring it to me or pin it on the noticeboard."
		}`,
		tone: "moment",
	};
}
