#!/usr/bin/env node
// Regenerates DESIGN.md from constants/theme.ts — the Claude Design export
// schema kept, the body rewritten from the tokens that actually ship.
//
//   node scripts/build-design-md.mjs             -> DESIGN.md
//   node scripts/build-design-md.mjs --out <f>   -> somewhere else
//
// Every token row's one-line job is the `//` comment above it in theme.ts, so a
// token documented there is documented here. Nothing below is hand-edited.

import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { FILL_KEYS, RARITIES, ROOT, THEME_REL, kebab, loadTheme, parseTokenComments, webFont } from "./theme-tokens.mjs";

const T = await loadTheme();
const { top, members } = parseTokenComments();

const px = (n) => `${n}px`;
const job = (constName, key) => (members.get(constName)?.get(key) ?? "").replace(/\|/g, "\\|");
const blurb = (constName) => top.get(constName) ?? "";

// --------------------------------------------------------------- front matter --

const yamlColors = [
  ...Object.entries(T.WHIMSY).map(([k, v]) => [kebab(k), v]),
  // The semantic roles that name a colour WHIMSY doesn't (the rest alias a
  // WHIMSY token and would just repeat it).
  ...Object.entries(T.UI_COLORS)
    .filter(([, v]) => !Object.values(T.WHIMSY).includes(v))
    .map(([k, v]) => [kebab(k), v]),
];

const yamlType = Object.entries(T.TYPE).map(([role, spec]) => {
  const rows = [
    ["fontFamily", spec.fontFamily],
    ["fontSize", px(spec.fontSize)],
    ["lineHeight", px(spec.lineHeight)],
  ];
  if (spec.letterSpacing !== undefined) rows.push(["letterSpacing", px(spec.letterSpacing)]);
  if (spec.textTransform) rows.push(["textTransform", spec.textTransform]);
  return [role, rows];
});

const stickerShadow = `${px(T.STICKER_SHADOW.shadowOffset.width)} ${px(T.STICKER_SHADOW.shadowOffset.height)} 0 {colors.ink}`;
const smallShadow = `${px(T.SHADOW_SM.shadowOffset.width)} ${px(T.SHADOW_SM.shadowOffset.height)} 0 {colors.ink}`;
const btn = (size) => T.BUTTON_SIZE[size];
const ramp = ([from, to]) => `linear-gradient(180deg, ${from}, ${to})`;

const yamlComponents = [
  [
    "sticker",
    [
      ["backgroundColor", "{colors.paper}"],
      ["rounded", "{rounded.lg}"],
      ["border", `${px(T.BORDER.ink)} solid {colors.ink}`],
      ["rotate", `${T.TILT.card}deg`],
      ["padding", px(T.SPACE.card)],
      ["shadow", stickerShadow],
    ],
  ],
  [
    "button-primary",
    [
      ["backgroundImage", ramp(T.GRADIENT.rose)],
      ["textColor", "{colors.ink}"],
      ["border", `${px(T.BORDER.ink)} solid {colors.ink}`],
      ["rounded", "{rounded.xxl}"],
      ["padding", `0 ${px(btn("md").px)}`],
      ["height", px(btn("md").minH)],
      ["shadow", smallShadow],
    ],
  ],
  [
    "button-purple",
    [
      ["backgroundImage", ramp(T.GRADIENT.purple)],
      ["textColor", "{colors.bark-text}"],
      ["border", `${px(T.BORDER.ink)} solid {colors.ink}`],
      ["rounded", "{rounded.xxl}"],
      ["height", px(btn("md").minH)],
      ["shadow", smallShadow],
    ],
  ],
  [
    "button-gold",
    [
      ["backgroundImage", ramp(T.GRADIENT.gold)],
      ["textColor", "{colors.gold-ink}"],
      ["border", `${px(T.BORDER.ink)} solid {colors.ink}`],
      ["rounded", "{rounded.xxl}"],
      ["height", px(btn("md").minH)],
      ["shadow", smallShadow],
    ],
  ],
  [
    "button-locked",
    [
      ["backgroundColor", "{colors.cream2}"],
      ["textColor", "{colors.mute-dim}"],
      ["border", `${px(T.BORDER.ink)} solid {colors.ink}`],
      ["rounded", "{rounded.xxl}"],
      ["height", px(btn("md").minH)],
      ["opacity", "1"],
    ],
  ],
  [
    "kicker-pill",
    [
      ["textColor", "{colors.mute}"],
      ["typography", "{typography.kickerPill}"],
    ],
  ],
];

const q = (v) => `"${String(v).replace(/"/g, '\\"')}"`;
const yamlBlock = (name, entries) =>
  [`${name}:`, ...entries.map(([k, v]) => `  ${k}: ${q(v)}`)].join("\n");
const yamlNested = (name, entries) =>
  [
    `${name}:`,
    ...entries.flatMap(([k, rows]) => [`  ${k}:`, ...rows.map(([rk, rv]) => `    ${rk}: ${q(rv)}`)]),
  ].join("\n");

const frontMatter = [
  "---",
  "name: Tickle the Pig",
  "description: A cozy paper-craft storybook aesthetic — ink-outlined stickers, hard drop-shadows, and warm cream paper.",
  yamlBlock("colors", yamlColors),
  yamlNested("typography", yamlType),
  yamlBlock("rounded", Object.entries(T.RADII).map(([k, v]) => [k, px(v)])),
  yamlBlock("spacing", [...Object.entries(T.SPACE).map(([k, v]) => [k, px(v)]), ["page", px(T.PAGE_PAD)]]),
  yamlNested("components", yamlComponents),
  "---",
].join("\n");

// ---------------------------------------------------------------------- body --

const table = (headers, rows) =>
  [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

const tokenTable = (constName, entries) =>
  table(
    ["Token", "Value", "Job"],
    entries.map(([key, value]) => [`\`${key}\``, `\`${value}\``, job(constName, key) || "—"]),
  );

const fontRoles = Object.entries(T.FONTS).map(([key, name]) => {
  const { family, weight } = webFont(name);
  return [`\`FONTS.${key}\``, `${family} ${weight}`, `\`${name}\``];
});

const typeRows = Object.entries(T.TYPE).map(([role, spec]) => {
  const { family, weight } = webFont(spec.fontFamily);
  return [
    `\`${role}\``,
    `${family} ${weight}`,
    `${spec.fontSize} / ${spec.lineHeight}`,
    spec.letterSpacing === undefined ? "—" : String(spec.letterSpacing),
    job("TYPE", role) || "—",
  ];
});

const fillRows = FILL_KEYS.map((k) => [`\`WHIMSY.${k}\``, `\`${T.WHIMSY[k]}\``, job("WHIMSY", k) || "Sticker fill."]);

const rarityRows = RARITIES.map((r) => [
  `\`${r}\``,
  `\`${T.RARITY_BG_SOLID[r]}\``,
  `\`${T.RARITY_STRIPE[r]}\``,
  `\`${T.RARITY_BADGE[r].bg}\` / \`${T.RARITY_BADGE[r].ink}\``,
]);

const buttonRows = Object.entries(T.BUTTON_SIZE).map(([size, s]) => [
  `\`${size}\``,
  `${s.minH}pt`,
  `${s.px} / ${s.py}`,
  `${s.fs}px`,
  s.br === T.RADII.pill ? "`RADII.pill`" : `${s.br}px`,
]);

const body = `
> **GENERATED from ${THEME_REL} by scripts/build-design-md.mjs — do not edit; edit \`${THEME_REL}\` and re-run \`npm run build:tokens\`.**

# Design System: Tickle the Pig

## 1. Overview

**Creative North Star: "The Paper-Craft Scrapbook"**

Tickle the Pig looks like a storybook someone who cares assembled by hand: ink-outlined stickers pinned with tape onto warm cream paper, each card tilted a degree or two off-square, throwing a hard offset shadow as if lit by a single desk lamp. It is a deliberately maximalist, cozy, paper-craft aesthetic. The whimsy *is* the design — not decoration bolted onto a neutral shell. Every surface is a \`Sticker\`: a ${T.BORDER.ink}px ink border, a hand-drawn tilt (${T.TILT.card}° by default, list rows cycling \`ROW_TILTS\`), and a hard-edged drop shadow with zero blur. The goal of this document and of \`docs/design/design-system-spec.md\` is the same: **every UI element in TTP can be rebuilt from the tokens alone.**

This system explicitly rejects the SaaS-dashboard playbook. The usual "eliminate AI slop" advice — kill the cards, flatten the gradients, calm the motion, default to system fonts — is *wrong* here. A perfectly-aligned, borderless, soft-shadow card is what reads as slop in this app. Slop here is **governance erosion**: the intentional tokens in \`${THEME_REL}\` silently bypassed by an inline hex, a raw font size, a reinvented radius. The craft standard is enforcing the taste that already exists, not imposing a new look.

Feelings are shown, never stated: mood is Rosie's sprite, not a number. Progression systems — Streak, XP, tiers, prices — may show numbers; feelings may not. And the world responds *now* — a cleansed curse vanishes on tap, a claim animates, a find names itself the instant it surfaces.

**Key Characteristics:**
- Ink-outlined paper stickers on warm cream, every card tilted and hard-shadowed
- One palette (\`WHIMSY\`, ${Object.keys(T.WHIMSY).length} tokens): muted storybook pastels, a single terracotta accent, one dark "bark" surface for the storyteller voice
- Four fonts, each with a job — Caprasimo (whimsy titles), Nunito (body), Fredoka (the one display numeral), Patrick Hand (hand-drawn kickers) — across ${Object.keys(T.TYPE).length} \`TYPE\` roles
- Exactly two hard shadow tiers, zero blur — no soft ambient shadows in sticker contexts
- Springy, hand-wound motion (\`MOTION_SPRING\`), never a linear fade that could belong to any app
- No emoji, ever — hand-drawn \`Glyph\` art or SVG \`Icon\` only

## 2. Colors

${blurb("WHIMSY") || "The one palette."} All color comes from \`WHIMSY\`; shared UI consumes the semantic roles in \`UI_COLORS\` so meaning survives palette tuning. A new color is a token with a dated one-line comment — never a fresh hex at the use site.

### Ink & paper

${tokenTable(
  "WHIMSY",
  ["ink", "inkDeep", "paper", "cream", "cream2", "mute", "muteSoft", "muteDim", "bark", "barkText", "barkMute", "stage"].map((k) => [k, T.WHIMSY[k]]),
)}

### Sticker fills

${table(["Token", "Value", "Job"], fillRows)}

### The accent and the inks that sit on a fill

${tokenTable("WHIMSY", [["accent", T.WHIMSY.accent], ["goldInk", T.WHIMSY.goldInk], ["sageInk", T.WHIMSY.sageInk]])}

\`ACCENT_SAFE_FILLS\` names the ${T.ACCENT_SAFE_FILLS.length} fills the accent may sit on (${T.ACCENT_SAFE_FILLS.map((c) => `\`${c}\``).join(" · ")}); on the remaining fills the kicker is ink instead.

### Semantic roles (\`UI_COLORS\`)

${tokenTable("UI_COLORS", Object.entries(T.UI_COLORS))}

### Ink washes (\`TINT\`)

${blurb("TINT")}

${tokenTable("TINT", Object.entries(T.TINT))}

### Structured palettes

**\`GRADIENT\`** — ${blurb("GRADIENT")}

${table(["Ramp", "Stops"], Object.entries(T.GRADIENT).map(([k, [a, b]]) => [`\`${k}\``, `\`${a}\` → \`${b}\``]))}

**\`PODIUM\`** — ${blurb("PODIUM")}

${table(["Place", "Value"], Object.entries(T.PODIUM).map(([k, v]) => [`\`${k}\``, `\`${v}\``]))}

**Rarity —** \`RARITY_BG_SOLID\` is the tinted panel, \`RARITY_STRIPE\` the bold marker on top of it, \`RARITY_BADGE\` the fill/ink pair verified ≥ 4.5:1 at 11px.

${table(["Rarity", "Fill", "Stripe", "Badge bg / ink"], rarityRows)}

### Named rules

**The One Palette Rule.** All color comes from \`WHIMSY\` or a \`UI_COLORS\` role. If a value isn't a token, either use an existing token or add one — never inline a raw hex past the token layer.

**The One Accent Rule.** The terracotta \`accent\` (\`${T.WHIMSY.accent}\`) is a kicker color, never a fill. It appears above a title as a hand-drawn line; the moment it becomes a button or a card background, it stops being the accent.

**The One Dark Surface Rule.** \`bark\` (with \`stage\`/\`inkDeep\` for ceremonies) is the only dark surface. A screen wrapped in black breaks the warm cream continuity.

**The Fill-Is-Not-Ink Rule.** A pastel fill token is never assigned to a text color.

## 3. Typography

${blurb("TYPE")}

### Fonts

${table(["Token", "Web face", "Expo family"], fontRoles)}

### Roles — ${Object.keys(T.TYPE).length} of them

${table(["Role", "Font", "Size / line", "Tracking", "Job"], typeRows)}

### Named rules

**The Compose-From-Roles Rule.** Text is built from \`TYPE\` role styles, not raw sizes. Color is intentionally *not* baked into a role — compose \`{ ...TYPE.body, color: UI_COLORS.textSecondary }\` so one role serves ink / mute / accent. A bare \`fontSize: 15\` in new code is a smell.

**The Every-Role-Has-A-Line-Height Rule.** A role without a \`lineHeight\` lets the platform pick, and the platform picks differently per font. All ${Object.keys(T.TYPE).length} roles carry one.

**The Feelings-Aren't-Numbers Rule.** Numbers are for progression — Streak, XP, tiers, prices. Anything emotional is shown: mood is a sprite.

## 4. Elevation, shape, and rhythm

Depth is drawn, not blurred. Every sticker throws a hard-edged offset shadow with **zero blur radius** — as if a paper cutout were lit by a single lamp. There are exactly two tiers and no new tier may be added.

### Shadow vocabulary

${table(
  ["Token", "Value", "Job"],
  [
    [
      "`STICKER_SHADOW`",
      `\`${T.STICKER_SHADOW.shadowOffset.width},${T.STICKER_SHADOW.shadowOffset.height} · radius ${T.STICKER_SHADOW.shadowRadius} · opacity ${T.STICKER_SHADOW.shadowOpacity} · elevation ${T.STICKER_SHADOW.elevation}\``,
      "Cards, panels, modals — the signature paper-cutout lift.",
    ],
    [
      "`SHADOW_SM`",
      `\`${T.SHADOW_SM.shadowOffset.width},${T.SHADOW_SM.shadowOffset.height} · radius ${T.SHADOW_SM.shadowRadius} · opacity ${T.SHADOW_SM.shadowOpacity} · elevation ${T.SHADOW_SM.elevation}\``,
      "The lighter companion — buttons, chips, list rows.",
    ],
  ],
)}

### Radius (\`RADII\`)

${tokenTable("RADII", Object.entries(T.RADII))}

### Spacing (\`SPACE\`)

${blurb("SPACE")}

${table(["Step", "Value"], [...Object.entries(T.SPACE).map(([k, v]) => [`\`${k}\``, `\`${v}\``]), ["`PAGE_PAD`", `\`${T.PAGE_PAD}\``], ["`TAB_SAFE`", `\`${T.TAB_SAFE}\``], ["`STATUS_SAFE`", `\`${T.STATUS_SAFE}\``], ["`TAP_MIN`", `\`${T.TAP_MIN}\``], ["`RULE_WIDTH`", `\`${T.RULE_WIDTH}\``]])}

### Border widths (\`BORDER\`)

${blurb("BORDER")}

${table(["Step", "Value"], Object.entries(T.BORDER).map(([k, v]) => [`\`${k}\``, `\`${v}\``]))}

### Opacity (\`OPACITY\`)

${blurb("OPACITY")}

${table(["Step", "Value"], Object.entries(T.OPACITY).map(([k, v]) => [`\`${k}\``, `\`${v}\``]))}

### Tilt (\`TILT\`)

${blurb("TILT")}

${table(["Token", "Value"], [["`card`", `\`${T.TILT.card}°\``], ["`dialog`", `\`${T.TILT.dialog}°\``], ["`tape`", `\`${T.TILT.tape}°\``], ["`row` (`ROW_TILTS`)", `\`${T.ROW_TILTS.join(" · ")}\``]])}

### Motion (\`MOTION\`)

${blurb("MOTION")}

${table(["Duration", "Value"], Object.entries(T.MOTION).map(([k, v]) => [`\`${k}\``, `\`${v}ms\``]))}

${blurb("MOTION_SPRING")}

${table(["Spring", "Damping / stiffness"], Object.entries(T.MOTION_SPRING).map(([k, v]) => [`\`${k}\``, `\`${v.damping} / ${v.stiffness}\``]))}

### Named rules

**The Two-Tiers-No-Blur Rule.** Sticker contexts use only \`STICKER_SHADOW\` or \`SHADOW_SM\`, both zero-blur, ink-colored, full-opacity. If the shadow has a blur radius, it belongs to a different app.

**The No-Arithmetic Rule.** \`SPACE.xs + 1\` is an off-scale value in a token's clothes. Pick the nearest step.

**The 44pt Rule.** \`TAP_MIN\` is ${T.TAP_MIN}. A control may *look* smaller (\`BUTTON_SIZE.xs\` is ${T.BUTTON_SIZE.xs.minH}pt tall), but its touch frame may not be — the frame comes back as \`hitSlop\`.

## 5. Components

### Cards / containers

- **Signature primitive:** \`Sticker\` — the base of nearly every surface.
- **Corner style:** \`RADII.lg\` (${T.RADII.lg}px) default; the scale runs ${Object.values(T.RADII).join(" / ")}.
- **Background:** a \`WHIMSY\` fill (\`paper\` default) chosen per sticker.
- **Border:** \`BORDER.ink\` (${T.BORDER.ink}px) ink, always.
- **Padding:** \`SPACE.card\` (${T.SPACE.card}px) — structural to the ${T.BORDER.ink}px-border look.
- **Tilt:** \`TILT.card\` (${T.TILT.card}°); list rows cycle \`ROW_TILTS\`.
- **Shadow:** \`STICKER_SHADOW\`.
- **Tape:** a narrow \`Tape\` strip (\`sun\`, \`TILT.tape\` = ${T.TILT.tape}°) pins stickers to the page.

### Buttons

Sizes come from \`BUTTON_SIZE\`, not from the component:

${table(["Size", "Min height", "Pad x / y", "Label size", "Radius"], buttonRows)}

- **Gradient variants** (\`primary\` rose, \`purple\`, \`gold\`) wear the signature ${T.BORDER.ink}px ink outline + \`SHADOW_SM\`, so they read as hand-drawn buttons rather than flat gradient pills. Label ink: \`ink\` on rose, \`textOnDark\` on purple, \`goldInk\` (\`${T.WHIMSY.goldInk}\`) on gold.
- **Flat variants:** \`ghost\` (paper + separator outline), \`success\` (\`successSurface\`/\`successText\`/\`successBorder\`), \`destructive\` (\`dangerSurface\`/\`dangerText\` + ink outline), \`lilac\` (the soft affirmative), \`dark\` (ink + \`textOnDark\`).
- **Link variants:** \`link\` (underlined ink) and \`handLink\` (accent, hand voice) draw no chrome but keep the full ${T.TAP_MIN}pt frame.
- **Disabled / \`locked\` — "a button, asleep":** \`DISABLED\` = \`surfaceStrong\` fill + ink outline + \`textDisabled\` ink, and **no opacity**. You mute the fill; you never dissolve the outline.
- **Loading:** the label swaps for a hand-written working line. Never an \`ActivityIndicator\`.

### Headers

\`PageHeader\` crowns every stack screen — kicker (\`KICKER_PILL\`, \`${T.KICKER_PILL.color}\`) + \`pageTitle\` + a \`TITLE_RULE\` (\`RULE_WIDTH\` ${T.RULE_WIDTH} × ${T.TITLE_RULE.height}px ink at \`OPACITY.rule\` ${T.OPACITY.rule}) + optional \`‹ back\`. In-screen breaks use \`SectionHeader\` with \`KICKER_TEXT\` (\`${T.KICKER_TEXT.color}\`) + \`sectionTitle\`.

### Empty & loading states

Cozy, never utilitarian: a \`Sticker\` with a \`Glyph\` (\`ART_SIZE.glyph\` = ${T.ART_SIZE.glyph}px) and a warm line (\`EmptyState\`), or a warm \`LoadingBeat\` — never a bare gray string or a naked spinner.

### Navigation

\`HangingSignsTabBar\` — hand-drawn hanging signs that sway (\`MOTION_SPRING.sway\`), riding the \`WOOD\` rail (\`${T.WOOD.top}\` → \`${T.WOOD.bottom}\`). Not a flat system tab bar.

### Web

The web is a consumer of these tokens, not a second design system: \`scripts/build-web-tokens.mjs\` emits \`web/tokens.css\` (every token above as a CSS custom property) and \`web/sticker.css\` (one rule per primitive, tokens only). No HTML file declares its own \`:root\`.

## 6. Do's and Don'ts

### Do:
- **Do** reach for tokens: \`WHIMSY\`, \`UI_COLORS\`, \`FONTS\`, \`TYPE\`, \`RADII\` (${Object.values(T.RADII).join("/")}), \`SPACE\` (${Object.values(T.SPACE).join("/")}), \`BORDER\` (${Object.values(T.BORDER).join("/")}), \`STICKER_SHADOW\`/\`SHADOW_SM\`. \`${THEME_REL}\` is the single source of truth.
- **Do** put every surface on a \`Sticker\` — ink border, hand-drawn tilt, a hard zero-blur shadow. Cards are good here. Tilt is good here.
- **Do** compose text from \`TYPE\` roles with a color applied per use; keep \`PAGE_PAD\` (${T.PAGE_PAD}px) on headers and scroll edges.
- **Do** show feelings as sprites; keep numbers for progression.
- **Do** make the world respond *now* — feedback inside \`MOTION.tap\` (${T.MOTION.tap}ms); server truth reconciles after.
- **Do** keep every screen cream/paper and crown every stack screen with \`PageHeader\`.

### Don't:
- **Don't** treat this like a SaaS dashboard — do not kill the cards, flatten the gradients, calm the motion, or default to system fonts. A borderless, perfectly-aligned, soft-shadow card is slop here.
- **Don't** inline a raw hex, font size, radius, or pad past the token layer. That governance erosion *is* the slop — not a generic look.
- **Don't** add a third shadow tier or a blurred shadow in a sticker context.
- **Don't** do arithmetic on a \`SPACE\` step.
- **Don't** let text color come from opacity, and never dissolve a disabled control under an opacity crush.
- **Don't** ever put an emoji character in a render — use \`Glyph\` or \`Icon\`. \`★ ✦ ✧\` are typography; \`✓ ✕ ♥\` are \`Icon\`/\`Glyph\`.
- **Don't** wrap a screen in black — \`bark\` (and \`stage\` for ceremonies) is the only dark surface.
`;

const outArg = process.argv.indexOf("--out");
const outFile = outArg === -1 ? join(ROOT, "DESIGN.md") : process.argv[outArg + 1];
const doc = `${frontMatter}\n${body}`;
writeFileSync(outFile, doc);
if (outArg === -1) console.log(`${relative(ROOT, outFile)} — ${doc.length} bytes`);
