import fs from "node:fs";
import path from "node:path";

test("the rewarded-ad simulator preview is development-only", () => {
  const read = (file: string) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const route = read("app/ad-refill-preview.tsx");
  expect(route).toMatch(/__DEV__\s*\? require/);
  expect(route).toContain(': () => <Redirect href="/" />');
  expect(route).not.toContain("createAdMobRewardedProvider");
  expect(read("components/dev/screens/ad-refill-preview.tsx")).toContain("createAdMobRewardedProvider");
});
