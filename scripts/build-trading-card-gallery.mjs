// Build the public card gallery at landing/cards/ from the rendered base set.
//
//   node scripts/build-trading-card-gallery.mjs
//
// Inputs are the 88 fronts that render-trading-card-visual-system.mjs writes to
// docs/marketing/trading-cards/base-set-84/visual-system/ (run that first when
// art or card text changes). Outputs:
//
//   landing/cards/img/NNN-id.webp      750×1050, the detail view
//   landing/cards/img/NNN-id-sm.webp   375×525, the grid tile
//   landing/cards/cards.json           the public card data (no repo paths)
//   landing/cards/index.html           the grid markup between the CARDS markers
//
// index.html is hand-authored; only the block between <!-- CARDS:BEGIN --> and
// <!-- CARDS:END --> is rewritten, so the page shell stays a design decision
// and the data stays generated.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARDS,
  SET_META,
} from "../docs/marketing/trading-cards/base-set-84/cards.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RENDERS = path.join(
  ROOT,
  "docs/marketing/trading-cards/base-set-84/visual-system",
);
const OUT = path.join(ROOT, "landing/cards");
const IMG = path.join(OUT, "img");

const TYPE_LABEL = {
  legend: "Legend",
  head: "Head Gear",
  held: "Held Gear",
  aura: "Aura Gear",
  critter: "Critter",
  enemy: "Enemy",
  stunt: "Stunt",
  place: "Place",
};

const typeKey = (card) => (card.type === "gear" ? card.slot : card.type);

async function newer(a, b) {
  try {
    const [sa, sb] = await Promise.all([stat(a), stat(b)]);
    return sa.mtimeMs > sb.mtimeMs;
  } catch {
    return true;
  }
}

async function exportImage(src, dest, size) {
  if (!(await newer(src, dest))) return false;
  execFileSync("magick", [
    src,
    "-resize",
    size,
    "-quality",
    "84",
    "-define",
    "webp:method=6",
    dest,
  ]);
  return true;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function publicCard(card) {
  const key = typeKey(card);
  const out = {
    number: card.number,
    id: card.id,
    name: card.name,
    type: key,
    typeLabel: TYPE_LABEL[key],
    rarity: card.rarity,
    rarityLabel: cap(card.rarity),
    text: card.text,
    flavor: card.flavor ?? "",
    img: `img/${card.number}-${card.id}.webp`,
    thumb: `img/${card.number}-${card.id}-sm.webp`,
  };
  if (card.legend) {
    out.legend = true;
    out.abilityName = card.abilityName;
    out.favoredStyles = card.favoredStyles;
    out.startingCheer = card.startingCheer;
    out.legendRole = card.legendRole;
  } else {
    out.rank = card.rank;
    out.style = card.style;
    out.styleLabel = cap(card.style);
    if (card.guard) out.guard = card.guard;
    if (card.bash) out.bash = card.bash;
    if (card.hearts) out.hearts = card.hearts;
    out.training = {
      name: card.training.name,
      text: card.training.text,
      kind: card.training.kind,
    };
  }
  return out;
}

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function tile(card) {
  const meta = card.legend
    ? `Legend · ${card.favoredStyles.map(cap).join(" + ")}`
    : `${card.typeLabel} · Rank ${card.rank} · ${card.styleLabel}`;
  return `      <li class="tile" data-number="${card.number}" data-type="${card.type}" data-style="${card.style ?? card.favoredStyles.join(" ")}" data-rarity="${card.rarity}" data-name="${esc(card.name.toLowerCase())}">
        <button class="tile__button" type="button" aria-label="${esc(card.name)}, ${esc(meta)}, ${card.rarityLabel}">
          <img class="tile__art" src="${card.thumb}" width="375" height="525" alt="" loading="lazy" decoding="async" />
          <span class="tile__caption">
            <span class="tile__number">${card.number}</span>
            <span class="tile__name">${esc(card.name)}</span>
          </span>
        </button>
      </li>`;
}

await mkdir(IMG, { recursive: true });

const cards = CARDS.map(publicCard);
let exported = 0;
for (const card of CARDS) {
  const src = path.join(RENDERS, `${card.number}-${typeKey(card)}-${card.id}.png`);
  const base = path.join(IMG, `${card.number}-${card.id}`);
  if (await exportImage(src, `${base}.webp`, "750x1050")) exported += 1;
  if (await exportImage(src, `${base}-sm.webp`, "375x525")) exported += 1;
}

await writeFile(
  path.join(OUT, "cards.json"),
  JSON.stringify({ set: SET_META, cards }, null, 1) + "\n",
);

const pagePath = path.join(OUT, "index.html");
const page = await readFile(pagePath, "utf8");
const begin = "<!-- CARDS:BEGIN -->";
const end = "<!-- CARDS:END -->";
const a = page.indexOf(begin);
const b = page.indexOf(end);
if (a < 0 || b < 0) throw new Error(`${pagePath} is missing the CARDS markers`);
const grid = `${begin}\n${cards.map(tile).join("\n")}\n      ${end}`;
await writeFile(pagePath, page.slice(0, a) + grid + page.slice(b + end.length));

console.log(
  `Gallery: ${cards.length} cards, ${exported} images exported, grid written to ${path.relative(ROOT, pagePath)}`,
);
