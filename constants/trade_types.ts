// Shared shape for a row from the `my_tickle_trades` RPC.
//
// Both Inbox.tsx (full row — lists incoming/outgoing/answered)
// and UserSheet.tsx (derives the Ask row's state from a subset
// of fields) call the same RPC, so the row shape lives here as
// the single source of truth rather than being re-declared per
// file.
//
// Status is narrowed to the literal union the server actually
// returns (`pending` or `fulfilled` — `cancelled` is filtered
// out server-side, see trade_cooldown.sql). UserSheet only
// reads `status`, `created_at`, `requester_id`, and `target_id`,
// but using the full row keeps both files honest about what the
// RPC returns.
export interface TradeRow {
	id: string;
	requester_id: string;
	target_id: string;
	amount: number;
	status: "pending" | "fulfilled";
	created_at: string;
	fulfilled_at: string | null;
	partner_username: string | null;
}
