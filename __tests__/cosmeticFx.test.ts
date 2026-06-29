// The animation resolver: the hero crown keeps its bespoke recipe; every
// members-catalog item derives a theme×category archetype recipe; backgrounds
// stay static; non-members items animate not at all.
import { cosmeticFxFor } from "../constants/cosmeticFx";
import { MEMBERS_FX_DATA } from "../constants/membersFx.generated";

const firstOf = (cat: string) =>
	Object.keys(MEMBERS_FX_DATA).find((id) => MEMBERS_FX_DATA[id].category === cat);

describe("cosmeticFxFor", () => {
	it("returns the bespoke recipe for the Signet Crown (4 jewel sparkles)", () => {
		const fx = cosmeticFxFor("slop_club_signet_crown");
		expect(fx).toBeTruthy();
		expect(fx!.sparkles?.length).toBe(4);
		expect(fx!.glow?.color).toBe("#F5C44A");
	});

	it("derives a full archetype recipe for a members hat", () => {
		const id = firstOf("hat")!;
		const fx = cosmeticFxFor(id)!;
		expect(fx.float).toBeTruthy(); // hats bob
		expect(fx.glow).toBeTruthy();
		expect(fx.shimmer).toBeTruthy();
		expect(fx.sparkles?.length).toBe(3); // hat layout = peak + 2
	});

	it("gives auras a glow + sparkles but NO float (a ring shouldn't bob)", () => {
		const id = firstOf("aura");
		if (!id) return; // catalog always has auras, but guard anyway
		const fx = cosmeticFxFor(id)!;
		expect(fx.float).toBeUndefined();
		expect(fx.glow).toBeTruthy();
		expect(fx.sparkles!.length).toBeGreaterThan(3);
	});

	it("leaves members backgrounds static (full-bleed scenes don't animate)", () => {
		const id = firstOf("background");
		if (!id) return;
		expect(cosmeticFxFor(id)).toBeUndefined();
	});

	it("does not animate ordinary non-members items", () => {
		expect(cosmeticFxFor("beanie")).toBeUndefined();
		expect(cosmeticFxFor("tophat")).toBeUndefined();
	});

	it("every members item resolves to a recipe OR is a background", () => {
		const notAnimated: string[] = [];
		for (const [id, m] of Object.entries(MEMBERS_FX_DATA)) {
			const fx = cosmeticFxFor(id);
			if (m.category === "background") expect(fx).toBeUndefined();
			else if (!fx) notAnimated.push(`${id} (${m.category})`);
		}
		expect(notAnimated).toEqual([]);
	});
});
