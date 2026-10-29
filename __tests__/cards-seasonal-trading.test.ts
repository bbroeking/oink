import {
	HALLOWEEN_TRADING_DEMO_SEED,
	availableSeasonalTradeQuantity,
	blockSeasonalTrader,
	cancelSeasonalTrade,
	confirmSeasonalTrade,
	createSeasonalTradingDemo,
	expireSeasonalTrades,
	openSeasonalTrade,
	reconstructSeasonalTrading,
	reviseSeasonalTrade,
	type OpenSeasonalTrade,
	type SeasonalTradingState,
} from "@/features/cards/domain/seasonalTrading";
import { HALLOWEEN_2026_DRAFT_MANIFEST } from "@/features/cards/data/halloweenSeason";

const WITCH = "halloween_2026_card_moonbrew_witch_hat";
const HOLLOW_JACK = "halloween_2026_card_hollow_jack_costume";
const PORCH = "halloween_2026_card_lantern_porch_bg";
const witch = { cardId: WITCH, finish: "standard" as const, quantity: 1 };
const hollowJack = { cardId: HOLLOW_JACK, finish: "standard" as const, quantity: 1 };
const offer = (tradeId = "trade-1"): OpenSeasonalTrade => ({
	tradeId, proposerId: "rosie", recipientId: "pippin", proposerGives: witch, recipientGives: hollowJack,
	ttlMs: 900,
});
const at = (now: number) => () => now;
const opened = (input = offer()): SeasonalTradingState => openSeasonalTrade(createSeasonalTradingDemo(HALLOWEEN_TRADING_DEMO_SEED), input, at(100));

describe("local seasonal card trading contract", () => {
	it("maps every demo card to its authored Spooky Snouts unlock", () => {
		const authored = new Map(HALLOWEEN_2026_DRAFT_MANIFEST.cards.map((card) => [card.cardId, card.itemId]));
		expect(Object.entries(HALLOWEEN_TRADING_DEMO_SEED.cards).map(([cardId, card]) => [cardId, card.cosmeticId])).toEqual([
			[WITCH, authored.get(WITCH)],
			[HOLLOW_JACK, authored.get(HOLLOW_JACK)],
			[PORCH, authored.get(PORCH)],
		]);
	});

	it("executes atomically only after both participants confirm the identical revision", () => {
		const one = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200));
		expect(one.receipt).toBeUndefined();
		expect(one.state.players.rosie.inventory[WITCH].standard).toBe(3);
		const two = confirmSeasonalTrade(one.state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		expect(two.receipt?.transfers).toHaveLength(2);
		expect(two.state.players.rosie.inventory[WITCH].standard).toBe(2);
		expect(two.state.players.rosie.inventory[HOLLOW_JACK].standard).toBe(1);
		expect(two.state.players.pippin.inventory[HOLLOW_JACK].standard).toBe(2);
		expect(two.state.players.pippin.inventory[WITCH].standard).toBe(1);
	});

	it("invalidates confirmations on revision and rejects stale acceptance", () => {
		const first = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(150)).state;
		const revised = reviseSeasonalTrade(first, { tradeId: "trade-1", proposerId: "rosie", expectedRevision: 1, proposerGives: { ...witch, quantity: 2 }, recipientGives: hollowJack }, at(200));
		expect(revised.trades["trade-1"].confirmations).toEqual({});
		expect(() => confirmSeasonalTrade(revised, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(200))).toThrow("Stale");
	});

	it("uses the clock seam so a backdated participant timestamp cannot confirm an expired offer", () => {
		const first = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const participantPayload = { tradeId: "trade-1", participantId: "pippin", revision: 1, confirmedAt: 200 };
		const expired = confirmSeasonalTrade(first, participantPayload, at(1_001));
		expect(expired.receipt).toBeUndefined();
		expect(expired.state.trades["trade-1"].status).toBe("expired");
		expect(expired.state.players.pippin.inventory[WITCH]).toBeUndefined();
	});

	it("keeps the original expiry across revisions and cannot edit an expired pending offer", () => {
		const original = opened();
		const revised = reviseSeasonalTrade(original, { tradeId: "trade-1", proposerId: "rosie", expectedRevision: 1, proposerGives: { ...witch, quantity: 2 }, recipientGives: hollowJack }, at(999));
		expect(revised.trades["trade-1"].expiresAt).toBe(original.trades["trade-1"].expiresAt);
		const expired = reviseSeasonalTrade(revised, { tradeId: "trade-1", proposerId: "rosie", expectedRevision: 2, proposerGives: witch, recipientGives: hollowJack }, at(1_000));
		expect(expired.trades["trade-1"].status).toBe("expired");
		expect(expired.trades["trade-1"].revision).toBe(2);
	});

	it("reserves exact finish quantities across other pending trades", () => {
		let state = opened();
		state = openSeasonalTrade(state, { ...offer("trade-2"), proposerGives: { ...witch, quantity: 1 } }, at(100));
		expect(availableSeasonalTradeQuantity(state, "rosie", { cardId: WITCH, finish: "standard" })).toBe(1);
		state = openSeasonalTrade(state, { ...offer("trade-3"), proposerGives: witch }, at(100));
		expect(() => openSeasonalTrade(state, { ...offer("trade-4"), proposerGives: witch }, at(100))).toThrow("reserved");
	});

	it("conserves standard and foil quantities independently", () => {
		const foilForFoil = offer("foil-swap");
		foilForFoil.proposerGives = { cardId: WITCH, finish: "foil", quantity: 1 };
		foilForFoil.recipientGives = { cardId: HOLLOW_JACK, finish: "foil", quantity: 1 };
		const first = confirmSeasonalTrade(opened(foilForFoil), { tradeId: "foil-swap", participantId: "rosie", revision: 1 }, at(200)).state;
		const done = confirmSeasonalTrade(first, { tradeId: "foil-swap", participantId: "pippin", revision: 1 }, at(201)).state;
		expect(done.players.rosie.inventory[WITCH]).toEqual({ standard: 3, foil: 0 });
		expect(done.players.pippin.inventory[WITCH]).toEqual({ foil: 1 });
		expect(done.players.pippin.inventory[HOLLOW_JACK]).toEqual({ standard: 3, foil: 0 });
	});

	it("rejects spending the last total copy even when the finish quantity exists", () => {
		const state = createSeasonalTradingDemo(HALLOWEEN_TRADING_DEMO_SEED);
		expect(() => openSeasonalTrade(state, { ...offer(), proposerGives: { cardId: PORCH, finish: "standard", quantity: 1 } })).toThrow("keep one copy");
	});

	it("replays a completed confirmation without a second transfer", () => {
		const once = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const complete = confirmSeasonalTrade(once, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		const replay = confirmSeasonalTrade(complete.state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(999));
		expect(replay.state).toBe(complete.state);
		expect(replay.receipt).toBe(complete.receipt);
		expect(replay.state.players.pippin.inventory[WITCH].standard).toBe(1);
	});

	it("grants a matching permanent cosmetic only on first-ever card acquisition", () => {
		const one = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const done = confirmSeasonalTrade(one, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		expect(done.receipt?.cosmeticGrants).toEqual([
			{ playerId: "pippin", cardId: WITCH, cosmeticId: "moonbrew_witch_hat" },
			{ playerId: "rosie", cardId: HOLLOW_JACK, cosmeticId: "halloween_2026_hollow_jack_costume" },
		]);
		expect(done.state.players.rosie.cosmetics).toEqual(expect.arrayContaining(["moonbrew_witch_hat", "halloween_2026_hollow_jack_costume"]));
	});

	it("does not duplicate a pre-owned cosmetic and never removes the sender cosmetic", () => {
		const seed = { ...HALLOWEEN_TRADING_DEMO_SEED, players: HALLOWEEN_TRADING_DEMO_SEED.players.map((player) => player.playerId === "pippin" ? { ...player, cosmetics: [...(player.cosmetics ?? []), "moonbrew_witch_hat"] } : player) };
		let state = openSeasonalTrade(createSeasonalTradingDemo(seed), offer(), at(100));
		state = confirmSeasonalTrade(state, { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const done = confirmSeasonalTrade(state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		expect(done.receipt?.cosmeticGrants.some((grant) => grant.playerId === "pippin")).toBe(false);
		expect(done.state.players.rosie.cosmetics).toContain("moonbrew_witch_hat");
	});

	it("reconstructs completed ownership from the app-authored seed and immutable receipt", () => {
		let state = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const complete = confirmSeasonalTrade(state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		const rebuilt = reconstructSeasonalTrading(HALLOWEEN_TRADING_DEMO_SEED, [complete.receipt!]);
		expect(rebuilt.players).toEqual(complete.state.players);
		expect(rebuilt.trades["trade-1"].status).toBe("completed");
		expect(Object.isFrozen(rebuilt.receipts["seasonal-trade:trade-1"])).toBe(true);
	});

	it("rejects a repeated receipt id with a different payload", () => {
		let state = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const complete = confirmSeasonalTrade(state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		const conflicting = { ...complete.receipt!, completedAt: 999 };
		expect(() => reconstructSeasonalTrading(HALLOWEEN_TRADING_DEMO_SEED, [complete.receipt!, conflicting])).toThrow("conflicting");
	});

	it.each([
		["null receipt", null],
		["missing receipt fields", undefined],
		["invalid revision", { revision: 0 }],
		["invalid completion time", { completedAt: -1 }],
		["malformed participants", { participants: "rosie,pippin" }],
		["malformed transfers", { transfers: [{}] }],
		["malformed grants", { cosmeticGrants: {} }],
	])("rejects malformed stored data: %s", (_label, override) => {
		let state = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const complete = confirmSeasonalTrade(state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		const stored = override === null ? null : override === undefined ? {} : { ...complete.receipt!, ...override };
		expect(() => reconstructSeasonalTrading(HALLOWEEN_TRADING_DEMO_SEED, [stored])).toThrow(/Malformed|Invalid/);
	});

	it("rejects stored receipts outside completion-time order", () => {
		let state = confirmSeasonalTrade(opened(), { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200)).state;
		const complete = confirmSeasonalTrade(state, { tradeId: "trade-1", participantId: "pippin", revision: 1 }, at(201));
		const olderSecond = { ...complete.receipt!, receiptId: "seasonal-trade:trade-2", tradeId: "trade-2", completedAt: 200 };
		expect(() => reconstructSeasonalTrading(HALLOWEEN_TRADING_DEMO_SEED, [complete.receipt!, olderSecond])).toThrow("unordered");
	});

	it("makes cancellation, expiry, and blocking terminal while releasing reservations", () => {
		const cancelled = cancelSeasonalTrade(opened(), "trade-1", "rosie");
		expect(cancelled.trades["trade-1"].status).toBe("cancelled");
		expect(availableSeasonalTradeQuantity(cancelled, "rosie", { cardId: WITCH, finish: "standard" })).toBe(3);
		const expired = expireSeasonalTrades(opened(), at(1_000));
		expect(expired.trades["trade-1"].status).toBe("expired");
		const blocked = blockSeasonalTrader(opened(), "pippin", "rosie");
		expect(blocked.trades["trade-1"].status).toBe("blocked");
		expect(() => openSeasonalTrade(blocked, offer("later"))).toThrow("blocked");
		expect(() => confirmSeasonalTrade(blocked, { tradeId: "trade-1", participantId: "rosie", revision: 1 }, at(200))).toThrow("already blocked");
	});

	it("rejects self-trades, base cards, recipient confusion, and underflowing quantities", () => {
		const state = createSeasonalTradingDemo(HALLOWEEN_TRADING_DEMO_SEED);
		expect(() => openSeasonalTrade(state, { ...offer(), recipientId: "rosie" })).toThrow("Self-trades");
		expect(() => openSeasonalTrade(state, { ...offer(), proposerGives: { cardId: "ordinary_base_card", finish: "standard", quantity: 1 } })).toThrow("Unknown seasonal");
		expect(() => openSeasonalTrade(state, { ...offer(), recipientId: WITCH })).toThrow("Unknown trade participant");
		expect(() => openSeasonalTrade(state, { ...offer(), proposerGives: { ...witch, quantity: 99 } })).toThrow("unavailable");
	});
});
