// Bullion's Market — every sentence the market says, as pure functions.
//
// Bullion speaks in the first person and short ("I buy a little under the
// price and sell a little over. That's my cut."). Receipts lead with what
// happened and carry the one number that teaches the market: where the price
// went, or how much a pig beat the counter by. Lifted from the round-4
// prototype's copy, so the shipped market reads the way it was playtested.
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import { fmtPrice, gainWord } from "@/constants/market";
import { findPlural } from "@/utils/trader";
import { pigName, type MarketNotice, type MarketOffer, type MarketOutcome, type MarketTrade } from "@/utils/market";

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

/** "4 pinecones" — a set of a find. */
export function setOf(id: SatchelFindId, size: number): string {
	return `${size} ${findPlural(id)}`;
}

/** "1 old key" / "2 old keys". */
export function qtyOf(id: SatchelFindId, n: number): string {
	return `${n} ${n === 1 ? findName(id) : findPlural(id)}`;
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

/** The three onboarding cards, in Bullion's voice. */
export const ONBOARDING: readonly { title: string; say: string }[] = [
	{
		title: "Buy or sell any set, any time.",
		say: "Hand me a set and I'll pay you on the spot. Need a set? I've always got one. Four of a common, three of anything else.",
	},
	{
		title: "Prices move.",
		say: "Every set you buy from me pushes the price up. Every set you sell pulls it down. When it's quiet the price wiggles, then wanders back home. I buy a little under the price and sell a little over: that's my cut.",
	},
	{
		title: "Or trade with a pig.",
		say: "Post your set on the noticeboard at your own price, or swap it straight up. Price it between my two prices and you'll both beat my counter. That's how you sell high.",
	},
];

/** One trade on the market home's ticker. */
export function tickerLine(tr: MarketTrade, size: number): { tag: "you" | "counter" | "board" | "town" | "swap"; text: string } {
	const set = setOf(tr.findId, size);
	const mine = tr.buyer?.you || tr.seller?.you;
	if (tr.kind === "counter") {
		const text =
			tr.side === "buy"
				? `${cap1(pigName(tr.buyer))} bought ${set} from Bullion · ${tr.price}`
				: `${cap1(pigName(tr.seller))} sold Bullion ${set} · ${tr.price}`;
		return { tag: mine ? "you" : "counter", text };
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
			? { text: `${cap1(pigName(tr.buyer))} bought from Bullion`, tag: "counter" }
			: { text: `${cap1(pigName(tr.seller))} sold to Bullion`, tag: "counter" };
	}
	if (tr.kind === "pig") return { text: `${cap1(pigName(tr.buyer))} bought from ${pigName(tr.seller)}`, tag: "board" };
	if (tr.kind === "print") return { text: `${cap1(tr.who ?? "the townsfolk")} ${tr.dir === "up" ? "bought" : "sold"}`, tag: "town" };
	const gave = tr.wantFindId ? qtyOf(tr.wantFindId, tr.wantQty ?? 1) : "a find";
	return tr.findId === viewing
		? { text: `${cap1(pigName(tr.buyer))} swapped ${gave} for these`, tag: "swap" }
		: { text: `${cap1(pigName(tr.buyer))} swapped these for ${setOf(tr.findId, size)}`, tag: "swap" };
}

function costLine(tr: MarketTrade): string {
	const price = tr.price ?? 0;
	if (tr.cost == null) return `you dug them up · +${price}`;
	return `paid ${tr.cost} · sold for ${price} · ${gainWord(price - tr.cost)}`;
}

function moveLine(tr: MarketTrade): string {
	return tr.from != null && tr.to != null ? `${fmtPrice(tr.from)} → ${fmtPrice(tr.to)}` : "";
}

/** The receipt for a trade YOU made or that happened to your listing. */
export function tradeReceipt(tr: MarketTrade, sheepPays?: number | null): MarketReceipt {
	const set = setOf(tr.findId, tr.qty);
	const mv = moveLine(tr);
	const sheep = sheepPays ? ` · your Ghost Sheep pays ${sheepPays} today` : "";
	if (tr.kind === "counter") {
		if (tr.side === "sell") {
			const crossed = tr.how === "crossed" && tr.listed != null;
			return {
				pose: "gavel",
				title: `Bullion bought your ${set} for ${tr.price}`,
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
			line: crossed ? `His selling price came down to your ${tr.listed}: you got his price.` : `the price went ${mv}${sheep}`,
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
				title: `${by} bought your ${set} for ${tr.price}`,
				line: `Bullion would have paid ${tr.bid} · ${plus > 0 ? `+${plus} ${tr.how === "listing" ? "for listing it" : "for selling to a pig"}` : "the same as the counter"}`,
				tone: "plain",
			};
		}
		const from = cap1(pigName(tr.seller));
		const saved = (tr.ask ?? 0) - (tr.price ?? 0);
		return {
			pose: "cheer",
			title: tr.how === "wanted" ? `${from} sold you ${set} for ${tr.price}` : `You bought ${set} from ${pigName(tr.seller)} for ${tr.price}`,
			line: `Bullion charges ${tr.ask}${saved > 0 ? ` · ${saved} saved buying from a pig` : ""}${sheep}`,
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

/** The receipt a NOTICE wears (things that happened while you were away). */
export function noticeReceipt(n: MarketNotice): MarketReceipt | null {
	const o: MarketOffer | null = n.offer;
	if ((n.kind === "filled" || n.kind === "crossed" || n.kind === "swapped") && n.trade) {
		return tradeReceipt(n.trade);
	}
	if (!o) return null;
	// A listing's qty is its set size, straight from the server.
	const set = setOf(o.findId, o.qty);
	if (n.kind === "expired") {
		if (o.side === "sell") return { pose: "shrug", title: `Your ${set} came home`, line: `Nobody took them at ${o.price} in a day.`, tone: "meh" };
		if (o.side === "buy") return { pose: "shrug", title: `Your wanted ad for ${findPlural(o.findId)} ran out`, line: `Nobody sold at ${o.price} in a day.`, tone: "meh" };
		return { pose: "shrug", title: "Your swap ran out", line: `Your ${set} are back in your bag.`, tone: "meh" };
	}
	if (n.kind === "lapsed") {
		return { pose: "shrug", title: `Your wanted ad for ${findPlural(o.findId)} lapsed`, line: `A seller came, but you had fewer than ${o.price} tickles ready.`, tone: "meh" };
	}
	if (n.kind === "for_you") {
		const what = o.side === "swap" && o.wantFindId ? `${set} for ${qtyOf(o.wantFindId, o.wantQty ?? 1)}` : `${set} for ${o.price}`;
		return { pose: "stand", title: "A friend sent you an offer", line: `${what} · on the noticeboard, For you`, tone: "plain" };
	}
	return null;
}

/** A refusal, in Bullion's voice. */
export function refusalReceipt(res: Extract<MarketOutcome, { ok: false }>, findId: SatchelFindId | null, openOffers: number, dailyPosts: number): MarketReceipt {
	const meh = (title: string, line?: string): MarketReceipt => ({ pose: "shrug", title, line, tone: "meh" });
	switch (res.reason) {
		case "price_moved":
			return meh("The price moved", res.now != null ? `It's ${res.now} now. Take another look.` : "Take another look.");
		case "not_enough_tickles":
			return meh("Not enough tickles ready", `You have ${res.ready ?? 0}; it needs ${res.needed ?? "more"}.`);
		case "not_a_set":
			return meh(`A set is ${res.setSize ?? "a few"}`, `You have ${res.held ?? 0} ${findId ? findPlural(findId) : "of those"}.`);
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
		case "no_bank":
			return meh("Your tickle bank isn't ready", "Tickle your pig once, then come back.");
		case "closed":
			return meh("The market's shut", "Bullion's packed up for now.");
		case "network":
			return meh("That didn't go through", "Check your connection and try again.");
		default:
			return meh("That didn't go through", "Take another look.");
	}
}

/** The first price you move: shown once, ever. */
export function movedMoment(tr: MarketTrade): MarketReceipt {
	const how = tr.kind === "counter" ? "Every set at my counter nudges it." : "A pig sale nudges it a third of the way.";
	return { pose: "cheer", title: "You moved the price!", line: `${cap1(findPlural(tr.findId))} ${moveLine(tr)}. ${how}`, tone: "moment" };
}
