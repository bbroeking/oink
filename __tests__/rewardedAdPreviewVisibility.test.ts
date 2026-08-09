import fs from "node:fs";
import path from "node:path";

test("the rewarded-ad simulator preview is development-only", () => {
	const source = fs.readFileSync(
		path.join(__dirname, "..", "app", "ad-refill-preview.tsx"),
		"utf8"
	);
	expect(source).toContain("if (!__DEV__) return <Redirect");
	expect(source).toContain("createAdMobRewardedProvider");
});
