---
name: Tickle the Pig
description: A cozy paper-craft storybook aesthetic — ink-outlined stickers, hard drop-shadows, and warm cream paper.
colors:
  ink: "#2a1f15"
  paper: "#fffaf0"
  cream: "#fbeee2"
  cream2: "#f6e6d4"
  rose: "#ffd6dc"
  rose-deep: "#f8a8b3"
  sky: "#c8e3f0"
  sage: "#c9dec1"
  sun: "#ffd87a"
  lilac: "#d6c8f0"
  lilac-deep: "#a89bff"
  peach: "#ffc8a8"
  accent: "#a03e2f"
  gold-ink: "#5A3F00"
  sage-ink: "#7A9B63"
  mute: "#605449"
  mute-soft: "#8c7e71"
  mute-dim: "#6a5c50"
  bark: "#3a2c1e"
  bark-text: "#fff3e2"
  bark-mute: "#e8d9c6"
  angel: "#a89bff"
  goblin: "#d4a437"
  slop-gold: "#F5C44A"
  slop-band: "#FFE7AD"
  bless: "#C99B23"
  curse-green: "#526f40"
  curse-surface: "#D5E4C9"
  bless-surface: "#FFF3D0"
  flame: "#F58F4A"
  ink-deep: "#1a1411"
  stage: "#1f1710"
  dirt: "#8d5a2c"
  dirt-deep: "#74441e"
  grass: "#8FBF6A"
  barn-red: "#C44848"
  prestige: "#D9A45D"
  tape: "#EAD59E"
  tape-edge: "#C8AD77"
  focus: "#3d687f"
  success-text: "#476436"
  success-surface: "#e8f5e0"
  warning-text: "#7b5a00"
  warning-surface: "#fff3d0"
  info-text: "#3d687f"
  danger-text: "#983a2c"
  scrim: "rgba(42, 31, 21, 0.55)"
typography:
  hero:
    fontFamily: "Fredoka_700Bold"
    fontSize: "44px"
    lineHeight: "48px"
  displayLg:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "36px"
    lineHeight: "38px"
  display:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "32px"
    lineHeight: "34px"
  pageTitle:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "26px"
    lineHeight: "28px"
  sectionTitle:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "22px"
    lineHeight: "24px"
    letterSpacing: "0.2px"
  cardTitle:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "18px"
    lineHeight: "22px"
    letterSpacing: "0.2px"
  cardTitleSm:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "15px"
    lineHeight: "22px"
    letterSpacing: "0.2px"
  numeralLg:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "26px"
    lineHeight: "28px"
  numeral:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "16px"
    lineHeight: "20px"
  bodyLg:
    fontFamily: "Nunito_700Bold"
    fontSize: "17px"
    lineHeight: "24px"
  body:
    fontFamily: "Nunito_700Bold"
    fontSize: "15px"
    lineHeight: "21px"
  bodySm:
    fontFamily: "Nunito_700Bold"
    fontSize: "13px"
    lineHeight: "18px"
  label:
    fontFamily: "Nunito_800ExtraBold"
    fontSize: "12px"
    lineHeight: "16px"
    letterSpacing: "0.3px"
  kicker:
    fontFamily: "PatrickHand_400Regular"
    fontSize: "13px"
    lineHeight: "18px"
    letterSpacing: "0.4px"
  hand:
    fontFamily: "PatrickHand_400Regular"
    fontSize: "14px"
    lineHeight: "20px"
  handLg:
    fontFamily: "PatrickHand_400Regular"
    fontSize: "17px"
    lineHeight: "24px"
  handDisplay:
    fontFamily: "PatrickHand_400Regular"
    fontSize: "21px"
    lineHeight: "28px"
  kickerPill:
    fontFamily: "Nunito_800ExtraBold"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "1.6px"
    textTransform: "uppercase"
  kickerPillSm:
    fontFamily: "Nunito_800ExtraBold"
    fontSize: "10px"
    lineHeight: "13px"
    letterSpacing: "1.6px"
    textTransform: "uppercase"
rounded:
  hair: "2px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  xxl: "22px"
  pill: "999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  card: "14px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  page: "18px"
components:
  sticker:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    border: "2px solid {colors.ink}"
    rotate: "-0.6deg"
    padding: "14px"
    shadow: "4px 4px 0 {colors.ink}"
  button-primary:
    backgroundImage: "linear-gradient(180deg, #F0B8C8, #E8A7B9)"
    textColor: "{colors.ink}"
    border: "2px solid {colors.ink}"
    rounded: "{rounded.xxl}"
    padding: "0 18px"
    height: "44px"
    shadow: "2px 2px 0 {colors.ink}"
  button-purple:
    backgroundImage: "linear-gradient(180deg, #7052EE, #5C3FE0)"
    textColor: "{colors.bark-text}"
    border: "2px solid {colors.ink}"
    rounded: "{rounded.xxl}"
    height: "44px"
    shadow: "2px 2px 0 {colors.ink}"
  button-gold:
    backgroundImage: "linear-gradient(180deg, #F8D068, #F5C44A)"
    textColor: "{colors.gold-ink}"
    border: "2px solid {colors.ink}"
    rounded: "{rounded.xxl}"
    height: "44px"
    shadow: "2px 2px 0 {colors.ink}"
  button-locked:
    backgroundColor: "{colors.cream2}"
    textColor: "{colors.mute-dim}"
    border: "2px solid {colors.ink}"
    rounded: "{rounded.xxl}"
    height: "44px"
    opacity: "1"
  kicker-pill:
    textColor: "{colors.mute}"
    typography: "{typography.kickerPill}"
---

> **GENERATED from constants/theme.ts by scripts/build-design-md.mjs — do not edit; edit `constants/theme.ts` and re-run `npm run build:tokens`.**

# Design System: Tickle the Pig

## 1. Overview

**Creative North Star: "The Paper-Craft Scrapbook"**

Tickle the Pig looks like a storybook someone who cares assembled by hand: ink-outlined stickers pinned with tape onto warm cream paper, each card tilted a degree or two off-square, throwing a hard offset shadow as if lit by a single desk lamp. It is a deliberately maximalist, cozy, paper-craft aesthetic. The whimsy *is* the design — not decoration bolted onto a neutral shell. Every surface is a `Sticker`: a 2px ink border, a hand-drawn tilt (-0.6° by default, list rows cycling `ROW_TILTS`), and a hard-edged drop shadow with zero blur. The goal of this document and of `docs/design/design-system-spec.md` is the same: **every UI element in TTP can be rebuilt from the tokens alone.**

This system explicitly rejects the SaaS-dashboard playbook. The usual "eliminate AI slop" advice — kill the cards, flatten the gradients, calm the motion, default to system fonts — is *wrong* here. A perfectly-aligned, borderless, soft-shadow card is what reads as slop in this app. Slop here is **governance erosion**: the intentional tokens in `constants/theme.ts` silently bypassed by an inline hex, a raw font size, a reinvented radius. The craft standard is enforcing the taste that already exists, not imposing a new look.

Feelings are shown, never stated: mood is Rosie's sprite, not a number. Progression systems — Streak, XP, tiers, prices — may show numbers; feelings may not. And the world responds *now* — a cleansed curse vanishes on tap, a claim animates, a find names itself the instant it surfaces.

**Key Characteristics:**
- Ink-outlined paper stickers on warm cream, every card tilted and hard-shadowed
- One palette (`WHIMSY`, 39 tokens): muted storybook pastels, a single terracotta accent, one dark "bark" surface for the storyteller voice
- Four fonts, each with a job — Caprasimo (whimsy titles), Nunito (body), Fredoka (the one display numeral), Patrick Hand (hand-drawn kickers) — across 19 `TYPE` roles
- Exactly two hard shadow tiers, zero blur — no soft ambient shadows in sticker contexts
- Springy, hand-wound motion (`MOTION_SPRING`), never a linear fade that could belong to any app
- No emoji, ever — hand-drawn `Glyph` art or SVG `Icon` only

## 2. Colors

Whimsical paper-sticker palette (App Outlines v2). All color comes from `WHIMSY`; shared UI consumes the semantic roles in `UI_COLORS` so meaning survives palette tuning. A new color is a token with a dated one-line comment — never a fresh hex at the use site.

### Ink & paper

| Token | Value | Job |
| --- | --- | --- |
| `ink` | `#2a1f15` | — |
| `inkDeep` | `#1a1411` | Near-black — the stop the Judgement Day ceremony gradient opens on and the hanging-sign / lounge shadows reach for. |
| `paper` | `#fffaf0` | — |
| `cream` | `#fbeee2` | — |
| `cream2` | `#f6e6d4` | — |
| `mute` | `#605449` | Explicit warm-ink steps avoid alpha-dependent contrast as surfaces change. |
| `muteSoft` | `#8c7e71` | — |
| `muteDim` | `#6a5c50` | Text-safe disabled ink — ≥4.5:1 on paper (6.19), cream (5.65), cream2 (5.27), rose (4.88), sky (4.82), sage (4.51) and sun (4.71). |
| `bark` | `#3a2c1e` | Dark "storyteller" callout — the why-we-scuffle / vs-the-Great-Hunger strips on the war surfaces (Your Sounder redesign, 2026-07-06). |
| `barkText` | `#fff3e2` | — |
| `barkMute` | `#e8d9c6` | — |
| `stage` | `#1f1710` | The dark ceremony stage beside `bark` — the surface a Judgement Day or season-end ceremony plays on. |

### Sticker fills

| Token | Value | Job |
| --- | --- | --- |
| `WHIMSY.rose` | `#ffd6dc` | Sticker fill. |
| `WHIMSY.roseDeep` | `#f8a8b3` | Sticker fill. |
| `WHIMSY.sky` | `#c8e3f0` | Sticker fill. |
| `WHIMSY.sage` | `#c9dec1` | Sticker fill. |
| `WHIMSY.sun` | `#ffd87a` | Sticker fill. |
| `WHIMSY.lilac` | `#d6c8f0` | Sticker fill. |
| `WHIMSY.lilacDeep` | `#a89bff` | Sticker fill. |
| `WHIMSY.peach` | `#ffc8a8` | Sticker fill. |
| `WHIMSY.slopGold` | `#F5C44A` | Slop Club gold — the members-only identity hue. |
| `WHIMSY.slopBand` | `#FFE7AD` | Sticker fill. |

### The accent and the inks that sit on a fill

| Token | Value | Job |
| --- | --- | --- |
| `accent` | `#a03e2f` | Interactive terracotta. |
| `goldInk` | `#5A3F00` | The gold Button's label ink — the one ink dark enough to read on the gold ramp, inlined as #5A3F00 in Button.tsx and again on the pass track's gold tier stones. |
| `sageInk` | `#7A9B63` | The success control's outline — a sage picked to clear 3:1 on paper (3.01) as a non-text boundary, where the old inline #7A9B63 was chosen by eye. |

`ACCENT_SAFE_FILLS` names the 7 fills the accent may sit on (`#fffaf0` · `#fbeee2` · `#f6e6d4` · `#ffd6dc` · `#c8e3f0` · `#c9dec1` · `#ffd87a`); on the remaining fills the kicker is ink instead.

### Semantic roles (`UI_COLORS`)

| Token | Value | Job |
| --- | --- | --- |
| `canvas` | `#fffaf0` | — |
| `surface` | `#fffaf0` | — |
| `surfaceMuted` | `#fbeee2` | — |
| `surfaceStrong` | `#f6e6d4` | — |
| `textPrimary` | `#2a1f15` | — |
| `textSecondary` | `#605449` | — |
| `textDisabled` | `#6a5c50` | Disabled TEXT — a text-safe ink, never an opacity crush. |
| `uiMuted` | `#8c7e71` | Non-text muted UI: disabled icons, hairline separators, chart gridlines. |
| `textPlaceholder` | `#6a5c50` | `placeholderTextColor` reads a role instead of a hex. |
| `border` | `#2a1f15` | — |
| `separator` | `#8c7e71` | — |
| `action` | `#a03e2f` | — |
| `actionSurface` | `#ffd87a` | — |
| `focus` | `#3d687f` | The focus ring. |
| `successText` | `#476436` | — |
| `successSurface` | `#e8f5e0` | — |
| `successBorder` | `#7A9B63` | The success control's outline — 3.01:1 on paper, so the boundary is discernible without shouting. |
| `warningText` | `#7b5a00` | — |
| `warningSurface` | `#fff3d0` | — |
| `infoText` | `#3d687f` | — |
| `infoSurface` | `#c8e3f0` | — |
| `dangerText` | `#983a2c` | — |
| `dangerSurface` | `#ffd6dc` | — |
| `textOnDark` | `#fff3e2` | — |
| `scrim` | `rgba(42, 31, 21, 0.55)` | Derived from ink via TINT so the dim matches the outline. |

### Ink washes (`TINT`)

Named translucencies.

| Token | Value | Job |
| --- | --- | --- |
| `scrim` | `rgba(42, 31, 21, 0.55)` | — |
| `inkWash` | `rgba(42, 31, 21, 0.08)` | — |
| `well` | `rgba(42, 31, 21, 0.12)` | — |
| `paperWash` | `rgba(255, 250, 240, 0.7)` | — |
| `sunGlow` | `rgba(255, 216, 122, 0.5)` | — |
| `paperVeil` | `rgba(255, 250, 240, 0.14)` | Veils laid OVER artwork (a habitat scene, a placed item) — lighter than the paper-surface washes above, so the art stays legible under them. |
| `sunVeil` | `rgba(255, 216, 122, 0.2)` | — |

### Structured palettes

**`GRADIENT`** — The three sanctioned button ramps, moved out of Button.tsx so the web stylesheet reads the same stops.

| Ramp | Stops |
| --- | --- |
| `rose` | `#F0B8C8` → `#E8A7B9` |
| `purple` | `#7052EE` → `#5C3FE0` |
| `gold` | `#F8D068` → `#F5C44A` |

**`PODIUM`** — Podium metals — deliberately NOT WHIMSY.slopGold.

| Place | Value |
| --- | --- |
| `gold` | `#F5C44A` |
| `silver` | `#BFC4CC` |
| `bronze` | `#C68A5C` |

**Rarity —** `RARITY_BG_SOLID` is the tinted panel, `RARITY_STRIPE` the bold marker on top of it, `RARITY_BADGE` the fill/ink pair verified ≥ 4.5:1 at 11px.

| Rarity | Fill | Stripe | Badge bg / ink |
| --- | --- | --- | --- |
| `common` | `#FAF7F3` | `#cdbfae` | `#FAF7F3` / `#494f56` |
| `uncommon` | `#E8F5E0` | `#7ba868` | `#E8F5E0` / `#2e6640` |
| `rare` | `#E0EBFF` | `#5a8bc5` | `#E0EBFF` / `#2c4f7a` |
| `epic` | `#EFE9FF` | `#a89bff` | `#EFE9FF` / `#4a3a8f` |
| `legendary` | `#FFF3D0` | `#d4a437` | `#FFF3D0` / `#6b4a00` |

### Named rules

**The One Palette Rule.** All color comes from `WHIMSY` or a `UI_COLORS` role. If a value isn't a token, either use an existing token or add one — never inline a raw hex past the token layer.

**The One Accent Rule.** The terracotta `accent` (`#a03e2f`) is a kicker color, never a fill. It appears above a title as a hand-drawn line; the moment it becomes a button or a card background, it stops being the accent.

**The One Dark Surface Rule.** `bark` (with `stage`/`inkDeep` for ceremonies) is the only dark surface. A screen wrapped in black breaks the warm cream continuity.

**The Fill-Is-Not-Ink Rule.** A pastel fill token is never assigned to a text color.

## 3. Typography

Type scale — role-based text styles (June 2026 taste pass).

### Fonts

| Token | Web face | Expo family |
| --- | --- | --- |
| `FONTS.display` | Fredoka 700 | `Fredoka_700Bold` |
| `FONTS.displaySemi` | Fredoka 600 | `Fredoka_600SemiBold` |
| `FONTS.body` | Nunito 700 | `Nunito_700Bold` |
| `FONTS.bodySemi` | Nunito 600 | `Nunito_600SemiBold` |
| `FONTS.bodyExtra` | Nunito 800 | `Nunito_800ExtraBold` |
| `FONTS.bodyBlack` | Nunito 900 | `Nunito_900Black` |
| `FONTS.whimsy` | Caprasimo 400 | `Caprasimo_400Regular` |
| `FONTS.hand` | Patrick Hand 400 | `PatrickHand_400Regular` |

### Roles — 19 of them

| Role | Font | Size / line | Tracking | Job |
| --- | --- | --- | --- | --- |
| `hero` | Fredoka 700 | 44 / 48 | — | Fredoka — the one Fredoka job: the Barn tickle counter and ceremony numerals. |
| `displayLg` | Caprasimo 400 | 36 / 38 | — | Caprasimo (whimsy) — titles & numbers Ceremony headline — resolves JudgementDayModal's 36 and season.tsx's 30 into one role. |
| `display` | Caprasimo 400 | 32 / 34 | — | — |
| `pageTitle` | Caprasimo 400 | 26 / 28 | — | — |
| `sectionTitle` | Caprasimo 400 | 22 / 24 | 0.2 | — |
| `cardTitle` | Caprasimo 400 | 18 / 22 | 0.2 | — |
| `cardTitleSm` | Caprasimo 400 | 15 / 22 | 0.2 | Small card title — the sanctioned 15px Caprasimo used on gear/card/dupe/ bestiary chips (replaces the `...TYPE.cardTitle, fontSize: 15` overrides). |
| `numeralLg` | Caprasimo 400 | 26 / 28 | — | The big count readout — `Stat` size lg. |
| `numeral` | Caprasimo 400 | 16 / 20 | — | — |
| `bodyLg` | Nunito 700 | 17 / 24 | — | Nunito — reading text |
| `body` | Nunito 700 | 15 / 21 | — | — |
| `bodySm` | Nunito 700 | 13 / 18 | — | — |
| `label` | Nunito 800 | 12 / 16 | 0.3 | Nunito ExtraBold — labels (often tracked) |
| `kicker` | Patrick Hand 400 | 13 / 18 | 0.4 | PatrickHand — cozy accents / kickers / sub-text |
| `hand` | Patrick Hand 400 | 14 / 20 | — | — |
| `handLg` | Patrick Hand 400 | 17 / 24 | — | — |
| `handDisplay` | Patrick Hand 400 | 21 / 28 | — | — |
| `kickerPill` | Nunito 800 | 11 / 14 | 1.6 | Nunito ExtraBold caps — the tracked "pill" kicker |
| `kickerPillSm` | Nunito 800 | 10 / 13 | 1.6 | Smaller tracked pill kicker — the sanctioned 10px caption pill (replaces the `...TYPE.kickerPill, fontSize: 9\|10` overrides; the 9s move up to 10, a negligible visual delta that kills the sub-pixel… |

### Named rules

**The Compose-From-Roles Rule.** Text is built from `TYPE` role styles, not raw sizes. Color is intentionally *not* baked into a role — compose `{ ...TYPE.body, color: UI_COLORS.textSecondary }` so one role serves ink / mute / accent. A bare `fontSize: 15` in new code is a smell.

**The Every-Role-Has-A-Line-Height Rule.** A role without a `lineHeight` lets the platform pick, and the platform picks differently per font. All 19 roles carry one.

**The Feelings-Aren't-Numbers Rule.** Numbers are for progression — Streak, XP, tiers, prices. Anything emotional is shown: mood is a sprite.

## 4. Elevation, shape, and rhythm

Depth is drawn, not blurred. Every sticker throws a hard-edged offset shadow with **zero blur radius** — as if a paper cutout were lit by a single lamp. There are exactly two tiers and no new tier may be added.

### Shadow vocabulary

| Token | Value | Job |
| --- | --- | --- |
| `STICKER_SHADOW` | `4,4 · radius 0 · opacity 1 · elevation 4` | Cards, panels, modals — the signature paper-cutout lift. |
| `SHADOW_SM` | `2,2 · radius 0 · opacity 1 · elevation 2` | The lighter companion — buttons, chips, list rows. |

### Radius (`RADII`)

| Token | Value | Job |
| --- | --- | --- |
| `hair` | `2` | Rules, meter bars, sheet grabbers — the 2px "barely rounded" step that was being written as a bare `borderRadius: 2`. |
| `sm` | `8` | — |
| `md` | `12` | — |
| `lg` | `14` | — |
| `xl` | `18` | — |
| `xxl` | `22` | — |
| `pill` | `999` | Fully-rounded pill / capsule — the `borderRadius: 999` idiom reinvented inline across cleanse pills, corner tags, and toggles. |

### Spacing (`SPACE`)

Spacing scale (June 2026 UI audit) — use ONLY these for gaps / margins.

| Step | Value |
| --- | --- |
| `xxs` | `2` |
| `xs` | `4` |
| `sm` | `8` |
| `md` | `12` |
| `card` | `14` |
| `lg` | `16` |
| `xl` | `24` |
| `xxl` | `32` |
| `PAGE_PAD` | `18` |
| `TAB_SAFE` | `74` |
| `STATUS_SAFE` | `56` |
| `TAP_MIN` | `44` |
| `RULE_WIDTH` | `64` |

### Border widths (`BORDER`)

Four border widths, each with a job: `hair` separators, `thin` ghost/tape/tag outlines, `ink` the 2px sticker outline that IS the look, `heavy` selected or hero.

| Step | Value |
| --- | --- |
| `hair` | `1` |
| `thin` | `1.5` |
| `ink` | `2` |
| `heavy` | `3` |

### Opacity (`OPACITY`)

The opacity ladder.

| Step | Value |
| --- | --- |
| `pressed` | `0.85` |
| `muted` | `0.7` |
| `dim` | `0.55` |
| `ghost` | `0.45` |
| `rule` | `0.3` |

### Tilt (`TILT`)

One tilt vocabulary: a card leans a little, a dialog a little more, tape a lot, and a list row takes its turn from ROW_TILTS.

| Token | Value |
| --- | --- |
| `card` | `-0.6°` |
| `dialog` | `-0.8°` |
| `tape` | `-8°` |
| `row` (`ROW_TILTS`) | `-1.2 · 0.8 · -0.6 · 0.5 · -0.4 · 1 · -0.7 · 0.6` |

### Motion (`MOTION`)

Durations, in ms.

| Duration | Value |
| --- | --- |
| `tap` | `120ms` |
| `fade` | `180ms` |
| `sheetIn` | `300ms` |
| `sheetOut` | `180ms` |
| `modalHandoff` | `320ms` |
| `toast` | `2400ms` |
| `beat` | `800ms` |
| `debounce` | `250ms` |

One spring parameterization, replacing 20 springs across 14 configs.

| Spring | Damping / stiffness |
| --- | --- |
| `tap` | `14 / 220` |
| `settle` | `12 / 180` |
| `sway` | `6 / 60` |
| `overshoot` | `8 / 140` |

### Named rules

**The Two-Tiers-No-Blur Rule.** Sticker contexts use only `STICKER_SHADOW` or `SHADOW_SM`, both zero-blur, ink-colored, full-opacity. If the shadow has a blur radius, it belongs to a different app.

**The No-Arithmetic Rule.** `SPACE.xs + 1` is an off-scale value in a token's clothes. Pick the nearest step.

**The 44pt Rule.** `TAP_MIN` is 44. A control may *look* smaller (`BUTTON_SIZE.xs` is 32pt tall), but its touch frame may not be — the frame comes back as `hitSlop`.

## 5. Components

### Cards / containers

- **Signature primitive:** `Sticker` — the base of nearly every surface.
- **Corner style:** `RADII.lg` (14px) default; the scale runs 2 / 8 / 12 / 14 / 18 / 22 / 999.
- **Background:** a `WHIMSY` fill (`paper` default) chosen per sticker.
- **Border:** `BORDER.ink` (2px) ink, always.
- **Padding:** `SPACE.card` (14px) — structural to the 2px-border look.
- **Tilt:** `TILT.card` (-0.6°); list rows cycle `ROW_TILTS`.
- **Shadow:** `STICKER_SHADOW`.
- **Tape:** a narrow `Tape` strip (`sun`, `TILT.tape` = -8°) pins stickers to the page.

### Buttons

Sizes come from `BUTTON_SIZE`, not from the component:

| Size | Min height | Pad x / y | Label size | Radius |
| --- | --- | --- | --- | --- |
| `xs` | 32pt | 12 / 4 | 12px | `RADII.pill` |
| `sm` | 44pt | 14 / 10 | 13px | 22px |
| `md` | 44pt | 18 / 11 | 15px | 22px |
| `lg` | 54pt | 22 / 14 | 17px | `RADII.pill` |

- **Gradient variants** (`primary` rose, `purple`, `gold`) wear the signature 2px ink outline + `SHADOW_SM`, so they read as hand-drawn buttons rather than flat gradient pills. Label ink: `ink` on rose, `textOnDark` on purple, `goldInk` (`#5A3F00`) on gold.
- **Flat variants:** `ghost` (paper + separator outline), `success` (`successSurface`/`successText`/`successBorder`), `destructive` (`dangerSurface`/`dangerText` + ink outline), `lilac` (the soft affirmative), `dark` (ink + `textOnDark`).
- **Link variants:** `link` (underlined ink) and `handLink` (accent, hand voice) draw no chrome but keep the full 44pt frame.
- **Disabled / `locked` — "a button, asleep":** `DISABLED` = `surfaceStrong` fill + ink outline + `textDisabled` ink, and **no opacity**. You mute the fill; you never dissolve the outline.
- **Loading:** the label swaps for a hand-written working line. Never an `ActivityIndicator`.

### Headers

`PageHeader` crowns every stack screen — kicker (`KICKER_PILL`, `#605449`) + `pageTitle` + a `TITLE_RULE` (`RULE_WIDTH` 64 × 2px ink at `OPACITY.rule` 0.3) + optional `‹ back`. In-screen breaks use `SectionHeader` with `KICKER_TEXT` (`#a03e2f`) + `sectionTitle`.

### Empty & loading states

Cozy, never utilitarian: a `Sticker` with a `Glyph` (`ART_SIZE.glyph` = 40px) and a warm line (`EmptyState`), or a warm `LoadingBeat` — never a bare gray string or a naked spinner.

### Navigation

`HangingSignsTabBar` — hand-drawn hanging signs that sway (`MOTION_SPRING.sway`), riding the `WOOD` rail (`#8d5a2c` → `#74441e`). Not a flat system tab bar.

### Web

The web is a consumer of these tokens, not a second design system: `scripts/build-web-tokens.mjs` emits `web/tokens.css` (every token above as a CSS custom property) and `web/sticker.css` (one rule per primitive, tokens only). No HTML file declares its own `:root`.

## 6. Do's and Don'ts

### Do:
- **Do** reach for tokens: `WHIMSY`, `UI_COLORS`, `FONTS`, `TYPE`, `RADII` (2/8/12/14/18/22/999), `SPACE` (2/4/8/12/14/16/24/32), `BORDER` (1/1.5/2/3), `STICKER_SHADOW`/`SHADOW_SM`. `constants/theme.ts` is the single source of truth.
- **Do** put every surface on a `Sticker` — ink border, hand-drawn tilt, a hard zero-blur shadow. Cards are good here. Tilt is good here.
- **Do** compose text from `TYPE` roles with a color applied per use; keep `PAGE_PAD` (18px) on headers and scroll edges.
- **Do** show feelings as sprites; keep numbers for progression.
- **Do** make the world respond *now* — feedback inside `MOTION.tap` (120ms); server truth reconciles after.
- **Do** keep every screen cream/paper and crown every stack screen with `PageHeader`.

### Don't:
- **Don't** treat this like a SaaS dashboard — do not kill the cards, flatten the gradients, calm the motion, or default to system fonts. A borderless, perfectly-aligned, soft-shadow card is slop here.
- **Don't** inline a raw hex, font size, radius, or pad past the token layer. That governance erosion *is* the slop — not a generic look.
- **Don't** add a third shadow tier or a blurred shadow in a sticker context.
- **Don't** do arithmetic on a `SPACE` step.
- **Don't** let text color come from opacity, and never dissolve a disabled control under an opacity crush.
- **Don't** ever put an emoji character in a render — use `Glyph` or `Icon`. `★ ✦ ✧` are typography; `✓ ✕ ♥` are `Icon`/`Glyph`.
- **Don't** wrap a screen in black — `bark` (and `stage` for ceremonies) is the only dark surface.
