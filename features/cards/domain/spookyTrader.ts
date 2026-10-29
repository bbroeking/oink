export interface WearableSeed { playerId: string; wearables: Readonly<Record<string, number>> }
export interface SpookyTraderConfig { setKey: string; eligibleWearableIds: readonly string[]; draftTickles: number; players: readonly WearableSeed[] }
export interface DailyRequest { requestId: string; playerId: string; day: string; setKey: string; wearableId: string }
export interface WearableTradeReceipt { receiptId: string; tradeId: string; transfers: readonly { from: string; to: string; wearableId: string; quantity: 1 }[] }
export interface RedemptionReceipt { receiptId: string; redemptionId: string; requestId: string; playerId: string; day: string; setKey: string; consumed: Readonly<{ wearableId: string; quantity: 1 }>; draftTickles: number }
export interface CardGrantReceipt { receiptId: string; cardOwnershipId: string; playerId: string; wearableId: string }
export interface SpookyTraderState {
	readonly authority: "local-spooky-wearable-demo";
	readonly notice: "Fixture wearable instances and draft Tickles only; no live closet, balance, server, or message mutation.";
	readonly setKey: string; readonly eligibleWearableIds: readonly string[]; readonly draftTickles: number;
	readonly players: Readonly<Record<string, { wearables: Readonly<Record<string, number>> }>>;
	readonly tradeReceipts: Readonly<Record<string, WearableTradeReceipt>>;
	readonly redemptionReceipts: Readonly<Record<string, RedemptionReceipt>>;
	readonly dailyReceiptIds: Readonly<Record<string, string>>;
	readonly cardGrantReceipts: Readonly<Record<string, CardGrantReceipt>>;
}

const ID = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/i;
const NOTICE = "Fixture wearable instances and draft Tickles only; no live closet, balance, server, or message mutation." as const;
function id(value: string, label: string) { if (!ID.test(value)) throw new Error(`Invalid ${label}`) }
function day(value: string) {
	const parsed = new Date(`${value}T00:00:00Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Invalid spooky trader day");
}
function hash(value: string) { let h = 0x811c9dc5; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 0x01000193) } return h >>> 0 }
function player(state: SpookyTraderState, playerId: string) { const found = state.players[playerId]; if (!found) throw new Error("Unknown spooky wearable player"); return found }
function wearable(state: SpookyTraderState, wearableId: string) { if (!state.eligibleWearableIds.includes(wearableId)) throw new Error("Unknown spooky wearable") }

export function createSpookyTraderDemo(config: SpookyTraderConfig): SpookyTraderState {
	id(config.setKey, "set key");
	if (!Number.isSafeInteger(config.draftTickles) || config.draftTickles < 0) throw new Error("Invalid draft Tickles");
	const eligible = [...new Set(config.eligibleWearableIds)];
	if (eligible.length < 2) throw new Error("At least two eligible wearables are required");
	eligible.forEach((value) => id(value, "wearable id"));
	const players: Record<string, { wearables: Record<string, number> }> = {};
	for (const seed of config.players) {
		id(seed.playerId, "player id"); if (players[seed.playerId]) throw new Error("Duplicate player");
		for (const [key, quantity] of Object.entries(seed.wearables)) if (!eligible.includes(key) || !Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Invalid seeded wearable");
		players[seed.playerId] = { wearables: { ...seed.wearables } };
	}
	if (Object.keys(players).length < 2) throw new Error("At least two players are required");
	return { authority: "local-spooky-wearable-demo", notice: NOTICE, setKey: config.setKey, eligibleWearableIds: eligible, draftTickles: config.draftTickles, players, tradeReceipts: {}, redemptionReceipts: {}, dailyReceiptIds: {}, cardGrantReceipts: {} };
}

export function spookyTraderRequestFor(state: SpookyTraderState, input: { playerId: string; day: string }): DailyRequest {
	player(state, input.playerId); day(input.day);
	const wearableId = state.eligibleWearableIds[hash(`${state.setKey}:${input.day}:${input.playerId}`) % state.eligibleWearableIds.length];
	return Object.freeze({ requestId: `spooky-request:${input.playerId}:${input.day}`, ...input, setKey: state.setKey, wearableId });
}

export function grantSpookyWearableFromFirstCard(state: SpookyTraderState, input: { cardOwnershipId: string; playerId: string; wearableId: string }) {
	id(input.cardOwnershipId, "card ownership id"); const owner = player(state, input.playerId); wearable(state, input.wearableId);
	// One source wearable per player/set, regardless of how many client nonces
	// claim the same first-copy event. Production must derive this from its
	// verified card-to-wearable mapping rather than trust a caller-provided id.
	const receiptId = `spooky-card-grant:${state.setKey}:${input.playerId}:${input.wearableId}`; const prior = state.cardGrantReceipts[receiptId];
	if (prior) return { state, receipt: prior, replay: true };
	const quantity = owner.wearables[input.wearableId] ?? 0;
	if (quantity >= Number.MAX_SAFE_INTEGER) throw new Error("Spooky wearable quantity overflow");
	const receipt = Object.freeze({ receiptId, ...input });
	const nextOwner = { wearables: { ...owner.wearables, [input.wearableId]: quantity + 1 } };
	return { state: { ...state, players: { ...state.players, [input.playerId]: nextOwner }, cardGrantReceipts: { ...state.cardGrantReceipts, [receiptId]: receipt } }, receipt, replay: false };
}

function move(players: SpookyTraderState["players"], from: string, to: string, wearableId: string) {
	const giver = players[from], receiver = players[to], quantity = giver.wearables[wearableId] ?? 0;
	if (quantity < 1) throw new Error("Wearable is not owned by the sender");
	return { ...players, [from]: { wearables: { ...giver.wearables, [wearableId]: quantity - 1 } }, [to]: { wearables: { ...receiver.wearables, [wearableId]: (receiver.wearables[wearableId] ?? 0) + 1 } } };
}

export function tradeSpookyWearables(state: SpookyTraderState, input: { tradeId: string; firstPlayerId: string; secondPlayerId: string; firstGives: string; secondGives: string }) {
	id(input.tradeId, "trade id"); if (input.firstPlayerId === input.secondPlayerId) throw new Error("Self-trades are not allowed");
	player(state, input.firstPlayerId); player(state, input.secondPlayerId); wearable(state, input.firstGives); wearable(state, input.secondGives);
	const receiptId = `spooky-wearable-trade:${input.tradeId}`; const prior = state.tradeReceipts[receiptId];
	if (prior) {
		const [first, second] = prior.transfers;
		if (first.from !== input.firstPlayerId || first.to !== input.secondPlayerId || first.wearableId !== input.firstGives || second.wearableId !== input.secondGives) throw new Error("Trade replay identity mismatch");
		return { state, receipt: prior, replay: true };
	}
	if ((state.players[input.firstPlayerId].wearables[input.firstGives] ?? 0) < 1 || (state.players[input.secondPlayerId].wearables[input.secondGives] ?? 0) < 1) throw new Error("Wearable is not owned by the sender");
	const firstDestination = state.players[input.secondPlayerId].wearables[input.firstGives] ?? 0;
	const secondDestination = state.players[input.firstPlayerId].wearables[input.secondGives] ?? 0;
	if (firstDestination >= Number.MAX_SAFE_INTEGER || secondDestination >= Number.MAX_SAFE_INTEGER) throw new Error("Spooky wearable quantity overflow");
	let players = move(state.players, input.firstPlayerId, input.secondPlayerId, input.firstGives); players = move(players, input.secondPlayerId, input.firstPlayerId, input.secondGives);
	const receipt: WearableTradeReceipt = Object.freeze({ receiptId, tradeId: input.tradeId, transfers: Object.freeze([
		Object.freeze({ from: input.firstPlayerId, to: input.secondPlayerId, wearableId: input.firstGives, quantity: 1 as const }),
		Object.freeze({ from: input.secondPlayerId, to: input.firstPlayerId, wearableId: input.secondGives, quantity: 1 as const }),
	]) });
	return { state: { ...state, players, tradeReceipts: { ...state.tradeReceipts, [receiptId]: receipt } }, receipt, replay: false };
}

export function redeemSpookyTraderRequest(state: SpookyTraderState, input: { redemptionId: string; playerId: string; day: string }) {
	id(input.redemptionId, "redemption id"); const request = spookyTraderRequestFor(state, input); const receiptId = `spooky-redemption:${input.redemptionId}`;
	const prior = state.redemptionReceipts[receiptId]; if (prior) { if (prior.requestId !== request.requestId) throw new Error("Redemption replay identity mismatch"); return { state, receipt: prior, replay: true } }
	const priorDay = state.dailyReceiptIds[`${input.playerId}:${input.day}`]; if (priorDay) return { state, receipt: state.redemptionReceipts[priorDay], replay: true };
	const owner = player(state, input.playerId), quantity = owner.wearables[request.wearableId] ?? 0; if (quantity < 1) throw new Error("The wearable the spooky trader wants is not owned");
	const receipt: RedemptionReceipt = Object.freeze({ receiptId, redemptionId: input.redemptionId, requestId: request.requestId, playerId: input.playerId, day: input.day, setKey: state.setKey, consumed: Object.freeze({ wearableId: request.wearableId, quantity: 1 as const }), draftTickles: state.draftTickles });
	return { state: { ...state, players: { ...state.players, [input.playerId]: { wearables: { ...owner.wearables, [request.wearableId]: quantity - 1 } } }, redemptionReceipts: { ...state.redemptionReceipts, [receiptId]: receipt }, dailyReceiptIds: { ...state.dailyReceiptIds, [`${input.playerId}:${input.day}`]: receiptId } }, receipt, replay: false };
}
