// Truffle Exchange — pure-mirror tests (utils/truffleExchange.ts mirrors
// exchange_week_stock() in 20260704300000_truffle_exchange.sql; the server
// owns the real stock, this guards the shared arithmetic + tier tables).
import {
	pickRotation,
	tierForId,
	priceForId,
	isoWeekInfo,
	restockWhisper,
} from "../utils/truffleExchange";
import {
	EXCHANGE_TIERS,
	EXCHANGE_PRICES,
	TRUFFLE_MILESTONES,
	WAR_SPOILS_IDS,
	type ExchangeTier,
} from "../constants/mudFights";

describe("exchange rotation (client mirror)", () => {
	it("is deterministic: same seed + week → same stock", () => {
		expect(pickRotation(123456789, 27)).toEqual(pickRotation(123456789, 27));
	});

	it("different seeds produce different stock somewhere", () => {
		const a = pickRotation(123456789, 27);
		const b = pickRotation(987654321, 27);
		expect(a).not.toEqual(b);
	});

	it("always stocks one muddy, one caked, one prize, and a parity marquee", () => {
		for (const [seed, week] of [
			[1, 1],
			[424242, 2],
			[2147483646, 51],
			[7, 52],
		] as const) {
			const stock = pickRotation(seed, week);
			expect(stock).toHaveLength(4);
			expect(EXCHANGE_TIERS.muddy).toContain(stock[0]);
			expect(EXCHANGE_TIERS.caked).toContain(stock[1]);
			expect(EXCHANGE_TIERS.prize).toContain(stock[2]);
			const marqueePool =
				week % 2 === 0 ? EXCHANGE_TIERS.champion : EXCHANGE_TIERS.heirloom;
			expect(marqueePool).toContain(stock[3]);
		}
	});
});

describe("tier tables", () => {
	it("cover exactly the 25 war-spoil ids with no overlap", () => {
		const all = (Object.keys(EXCHANGE_TIERS) as ExchangeTier[]).flatMap(
			(t) => EXCHANGE_TIERS[t]
		);
		expect(all).toHaveLength(25);
		expect(new Set(all).size).toBe(25);
		expect(new Set(all)).toEqual(new Set(WAR_SPOILS_IDS as unknown as string[]));
	});

	it("maps ids to spec prices (25/60/120/250/500)", () => {
		expect(priceForId("muddy_cap")).toBe(25);
		expect(priceForId("reed_hat")).toBe(60);
		expect(priceForId("golden_truffle")).toBe(120);
		expect(priceForId("swamp_crown")).toBe(250);
		expect(priceForId("heirloom_mire_aura")).toBe(500);
		expect(priceForId("not_a_hat")).toBeNull();
		expect(tierForId("festival_night_bg")).toBe("heirloom");
	});

	it("prices rise monotonically up the ladder", () => {
		const ordered: ExchangeTier[] = ["muddy", "caked", "prize", "champion", "heirloom"];
		for (let i = 1; i < ordered.length; i++) {
			expect(EXCHANGE_PRICES[ordered[i]]).toBeGreaterThan(EXCHANGE_PRICES[ordered[i - 1]]);
		}
	});
});

describe("milestones (client mirror of mint_mud_milestones)", () => {
	it("thresholds ascend and the purses sum to the 30/war cap", () => {
		const thresholds = TRUFFLE_MILESTONES.map(([t]) => t);
		expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
		const total = TRUFFLE_MILESTONES.reduce((s, [, p]) => s + p, 0);
		expect(total).toBe(30);
	});
});

describe("iso week + restock", () => {
	it("computes a stable key and a Monday-boundary restock", () => {
		// 2026-07-03 is a Friday → ISO week 27, restock Monday 2026-07-06.
		const info = isoWeekInfo(new Date(Date.UTC(2026, 6, 3, 12)));
		expect(info.key).toBe("2026-27");
		expect(info.weekNumber).toBe(27);
		expect(info.restockAt.toISOString().slice(0, 10)).toBe("2026-07-06");
		expect(info.restockAt.getUTCDay()).toBe(1); // Monday
	});

	it("whispers days, then hours, then now", () => {
		const restock = new Date(Date.UTC(2026, 6, 6));
		expect(restockWhisper(restock, new Date(Date.UTC(2026, 6, 3)))).toBe("restocks in 3d");
		expect(restockWhisper(restock, new Date(Date.UTC(2026, 6, 5, 20)))).toBe("restocks in 4h");
		expect(restockWhisper(restock, new Date(Date.UTC(2026, 6, 7)))).toBe("restocking now");
	});
});
