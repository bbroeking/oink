# Tickle the Pig — Design System v1 (2026-09-11 — all five migration waves landed)

The implementation spec behind the design canvas (`docs/design/design-system-canvas/`, published as the
"Tickle the Pig Design System" artifact). Companion to `docs/design/taste-standard.md` (the craft lens) and
`SKILL.md` (the product lens). Goal: **every UI element in TTP can be rebuilt from this document alone.**

Status legend: **shipped** = already in `constants/theme.ts` / `components/ui/` at these exact values;
**proposed** = consolidates something the 2026-09 audit found hand-rolled in three or more places.

---

## 1. Tokens (`constants/theme.ts`)

### 1.1 Color

**`WHIMSY` — the one palette (shipped).** Values are verbatim from theme.ts.

| Group | Tokens |
| --- | --- |
| Paper & ink | `paper #fffaf0` · `cream #fbeee2` · `cream2 #f6e6d4` · `ink #2a1f15` · `mute #605449` · `muteSoft #8c7e71` · `accent #a03e2f` (nudged from `#a13f30` on 2026-09-11 so it clears 4.5:1 on sage) |
| Pastels (sticker fills) | `rose #ffd6dc` · `roseDeep #f8a8b3` · `sky #c8e3f0` · `sage #c9dec1` · `sun #ffd87a` · `lilac #d6c8f0` · `lilacDeep #a89bff` · `peach #ffc8a8` |
| Bark (only dark surface) | `bark #3a2c1e` · `barkText #fff3e2` · `barkMute #e8d9c6` |
| Alignment | `angel #a89bff` · `goblin #d4a437` · `bless #C99B23` · `curseGreen #526f40` |
| Membership / effects | `slopGold #F5C44A` · `slopBand #FFE7AD` · `flame #F58F4A` |

**`WHIMSY` additions (proposed)** — each retires a leaked literal cluster or closes an audit finding:

| Token | Value | Retires / closes |
| --- | --- | --- |
| `goldInk` | `#5A3F00` | Button gold label (Button.tsx), pass-track gold text [F-02] |
| `sageInk` | `#7A9B63` | success Button border — re-pick to ≥ 3:1 on paper [F-06] |
| `muteDim` | text-safe disabled ink, ≥ 4.5:1 on paper (candidate `#6e6055`) | `muteSoft` stops being `textDisabled`; `muteSoft` becomes `UI_COLORS.uiMuted` (icons, separators, never text) [F-06, E10] |
| `curseSurface` · `blessSurface` | `#D5E4C9` · `#FFF3D0` | the pale companions of `curseGreen`/`bless` [A-11, C-11] |
| `inkDeep` | `#1a1411` | dark tab-sign / lounge shadows |
| `dirt` · `dirtDeep` | `#8d5a2c` · `#74441e` | Truffle patch mud, shovel [C-14] |
| `stage` + `EMBER_GRADIENT` | ceremony dark + ember ramp | the two dark ceremony surfaces beside `bark`, tokenized before reuse [C-23] |
| `prestige` · `tape` · `tapeEdge` | `#D9A45D` · `#EAD59E` · `#C8AD77` | `utils/pigs.ts` / Porch Round literals [B-ask] |

**Structured palettes (proposed)** — maps that today live outside `theme.ts` or as ad-hoc literals:
`RARITY_BADGE: Record<Rarity, {bg, ink}>` validated ≥ 4.5:1 at 11px, retiring `constants/hats.ts:RARITY_COLORS` [D-02] ·
`PODIUM {gold, silver, bronze}` deliberately ≠ `slopGold` [C-13] · `DIG_TILE {mud[0..2], truffle, shimmer, unique,
uniqueEdge, silhouette}` [C-14] · `PIG_ACCENT: Record<PigId, {solid, tint}>` retiring six hexes in `utils/pigs.ts`
[D-18] · `COSMETIC_ACCENT` (the ten hues in `cosmeticFx.ts`) [F-7] · `WOOD {top, bottom, frame, nail, grain}` for the
tab bar [F-6].

**`UI_COLORS` additions (proposed):** `textPlaceholder` (so `placeholderTextColor` reads a role) [E10] ·
`focus` (a focus ring color the web already had to invent as `#16729c`) [G-2] · `successBorder` [F-02].

**`UI_COLORS` — semantic roles (shipped).** Shared UI consumes roles, not WHIMSY, so meaning survives palette tuning:
`canvas`/`surface` = paper · `surfaceMuted` = cream · `surfaceStrong` = cream2 · `textPrimary` = ink · `textSecondary` = mute ·
`textDisabled` = muteSoft · `border` = ink · `separator #8c7e71` · `action` = accent · `actionSurface` = sun ·
`successText #476436` / `successSurface #e8f5e0` · `warningText #7b5a00` / `warningSurface #fff3d0` ·
`infoText #3d687f` / `infoSurface` = sky · `dangerText #983a2c` / `dangerSurface` = rose · `textOnDark` = barkText ·
`scrim rgba(40,30,20,0.55)`.

**`GRADIENT` (proposed)** — the three sanctioned button ramps, moved out of Button.tsx:
`rose ["#F0B8C8","#E8A7B9"]` · `purple ["#7052EE","#5C3FE0"]` · `gold ["#F8D068","#F5C44A"]`.

**`RARITY_GRADIENT` / `RARITY_BG_SOLID` / `RARITY_STRIPE` (shipped)** — unchanged.

**Retire:** `COLORS` (legacy ramp; 14 call sites, mostly `successText` → `UI_COLORS.successText`), `constants/Colors.ts`
(Expo template), `ThemedText`/`ThemedView`/`useThemeColor` (template leftovers; `#0a7ea4` link blue).

Rules: one palette · rust is a kicker never a fill · bark is the only dark (no `#1A1A1A`) · alignment tints stay on
alignment surfaces · a new color is a token with a dated one-line comment.

### 1.2 Typography

**`FONTS` (shipped):** `whimsy` Caprasimo 400 · `body` Nunito 700 · `bodySemi` Nunito 600 · `bodyExtra` Nunito 800 ·
`bodyBlack` Nunito 900 · `hand` PatrickHand 400 · `display` Fredoka 700 · `displaySemi` Fredoka 600.

**`TYPE` — sixteen roles (shipped).** Compose color per use: `{ ...TYPE.body, color: UI_COLORS.textSecondary }`.

| Role | Font | Size / line | Tracking | Job |
| --- | --- | --- | --- | --- |
| `display` | Caprasimo | 32 / 34 | — | Ceremony headlines |
| `pageTitle` | Caprasimo | 26 / 28 | — | `PageHeader` title |
| `sectionTitle` | Caprasimo | 22 / 24 | 0.2 | `SectionHeader` title, sheet titles |
| `cardTitle` | Caprasimo | 18 / 22 | 0.2 | Sticker titles, dialog titles |
| `cardTitleSm` | Caprasimo | 15 / 22 | 0.2 | Gear / card / bestiary chips |
| `numeral` | Caprasimo | 16 | — | Progression numbers only |
| `bodyLg` | Nunito 700 | 17 / 24 | — | Storyteller paragraphs |
| `body` | Nunito 700 | 15 / 21 | — | Default reading text, row titles |
| `bodySm` | Nunito 700 | 13 / 18 | — | Secondary text, receipts |
| `label` | Nunito 800 | 12 | 0.3 | Chips, tags, header right-slot meta |
| `kicker` | PatrickHand | 13 | 0.4 | `KICKER_TEXT` (accent) above section titles |
| `hand` | PatrickHand | 14 / 20 | — | Sub lines, `‹ back`, captions |
| `handLg` | PatrickHand | 17 / 24 | — | Empty-state warmth, intros |
| `handDisplay` | PatrickHand | 21 / 28 | — | Storybook onboarding lines |
| `kickerPill` | Nunito 800 caps | 11 | 1.6 | `KICKER_PILL` (mute) above page titles |
| `kickerPillSm` | Nunito 800 caps | 10 | 1.6 | Corner tags, stat labels |

**Proposed:** `TYPE.hero` (Fredoka 700, 44 / 48) for the Barn tickle counter — the only job Fredoka has; if it isn't
adopted, drop the Fredoka font load. `TYPE.displayLg` (Caprasimo 36 / 38) for ceremony headlines, so
`JudgementDayModal`'s 36 and `season.tsx`'s 30 resolve to one role [C-19]. `TYPE.numeralLg` (Caprasimo 26 / 28) for
the big count readouts (`Stat` size lg). **Every role gains a `lineHeight`** (`numeral`, `label`, `kicker`,
`kickerPill*` lack one today) [F-9]. No 14px Nunito role is added: the 56 bare `fontSize: 14` sites fold to `bodySm`
(13) or `hand` (14). `fontSize` is always an integer.

**Folding rule for the 521 bare sizes:** 11 → `kickerPill` · 12 → `label` · 13 → `bodySm` / `kicker` · 14 → `hand` /
`bodySm` · 15 → `body` · 16 → `numeral` / `body` · 17 → `bodyLg` / `handLg` · 18 → `cardTitle` · 20–22 → `sectionTitle` ·
24–26 → `pageTitle` · 28–32 → `display` · 36+ → `hero`. Every role scales with Dynamic Type to 200%.

### 1.3 Spacing, shape, depth

**`SPACE` (shipped + proposed):** `xxs 2` *(proposed)* · `xs 4` · `sm 8` · `md 12` · `card 14` *(proposed)* · `lg 16` ·
`xl 24` · `xxl 32` *(proposed)*. Meaning per step: xxs hairline nudges · xs gutter · sm intra-card · md card-to-card ·
card = the inner padding of a Sticker (88 uses today, structural because of the 2px ink border) · lg inter-section ·
xl loose · xxl ceremony breathing room. `PAGE_PAD 18` on every header and scroll edge; `TAB_SAFE 74` is the one scroll
bottom pad; `STATUS_SAFE` *(proposed)* is its counterpart for overlays without a SafeAreaView [A-26].
Folding for the 980 bare values: 1,2,3 → xxs/xs · 5,6,7 → sm · 9,10,11 → sm/md · 13,15 → card/lg · 18 → PAGE_PAD ·
20,22 → xl · 28 → xxl. **No arithmetic on `SPACE`** — `SPACE.xs + 1` is an off-scale value in a token's clothes
(53 sites) [C-18, B-18].

**`TAP_MIN 44` (proposed):** the minimum interactive frame. `Button size="xs"` keeps a small visual height inside a
44pt frame (the `IconButton` visual/frame split, generalised) [C-04, D-05, E4].

**`RADII` (shipped + one proposed):** `hair 2` *(proposed; rules, bars, grabbers)* · `sm 8` (tags, wells) · `md 12` (rows,
chips, fields) · `lg 14` (Sticker default) · `xl 18` (sheets, dialogs) · `xxl 22` (buttons sm/md) · `pill 999`.
Folding for the 169 bare radii: 10 → md · 16 → xl · 20 → xxl · 27 → pill.

**`BORDER` (proposed):** `hair 1` (separator) · `thin 1.5` (ghost, tape, tags) · `ink 2` (the sticker outline) ·
`heavy 3` (selected / hero). Folds the 2.5 (10 sites) into ink or heavy.

**Shadows (shipped, exactly two):** `STICKER_SHADOW` (ink, 4/4, radius 0, opacity 1, elevation 4) for cards, panels,
modals; `SHADOW_SM` (ink, 2/2, radius 0, elevation 2) for buttons, chips, rows. The last soft shadow (`TierUpBanner`,
radius 16) migrates to `STICKER_SHADOW`.

**`OPACITY` (proposed):** `pressed .85` · `muted .7` · `dim .55` · `ghost .45` · `rule .3`. Replaces the 0.45–0.9
ladder and the five different "pressed" values inside the primitives [F-05]. **Text colour never comes from opacity**
[E4]. **Disabled controls never use opacity.**

**`PRESSED` / `DISABLED` style tokens (proposed):** `PRESSED` = translate by the shadow offset and collapse the shadow
(the `BarnUpdatesTray` DNA press) for anything wearing a hard shadow, `OPACITY.pressed` for flat controls;
`DISABLED` = `surfaceStrong` fill · `border` ink · `muteDim` text · no opacity — the 2026-07-07 "button, asleep"
ruling as something you spread, not remember [C-01, C-07, B-08, A-15]. `Button`'s default disabled becomes this
(delete the `variant !== "locked"` carve-out).

**`TINT` (proposed):** names the 41 `rgba(` literals, all derived from `WHIMSY.ink` via an `inkAlpha(a)` helper:
`scrim` (.55 — corrects `UI_COLORS.scrim`, which today uses `rgba(40,30,20)` where ink is `#2a1f15`) [C-12] ·
`inkWash` (.08) · `well` (.12) · `paperWash rgba(255,250,240,.7)` · `sunGlow rgba(255,216,122,.5)` · `angel` / `goblin`
/ `miasma` washes [F-3].

**`MOTION` (proposed):** `tap 120` · `fade 180` · `sheetIn 300` / `sheetOut 180` (easeOutCubic) · `modalHandoff 320`
(the iOS nested-modal gap repeated verbatim three times in `UserSheet`) · `toast 2400` · `debounce 250`.
**`MOTION_SPRING` (proposed):** one parameterization — `tap { damping 14, stiffness 220 }` · `settle { 12, 180 }` ·
`sway { 6, 60 }` · `overshoot { 8, 140 }` — replacing 20 springs across 14 configs [F-08]. Springy, overshooting; a
linear fade is never the default. Every decorative loop has a rest pose under Reduce Motion, and **a file that
imports `Animated` imports `useMotionPolicy`** [A-07, C-08, F-09].

**`TILT` (proposed):** `card −0.6` · `dialog −0.8` · `tape −8` · `row: ROW_TILTS` — one tilt vocabulary [F-8].
**`RULE_WIDTH 64`** replaces the hand-tuned `ruleWidth` per string [B-17].

**`ROW_TILTS`, `TITLE_RULE`, `KICKER_TEXT`, `KICKER_PILL`, `MODAL_BACKDROP_BG` (shipped):** unchanged.

---

## 2. Components (`components/ui/`)

Fourteen primitives. A screen is a composition of these and nothing else.

| # | Primitive | Status | Variants | States | Notes |
| --- | --- | --- | --- | --- | --- |
| 01 | `Sticker` · `Tape` | shipped (wave 2: `onPress`, `title`/`right`/`footer` slots, `pad`, `shadow="sm"`) | color (12 named fills) · shadow `sticker \| sm \| none` · rotate · radius · pad | pressed (`PRESSED`) · disabled (`DISABLED`) | Default radius `RADII.lg`, border `BORDER.ink`, tilt `TILT.card`; one Tape per sticker |
| 02 | `Button` | shipped | primary · purple · gold · dark · ghost · locked · success × sm/md/lg · full · icon | default · pressed · disabled(locked look) · loading *(proposed: label swap "★ working ★")* | SIZE_MAP → `BUTTON_SIZE` tokens; gradient stops → `GRADIENT`; `#5A3F00` → `goldInk` |
| 02 | `IconButton` | shipped | paper · dark · none | pressed · disabled · selected | 44pt hit, 40 visual, label required |
| 02 | `TicketButton` | shipped | tone sun · rose · sage | — | HUD ticket counter |
| 03 | `PageHeader` | shipped (wave 2: `variant` stack · tab · plaque, `subtitle`) | kicker · right · below · onBack · variant | — | The crown on every screen; page kicker = `KickerPill`, section kicker = `Kicker`; title is `pageTitle` in every variant |
| 03 | `SectionHeader` | shipped | kicker · right | — | Right slot = `TYPE.label` mute or sm ghost Button; internal 12/4/8/10 literals → SPACE |
| 04 | `EmptyState` | shipped | glyph · color · rotate | — | Internal 14/12/18/20/10/4 literals → SPACE/RADII |
| 04 | `LoadingBeat` · `Skeleton` | shipped | label | busy | progressbar role |
| 05 | `Sheet` (panel) | shipped (wave 2) | tone paper · cream | — | `SlideUpSheet` chrome + standard paper panel: grabber 44×4 (`RADII.hair`), `RADII.xl` top corners, `PAGE_PAD`, `sectionTitle` + `DialogCloseRow`, hand sub line, `TAB_SAFE` bottom. Retires the 7 hand-rolled panels |
| 05 | `Dialog` = `AdaptiveModalScaffold` + `ConfirmDialog` | shipped | destructive · confirmCoin | busy | Every spend / destructive / irreversible action. `Alert.alert` only for OS-level errors |
| 05 | `Ceremony` | convention (no component) | — | — | Full-screen paper with art; enters via `PopupQueue` at a declared priority; never stacks |
| 06 | `ListRow` | shipped (wave 2) | leading Avatar/Glyph · trailing tag/numeral/chevron/Button sm | default · pressed · selected (`BORDER.heavy`) · muted (cream2 + mute, "trotted on") · loading | Retires rows in Leaderboard, Friends, Inbox, CrewRow, race-standings |
| 06 | `Avatar` | shipped (wave 2) | size 32 · 40 · 56 · fill | — | Pig portrait or Glyph in a pill with ink border |
| 07 | `Chip` (selectable) · `Tag` (read-only) · `Ribbon` (corner) · `Toast` | shipped (wave 2) | tone paper · sun · rose · sage · lilac · bark | selected (`BORDER.heavy`) · disabled | `TYPE.label`, `BORDER.thin`, `RADII.pill`, `SHADOW_SM`; Toast generalises `PurchaseToast` (2.4 s, one at a time) |
| 08 | `SegmentedControl` | shipped | icon | selected | radiogroup, 44pt |
| 08 | `TextField` | shipped (wave 2) | label · helper | default · focus (`BORDER.heavy`) · valid (success + check) · error (danger fill/border + hand message) | Retires fields in UsernameSetup, ReferralCodeEntry, scan-code, guestbook |
| 09 | `Stat` · `ProgressTrack` (= Meter) · `Divider` / `TitleRule` | shipped (wave 2) | Stat lg/md · Meter tone sage/sun/rose/lilac | — | Numeral over `kickerPillSm`; 16px capsule meter; hair divider in barkMute |
| 10 | `Glyph` · `Icon` | shipped | 54 glyphs · ~40 icons | — | Icon.tsx: retire MaterialCommunityIcons/Feather imports, 36 raw hex → UI_COLORS |
| 10 | `PigStage` family | shipped | sprite/Rive/raster behind one contract | idle/frozen | Living surfaces sync anchors; product shots freeze at rest |
| 10 | `HangingSignsTabBar` | shipped | — | active (sway) | The navigation signature |
| — | `Text` (`T` + named roles) | shipped (wave 2) | `role` (TYPE key) · `tone` primary/secondary/disabled/accent/onDark | — | `<T role="body" tone="secondary">`; the migration lever for 133 raw `<Text>` files; `Kicker`/`KickerPill` own the `★ ` prefix |
| 06 | `NavRow` | shipped (wave 2, `ListRow` preset) | icon bubble · label · sub · badge · chevron | pressed | `Account.tsx` has three geometries for this row [E18, E25] |
| 05 | `DialogButtonRow` · `ActionSheet` | shipped (wave 0/2) | confirm/cancel · N destination rows + cancel | busy | Four copies of the button row exist; "pick where to go" never reaches for `Alert` again [E5, E12, E14] |
| — | `EffectCard` | shipped (wave 2) | `size` chip · row · detail | countdown | One drawing for the blessing/curse concept that three components draw three ways [A-10] |
| 09 | `ProgressTrack` | shipped (wave 2) | `{value, max, tone, height?}` | — | `progressbar` role + `accessibilityValue` built in; three hand-rolled bars today [D-13] |
| — | `SpendReassurance` | **proposed** | cost now · balance after | — | Rendered above every spend CTA; *a control that spends states its cost on its own face* [D-09] |

**Variant additions to shipped primitives (landed in wave 2 unless noted):** `Button` gains `link` (tertiary underlined text at a 44pt
target; five ad-hoc versions exist) [D-08], `xs` (44pt frame, small visual) [C-04], `loading` (label swap, no spinner)
and `destructive` (promoted from `ConfirmDialog`) [F-22]. `SegmentedControl` gains `icon-over-label` for hub nav and
per-option `disabled` / `badge` [B-06, C-05]. `PageHeader` gains `variant="tab"` (no back, used by all five tabs — none
use it today) and `variant="plaque"` (the Dig-Off's Sticker-title crown) [E7, C-10]. `Sticker` gains `onPress` (a
`Pressable` with the shadow-collapse press and a11y forwarding — one change, 58 files), `shadow="sm"`, and `title` /
`right` / `footer` slots [F-15, F-16]. `EmptyState` gains `kind: "empty" | "error"` with a `retry` action slot, and
`LoadingBeat`'s `label` becomes required [B-02, D-20]. `ConfirmDialog` is rebuilt as `AdaptiveModalScaffold` + `Sticker`
+ `DialogButtonRow` and gains `tone: "warm" | "destructive"` and the four a11y props [E5, F-03, B-03]. `Spotlight`'s
`onDismiss` becomes required and it gains `accessibilityViewIsModal` [A-09]. `Icon` gains `chevronRight` / `chevronLeft`
/ `arrowLeft` / `gear` / `more` / `undo` / `save` / `alert`; `Glyph` gains `cloud` and the six Inbox event kinds
[E18, D-25, A-04, B-11]. `showPurchaseToast` becomes `Toast` with `success` / `error` / `info` tones [E8].

**Primitive API contract (proposed, goes in the taste standard):** `open` / `onClose` for anything that presents;
`label` is the visible text; `variant` is the only semantic axis; `size` is `xs | sm | md | lg`; every primitive takes
`style?: StyleProp<ViewStyle>` and forwards `testID` + the four `accessibility*` props; interactive primitives require
`onPress` and a label. `components/ui/index.tsx` exports everything and is the only sanctioned import path (140 symbols from 56 modules since wave 2) [F-12, F-25]. **`Glyph` = subject matter, `Icon` = interface affordance**; the 16 duplicate names are
deleted [F-10].

---

## 3. Rules

1. **Composition law.** PageBackground → PageHeader → sections (SectionHeader + Stickers / ListRows / Grid) → at most one
   primary Button. Modals are Sheet, Dialog, or Ceremony. Nothing else exists; the system grows first, the screen uses it second.
2. **Token law.** No literal styling values in screens or components. Primitives are the only place a token becomes a pixel.
   A missing token is added to theme.ts with a dated comment; a raw literal that survives an audit carries the comment
   explaining why (`BarnOverlay:85` is the model). `shadowOffset` / `shadowRadius` may not be written outside theme.ts.
   No local aliases for theme tokens.

   **Lint rules (proposed, `eslint-plugin-ttp`):**
   - `no-raw-style-literal` — raw hex, `rgba(`, bare `fontSize` / `borderRadius` / `borderWidth` / padding / margin /
     gap / `opacity` outside `constants/theme.ts` and `components/ui/`; warn first, error per file as it migrates.
   - `no-alert` — `Alert.alert` outside `components/dev/**` [X-1].
   - `no-emoji-render` — codepoints U+1F300–U+1FAFF / U+2600–U+27BF in JSX text, with `★ ✦ · ✧` allowed [X-2].
   - `no-raw-vector-icons` — `@expo/vector-icons` imports outside `components/ui/Icon.tsx` [A-04, F-11].
   - `no-raw-modal` — `<Modal` outside `components/ui/` without an `// eslint-disable` carrying a written exception [X-4].
   - `no-activity-indicator` — under `app/` and `components/` [B-14, A-02].
   - `pressable-needs-a11y` — `Pressable` without `accessibilityRole` + `accessibilityLabel` [X-5].
   - `animated-needs-motion-policy` — a file importing `Animated` must import `useMotionPolicy` [X-11].
   - `no-space-arithmetic` — `SPACE.x ± n` [C-18].
   - `no-legacy-palette` — imports of `@/constants/Colors`, `COLORS`, `ThemedText` [E8].
   - CI literals guard: `__tests__/colorSystem.test.ts` extended to all 12 fills + non-text pairs ≥ 3:1, and a test that
     fails on a numeric literal in a `components/ui/*` default parameter or `StyleSheet` [F-28, F-29].
3. **State law.** Pressed = `OPACITY.pressed` or a 1px translate toward the shadow. Disabled = full chrome kept, muted fill,
   never an opacity crush. Selected = `BORDER.heavy`, never color alone. Loading = LoadingBeat / Skeleton / label swap, never
   ActivityIndicator. Empty = EmptyState with a Glyph. Error = danger pair + a hand line saying what to do. Success = success
   pair + Icon check, Toast if the effect is elsewhere. Gated = Ribbon, content at full contrast.
4. **Behaviour law.** Feedback inside `MOTION.tap`; server truth reconciles after. Modals never stack; launch-time surfaces
   enter via PopupQueue. **Refusals are toasts · decisions are ConfirmDialog · Alert is for nothing.** Any action that
   cannot be undone by the same control (spend, leave, crown, rename, sign out, purchase) renders through ConfirmDialog
   with the concrete number on the confirm label; arm-then-confirm is for reversible toggles only. A control that spends
   states its cost on its own face and in its accessibility label. `onRequestClose` is never an empty function; every
   modal has a visible dismiss. A component named `*Sheet` mounts `SlideUpSheet`; `*Modal` mounts
   `AdaptiveModalScaffold`; every dialog wears `DialogCloseRow`. **A null fetch is not an empty state:** `null` =
   unknown → error/retry, `[]` = empty → `EmptyState`. A transient overlay carrying news announces it. Feelings are
   sprites, progression is numerals. At most one surface per screen wears the full sun highlight (the "one hero" rule).
5. **Accessibility law.** Every tappable ≥ 44pt (or hitSlop) with role + label (+ state). AA text pairs: ink/mute on every
   pastel; accent only on paper/cream/rose; barkText on bark; goldInk on gold; muteSoft never body text. Type scales to 200%.
   Icon/Glyph carry a label or are decorative. Emoji never render.
6. **Naming law.** Technical names in code, cozy names on screen; one concept, one name. Kickers lowercase hand or
   uppercase pill; buttons sentence-case verbs. ★ ✦ · are typography; ✓ ✕ ♥ are Icon/Glyph. Variants named by tone or job.
7. **Web parity law.** *The web is a consumer of theme.ts, not a second design system.* `scripts/build-web-tokens.mjs`
   emits `web/tokens.css` from theme.ts (ink/paper, fills, semantic roles, rarity, fonts, one `font` shorthand custom
   property per `TYPE` role, radius, space, the two shadows, tilts); `web/sticker.css` holds one rule per primitive
   (`.sticker`, `.btn` + variants with `min-height:44px` and an outline-keeping disabled state, `.section-header`,
   `.page-header`, `.empty-state`, `.kicker`, `.chip`, `.field`, `.segmented`, `.toast`, the `:focus-visible` ring, the
   `prefers-reduced-motion` block); `web/glyph.svg` is the shared sprite (decorative → `aria-hidden`, meaningful →
   `role="img"` + `<title>`); `web/tickle.js` is the shared interaction module. No HTML file declares its own `:root`;
   pastel fill tokens are never assigned to `color:`; `npm run lint:web` greps for raw hex, bare `font-size`, off-tier
   `box-shadow`, and emoji [G-1…G-7].

---

## 4. Migration plan

| Wave | Lands | Exit criterion |
| --- | --- | --- |
| 0 · Stop the bleeding — **landed 2026-09-11** | Fix the six P0s: nine `Alert.alert` files → `ConfirmDialog`/Toast; two rendered emoji → `Glyph`; land `no-alert`, `no-emoji-render`, `no-raw-vector-icons` lint as **error** (2–3 offenders each — the cheapest moment to close the door) | Zero P0s; three lint rules green |
| 1 · Tokens — **landed 2026-09-11** | BORDER, OPACITY, TINT (+ scrim fix), PRESSED/DISABLED, MOTION + MOTION_SPRING, TILT, TAP_MIN, SPACE.xxs/card/xxl, RADII.hair, GRADIENT, TYPE.displayLg/numeralLg + lineHeights, the palette extensions and structured maps, `muteDim`/`textPlaceholder`/`focus`; fold COLORS; delete Colors.ts/ThemedText/useThemeColor; regenerate DESIGN.md; remaining lint in warn mode; `colorSystem.test.ts` extended | theme.ts is the only file with a literal styling value besides components/ui; the contrast test covers all 12 fills |
| 2 · Primitives — **landed 2026-09-11** | Text roles, Sheet, ListRow/NavRow, Avatar, Chip/Tag/Ribbon/Toast, TextField, ProgressTrack, Stat, Divider, EffectCard, DialogButtonRow, ActionSheet, SpendReassurance; the variant additions above; Button/Sticker/EmptyState/SectionHeader/ConfirmDialog/TierUpBanner lose internal literals; barrel exports everything; the API contract | Every primitive on the Components artboard exists with the listed variants and states; a11y props are required by type on every interactive primitive |
| 3 · Tabs — **landed 2026-09-11 (A, B, C, D, E; 201/201 files at zero)** | Barn, Friends, Season, Shop, Me rebuilt file-by-file (Account.tsx first — the largest leak); all five tabs on `PageHeader variant="tab"`; 33 raw Modal mounts classified into Sheet/Dialog/Ceremony; Habitat and Mote Machine rebuilt from primitives | Lint = error on all five tab files and their direct components; no design-specificity FAIL remains |
| 4 · Polish — **landed 2026-09-11** | Taste rules become the default error level for app/ + components/ (per-area overrides collapse); `Toggle` and `PageDots` primitives; `Chip` `sub`/`badge`; graduate `SunPill`/`HandLink`/`CrewRow`/`CrewPortrait` into `components/ui`; `hero` prop on `HungerHero`/`SounderHomeCard`/`SounderStepCard` so the one-hero rule holds across the Season scroll; rename `BlockedUsersModal` → `BlockedUsersSheet`; `PigRosterPicker` retry via `usePigRoster`; re-pick `PIG_ACCENT` solids that fail 3:1; inert portrait rows (B-16); route decisions (B-15 `/sounder` collision, `lounge` Redirect); `DESIGN.md` regenerated from theme.ts | Lint = error repo-wide with no per-area overrides; every wave-3 "recorded" item closed or ruled |
| 5 · Web — **landed 2026-09-11** | generators landed (wave 4); landing family, legal/report/redeem, adventures and the analytics dashboard move onto `tokens.css` + `sticker.css`; shared `glyph.svg` + `tickle.js`; Archivo retired; contrast and focus findings G-01…G-10 closed | No `:root` declared in any HTML file; no hex literal outside the generated CSS; `lint:web` green |

---

## 5. Asks declined, and open questions

**Declined system asks (with reason)** — the scale stays small on purpose:

- `TYPE.labelLg` (13/17), `TYPE.profileName` (24/27), `TYPE.cardTitleXs` (17), `TYPE.labelSm` (11): fold to `bodySm` /
  `label`, `pageTitle`, `cardTitle`, `kickerPill`. Sixteen roles plus `hero`/`displayLg`/`numeralLg` is the ceiling.
- `SPACE` half-steps 6 and 10: fold to `sm` / `md`. Only `card 14` is admitted, because it is structural.
- `BORDER 2.5`: fold to `ink` or `heavy`. Four widths, each with a job.
- `RADII 16`: fold to `xl`. `RADII.pillLg 27`: the lg Button uses `pill`.
- Extra named shadow tiers (`TICKET_SHADOW`, `SIGN_SHADOW`, `RAIL_SHADOW`): the taste standard says two tiers; the
  ticket and sign shadows migrate to `SHADOW_SM` / `STICKER_SHADOW` and the rail loses its blur. If the tab bar's wood
  needs depth, `WOOD` carries it as a fill, not a shadow.

**Decisions (2026-09-11, founder delegated all but #5; #5 is the founder's call):**

1. **Fredoka stays, with one job.** `TYPE.hero` (Fredoka 700, 44 / 48) is the Barn tickle counter and ceremony
   numerals. Fredoka is already used at 16 sites across Shop, Friends, race-standings, `CrewRow`, `SounderCard` — those
   fold into `hero` or `display` in wave 3; any that don't fit either role move to Caprasimo.
2. **One accent, restricted by rule, no second token.** `WHIMSY.accent` text sits only on the seven text-safe fills
   `ACCENT_SAFE_FILLS` = `paper`, `cream`, `cream2`, `rose`, `sky`, `sage`, `sun` (the accent measured 4.497:1 on sage,
   so it was nudged `#a13f30` → `#a03e2f`; worst case is now 4.56). On `lilac`, `peach`, `roseDeep`, `lilacDeep`,
   `slopGold`, `goblin` the kicker is `ink`. `textDisabled` (`muteDim`) follows the same list. The contrast test
   enforces it; a kicker on a forbidden fill fails CI.
3. **`SPACE.card 14` is sanctioned.** It is the inner padding of a Sticker and structural to the 2px-border look.
4. **Habitat is rebuilt on the primitives (wave 3).** Its VoiceOver labelling is kept verbatim as the a11y reference
   for the rest of the app. No "interior lane".
5. **The Mote Machine is hidden now** (`MOTE_MACHINE_VISIBLE = false`, wave 0) until `MoteWageringScreen` is rebuilt
   from the primitives. Motes keep accruing server-side; the flag comment records the audit finding.
6. **`DESIGN.md` is demoted now** with a "historical export" header pointing at this spec, and regenerated from
   `theme.ts` by the same generator that emits `web/tokens.css` in wave 5.
7. **Wave 0 starts immediately.**

**Recorded during wave 1 (2026-09-11):** all five `RARITY_STRIPE` markers fail 3:1 against their own `RARITY_BG_SOLID`
(1.69–2.95). The shop dot is fine (its 2px ink border carries the boundary); the Closet's borderless 4px stripe is the
real gap and is fixed in wave 3 by giving the stripe an ink edge, not by re-hueing five brand markers. The contrast
test records the current pairs so any drift fails CI. `mute` on `lilacDeep` is 3.07:1 — `lilacDeep` is a chip/badge
fill, never a body-text surface; the test floors it at 3.0.
