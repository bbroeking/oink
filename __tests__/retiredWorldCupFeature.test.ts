import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("retired World Cup allegiance feature", () => {
	it("has no live picker, team catalog, or flag art bundle", () => {
		expect(fs.existsSync(path.join(root, "components/AllegianceModal.tsx"))).toBe(false);
		expect(fs.existsSync(path.join(root, "constants/worldCupFlags.ts"))).toBe(false);
		expect(fs.existsSync(path.join(root, "assets/images/hats/flags"))).toBe(false);
	});

	it("does not register an equippable flag category", () => {
		const hats = read("constants/hats.ts");
		expect(hats).not.toMatch(/WORLD_CUP_FLAG_IMAGES|flag_\$\{|\bflag:\s*\{/);
	});
});
