#!/usr/bin/env node
// The one door onto `constants/theme.ts` for the generators
// (`build-web-tokens.mjs`, `build-design-md.mjs`), so `web/tokens.css` and
// `DESIGN.md` can never disagree about what a token is.
//
// theme.ts imports nothing at runtime (`ViewStyle` is a type-only import), so an
// esbuild TS -> ESM transform plus a `data:` URL import is enough: no bundler,
// no new dependency (esbuild is already a devDependency).
//
// Also parses the `//` block above each token out of the source, because the
// comment IS the token's job description and the design doc quotes it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const THEME_REL = "constants/theme.ts";
export const THEME_SOURCE = readFileSync(new URL(`../${THEME_REL}`, import.meta.url), "utf8");

export async function loadTheme() {
  const { code } = transformSync(THEME_SOURCE, {
    loader: "ts",
    format: "esm",
    target: "node22",
    sourcefile: "theme.ts",
  });
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(url);
}

// ---------------------------------------------------------------- comments --

// Abbreviations that end in a period without ending the sentence.
const ABBR = /(?:^|\s)(?:e\.g|i\.e|vs|etc|approx|Fig|no)\.$/i;

function firstSentence(text) {
  let from = 0;
  for (;;) {
    const stop = text.indexOf(". ", from);
    if (stop === -1) return text;
    const head = text.slice(0, stop + 1);
    if (!ABBR.test(head)) return head;
    from = stop + 2;
  }
}

function oneLine(lines) {
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  let job = firstSentence(text);
  if (job.length > 200) job = `${job.slice(0, 197).trimEnd()}…`;
  return job;
}

/**
 * Walks theme.ts and returns the one-line job for every exported token and, for
 * the multi-line object literals, for every key inside them.
 *
 *   { top: Map<constName, job>, members: Map<constName, Map<key, job>> }
 */
export function parseTokenComments(source = THEME_SOURCE) {
  const top = new Map();
  const members = new Map();
  let buffer = [];
  let current = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");

    const comment = /^\s*\/\/ ?(.*)$/.exec(line);
    if (comment) {
      buffer.push(comment[1]);
      continue;
    }
    if (!line.trim()) {
      buffer = [];
      continue;
    }

    const decl = /^export (?:const|function) (\w+)/.exec(line);
    if (decl) {
      top.set(decl[1], oneLine(buffer));
      buffer = [];
      current = /[{[]\s*$/.test(line) ? decl[1] : null;
      if (current && !members.has(current)) members.set(current, new Map());
      continue;
    }

    if (current) {
      if (/^[}\])]/.test(line)) {
        current = null;
        buffer = [];
        continue;
      }
      const key = /^\s+"?([\w -]+)"?:\s/.exec(line);
      if (key) {
        members.get(current).set(key[1], oneLine(buffer));
        buffer = [];
        continue;
      }
    }
    buffer = [];
  }

  return { top, members };
}

// ------------------------------------------------------------------ naming --

export const kebab = (name) =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// "PatrickHand_400Regular" -> { family: "Patrick Hand", weight: 400 }
export function webFont(expoName) {
  const [base, suffix = ""] = expoName.split("_");
  return {
    family: base.replace(/([a-z])([A-Z])/g, "$1 $2"),
    weight: Number(/^(\d{3})/.exec(suffix)?.[1] ?? 400),
  };
}

// Which `--font-*` custom property each FONTS key resolves to on the web: the
// four faces, not the eight Expo weight variants.
export const FONT_ROLE = {
  display: "display",
  displaySemi: "display",
  body: "body",
  bodySemi: "body",
  bodyExtra: "body",
  bodyBlack: "body",
  whimsy: "whimsy",
  hand: "hand",
};

const FALLBACK = {
  display: '"Trebuchet MS", "Segoe UI", sans-serif',
  body: '"Segoe UI", system-ui, sans-serif',
  whimsy: 'Georgia, "Times New Roman", serif',
  hand: '"Bradley Hand", "Segoe Script", cursive',
};

/** The four web faces + the single Google Fonts @import, derived from FONTS. */
export function fontFaces(FONTS) {
  const faces = new Map(); // role -> { family, weights:Set }
  for (const [key, expoName] of Object.entries(FONTS)) {
    const role = FONT_ROLE[key];
    if (!role) continue;
    const { family, weight } = webFont(expoName);
    if (!faces.has(role)) faces.set(role, { family, weights: new Set() });
    faces.get(role).weights.add(weight);
  }

  const importUrl = [...faces.values()]
    .map(({ family, weights }) => {
      const name = family.replace(/ /g, "+");
      const list = [...weights].sort((a, b) => a - b);
      return list.length === 1 && list[0] === 400 ? `family=${name}` : `family=${name}:wght@${list.join(";")}`;
    })
    .sort()
    .join("&");

  return {
    faces,
    stack: (role) => `"${faces.get(role).family}", ${FALLBACK[role]}`,
    importUrl: `https://fonts.googleapis.com/css2?${importUrl}&display=swap`,
  };
}

/** The fill tokens — the WHIMSY pastels a surface may wear, in palette order. */
export const FILL_KEYS = [
  "rose",
  "roseDeep",
  "sky",
  "sage",
  "sun",
  "lilac",
  "lilacDeep",
  "peach",
  "slopGold",
  "slopBand",
];

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

/** `UI_COLORS.action` is the accent everywhere else; the web says so out loud. */
export const UI_COLOR_ALIASES = { action: "accent" };
