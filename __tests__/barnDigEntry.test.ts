import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const barnEntry = fs.readFileSync(
  path.join(ROOT, "components/BarnSounderChip.tsx"),
  "utf8",
);
const feedingCta = fs.readFileSync(
  path.join(ROOT, "components/mudwar/useFeedingCta.tsx"),
  "utf8",
);
const seasonFeeding = fs.readFileSync(
  path.join(ROOT, "components/season1/SounderHomeCard.tsx"),
  "utf8",
);
const patch = fs.readFileSync(
  path.join(ROOT, "components/mudwar/TrufflePatch.tsx"),
  "utf8",
);

describe("Barn Truffle Patch entry", () => {
  test("crewed players can open the dig directly from Home", () => {
    expect(barnEntry).toContain(
      'const crewed = step === "first_dig" || step === "done"',
    );
    expect(barnEntry).toContain('? "Dig for Golden Truffles"');
    expect(barnEntry).toContain("onPress={cta.start}");
    expect(barnEntry).toContain("{cta.modal}");
  });

  test("the direct action preserves honest unavailable states", () => {
    expect(barnEntry).toContain('"Dug this feeding"');
    expect(barnEntry).toContain("`Dig opens in ${cta.countdown}`");
    expect(barnEntry).toContain("accessibilityState={{ disabled: !open }}");
  });

  test("mounted Home and Season entry points reconcile on focus", () => {
    expect(feedingCta).toContain("useFocusEffect(");
    expect(feedingCta).toMatch(
      /useFocusEffect\([\s\S]*setClock\(ctaClock\(\)\);[\s\S]*reconcile\(\);/,
    );
  });

  test("states the personal and shared payoff before and after a dig", () => {
    expect(barnEntry).toContain('"Dig for Golden Truffles"');
    expect(barnEntry).toContain("Golden Truffles · +20 Pass XP · Sounder spoils");
    expect(seasonFeeding).toContain("Golden Truffles + relics · +20 Pass XP");
    expect(seasonFeeding).toContain(
      "15-Truffle stage reward and your Sounder's Monday payout",
    );
    expect(patch).toContain("Season Pass: +20 XP");
    expect(patch).toContain(
      "No finds made it home this time — the Hungerer and Dig-Off stay put.",
    );
    expect(patch).toContain(
      "qualified for this stage's 15-Truffle reward and Monday's Dig-Off spoils",
    );
  });
});
