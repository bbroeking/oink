import fs from "node:fs";
import path from "node:path";

describe("Shop Barn furnishings entry", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/(tabs)/shop.tsx"),
    "utf8",
  );

  it("hangs Furnish as a sign by the door that opens the furnishings collection", () => {
    // The storefront (2026-09-16, ruling 3): Closet and Furnish hang as signs
    // so the counter front belongs to the pigs. The old "Barn Furnishings"
    // band and its HabitatEntry button are gone from the Shop; the sign
    // routes to the same collection screen the button did.
    const sign = source.indexOf('label="Furnish"');
    expect(sign).toBeGreaterThan(0);
    const route = source.indexOf('router.push("/barn-collection")', sign);
    expect(route).toBeGreaterThan(sign);
    expect(source).toContain("HABITAT_CHROME_ASSETS.barnDoor");
    expect(source).not.toContain('title="Barn Furnishings"');
    expect(source).not.toContain("<HabitatEntry");
    // Housing is always on — no flag gate around the entry (2026-09-12).
    expect(source).not.toContain('"habitat"');
  });
});
