#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const art = resolve(root, "assets/images/habitat");
const out = resolve(root, "artifacts/habitat");
mkdirSync(out, { recursive: true });

const DESIGN = { width: 390, height: 844 };
const positions = ["wall", "ceiling", "floor_centerpiece", "floor_left", "floor_right", "surface"];
const constantsSource = readFileSync(resolve(root, "constants/habitat.ts"), "utf8");
const anchors = Object.fromEntries(positions.map((position) => {
  const match = constantsSource.match(new RegExp(`^\\s*${position}:.*anchor: \\{ x: ([\\d.]+), y: ([\\d.]+), width: ([\\d.]+), height: ([\\d.]+) \\}`, "m"));
  if (!match) throw new Error(`Could not read ${position} anchor from constants/habitat.ts`);
  const [, x, y, width, height] = match.map(Number);
  return [position, { x, y, width, height }];
}));
const evidenceAssetOverrides = {
  rosies_pencil_sketch: "rosies_pencil_sketch_v4",
  patchwork_rug: "patchwork_rug_v4",
};
const assetFile = (id) => resolve(art, `${evidenceAssetOverrides[id] ?? id}.png`);
const rectFor = (position) => {
  const anchor = anchors[position];
  const width = Math.max(44, Math.round(DESIGN.width * anchor.width));
  const height = Math.max(44, Math.round(DESIGN.height * anchor.height));
  return { width, height, left: Math.round(DESIGN.width * anchor.x - width / 2), top: Math.round(DESIGN.height * anchor.y - height / 2) };
};
const addContainedLayer = (args, id, position) => {
  const { width, height, left, top } = rectFor(position);
  args.push("(", assetFile(id), "-resize", `${width}x${height}`, "-gravity", "center", "-background", "none", "-extent", `${width}x${height}`, ")", "-gravity", "northwest", "-geometry", `+${left}+${top}`, "-composite");
};
const addCenteredSquare = (args, file, centerX, centerY, size) => {
  args.push("(", file, "-resize", `${size}x${size}`, ")", "-gravity", "northwest", "-geometry", `+${Math.round(DESIGN.width * centerX - size / 2)}+${Math.round(DESIGN.height * centerY - size / 2)}`, "-composite");
};

const composite = (theme, name) => {
  const args = [resolve(art, `${theme}.png`), "-resize", "390x844!"];
  const layers = [
    ["barn_bunting", "wall"],
    ["dried_herb_garland", "ceiling"],
    ["muddy_paw_rug", "floor_centerpiece"],
    ["reading_chair", "floor_left"],
    ["milk_can_lamp", "floor_right"],
  ];
  for (const [id, position] of layers) addContainedLayer(args, id, position);
  // Real shipped pig sprites prove the shared room scale and two-pig composition.
  addCenteredSquare(args, resolve(root, "assets/images/sprites/pickles/idle_1.png"), .29, .68, Math.round(DESIGN.width * .30));
  addCenteredSquare(args, resolve(root, "assets/images/sprites/rosie/idle_1.png"), .52, .69, Math.round(DESIGN.width * .36));
  addContainedLayer(args, "apple_basket", "surface");
  execFileSync("magick", [...args, "-strip", resolve(out, name)]);
};

composite("warm_plank_barn", "two-pig-warm.png");
composite("spring_whitewash", "two-pig-spring.png");
composite("midnight_rafters", "two-pig-midnight.png");
execFileSync("magick", [resolve(out, "two-pig-warm.png"), resolve(out, "two-pig-spring.png"), resolve(out, "two-pig-midnight.png"), "+append", resolve(out, "two-pig-theme-contact-sheet.png")]);

const groups = [
  ["rosies_pencil_sketch", "pressed_clover_frame", "barn_bunting"],
  ["firefly_lantern", "dried_herb_garland"],
  ["sunflower_crock", "reading_chair", "hay_bale", "milk_can_lamp"],
  ["patchwork_rug", "braided_straw_rug", "muddy_paw_rug"],
  ["apple_basket", "guestbook_keepsake", "tiny_radio"],
];
const rows = [];
groups.forEach((group, index) => {
  const row = resolve(out, `compatibility-row-${index}.png`);
  const cells = [];
  group.forEach((id, cellIndex) => {
    const cell = resolve(out, `compatibility-thumb-${index}-${cellIndex}.png`);
    execFileSync("magick", [assetFile(id), "-resize", "192x192", "-gravity", "center", "-background", "none", "-extent", "192x192", cell]);
    cells.push(cell);
  });
  execFileSync("magick", [...cells, "+append", "-background", "#fffaf0", "-gravity", "west", "-extent", "768x192", row]);
  rows.push(row);
});
execFileSync("magick", [...rows, "-append", resolve(out, "all-furnishings-contact-sheet.png")]);

// Exhaustive scene-scale proof: every furnishing in every compatible slot,
// against all three room themes. The manifest fixes the contact-sheet order.
const themes = ["warm_plank_barn", "spring_whitewash", "midnight_rafters"];
const compatible = {
  wall: ["rosies_pencil_sketch", "pressed_clover_frame", "barn_bunting"],
  ceiling: ["firefly_lantern", "dried_herb_garland"],
  floor_left: ["sunflower_crock", "reading_chair", "hay_bale", "milk_can_lamp"],
  floor_right: ["sunflower_crock", "reading_chair", "hay_bale", "milk_can_lamp"],
  floor_centerpiece: ["patchwork_rug", "braided_straw_rug", "muddy_paw_rug"],
  surface: ["apple_basket", "guestbook_keepsake", "tiny_radio"],
};
const matrixDir = resolve(out, "compatibility-matrix");
mkdirSync(matrixDir, { recursive: true });
const matrix = [];
for (const theme of themes) {
  for (const [position, items] of Object.entries(compatible)) {
    for (const item of items) {
      const filename = `${theme}--${position}--${item}.png`;
      const output = resolve(matrixDir, filename);
      const args = [resolve(art, `${theme}.png`), "-resize", "390x844!"];
      addContainedLayer(args, item, position);
      execFileSync("magick", [...args, "-resize", "117x253!", "-strip", output]);
      matrix.push({ theme, position, item, file: `compatibility-matrix/${filename}` });
    }
  }
}
writeFileSync(resolve(out, "exhaustive-compatibility-manifest.json"), `${JSON.stringify({ count: matrix.length, cells: matrix }, null, 2)}\n`);
const matrixRows = [];
for (let index = 0; index < matrix.length; index += 5) {
  const row = resolve(matrixDir, `row-${String(index / 5).padStart(2, "0")}.png`);
  const cells = matrix.slice(index, index + 5).map(({ file }) => resolve(out, file));
  execFileSync("magick", [...cells, "+append", "-background", "#fffaf0", "-gravity", "west", "-extent", "585x253", row]);
  matrixRows.push(row);
}
execFileSync("magick", [...matrixRows, "-append", resolve(out, "exhaustive-compatibility-contact-sheet.png")]);
console.log(`Built habitat composition evidence in ${out}`);
