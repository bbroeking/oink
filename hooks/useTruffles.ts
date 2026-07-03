// Golden Truffles — pouch balance + the Truffle Exchange rotation + redeem.
// Server: exchange_rotation() / redeem_war_cosmetic()
// (supabase/migrations/20260704300000_truffle_exchange.sql, HELD).
//
// GRACEFUL FALLBACK (the useHungerMeter/useRooting pattern): until that
// migration is applied the RPCs don't exist and rpc() resolves null — the hook
// reports available:false with a zero pouch so surfaces render the cozy
// "the Exchange opens with the season" state instead of an error.

import { useCallback, useEffect, useState } from "react";
import { rpc } from "@/utils/rpc";

export interface ExchangeItem {
	id: string;
	name: string;
	price: number;
	rarity: string;
	owned: boolean;
}

export interface TruffleState {
	available: boolean; // false until the Exchange RPCs exist
	balance: number; // golden_truffles pouch
	week: string | null;
	restockAt: Date | null;
	heirloomRestedUntil: Date | null;
	items: ExchangeItem[];
}

const FALLBACK: TruffleState = {
	available: false,
	balance: 0,
	week: null,
	restockAt: null,
	heirloomRestedUntil: null,
	items: [],
};

interface Wire {
	ok?: boolean;
	week?: string;
	restock_at?: string;
	balance?: number;
	heirloom_rested_until?: string | null;
	items?: Array<{ id: string; name: string; price: number; rarity: string; owned: boolean }>;
}

export type RedeemResult =
	| { ok: true; remaining: number }
	| { ok: false; reason: string; have?: number; need?: number };

export function useTruffles(): TruffleState & {
	refresh: () => Promise<void>;
	redeem: (hatId: string) => Promise<RedeemResult>;
} {
	const [state, setState] = useState<TruffleState>(FALLBACK);

	const refresh = useCallback(async () => {
		const data = await rpc<Wire>("exchange_rotation");
		if (!data || data.ok !== true || !Array.isArray(data.items)) {
			setState(FALLBACK);
			return;
		}
		setState({
			available: true,
			balance: data.balance ?? 0,
			week: data.week ?? null,
			restockAt: data.restock_at ? new Date(data.restock_at) : null,
			heirloomRestedUntil: data.heirloom_rested_until
				? new Date(data.heirloom_rested_until)
				: null,
			items: data.items.map((i) => ({
				id: i.id,
				name: i.name,
				price: i.price,
				rarity: i.rarity,
				owned: !!i.owned,
			})),
		});
	}, []);

	const redeem = useCallback(
		async (hatId: string): Promise<RedeemResult> => {
			const r = await rpc<{ ok?: boolean; reason?: string; remaining?: number; have?: number; need?: number }>(
				"redeem_war_cosmetic",
				{ target_hat_id: hatId }
			);
			if (!r || typeof r.ok !== "boolean") return { ok: false, reason: "network" };
			if (r.ok) {
				await refresh();
				return { ok: true, remaining: r.remaining ?? 0 };
			}
			return { ok: false, reason: r.reason ?? "unknown", have: r.have, need: r.need };
		},
		[refresh]
	);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { ...state, refresh, redeem };
}
