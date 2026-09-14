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
// The after-dig payoff copy lives on the receipt the patch renders once a dig
// banks (LivingMudReceipt), not in TrufflePatch itself.
const receipt = fs.readFileSync(
  path.join(ROOT, "components/mudwar/LivingMudReceipt.tsx"),
  "utf8",
);

describe("Barn Truffle Patch entry", () => {
  test("crewed players can open the dig directly from Home", () => {
    expect(digEntry).toContain(
      'const crewed = coopDig && (step === "first_dig" || step === "done")',
    );
    expect(digEntry).toContain(': "Dig for Golden Truffles"');
    expect(digEntry).toContain("void start();");
    expect(digEntry).toContain("modal: cta.modal,");
    // The Barn button consumes the hook — Dig on its fan whenever the patch
    // is visible, armed by default while the patch is open (until the player
    // has picked their own), the hint riding along, and the single mounted
    // patch — instead of jumping to the Season tab.
    expect(barn).toContain("const dig = useDigEntry();");
    expect(barn).toContain("if (dig.visible) {");
    expect(barn).toContain('accessibilityLabel: "Truffle Patch",');
    expect(barn).toContain("accessibilityHint: dig.hint,");
    expect(barn).toContain('const defaultKey = dig.open && dig.visible ? "dig" : "barn";');
    expect(barn).toContain("onPress: dig.openDig,");
    expect(barn).toContain("{dig.modal}");
  });

  test("the direct action preserves honest unavailable states", () => {
    expect(digEntry).toContain('"Dug this feeding"');
    expect(digEntry).toContain("`Dig opens in ${cta.countdown}`");
    expect(digEntry).toContain(
      "const open = inPlace && cta.phaseOpen && !cta.dugThisWindow",
    );
    expect(digEntry).toContain("const visible = !inPlace || !cta.dugThisWindow");
    // A refused dig surfaces its reason rather than doing nothing.
    expect(barn).toContain('showToast("Truffle Patch", digNote)');
  });

  test("Snout Deep rides the same entry and the same modal behind the flag", () => {
    // The uncrewed lane opens in place only when the server-side flag says
    // the dig is Snout Deep; the crewed lane is unchanged.
    expect(digEntry).toContain('const snoutDeep = useFeatureFlag("snout_deep");');
    expect(digEntry).toContain("const inPlace = crewed || (coopDig && snoutDeep);");
    expect(digEntry).toContain("hint: inPlace ? DIG_HINT_CREWED : DIG_HINT_UNCREWED,");
    // The modal branches on the SERVER's mode decision, not the client flag,
    // and the classic TrufflePatch branch survives verbatim beside it.
    expect(feedingCta).toContain('session && session.mode === "snout_deep" ? (');
    expect(feedingCta).toContain("<SnoutDeepDig");
    expect(feedingCta).toContain("onSubmit={submitDeep}");
    expect(feedingCta).toContain("onSync={syncRooting}");
    expect(feedingCta).toContain(") : session ? (");
    expect(feedingCta).toContain("<TrufflePatch");
    expect(feedingCta).toContain("useUnmanagedModalHold(visible);");
  });

  test("Home and Season delegate focus synchronization to the feeding clock", () => {
    expect(feedingCta).toContain("const focused = useIsFocused();");
    expect(feedingCta).toContain("useFeedingClock({ focused, reconcile })");
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
    expect(receipt).toContain(
      "Your finds helped your Sounder and weakened the Hungerer.",
    );
    expect(receipt).toContain(
      "No finds were banked this time. Another patch awaits next Feeding.",
    );
  });
});
