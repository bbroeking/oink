import { createSpookyTraderDemo, grantSpookyWearableFromFirstCard, redeemSpookyTraderRequest, spookyTraderRequestFor, tradeSpookyWearables } from "@/features/cards/domain/spookyTrader";

const ITEMS = ["moonbrew_witch_hat", "hollow_jack_costume", "cobweb_collar", "ghost_sheet"];
const DAY = "2026-10-14";
const make = (rosie: Record<string, number> = {}, pippin: Record<string, number> = {}) => createSpookyTraderDemo({ setKey: "halloween_2026_v1", eligibleWearableIds: ITEMS, draftTickles: 7, players: [{ playerId: "rosie", wearables: rosie }, { playerId: "pippin", wearables: pippin }] });

describe("Spooky Trader wearable loop", () => {
	it("is stable per player/day and binds request identity to the player", () => {
		const state = make(); const rosie = spookyTraderRequestFor(state, { playerId: "rosie", day: DAY });
		expect(spookyTraderRequestFor(state, { playerId: "rosie", day: DAY })).toEqual(rosie);
		expect(spookyTraderRequestFor(state, { playerId: "pippin", day: DAY }).requestId).not.toBe(rosie.requestId);
		const joined = createSpookyTraderDemo({ setKey: "halloween_2026_v1", eligibleWearableIds: ITEMS, draftTickles: 7, players: [{ playerId: "new-pig", wearables: {} }, { playerId: "rosie", wearables: {} }, { playerId: "pippin", wearables: {} }] });
		expect(spookyTraderRequestFor(joined, { playerId: "rosie", day: DAY }).wearableId).toBe(rosie.wearableId);
	});

	it("rejects a missing requested wearable", () => {
		expect(() => redeemSpookyTraderRequest(make(), { redemptionId: "missing-1", playerId: "rosie", day: DAY })).toThrow("not owned");
	});

	it("consumes the wearable and replays without a second draft payout", () => {
		const wanted = spookyTraderRequestFor(make(), { playerId: "rosie", day: DAY }).wearableId;
		const first = redeemSpookyTraderRequest(make({ [wanted]: 1 }), { redemptionId: "redeem-1", playerId: "rosie", day: DAY });
		expect(first.receipt).toMatchObject({ draftTickles: 7, consumed: { wearableId: wanted, quantity: 1 } });
		expect(first.state.players.rosie.wearables[wanted]).toBe(0);
		const replay = redeemSpookyTraderRequest(first.state, { redemptionId: "redeem-1", playerId: "rosie", day: DAY });
		expect(replay.replay).toBe(true); expect(replay.state).toBe(first.state); expect(replay.receipt).toBe(first.receipt);
	});

	it("conserves friend-traded items, then accounts for the Trader sink", () => {
		const wanted = spookyTraderRequestFor(make(), { playerId: "rosie", day: DAY }).wearableId;
		const offered = ITEMS.find((item) => item !== wanted)!;
		const traded = tradeSpookyWearables(make({ [offered]: 1 }, { [wanted]: 1 }), { tradeId: "help-rosie", firstPlayerId: "rosie", secondPlayerId: "pippin", firstGives: offered, secondGives: wanted });
		expect((traded.state.players.rosie.wearables[wanted] ?? 0) + (traded.state.players.pippin.wearables[wanted] ?? 0)).toBe(1);
		const done = redeemSpookyTraderRequest(traded.state, { redemptionId: "after-trade", playerId: "rosie", day: DAY });
		const left = (done.state.players.rosie.wearables[wanted] ?? 0) + (done.state.players.pippin.wearables[wanted] ?? 0);
		expect(left + done.receipt.consumed.quantity).toBe(1);
	});

	it("does not regrant a first-card item after it is consumed", () => {
		const wanted = spookyTraderRequestFor(make(), { playerId: "rosie", day: DAY }).wearableId;
		const grant = grantSpookyWearableFromFirstCard(make(), { cardOwnershipId: "card-1", playerId: "rosie", wearableId: wanted });
		const spent = redeemSpookyTraderRequest(grant.state, { redemptionId: "spend-card-item", playerId: "rosie", day: DAY });
		const replay = grantSpookyWearableFromFirstCard(spent.state, { cardOwnershipId: "different-client-nonce", playerId: "rosie", wearableId: wanted });
		expect(replay.replay).toBe(true); expect(replay.state.players.rosie.wearables[wanted]).toBe(0);
	});

	it("rejects grant and trade destination overflow before mutating either player", () => {
		const wanted = spookyTraderRequestFor(make(), { playerId: "rosie", day: DAY }).wearableId;
		expect(() => grantSpookyWearableFromFirstCard(make({ [wanted]: Number.MAX_SAFE_INTEGER }), { cardOwnershipId: "overflow-grant", playerId: "rosie", wearableId: wanted })).toThrow("overflow");
		const offered = ITEMS.find((item) => item !== wanted)!;
		const state = make({ [offered]: 1, [wanted]: Number.MAX_SAFE_INTEGER }, { [wanted]: 1 });
		expect(() => tradeSpookyWearables(state, { tradeId: "overflow-trade", firstPlayerId: "rosie", secondPlayerId: "pippin", firstGives: offered, secondGives: wanted })).toThrow("overflow");
		expect(state.players.rosie.wearables[offered]).toBe(1);
		expect(state.players.pippin.wearables[wanted]).toBe(1);
	});
});
