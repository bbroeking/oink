import fs from "node:fs";
import path from "node:path";
import { resolveShopParams } from "../utils/shopNav";

const ROOT = path.resolve(__dirname, "..");
const shop = fs.readFileSync(path.join(ROOT, "app/(tabs)/shop.tsx"), "utf8");
const closet = fs.readFileSync(
	path.join(ROOT, "components/ClosetView.tsx"),
	"utf8",
);

// The Closet stopped being a room (the hero fitting room, 2026-09-17): the
// store is one scroll, so every old link INTO the wardrobe now lands on the
// store and scrolls down to the catalog. The Pen stopped being a room the same
// day — it is a pushed route, so a link asking for it is a redirect.
describe("resolveShopParams", () => {
	it("lands an old wardrobe link on the store, scrolled to the catalog", () => {
		expect(resolveShopParams({ view: "wardrobe" })).toEqual({
			scrollToCloset: true,
			prestigeOnly: false,
		});
	});

	it("lands the retired Collectibles link the same way", () => {
		expect(resolveShopParams({ view: "browse" })).toEqual({
			scrollToCloset: true,
			prestigeOnly: false,
		});
	});

	it("keeps the prestige filter and scrolls to it, with or without a view", () => {
		expect(
			resolveShopParams({ view: "wardrobe", filter: "prestige" }),
		).toEqual({ scrollToCloset: true, prestigeOnly: true });
		expect(resolveShopParams({ filter: "prestige" })).toEqual({
			scrollToCloset: true,
			prestigeOnly: true,
		});
	});

	it("sends an old Pen link out to the Pen's own route", () => {
		expect(resolveShopParams({ view: "pen" })).toEqual({
			redirect: "/pen",
			scrollToCloset: false,
			prestigeOnly: false,
		});
	});

	it("lands the store's front for daily and for the retired Trough link", () => {
		for (const view of ["daily", "trough"]) {
			expect(resolveShopParams({ view })).toEqual({
				scrollToCloset: false,
				prestigeOnly: false,
			});
		}
	});

	it("says nothing when the params say nothing", () => {
		expect(resolveShopParams({})).toBeNull();
		expect(resolveShopParams({ view: "nonsense" })).toBeNull();
	});
});

describe("the store is one scroll", () => {
	const pen = fs.readFileSync(path.join(ROOT, "app/pen.tsx"), "utf8");

	it("has no room left to switch to — no view state at all", () => {
		expect(shop).not.toContain('"wardrobe"');
		expect(shop).not.toContain("<ScrollView");
		expect(shop).toContain('import { resolveShopParams } from "@/utils/shopNav"');
		expect(shop).not.toContain("ShopView");
		expect(shop).not.toContain("<PigPenView");
	});

	it("renders the store wall inside the Closet's list, with the fold wired", () => {
		expect(shop).toContain("storeContent={storeWall}");
		expect(shop).toContain("onFoldChange={setFolded}");
		expect(shop).toContain("ref={closetRef}");
		expect(shop).toContain("closetRef.current?.scrollToCloset()");
	});

	it("carries no folded 'wearing N of M' strip (retired 2026-09-18 — not necessary)", () => {
		expect(shop).not.toContain("FittingStrip");
		expect(fs.existsSync(path.join(ROOT, "components/shop/FittingStrip.tsx"))).toBe(false);
	});

	it("hangs only the two doors, and both of them leave the page", () => {
		expect(shop).not.toContain('label="Store"');
		expect(shop).not.toContain('label="Closet"');
		expect(shop).toContain('onPress={() => router.push("/pen")}');
		expect(shop).toContain('onPress={() => router.push("/barn-collection")}');
		expect(shop).toContain(
			'<SlopClubShelf onPressSign={() => router.push("/pen")}>',
		);
	});

	it("gives the catalog its own crown inside the store's list", () => {
		expect(closet).toContain('kicker="the whole rack"');
		expect(closet).toContain('title="Everything"');
		// The prestige banner belongs to the catalog, not the page.
		expect(closet).toContain("{storeContent ? prestigeBanner : null}");
		expect(closet).toContain("{storeContent ? null : prestigeBanner}");
	});

	it("exposes the scroll-to-closet handle and the fold callback (the crown callback went with the strip)", () => {
		expect(closet).toContain("ClosetViewHandle");
		expect(closet).toContain("useImperativeHandle(ref, () => ({ scrollToCloset })");
		expect(closet).toContain("onFoldChange");
		expect(closet).not.toContain("onClosetReached");
	});

	it("gives the Pen its own route, with the way back to the shop", () => {
		expect(pen).toContain("<PigPenView");
		expect(pen).toContain('backLabel="back to the shop"');
		expect(pen).toContain(
			'router.canGoBack() ? router.back() : router.replace("/(tabs)/shop")',
		);
		expect(pen).toContain("useJoinSlopClub(pigRoster.refresh)");
	});

	it("sends every old Pen link at the route, not the tab", () => {
		const layout = fs.readFileSync(path.join(ROOT, "app/_layout.tsx"), "utf8");
		const account = fs.readFileSync(
			path.join(ROOT, "components/Account.tsx"),
			"utf8",
		);
		expect(layout).not.toContain("view=pen");
		expect(account).not.toContain("view=pen");
		expect(account).toContain('router.push("/pen" as Href)');
	});
});

// The doorway row used to overlap the card above it: nothing in it could
// shrink, so three fixed signs plus the chalkboard summed wider than the row
// and the count badge hung out of the top. (2026-09-17)
describe("the doorway row can give", () => {
	const sign = fs.readFileSync(
		path.join(ROOT, "components/shop/HangingSign.tsx"),
		"utf8",
	);
	const board = fs.readFileSync(
		path.join(ROOT, "components/shop/Chalkboard.tsx"),
		"utf8",
	);

	it("gives every sign a stated width instead of a share of the row", () => {
		expect(sign).toContain("export const SIGN_W = 60;");
		expect(sign).toContain("width: SIGN_W,");
		expect(sign).not.toMatch(/hanger:\s*\{\s*flex: 1/);
	});

	it("makes the chalkboard the one thing that shrinks", () => {
		expect(board).toContain("flexShrink: 1,");
		expect(board).toContain("minWidth: 0,");
		expect(board).toContain("numberOfLines={1}");
		expect(board).toContain("maxFontSizeMultiplier={BOARD_TYPE_CAP}");
	});

	it("clears the badge's overhang and stops the signs stretching", () => {
		expect(shop).toContain("paddingTop: SPACE.card,");
		expect(shop).toMatch(/signs:\s*\{\s*flexShrink: 0,/);
	});

	it("drops the label off the door-only signs on a narrow phone", () => {
		expect(sign).toContain("labelHidden");
		expect(shop).toContain(
			"const signLabelsHidden = shopScreenW < SHOP_SIGN_LABELS_MIN;",
		);
		expect(shop).toContain("labelHidden={signLabelsHidden}");
	});
});
