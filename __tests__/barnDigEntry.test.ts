import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
// The crewed/uncrewed decision + the in-place patch mounting live in the hook
// now; the Barn's dig control is one consumer of it. The retired
// BarnSounderChip (and the Updates tray that mounted it) are gone.
const digEntry = fs.readFileSync(
  path.join(ROOT, "hooks/useDigEntry.ts"),
  "utf8",
);
const barn = fs.readFileSync(path.join(ROOT, "components/Barn.tsx"), "utf8");
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
    expect(digEntry).toContain(
      'const crewed = coopDig && (step === "first_dig" || step === "done")',
    );
    expect(digEntry).toContain('? "Dig for Golden Truffles"');
    expect(digEntry).toContain("void start();");
    expect(digEntry).toContain("modal: cta.modal,");
    // The Barn's one dig control consumes the hook — label, hint and the single
    // mounted patch — instead of jumping to the Season tab.
    expect(barn).toContain("const dig = useDigEntry();");
    expect(barn).toContain('accessibilityLabel="Truffle Patch"');
    expect(barn).toContain("accessibilityHint={dig.hint}");
    expect(barn).toMatch(/\{dig\.visible \? \(\s*<Sticker/);
    expect(barn).toContain("{dig.modal}");
  });

  test("the direct action preserves honest unavailable states", () => {
    expect(digEntry).toContain('"Dug this feeding"');
    expect(digEntry).toContain("`Dig opens in ${cta.countdown}`");
    expect(digEntry).toContain(
      "const open = crewed && cta.phaseOpen && !cta.dugThisWindow",
    );
    expect(digEntry).toContain("const visible = !crewed || !cta.dugThisWindow");
    // A refused dig surfaces its reason rather than doing nothing.
    expect(barn).toContain('showToast("Truffle Patch", digNote)');
  });

  test("mounted Home and Season entry points reconcile on focus", () => {
    expect(feedingCta).toContain("useFocusEffect(");
    expect(feedingCta).toMatch(
      /useFocusEffect\([\s\S]*setClock\(ctaClock\(\)\);[\s\S]*reconcile\(\);/,
    );
  });

  test("states the personal and shared payoff before and after a dig", () => {
    expect(digEntry).toContain('"Dig for Golden Truffles"');
    expect(digEntry).toContain(
      "Golden Truffles · +20 Pass XP · Sounder spoils",
    );
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
