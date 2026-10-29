import {
	HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
	HALLOWEEN_LOGIN_GIFT_POOL,
	parseHalloweenLoginGiftResult,
	shouldPresentHalloweenLoginGift,
} from "@/features/cards/domain/halloweenLoginGift";

describe("Halloween login gift contract", () => {
	it("freezes five unique costume/card pairs", () => {
		expect(HALLOWEEN_LOGIN_GIFT_POOL).toHaveLength(5);
		expect(new Set(HALLOWEEN_LOGIN_GIFT_POOL.map((x) => x.costumeId)).size).toBe(5);
		expect(new Set(HALLOWEEN_LOGIN_GIFT_POOL.map((x) => x.cardId)).size).toBe(5);
	});

	it("accepts an authoritative unacknowledged receipt", () => {
		const result = parseHalloweenLoginGiftResult({
			ok: true,
			status: "new",
			receipt: {
				receiptId: "0ef31378-0739-4d77-814e-3b31c56c6277",
				campaignKey: HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
				...HALLOWEEN_LOGIN_GIFT_POOL[2],
				claimedAt: "2026-10-20T12:00:00Z",
				acknowledgedAt: null,
			},
		});
		expect(result?.status).toBe("new");
		expect(shouldPresentHalloweenLoginGift(result)).toBe(true);
	});

	it("rejects a costume/card mismatch and suppresses acknowledged replay", () => {
		expect(parseHalloweenLoginGiftResult({
			ok: true,
			status: "new",
			receipt: {
				receiptId: "receipt",
				campaignKey: HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
				costumeId: HALLOWEEN_LOGIN_GIFT_POOL[0].costumeId,
				cardId: HALLOWEEN_LOGIN_GIFT_POOL[1].cardId,
				claimedAt: "2026-10-20T12:00:00Z",
				acknowledgedAt: null,
			},
		})).toBeNull();

		const replay = parseHalloweenLoginGiftResult({
			ok: true,
			status: "replay",
			receipt: {
				receiptId: "receipt",
				campaignKey: HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
				...HALLOWEEN_LOGIN_GIFT_POOL[0],
				claimedAt: "2026-10-20T12:00:00Z",
				acknowledgedAt: "2026-10-20T12:01:00Z",
			},
		});
		expect(shouldPresentHalloweenLoginGift(replay)).toBe(false);
	});
});
