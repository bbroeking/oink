// Source-scan guards for the counter's two inventories sharing one gate.
//
// The screen's "today only" purchase gate and the preview sheet's `buyable`
// must both read `buyableIds` (drop ∪ counter) — a regression to `daily`
// alone would silently make every counter item unbuyable with a "Today only"
// toast. And the counter RPC must carry daily_shop's own for-sale rules
// (cost > 0, never pass_exclusive, never a hidden category), or a crewmate's
// pass reward would stand at the counter with a price it can't be sold at.

import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SCREEN = path.join(ROOT, "app", "(tabs)", "shop.tsx");
const HOOK = path.join(ROOT, "hooks", "useShopCatalog.ts");
const MIGRATION = path.join(
	ROOT,
	"supabase",
	"migrations",
	"20260916130000_sounder_counter_buys.sql",
);

describe("the counter buys through the shelf's own gate", () => {
	const screen = fs.readFileSync(SCREEN, "utf8");

	it("handleBuy gates on buyableIds, not on today's drop alone", () => {
		expect(screen).toMatch(/if \(!buyableIds\.has\(hat\.id\)\)/);
		expect(screen).not.toMatch(/daily\.some\(\(d\) => d\.id === hat\.id\)/);
	});

	it("the preview sheet's buyable flag reads buyableIds", () => {
		expect(screen).toMatch(/buyable=\{previewItem \? buyableIds\.has\(previewItem\.id\)/);
	});

	it("but a Trough still only opens for today's drop (open_item_drive refuses not_in_shop)", () => {
		expect(screen).toMatch(/troughable=\{previewItem \? dailyIds\.has\(previewItem\.id\)/);
		const modal = fs.readFileSync(
			path.join(ROOT, "components", "ItemPreviewModal.tsx"),
			"utf8",
		);
		expect(modal).toMatch(/item\.cost > 0 && troughable &&/);
	});

	it("the sounder stands at the counter, one figure per crewmate buy", () => {
		// Storefront build 2: the counter is its own component; the screen
		// hands it the buys and it draws a figure per buy under the kicker.
		expect(screen).toMatch(/<Counter\s[\s\S]{0,200}buys=\{counterBuys\}/);
		const counter = fs.readFileSync(
			path.join(ROOT, "components", "shop", "Counter.tsx"),
			"utf8",
		);
		expect(counter).toMatch(/buys\.map\(/);
		expect(counter).toMatch(/at the counter today/);
	});

	it("the hook derives buyableIds as drop ∪ counter", () => {
		const hook = fs.readFileSync(HOOK, "utf8");
		expect(hook).toMatch(/unionBuyableIds\(daily, counterBuys\)/);
		expect(hook).toMatch(/rpc<unknown>\("sounder_counter_buys"\)/);
	});
});

describe("the preview sheet's remaining gates", () => {
	const screen = fs.readFileSync(SCREEN, "utf8");
	const modal = fs.readFileSync(
		path.join(ROOT, "components", "ItemPreviewModal.tsx"),
		"utf8",
	);

	it("a members-only piece is gated before the balance branch", () => {
		expect(screen).toMatch(/locked=\{previewItem \? !!previewItem\.members_only && !isVip/);
		const lockedAt = modal.indexOf(") : locked ? (");
		const balanceAt = modal.indexOf(") : !canAfford ? (");
		expect(lockedAt).toBeGreaterThan(0);
		expect(lockedAt).toBeLessThan(balanceAt);
	});

	it("wearing implies owning, so a dangling equip never hides Buy", () => {
		expect(screen).toMatch(/return owned\.has\(id\) && activeIds\[columnForCategory\(category\)\] === id;/);
	});

	it("opening a Trough from the sheet moves the header chip; the counter trough left the store (2026-09-17)", () => {
		expect(screen).toMatch(/onTroughOpened=\{[\s\S]{0,400}setCounter\(/);
		expect(screen).not.toContain("TroughByCounter");
	});
});

describe("sounder_counter_buys() carries the for-sale rules", () => {
	const sql = fs.readFileSync(MIGRATION, "utf8");

	it("only priced, non-pass, placeable items; never the caller's own buys", () => {
		expect(sql).toMatch(/h\.cost\s*>\s*0/);
		expect(sql).toMatch(/NOT h\.pass_exclusive/);
		expect(sql).toMatch(/category NOT IN \('cape', 'flag', 'scarf', 'necklace'\)/);
		expect(sql).toMatch(/cm\.user_id\s*<>\s*me\.user_id/);
	});

	it("is scoped to the caller's crew and to the shop's UTC day", () => {
		expect(sql).toMatch(/me\.user_id = auth\.uid\(\)/);
		expect(sql).toMatch(/AT TIME ZONE 'utc'\)::date = \(now\(\) AT TIME ZONE 'utc'\)::date/);
	});
});
