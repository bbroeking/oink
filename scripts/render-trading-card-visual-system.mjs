// Render the Rosie's Loadout card-type sampler and the complete 88-card art wall.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, SET_META } from "../docs/marketing/trading-cards/base-set-84/cards.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(
  ROOT,
  "docs/marketing/trading-cards/base-set-84/visual-system",
);
const FONT_CONFIG = path.join(os.tmpdir(), "tickle-card-system-fonts.conf");

const C = {
  ink: "#2A1F15",
  paper: "#FFFAF0",
  cream: "#FBEEE2",
  cream2: "#F6E6D4",
  rose: "#FFD6DC",
  roseDeep: "#F8A8B3",
  sky: "#C8E3F0",
  sage: "#C9DEC1",
  sun: "#FFD87A",
  lilac: "#D6C8F0",
  lilacDeep: "#A89BFF",
  peach: "#FFC8A8",
  accent: "#A13F30",
  bark: "#3A2C1E",
  barkText: "#FFF3E2",
  mute: "#605449",
};

const TYPE = {
  legend: { label: "LEGEND", color: C.roseDeep, motif: "heart" },
  head: { label: "HEAD GEAR", color: "#9DB64D", motif: "shield" },
  held: { label: "HELD GEAR", color: "#62B9A8", motif: "bash" },
  aura: { label: "AURA GEAR", color: C.lilacDeep, motif: "aura" },
  critter: { label: "CRITTER", color: C.sage, motif: "leaf" },
  enemy: { label: "ENEMY", color: "#D87462", motif: "fang" },
  stunt: { label: "STUNT", color: C.sky, motif: "bolt" },
  place: { label: "PLACE", color: C.sun, motif: "place" },
};

const STYLE = {
  brave: { label: "BRAVE", color: "#E67962", motif: "bash" },
  steady: { label: "STEADY", color: "#6FAE8A", motif: "shield" },
  spark: { label: "SPARK", color: "#9A7DE0", motif: "spark" },
};

const RARITY = {
  common: { label: "COMMON", short: "C", color: "#8C7E71", marks: 0 },
  uncommon: { label: "UNCOMMON", short: "U", color: "#5F956D", marks: 1 },
  rare: { label: "RARE", short: "R", color: "#5188B7", marks: 2 },
  epic: { label: "EPIC", short: "E", color: "#8A66C7", marks: 3 },
  legendary: { label: "LEGENDARY", short: "L", color: "#C98E20", marks: 4 },
};

const ART_STATUS = {
  ready: { label: "ART READY", color: "#5F956D" },
  "adapt-existing": { label: "ADAPT GAME ART", color: "#B57A24" },
  "needs-illustration": { label: "NEW ILLUSTRATION", color: "#A13F30" },
};

const SAMPLE_NUMBERS = ["001", "013", "022", "031", "034", "063", "067", "083"];
const CHARACTER_COLOR = {
  legend_rosie: C.roseDeep,
  legend_copper: C.peach,
  legend_pepper: C.lilac,
  legend_bandit: C.sun,
  legend_pickles: C.sage,
  legend_biscuit: C.sky,
};
const LEGEND_PALETTE = {
  legend_rosie: {
    frame: "#F17868",
    frameDark: "#2A1F15",
    panel: "#FFF0DD",
    ability: "#F58B78",
    jewel: "#E85F50",
  },
  legend_copper: {
    frame: "#F17868",
    frameDark: "#2A1F15",
    panel: "#FFF0DD",
    ability: "#F58B78",
    jewel: "#D57838",
  },
  legend_pepper: {
    frame: "#F17868",
    frameDark: "#2A1F15",
    panel: "#FFF0DD",
    ability: "#F58B78",
    jewel: "#586B9F",
  },
  legend_bandit: {
    frame: "#F17868",
    frameDark: "#2A1F15",
    panel: "#FFF0DD",
    ability: "#F58B78",
    jewel: "#8B6748",
  },
  legend_pickles: {
    frame: "#F17868",
    frameDark: "#2A1F15",
    panel: "#FFF0DD",
    ability: "#F58B78",
    jewel: "#5F8D5C",
  },
  legend_biscuit: {
    frame: "#F17868",
    frameDark: "#2A1F15",
    panel: "#FFF0DD",
    ability: "#F58B78",
    jewel: "#A8763D",
  },
};
const SAMPLE_OVERRIDES = {
  "034": {
    art: "assets/images/hats/firefly_aura.png",
    conceptOnly: true,
  },
};
const SCENE = {
  legend_rosie: "assets/images/backgrounds/cottage_garden_bg.png",
  legend_copper: "assets/images/backgrounds/sunset_farm.png",
  legend_pepper: "assets/images/backgrounds/bog_dusk_bg.png",
  legend_bandit: "assets/images/backgrounds/mud_derby_bg.png",
  legend_pickles: "assets/images/backgrounds/reed_marsh_bg.png",
  legend_biscuit: "assets/images/backgrounds/homestead_barn.jpg",
  release_party_crown: "assets/images/backgrounds/throne_room_bg.png",
  golden_truffle: "assets/images/backgrounds/golden_mire_bg.png",
  golden_bog_aura: "assets/images/backgrounds/bog_dusk_bg.png",
  firefly_swarm: "assets/images/backgrounds/reed_marsh_bg.png",
  great_hungerer: "assets/images/backgrounds/mud_pit_bg.png",
  warm_tea: "assets/images/backgrounds/library_nook.png",
  festival_night: "assets/images/backgrounds/festival_night_bg.png",
};
const FALLBACK_SCENE = {
  head: {
    brave: "assets/images/backgrounds/mud_derby_bg.png",
    steady: "assets/images/backgrounds/homestead_barn.jpg",
    spark: "assets/images/backgrounds/throne_room_bg.png",
  },
  held: {
    brave: "assets/images/backgrounds/mud_pit_bg.png",
    steady: "assets/images/backgrounds/forest_grove.png",
    spark: "assets/images/backgrounds/festival_night_bg.png",
  },
  aura: {
    brave: "assets/images/backgrounds/bog_dusk_bg.png",
    steady: "assets/images/backgrounds/golden_mire_bg.png",
    spark: "assets/images/backgrounds/cosmic_drift_bg_2.png",
  },
  critter: {
    brave: "assets/images/backgrounds/cottage_garden_bg.png",
    steady: "assets/images/backgrounds/reed_marsh_bg.png",
    spark: "assets/images/backgrounds/festival_night_bg.png",
  },
  enemy: {
    brave: "assets/images/backgrounds/mud_pit_bg.png",
    steady: "assets/images/backgrounds/bog_dusk_bg.png",
    spark: "assets/images/backgrounds/cosmic_drift_bg_4.png",
  },
  stunt: {
    brave: "assets/images/backgrounds/mud_derby_bg.png",
    steady: "assets/images/backgrounds/library_nook.png",
    spark: "assets/images/backgrounds/festival_night_bg.png",
  },
};
const SUBJECT = {
  legend: { x: 110, y: 135, width: 530, height: 510 },
  head: { x: 170, y: 160, width: 410, height: 410 },
  held: { x: 155, y: 155, width: 440, height: 430 },
  aura: { x: 145, y: 145, width: 460, height: 450 },
  critter: { x: 165, y: 155, width: 420, height: 420 },
  enemy: { x: 70, y: 125, width: 610, height: 560 },
  stunt: { x: 210, y: 170, width: 330, height: 330 },
};

const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function lines(text, max = 33, limit = 4) {
  const words = String(text).split(/\s+/);
  const result = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      result.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) result.push(line);
  if (result.length > limit) {
    result.length = limit;
    result[limit - 1] = `${result[limit - 1].replace(/[.…]+$/, "")}…`;
  }
  return result;
}

function textBlock(text, x, y, options = {}) {
  const {
    max = 33,
    limit = 4,
    size = 25,
    leading = 32,
    fill = C.ink,
    family = "Nunito",
    weight = 800,
    anchor = "start",
  } = options;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}"
    font-family="${family}" font-size="${size}" font-weight="${weight}">
    ${lines(text, max, limit)
      .map((line, index) => `<tspan x="${x}" dy="${index ? leading : 0}">${xml(line)}</tspan>`)
      .join("")}
  </text>`;
}

function motif(name, x, y, scale = 1, fill = C.ink) {
  const tr = `translate(${x} ${y}) scale(${scale})`;
  const paths = {
    heart: `<path d="M0 12 C-24-5-38 28 0 50 C38 28 24-5 0 12Z"/>`,
    shield: `<path d="M0 0 L32 11 V38 C32 60 15 74 0 82 C-15 74-32 60-32 38 V11Z"/>`,
    bash: `<path d="M-6 0 L15 0 L7 27 L28 27 L-13 75 L-2 39 L-24 39Z"/>`,
    aura: `<circle cx="0" cy="38" r="30" fill="none" stroke="${fill}" stroke-width="9"/><circle cx="0" cy="38" r="12"/>`,
    leaf: `<path d="M-34 55 C-28 10 8-8 38 1 C39 35 21 65-19 66Z"/><path d="M-21 59 L25 16" fill="none" stroke="${C.paper}" stroke-width="7"/>`,
    fang: `<path d="M-30 0 H30 L12 78 L0 55 L-12 78Z"/>`,
    bolt: `<path d="M8 0 L-25 45 H0 L-10 83 L34 31 H9Z"/>`,
    place: `<path d="M-38 65 L-38 31 L0 0 L38 31 V65 H15 V38 H-15 V65Z"/>`,
    spark: `<path d="M0 0 L10 27 L38 38 L10 49 L0 78 L-10 49 L-38 38 L-10 27Z"/>`,
  };
  return `<g transform="${tr}" fill="${fill}">${paths[name] ?? paths.spark}</g>`;
}

function rarityIcon(rarity, x, y, scale = 1, withLabel = true) {
  const r = RARITY[rarity];
  const sparks = [
    [-37, 4],
    [39, 12],
    [-43, 55],
    [42, 62],
  ]
    .slice(0, r.marks)
    .map(([sx, sy]) => motif("spark", sx, sy, 0.18, r.color))
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M0 12 C30 12 39 34 31 56 C23 78-23 78-31 56 C-39 34-30 12 0 12Z"
      fill="${r.color}" stroke="${C.ink}" stroke-width="4"/>
    <path d="M-10 15 Q0-2 13 13" fill="none" stroke="${C.ink}" stroke-width="6"
      stroke-linecap="round"/>
    ${sparks}
    <text x="0" y="55" text-anchor="middle" fill="${C.paper}" font-family="Nunito"
      font-size="25" font-weight="900">${r.short}</text>
    ${withLabel ? `<text x="0" y="100" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
      font-size="17" font-weight="900" letter-spacing="1">${r.label}</text>` : ""}
  </g>`;
}

function typeKey(card) {
  return card.type === "gear" ? card.slot : card.type;
}

function visualType(card, key = typeKey(card)) {
  if (card.legend) {
    return { ...TYPE.legend, color: CHARACTER_COLOR[card.id] ?? TYPE.legend.color };
  }
  return TYPE[key];
}

function titleSize(name) {
  if (name.length > 27) return 39;
  if (name.length > 21) return 45;
  return 51;
}

async function imageData(relativePath) {
  if (!relativePath) return null;
  const bytes = await readFile(path.join(ROOT, relativePath));
  const extension = path.extname(relativePath).slice(1);
  return `data:image/${extension === "jpg" ? "jpeg" : extension};base64,${bytes.toString("base64")}`;
}

function artTreatment(card, image, key, conceptOnly) {
  const t = visualType(card, key);
  const isScene = card.type === "place";
  const art = image
    ? `<image href="${image}" x="${isScene ? 55 : 105}" y="${isScene ? 145 : 166}"
        width="${isScene ? 640 : 540}" height="${isScene ? 445 : 390}"
        preserveAspectRatio="${isScene ? "xMidYMid slice" : "xMidYMid meet"}"/>`
    : "";
  const pending = card.artStatus !== "ready" || conceptOnly;
  return `<defs>
      <pattern id="paperDots" width="34" height="34" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="7" r="2.2" fill="${C.ink}" opacity=".08"/>
        <path d="M18 25 l7 -4" stroke="${C.ink}" stroke-width="2" opacity=".06"/>
      </pattern>
    </defs>
    <rect x="55" y="145" width="640" height="445" rx="${card.type === "enemy" ? 8 : 30}"
      fill="${t.color}" stroke="${C.ink}" stroke-width="7"/>
    <rect x="55" y="145" width="640" height="445" rx="${card.type === "enemy" ? 8 : 30}"
      fill="url(#paperDots)"/>
    ${art}
    ${card.type === "enemy" ? `<path d="M55 145 l28 20 30-20 30 20 30-20 30 20 30-20 30 20 30-20 30 20 30-20 30 20 30-20 30 20 30-20 30 20 30-20 30 20 30-20 30 20 28-20"
      fill="none" stroke="${C.ink}" stroke-width="8"/>` : ""}
    ${pending ? `<g transform="translate(75 513)">
      <rect width="600" height="58" rx="17" fill="${C.paper}" stroke="${C.ink}" stroke-width="4"/>
      ${motif("place", 29, 8, .32, ART_STATUS[card.artStatus].color)}
      <text x="61" y="38" fill="${ART_STATUS[card.artStatus].color}" font-family="Nunito"
        font-size="20" font-weight="900" letter-spacing="1.2">${
          conceptOnly ? "CONCEPT SOURCE • NEW SCENE ART NEEDED" : ART_STATUS[card.artStatus].label
        }</text>
    </g>` : ""}`;
}

function frameColors(card, type) {
  if (card.legend) {
    return card.favoredStyles.map((style) => STYLE[style].color);
  }
  return [STYLE[card.style]?.color ?? type.color, type.color];
}

function statMedallion(label, value, icon, color, x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M0-59 C38-59 57-35 57 0 C57 35 38 59 0 59 C-38 59-57 35-57 0 C-57-35-38-59 0-59Z"
      fill="${C.paper}" stroke="${C.ink}" stroke-width="8"/>
    <path d="M0-48 C30-48 45-29 45 0 C45 29 30 48 0 48 C-30 48-45 29-45 0 C-45-29-30-48 0-48Z"
      fill="${color}" stroke="${C.paper}" stroke-width="3"/>
    ${motif(icon, -23, -37, .18, C.ink)}
    <text x="8" y="15" text-anchor="middle" fill="${C.ink}" font-family="Caprasimo"
      font-size="49">${value}</text>
    <path d="M-47 25 H47 V48 C22 63-22 63-47 48Z" fill="${C.ink}"/>
    <text x="0" y="45" text-anchor="middle" fill="${C.paper}" font-family="Nunito"
      font-size="12" font-weight="900" letter-spacing="1.1">${label}</text>
  </g>`;
}

function cardStats(card) {
  const stats = [];
  if (card.guard) stats.push(["GUARD", card.guard, "shield", C.sky]);
  if (card.bash) stats.push(["BASH", card.bash, "bash", C.peach]);
  if (card.hearts) stats.push(["HEARTS", card.hearts, "heart", C.roseDeep]);
  return stats
    .map((stat, index) =>
      statMedallion(...stat, 642 - index * 118, 620, 0.88),
    )
    .join("");
}

function trainingBand(card) {
  if (!card.training) return "";
  const style = STYLE[card.training.style];
  return `<g>
    <rect x="28" y="864" width="694" height="142" fill="${C.ink}"
      stroke="${style.color}" stroke-width="6"/>
    <path d="M28 864 H130 L154 887 V1006 H28Z" fill="${style.color}"/>
    ${motif(style.motif, 79, 886, .35, C.ink)}
    <text x="79" y="980" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
      font-size="13" font-weight="900" letter-spacing="1.4">${style.label}</text>
    <text x="169" y="895" fill="${style.color}" font-family="Nunito"
      font-size="13" font-weight="900" letter-spacing="1.8">TRAINING ACTION</text>
    <text x="169" y="929" fill="${C.paper}" font-family="Fredoka"
      font-size="28" font-weight="700">${xml(card.training.name)}</text>
    ${textBlock(card.training.text, 169, 960, {
      max: 48, limit: 2, size: 17, leading: 22, fill: C.barkText,
    })}
    <path d="M674 864 H722 V912Z" fill="${style.color}"/>
  </g>`;
}

function favoredStylesBand(card) {
  return `<g>
    <rect x="28" y="886" width="694" height="120" fill="${C.ink}"
      stroke="${C.sun}" stroke-width="5"/>
    <text x="54" y="919" fill="${C.sun}" font-family="Nunito"
      font-size="13" font-weight="900" letter-spacing="1.7">FAVORED STYLES</text>
    ${card.favoredStyles.map((style, index) => {
      const s = STYLE[style];
      const x = 54 + index * 252;
      return `<g transform="translate(${x} 936)">
        <path d="M0 0 H228 L214 52 H0Z" fill="${s.color}" stroke="${C.paper}" stroke-width="3"/>
        ${motif(s.motif, 35, 6, .28, C.ink)}
        <text x="68" y="34" fill="${C.ink}" font-family="Fredoka" font-size="21"
          font-weight="700">${s.label}</text>
      </g>`;
    }).join("")}
    <text x="698" y="956" text-anchor="end" fill="${C.paper}" font-family="Nunito"
      font-size="12" font-weight="900">STARTS</text>
    <text x="698" y="976" text-anchor="end" fill="${C.paper}" font-family="Nunito"
      font-size="12" font-weight="900">OUTSIDE DECK</text>
  </g>`;
}

function legendTitleSize(name) {
  if (name.length > 13) return 49;
  if (name.length > 9) return 55;
  return 62;
}

function legendAbilitySize(name) {
  if (name.length > 18) return 31;
  if (name.length > 14) return 34;
  return 37;
}

function legendCardSvg(card) {
  const palette = LEGEND_PALETTE[card.id] ?? LEGEND_PALETTE.legend_rosie;
  const [displayName, epithet] = card.name.split(/, (.+)/);
  const abilityLines = lines(card.text, 35, 4);
  const flavorSize = 22;
  const styleChips = card.favoredStyles.map((style, index) => {
    const s = STYLE[style];
    const x = 242 + index * 214;
    return `<g transform="translate(${x} 897)">
      <rect width="200" height="52" rx="7" fill="${s.color}" stroke="${palette.panel}" stroke-width="4"/>
      ${motif(s.motif, 34, 8, .25, palette.panel)}
      <text x="72" y="35" fill="${palette.panel}" font-family="Nunito"
        font-size="22" font-weight="900">${s.label}</text>
    </g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050">
    <defs>
      <clipPath id="card"><rect x="10" y="10" width="730" height="1030" rx="34"/></clipPath>
      <linearGradient id="frameTint" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.frame}"/>
        <stop offset="1" stop-color="${palette.frameDark}"/>
      </linearGradient>
      <linearGradient id="abilityTint" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.ability}"/>
        <stop offset="1" stop-color="${palette.frame}" stop-opacity=".9"/>
      </linearGradient>
      <filter id="hardLift" x="-20%" y="-20%" width="140%" height="140%">
        <feFlood flood-color="${C.ink}" result="shadowColor"/>
        <feComposite in="shadowColor" in2="SourceAlpha" operator="in" result="shadow"/>
        <feOffset in="shadow" dx="3" dy="4" result="offsetShadow"/>
        <feMerge><feMergeNode in="offsetShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <mask id="frameWithArtWindow">
        <rect width="750" height="1050" fill="white"/>
        <rect x="40" y="204" width="670" height="424" rx="15" fill="black"/>
      </mask>
    </defs>

    <g clip-path="url(#card)">
      <g mask="url(#frameWithArtWindow)">
        <rect x="10" y="10" width="730" height="1030" fill="${C.ink}"/>

        <!-- One uniform, cut-safe silhouette with the pig-ear crown contained inside it. -->
        <path d="M35 42 Q35 28 53 29 L112 31 L126 45
          Q188 34 375 34 Q562 34 624 45 L638 31 L697 29 Q715 28 715 42
          L715 1009 Q715 1023 701 1023 H49 Q35 1023 35 1009Z"
          fill="url(#frameTint)" stroke="${palette.frame}" stroke-width="5"/>
      </g>
      <path d="M45 52 L111 53 L128 64 Q200 49 375 49 Q550 49 622 64
        L639 53 L705 52" fill="none" stroke="${palette.panel}" stroke-opacity=".36"
        stroke-width="3"/>

      <!-- Identity panel -->
      <path d="M60 58 Q60 48 73 48 H566 Q584 48 596 60
        L666 47 Q690 44 690 65 V181 Q690 197 672 197 H73 Q60 197 60 184Z"
        fill="${palette.panel}" stroke="${palette.frameDark}" stroke-width="4"/>
      <path d="M76 197 H270" stroke="${palette.jewel}" stroke-width="7"/>
      <g transform="translate(79 64)">
        <path d="M0 0 H104 L96 31 H0Z" fill="${palette.jewel}"/>
        <text x="12" y="22" fill="${palette.panel}" font-family="Nunito"
          font-size="20" font-weight="900">LEGEND</text>
      </g>
      <text x="80" y="137" fill="${C.ink}" font-family="Fredoka"
        font-size="${legendTitleSize(displayName)}" font-weight="700">${xml(displayName)}</text>
      <text x="82" y="177" fill="${C.ink}" font-family="Nunito"
        font-size="28" font-weight="900">${xml(epithet)}</text>

      <!-- Cheer is an irregular storybook medallion, not a generic stat circle. -->
      <g transform="translate(625 104) scale(.86)" filter="url(#hardLift)">
        <path d="M0-42 C39-53 62-22 56 12 C51 42 20 59 0 70
          C-20 59-51 42-56 12 C-62-22-39-53 0-42Z"
          fill="${palette.jewel}" stroke="${palette.frameDark}" stroke-width="7"/>
        <path d="M0-32 C30-40 45-17 41 9 C37 31 15 44 0 54
          C-15 44-37 31-41 9 C-45-17-30-40 0-32Z"
          fill="${C.ink}" opacity=".92" stroke="${palette.panel}" stroke-width="3"/>
        <text x="0" y="18" text-anchor="middle" fill="${palette.panel}"
          font-family="Caprasimo" font-size="52">${card.startingCheer}</text>
        <text x="0" y="43" text-anchor="middle" fill="${palette.panel}"
          font-family="Nunito" font-size="19" font-weight="900">CHEER</text>
      </g>

      <!-- Illustration window: the full-art source remains uninterrupted here. -->
      <rect x="40" y="204" width="670" height="424" rx="15"
        fill="none" stroke="${palette.frameDark}" stroke-width="8"/>
      <rect x="46" y="210" width="658" height="412" rx="10"
        fill="none" stroke="${palette.panel}" stroke-opacity=".58" stroke-width="2"/>

      <!-- Flavor caption makes the art and rules feel like one storybook object. -->
      <path d="M40 627 H710 V672 Q710 682 699 682 H51 Q40 682 40 672Z"
        fill="${palette.panel}" stroke="${palette.frameDark}" stroke-width="4"/>
      <text x="375" y="659" text-anchor="middle" fill="${C.ink}"
        font-family="Patrick Hand" font-size="${flavorSize}">${xml(card.flavor)}</text>

      <!-- Ability panel -->
      <path d="M40 682 H710 V884 H40Z" fill="url(#abilityTint)"
        stroke="${palette.frameDark}" stroke-width="4"/>
      <g transform="translate(85 753)">
        <path d="M0-39 L31-22 L43 10 L26 42 L-8 47 L-39 28 L-45-6 L-27-36Z"
          fill="${palette.jewel}" stroke="${palette.panel}" stroke-width="5"/>
        ${motif("spark", 0, -27, .34, palette.panel)}
        <circle cx="36" cy="40" r="16" fill="${palette.panel}"
          stroke="${palette.frameDark}" stroke-width="4"/>
      </g>
      <text x="150" y="735" fill="${C.ink}" font-family="Caprasimo"
        font-size="${legendAbilitySize(card.abilityName)}">${xml(card.abilityName)}</text>
      <text x="152" y="774" fill="${C.ink}" font-family="Nunito"
        font-size="28" font-weight="800">
        ${abilityLines.map((line, index) =>
          `<tspan x="152" dy="${index ? 34 : 0}">${xml(line)}</tspan>`).join("")}
      </text>

      <!-- Persistent rules and production metadata -->
      <path d="M40 884 H710 V960 H40Z" fill="${C.ink}"
        stroke="${palette.frame}" stroke-width="4"/>
      <text x="61" y="930" fill="${palette.panel}" font-family="Nunito"
        font-size="22" font-weight="900">STYLES</text>
      ${styleChips}
      <path d="M40 960 H710 V1023 H40Z" fill="${C.ink}"
        stroke="${palette.frame}" stroke-width="4"/>
      <g transform="translate(65 991)">
        <ellipse rx="17" ry="20" fill="${palette.frame}" stroke="${palette.panel}" stroke-width="3"/>
        <ellipse cx="-6" cy="0" rx="3.5" ry="7" fill="${palette.frameDark}"/>
        <ellipse cx="6" cy="0" rx="3.5" ry="7" fill="${palette.frameDark}"/>
      </g>
      <text x="94" y="999" fill="${palette.panel}" font-family="Nunito"
        font-size="22" font-weight="900">${card.number}/${SET_META.cardCount}</text>
      <text x="684" y="999" text-anchor="end" fill="${palette.panel}" font-family="Nunito"
        font-size="22" font-weight="900">OUTSIDE DECK</text>
    </g>
    <rect x="10" y="10" width="730" height="1030" rx="34" fill="none"
      stroke="${C.ink}" stroke-width="20"/>
  </svg>`;
}

function deckTitleSize(name) {
  if (name.length > 25) return 31;
  if (name.length > 20) return 35;
  if (name.length > 15) return 39;
  return 44;
}

function deckActionSize(name) {
  if (name.length > 21) return 27;
  if (name.length > 16) return 30;
  return 34;
}

function deckStats(card, type) {
  const stats = [];
  if (card.guard) stats.push(["GUARD", card.guard, "shield"]);
  if (card.bash) stats.push(["BASH", card.bash, "bash"]);
  if (card.hearts) stats.push(["HEARTS", card.hearts, "heart"]);
  if (!stats.length) return "";
  const gap = stats.length === 1 ? 0 : 92;
  const start = 375 - ((stats.length - 1) * gap) / 2;
  return stats.map(([label, value, icon], index) => {
    const x = start + index * gap;
    return `<g transform="translate(${x} 674)" filter="url(#hardLift)">
      <path d="M0-42 L38-21 V20 C38 45 16 59 0 67 C-16 59-38 45-38 20 V-21Z"
        fill="${C.paper}" stroke="${C.ink}" stroke-width="6"/>
      <path d="M0-32 L28-16 V17 C28 34 13 46 0 52 C-13 46-28 34-28 17 V-16Z"
        fill="${type.color}" stroke="${C.paper}" stroke-width="3"/>
      ${motif(icon, -17, -25, .14, C.ink)}
      <text x="4" y="14" text-anchor="middle" fill="${C.ink}" font-family="Caprasimo"
        font-size="37">${value}</text>
      <text x="0" y="40" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
        font-size="13" font-weight="900">${label}</text>
    </g>`;
  }).join("");
}

function placeholderSubject(card, type) {
  const style = STYLE[card.style];
  return `<g transform="translate(375 365)" opacity=".96" filter="url(#hardLift)">
    <circle r="104" fill="${C.paper}" fill-opacity=".9" stroke="${C.ink}" stroke-width="7"/>
    <circle r="84" fill="${type.color}" fill-opacity=".28" stroke="${style.color}" stroke-width="5"/>
    ${motif(style.motif, 0, -46, 1.15, type.color)}
  </g>`;
}

async function placeCardSvg(card) {
  const type = visualType(card, "place");
  const style = STYLE[card.style];
  const rarity = RARITY[card.rarity];
  const scene = await imageData(card.art);
  const playLines = lines(card.text, 42, 3);
  const trainingLines = lines(card.training.text, 43, 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050">
    <defs>
      <clipPath id="card"><rect x="10" y="10" width="730" height="1030" rx="34"/></clipPath>
      <linearGradient id="placeShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.ink}" stop-opacity=".36"/>
        <stop offset=".42" stop-color="${C.ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${C.ink}" stop-opacity=".52"/>
      </linearGradient>
      <filter id="hardLift" x="-30%" y="-30%" width="160%" height="160%">
        <feFlood flood-color="${C.ink}" result="shadowColor"/>
        <feComposite in="shadowColor" in2="SourceAlpha" operator="in" result="shadow"/>
        <feOffset in="shadow" dx="3" dy="4" result="offsetShadow"/>
        <feMerge><feMergeNode in="offsetShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g clip-path="url(#card)">
      <image href="${scene}" x="10" y="10" width="730" height="1030"
        preserveAspectRatio="xMidYMid slice"/>
      <rect x="10" y="10" width="730" height="1030" fill="url(#placeShade)"/>

      <!-- Compact map plaque lets the environment remain the card's dominant read. -->
      <path d="M48 44 H702 V157 H48Z" fill="${C.paper}" fill-opacity=".96"
        stroke="${C.ink}" stroke-width="6"/>
      <path d="M48 44 H702 V76 H48Z" fill="${type.color}" stroke="${C.ink}" stroke-width="4"/>
      <text x="375" y="68" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
        font-size="19" font-weight="900" letter-spacing="1.2">PLACE · ${style.label}</text>
      <text x="375" y="128" text-anchor="middle" fill="${C.ink}" font-family="Fredoka"
        font-size="${deckTitleSize(card.name) + 2}" font-weight="700">${xml(card.name)}</text>
      <g transform="translate(80 99)" filter="url(#hardLift)">
        <path d="M0-32 L28-16 V16 L0 32 L-28 16 V-16Z" fill="${C.sun}"
          stroke="${C.ink}" stroke-width="5"/>
        <text x="0" y="-3" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
          font-size="11" font-weight="900">RANK</text>
        <text x="0" y="21" text-anchor="middle" fill="${C.ink}" font-family="Caprasimo"
          font-size="30">${card.rank}</text>
      </g>
      ${rarityIcon(card.rarity, 669, 97, .43, false)}

      <!-- One translucent field-note panel; scenery remains visible around every edge. -->
      <path d="M48 672 H702 V972 H48Z" fill="${C.paper}" fill-opacity=".94"
        stroke="${C.ink}" stroke-width="7"/>
      <g transform="translate(72 698)">
        <circle cx="23" cy="23" r="24" fill="${type.color}" stroke="${C.ink}" stroke-width="4"/>
        ${motif("place", 23, 5, .21, C.ink)}
        <text x="62" y="31" fill="${C.ink}" font-family="Nunito"
          font-size="21" font-weight="900">WHILE HERE</text>
      </g>
      <text x="375" y="${playLines.length > 2 ? 764 : 778}" text-anchor="middle"
        fill="${C.ink}" font-family="Nunito" font-size="28" font-weight="800">
        ${playLines.map((line, index) =>
          `<tspan x="375" dy="${index ? 34 : 0}">${xml(line)}</tspan>`).join("")}
      </text>

      <path d="M64 848 H686 V956 H64Z" fill="${style.color}" fill-opacity=".92"
        stroke="${C.ink}" stroke-width="5"/>
      <g transform="translate(91 871)">
        ${motif(style.motif, 0, -17, .24, C.ink)}
        <text x="41" y="0" fill="${C.ink}" font-family="Fredoka"
          font-size="29" font-weight="700">${xml(card.training.name)}</text>
      </g>
      <text x="132" y="919" fill="${C.ink}" font-family="Nunito"
        font-size="24" font-weight="800">
        ${trainingLines.map((line, index) =>
          `<tspan x="132" dy="${index ? 27 : 0}">${xml(line)}</tspan>`).join("")}
      </text>

      <path d="M24 988 H726 V1024 H24Z" fill="${C.ink}" fill-opacity=".94"/>
      <text x="48" y="1013" fill="${C.paper}" font-family="Nunito"
        font-size="18" font-weight="900">${card.number}/${SET_META.cardCount} · RLB</text>
      <text x="702" y="1013" text-anchor="end" fill="${rarity.color}" font-family="Nunito"
        font-size="18" font-weight="900">PLACE · STAYS IN PLAY</text>
    </g>
    <rect x="10" y="10" width="730" height="1030" rx="34" fill="none"
      stroke="${C.ink}" stroke-width="20"/>
    <rect x="24" y="24" width="702" height="1002" rx="22" fill="none"
      stroke="${type.color}" stroke-width="5"/>
  </svg>`;
}

async function deckCardSvg(card) {
  const key = typeKey(card);
  const type = visualType(card, key);
  const style = STYLE[card.style];
  const rarity = RARITY[card.rarity];
  const generatedScene = card.art?.includes("/base-set-art/");
  const artIsScene = card.art?.includes("/backgrounds/") || generatedScene;
  const scenePath = (generatedScene ? card.art : null)
    ?? SCENE[card.id]
    ?? (artIsScene ? card.art : null)
    ?? FALLBACK_SCENE[key]?.[card.style]
    ?? FALLBACK_SCENE[card.type]?.[card.style]
    ?? "assets/images/backgrounds/cottage_garden_bg.png";
  const scene = await imageData(scenePath);
  const subject = !artIsScene && card.art ? await imageData(card.art) : null;
  const rosie = card.slot === "aura"
    ? await imageData("assets/images/sprites/rosie/happy_1.png")
    : null;
  const pending = card.artStatus !== "ready";
  const playLines = lines(card.text, 38, 3);
  const trainingLines = lines(card.training.text, 34, 2);
  const playSize = playLines.length > 2 ? 25 : 28;
  const subjectBox = card.type === "enemy"
    ? { x: 155, y: 224, width: 440, height: 390 }
    : card.type === "critter"
      ? { x: 175, y: 230, width: 400, height: 370 }
      : card.slot === "head"
        ? { x: 165, y: 210, width: 420, height: 420 }
        : card.slot === "held"
          ? { x: 190, y: 214, width: 370, height: 390 }
          : { x: 165, y: 212, width: 420, height: 410 };
  const statMarkup = deckStats(card, type);
  const topMotif = card.type === "enemy"
    ? `<path d="M28 153 L65 171 102 153 139 171 176 153 213 171 250 153 287 171
        324 153 361 171 398 153 435 171 472 153 509 171 546 153 583 171
        620 153 657 171 722 153" fill="none" stroke="${C.ink}" stroke-width="8"/>`
    : card.type === "critter"
      ? `<path d="M42 158 Q72 130 103 158 Q133 130 164 158" fill="none"
          stroke="${type.color}" stroke-width="10" stroke-linecap="round"/>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050">
    <defs>
      <clipPath id="card"><rect x="10" y="10" width="730" height="1030" rx="34"/></clipPath>
      <clipPath id="artWindow"><rect x="32" y="176" width="686" height="504" rx="8"/></clipPath>
      <linearGradient id="playTint" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${type.color}"/>
        <stop offset="1" stop-color="${C.paper}" stop-opacity=".7"/>
      </linearGradient>
      <linearGradient id="trainingTint" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${C.ink}"/>
        <stop offset="1" stop-color="#49372A"/>
      </linearGradient>
      <filter id="hardLift" x="-30%" y="-30%" width="160%" height="160%">
        <feFlood flood-color="${C.ink}" result="shadowColor"/>
        <feComposite in="shadowColor" in2="SourceAlpha" operator="in" result="shadow"/>
        <feOffset in="shadow" dx="4" dy="5" result="offsetShadow"/>
        <feMerge><feMergeNode in="offsetShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g clip-path="url(#card)">
      <rect x="10" y="10" width="730" height="1030" fill="${C.ink}"/>
      <rect x="24" y="24" width="702" height="1002" rx="20"
        fill="${type.color}" stroke="${C.ink}" stroke-width="7"/>

      <!-- Crown-style identity rail -->
      <path d="M144 28 H606 L624 48 V152 H144Z" fill="${type.color}"
        stroke="${C.ink}" stroke-width="6"/>
      <text x="375" y="60" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
        font-size="20" font-weight="900" letter-spacing="1.3">${type.label}</text>
      <path d="M152 68 H614 V148 H152Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="5"/>
      <text x="383" y="121" text-anchor="middle" fill="${C.ink}" font-family="Fredoka"
        font-size="${deckTitleSize(card.name)}" font-weight="700">${xml(card.name)}</text>

      <!-- Rank banner -->
      <g filter="url(#hardLift)">
        <path d="M32 28 H144 V160 L88 184 L32 160Z" fill="${type.color}"
          stroke="${C.ink}" stroke-width="7"/>
        <path d="M48 44 H128 V148 L88 166 L48 148Z" fill="${C.sun}"
          stroke="${C.paper}" stroke-width="3"/>
        <text x="88" y="80" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
          font-size="17" font-weight="900">RANK</text>
        <text x="88" y="137" text-anchor="middle" fill="${C.ink}" font-family="Caprasimo"
          font-size="58">${card.rank}</text>
      </g>

      <!-- Rarity pennant -->
      <g filter="url(#hardLift)">
        <path d="M606 28 H718 V160 L662 184 L606 160Z" fill="${C.ink}"
          stroke="${C.ink}" stroke-width="7"/>
        ${rarityIcon(card.rarity, 662, 48, .43, false)}
        <text x="662" y="137" text-anchor="middle" fill="${rarity.color}" font-family="Nunito"
          font-size="${rarity.label.length > 8 ? 14 : 16}" font-weight="900">${rarity.label}</text>
      </g>

      <!-- Illustration -->
      <g clip-path="url(#artWindow)">
        <image href="${scene}" x="32" y="176" width="686" height="504"
          preserveAspectRatio="xMidYMid slice"/>
        <rect x="32" y="176" width="686" height="504" fill="${C.ink}" opacity=".08"/>
        ${card.slot === "head" && subject ? `<ellipse cx="375" cy="610" rx="160" ry="40"
          fill="${C.ink}" opacity=".3"/>
          <ellipse cx="375" cy="590" rx="154" ry="49" fill="#365B42"
            stroke="${C.ink}" stroke-width="7"/>
          <ellipse cx="375" cy="578" rx="132" ry="30" fill="#4D7A55"
            stroke="${C.sun}" stroke-width="4"/>` : ""}
        ${card.slot === "held" && subject ? `<ellipse cx="375" cy="604" rx="130" ry="28"
          fill="${C.ink}" opacity=".3"/>` : ""}
        ${card.slot === "aura" && rosie ? `<image href="${rosie}" x="238" y="300"
          width="274" height="280" preserveAspectRatio="xMidYMid meet" filter="url(#hardLift)"/>` : ""}
        ${subject ? `<image href="${subject}" x="${subjectBox.x}" y="${subjectBox.y}"
          width="${subjectBox.width}" height="${subjectBox.height}"
          preserveAspectRatio="xMidYMid meet" filter="url(#hardLift)"/>`
          : artIsScene ? "" : placeholderSubject(card, type)}
      </g>
      <rect x="32" y="176" width="686" height="504" rx="8"
        fill="none" stroke="${C.ink}" stroke-width="8"/>
      ${topMotif}
      ${pending ? `<g transform="translate(52 628)">
        <path d="M0 0 H220 L208 34 H0Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="3"/>
        <text x="13" y="23" fill="${type.color}" font-family="Nunito"
          font-size="14" font-weight="900">${card.artStatus === "adapt-existing" ? "ART ADAPTATION" : "ILLUSTRATION BRIEF"}</text>
      </g>` : ""}

      <!-- Play field -->
      <path d="M32 680 H718 V844 H32Z" fill="url(#playTint)"
        stroke="${C.ink}" stroke-width="7"/>
      ${statMarkup}
      <g transform="translate(56 708)">
        <circle cx="24" cy="24" r="25" fill="${C.paper}" stroke="${C.ink}" stroke-width="5"/>
        ${motif(type.motif, 24, 6, .21, type.color)}
        <text x="61" y="31" fill="${C.ink}" font-family="Nunito"
          font-size="20" font-weight="900">PLAY</text>
      </g>
      <text x="375" y="${playLines.length > 2 ? 752 : 766}" text-anchor="middle"
        fill="${C.ink}" font-family="Nunito" font-size="${playSize}" font-weight="800">
        ${playLines.map((line, index) =>
          `<tspan x="375" dy="${index ? 30 : 0}">${xml(line)}</tspan>`).join("")}
      </text>

      <!-- Training field -->
      <path d="M32 844 H718 V988 H32Z" fill="url(#trainingTint)" stroke="${type.color}" stroke-width="5"/>
      <g transform="translate(56 864)">
        <circle cx="28" cy="28" r="30" fill="${style.color}" stroke="${C.paper}" stroke-width="4"/>
        ${motif(style.motif, 28, 9, .25, C.ink)}
      </g>
      <text x="128" y="876" fill="${style.color}" font-family="Nunito"
        font-size="17" font-weight="900" letter-spacing="1">TRAINING</text>
      <text x="128" y="912" fill="${C.paper}" font-family="Fredoka"
        font-size="${Math.min(deckActionSize(card.training.name), 31)}" font-weight="700">${xml(card.training.name)}</text>
      <text x="128" y="947" fill="${C.barkText}" font-family="Nunito"
        font-size="22" font-weight="800">
        ${trainingLines.map((line, index) =>
          `<tspan x="128" dy="${index ? 25 : 0}">${xml(line)}</tspan>`).join("")}
      </text>

      <!-- Collector line -->
      <path d="M32 988 H718 V1024 H32Z" fill="${C.ink}" stroke="${type.color}" stroke-width="4"/>
      <g transform="translate(55 1006)">
        <ellipse rx="14" ry="16" fill="${type.color}" stroke="${C.paper}" stroke-width="2"/>
        <ellipse cx="-5" cy="0" rx="3" ry="6" fill="${C.ink}"/>
        <ellipse cx="5" cy="0" rx="3" ry="6" fill="${C.ink}"/>
      </g>
      <text x="79" y="1013" fill="${C.barkText}" font-family="Nunito"
        font-size="18" font-weight="900">${card.number}/${SET_META.cardCount} · RLB</text>
      <text x="699" y="1013" text-anchor="end" fill="${type.color}" font-family="Nunito"
        font-size="18" font-weight="900">${type.label}</text>
    </g>
    <rect x="10" y="10" width="730" height="1030" rx="34" fill="none"
      stroke="${C.ink}" stroke-width="20"/>
  </svg>`;
}

async function cardSvg(card) {
  if (card.legend) return legendCardSvg(card);
  if (card.type === "place") return placeCardSvg(card);
  return deckCardSvg(card);
  /* Legacy layout retained below until all printed proofs have been approved. */
  const key = typeKey(card);
  const t = visualType(card, key);
  const override = SAMPLE_OVERRIDES[card.number] ?? {};
  const source = override.art ?? card.art;
  const image = card.type === "place" || card.fullArt ? null : await imageData(source);
  const scene = card.fullArt
    ? null
    : await imageData(SCENE[card.id] ?? card.art);
  const isSpecial = ["013", "022", "031"].includes(card.number);
  const style = card.style ? STYLE[card.style] : null;
  const subject = SUBJECT[key] ?? SUBJECT.legend;
  const [displayName, epithet] = card.name.includes(", ")
    ? card.name.split(/, (.+)/)
    : [card.name, null];
  const status = ART_STATUS[card.artStatus];
  const [primary, secondary] = frameColors(card, t);
  const titlePoint = card.legend ? 144 : 126;
  const cardNameSize = card.legend
    ? displayName.length > 16 ? 39 : 45
    : displayName.length > 24 ? 31 : displayName.length > 18 ? 35 : 40;
  const typeIcon = motif(t.motif, 71, 675, .3, C.ink);
  const rankSocket = card.legend
    ? statMedallion("CHEER", card.startingCheer, "heart", primary, 82, 88, .86)
    : `<g transform="translate(75 82)">
        <path d="M0-52 L45-27 V27 L0 52 L-45 27 V-27Z" fill="${C.paper}"
          stroke="${C.ink}" stroke-width="7"/>
        <path d="M0-40 L34-20 V20 L0 40 L-34 20 V-20Z" fill="${primary}"/>
        <text x="0" y="-4" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
          font-size="12" font-weight="900" letter-spacing="1">RANK</text>
        <text x="0" y="29" text-anchor="middle" fill="${C.ink}" font-family="Caprasimo"
          font-size="36">${card.rank}</text>
      </g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050">
    <defs>
      <clipPath id="card"><rect x="10" y="10" width="730" height="1030" rx="24"/></clipPath>
      <linearGradient id="artShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.ink}" stop-opacity=".18"/>
        <stop offset=".48" stop-color="${C.ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${C.ink}" stop-opacity=".48"/>
      </linearGradient>
      <filter id="subjectLift" x="-30%" y="-30%" width="160%" height="160%">
        <feFlood flood-color="${C.ink}" result="shadowColor"/>
        <feComposite in="shadowColor" in2="SourceAlpha" operator="in" result="shadow"/>
        <feOffset in="shadow" dx="8" dy="10" result="offsetShadow"/>
        <feMerge><feMergeNode in="offsetShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g clip-path="url(#card)">
      ${scene ? `<image href="${scene}" x="10" y="10" width="730" height="1030"
        preserveAspectRatio="xMidYMid slice"/>` : ""}
      <rect x="10" y="10" width="730" height="${card.legend ? 686 : 665}"
        fill="url(#artShade)"/>
      ${image ? `<image href="${image}" x="${subject.x}" y="${subject.y}"
        width="${subject.width}" height="${subject.height}" preserveAspectRatio="xMidYMid meet"
        filter="url(#subjectLift)"/>` : ""}
      <rect x="25" y="25" width="700" height="${card.legend ? 661 : 635}"
        fill="none" stroke="${primary}" stroke-width="14"/>
      <rect x="37" y="37" width="676" height="${card.legend ? 637 : 611}"
        fill="none" stroke="${secondary}" stroke-width="4"/>
      ${card.type === "enemy" ? `<path d="M28 30 L65 51 102 30 139 51 176 30 213 51 250 30 287 51 324 30 361 51 398 30 435 51 472 30 509 51 546 30 583 51 620 30 657 51 694 30 722 47"
        fill="none" stroke="${C.ink}" stroke-width="9"/>` : ""}

      <path d="M30 30 H720 V137 H${titlePoint + 5} L${titlePoint - 19} 119 H30Z"
        fill="${C.paper}" fill-opacity=".97" stroke="${C.ink}" stroke-width="7"/>
      <path d="M${titlePoint} 30 H720 V54 H${titlePoint + 23}Z" fill="${primary}"/>
      ${rankSocket}
      <text x="${titlePoint}" y="59" fill="${C.mute}" font-family="Nunito"
        font-size="12" font-weight="900" letter-spacing="1.6">${t.label}</text>
      <text x="${titlePoint}" y="101" fill="${C.ink}" font-family="Fredoka"
        font-size="${cardNameSize}" font-weight="700">${xml(displayName)}</text>
      ${epithet ? `<text x="${titlePoint}" y="127" fill="${C.accent}" font-family="Patrick Hand"
        font-size="23">${xml(epithet)}</text>` : ""}
      ${style ? `<g transform="translate(472 112)">
        ${motif(style.motif, 0, -17, .2, style.color)}
        <text x="26" y="0" fill="${C.ink}" font-family="Nunito" font-size="12"
          font-weight="900" letter-spacing="1">${style.label}</text>
      </g>` : ""}
      ${rarityIcon(card.rarity, 678, 49, .48, false)}

      <path d="M38 ${card.legend ? 638 : 612} H712" fill="none"
        stroke="${C.ink}" stroke-width="12"/>
      ${isSpecial ? `<g transform="translate(391 585) rotate(-3)">
        <path d="M0 0 H215 L201 42 H14Z" fill="${C.sun}" stroke="${C.ink}" stroke-width="5"/>
        <text x="107" y="28" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
          font-size="13" font-weight="900" letter-spacing="1">SPECIAL ILLUSTRATION</text>
      </g>` : ""}
      ${card.artStatus !== "ready" ? `<g transform="translate(42 558)">
        <path d="M0 0 H360 L348 40 H12Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="4"/>
        <text x="24" y="27" fill="${status.color}" font-family="Nunito" font-size="14"
          font-weight="900">${override.conceptOnly ? "CONCEPT SOURCE • NEW SCENE ART NEEDED" : status.label}</text>
      </g>` : ""}

      ${card.legend ? `<g>
        <rect x="28" y="666" width="694" height="220" fill="${C.paper}"
          stroke="${C.ink}" stroke-width="7"/>
        <rect x="28" y="666" width="694" height="48" fill="${secondary}"/>
        <text x="52" y="698" fill="${C.ink}" font-family="Patrick Hand" font-size="20">
          ${xml(card.flavor)}
        </text>
        <path d="M28 714 H145 L167 736 V886 H28Z" fill="${primary}"/>
        ${motif("heart", 87, 746, .31, C.ink)}
        <text x="87" y="849" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
          font-size="12" font-weight="900" letter-spacing="1.2">LEGEND ABILITY</text>
        <text x="183" y="760" fill="${C.ink}" font-family="Fredoka"
          font-size="29" font-weight="700">${xml(card.abilityName)}</text>
        ${textBlock(card.text, 183, 800, { max: 43, limit: 3, size: 20, leading: 27 })}
      </g>
      ${favoredStylesBand(card)}` : `<g>
        <rect x="28" y="641" width="694" height="223" fill="${C.paper}"
          stroke="${C.ink}" stroke-width="7"/>
        <path d="M28 641 H112 L135 664 V864 H28Z" fill="${t.color}"/>
        ${typeIcon}
        <text x="70" y="822" text-anchor="middle" fill="${C.ink}" font-family="Nunito"
          font-size="12" font-weight="900" letter-spacing="1.2">PLAY</text>
        ${cardStats(card)}
        ${textBlock(card.text, 153, 704, { max: 43, limit: 3, size: 20, leading: 27 })}
        <path d="M153 805 H695" stroke="${secondary}" stroke-width="4"/>
        <text x="153" y="839" fill="${C.accent}" font-family="Patrick Hand"
          font-size="18">${xml(card.flavor)}</text>
      </g>
      ${trainingBand(card)}`}
      <text x="37" y="1016" fill="${C.barkText}" font-family="Nunito" font-size="11"
        font-weight="900" letter-spacing=".9">${card.number}/${SET_META.cardCount} • RLB</text>
      <text x="713" y="1016" text-anchor="end" fill="${C.barkText}" font-family="Nunito"
        font-size="11" font-weight="900">QR REWARD ON BACK</text>
    </g>
    <rect x="10" y="10" width="730" height="1030" rx="24" fill="none"
      stroke="${C.ink}" stroke-width="20"/>
    <rect x="25" y="25" width="700" height="1000" rx="11" fill="none"
      stroke="${isSpecial || card.legend ? C.sun : primary}" stroke-width="5"/>
  </svg>`;
}

function statusCounts() {
  return CARDS.reduce((counts, card) => {
    counts[card.artStatus] = (counts[card.artStatus] ?? 0) + 1;
    return counts;
  }, {});
}

function coverageBoardSvg() {
  const width = 2400;
  const cols = 7;
  const rows = Math.ceil(CARDS.length / cols);
  const height = 235 + rows * 135 + 60;
  const tileW = 316;
  const tileH = 124;
  const startX = 70;
  const startY = 235;
  const counts = statusCounts();
  const tiles = CARDS.map((card, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * 330;
    const y = startY + row * 135;
    const key = typeKey(card);
    const status = ART_STATUS[card.artStatus];
    return `<g transform="translate(${x} ${y})">
      <rect x="5" y="5" width="${tileW}" height="${tileH}" rx="17" fill="${C.ink}"/>
      <rect width="${tileW}" height="${tileH}" rx="17" fill="${C.paper}" stroke="${C.ink}" stroke-width="4"/>
      <rect width="13" height="${tileH}" rx="6" fill="${visualType(card, key).color}"/>
      <text x="27" y="28" fill="${C.mute}" font-family="Nunito" font-size="14" font-weight="900">${card.number}</text>
      <text x="27" y="57" fill="${C.ink}" font-family="Caprasimo" font-size="${card.name.length > 24 ? 17 : 20}">
        ${xml(card.name.length > 30 ? `${card.name.slice(0, 28)}…` : card.name)}
      </text>
      <text x="27" y="84" fill="${C.mute}" font-family="Nunito" font-size="13" font-weight="900"
        letter-spacing=".8">${visualType(card, key).label} • ${RARITY[card.rarity].label}</text>
      <circle cx="286" cy="29" r="13" fill="${status.color}" stroke="${C.ink}" stroke-width="3"/>
      <text x="27" y="108" fill="${status.color}" font-family="Nunito" font-size="12"
        font-weight="900" letter-spacing=".7">${status.label}</text>
      ${rarityIcon(card.rarity, 285, 65, .26, false)}
    </g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${C.cream2}"/>
    <text x="70" y="76" fill="${C.ink}" font-family="Caprasimo" font-size="52">The full ${SET_META.cardCount}-card wall</text>
    <text x="70" y="119" fill="${C.accent}" font-family="Patrick Hand" font-size="27">
      Every card has rules, rarity, rank, style, training, flavor, and an art assignment.
    </text>
    ${Object.entries(ART_STATUS).map(([key, status], index) => `<g transform="translate(${70 + index * 410} 153)">
      <circle cx="11" cy="11" r="10" fill="${status.color}" stroke="${C.ink}" stroke-width="3"/>
      <text x="32" y="18" fill="${C.ink}" font-family="Nunito" font-size="18" font-weight="900">
        ${status.label} • ${counts[key] ?? 0}
      </text>
    </g>`).join("")}
    ${tiles}
    <text x="70" y="${height - 24}" fill="${C.mute}" font-family="Nunito" font-size="17" font-weight="900">
      A colored dot reports illustration readiness. The truffle symbol reports rarity without relying on color.
    </text>
  </svg>`;
}

await mkdir(OUT, { recursive: true });
await writeFile(
  FONT_CONFIG,
  `<?xml version="1.0"?>
<fontconfig>
  <dir>${xml(path.join(ROOT, "node_modules/@expo-google-fonts/caprasimo/400Regular"))}</dir>
  <dir>${xml(path.join(ROOT, "node_modules/@expo-google-fonts/fredoka/700Bold"))}</dir>
  <dir>${xml(path.join(ROOT, "node_modules/@expo-google-fonts/nunito/800ExtraBold"))}</dir>
  <dir>${xml(path.join(ROOT, "node_modules/@expo-google-fonts/patrick-hand/400Regular"))}</dir>
  <cachedir>${xml(path.join(os.tmpdir(), "tickle-card-system-font-cache"))}</cachedir>
</fontconfig>`,
);

const env = { ...process.env, FONTCONFIG_FILE: FONT_CONFIG };
async function renderCard(card) {
  const key = typeKey(card);
  const basename = `${card.number}-${key}-${card.id}`;
  const svgPath = path.join(OUT, `${basename}.svg`);
  const pngPath = path.join(OUT, `${basename}.png`);
  await writeFile(svgPath, await cardSvg(card));
  if (card.fullArt) {
    const overlayPath = path.join(os.tmpdir(), `${basename}-overlay.png`);
    execFileSync("magick", ["-background", "none", svgPath, overlayPath], { env });
    execFileSync("magick", [
      path.join(ROOT, card.art),
      "-resize", "750x1050^",
      "-gravity", "center",
      "-extent", "750x1050",
      "(",
      "-size", "750x1050",
      "xc:none",
      "-fill", "white",
      "-draw", "roundrectangle 10,10 740,1040 24,24",
      ")",
      "-alpha", "off",
      "-compose", "CopyOpacity",
      "-composite",
      overlayPath,
      "-compose", "over",
      "-composite",
      pngPath,
    ], { env });
  } else {
    execFileSync("magick", [svgPath, pngPath], { env });
  }
  return pngPath;
}

const allRenders = [];
const renderByNumber = new Map();
for (const card of CARDS) {
  const pngPath = await renderCard(card);
  allRenders.push(pngPath);
  renderByNumber.set(card.number, pngPath);
}
const rendered = SAMPLE_NUMBERS.map((number) => renderByNumber.get(number));

execFileSync("magick", [
  "montage",
  ...rendered,
  "-font", path.join(
    ROOT,
    "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf",
  ),
  "-label", "",
  "-thumbnail", "375x525",
  "-tile", "4x2",
  "-geometry", "+22+22",
  "-background", C.cream2,
  path.join(OUT, "type-layout-sampler.png"),
], { env });

const characterCards = CARDS.filter((card) => card.legend);
const characterRenders = characterCards.map((card) => renderByNumber.get(card.number));
execFileSync("magick", [
  "montage",
  ...characterRenders,
  "-font", path.join(
    ROOT,
    "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf",
  ),
  "-label", "",
  "-thumbnail", "375x525",
  "-tile", "3x2",
  "-geometry", "+28+28",
  "-background", C.cream2,
  path.join(OUT, "legend-roster.png"),
], { env });
execFileSync("magick", [
  "montage",
  ...characterRenders,
  "-font", path.join(
    ROOT,
    "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf",
  ),
  "-label", "",
  "-thumbnail", "525x735",
  "-tile", "2x3",
  "-geometry", "+26+26",
  "-background", C.cream2,
  path.join(OUT, "legend-roster-detail.png"),
], { env });

execFileSync("magick", [
  "montage",
  ...allRenders,
  "-font", path.join(
    ROOT,
    "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf",
  ),
  "-label", "",
  "-thumbnail", "150x210",
  "-tile", "8x11",
  "-geometry", "+12+12",
  "-background", C.cream2,
  path.join(OUT, "full-set-overview.png"),
], { env });

for (const [index, batch] of [
  allRenders.slice(0, 44),
  allRenders.slice(44),
].entries()) {
  execFileSync("magick", [
    "montage",
    ...batch,
    "-font", path.join(
      ROOT,
      "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf",
    ),
    "-label", "",
    "-thumbnail", "300x420",
    "-tile", "4x11",
    "-geometry", "+18+18",
    "-background", C.cream2,
    path.join(OUT, `full-set-detail-${String(index + 1).padStart(2, "0")}.png`),
  ], { env });
}

await writeFile(
  path.join(OUT, "card-manifest.csv"),
  [
    "number,id,name,type,slot,rank,style,rarity,art_status",
    ...CARDS.map((card) => [
      card.number,
      card.id,
      `"${card.name.replaceAll('"', '""')}"`,
      card.type,
      card.slot ?? "",
      card.rank ?? "",
      card.style ?? "",
      card.rarity,
      card.artStatus,
    ].join(",")),
  ].join("\n") + "\n",
);

const boardSvg = path.join(OUT, "set-art-coverage-wall.svg");
await writeFile(boardSvg, coverageBoardSvg());
execFileSync("magick", [boardSvg, path.join(OUT, "set-art-coverage-wall.png")], { env });

console.log(`Rendered all ${SET_META.cardCount} fronts, detail sheets, Legend roster, and coverage wall to ${path.relative(ROOT, OUT)}/`);
