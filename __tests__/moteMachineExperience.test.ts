import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const productionSurfaces = [
  "app/mote-machine.tsx",
  "app/contraptions.tsx",
  "components/season1/MoteMachineCard.tsx",
  "app/digging-stats.tsx",
  "components/mudwar/TrufflePatch.tsx",
].map(read);

describe("native Mote Machine experience", () => {
  it("keeps prohibited gambling and retired alchemy language off production surfaces", () => {
    const source = productionSurfaces.join("\n");
    // Wager and Jackpot are now intentional, disclosed terms in spec 23.
    expect(source).not.toMatch(/\b(?:gambl\w*|casino|bets?|odds)\b|cash[ -]?value/i);
    const moteOnly = [
      read("app/mote-machine.tsx"),
      read("app/contraptions.tsx"),
      read("components/season1/MoteMachineCard.tsx"),
    ].join("\n");
    expect(moteOnly).not.toMatch(/warmth|whirl|resonance|recipe/i);
    expect(source).not.toMatch(/no tickles this time/i);
  });

  it("opens from Season, the Mote ledger tile, and a newly earned Mote", () => {
    expect(read("components/season1/MoteMachineCard.tsx")).toContain(
      'router.push("/mote-machine")',
    );
    expect(read("app/digging-stats.tsx")).toContain(
      'router.push("/mote-machine" as Href)',
    );
    const patch = read("components/mudwar/TrufflePatch.tsx");
    expect(patch).toContain('end.finds.includes("shimmer")');
    expect(patch).toContain('router.push("/mote-machine")');
    expect(patch).toContain("Use your Mote");
  });

  it("gates the completed machine behind the shared visibility flag", () => {
    // Hidden 2026-09-11 after the UI audit (finding D-06) until the wagering
    // screen is rebuilt on the design-system primitives; the wiring below must
    // keep gating on the flag so the relaunch is a one-line flip.
    expect(read("constants/featureFlags.ts")).toContain(
      "export const MOTE_MACHINE_VISIBLE = false",
    );
    expect(read("components/season1/MoteMachineCard.tsx")).toContain(
      "if (!MOTE_MACHINE_VISIBLE) return null",
    );
    const route = read("app/mote-machine.tsx");
    expect(route).toContain("if (!MOTE_MACHINE_VISIBLE && !canPreviewLocally)");
    expect(route).toContain('return <Redirect href="/(tabs)/season" />');
    expect(route).toContain('typeof __DEV__ !== "undefined" && __DEV__');
    expect(route).toContain("<MoteWageringScreen />");
    expect(read("app/contraptions.tsx")).toContain(
      'if (!MOTE_MACHINE_VISIBLE && !canPreviewLocally)',
    );
  });

  it("uses Rive for the full-page lever and reel motion", () => {
    const screen = read("components/mote-machine/MoteWageringScreen.tsx");
    const binding = read("components/mote-machine/MoteMachineRive.native.tsx");
    expect(screen).toContain(
      'import { MoteMachineRive } from "./MoteMachineRive"',
    );
    expect(screen).not.toContain("components/prototypes");
    expect(binding).toContain("DataBindByName");
    expect(binding).toContain("setResultValue(resultValue)");
    expect(binding).toContain("setRewardLabel(rewardLabel)");
    expect(binding).toContain("setMotes(motes)");
    expect(binding).toContain("setReduceMotion(reduceMotion)");
    expect(binding).toContain("MOTE_MACHINE_RIVE.properties.requestPlay");
    expect(binding).toContain("{ onTrigger: onRequestPlay }");
    expect(binding).not.toMatch(/Math\.random|Snout/i);
  });


  it("declares the reel-machine View Model without alchemy controls", () => {
    const contract = read("components/mote-machine/moteMachineRiveContract.ts");
    for (const authoredName of [
      "requestPlay",
      "spin",
      "tickles",
      "motes",
      "reduceMotion",
      "presenting",
      "busy",
      "canPlay",
      "hasError",
      "motesLabel",
      "ticklesLabel",
      "actionLabel",
      "statusLabel",
    ]) {
      expect(contract).toContain(`"${authoredName}"`);
    }
    expect(contract).not.toMatch(/requestWarmth|requestWhirl|requestResonance/);
  });



  it("keeps deterministic acceptance traffic local to development builds", () => {
    const seam = read("utils/moteGameAcceptance.ts");
    expect(seam).toContain('typeof __DEV__ === "undefined" || !__DEV__');
    expect(seam).not.toContain("rpcAction");
    expect(seam).not.toContain("supabase");
  });

  it("offers truthful native fallback copy before and after confirmation", () => {
    const binding = read("components/mote-machine/MoteMachineFallback.tsx");
    expect(binding).toContain(
      "Your Mote was not spent. Reload the machine or go back.",
    );
    expect(binding).toContain("Your confirmed ${confirmedRewardLabel} is safe");
    expect(binding).toContain('accessibilityLabel="Reload the Mote Machine"');
  });

  it("provides distinct inventory fuel, durations, and stopping rule", () => {
    const inventory = read("app/contraptions.tsx");
    expect(inventory).toContain("Clockwork Acorn");
    expect(inventory).toContain('activate("day")');
    expect(inventory).toContain('activate("week")');
    expect(inventory).toContain("personal cap minus five");
  });
});
