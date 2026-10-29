export type SeasonalTradeFinish = "standard" | "foil" | "living";

export interface SeasonalTradeAsset {
	cardId: string;
	finish: SeasonalTradeFinish;
	quantity: number;
}

export interface SeasonalTradePlayerSeed {
	playerId: string;
	/** card id -> finish -> exact quantity */
	inventory: Readonly<Record<string, Readonly<Partial<Record<SeasonalTradeFinish, number>>>>>;
	cosmetics?: readonly string[];
}

export interface SeasonalTradingSeed {
	seedId: string;
	setKey: string;
	cards: Readonly<Record<string, { cosmeticId?: string }>>;
	players: readonly SeasonalTradePlayerSeed[];
}

export type SeasonalTradeTerminalReason = "cancelled" | "expired" | "blocked";
export type SeasonalTradeStatus = "pending" | "completed" | SeasonalTradeTerminalReason;

export interface SeasonalTrade {
	tradeId: string;
	proposerId: string;
	recipientId: string;
	revision: number;
	proposerGives: SeasonalTradeAsset;
	recipientGives: SeasonalTradeAsset;
	confirmations: Readonly<Partial<Record<string, number>>>;
	createdAt: number;
	expiresAt: number;
	status: SeasonalTradeStatus;
	receiptId?: string;
}

export interface SeasonalTradeReceipt {
	receiptId: string;
	tradeId: string;
	seedId: string;
	setKey: string;
	revision: number;
	participants: readonly [string, string];
	transfers: readonly [
		{ fromPlayerId: string; toPlayerId: string; asset: SeasonalTradeAsset },
		{ fromPlayerId: string; toPlayerId: string; asset: SeasonalTradeAsset },
	];
	cosmeticGrants: readonly { playerId: string; cardId: string; cosmeticId: string }[];
	completedAt: number;
}

interface SeasonalTradePlayerState {
	inventory: Record<string, Partial<Record<SeasonalTradeFinish, number>>>;
	everOwnedCardIds: readonly string[];
	cosmetics: readonly string[];
}

export interface SeasonalTradingState {
	readonly authority: "local-seasonal-trading-demo";
	readonly notice: "Local two-player demo. No server mutation, reward grant, token, or message is created.";
	readonly seedId: string;
	readonly setKey: string;
	readonly cards: Readonly<Record<string, { cosmeticId?: string }>>;
	readonly players: Readonly<Record<string, SeasonalTradePlayerState>>;
	readonly trades: Readonly<Record<string, SeasonalTrade>>;
	readonly receipts: Readonly<Record<string, SeasonalTradeReceipt>>;
	readonly blockedPairs: readonly string[];
}

export interface OpenSeasonalTrade {
	tradeId: string;
	proposerId: string;
	recipientId: string;
	proposerGives: SeasonalTradeAsset;
	recipientGives: SeasonalTradeAsset;
	ttlMs: number;
}

export type SeasonalTradingClock = () => number;

const AUTHORITY = "local-seasonal-trading-demo" as const;
const NOTICE = "Local two-player demo. No server mutation, reward grant, token, or message is created." as const;
const ID = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/i;
const FINISHES: readonly SeasonalTradeFinish[] = ["standard", "foil", "living"];
const systemClock: SeasonalTradingClock = () => Date.now();

const pairKey = (a: string, b: string): string => [a, b].sort().join("::");
const cloneAsset = (asset: SeasonalTradeAsset): SeasonalTradeAsset => ({ ...asset });
const freezeReceipt = (receipt: SeasonalTradeReceipt): SeasonalTradeReceipt => Object.freeze({
	...receipt,
	participants: Object.freeze([...receipt.participants]) as unknown as readonly [string, string],
	transfers: Object.freeze(receipt.transfers.map((transfer) => Object.freeze({ ...transfer, asset: Object.freeze(cloneAsset(transfer.asset)) }))) as unknown as SeasonalTradeReceipt["transfers"],
	cosmeticGrants: Object.freeze(receipt.cosmeticGrants.map((grant) => Object.freeze({ ...grant }))),
});

function assertId(value: string, label: string): void {
	if (!ID.test(value)) throw new Error(`Invalid ${label}`);
}

function clockNow(clock: SeasonalTradingClock): number {
	const now = clock();
	if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid seasonal trading clock");
	return now;
}

function assertAsset(state: SeasonalTradingState, asset: SeasonalTradeAsset): void {
	if (!state.cards[asset.cardId]) throw new Error(`Unknown seasonal card: ${asset.cardId}`);
	if (!FINISHES.includes(asset.finish)) throw new Error("Invalid card finish");
	if (!Number.isSafeInteger(asset.quantity) || asset.quantity < 1) throw new Error("Invalid card quantity");
}

function exactQuantity(state: SeasonalTradingState, playerId: string, asset: SeasonalTradeAsset): number {
	return state.players[playerId]?.inventory[asset.cardId]?.[asset.finish] ?? 0;
}

function totalCardQuantity(state: SeasonalTradingState, playerId: string, cardId: string): number {
	const finishes = state.players[playerId]?.inventory[cardId] ?? {};
	return FINISHES.reduce((sum, finish) => sum + (finishes[finish] ?? 0), 0);
}

function reservationFor(
	state: SeasonalTradingState,
	playerId: string,
	asset: SeasonalTradeAsset,
	exceptTradeId?: string,
): number {
	let quantity = 0;
	for (const trade of Object.values(state.trades)) {
		if (trade.status !== "pending" || trade.tradeId === exceptTradeId) continue;
		const reserved = trade.proposerId === playerId ? trade.proposerGives : trade.recipientId === playerId ? trade.recipientGives : undefined;
		if (reserved?.cardId === asset.cardId && reserved.finish === asset.finish) quantity += reserved.quantity;
	}
	return quantity;
}

function reservedCardTotal(state: SeasonalTradingState, playerId: string, cardId: string, exceptTradeId?: string): number {
	let quantity = 0;
	for (const finish of FINISHES) quantity += reservationFor(state, playerId, { cardId, finish, quantity: 1 }, exceptTradeId);
	return quantity;
}

function assertReservable(state: SeasonalTradingState, playerId: string, asset: SeasonalTradeAsset, exceptTradeId?: string): void {
	const exactAvailable = exactQuantity(state, playerId, asset) - reservationFor(state, playerId, asset, exceptTradeId);
	if (exactAvailable < asset.quantity) throw new Error("Exact card finish quantity is unavailable or reserved");
	const totalAfterReservations = totalCardQuantity(state, playerId, asset.cardId) - reservedCardTotal(state, playerId, asset.cardId, exceptTradeId) - asset.quantity;
	if (totalAfterReservations < 1) throw new Error("A trade may use only spare copies; keep one copy of the card identity");
}

function requireParticipant(state: SeasonalTradingState, playerId: string): void {
	if (!state.players[playerId]) throw new Error("Unknown trade participant");
}

function requirePending(state: SeasonalTradingState, tradeId: string): SeasonalTrade {
	const trade = state.trades[tradeId];
	if (!trade) throw new Error("Unknown trade");
	if (trade.status !== "pending") throw new Error(`Trade is already ${trade.status}`);
	return trade;
}

export function createSeasonalTradingDemo(seed: SeasonalTradingSeed): SeasonalTradingState {
	assertId(seed.seedId, "seed id");
	assertId(seed.setKey, "set key");
	const players: Record<string, SeasonalTradePlayerState> = {};
	for (const player of seed.players) {
		assertId(player.playerId, "player id");
		if (players[player.playerId]) throw new Error("Duplicate player id");
		const inventory: SeasonalTradePlayerState["inventory"] = {};
		for (const [cardId, quantities] of Object.entries(player.inventory)) {
			if (!seed.cards[cardId]) throw new Error(`Unknown seeded seasonal card: ${cardId}`);
			const cardInventory: Partial<Record<SeasonalTradeFinish, number>> = {};
			for (const finish of FINISHES) {
				const quantity = quantities[finish] ?? 0;
				if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Invalid seeded card quantity");
				if (quantity) cardInventory[finish] = quantity;
			}
			if (Object.keys(cardInventory).length) inventory[cardId] = cardInventory;
		}
		players[player.playerId] = {
			inventory,
			everOwnedCardIds: Object.keys(inventory),
			cosmetics: [...new Set(player.cosmetics ?? [])],
		};
	}
	if (Object.keys(players).length < 2) throw new Error("Seasonal trading needs at least two fixture players");
	return { authority: AUTHORITY, notice: NOTICE, seedId: seed.seedId, setKey: seed.setKey, cards: { ...seed.cards }, players, trades: {}, receipts: {}, blockedPairs: [] };
}

export function availableSeasonalTradeQuantity(state: SeasonalTradingState, playerId: string, asset: Omit<SeasonalTradeAsset, "quantity">): number {
	requireParticipant(state, playerId);
	const probe = { ...asset, quantity: 1 };
	assertAsset(state, probe);
	const exact = exactQuantity(state, playerId, probe) - reservationFor(state, playerId, probe);
	const spareAcrossFinishes = totalCardQuantity(state, playerId, asset.cardId) - reservedCardTotal(state, playerId, asset.cardId) - 1;
	return Math.max(0, Math.min(exact, spareAcrossFinishes));
}

export function openSeasonalTrade(state: SeasonalTradingState, input: OpenSeasonalTrade, clock: SeasonalTradingClock = systemClock): SeasonalTradingState {
	assertId(input.tradeId, "trade id");
	if (state.trades[input.tradeId] || state.receipts[`seasonal-trade:${input.tradeId}`]) throw new Error("Trade id was already used");
	requireParticipant(state, input.proposerId);
	requireParticipant(state, input.recipientId);
	if (input.proposerId === input.recipientId) throw new Error("Self-trades are not allowed");
	if (state.blockedPairs.includes(pairKey(input.proposerId, input.recipientId))) throw new Error("Trading is blocked between these participants");
	if (!Number.isSafeInteger(input.ttlMs) || input.ttlMs < 1) throw new Error("Invalid trade expiry");
	const createdAt = clockNow(clock);
	const expiresAt = createdAt + input.ttlMs;
	if (!Number.isSafeInteger(expiresAt)) throw new Error("Invalid trade expiry");
	assertAsset(state, input.proposerGives);
	assertAsset(state, input.recipientGives);
	assertReservable(state, input.proposerId, input.proposerGives);
	assertReservable(state, input.recipientId, input.recipientGives);
	const trade: SeasonalTrade = {
		tradeId: input.tradeId, proposerId: input.proposerId, recipientId: input.recipientId, createdAt, expiresAt,
		proposerGives: cloneAsset(input.proposerGives), recipientGives: cloneAsset(input.recipientGives),
		revision: 1, confirmations: {}, status: "pending",
	};
	return { ...state, trades: { ...state.trades, [trade.tradeId]: trade } };
}

export function reviseSeasonalTrade(
	state: SeasonalTradingState,
	input: { tradeId: string; proposerId: string; expectedRevision: number; proposerGives: SeasonalTradeAsset; recipientGives: SeasonalTradeAsset },
	clock: SeasonalTradingClock = systemClock,
): SeasonalTradingState {
	const trade = requirePending(state, input.tradeId);
	const now = clockNow(clock);
	if (now >= trade.expiresAt) return expireSeasonalTrades(state, () => now);
	if (trade.proposerId !== input.proposerId) throw new Error("Only the proposer may revise this trade");
	if (trade.revision !== input.expectedRevision) throw new Error("Stale trade revision");
	assertAsset(state, input.proposerGives); assertAsset(state, input.recipientGives);
	assertReservable(state, trade.proposerId, input.proposerGives, trade.tradeId);
	assertReservable(state, trade.recipientId, input.recipientGives, trade.tradeId);
	return { ...state, trades: { ...state.trades, [trade.tradeId]: { ...trade, revision: trade.revision + 1, proposerGives: cloneAsset(input.proposerGives), recipientGives: cloneAsset(input.recipientGives), confirmations: {} } } };
}

function transfer(
	state: SeasonalTradingState,
	fromPlayerId: string,
	toPlayerId: string,
	asset: SeasonalTradeAsset,
): { players: SeasonalTradingState["players"]; cosmeticGrant?: { playerId: string; cardId: string; cosmeticId: string } } {
	const from = state.players[fromPlayerId]; const to = state.players[toPlayerId];
	const fromCard = { ...(from.inventory[asset.cardId] ?? {}) }; const toCard = { ...(to.inventory[asset.cardId] ?? {}) };
	const before = fromCard[asset.finish] ?? 0;
	if (before < asset.quantity) throw new Error("Exact card finish quantity would underflow");
	fromCard[asset.finish] = before - asset.quantity; toCard[asset.finish] = (toCard[asset.finish] ?? 0) + asset.quantity;
	const firstAcquisition = !to.everOwnedCardIds.includes(asset.cardId);
	const cosmeticId = state.cards[asset.cardId]?.cosmeticId;
	const grant = firstAcquisition && cosmeticId && !to.cosmetics.includes(cosmeticId) ? { playerId: toPlayerId, cardId: asset.cardId, cosmeticId } : undefined;
	return {
		players: {
			...state.players,
			[fromPlayerId]: { ...from, inventory: { ...from.inventory, [asset.cardId]: fromCard } },
			[toPlayerId]: { ...to, inventory: { ...to.inventory, [asset.cardId]: toCard }, everOwnedCardIds: firstAcquisition ? [...to.everOwnedCardIds, asset.cardId] : to.everOwnedCardIds, cosmetics: grant ? [...to.cosmetics, grant.cosmeticId] : to.cosmetics },
		},
		...(grant ? { cosmeticGrant: grant } : {}),
	};
}

export function confirmSeasonalTrade(
	state: SeasonalTradingState,
	input: { tradeId: string; participantId: string; revision: number },
	clock: SeasonalTradingClock = systemClock,
): { state: SeasonalTradingState; receipt?: SeasonalTradeReceipt } {
	const existing = state.trades[input.tradeId];
	if (!existing) throw new Error("Unknown trade");
	if (existing.status === "completed") {
		if (existing.revision !== input.revision || ![existing.proposerId, existing.recipientId].includes(input.participantId)) throw new Error("Trade replay identity mismatch");
		return { state, receipt: state.receipts[existing.receiptId!] };
	}
	const trade = requirePending(state, input.tradeId);
	const confirmedAt = clockNow(clock);
	if (![trade.proposerId, trade.recipientId].includes(input.participantId)) throw new Error("Only a trade participant may confirm");
	if (trade.revision !== input.revision) throw new Error("Stale trade revision");
	if (confirmedAt >= trade.expiresAt) return { state: expireSeasonalTrades(state, () => confirmedAt) };
	const confirmations = { ...trade.confirmations, [input.participantId]: input.revision };
	if (confirmations[trade.proposerId] !== trade.revision || confirmations[trade.recipientId] !== trade.revision) {
		return { state: { ...state, trades: { ...state.trades, [trade.tradeId]: { ...trade, confirmations } } } };
	}
	assertReservable(state, trade.proposerId, trade.proposerGives, trade.tradeId);
	assertReservable(state, trade.recipientId, trade.recipientGives, trade.tradeId);
	const first = transfer(state, trade.proposerId, trade.recipientId, trade.proposerGives);
	const second = transfer({ ...state, players: first.players }, trade.recipientId, trade.proposerId, trade.recipientGives);
	const receiptId = `seasonal-trade:${trade.tradeId}`;
	const receipt = freezeReceipt({
		receiptId, tradeId: trade.tradeId, seedId: state.seedId, setKey: state.setKey, revision: trade.revision,
		participants: [trade.proposerId, trade.recipientId],
		transfers: [
			{ fromPlayerId: trade.proposerId, toPlayerId: trade.recipientId, asset: cloneAsset(trade.proposerGives) },
			{ fromPlayerId: trade.recipientId, toPlayerId: trade.proposerId, asset: cloneAsset(trade.recipientGives) },
		],
		cosmeticGrants: [first.cosmeticGrant, second.cosmeticGrant].filter((grant): grant is NonNullable<typeof grant> => Boolean(grant)),
		completedAt: confirmedAt,
	});
	return { state: { ...state, players: second.players, trades: { ...state.trades, [trade.tradeId]: { ...trade, confirmations, status: "completed", receiptId } }, receipts: { ...state.receipts, [receiptId]: receipt } }, receipt };
}

function terminate(state: SeasonalTradingState, tradeId: string, reason: SeasonalTradeTerminalReason): SeasonalTradingState {
	const trade = requirePending(state, tradeId);
	return { ...state, trades: { ...state.trades, [tradeId]: { ...trade, status: reason } } };
}

export function cancelSeasonalTrade(state: SeasonalTradingState, tradeId: string, participantId: string): SeasonalTradingState {
	const trade = requirePending(state, tradeId);
	if (![trade.proposerId, trade.recipientId].includes(participantId)) throw new Error("Only a trade participant may cancel");
	return terminate(state, tradeId, "cancelled");
}

export function expireSeasonalTrades(state: SeasonalTradingState, clock: SeasonalTradingClock = systemClock): SeasonalTradingState {
	const now = clockNow(clock);
	let trades: Record<string, SeasonalTrade> | undefined;
	for (const trade of Object.values(state.trades)) if (trade.status === "pending" && now >= trade.expiresAt) {
		trades ??= { ...state.trades }; trades[trade.tradeId] = { ...trade, status: "expired" };
	}
	return trades ? { ...state, trades } : state;
}

export function blockSeasonalTrader(state: SeasonalTradingState, blockerId: string, blockedId: string): SeasonalTradingState {
	requireParticipant(state, blockerId); requireParticipant(state, blockedId);
	if (blockerId === blockedId) throw new Error("A participant cannot block itself");
	const key = pairKey(blockerId, blockedId); if (state.blockedPairs.includes(key)) return state;
	const trades = { ...state.trades };
	for (const trade of Object.values(trades)) if (trade.status === "pending" && pairKey(trade.proposerId, trade.recipientId) === key) trades[trade.tradeId] = { ...trade, status: "blocked" };
	return { ...state, trades, blockedPairs: [...state.blockedPairs, key] };
}

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown, label: string): UnknownRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Malformed stored trade ${label}`);
	return value as UnknownRecord;
};

function storedString(value: unknown, label: string): string {
	if (typeof value !== "string") throw new Error(`Malformed stored trade ${label}`);
	assertId(value, `stored ${label}`);
	return value;
}

function storedAsset(state: SeasonalTradingState, value: unknown): SeasonalTradeAsset {
	const row = asRecord(value, "asset");
	const cardId = storedString(row.cardId, "card id");
	const finish = row.finish;
	const quantity = row.quantity;
	if (typeof finish !== "string" || !FINISHES.includes(finish as SeasonalTradeFinish)) throw new Error("Malformed stored trade finish");
	if (!Number.isSafeInteger(quantity) || (quantity as number) < 1) throw new Error("Malformed stored trade quantity");
	const asset = { cardId, finish: finish as SeasonalTradeFinish, quantity: quantity as number };
	assertAsset(state, asset);
	return asset;
}

function parseStoredReceipt(state: SeasonalTradingState, value: unknown, priorCompletedAt: number): SeasonalTradeReceipt {
	const row = asRecord(value, "receipt");
	const receiptId = storedString(row.receiptId, "receipt id");
	const tradeId = storedString(row.tradeId, "trade id");
	const seedId = storedString(row.seedId, "seed id");
	const setKey = storedString(row.setKey, "set key");
	if (!Number.isSafeInteger(row.revision) || (row.revision as number) < 1) throw new Error("Malformed stored trade revision");
	if (!Number.isSafeInteger(row.completedAt) || (row.completedAt as number) < 0 || (row.completedAt as number) < priorCompletedAt) throw new Error("Malformed or unordered stored trade completion time");
	if (!Array.isArray(row.participants) || row.participants.length !== 2) throw new Error("Malformed stored trade participants");
	const participants = row.participants.map((participant) => storedString(participant, "participant")) as [string, string];
	if (participants[0] === participants[1]) throw new Error("Malformed stored trade participants");
	participants.forEach((participant) => requireParticipant(state, participant));
	if (!Array.isArray(row.transfers) || row.transfers.length !== 2) throw new Error("Malformed stored trade transfers");
	const parseTransfer = (value: unknown) => {
		const transfer = asRecord(value, "transfer");
		return { fromPlayerId: storedString(transfer.fromPlayerId, "transfer sender"), toPlayerId: storedString(transfer.toPlayerId, "transfer recipient"), asset: storedAsset(state, transfer.asset) };
	};
	const transfers: SeasonalTradeReceipt["transfers"] = [parseTransfer(row.transfers[0]), parseTransfer(row.transfers[1])];
	if (!Array.isArray(row.cosmeticGrants)) throw new Error("Malformed stored trade cosmetic grants");
	const cosmeticGrants = row.cosmeticGrants.map((value) => {
		const grant = asRecord(value, "cosmetic grant");
		const playerId = storedString(grant.playerId, "grant player");
		const cardId = storedString(grant.cardId, "grant card");
		const cosmeticId = storedString(grant.cosmeticId, "grant cosmetic");
		if (!participants.includes(playerId) || state.cards[cardId]?.cosmeticId !== cosmeticId) throw new Error("Malformed stored trade cosmetic grant mapping");
		return { playerId, cardId, cosmeticId };
	});
	return { receiptId, tradeId, seedId, setKey, revision: row.revision as number, participants, transfers, cosmeticGrants, completedAt: row.completedAt as number };
}

/** Rebuilds a local demo from app-prepared receipts; this is not authentication or production authority. */
export function reconstructSeasonalTrading(seed: SeasonalTradingSeed, storedReceipts: readonly unknown[]): SeasonalTradingState {
	let state = createSeasonalTradingDemo(seed);
	let priorCompletedAt = 0;
	for (const stored of storedReceipts) {
		const receipt = parseStoredReceipt(state, stored, priorCompletedAt);
		if (receipt.seedId !== state.seedId || receipt.setKey !== state.setKey || state.receipts[receipt.receiptId]) throw new Error("Invalid, conflicting, or duplicate prepared trade receipt");
		if (receipt.receiptId !== `seasonal-trade:${receipt.tradeId}` || receipt.transfers.length !== 2) throw new Error("Malformed prepared trade receipt");
		const [outbound, inbound] = receipt.transfers;
		if (outbound.fromPlayerId !== receipt.participants[0] || outbound.toPlayerId !== receipt.participants[1] || inbound.fromPlayerId !== receipt.participants[1] || inbound.toPlayerId !== receipt.participants[0]) throw new Error("Trade receipt participant mismatch");
		assertAsset(state, outbound.asset); assertAsset(state, inbound.asset);
		requireParticipant(state, outbound.fromPlayerId); requireParticipant(state, outbound.toPlayerId);
		if (outbound.fromPlayerId === outbound.toPlayerId) throw new Error("Self-trade receipt is invalid");
		if (totalCardQuantity(state, outbound.fromPlayerId, outbound.asset.cardId) - outbound.asset.quantity < 1 || totalCardQuantity(state, inbound.fromPlayerId, inbound.asset.cardId) - inbound.asset.quantity < 1) throw new Error("Prepared receipt spends a reserved last copy");
		const first = transfer(state, outbound.fromPlayerId, outbound.toPlayerId, outbound.asset);
		const second = transfer({ ...state, players: first.players }, inbound.fromPlayerId, inbound.toPlayerId, inbound.asset);
		const expectedGrants = [first.cosmeticGrant, second.cosmeticGrant].filter((grant): grant is NonNullable<typeof grant> => Boolean(grant));
		if (JSON.stringify(expectedGrants) !== JSON.stringify(receipt.cosmeticGrants)) throw new Error("Trade receipt cosmetic grants do not match reconstructed ownership");
		const immutable = freezeReceipt({ ...receipt, transfers: [{ ...outbound, asset: cloneAsset(outbound.asset) }, { ...inbound, asset: cloneAsset(inbound.asset) }] });
		state = { ...state, players: second.players, trades: { ...state.trades, [receipt.tradeId]: { tradeId: receipt.tradeId, proposerId: receipt.participants[0], recipientId: receipt.participants[1], revision: receipt.revision, proposerGives: cloneAsset(outbound.asset), recipientGives: cloneAsset(inbound.asset), confirmations: { [receipt.participants[0]]: receipt.revision, [receipt.participants[1]]: receipt.revision }, createdAt: receipt.completedAt, expiresAt: receipt.completedAt, status: "completed", receiptId: receipt.receiptId } }, receipts: { ...state.receipts, [receipt.receiptId]: immutable } };
		priorCompletedAt = receipt.completedAt;
	}
	return state;
}

export const HALLOWEEN_TRADING_DEMO_SEED: SeasonalTradingSeed = {
	seedId: "halloween-2026-trading-demo-v1", setKey: "halloween_2026_v1",
	cards: {
		halloween_2026_card_moonbrew_witch_hat: { cosmeticId: "moonbrew_witch_hat" },
		halloween_2026_card_hollow_jack_costume: { cosmeticId: "halloween_2026_hollow_jack_costume" },
		halloween_2026_card_lantern_porch_bg: { cosmeticId: "lantern_porch_bg" },
	},
	players: [
		{ playerId: "rosie", inventory: { halloween_2026_card_moonbrew_witch_hat: { standard: 3, foil: 1 }, halloween_2026_card_lantern_porch_bg: { standard: 1 } }, cosmetics: ["moonbrew_witch_hat", "lantern_porch_bg"] },
		{ playerId: "pippin", inventory: { halloween_2026_card_hollow_jack_costume: { standard: 3, foil: 1 }, halloween_2026_card_lantern_porch_bg: { standard: 1 } }, cosmetics: ["halloween_2026_hollow_jack_costume", "lantern_porch_bg"] },
	],
};
