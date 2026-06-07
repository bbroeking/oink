// Single source of truth for action-RPC failure `reason` keys + their default
// player copy. Server functions return these (under `reason`, or `error` for the
// four legacy barn/visit/allegiance outliers — rpcAction() normalizes both to
// `reason`). Client checks should compare against REASON.* instead of bare magic
// strings so a typo is a compile error, not a silent no-match.
//
// Feature-specific copy that needs context (friend cap counts, names, bless vs
// curse) stays in its own helper, but those helpers fall back to reasonMessage()
// for the shared cases so the wording stays consistent.

export const REASON = {
	// transport / wrapper-synthesised
	network: "network",
	no_data: "no_data",
	unknown: "unknown",
	// auth / target
	unauthenticated: "unauthenticated",
	self: "self",
	no_target: "no_target",
	not_found: "not_found",
	not_friends: "not_friends",
	// economy
	no_tickles: "no_tickles",
	too_poor: "too_poor",
	insufficient: "insufficient",
	insufficient_bank: "insufficient_bank",
	insufficient_snouts: "insufficient_snouts",
	// rate limits / cooldowns
	cooldown: "cooldown",
	tired: "tired",
	daily_cap: "daily_cap",
	at_cap: "at_cap",
	target_at_cap: "target_at_cap",
	budget: "budget",
	// already-done
	already_blessed_today: "already_blessed_today",
	already_cursed_today: "already_cursed_today",
	already_active: "already_active",
	already_friends: "already_friends",
	already_owned: "already_owned",
	already_buried: "already_buried",
	already_chosen: "already_chosen",
	already_rerolled: "already_rerolled",
	// shop / items
	not_for_sale: "not_for_sale",
	not_owned: "not_owned",
	invalid_price: "invalid_price",
	no_offering: "no_offering",
	product_not_found: "product_not_found",
	// flow
	pending: "pending",
	cancelled: "cancelled",
} as const;

export type RpcReason = (typeof REASON)[keyof typeof REASON];

// Default, context-free copy for a reason. Feature helpers override the few that
// need names/counts; everything else reads from here so wording can't drift.
export function reasonMessage(reason: string | undefined): string {
	switch (reason) {
		case REASON.network:
			return "Couldn't reach the server — check your connection and try again.";
		case REASON.no_data:
		case REASON.unknown:
			return "Something went wrong. Please try again.";
		case REASON.self:
			return "That's you.";
		case REASON.not_found:
			return "Couldn't find that.";
		case REASON.not_friends:
			return "Only friends can be reached.";
		case REASON.no_tickles:
		case REASON.too_poor:
		case REASON.insufficient:
		case REASON.insufficient_bank:
			return "Not enough tickles.";
		case REASON.insufficient_snouts:
			return "Not enough snouts.";
		case REASON.cooldown:
			return "Not yet — give it a little while.";
		case REASON.tired:
			return "The pigs are all tickled out — come back later.";
		case REASON.daily_cap:
			return "That's all for today — come back tomorrow.";
		case REASON.already_blessed_today:
			return "Already blessed today.";
		case REASON.already_cursed_today:
			return "Already cursed today.";
		case REASON.not_for_sale:
			return "That isn't for sale.";
		case REASON.already_owned:
			return "You already own that.";
		default:
			return "Couldn't do that right now. Please try again.";
	}
}
