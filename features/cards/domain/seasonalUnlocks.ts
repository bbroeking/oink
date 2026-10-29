export const SEASONAL_CARD_SET_KEY = /^[a-z0-9]+(?:_[a-z0-9]+)*_v[1-9][0-9]*$/;
export const SEASONAL_CARD_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
export const SEASONAL_ITEM_ID = SEASONAL_CARD_ID;
export const MAX_SEASONAL_PACK_CARDS = 10;

export interface SeasonalCardMapping {
	cardId: string;
	name: string;
	itemId?: string;
	unlockRule: "first_copy";
}

export interface SeasonalCardManifest {
	setKey: string;
	name: string;
	mappingVersion: number;
	active: boolean;
	packCardLimit: number;
	cards: readonly SeasonalCardMapping[];
}

export interface SeasonalPackCard {
	cardId: string;
	finish: "standard" | "foil" | "living";
}

export interface SeasonalPackGrant {
	grantId: string;
	ownerId: string;
	setKey: string;
	source: string;
	sourceRef: string;
	cards: readonly SeasonalPackCard[];
}

export interface SeasonalOpeningCard extends SeasonalPackCard {
	position: number;
	quantityBefore: number;
	quantityAfter: number;
	newlyOwned: boolean;
	itemUnlock?: { itemId: string; newlyOwned: boolean } | null;
}

export interface SeasonalOpeningReceipt {
	openingId: string;
	grantId: string;
	ownerId: string;
	setKey: string;
	cards: readonly SeasonalOpeningCard[];
}

export interface SeasonalUnlockState {
	inventory: Record<string, Record<string, Record<string, number>>>;
	ownedItems: Record<string, readonly string[]>;
	openings: Record<string, SeasonalOpeningReceipt>;
}

export const emptySeasonalUnlockState = (): SeasonalUnlockState => ({
	inventory: {},
	ownedItems: {},
	openings: {},
});

function requireSafeId(value: unknown, pattern: RegExp, field: string): string {
	if (typeof value !== "string" || !pattern.test(value)) throw new Error(`Invalid ${field}`);
	return value;
}

export function validateSeasonalCardManifest(value: SeasonalCardManifest): SeasonalCardManifest {
	requireSafeId(value.setKey, SEASONAL_CARD_SET_KEY, "set key");
	if (!value.name.trim()) throw new Error("Seasonal card set needs a name");
	if (!Number.isInteger(value.mappingVersion) || value.mappingVersion < 1) throw new Error("Invalid mapping version");
	if (!Number.isInteger(value.packCardLimit) || value.packCardLimit < 1 || value.packCardLimit > MAX_SEASONAL_PACK_CARDS) throw new Error("Invalid pack card limit");
	const ids = new Set<string>();
	for (const card of value.cards) {
		requireSafeId(card.cardId, SEASONAL_CARD_ID, "card id");
		if (ids.has(card.cardId)) throw new Error(`Duplicate card id: ${card.cardId}`);
		ids.add(card.cardId);
		if (!card.name.trim() || card.unlockRule !== "first_copy") throw new Error(`Invalid card mapping: ${card.cardId}`);
		if (card.itemId) requireSafeId(card.itemId, SEASONAL_ITEM_ID, "item id");
	}
	return value;
}

export function validateSeasonalPack(manifest: SeasonalCardManifest, cards: readonly SeasonalPackCard[]): void {
	if (!manifest.active) throw new Error("Seasonal card set is inactive");
	if (cards.length < 1 || cards.length > manifest.packCardLimit) throw new Error("Invalid pack size");
	const known = new Set(manifest.cards.map((card) => card.cardId));
	for (const card of cards) {
		if (!known.has(card.cardId)) throw new Error(`Unknown seasonal card: ${card.cardId}`);
		if (!["standard", "foil", "living"].includes(card.finish)) throw new Error("Invalid card finish");
	}
}

/** Pure mirror of the database transaction, used for contract tests only. */
export function applySeasonalOpening(
	state: SeasonalUnlockState,
	manifest: SeasonalCardManifest,
	grant: SeasonalPackGrant,
): { state: SeasonalUnlockState; receipt: SeasonalOpeningReceipt } {
	const replay = state.openings[grant.grantId];
	if (replay) {
		if (replay.ownerId !== grant.ownerId || replay.setKey !== grant.setKey) throw new Error("Grant replay identity mismatch");
		if (replay.cards.length !== grant.cards.length || replay.cards.some((card, index) => card.cardId !== grant.cards[index].cardId || card.finish !== grant.cards[index].finish)) {
			throw new Error("Grant replay contents mismatch");
		}
		return { state, receipt: replay };
	}
	if (grant.setKey !== manifest.setKey) throw new Error("Grant set mismatch");
	validateSeasonalPack(manifest, grant.cards);
	const ownerInventory = { ...(state.inventory[grant.ownerId] ?? {}) };
	const inventory = { ...(ownerInventory[grant.setKey] ?? {}) };
	const owned = new Set(state.ownedItems[grant.ownerId] ?? []);
	const mapping = new Map(manifest.cards.map((card) => [card.cardId, card]));
	const cards = grant.cards.map((card, index): SeasonalOpeningCard => {
		const quantityBefore = inventory[card.cardId] ?? 0;
		const quantityAfter = quantityBefore + 1;
		inventory[card.cardId] = quantityAfter;
		const itemId = quantityBefore === 0 ? mapping.get(card.cardId)?.itemId : undefined;
		const itemWasOwned = itemId ? owned.has(itemId) : false;
		if (itemId) owned.add(itemId);
		return {
			...card,
			position: index + 1,
			quantityBefore,
			quantityAfter,
			newlyOwned: quantityBefore === 0,
			...(itemId ? { itemUnlock: { itemId, newlyOwned: !itemWasOwned } } : {}),
		};
	});
	const receipt: SeasonalOpeningReceipt = {
		openingId: `opening:${grant.grantId}`,
		grantId: grant.grantId,
		ownerId: grant.ownerId,
		setKey: grant.setKey,
		cards,
	};
	const next = {
		inventory: { ...state.inventory, [grant.ownerId]: { ...ownerInventory, [grant.setKey]: inventory } },
		ownedItems: { ...state.ownedItems, [grant.ownerId]: [...owned] },
		openings: { ...state.openings, [grant.grantId]: receipt },
	};
	return { state: next, receipt };
}
