// FindMark — every Snout Deep find wears its own painted mark (assets/images/
// glyphs/dig, through the Glyph registry), never a borrowed glyph and never an
// emoji. Truffles keep the receipt's truffle glyph, Pass XP the sparkle, a
// stone the hand-cut pebble; the junk keepsake wears its variant.
jest.mock("../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { FindMark, findMarkGlyph } from "../components/mudwar/FindMark";
import { DIG_JUNK_VARIANTS, type DigFindKind } from "../constants/dig";

const PAINTED: Record<Exclude<DigFindKind, "junk" | "stone" | "truffle_d" | "truffle_l">, string> = {
  boom: "digBoom",
  pouch: "digPouch",
  apple: "digApple",
  shimmer: "digShimmer",
  acorn: "digAcorn",
  tea: "digTea",
  scroll: "digScroll",
  relic: "digRelic",
  furnishing: "digFurnishing",
  bow: "digBow",
  charm: "digCharm",
};

describe("FindMark", () => {
  test("every thing resolves to its painted mark", () => {
    for (const [kind, glyph] of Object.entries(PAINTED)) {
      expect(findMarkGlyph(kind as DigFindKind)).toBe(glyph);
    }
  });

  test("the junk keepsake wears its variant; no variant is the boot", () => {
    expect(findMarkGlyph("junk", "boot")).toBe("digBoot");
    expect(findMarkGlyph("junk", "horseshoe")).toBe("digHorseshoe");
    expect(findMarkGlyph("junk", "cap")).toBe("digCap");
    expect(findMarkGlyph("junk")).toBe("digBoot");
    expect(findMarkGlyph("junk", "nonsense")).toBe("digBoot");
    expect(DIG_JUNK_VARIANTS).toEqual(["boot", "horseshoe", "cap"]);
  });

  test("truffles keep the truffle glyph, XP the sparkle, a stone is the pebble", () => {
    expect(findMarkGlyph("truffle_d")).toBe("truffle");
    expect(findMarkGlyph("truffle_l")).toBe("truffle");
    expect(findMarkGlyph("truffles")).toBe("truffle");
    expect(findMarkGlyph("xp")).toBe("sparkle");
    expect(findMarkGlyph("stone")).toBeNull();
  });

  test("the painted files exist and are registered in the Glyph registry", () => {
    const root = path.resolve(__dirname, "..");
    const glyph = fs.readFileSync(path.join(root, "components/ui/Glyph.tsx"), "utf8");
    for (const file of ["boom", "pouch", "apple", "boot", "horseshoe", "cap", "shimmer", "acorn", "tea", "scroll", "relic", "furnishing", "bow", "charm", "bag"]) {
      expect(fs.existsSync(path.join(root, "assets/images/glyphs/dig", `${file}.png`))).toBe(true);
      expect(glyph).toContain(`glyphs/dig/${file}.png`);
    }
    const mark = fs.readFileSync(path.join(root, "components/mudwar/FindMark.tsx"), "utf8");
    expect(mark).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(mark).not.toContain("Icon");
  });

  test("renders every kind, plain and as a silhouette", () => {
    const kinds: (DigFindKind | "truffles" | "xp")[] = [
      "truffle_d", "truffle_l", "truffles", "boom", "pouch", "apple", "junk", "shimmer", "acorn", "tea",
      "scroll", "relic", "furnishing", "bow", "charm", "xp", "stone",
    ];
    for (const kind of kinds) {
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(<FindMark kind={kind} variant="cap" />);
      });
      expect(renderer.toJSON()).toBeTruthy();
      act(() => {
        renderer.update(<FindMark kind={kind} silhouette />);
      });
      expect(renderer.toJSON()).toBeTruthy();
      act(() => renderer.unmount());
    }
  });
});
