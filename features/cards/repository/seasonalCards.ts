import type { SeasonalOpeningReceipt } from "../domain/seasonalUnlocks";

export type SeasonalCardsRpcResult<T> = { ok: true } & T | { ok: false; error: string; code?: string };

/** Supabase adapter boundary. Wire this only after the migration is applied and types are regenerated. */
export interface SeasonalCardsRpcClient {
	seasonalCardSnapshot(): Promise<SeasonalCardsRpcResult<SeasonalCardSnapshot>>;
	openSeasonalCardPack(grantId: string): Promise<SeasonalCardsRpcResult<{ receipt: SeasonalOpeningReceipt; replayed: boolean }>>;
}

export interface SeasonalCardSnapshot {
	sets: readonly { setKey: string; name: string; mappingVersion: number }[];
	inventory: readonly { setKey: string; cardId: string; quantity: number; firstAcquiredAt: string }[];
	grants: readonly { grantId: string; setKey: string; source: string; sourceRef: string; opened: boolean }[];
}

export class SeasonalCardsRepository {
	constructor(private readonly rpc: SeasonalCardsRpcClient) {}

	snapshot(): Promise<SeasonalCardsRpcResult<SeasonalCardSnapshot>> {
		return this.rpc.seasonalCardSnapshot();
	}

	/** Consumes an existing server-issued grant. The client never supplies cards. */
	open(grantId: string): Promise<SeasonalCardsRpcResult<{ receipt: SeasonalOpeningReceipt; replayed: boolean }>> {
		return this.rpc.openSeasonalCardPack(grantId);
	}
}
