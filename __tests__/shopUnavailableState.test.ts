import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const hook = fs.readFileSync(
	path.join(ROOT, "hooks/useShopCatalog.ts"),
	"utf8"
);
const screen = fs.readFileSync(
	path.join(ROOT, "app/(tabs)/shop.tsx"),
	"utf8"
);

describe("shop unavailable state", () => {
	it("does not replace catalog state with empty values when a fetch fails", () => {
		const failureBranch = hook.match(
			/if \(fetchError\) \{([\s\S]*?)\n\t\t\}/
		)?.[1];

		expect(failureBranch).toBeDefined();
		expect(failureBranch).toContain("setError(");
		expect(failureBranch).not.toContain("setDaily(");
		expect(failureBranch).not.toContain("setAllItems(");
		expect(failureBranch).not.toContain("setCounter(");
	});

	it("shows a recoverable error instead of a sold-out state", () => {
		expect(screen).toContain("Shop unavailable");
		expect(screen).toContain("Try again");
		expect(screen).toContain("error && !hasCatalogData");
	});
});
