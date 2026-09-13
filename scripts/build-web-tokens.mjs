#!/usr/bin/env node
// Generates the web's token layer from constants/theme.ts (design-system-spec
// §3 rule 7 — "the web is a consumer of theme.ts, not a second design system";
// the property list is findings-G-web §7 table 1).
//
//   node scripts/build-web-tokens.mjs              -> web/tokens.css + web/sticker.css
//   node scripts/build-web-tokens.mjs --out <dir>  -> the same two files elsewhere
//                                                    (how lint:web diffs for staleness)
//
// Nothing here may be hand-edited: edit constants/theme.ts and re-run.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  FILL_KEYS,
  RARITIES,
  ROOT,
  THEME_REL,
  UI_COLOR_ALIASES,
  fontFaces,
  kebab,
  loadTheme,
  webFont,
} from "./theme-tokens.mjs";

const T = await loadTheme();
const FONT = fontFaces(T.FONTS);

const BANNER = (script) =>
  `/* GENERATED from ${THEME_REL} by scripts/${script} — do not edit */\n`;

const px = (n) => `${n}px`;
const deg = (n) => `${n}deg`;
const ms = (n) => `${n}ms`;

// A `:root` block, written as one commented group per token family so the file
// reads like the spec table it implements.
const groups = [];
const group = (title, entries) => {
  const rows = entries.filter(([, value]) => value !== undefined && value !== null);
  if (rows.length) groups.push({ title, rows });
};

// ------------------------------------------------------------ ink & paper --
group("Ink & paper", [
  ["--ink", T.WHIMSY.ink],
  ["--paper", T.WHIMSY.paper],
  ["--cream", T.WHIMSY.cream],
  ["--cream2", T.WHIMSY.cream2],
  ["--ink-mute", T.WHIMSY.mute],
  ["--ink-mute-soft", T.WHIMSY.muteSoft],
  ["--ink-mute-dim", T.WHIMSY.muteDim],
  ["--ink-deep", T.WHIMSY.inkDeep],
  ["--bark", T.WHIMSY.bark],
  ["--bark-text", T.WHIMSY.barkText],
  ["--bark-mute", T.WHIMSY.barkMute],
  ["--stage", T.WHIMSY.stage],
]);

// ------------------------------------------------------ fills (surface only) --
group(
  "Fills — surface only; a pastel is never assigned to `color:`",
  FILL_KEYS.map((key) => [`--fill-${kebab(key)}`, T.WHIMSY[key]]),
);

// ------------------------------------- alignment · membership · effects --
// Named paint that is neither a surface pastel nor a semantic role: the two
// alignment sides and the counters they burn in, the membership metals, the
// boost ember, the prestige frame. Emitted so a web surface can say `--goblin`
// instead of re-typing the hex the app already owns.
group("Alignment · membership · effects", [
  ["--angel", T.WHIMSY.angel],
  ["--goblin", T.WHIMSY.goblin],
  ["--bless", T.WHIMSY.bless],
  ["--curse-green", T.WHIMSY.curseGreen],
  ["--bless-surface", T.WHIMSY.blessSurface],
  ["--curse-surface", T.WHIMSY.curseSurface],
  ["--slop-gold", T.WHIMSY.slopGold],
  ["--slop-band", T.WHIMSY.slopBand],
  ["--flame", T.WHIMSY.flame],
  ["--prestige", T.WHIMSY.prestige],
]);

// ------------------------------------------- semantic roles (from UI_COLORS) --
group(
  "Semantic roles (UI_COLORS) — meaning survives palette tuning",
  Object.entries(T.UI_COLORS).map(([key, value]) => [
    `--${kebab(UI_COLOR_ALIASES[key] ?? key)}`,
    value,
  ]),
);

// --------------------------------------------------------------- ink washes --
group(
  "Ink washes (TINT) — every wash derived from --ink, never a hand-typed rgba",
  Object.entries(T.TINT).map(([key, value]) => [`--tint-${kebab(key)}`, value]),
);

// ------------------------------------------------------------------ rarity --
group(
  "Rarity — fill (panel) · stripe (marker) · badge pair (verified ≥4.5:1)",
  RARITIES.flatMap((r) => [
    [`--rarity-${r}-fill`, T.RARITY_BG_SOLID[r]],
    [`--rarity-${r}-stripe`, T.RARITY_STRIPE[r]],
    [`--rarity-${r}-badge-bg`, T.RARITY_BADGE[r].bg],
    [`--rarity-${r}-badge-ink`, T.RARITY_BADGE[r].ink],
  ]),
);

// ------------------------------------------------------------------ podium --
group(
  "Podium metals — deliberately not --fill-slop-gold: a medal is not a membership",
  Object.entries(T.PODIUM).map(([key, value]) => [`--podium-${kebab(key)}`, value]),
);

// ------------------------------------------------- button ramps + label inks --
group("Button ramps (GRADIENT) — stops only; the page composes the gradient", [
  ...Object.entries(T.GRADIENT).flatMap(([name, [from, to]]) => [
    [`--gradient-${kebab(name)}-from`, from],
    [`--gradient-${kebab(name)}-to`, to],
  ]),
  ["--gold-ink", T.WHIMSY.goldInk],
]);

// ------------------------------------------------------------------- fonts --
group("Fonts — four faces, each with a job", [
  ["--font-display", FONT.stack("display")],
  ["--font-body", FONT.stack("body")],
  ["--font-whimsy", FONT.stack("whimsy")],
  ["--font-hand", FONT.stack("hand")],
]);

// -------------------------------------------------------------- type roles --
// One `font` shorthand per TYPE role, so a rule reads `font: var(--type-body)`
// and never a bare `font-size`. `textTransform` has no home in the shorthand —
// it rides the matching `.text-*` class in sticker.css instead.
const typeRows = [];
const trackingRows = [];
for (const [role, spec] of Object.entries(T.TYPE)) {
  const face = Object.entries(T.FONTS).find(([, name]) => name === spec.fontFamily)?.[0];
  const { weight } = webFont(T.FONTS[face]);
  const cssFace = { display: "display", displaySemi: "display", whimsy: "whimsy", hand: "hand" }[face] ?? "body";
  typeRows.push([
    `--type-${kebab(role)}`,
    `${weight} ${px(spec.fontSize)}/${px(spec.lineHeight)} var(--font-${cssFace})`,
  ]);
  if (spec.letterSpacing !== undefined) {
    trackingRows.push([`--tracking-${kebab(role)}`, px(spec.letterSpacing)]);
  }
}
group("Type roles — a rule reads `font: var(--type-body)`, never a bare size", typeRows);
group("Tracking — only the roles that carry a letterSpacing", trackingRows);

// ------------------------------------------------------------------ radius --
group(
  "Radius",
  Object.entries(T.RADII).map(([key, value]) => [`--radius-${kebab(key)}`, px(value)]),
);

// ------------------------------------------------------------------- space --
group("Space — no arithmetic on a step", [
  ...Object.entries(T.SPACE).map(([key, value]) => [`--space-${kebab(key)}`, px(value)]),
  ["--page-pad", px(T.PAGE_PAD)],
  ["--tab-safe", px(T.TAB_SAFE)],
  ["--status-safe", px(T.STATUS_SAFE)],
  ["--tap-min", px(T.TAP_MIN)],
  ["--rule-width", px(T.RULE_WIDTH)],
]);

// ------------------------------------------------------------------ border --
group(
  "Border — hair separates · thin outlines · ink IS the look · heavy selects",
  Object.entries(T.BORDER).map(([key, value]) => [`--border-${kebab(key)}`, px(value)]),
);

// ----------------------------------------------------------------- shadows --
// Exactly two tiers, both zero-blur ink — and nothing else.
group("Shadow — two tiers, zero blur, and nothing else", [
  [
    "--shadow-sticker",
    `${px(T.STICKER_SHADOW.shadowOffset.width)} ${px(T.STICKER_SHADOW.shadowOffset.height)} 0 var(--ink)`,
  ],
  ["--shadow-sm", `${px(T.SHADOW_SM.shadowOffset.width)} ${px(T.SHADOW_SM.shadowOffset.height)} 0 var(--ink)`],
  // The press: shove the surface into its own shadow and collapse the shadow.
  ["--press-shift", px(T.SHADOW_SM.shadowOffset.width)],
]);

// ----------------------------------------------------------------- opacity --
group(
  "Opacity — text colour never comes from opacity; a disabled control never wears one",
  Object.entries(T.OPACITY).map(([key, value]) => [`--opacity-${kebab(key)}`, String(value)]),
);

// -------------------------------------------------------------------- tilt --
group("Tilt — one vocabulary: rows take their turn, cards lean, tape leans hard", [
  ...T.ROW_TILTS.map((t, i) => [`--tilt-${i + 1}`, deg(t)]),
  ["--tilt-card", deg(T.TILT.card)],
  ["--tilt-dialog", deg(T.TILT.dialog)],
  ["--tilt-tape", deg(T.TILT.tape)],
]);

// ------------------------------------------------------------------ motion --
// theme.ts names no CSS easing — the app lands moved things on MOTION_SPRING
// (damping 12 / stiffness 180, springy on purpose). `--ease-out` is the web's
// one approximation of that settle, so no page declares its own curve.
group("Motion — durations only; a linear fade is never the default", [
  ...Object.entries(T.MOTION).map(([key, value]) => [`--motion-${kebab(key)}`, ms(value)]),
  ["--ease-out", "cubic-bezier(0.22, 1, 0.36, 1)"],
]);

// ---------------------------------------------------------------- art sizes --
group(
  "Art sizes — the fixed boxes hand-drawn art is laid out in (not spacing)",
  Object.entries(T.ART_SIZE).map(([key, value]) => [`--art-${kebab(key)}`, px(value)]),
);

// ----------------------------------------------------------- button geometry --
group(
  "Button geometry (BUTTON_SIZE) — so .btn never retypes a number",
  Object.entries(T.BUTTON_SIZE).flatMap(([size, s]) => [
    [`--btn-${size}-min-h`, px(s.minH)],
    [`--btn-${size}-px`, px(s.px)],
    [`--btn-${size}-py`, px(s.py)],
    [`--btn-${size}-radius`, px(s.br)],
    [`--btn-${size}-font`, `800 ${px(s.fs)} var(--font-body)`],
  ]),
);
group("Button label tracking", [["--btn-tracking", px(0.1)]]);

// ---------------------------------------------------------------- tokens.css --
const pad = Math.max(...groups.flatMap((g) => g.rows.map(([name]) => name.length)));

const tokensCss = [
  BANNER("build-web-tokens.mjs"),
  `@import url("${FONT.importUrl}");\n`,
  ":root {",
  groups
    .map(({ title, rows }) =>
      [`\t/* ${title} */`, ...rows.map(([name, value]) => `\t${`${name}:`.padEnd(pad + 2)}${value};`)].join("\n"),
    )
    .join("\n\n"),
  "}",
  "",
].join("\n");

// --------------------------------------------------------------- sticker.css --
const fillModifiers = FILL_KEYS.map(
  (key) => `.sticker--${kebab(key)} { --fill: var(--fill-${kebab(key)}); }`,
).join("\n");

const textRoles = Object.entries(T.TYPE)
  .map(([role, spec]) => {
    const k = kebab(role);
    const decls = [`font: var(--type-${k});`];
    if (spec.letterSpacing !== undefined) decls.push(`letter-spacing: var(--tracking-${k});`);
    if (spec.textTransform) decls.push(`text-transform: ${spec.textTransform};`);
    return `.text-${k} { ${decls.join(" ")} }`;
  })
  .join("\n");

const stickerCss = `${BANNER("build-web-tokens.mjs")}/* The primitive layer (design-system-spec §3 rule 7 / findings-G-web §7.3).
   One rule per app primitive; every value is a token from tokens.css. */

@import url("tokens.css");

/* --- Sticker — the signature surface: ink outline, hand tilt, hard shadow --- */

.sticker {
	--fill: var(--paper);
	--tilt: var(--tilt-card);
	--shadow: var(--shadow-sticker);
	position: relative;
	background: var(--fill);
	color: var(--text-primary);
	border: var(--border-ink) solid var(--border);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow);
	padding: var(--space-card);
	transform: rotate(var(--tilt));
}

.sticker--sm { --shadow: var(--shadow-sm); }
.sticker--flat { --shadow: none; }
.sticker--straight { --tilt: 0deg; }
.sticker--dialog { --tilt: var(--tilt-dialog); border-radius: var(--radius-xl); }
.sticker--waiting { border-style: dashed; }
.sticker--bark { --fill: var(--bark); color: var(--text-on-dark); }
.sticker--paper { --fill: var(--paper); }
.sticker--cream { --fill: var(--cream); }
.sticker--cream2 { --fill: var(--cream2); }
${fillModifiers}

/* A list of stickers takes its scrapbook angle from the row tilts, in turn. */
.sticker-list > .sticker:nth-child(8n + 1) { --tilt: var(--tilt-1); }
.sticker-list > .sticker:nth-child(8n + 2) { --tilt: var(--tilt-2); }
.sticker-list > .sticker:nth-child(8n + 3) { --tilt: var(--tilt-3); }
.sticker-list > .sticker:nth-child(8n + 4) { --tilt: var(--tilt-4); }
.sticker-list > .sticker:nth-child(8n + 5) { --tilt: var(--tilt-5); }
.sticker-list > .sticker:nth-child(8n + 6) { --tilt: var(--tilt-6); }
.sticker-list > .sticker:nth-child(8n + 7) { --tilt: var(--tilt-7); }
.sticker-list > .sticker:nth-child(8n + 8) { --tilt: var(--tilt-8); }

/* Tape — the narrow strip that pins a sticker to the page. */
.tape {
	background: var(--fill-sun);
	border: var(--border-thin) solid var(--border);
	border-radius: var(--radius-hair);
	transform: rotate(var(--tilt-tape));
}

/* --- Button — a hand-drawn control, never a flat gradient pill --- */

.btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-sm);
	min-height: var(--tap-min);
	padding: var(--btn-md-py) var(--btn-md-px);
	background: var(--paper);
	color: var(--text-primary);
	border: var(--border-ink) solid var(--border);
	border-radius: var(--btn-md-radius);
	box-shadow: var(--shadow-sm);
	font: var(--btn-md-font);
	letter-spacing: var(--btn-tracking);
	text-align: center;
	text-decoration: none;
	cursor: pointer;
	transition:
		transform var(--motion-tap) ease-out,
		box-shadow var(--motion-tap) ease-out;
}

.btn:active:not(:disabled):not([aria-disabled="true"]) {
	transform: translate(var(--press-shift), var(--press-shift));
	box-shadow: none;
}

/* The xs step is deliberately shorter than --tap-min. The app restores the
   frame with hitSlop; the web has none, so .btn--xs sits inside a 44px row. */
.btn--xs {
	min-height: var(--btn-xs-min-h);
	padding: var(--btn-xs-py) var(--btn-xs-px);
	border-radius: var(--btn-xs-radius);
	font: var(--btn-xs-font);
}
.btn--sm {
	min-height: var(--btn-sm-min-h);
	padding: var(--btn-sm-py) var(--btn-sm-px);
	border-radius: var(--btn-sm-radius);
	font: var(--btn-sm-font);
}
.btn--lg {
	min-height: var(--btn-lg-min-h);
	padding: var(--btn-lg-py) var(--btn-lg-px);
	border-radius: var(--btn-lg-radius);
	font: var(--btn-lg-font);
}
.btn--full { display: flex; width: 100%; }

.btn--primary {
	background: linear-gradient(180deg, var(--gradient-rose-from), var(--gradient-rose-to));
	color: var(--text-primary);
}
.btn--gold {
	background: linear-gradient(180deg, var(--gradient-gold-from), var(--gradient-gold-to));
	color: var(--gold-ink);
}
.btn--purple {
	background: linear-gradient(180deg, var(--gradient-purple-from), var(--gradient-purple-to));
	color: var(--text-on-dark);
}
/* The flat lilac affirmative (app: Button variant="lilac") — a pastel fill and
   an ink outline, no ramp. The quieter yes next to .btn--primary. */
.btn--lilac {
	background: var(--fill-lilac);
	color: var(--text-primary);
	box-shadow: var(--shadow-sm);
}
.btn--ghost {
	background: var(--surface);
	color: var(--text-primary);
	border-color: var(--separator);
	box-shadow: none;
}
.btn--success {
	background: var(--success-surface);
	color: var(--success-text);
	border-color: var(--success-border);
}
.btn--destructive {
	background: var(--danger-surface);
	color: var(--danger-text);
}

/* A button, asleep: full chrome kept over a muted fill. No opacity crush, ever. */
.btn--locked,
.btn:disabled,
.btn[aria-disabled="true"] {
	background: var(--cream2);
	color: var(--text-disabled);
	border: var(--border-ink) solid var(--border);
	box-shadow: none;
	opacity: 1;
	cursor: default;
	transform: none;
}

/* A link is text that happens to be tappable — and keeps the full 44pt frame. */
.btn--link,
.btn--hand-link {
	min-height: var(--tap-min);
	padding: 0;
	background: none;
	border: 0;
	border-radius: 0;
	box-shadow: none;
}
.btn--link { color: var(--text-primary); text-decoration: underline; }
.btn--hand-link {
	color: var(--accent);
	font: var(--type-hand);
	letter-spacing: normal;
	text-decoration: none;
}

/* --- Headers — every page and section wears the same crown --- */

.page-header,
.section-header {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--space-xs);
}
.page-header { padding-inline: var(--page-pad); margin-block-end: var(--space-lg); }
.section-header { margin-block: var(--space-lg) var(--space-sm); }

.page-header__title {
	margin: 0;
	font: var(--type-page-title);
	color: var(--text-primary);
}
.section-header__title {
	margin: 0;
	font: var(--type-section-title);
	letter-spacing: var(--tracking-section-title);
	color: var(--text-primary);
}

.rule {
	width: var(--rule-width);
	height: var(--border-ink);
	background: var(--ink);
	opacity: var(--opacity-rule);
	border-radius: var(--radius-hair);
}

/* --- Kickers — the small line above a title --- */

.kicker {
	font: var(--type-kicker);
	letter-spacing: var(--tracking-kicker);
	color: var(--accent);
}
.kicker--on-dark { color: var(--fill-sun); }
.kicker-pill {
	font: var(--type-kicker-pill);
	letter-spacing: var(--tracking-kicker-pill);
	text-transform: uppercase;
	color: var(--ink-mute);
}

/* --- Empty state — cozy, never utilitarian --- */

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-sm);
	padding: var(--space-xl) var(--space-lg);
	text-align: center;
}
.empty-state__art {
	width: var(--art-glyph);
	height: var(--art-glyph);
}
.empty-state__line {
	margin: 0;
	font: var(--type-hand-lg);
	color: var(--text-secondary);
}

/* --- Chip (selectable) · Tag (read-only) --- */

.chip,
.tag {
	display: inline-flex;
	align-items: center;
	gap: var(--space-xs);
	padding: var(--space-xs) var(--space-md);
	background: var(--paper);
	color: var(--text-primary);
	border: var(--border-thin) solid var(--border);
	border-radius: var(--radius-pill);
	font: var(--type-label);
	letter-spacing: var(--tracking-label);
}
.chip { min-height: var(--tap-min); box-shadow: var(--shadow-sm); cursor: pointer; }
.chip[aria-selected="true"] { border-width: var(--border-heavy); }
.chip:disabled,
.chip[aria-disabled="true"] { background: var(--cream2); color: var(--text-disabled); opacity: 1; }
.tag--sun { background: var(--fill-sun); }
.tag--rose { background: var(--fill-rose); }
.tag--sage { background: var(--fill-sage); }
.tag--lilac { background: var(--fill-lilac); }
.tag--bark { background: var(--bark); color: var(--text-on-dark); }

/* --- Field --- */

.field { display: flex; flex-direction: column; gap: var(--space-xs); }
.field__label {
	font: var(--type-label);
	letter-spacing: var(--tracking-label);
	color: var(--text-secondary);
}
.field__input {
	min-height: var(--tap-min);
	padding: var(--space-sm) var(--space-md);
	background: var(--paper);
	color: var(--text-primary);
	border: var(--border-ink) solid var(--border);
	border-radius: var(--radius-md);
	font: var(--type-body);
}
.field__input::placeholder { color: var(--text-placeholder); }
/* The field thickens its own border on focus — it never removes the ring.
   An outline:none here would outrank the global :focus-visible rule for every
   consumer of this sheet, which is the accessibility bug G-08 names. */
.field__input:focus { border-width: var(--border-heavy); }
.field--error .field__input { background: var(--danger-surface); border-color: var(--danger-text); }
.field--valid .field__input { background: var(--success-surface); border-color: var(--success-border); }
.field__helper { font: var(--type-hand); color: var(--text-secondary); }
.field--error .field__helper { color: var(--danger-text); }

/* --- Segmented control --- */

.segmented {
	display: inline-flex;
	gap: var(--space-xxs);
	padding: var(--space-xxs);
	background: var(--cream);
	border: var(--border-ink) solid var(--border);
	border-radius: var(--radius-pill);
}
.segmented__option {
	min-height: var(--tap-min);
	padding: var(--space-sm) var(--space-lg);
	background: none;
	color: var(--text-secondary);
	border: 0;
	border-radius: var(--radius-pill);
	font: var(--type-label);
	letter-spacing: var(--tracking-label);
	cursor: pointer;
}
.segmented__option[aria-checked="true"] {
	background: var(--paper);
	color: var(--text-primary);
	border: var(--border-heavy) solid var(--border);
	box-shadow: var(--shadow-sm);
}
.segmented__option:disabled { color: var(--text-disabled); cursor: default; }

/* --- Radio card — the two-line pick (title + hand sub), one of a set --- */
/* Markup: a <label class="radio-card"> wrapping a visually-hidden native
   <input type="radio">, so the keyboard, the group semantics and the browser's
   own state all come free. Selected thickens the border and takes a fill; the
   focus ring is the global one, never removed. */

.radio-card {
	display: flex;
	flex-direction: column;
	gap: var(--space-xxs);
	min-height: var(--tap-min);
	padding: var(--space-md) var(--space-card);
	background: var(--paper);
	color: var(--text-primary);
	border: var(--border-ink) solid var(--border);
	border-radius: var(--radius-lg);
	cursor: pointer;
}
.radio-card__input {
	position: absolute;
	width: 1px;
	height: 1px;
	margin: -1px;
	padding: 0;
	border: 0;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}
.radio-card__title {
	font: var(--type-card-title-sm);
	letter-spacing: var(--tracking-card-title-sm);
}
.radio-card__sub { font: var(--type-hand); color: var(--text-secondary); }
.radio-card:has(.radio-card__input:checked) {
	border-width: var(--border-heavy);
	background: var(--fill-sun);
	box-shadow: var(--shadow-sm);
}
.radio-card:has(.radio-card__input:focus-visible) {
	outline: var(--border-heavy) solid var(--focus);
	outline-offset: var(--space-xxs);
}
.radio-card:has(.radio-card__input:disabled) {
	background: var(--cream2);
	color: var(--text-disabled);
	cursor: default;
}

/* --- Toast — one at a time, MOTION.toast long --- */

.toast {
	display: inline-flex;
	align-items: center;
	gap: var(--space-sm);
	padding: var(--space-sm) var(--space-lg);
	background: var(--bark);
	color: var(--text-on-dark);
	border: var(--border-ink) solid var(--border);
	border-radius: var(--radius-pill);
	box-shadow: var(--shadow-sticker);
	font: var(--type-body);
}

/* --- Global --- */

:focus-visible { outline: var(--border-heavy) solid var(--focus); outline-offset: var(--space-xxs); }

@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		animation-duration: 1ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 1ms !important;
		scroll-behavior: auto !important;
	}
	.sticker,
	.tape { transform: none; }
}

/* --- Type roles as classes — one per TYPE role --- */

${textRoles}
`;

// -------------------------------------------------------------------- write --
// `web/` is the canonical home. Every deployable web surface gets a byte-identical
// copy inside its own served tree, because neither Vercel (landing) nor Next
// (analytics-dashboard) can reach outside its root: `landing/tokens.css` is served
// at `/tokens.css`, and the dashboard imports its copy from `app/`. The copies are
// generated, never hand-edited — `npm run lint:web` diffs all three trees.
const MIRRORS = ["landing", "analytics-dashboard/app"];

const outArg = process.argv.indexOf("--out");
const canonical = outArg === -1;
const outDirs = canonical
  ? [join(ROOT, "web"), ...MIRRORS.map((dir) => join(ROOT, dir))]
  : [process.argv[outArg + 1]];

for (const outDir of outDirs) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, body] of [
    ["tokens.css", tokensCss],
    ["sticker.css", stickerCss],
  ]) {
    const file = join(outDir, name);
    writeFileSync(file, body);
    if (canonical) {
      console.log(`${relative(ROOT, file)} — ${body.length} bytes`);
    }
  }
}
