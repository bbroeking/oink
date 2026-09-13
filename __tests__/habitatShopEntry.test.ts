import fs from "node:fs";
import path from "node:path";

describe("Shop Barn furnishings section", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/(tabs)/shop.tsx"),
    "utf8",
  );

  it("gives furnishings a dedicated Snouts and collection-reward entry before shop tabs", () => {
    const section = source.indexOf('title="Barn Furnishings"');
    expect(section).toBeGreaterThan(0);
    // The Today/Closet/Pen switch is a SegmentedControl since the wave-3
    // section pass; `styles.viewSwitch` is the row that holds it.
    expect(section).toBeLessThan(source.indexOf("styles.viewSwitch"));
    expect(source).toContain('right="Furnish your room"');
    expect(source).toContain("Shop with Snouts.");
    expect(source).toContain("at four and eight owned designs");
    expect(source).toContain("<HabitatEntry collection />");
    // Housing is always on — no flag gate around the band (2026-09-12).
    expect(source).not.toContain('"habitat"');
  });
});
