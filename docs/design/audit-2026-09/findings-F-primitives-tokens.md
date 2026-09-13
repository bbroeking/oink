# Findings — Area F: the design system itself (primitives + tokens)

Auditor F · 2026-09-11 · audited from source, no app run.
Scope: `constants/theme.ts`, `constants/Colors.ts`, `DESIGN.md`, `docs/design/taste-standard.md`,
every file in `components/ui/` (45 files, 7,460 lines), `constants/cosmeticFx.ts`,
`constants/animatedBackgrounds.ts`, `hooks/useMotionPolicy.tsx`.

---

## 1. Area summary

The token layer is genuinely good and unusually well-reasoned for a solo project: `WHIMSY` carries
comment-documented provenance for every color added since June ("five files hand-mixed this pair
off-palette… tokenized once"), `UI_COLORS` is a real semantic layer over it, `TYPE` is a role scale
extracted from shipped values rather than invented, and `__tests__/colorSystem.test.ts` already
guards AA contrast for the core text/surface pairs — a governance mechanism most design systems
never build. The primitives that were designed as primitives (`PageHeader`, `AdaptiveModalScaffold`,
`SegmentedControl`, `IconButton`, `DialogCloseRow`) are close to exemplary: 44pt targets, safe-area
math, explicit `accessibilityState`, and comments that record *why*.

The single biggest systemic gap is that **the design system stops at the token file and never
reaches the interaction layer**. The app mounts 357 `Pressable`/`TouchableOpacity` across 104 files
but only 95 `<Button>` and 3 `<IconButton>`; 28 non-`ui` files hand-roll a raw `<Modal>`; there is no
`Chip`, no `ListRow`, no `Toast`, no `Card` header slot, no text component per `TYPE` role. Every one
of those 262 hand-rolled pressables is a place where a designer's decision had to be re-typed as
literals — which is exactly where the 980 bare spacings, 169 bare radii and 521 bare `fontSize`s in
the baseline come from. The debt is not that screens ignore the tokens; it is that **the system never
gave them a component to put the tokens inside.**

Second-order: the governance leaks now live *inside* the primitives themselves — `Sticker`'s
`radius = 14` (the literal `RADII.lg` is meant to name), `Button`'s five raw hexes and `SIZE_MAP`,
`TierUpBanner`'s blurred `#000` shadow, `Icon`'s `#1A1A1A` default. A leak at the root propagates to
all 58 `Sticker` call sites at once.

Counts: **13 P1 · 16 P2 · 7 P3 · 0 P0.**

---

## 2. Inventory — primitives, props, variants, states

`uses` = distinct non-`components/ui` files that mount the component.

| Primitive | File | Key props | Variants | States covered | Missing states / notes |
| --- | --- | --- | --- | --- | --- |
| `Sticker` | Sticker.tsx | `color` `rotate` `radius` `border` `shadow` `style` | 12 color tokens + raw string | default only | 58 uses. No `onPress`; no pressed/disabled/selected. Callers wrap in their own `Pressable`. |
| `Tape` | Sticker.tsx | `color` `rotate` `width` `height` `style` | 12 colors | default | 9 uses. `borderWidth: 1.5` + `opacity: 0.85` hard-coded. |
| `Button` | Button.tsx | `variant` `size` `icon` `full` `style` `onPress` `onLongPress` `disabled` + a11y | 7 (`primary` `purple` `gold` `dark` `ghost` `locked` `success`) × 3 sizes | default, pressed (0.85), disabled (0.5), locked | 34 uses / 95 mounts. No `loading` state (callers hand-roll). No selected. `style?: ViewStyle` (not `StyleProp`). |
| `TicketButton` | TicketButton.tsx | `label` `stub` `stubCaption` `tone` `showChevron` `loading` `loadingLabel` `disabled` `full` | 3 tones | default, pressed (3px offset), disabled, **loading** | 3 uses. Loading = naked `ActivityIndicator`. Own shadow tier. |
| `IconButton` | IconButton.tsx | `name` `label` `onPress` `variant` `iconSize` `visualSize` `color` `strokeWidth` `disabled` `selected` | 3 (`none` `paper` `dark`) | default, pressed/disabled (0.64), selected (a11y only) | 3 uses. `selected` is announced but has **no visual treatment**. |
| `SectionHeader` | SectionHeader.tsx | `kicker` `title` `right` `ruleWidth` `style` | — | default | 14 uses. |
| `PageHeader` | PageHeader.tsx | `kicker` `title` `right` `below` `onBack` `ruleWidth` `style` | — | default | 10 uses. Best-governed primitive in the folder. |
| `EmptyState` | EmptyState.tsx | `glyph` `title` `sub` `color` `rotate` `style` | — | empty | 13 uses. No `action` slot (an empty state that can't offer the fix). |
| `LoadingBeat` | EmptyState.tsx | `label` `glyph`(dead) `style` | — | loading | 26 uses. `glyph` declared, never read. |
| `Skeleton` / `ListRowSkeleton` | Skeleton.tsx | `width` `height` `radius` `style` | — | loading | **1 use each.** Effectively dead. |
| `SlideUpSheet` / `SheetGrabber` | SlideUpSheet.tsx | `open` `onClose` `duration` `modalVisible` `backdropLabel` `overlay` | — | open/closed | 6 uses. Owns only the chrome; the *panel* is re-rolled per caller. No Reduce Motion path. |
| `AdaptiveModalScaffold` | AdaptiveModalScaffold.tsx | `visible` `onRequestClose` `maxWidth` `animationType` `keyboardAware` `showCloseButton` `closeLabel` `bare` `frameStyle` `contentContainerStyle` `scrollViewProps` `presentation` | `native` / `inline`, `bare` / paper | open/closed | 11 uses. Strongest a11y/safe-area work in the codebase. |
| `DialogCloseRow` | DialogCloseRow.tsx | `onPress` `label` `style` | — | default | 2 direct uses (+ scaffold). |
| `ConfirmDialog` | ConfirmDialog.tsx | `open` `visible` `title` `body` `confirmLabel` `confirmCoin` `cancelLabel` `destructive` `onConfirm` `onCancel` `busy` | default / `destructive` | default, pressed, busy | 4 uses. Buttons are **hand-rolled, not `Button`**, and carry **no a11y props**. |
| `SegmentedControl` | SegmentedControl.tsx | `options` `value` `onChange` `label` `style` | — | default, pressed (0.72), selected | **1 use.** |
| `Glyph` / `IconText` / `glyphSource` | Glyph.tsx | `name`(50) `size` `style` | 50 raster glyphs | static | 43 uses. |
| `Icon` | Icon.tsx | `name`(45) `size` `color` `filled` `strokeWidth` `style` | 31 hand-SVG + 14 delegated to MCI/Feather | static, `filled` | 31 uses. Three drawing systems in one primitive. |
| `PigStage` | PigStage.tsx | `pigId` `pigAnimation` `pigMood` `pigReaction` `active` `pigFrameIdx` `onPigFrame` `equipped` … | 6 pigs × 9 animations × 4 moods | idle/reaction/frozen | 9 uses. `EquippedItem.emoji` field name (see F-30). |
| `PigRenderer` / `SpritePig` / `RasterPig` / `RivePig*` / `WaitingRosie` / `PigPortrait` / `PigAvatar` / `PrestigeAvatar` | 8 files | `size` `hatId` `bowId` `border` `prestigeLevel` `showRank` | raster / sprite / rive | active/frozen | Four overlapping "show a pig" entry points; `PigAvatar` has 0 direct uses (only via `PrestigeAvatar`). |
| `AlignmentBadge` | AlignmentBadge.tsx | `score` `label` `size`(sm/md/lg) `compact` | 3 alignments × 3 sizes | static | **1 use.** No `style` prop. |
| `AlignmentBar` | AlignmentBar.tsx | `score` `label` `size`(md/lg) | 2 sizes | static | 2 uses. No `style` prop. |
| `AlignmentEmblem` | AlignmentEmblem.tsx | `kind` `size` `style` | 3 (`halo` `scales` `horns`) | static | 2 uses. |
| `SnoutCoin` | SnoutCoin.tsx | `size` | — | static | 17 uses. Also re-exports `TickleIcon` as a compat shim. |
| `TickleIcon` | TickleIcon.tsx | `size` | — | static | 3 uses. 6 raw hexes. |
| `Shovel` | Shovel.tsx | `size` | — | static | 1 use. 3 raw hexes. |
| `TierUpBanner` | TierUpBanner.tsx | imperative `fire(tier)` | — | fires / reduce-motion fallback | 2 uses. **The app's only blurred shadow.** |
| `BuyCelebration` | BuyCelebration.tsx | imperative `fire({x,y,tier})` | `common` / `premium` | fires | 1 use. **No Reduce Motion path.** |
| `PopupQueue` (+5 hooks) | PopupQueue.tsx | `usePopupSlot` `usePopupHold` `useUnmanagedModalHold` `usePopupActive` | — | queued/visible/teardown | 12 files import. Infrastructure, not visual. |
| `Spotlight` (+provider) | Spotlight.tsx | target registry, `onTargetPress` | — | shown/hidden | Provider-mounted. Pressable with no `accessibilityRole`. |
| `HangingSignsTabBar` | HangingSignsTabBar.tsx | tab-bar render props | 5 tabs | focused, badge count | 1 use. Two off-token shadow tiers, 4 `rgba`, 7 raw hexes. |
| `PageBackground` / `AnimatedBackground` | 2 files | `bgId` / `frames` `frameMs` `resizeMode` | static / animated | motion-policy-aware | 3 uses. |
| `BarnOverlay` | BarnOverlay.tsx | `alignment` `cursed` | 3 alignments × cursed | static | 1 use. 4 raw `rgba`. |
| `AnimatedCosmetic` | AnimatedCosmetic.tsx | `source` `fx` `size` `style` | per-item `CosmeticFx` | motion-policy-aware | 1 use. |
| `ProfileIdentity` | ProfileIdentity.tsx | `username` `title` `discriminator` `suffix` `variant`(row/hero/profile) `align` `nameStyle` `titleStyle` | 3 | static | 6 uses. |
| `RitualIconWell` | RitualIconWell.tsx | `icon` `blessed` `size` `fillRatio` `badge` | boolean `blessed` | static | 5 uses. No `style` prop. Renders `☁` as raw `Text`. |

**Missing from the inventory entirely** (no primitive exists): pill/chip/tag, list row, toast/snackbar,
card header slot, stat/numeral readout, progress bar, text-per-role, tooltip, input/text field,
switch/checkbox, avatar-with-name row, price tag, tab-within-page.

---

## 3. Findings

### [P1] F-01 · `Sticker` hard-codes `radius = 14` — the radius leak at the root
**Location** `components/ui/Sticker.tsx:50` (`radius = 14`), `:51` (`border = 2`), `:115` (`borderWidth: 1.5`), `:117` (`opacity: 0.85`)
**Prompt(s)** P3 (layout), P4 (token triage)
**Evidence**
```ts
export function Sticker({ color = "paper", rotate = -0.6, radius = 14, border = 2, shadow = true, style })
```
**Expected standard** `constants/theme.ts:169` `RADII.lg: 14`; taste-standard rule 1 ("never inline a raw hex / size / radius / pad"); `DESIGN.md:201` "14px radius default (`RADII.lg`)".
**Gap** The one component whose job is to *be* the radius decision states it as a literal. `Sticker.tsx` does not import `RADII` at all. This is the source of the baseline's 34 `borderRadius: 14` / `radius={14}` sites across `app/`+`components/` — call sites copied the literal because the primitive models it as a literal.
**Recommendation** `radius = RADII.lg`, `border = BORDER.ink`, `Tape.borderWidth = BORDER.thin`, `Tape.opacity = OPACITY.tape`. Import `RADII` in `Sticker.tsx`. Then add a lint rule: no numeric literal may appear in a `components/ui/*` default parameter.
**Pillar** Craft/governance — the sticker language is the app's identity; its constants must be named.

---

### [P1] F-02 · `Button` carries 12 raw literals including 5 hexes and a whole size scale
**Location** `components/ui/Button.tsx:44-46` (`SIZE_MAP`), `:50-54` (`GRADIENT_VARIANTS`), `:78` (`border: "#7A9B63"`), `:85` (`gold: "#5A3F00"`), `:119-120`, `:141`, `:157`, `:186`, `:191`
**Prompt(s)** P2, P3 (button usability), P4
**Evidence**
```ts
sm: { minH: 44, px: 14, py: 10, fs: 13, br: 22 },
md: { minH: 44, px: 18, py: 11, fs: 15, br: 22 },
lg: { minH: 54, px: 22, py: 14, fs: 17, br: 27 },
primary: ["#F0B8C8", "#E8A7B9"],  purple: ["#7052EE", COLORS.purpleDeep],  gold: ["#F8D068", "#F5C44A"],
gold: "#5A3F00",   // TEXT_COLORS
success: { …, border: "#7A9B63" },
```
**Expected standard** `WHIMSY` is the one palette (`taste-standard.md` "One palette"); `TYPE` roles carry font size; `RADII` carries radius; `SPACE` carries padding.
**Gap** The app's primary CTA is the single densest concentration of off-token values in the system. `#F5C44A` in the gold gradient is literally `WHIMSY.slopGold`. `#F0B8C8`/`#E8A7B9` are `COLORS.pink`-adjacent but unnamed. The button's font sizes (13/15/17) bypass `TYPE.bodySm`/`body`/`bodyLg`; its radii (22/27) bypass `RADII.xxl` and have no name for 27; its paddings (14/18/22 × 10/11/14) bypass `SPACE` entirely.
**Recommendation** Add `BUTTON_GRADIENT: Record<Variant, readonly [string,string]>` to `theme.ts` beside `RARITY_GRADIENT` (the precedent already exists), name `#5A3F00` as `WHIMSY.goldInk`, name `#7A9B63` as `UI_COLORS.successBorder`, and rebuild `SIZE_MAP` from `SPACE`/`RADII`/`TYPE`. Add `RADII.pillLg: 27` or make all sizes use `RADII.pill`.
**Pillar** Craft/governance + Collect (the buy CTA is the Collect pillar's front door).

---

### [P1] F-03 · `ConfirmDialog` — the spend-confirmation primitive has zero accessibility props and hand-rolls its buttons
**Location** `components/ui/ConfirmDialog.tsx:98-131` (both `Pressable`s), `:139-201` (styles)
**Prompt(s)** P1 (h.1 visibility, h.5 error prevention), P3 (button usability), P6 (a11y)
**Evidence**
```tsx
<Pressable onPress={onCancel} disabled={busy} style={({pressed}) => [styles.btn, styles.btnGhost, pressed && {opacity:0.7}]}>
  <Text style={styles.btnGhostText}>{cancelLabel}</Text>
</Pressable>
```
No `accessibilityRole`, no `accessibilityLabel`, no `accessibilityState`, no `accessibilityViewIsModal`, no `onAccessibilityEscape`. Styles: `padding: 28` (`:145`), `maxWidth: 340` (`:147`), `22/20` (`:148`), `fontSize: 20/14/14/15` (`:151,:158,:187,:190`), `lineHeight: 19`, `marginBottom: 8/18`, `opacity: 0.85` (`:163`), `gap: 10` (`:167`), `paddingHorizontal:14 paddingVertical:11 borderRadius:12 borderWidth:2` (`:172-175`).
**Expected standard** `Button.tsx:151-154` shows the correct pattern (`accessibilityRole="button"` + label + hint + `accessibilityState.disabled`). `AdaptiveModalScaffold.tsx:80-81` shows the correct modal pattern (`accessibilityViewIsModal` + `onAccessibilityEscape`). `DESIGN.md:189` says centered dialogs use `AdaptiveModalScaffold`.
**Gap** This component's whole reason for existing is "replaces `Alert.alert` for actions that cost snouts" — i.e. it is the one place a player can lose currency. A VoiceOver user hears two unlabelled tappable texts inside an unannounced modal, with no escape gesture. It also predates and ignores both `Button` and `AdaptiveModalScaffold`, so its confirm/cancel pair looks nothing like any other button in the app (12px radius vs 22, 2px ink vs variant borders, Caprasimo label vs Nunito ExtraBold).
**Recommendation** Rebuild `ConfirmDialog` as a *composition*: `AdaptiveModalScaffold` (frame, insets, escape, scroll) + `Sticker` (paper) + two `Button`s (`ghost` for cancel, `primary`/`destructive` for confirm), with `busy` mapped to a new `Button` `loading` state. Add `destructive` as a real `Button` variant so "delete" looks the same everywhere.
**Pillar** Connect/Collect — the fair-loss clause of the charter requires an undo path that everyone, including screen-reader users, can reach.

---

### [P1] F-04 · `TierUpBanner` ships the app's only blurred shadow — inside a primitive
**Location** `components/ui/TierUpBanner.tsx:208-212`
**Prompt(s)** P2 (taste), P3, P10(i)
**Evidence**
```ts
shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
```
**Expected standard** `theme.ts:178-181` "the ONLY two shadow tiers"; `DESIGN.md:184` "The Two-Tiers-No-Blur Rule… if the shadow has a blur radius, it belongs to a different app"; taste-standard "Two shadow tiers, both hard."
**Gap** A blurred, black, downward, 12-elevation shadow — the exact generic-material-card treatment the standard names as belonging to a different app — on the season's peak celebration moment, the highest-emotion surface in the Contend pillar. `shadowColor: "#000"` is also not `WHIMSY.ink`. Additionally `:238` uses `FONTS.display` (Fredoka) for the headline where every other title in the app is Caprasimo; `:226/:232/:239` are bare `fontSize` 26/11/26.
**Gap (secondary)** Five more shadow tiers exist inside `components/ui` beyond the sanctioned two: tab rail `{0,-2} @ 0.18` (`HangingSignsTabBar.tsx:385-388`), hanging sign `{2,3} @ 1` (`:443-447`), `TicketButton`'s SVG translate `5`/pressed `3` (`TicketButton.tsx:58`), plus this. **Six tiers where the standard allows two.**
**Recommendation** Swap to `STICKER_SHADOW`. If the banner genuinely needs more lift than a sticker, add a *third named hard tier* (`SHADOW_LG` = `{6,6}` radius 0) to `theme.ts` and amend the standard's decision log — never an unnamed blur. Codify `TicketButton`'s and the tab bar's offsets as `TICKET_SHADOW` / `SIGN_SHADOW` exports so "six tiers" becomes "six *named* tiers" or collapses to two.
**Pillar** Craft — the hard shadow is the paper-craft DNA's most recognizable signature.

---

### [P1] F-05 · No `BORDER`, `OPACITY`, or `TINT` token families exist
**Location** `constants/theme.ts` (absent); evidence across `components/ui`: `borderWidth` 2 ×13, 1.5 ×7, 1 ×1, 0.75 ×1; `opacity` 0.14/0.18/0.4/0.6/0.64/0.7/0.72/0.85/0.9; `rgba()` ×8 (`BarnOverlay.tsx:92,93,96,105`, `HangingSignsTabBar.tsx:325,403,413`)
**Prompt(s)** P4
**Evidence** App-wide baseline: `borderWidth` 2 (255) · 1.5 (129) · 1 (12) · 2.5 (10) · 3 (6); opacity 0.7 (70) · 0.85 (28) · 0.6 (22) · 0.5/0.55/0.45/0.65; 41 `rgba(`. Inside the primitives: `Sticker` 2 and 1.5, `Button` 2 and 1.5, `SegmentedControl` 2 and 1.5, `AlignmentBadge` 1, `AlignmentBar` 1.5 and 2, `PrestigeAvatar` 1.5, `RitualIconWell` 2 and 1.5, `HangingSignsTabBar` 3, 2, 1.5, 0.75, `PigAvatar` 2.5.
**Expected standard** Taste-standard rule 1: *"If a value isn't a token, either use an existing token or add one."* The system has tokens for color, type, radius, spacing, and shadow — and nothing for the three properties that draw the ink border, the pressed dim, and the tint washes.
**Gap** Five border weights with no rule for which means what. Nine opacities with no rule. The pressed-dim split is arbitrary: `Button:157` uses 0.85, `SegmentedControl:122` uses 0.72, `IconButton:115` uses 0.64, `ConfirmDialog:104` uses 0.7, `Spotlight:564` uses 0.6. **Five different "pressed" feelings in five primitives.**
**Recommendation** Add to `theme.ts`:
```ts
export const BORDER = { hairline: 1, thin: 1.5, ink: 2, inkThick: 2.5, rail: 3 } as const;
export const OPACITY = { pressed: 0.85, dim: 0.7, gated: 0.85, disabled: 0.5, ghost: 0.4, wash: 0.18 } as const;
export const TINT = { angel: "rgba(249,209,76,0.07)", goblin: "rgba(123,162,102,0.10)", miasma: "rgba(74,104,58,0.18)", highlight: "rgba(255,255,255,0.22)", well: "rgba(0,0,0,0.10)" } as const;
```
Then make `OPACITY.pressed` the single pressed value across all five primitives. One pressed feeling.
**Pillar** Craft — "the world responds *now*" requires the response to feel the same everywhere.

---

### [P1] F-06 · `WHIMSY.muteSoft` fails WCAG AA on every sanctioned surface — and `UI_COLORS` calls it `textDisabled`
**Location** `constants/theme.ts:24` (`muteSoft: "#8c7e71"`), `:66` (`textDisabled: WHIMSY.muteSoft`), `:68` (`separator: "#8c7e71"`)
**Prompt(s)** P3 (color contrast), P6
**Evidence** computed contrast of `#8c7e71`:

| surface | paper | cream | cream2 | rose | roseDeep | sky | sage | sun | lilac | lilacDeep | peach | slopGold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ratio | **3.78** | **3.45** | **3.22** | **2.98** | **2.11** | **2.94** | **2.75** | **2.88** | **2.51** | **1.65** | **2.64** | **2.41** |

Every pair is under AA-normal 4.5:1. Seven are under the 3:1 floor for large text *and* for non-text UI components (WCAG 1.4.11).
**Expected standard** The token's own comment (`theme.ts:21-23`): *"`mute` is text-safe across every core pastel; `muteSoft` is for disabled icons, separators, and other non-body-text UI."* `colorSystem.test.ts` guards `textDisabled` at ≥ 3 **on `surface` only** (3.78 ✓) and never on a pastel.
**Gap** The comment is correct and the naming contradicts it. `UI_COLORS.textDisabled` invites exactly the use the comment forbids, on any of the 11 sanctioned pastels, and the test only checks paper. `SlideUpSheet.tsx:126` uses it for the grabber (2.98:1 on a cream panel — a control affordance below the 3:1 non-text floor). `ConfirmDialog.tsx:182` uses it as the cancel button's *only* border (3.78:1 on paper — passes non-text, but that is the whole affordance).
**Recommendation** Rename `UI_COLORS.textDisabled` → `UI_COLORS.uiMuted` and forbid it as a text color. Introduce a genuinely text-safe disabled step (`WHIMSY.muteDim ≈ #6f6156`, ≥ 4.5:1 on paper/cream/cream2/rose/sky/sage/sun/peach). Extend `colorSystem.test.ts`'s `calmSurfaces` sweep to `textDisabled` at ≥ 3 and to the *four* surfaces it currently omits (`roseDeep`, `lilacDeep`, `slopGold`, `goblin`).
**Pillar** Craft/comprehension — a disabled control that a player can't read isn't warm, it's broken.

---

### [P1] F-07 · `WHIMSY.accent` fails AA on 6 of the 14 sanctioned surfaces — and it is the kicker color
**Location** `constants/theme.ts:19`, consumed by `KICKER_TEXT` (`:215-218`, 66 sites) and `SectionHeader.tsx:60`
**Prompt(s)** P3, P6
**Evidence** `#a13f30` contrast: paper 6.17 ✓ · cream 5.64 ✓ · cream2 5.26 ✓ · rose 4.86 ✓ · sun 4.70 ✓ · sky 4.80 ✓ · **sage 4.50 (borderline)** · **lilac 4.09 ✗** · **peach 4.31 ✗** · **slopGold 3.94 ✗** · **roseDeep 3.44 ✗** · **goblin 2.80 ✗** · **lilacDeep 2.69 ✗**
**Expected standard** The token comment claims only "paper and rose surfaces." `Sticker` offers 12 color tokens; `SectionHeader` can be dropped on any of them; `KICKER_TEXT` bakes `accent` in with no surface awareness.
**Gap** A `SectionHeader` inside a `lilac` or `peach` `Sticker` — both sanctioned, both used — renders its kicker below AA. Nothing in the type system or the test suite prevents it. `colorSystem.test.ts` checks `action`/`surface` only (6.17 ✓) and never `accent` on a pastel.
**Recommendation** Two options, both system-shaped: (a) darken `accent` to clear 4.5:1 on all 12 `StickerColor` fills (≈ `#8f3527`), or (b) add `WHIMSY.accentOnTint` as the second kicker step and make `KICKER_TEXT` a function of surface — `kickerOn(color: StickerColor)`. Prefer (a); one accent is the rule. Either way, extend `colorSystem.test.ts` to sweep `accent` and `mute` across **all 12 `StickerColor` tokens**, not the 9 "calm" ones.
**Pillar** Craft — the rust kicker is the second-most-recognizable mark in the app after the ink border.

---

### [P1] F-08 · Motion tokens exist but 96% of motion bypasses them; there is no spring token at all
**Location** `hooks/useMotionPolicy.tsx:14-20` (`MOTION_DURATION`); 79 bare `duration:` sites across `app/`+`components/`
**Prompt(s)** P4, P6, P8
**Evidence** `MOTION_DURATION = { feedback:120, state:220, modal:300, celebration:450, crossfade:150 }`. Imported by **8 files**: `AchievementDigestModal`, `AlignmentExplainerModal`, `AlignmentSchismModal`, `BarnGuestbook`, `LuckyPigModal`, `MysteryHatReveal`, `SeasonEndModal`, `ui/TierUpBanner`.
Bare `duration:` values, app-wide, 35 distinct: `220`×11 · `900`×7 · `60`×4 · `55`×4 · `440`×3 · `250`×3 · `200`×3 · `180`×3 · `1700`×3 · `1400`×3 · `90/800/80/760/700/320/300/260/240/160`×2 · `950/70/620/6000/560/520/420/400/340/280/130/1250/12000/120/1050`×1.
`Animated.spring()` ×20 calls with **14 distinct configs across two incompatible parameterizations** — `friction`/`tension` (7/80, 4/·, 6/90, 9/70, 8/60, 5/72, ·/140, ·/120) *and* `speed`/`bounciness` (40/12, 26/8, 18/16, 16/14, 14/10, 12/·). `withSpring` is never used; `withTiming` appears with 55/900/1700.
Inside `components/ui`: 55, 220, 260, 400, 420, 560, 620, 800×2, 900×2, 1400×3, 12000.
**Expected standard** `taste-standard.md` rule 6: *"Motion has weight and warmth. Springy, slightly-overshooting, hand-wound."* That is a *spring* claim, and the system has no spring vocabulary.
**Gap** `220` (11 uses) is `MOTION_DURATION.state` re-typed. `300` (2) is `.modal`. `150`/`160`/`180` are `.crossfade` ± noise. `55`/`60`/`70`/`80`/`90` is a five-value ladder for what `MOTION_DURATION.feedback` names once. Two spring parameterizations means two different overshoot curves coexist and nobody can say which is the house feel.
**Recommendation** Add to `useMotionPolicy.tsx` beside `MOTION_DURATION`:
```ts
export const MOTION_SPRING = {
  tap:      { friction: 5, tension: 140 },  // snappy press-back
  settle:   { friction: 7, tension: 80  },  // the house spring (already the modal value)
  sway:     { friction: 9, tension: 60  },  // tab-bar / chain-tug
  overshoot:{ friction: 4, tension: 120 },  // celebration pop
} as const;
```
One parameterization (`friction`/`tension`) only; forbid `speed`/`bounciness`. Then sweep the 79 bare durations onto the five roles under "leave it better," and add a jest guard mirroring `colorSystem.test.ts` that greps `app/`+`components/` for bare `duration:` and bare `Animated.spring({` config objects.
**Pillar** Craft — "hand-wound motion" is only a design decision if it's one decision.

---

### [P1] F-09 · `SlideUpSheet` and `BuyCelebration` ignore Reduce Motion
**Location** `components/ui/SlideUpSheet.tsx:56-65`; `components/ui/BuyCelebration.tsx` (no `useMotionPolicy` import)
**Prompt(s)** P6
**Evidence** `SlideUpSheet` runs an unconditional 300ms `Animated.timing` translating the panel a full screen height; it never imports `useMotionPolicy`. `BuyCelebration` fires 7–10 animated confetti glyphs radiating outward with scale+rotate and no policy check. Of the 45 files in `components/ui`, 11 consult `useMotionPolicy`; these two animate without it.
**Expected standard** `hooks/useMotionPolicy.tsx` exists precisely for this, and `AnimatedBackground.tsx:47`, `Skeleton.tsx:28`, `TierUpBanner.tsx:59` all demonstrate the correct pattern.
**Gap** `SlideUpSheet` is the chrome for 6 sheets — a full-screen translate is the single most vestibular-triggering motion in the app, and it is the one that opts out. `BuyCelebration` fires on every purchase.
**Recommendation** `SlideUpSheet`: `duration = motionPolicy.duration(MOTION_DURATION.modal)` and, when `largeTransition === "crossfade"`, fade the panel in place (`translateY` stays 0, `opacity` 0→1). `BuyCelebration`: gate the particle field on `allowDecorativeMotion` and fall back to a single static burst frame + the existing haptic/sound. Add both to the Reduce Motion checklist in the taste standard.
**Pillar** Craft/accessibility.

---

### [P1] F-10 · `Glyph` and `Icon` define the same 16 concepts with no rule for which wins
**Location** `components/ui/Glyph.tsx:1-3` (header comment), `:7-58` (50 names); `components/ui/Icon.tsx:16-67` (45 names)
**Prompt(s)** P3 (learnability), P6 (icon-set consistency), P9 (naming)
**Evidence** Exact name collisions (16): `arrowRight` · `bell` · `check` · `crown` · `flame` · `friends` · `ghost` · `gift` · `globe` · `handshake` · `lock` · `premium` · `scales` · `search` · `star` · `trophy`. Near-collisions: `Glyph.close` vs `Icon.x`; `Glyph.pigface` vs `Icon.pig`.
`Glyph.tsx:2-3` states: *"Functional symbols (arrows, close, check, bullet) live in ./Icon (SVG)."* — yet `Glyph` itself defines `arrowRight`, `arrowLeft`, `check`, `close`, and `bullet` (`:18-22`).
**Expected standard** `taste-standard.md`: *"Use `Glyph` (hand-drawn art) or `Icon` (SVG)"*; the 2026-07-13 dingbat ruling's principle — *"one concept, one drawing."*
**Gap** `<Glyph name="star"/>` and `<Icon name="star"/>` render different art at different weights for the same idea, and both are legal. A designer cannot predict which a given screen used. 43 files use `Glyph`, 31 use `Icon`; the overlap set is where they disagree.
**Recommendation** Draw the line by *role*, mirroring the dingbat ruling: **`Icon` = interface affordances** (things you can press or that mark state — `check`, `x`, `lock`, `arrowRight`, `search`, `bell`, `gear`, chevrons); **`Glyph` = subject matter** (things the fiction is about — `trophy`, `crown`, `gift`, `gem`, `pigface`, `zzz`, `party`). Delete the 16 duplicates from whichever side loses per that rule, keep a deprecation alias for one release, and fix `Glyph.tsx`'s header comment. Record the ruling in the taste standard's decision log.
**Pillar** Craft/governance.

---

### [P1] F-11 · `Icon` mixes three icon systems and defaults to a color that is not `WHIMSY.ink`
**Location** `components/ui/Icon.tsx:13-14` (MCI + Feather imports), `:72-90` (`VECTOR_ICON_MAP`, 14 entries), `:682` (`color = "#1A1A1A"`)
**Prompt(s)** P2, P6 (icon-set drift)
**Evidence**
```ts
const VECTOR_ICON_MAP = { crown:{mci,"crown"}, gift:{mci}, scales:{mci,"scale-balance"}, trophy:{mci}, ghost:{mci},
  gear:{feather,"settings"}, edit:{feather,"edit-2"}, refresh:{feather}, exit:{feather,"log-out"},
  handshake:{mci}, pig:{mci}, target:{feather}, scroll:{mci,"script-text-outline"}, chevronDown:{feather} };
export function Icon({ name, size = 24, color = "#1A1A1A", filled = false, strokeWidth = 1.8, style })
```
Plus 38 raw hexes in the hand-drawn paths (`#FBE6EC` ×7, `#F5C44A` ×7, `#ffd87a` ×7, `#7B5FFF` ×2, `#EFE9FF` ×2, `#1A1A1A` ×2, `#E8A7B9`, `#A05A72`, `#5BC97D`, `#BCE0F0`, `#EFEAE3`, gradient `#FFB84A`/`#F58F4A`/`#D85858`).
**Expected standard** `DESIGN.md:124` "hand-drawn `Glyph` art or SVG `Icon` only"; `audit.native` check "icon-set drift"; `WHIMSY.ink = #2a1f15`.
**Gap** 14 of 45 icons are Material Community / Feather glyphs — a different grid, stroke weight, and corner language than the 31 hand-drawn storybook paths beside them. `strokeWidth` and `filled` are silently ignored for those 14 (the delegate branch at `:22-40` passes only `size`/`color`), so a call site that tunes weight gets it on 31 icons and not the other 14. The default `#1A1A1A` is `COLORS.ink` (the legacy near-black), not `WHIMSY.ink` — so the 12 call sites that omit `color` draw icons in a black that matches no border in the app. The 38 fill hexes are a private palette: `#F5C44A` is `WHIMSY.slopGold`, `#ffd87a` is `WHIMSY.sun`, `#7B5FFF` is `COLORS.purple`, `#5BC97D` is `COLORS.success`, `#BCE0F0` is `COLORS.sky`.
**Recommendation** (a) `color = UI_COLORS.textPrimary` as the default — one-line fix, 12 call sites corrected. (b) Replace the 14 vector delegates with hand-drawn paths over time; until then, mark them in the type (`IconName` vs `VectorIconName`) so a caller knows `strokeWidth`/`filled` won't apply. (c) Replace the 38 fill literals with `WHIMSY`/`RARITY_*` references — `Icon.tsx` currently imports **no** theme token at all.
**Pillar** Craft — a consistent icon set is table stakes for "designed by someone who cares."

---

### [P1] F-12 · The primitives share no API conventions
**Location** across `components/ui/*`
**Prompt(s)** P5, P9 (naming consistency)
**Evidence** — every inconsistency found:

| Concern | Divergent spellings |
| --- | --- |
| **open/visible** | `SlideUpSheet` `open` + `modalVisible` · `AdaptiveModalScaffold` `visible` · `ConfirmDialog` `open` **+** `visible` (different meanings) |
| **close callback** | `onClose` (SlideUpSheet) · `onRequestClose` (AdaptiveModalScaffold) · `onCancel` (ConfirmDialog) · `onPress` (DialogCloseRow) |
| **`label` means…** | the visible text (`TicketButton.label`) · the a11y label (`IconButton.label`, `DialogCloseRow.label`) · the *group's* a11y label (`SegmentedControl.label`) · a per-option caption (`SegmentOption.label`). Meanwhile `Button` takes its text as `children` and the headers call it `title`. **Five meanings.** |
| **variant axis** | `variant` (Button, IconButton, ProfileIdentity) · `tone` (TicketButton) · `kind` (AlignmentEmblem) · `color` (Sticker, EmptyState) · a boolean (`RitualIconWell.blessed`) · `destructive` as a boolean flag rather than a variant (ConfirmDialog) |
| **`size` type** | `"sm"\|"md"\|"lg"` (Button, AlignmentBadge) · `"md"\|"lg"` (AlignmentBar) · `number` (Glyph, Icon, SnoutCoin, TickleIcon, Shovel, AlignmentEmblem, PigPortrait, PigAvatar, PrestigeAvatar, RitualIconWell, WaitingRosie) · both (`IconButton.iconSize` + `visualSize`) |
| **`style` type** | `StyleProp<ViewStyle>` (most) · **bare `ViewStyle`** — `Button.tsx:32`, `PigAvatar.tsx:12`, `PrestigeAvatar.tsx:27` (arrays and `false &&` guards won't type-check) · `StyleProp<ImageStyle>` (Glyph, AlignmentEmblem) · `frameStyle` + `contentContainerStyle`, no `style` (AdaptiveModalScaffold) · **no style prop at all** — `AlignmentBadge`, `AlignmentBar`, `RitualIconWell`, `SnoutCoin`, `TickleIcon`, `Shovel`, `BarnOverlay` |
| **color prop** | `Sticker.color?: StickerColor \| (string & {})` (union preserved) vs `EmptyState.color?: string` (`EmptyState.tsx:33` — forwards straight to `Sticker` but **discards the token union**, so autocomplete is lost at the most-used wrapper) vs `IconButton.color?: string` (icon tint) vs `PigAvatar.border?: string` (border color) |
| **a11y pass-through** | `Button` forwards Label/Hint/State/testID · `TicketButton` Label/Hint/testID · `IconButton` Hint/testID/onLongPress (label is positional) · `SegmentedControl` group label only · `ConfirmDialog`, `Sticker` forward **nothing** |
| **`onPress` optionality** | required (`IconButton`) vs optional (`Button.tsx:35`, `TicketButton.tsx:33`) — a `<Button>` with no handler type-checks |
| **disabled modelling** | `disabled` prop (Button, IconButton) · `disabled` **and** a `locked` variant that means the same thing (Button) · `disabled \|\| loading → inactive` (TicketButton) |
| **dead prop** | `LoadingBeat.glyph?: GlyphName` (`EmptyState.tsx:57`) declared, never read |

**Expected standard** `taste-standard.md`'s craft lens: *"would an experienced product designer who has internalized this game's DNA intentionally make this exact decision?"* Twelve ways to spell four ideas is not an intentional decision.
**Gap** Every inconsistency is a place a developer has to open the file to use the component, which is the friction that produces the 262 hand-rolled pressables.
**Recommendation** Publish a one-page **primitive API contract** in the taste standard and conform every component to it:
- `open` + `onClose` for anything overlay-shaped (alias the old names for one release).
- `label` **always** means visible text; a11y label is always `accessibilityLabel`.
- `variant` is the only semantic axis name; `tone`/`kind` are retired; booleans like `destructive`/`blessed` become variants.
- `size` is always `"sm"|"md"|"lg"`; pixel sizing is `px` or a dedicated prop (`visualSize`).
- **Every** primitive takes `style?: StyleProp<ViewStyle>` and forwards `testID` + the four `accessibility*` props.
- Interactive primitives require `onPress`.
- Delete `LoadingBeat.glyph`.
**Pillar** Craft/governance.

---

### [P1] F-13 · The system has no primitive for the components the app actually builds most
**Location** system-wide: 357 `<Pressable>`/`<TouchableOpacity>` in 104 files vs 95 `<Button>` + 3 `<IconButton>`; 28 non-`ui` files mount a raw `<Modal>`; 11 files mount `ActivityIndicator`; 9 use `Alert.alert`; 133 files render raw `<Text>`
**Prompt(s)** P4, P5
**Evidence** `components/ui/index.tsx` exports **8** of ~45 primitives (`Button`, `TicketButton`, `IconButton`, `DialogCloseRow`, `AdaptiveModalScaffold`, `Skeleton`, `SectionHeader`, `SegmentedControl`). `Sticker`, `EmptyState`, `PageHeader`, `Glyph`, `Icon`, `SlideUpSheet`, `ConfirmDialog`, `PigStage` — the eight *most-used* primitives — are all absent from the barrel, so 6 files import from `@/components/ui` and ~100 import deep paths.
**Gap** Named gaps, each with its evidence of hand-rolling:

| Missing primitive | Evidence it's needed |
| --- | --- |
| `Sheet` (panel body, not just chrome) | `SlideUpSheet` owns only the Modal/scrim/slide; 6 callers re-roll the paper panel, grabber placement, and padding. |
| `Chip` / `Pill` | 16 `borderRadius: 999` sites survive beside 106 `RADII.pill` uses; cleanse pills, corner tags, rarity dots, MEMBERS ribbon each re-roll. |
| `ListRow` | `ListRowSkeleton` exists (the *loading* row) but there is no real row. Leaderboard, friends, achievements, closet all hand-roll `Sticker` + `Pressable` + tilt + gap. |
| `Toast` | `components/PurchaseToast.tsx` is the only toast, not in `ui/`, not generic. |
| `Card` header slot | `Sticker` has no title/right/footer slots, so 58 files re-roll the title row. |
| `Stat` / numeral readout | `TYPE.numeral` exists with no component; every count is a bare `<Text>` + icon + gap. |
| `Text` per `TYPE` role | 133 files render raw `<Text>`; `ThemedText` is dead. `<Body>`, `<CardTitle>`, `<Kicker>` would retire most of the 521 bare `fontSize`s mechanically. |
| `Spinner`/`Busy` | 11 files mount a naked `ActivityIndicator` — including the `TicketButton` primitive itself (`TicketButton.tsx:190`) — against taste-standard rule 4. |
| `Field` / `TextInput` | no input primitive at all. |
| `ProgressBar` | `AlignmentBar` is a bespoke one-off; season/XP bars are re-rolled. |

**Recommendation** Build in this order (highest literal-retirement per unit of work): **`Text` role components → `ListRow` → `Chip` → `Card` header slot → `Sheet` body → `Toast` → `Stat` → `Spinner` → `Field` → `ProgressBar`.** Simultaneously: export **every** primitive from `components/ui/index.tsx` and make the barrel the only sanctioned import path.
**Pillar** All three — Connect (rows are the friends list), Collect (chips are the catalog), Contend (stats are the race).

---

### [P2] F-14 · `COLORS` is a live second palette with a pure-white paper and a near-black ink
**Location** `constants/theme.ts:92-119`; 15 use sites incl. `components/ui/Button.tsx:53`
**Evidence** `COLORS.ink: "#1A1A1A"` · `paper: "#FFFFFF"` · `paper2/#FAF7F3` · `paper3/#F4EFE7` · `border/#EAE2D6` · plus `pink`/`purple`/`gold` ramps. Live sites: `app/(tabs)/shop.tsx:246,421,439,1125`, `app/lounge.tsx:813`, `app/(tabs)/season.tsx:786`, `components/Barn.tsx:923`, `components/Account.tsx:2378`, `components/BarnVisitModal.tsx:877`, `components/PurchaseToast.tsx:112`, `components/season1/RaceSection.tsx:320,327,334`, `components/ui/Button.tsx:53`.
**Expected standard** `taste-standard.md`: *"One palette: WHIMSY."* `DESIGN.md:234`: *"Don't wrap a screen in black (`#1A1A1A`)."*
**Gap** `COLORS.ink` is the exact hex the standard names as a taste failure, still exported and still reachable. Five values duplicate `WHIMSY` at different names (F-15). `COLORS.successText #5A8338` on `COLORS.successBg #E8F5E0` = **3.92:1**, an AA failure, used as text at `shop.tsx:421,439` and `Account.tsx:2378`.
**Recommendation** Fold the 15 sites into `WHIMSY`/`UI_COLORS`/`RARITY_*` (mostly mechanical: `COLORS.successText`→`UI_COLORS.successText` which is 5.91:1 ✓; `COLORS.gold`→`WHIMSY.slopGold`; `COLORS.goldDeep`→`WHIMSY.bless`). Keep only `pink*`/`purple*`/`silver`/`bronze`/`barn`/`grass` until they too have `WHIMSY` homes, and move them under a clearly-marked `LEGACY_COLORS` export so no new site reaches for them.

### [P2] F-15 · Five token pairs are the same hex under two names
**Location** `constants/theme.ts`
**Evidence** `#a89bff` = `lilacDeep` (`:15`) **and** `angel` (`:32`) · `#8c7e71` = `muteSoft` (`:24`) **and** a re-typed literal at `separator` (`:68`) · `#f5c44a` = `slopGold` (`:38`) **and** `COLORS.gold` (`:100`) · `#c99b23` = `bless` (`:47`) **and** `COLORS.goldDeep` (`:101`) · `#e8f5e0` = `UI_COLORS.successSurface` (`:73`) **and** `COLORS.successBg` (`:117`).
**Gap** `UI_COLORS.separator: "#8c7e71"` literally re-types a value it could reference two lines above — so tuning `muteSoft` silently desyncs the separator. `lilacDeep`/`angel` is arguably intentional (brand vs semantic) but is undocumented, so `RARITY_STRIPE.epic` uses `lilacDeep` while `AlignmentBar` uses `angel` for the same pixel.
**Recommendation** `separator: WHIMSY.muteSoft`. Document the `lilacDeep`→`angel` aliasing in a comment ("alignment semantics point at brand hues; change the alias, not the hue"). Retire the `COLORS` duplicates with F-14.

### [P2] F-16 · `DESIGN.md` disagrees with `theme.ts` on eight points
**Location** `DESIGN.md` (frontmatter + body) vs `constants/theme.ts`
**Evidence**

| `DESIGN.md` says | `theme.ts` / decisions say |
| --- | --- |
| `accent: "#c25a3f"` (`:17`, `:132`, `:147`) | `accent: "#a13f30"` (`theme.ts:19`). The stale value is **4.18:1 on paper — below AA**, which is the documented reason it changed. |
| *"a streak is a garden that grows"* (`:116`, `:173`, `:224`) | Retired by the **2026-08-28** decision (Streak moved to the fiery Tickle counter *with an explicit number*). `DESIGN.md` states the exact rule the decision reversed, twice. |
| *"The heart counter is the only number that earns its place"* (`:116`, `:232`) | `taste-standard.md` now allows numbers for all progression (Streak, XP, tiers, prices). |
| `rounded` lists 8/12/14/18/22 (`:69-74`) | `RADII.pill: 999` also exists (`theme.ts:174`) and is the most-used radius (106 sites). Absent from DESIGN.md. |
| typography lists 11 roles (`:23-68`) | `TYPE` has **15** — `cardTitleSm`, `bodyLg`, `handLg`, `handDisplay`, `kickerPillSm` are missing. |
| colors list omits | `mute`, `muteSoft`, `bark-mute`, `slopGold`, `slopBand`, `bless`, `curseGreen`, `flame` — 8 of the 25 `WHIMSY` tokens. |
| *"~125 leaked literals"* (`:145`), *"634 such sites"* (`:171`) | Current baseline: 97 raw hex, 521 bare `fontSize`. Stale counts read as current facts. |
| `kicker-pill` component: `textColor: {colors.accent}`, `typography: {typography.kicker}` (`:101-103`) | `KICKER_PILL` is `TYPE.kickerPill` + `WHIMSY.mute` (`theme.ts:225-228`) — wrong font **and** wrong color. |

**Gap** `DESIGN.md` is the artifact an agent or a new collaborator reads first (it looks canonical — YAML frontmatter, "Design System" title). Every one of these eight would send them to the wrong value. The frontmatter is machine-shaped, so a tool could consume `accent: #c25a3f` verbatim.
**Recommendation** Either **regenerate `DESIGN.md` from `theme.ts`** (a script that emits the frontmatter from the token exports, so it cannot drift) or demote it: add a header line — *"Historical export, 2026-06. `constants/theme.ts` and `docs/design/taste-standard.md` are canonical."* — and delete the stale color/type values. Regeneration is preferable; a drifting design doc is worse than none.

### [P2] F-17 · `EmptyState` — 8 bare values and a discarded type union in the app's 4th-most-used primitive
**Location** `components/ui/EmptyState.tsx:33`, `:38`, `:39`, `:41`, `:63`, `:71-72`, `:85`, `:90`
**Evidence** `color?: string` (`:33`, discards `StickerColor`) · `paddingHorizontal: 14, paddingTop: 12` (`:38`) · `radius={12}` (`:39`, not `RADII.md`) · `size={40} marginBottom:10 opacity:0.9` (`:41`) · `fontSize: 13` override on `KICKER_TEXT` which is **already 13** (`:63`, a no-op override) · `paddingHorizontal: 18, paddingVertical: 20` (`:71-72`) · `marginTop: 4` (`:85`) · `gap: SPACE.sm + 2` (`:90` — arithmetic on a token is a token that doesn't exist). Also a stray blank line at `:64`.
**Expected standard** taste-standard rule 1; `SPACE` = 4/8/12/16/24; `PAGE_PAD` = 18.
**Gap** 13 uses of `EmptyState` and 26 of `LoadingBeat` inherit all eight. `SPACE.sm + 2` = 10, a value the scale deliberately excludes.
**Recommendation** `color?: StickerColor | (string & {})`; `radius={RADII.md}`; paddings from `PAGE_PAD`/`SPACE`; drop the no-op `fontSize`; add `SPACE.smd: 10` **or** round the gap to `SPACE.md`. Add an optional `action?: ReactNode` slot so an empty state can offer the fix (an empty Sounder should be able to say *"invite a friend"* in the same card).

### [P2] F-18 · `SectionHeader` bypasses `TYPE` for its right slot and hard-codes three margins
**Location** `components/ui/SectionHeader.tsx:57`, `:74-77`, `:87-88`, `:34`
**Evidence** `wrap: { marginBottom: 12 }` (`:57`) · `right: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: …, marginLeft: 8 }` (`:74-77`) · `rule: { marginTop: 4, marginBottom: 10 }` (`:87-88`) · `ruleWidth = 64` (`:34`).
**Expected standard** `TYPE.label` is exactly `{ fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 0.3 }` — the `right` style re-types it minus the tracking. `SPACE` covers 12/8/4; 10 is off-scale. `PageHeader.tsx:67-88` does this correctly (`SPACE.md`, `SPACE.xs`, `SPACE.sm`, `TYPE.hand`).
**Gap** 14 screens inherit an off-scale 10px and a re-typed type role. The `PageHeader`/`SectionHeader` pair should be twins; one is tokenized and one isn't.
**Recommendation** `right: { ...TYPE.label, color: UI_COLORS.textSecondary, marginLeft: SPACE.sm }`; margins from `SPACE`; export `RULE_WIDTH = 64` from `theme.ts` (it is duplicated as a default in both headers and cited as "canonical" in the JSDoc).

### [P2] F-19 · `Button`'s `ghost` and `success` variants abandon the ink outline; `success`'s border is 2.77:1
**Location** `components/ui/Button.tsx:61-79`, `:186`
**Evidence** `ghost: { border: UI_COLORS.separator }` → `#8c7e71` at **1.5px** (`bw` unset → `flat.bw ?? 1.5`). `success: { border: "#7A9B63" }` → **2.77:1** on `successSurface #e8f5e0`, also 1.5px. Only `locked` sets `bw: 2` and `border: UI_COLORS.border`.
**Expected standard** `DESIGN.md:195` "wrapped in the signature 2px ink outline"; the 2026-07-07 decision: *"you mute the fill, you never dissolve the outline."* WCAG 1.4.11 requires 3:1 for a control's boundary.
**Gap** Three of seven variants (`ghost`, `success`, and gradient-less `dark`) draw a thinner, non-ink outline, so a row of mixed-variant buttons doesn't read as one family. `success`'s boundary is below the non-text contrast floor — and `success` is the "claimed / owned" affirmation state, where the border *is* the message.
**Recommendation** Every flat variant gets `borderWidth: BORDER.ink` and `borderColor: UI_COLORS.border` (mute the fill, keep the ink) — the same ruling already applied to `locked`. Retire per-variant border colors.

### [P2] F-20 · `TicketButton` mounts a naked `ActivityIndicator` and overrides four `TYPE` roles
**Location** `components/ui/TicketButton.tsx:190`, `:238-256`, `:280-283`
**Evidence** `<ActivityIndicator size="small" color={colors.text} />` · `stubMark: {...TYPE.cardTitle, fontSize: 17, lineHeight: 18}` · `stubSolo: {...TYPE.label, fontSize: 11, lineHeight: 14}` · `stubCaption: {...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 0.8}` · `actionLabel: { fontFamily: FONTS.whimsy, fontSize: 18, lineHeight: 22 }` (that is `TYPE.cardTitle`, re-typed).
**Expected standard** taste-standard rule 4: *"never a bare gray string or a naked spinner"*; rule 2: *"Compose text from roles, not numbers."*
**Gap** `...TYPE.role, fontSize: X` is the anti-pattern `cardTitleSm` and `kickerPillSm` were added to `theme.ts` to retire (see comments at `theme.ts:143-145, 160-163`) — and the primitive still does it four times.
**Recommendation** Replace the spinner with a compact `LoadingBeat` or a three-dot `Glyph` beat. Add the two genuinely-new sizes as roles (`TYPE.cardTitleXs: 17`, `TYPE.labelSm: 11`) and compose; `actionLabel` becomes `...TYPE.cardTitle`.

### [P2] F-21 · `HangingSignsTabBar` — two off-token shadow tiers, 7 hexes, 4 rgba, and a no-op `fontWeight`
**Location** `components/ui/HangingSignsTabBar.tsx:55-57`, `:325`, `:385-392`, `:403`, `:413`, `:443-447`, `:465`, `:471`, `:497`
**Evidence** `WOOD_TOP="#8d5a2c"`, `WOOD_BOT="#74441e"`, `WOOD_FRAME="#8d5a2c"` (`:55-57`) · `stroke="#3a3026"` ×2 · `"#7a5223"` (`:465`) · `rgba(255,216,122,0.55)` (`:325`), `rgba(255,255,255,0.22)` (`:403`), `rgba(0,0,0,0.10)` (`:413`) · rail shadow `{0,-2} @ 0.18` (`:385-388`) · sign shadow `{2,3} @ 1` (`:443-447`) · `borderWidth: 0.75` (`:466`, a sixth border weight) · `fontWeight: "900"` on top of `FONTS.bodyExtra` (`:471`, `:497`).
**Expected standard** Two shadow tiers; one palette; on iOS a `fontWeight` alongside an explicit `fontFamily` is ignored (all 10 app-wide `fontWeight` sites are suspect).
**Gap** The tab bar is the app's signature navigation and its most-seen surface, and it is the least-tokenized file in `components/ui`. `rgba(255,216,122,0.55)` is `WHIMSY.sun` at 55%.
**Recommendation** Add a `WOOD` token family to `theme.ts` (`WOOD = { top, bottom, frame, nail, grain }`) — the tab bar is a permanent surface and deserves named colors, exactly as `bark` got them on 2026-07-06. Use `TINT.highlight`/`TINT.well` from F-05. Codify the two shadows as `SIGN_SHADOW` / `RAIL_SHADOW` or fold them into `SHADOW_SM`. Delete both `fontWeight` declarations.

### [P2] F-22 · `RitualIconWell` renders `☁` as a raw `Text` glyph for a semantic state
**Location** `components/ui/RitualIconWell.tsx:66`, `:97-102`
**Evidence** `<Text style={styles.badgeGlyph}>{blessed ? "✦" : "☁"}</Text>`
**Expected standard** The **2026-07-13 dingbat ruling**: *"`✦` and `·` are SANCTIONED as label typography… `✓`, `✕`, and `♥` are SEMANTIC — they carry meaning and must render through the `Icon`/`Glyph` primitives."*
**Gap** `☁` is not in the sanctioned list, and it is doing exactly what the ruling forbids: carrying the *cursed* state, the same concept the app draws as art elsewhere (`Glyph "cloud"` exists at `Glyph.tsx:39`). `✦` beside it is fine per the ruling, so the badge is half-compliant — which is worse, because the two marks must match in weight and they can't.
**Recommendation** `<Glyph name={blessed ? "sparkle" : "cloud"} size={11} />`. Amend the dingbat ruling to name `☁` explicitly as semantic. Also `TierUpBanner.tsx:185` renders `↓` ("New reward waiting below ↓") — a directional affordance, also semantic; use an `Icon "arrowDown"` (which does not yet exist — add it).

### [P2] F-23 · `constants/Colors.ts` + the Expo-template theme chain is dead weight reachable from one screen
**Location** `constants/Colors.ts` (whole file), `hooks/useThemeColor.ts`, `hooks/useColorScheme.ts`, `hooks/useColorScheme.web.ts`, `components/ThemedText.tsx`, `components/ThemedView.tsx`, `app/+not-found.tsx`
**Evidence** `Colors.light.tint = '#0a7ea4'` (a teal that exists nowhere in `WHIMSY`), `Colors.dark.background = '#151718'`. The only importer is `hooks/useThemeColor.ts:6`; the only consumers of *that* are `ThemedText`/`ThemedView`; the only consumer of *those* is `app/+not-found.tsx:4-5`.
**Expected standard** `theme.ts:57-58`: *"Tickle the Pig intentionally ships light-only until a complete dark paper, ink, art, shadow, and navigation treatment exists."* `colorSystem.test.ts` asserts `app/_layout.tsx` contains no `useColorScheme`.
**Gap** A complete parallel light/dark theme system, off-palette, still compiled in — and the one screen that uses it (the 404) is the one screen that would render `#151718` black on a dark-mode device, the exact black-wrapper failure `DESIGN.md:234` forbids.
**Recommendation** Rewrite `app/+not-found.tsx` on `PageHeader` + `EmptyState` + `Button` (a cozy "this pen is empty" beat — it's a free charm moment), then delete `constants/Colors.ts`, `hooks/useThemeColor.ts`, `hooks/useColorScheme*.ts`, `components/ThemedText.tsx`, `components/ThemedView.tsx`. Add an assertion to `colorSystem.test.ts` that no file imports `@/constants/Colors`.

### [P2] F-24 · Four overlapping ways to write a kicker
**Location** `constants/theme.ts:154`, `:159`, `:163`, `:215-218`, `:225-228`
**Evidence** usage counts: `TYPE.kicker` **105** · `TYPE.kickerPill` **71** · `KICKER_TEXT` **66** · `TYPE.kickerPillSm` **23** · `KICKER_PILL` **19**. `KICKER_TEXT = {...TYPE.kicker, color: WHIMSY.accent}`; `KICKER_PILL = {...TYPE.kickerPill, color: WHIMSY.mute}` — i.e. the only difference between the composite and the role is a baked color, and the comments on both (`:214`, `:224`) explicitly tell callers to *"compose with overrides per screen."*
**Expected standard** `theme.ts:132-135`: *"color is intentionally NOT baked in so one role serves ink / mute / accent."* The two `KICKER_*` composites bake color in, contradicting the rule stated 60 lines above them.
**Gap** A developer choosing a kicker faces five exports, two of which violate the file's own stated principle, and the two composites' own comments say to override the thing they baked in.
**Recommendation** Keep the three `TYPE` roles as the vocabulary; replace `KICKER_TEXT`/`KICKER_PILL` with `<Kicker>` / `<KickerPill>` **components** (part of F-13's text primitives) that own the color *and* the `★ ` prefix — which `SectionHeader.tsx:39` and `PageHeader.tsx:55` currently hard-code separately. One place decides what a kicker is.

### [P2] F-25 · `cosmeticFx.ts` carries a 10-color palette outside `WHIMSY`
**Location** `constants/cosmeticFx.ts:66-77`, `:45`, `:122`
**Evidence**
```ts
const THEME_ACCENT = { "Royal Sty":"#F5C44A", "Cosmic Hog":"#9C7BF0", "Garden Gala":"#F2A0C0",
  "Mudlark Deluxe":"#D8A24A", "Confection Counter":"#FFB3C7", "Storybook Knight":"#C3CDDC",
  "Aurora Frost":"#8FD8E8", "Tropic Luau":"#FFB24A", "Midnight Masquerade":"#B98BD8",
  "Slop Club Signature":"#F5C44A" };
```
plus `glow: { color: "#F5C44A" }` at `:45` and the fallback `?? "#F5C44A"` at `:122` — `#F5C44A` is `WHIMSY.slopGold`, written three times. Periods `2600`/`2800`/`3400` are hard-coded at `:44-46`, `:124-125`, `:131`.
**Expected standard** *"New color = a token, never a fresh hex."*
**Gap** Ten theme hues — a real, intentional, per-theme accent system — living entirely outside the palette, so nobody auditing `WHIMSY` knows they exist. These drive the members-catalog glow, the Collect pillar's premium surface.
**Recommendation** Move the map to `theme.ts` as `COSMETIC_ACCENT` (beside `RARITY_STRIPE`, which is the same shape and the same job). Replace the three `#F5C44A` with `WHIMSY.slopGold`. Move the periods into `MOTION_DURATION` as a `cosmetic` family (`bob: 2600, glow: 2800, shine: 3400`) so the Reduce-Motion policy and the FX recipes share one clock.

### [P2] F-26 · `RARITY_STRIPE` is the sole rarity signal and every value is below 3.5:1
**Location** `constants/theme.ts:265-271`
**Evidence** on `paper`: `common #cdbfae` **1.73** · `uncommon #7ba868` **2.64** · `rare #5a8bc5` **3.40** · `epic (lilacDeep)` **2.29** · `legendary (goblin)` **2.20**
**Expected standard** WCAG 1.4.11 (non-text contrast) requires 3:1 for a graphic that conveys information. The comment calls it *"the color DOT in the shop legend and the STRIPE down the side of a closet card"* — i.e. informational, not decorative.
**Gap** Four of five rarity markers are below the floor; `common` at 1.73 is nearly invisible on paper. A colorblind or low-vision player can't distinguish `epic` from `rare` from the dot alone.
**Recommendation** Rarity must not be color-only. Keep the stripe as the aesthetic layer and add a **shape or label** channel — the rarity name in `TYPE.kickerPillSm` on the card, or a notch count on the stripe. If the stripe stays load-bearing, darken all five to ≥ 3:1 on `paper` (the fills in `RARITY_GRADIENT` are fine — ink on them is 9.95–15.06:1).

### [P2] F-27 · `MODAL_BACKDROP_BG` and `UI_COLORS.scrim` are two names for one value, and the alias won
**Location** `constants/theme.ts:80`, `:210`
**Evidence** `scrim: "rgba(40,30,20,0.55)"` (`:80`); `MODAL_BACKDROP_BG = UI_COLORS.scrim` (`:210`). Usage: `MODAL_BACKDROP_BG` **66 sites**, `UI_COLORS.scrim` **1 site**.
**Gap** Minor, but it means the semantic layer (`UI_COLORS`) is bypassed 66:1 by its own alias, and a future `scrim` variant (sheet vs dialog vs spotlight) has nowhere consistent to live.
**Recommendation** Keep `MODAL_BACKDROP_BG` (it won on usage) and remove `UI_COLORS.scrim`, **or** promote `UI_COLORS.scrim` and deprecate the alias. Do not keep both. If spotlight/sheet/dialog need different dims, make it `SCRIM = { sheet, dialog, spotlight }`.

### [P2] F-28 · `Skeleton`, `SegmentedControl`, `AlignmentBadge` are built and unused
**Location** `Skeleton.tsx` (1 use), `SegmentedControl.tsx` (1 use), `AlignmentBadge.tsx` (1 use), `ListRowSkeleton` (1 use), `DialogCloseRow` (2 direct uses), `PigAvatar` (0 direct uses), `AnimatedBackground` (0 direct — only via `PageBackground`)
**Evidence** measured by counting `<Component` mounts in `app/` + `components/` excluding `components/ui/`.
**Gap** `SegmentedControl` is one of the best-built primitives in the folder (44pt segments, `radiogroup`/`radio` roles, explicit `selected`) and it is used once — while filter/scope toggles are hand-rolled elsewhere. `Skeleton` is used once while 11 files mount `ActivityIndicator`. The system's best work isn't reaching the screens.
**Recommendation** This is an adoption problem, not a code problem — but the system can fix it by (a) exporting everything from the barrel (F-13), and (b) adding a short "which primitive do I reach for?" decision table to `taste-standard.md`: *filter/scope → `SegmentedControl` · loading list → `ListRowSkeleton` · loading beat → `LoadingBeat` · dialog dismiss → `DialogCloseRow` · nothing-here → `EmptyState`.*

### [P2] F-29 · `Sticker` has no pressed state, so 58 files invent one
**Location** `components/ui/Sticker.tsx` (no `onPress`, no `pressed` styling)
**Evidence** `Sticker` is used in 58 files; the app mounts 357 `Pressable`s. Pressed feedback on sticker-shaped targets is hand-rolled per site with the five different opacities catalogued in F-05.
**Expected standard** *"The world responds **now**"* — the response is the primitive's job.
**Recommendation** Add an optional `onPress`/`onLongPress` to `Sticker`. When present it renders a `Pressable` and applies the house press treatment — the paper-craft-correct one is a **shadow collapse**: `STICKER_SHADOW` → `SHADOW_SM` plus a 2px translate, so the sticker visibly presses into the page (`TicketButton.tsx:57-58` already does exactly this with its 5→3 offset and it's the best press in the app). Also forwards `accessibilityRole="button"` + label. That single change gives 58 files a correct, consistent, accessible press.

---

### [P3] F-30 · `EquippedItem.emoji` — an `emoji` field in the type contract of the pig stage
**Location** `components/ui/PigStage.tsx:99-103`; passed as `emoji: null` at `PigAvatar.tsx:55-56`
**Evidence** `export interface EquippedItem { id: string; category: string | null; emoji: string | null; }`
**Gap** The taste standard's hardest law is "no emoji in UI, ever," and the equipment contract has a field named for it. Always `null` at the two call sites checked. Also conflicts with the "technical names for modules" preference.
**Recommendation** Delete the field if it is dead; rename to `fallbackLabel` if it is not.

### [P3] F-31 · `BuyCelebration`'s particle type is named `emoji`
**Location** `components/ui/BuyCelebration.tsx:25`, `:40`, `:111` (`{p.emoji}`)
**Evidence** `type Particle = { …; emoji: string }` holding `"★" | "✦" | "♥"`. The comment at `:49-54` correctly argues these are sanctioned dingbats.
**Gap** The reasoning is right; the identifier says the opposite, so a future grep for "emoji" flags a compliant file and a future reader assumes a violation. Note `♥` *is* named as semantic by the dingbat ruling — the carve-out ("animated confetti, not the static semantic love-count mark") is defensible but lives only in a code comment.
**Recommendation** Rename `emoji` → `mark`. Append the confetti carve-out to the taste standard's decision log so it is a ruling rather than a comment.

### [P3] F-32 · `Skeleton` hard-codes `radius = 8` and `ListRowSkeleton` six more values
**Location** `components/ui/Skeleton.tsx:24`, `:56-61`, `:66-77`
**Evidence** `radius = 8` (= `RADII.sm`) · `Skeleton width={40} height={40} radius={20}` · `gap: 6, marginLeft: 10` · `paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, marginVertical: 4` · durations `800`/`800`.
**Recommendation** `RADII.sm`, `RADII.md`, `SPACE`, `BORDER.thin`, `MOTION_DURATION` (add a `pulse: 800` role). Low urgency — 1 use site.

### [P3] F-33 · `SnoutCoin` re-exports `TickleIcon`, merging two currencies in one module
**Location** `components/ui/SnoutCoin.tsx:4-6`
**Evidence** `// Compatibility export for older callers. New tickle surfaces should import from TickleIcon so Snout Coins and tickle rewards cannot be conflated.` `export { TickleIcon } from "./TickleIcon";`
**Gap** The comment names the exact confusion the re-export enables. 17 files import `SnoutCoin`; any of them can pull `TickleIcon` from the wrong module.
**Recommendation** Delete the compat export and fix the callers (3 `TickleIcon` uses).

### [P3] F-34 · `Sticker`'s default tilt duplicates a `ROW_TILTS` entry by value, not by reference
**Location** `constants/theme.ts:206`; `components/ui/Sticker.tsx:49`
**Evidence** `ROW_TILTS = [-1.2, 0.8, -0.6, 0.5, -0.4, 1, -0.7, 0.6]`; `rotate = -0.6` (= `ROW_TILTS[2]`). `ROW_TILTS` is live in 5 files (`app/sounder.tsx`, `BountyBoard`, `ActiveEffects`, `expedition/CardHand`, `season1/SeasonStory`) — **not dead**.
**Recommendation** `export const TILT = { card: -0.6, tape: -8, dialog: -0.8, row: ROW_TILTS }` so the whole tilt vocabulary is one export. Currently `ConfirmDialog.tsx:91` uses `rotate={-0.8}` and `EmptyState.tsx:33` defaults `-0.6` with no shared name.

### [P3] F-35 · `IconButton.selected` is announced but never drawn
**Location** `components/ui/IconButton.tsx:27`, `:65`, `:67-71`
**Evidence** `accessibilityState={{ disabled, selected }}` — but the style callback applies only `styles.dimmed` for pressed/disabled. No `selected` branch.
**Gap** A sighted user gets no selected affordance; a VoiceOver user gets one. That asymmetry is worse than neither.
**Recommendation** Add `selected && styles.selectedVisual` (sun fill + ink border, matching `SegmentedControl.tsx:107-110` so the two selection treatments agree).

### [P3] F-36 · `TYPE.numeral` has no `lineHeight`; `TYPE.label`/`kicker*` have none either
**Location** `constants/theme.ts:146`, `:152`, `:154`, `:159`, `:163`
**Evidence** `numeral: { fontFamily: FONTS.whimsy, fontSize: 16 }` — the only Caprasimo role without a `lineHeight`, while `display`/`pageTitle`/`sectionTitle`/`cardTitle` all set one. `label`, `kicker`, `kickerPill`, `kickerPillSm` likewise.
**Gap** Caprasimo has tall metrics; a numeral in a flex row inherits RN's default line box and sits differently than an adjacent `cardTitle`. Likely a contributor to the ad-hoc `lineHeight` overrides in `TicketButton.tsx:240,247,254` and `ProfileIdentity.tsx:69-75`.
**Recommendation** Give every `TYPE` role an explicit `lineHeight`. Also add the missing roles the codebase keeps re-deriving: `TYPE.numeralLg` (the 20–26 counters) and `TYPE.labelSm` (11px).

---

## 4. Heuristic scorecard

The three largest/most-consumed primitives get the full pass. 0 = broken, 4 = exemplary.

| Nielsen heuristic | `Button` (34 files) | `Sticker` (58 files) | `ConfirmDialog` (spend path) |
| --- | --- | --- | --- |
| 1 Visibility of system status | 3 — pressed + disabled dim, but **no loading state** | 2 — no pressed feedback at all (F-29) | 2 — `busy` shows only `…`, no spinner or label change |
| 2 Match to real world | 4 — ticket/paper metaphor, gradient + ink outline | 4 — the paper-craft DNA itself | 3 — paper card ✓, but 12px radius + Caprasimo buttons match nothing else |
| 3 User control & freedom | 3 — `disabled`/`locked` clear | n/a | 2 — cancel exists but is unlabelled to AT and has no escape gesture |
| 4 Consistency & standards | 2 — 3 of 7 variants abandon the ink outline (F-19) | 2 — radius/border/opacity as literals (F-01) | 1 — hand-rolls what `Button` + `AdaptiveModalScaffold` already do (F-03) |
| 5 Error prevention | 4 — `disabled` blocks press and is announced | n/a | 3 — confirm/cancel pair ✓, but `destructive` is a flag not a distinct shape |
| 6 Recognition over recall | 3 — variant names are legible (`locked`, `gold`) | 3 — `StickerColor` union aids recall; `EmptyState` discards it | 3 |
| 7 Flexibility & efficiency | 3 — `onLongPress` threaded; `style?: ViewStyle` blocks arrays | 3 — `color` escape hatch is well-typed | 2 — no way to add a third action or custom body |
| 8 Aesthetic & minimalist | 4 — the cozy-gradient treatment is the app at its best | 4 | 3 |
| 9 Error recovery | n/a | n/a | 3 — cancel path ✓ |
| 10 Help & documentation | 4 — excellent inline rationale comments | 3 | 4 — the JSDoc usage example is a model |
| **Mean** | **3.3** | **2.9** | **2.6** |

**P2 design-specificity verdict (whole area): PARTIAL.**
Could an unrelated product use this unchanged? `Sticker`, `TicketButton`, `HangingSignsTabBar`, `PigStage`, `Glyph`, `AlignmentBar`, `RitualIconWell`, `TierUpBanner`'s copy — **no**, emphatically; these could not be lifted into any other app. `Button`'s gradient pills, `Skeleton`, `SegmentedControl`, `AdaptiveModalScaffold`, `DialogCloseRow`, and the 14 Material/Feather icons — **yes**, unchanged, into any RN app. The system is specific at the decorative layer and generic at the interaction layer, which is the inverse of what the taste standard asks for. Paper-craft DNA present: `Sticker`, hard shadow, tilt, whimsy title, hand kicker, `Glyph` art, ticket notch, hanging signs, tape. Missing or faked: soft shadow (`TierUpBanner`), thin non-ink borders (`Button` ghost/success), foreign icon families (`Icon` × 14), linear-fade transitions (`AdaptiveModalScaffold` default `animationType="fade"`).

---

## 5. Token triage

| Cluster | Where | Existing token? | Verdict |
| --- | --- | --- | --- |
| `radius = 14` | `Sticker.tsx:50` + 34 call sites | `RADII.lg` | **Use existing.** Root cause of the app's radius debt. |
| `borderRadius: 999` ×16 | app-wide | `RADII.pill` (106 uses) | **Use existing.** Migration only. |
| `borderRadius: 12` | `ConfirmDialog:174`, `Skeleton:73`, `EmptyState:39` | `RADII.md` | **Use existing.** |
| `br: 27` (Button lg) | `Button.tsx:46` | none | **Missing token** — `RADII.pillLg`, or use `RADII.pill`. |
| `borderWidth` 2/1.5/1/2.5/3/0.75 | 412 app-wide, 22 in `ui/` | **none** | **Missing family** — `BORDER` (F-05). |
| opacity 0.9/0.85/0.72/0.7/0.64/0.6/0.5/0.45/0.4/0.18/0.14 | 150+ app-wide, 11 in `ui/` | **none** | **Missing family** — `OPACITY` (F-05). Five different "pressed" values. |
| `rgba(…)` ×41 app-wide, ×8 in `ui/` | `BarnOverlay`, `HangingSignsTabBar` | `UI_COLORS.scrim` only | **Missing family** — `TINT` (F-05). |
| `#5A3F00`, `#7A9B63`, `#F0B8C8`, `#E8A7B9`, `#F8D068`, `#7052EE` | `Button.tsx:50-85` | partial (`COLORS.purpleDeep`) | **Missing** — `BUTTON_GRADIENT` + `WHIMSY.goldInk` + `UI_COLORS.successBorder`. |
| `#8d5a2c`, `#74441e`, `#7a5223`, `#3a3026` | `HangingSignsTabBar.tsx:55-57,293,465` | none | **Missing family** — `WOOD`. |
| 10 theme hexes | `cosmeticFx.ts:66-77` | none | **Missing** — `COSMETIC_ACCENT` (F-25). |
| 38 icon fill hexes | `Icon.tsx` | `WHIMSY.sun`, `slopGold`, `COLORS.purple/success/sky` | **Use existing**; `Icon.tsx` imports no tokens today. |
| `#1A1A1A` icon default | `Icon.tsx:682` | `UI_COLORS.textPrimary` | **Use existing.** Wrong black in 12 call sites. |
| `#000` blurred shadow | `TierUpBanner.tsx:208-212` | `STICKER_SHADOW` | **Use existing** — or name a third hard tier. |
| shadow `{0,-2}`, `{2,3}`, SVG `5`/`3` | `HangingSignsTabBar:385,443`, `TicketButton:58` | 2 tiers exist | **Redundant near-duplicates**; 6 tiers total, 2 sanctioned. |
| `fontSize` ×31 in `ui/` (11 ×10, 12 ×4, 13 ×3, 14 ×3, 15 ×3, 16/17/18/20/24/26/28) | 11 files | `TYPE` (15 roles) | Mostly **use existing**; genuinely missing: `labelSm` (11), `numeralLg` (20–26). |
| `...TYPE.role, fontSize: X` ×8 | `TicketButton`, `ProfileIdentity` | `cardTitleSm`/`kickerPillSm` exist for this | **Missing roles** — add `cardTitleXs`, `labelSm`; precedent documented at `theme.ts:143,160`. |
| `SPACE.sm + 2` (=10), `SPACE.md + 2` (=14), `SPACE.xl + 4` (=28) | `EmptyState:90`, `SlideUpSheet:118-119` | `SPACE` 4/8/12/16/24 | **Missing steps** — the arithmetic is the scale telling you it needs `SPACE.smd: 10` and `PAGE_PAD` (18) in gap position. |
| `ruleWidth = 64` | `SectionHeader:34`, `PageHeader:32` | none | **Missing token** — `RULE_WIDTH`. Called "canonical" in JSDoc, written twice. |
| `duration:` × 79, 35 distinct | app-wide | `MOTION_DURATION` (5 roles, 8 importers) | **Use existing** for ~40 of them; add `pulse`, `cosmetic.*`. |
| `Animated.spring({…})` × 20, 14 configs, 2 parameterizations | app-wide | **none** | **Missing family** — `MOTION_SPRING` (F-08). |
| `COLORS.*` × 15 | 11 files incl. `Button.tsx:53` | `WHIMSY`/`UI_COLORS` cover 10 of 15 | **Redundant legacy** (F-14); `COLORS.successText` also fails AA. |
| `#a89bff`, `#8c7e71`, `#f5c44a`, `#c99b23`, `#e8f5e0` each defined twice | `theme.ts` | — | **Redundant within the token file itself** (F-15). |
| `KICKER_TEXT` / `KICKER_PILL` vs `TYPE.kicker*` | 284 sites total | both exist | **Redundant** (F-24) — composites bake a color the file's own doctrine forbids. |
| `Colors.light/dark` | `constants/Colors.ts` | — | **Dead-ish** — reachable only from `app/+not-found.tsx` (F-23). |
| `ROW_TILTS` | `theme.ts:206` | — | **Live** (5 files). Not dead; fold into a `TILT` family (F-34). |

### Contrast audit (P6 · every sanctioned pair; **bold** = below AA 4.5:1)

| fg \ bg | paper | cream | cream2 | rose | roseDeep | sky | sage | sun | lilac | lilacDeep | peach | slopGold | slopBand | goblin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ink` #2a1f15 | 15.46 | 14.12 | 13.17 | 12.18 | 8.61 | 12.03 | 11.26 | 11.76 | 10.25 | 6.74 | 10.79 | 9.87 | 13.24 | 7.02 |
| `mute` #605449 | 7.05 | 6.44 | 6.01 | 5.56 | **3.93** | 5.49 | 5.14 | 5.37 | 4.68 | **3.07** | 4.92 | **4.50** | 6.04 | **3.20** |
| `muteSoft` #8c7e71 | **3.78** | **3.45** | **3.22** | **2.98** | **2.11** | **2.94** | **2.75** | **2.88** | **2.51** | **1.65** | **2.64** | **2.41** | **3.24** | **1.72** |
| `accent` #a13f30 | 6.17 | 5.64 | 5.26 | 4.86 | **3.44** | 4.80 | **4.50** | 4.70 | **4.09** | **2.69** | **4.31** | **3.94** | 5.29 | **2.80** |

Bark surface: `barkText` 12.30 ✓ · `barkMute` 9.73 ✓ · `sun` (kicker-on-bark) 9.85 ✓ · `slopGold` 8.26 ✓ — **the bark family is the best-behaved in the system.**

Button variants: `gold` `#5A3F00` on `#F5C44A` **6.00 ✓** (on the gradient's light stop `#F8D068`, 6.62 ✓) · `purple` `#fff3e2` on `#7052EE` **4.64 ✓** (just clears; on `#5C3FE0` 5.91 ✓ — the `:51-52` comment's fix is confirmed correct) · `primary` ink on `#F0B8C8`/`#E8A7B9` 9.50/8.17 ✓ · `dark` 14.69 ✓ · `ghost` 15.46 ✓ · `locked` `mute` on `cream2` 6.01 ✓ · `success` text 5.91 ✓ but **border 2.77 ✗** (non-text floor is 3:1).

Semantic pairs: `warningText` 5.74 ✓ · `infoText` 4.51 ✓ (0.01 of margin) · `dangerText` 5.34 ✓ · `separator` on paper 3.78 (non-text ✓).
Non-text marks below 3:1 on paper: `bless` 2.46 · `flame` 2.27 · `goblin` 2.20 · `angel`/`lilacDeep` 2.29 · `slopGold` 1.57 · all five `RARITY_STRIPE` (1.73–3.40). None are text today; nothing in the type system prevents them becoming text.
Legacy: `COLORS.successText #5A8338` on `successBg` **3.92 ✗** (live as text in 3 files) · `COLORS.ink4 #9A9A9A` on `paper3` **2.46 ✗**.
Stale doc: `DESIGN.md`'s `accent #c25a3f` on paper **4.18 ✗** — the fail that motivated the change.

---

## 6. What's working — keep and replicate

1. **Comment-as-decision-log inside `theme.ts`.** Every token added since June carries *why it exists and what it replaced* (`:40-52` blessing/curse, `:34-39` Slop Club, `:25-30` bark, `:143-145` `cardTitleSm`, `:171-174` `RADII.pill`). This is the single best governance artifact in the repo — a reader can tell a deliberate token from an accidental one. Make it a requirement: **no new token without a provenance comment.**
2. **`__tests__/colorSystem.test.ts`.** An executable contrast contract *and* an appearance contract (asserts `app.json`, `Info.plist`, and the native splash colorset all agree with `UI_COLORS.canvas`; asserts `_layout.tsx` contains no `DarkTheme`/`useColorScheme`). Extend it (F-06, F-07) rather than replace it; it is the template for the motion and token-literal guards this audit asks for.
3. **`PageHeader.tsx`.** 89 lines, zero literals, every spacing from `SPACE`, every type from `TYPE`, 44pt back target, `accessibilityRole` + label. **This is what a conformant primitive looks like** — use it as the reference in the API contract (F-12).
4. **`AdaptiveModalScaffold.tsx`.** Window-sized not module-snapshot, safe-area aware, compact-height aware, always gives dense content a scroll path, `accessibilityViewIsModal` + `onAccessibilityEscape`, and an `inline` presentation escape hatch for the iOS one-modal constraint. Best engineering in the folder.
5. **The 2026-07-07 `locked` ruling, implemented exactly.** `Button.tsx:66-74` + `:141` — full chrome, no opacity crush, with the reasoning in the comment. A decision-log entry that actually changed the code and stayed changed.
6. **`useMotionPolicy` as a *policy*, not a flag.** `duration(standard, reduced)` and `largeTransition: "motion" | "crossfade"` let a component degrade rather than freeze; `startDecorativeLoop` gives loops a `rest()` pose. `AnimatedBackground.tsx:46-54` and `TierUpBanner.tsx:59+` are the model implementations. The abstraction is right; only adoption is short.
7. **`SegmentedControl.tsx`.** `radiogroup`/`radio` roles, `accessibilityState.selected`, 44pt segments, a required `label`, `numberOfLines={2}` so accessibility text sizes don't clip. Under-used, not under-built.
8. **`TicketButton`'s single-path chrome.** `TICKET_PATH` drawn once so the ink outline, fill, stub and hard shadow all follow the notch — with the comment explaining that cutout `View`s leave hairline seams at other pixel densities. And its press (5→3px offset) is the most physical, most paper-craft-correct interaction in the app — it should become `Sticker`'s press (F-29).
9. **`PigStage.resolveSlot` / `placement_studio` / `hat_rel.generated.ts` as a generated-token pipeline.** Cosmetic anchors are authored in a tool and compiled to a sorted rebuild-all file, single-writer. This is the model for every other generated token (`RARITY_*`, `COSMETIC_ACCENT`, and a regenerated `DESIGN.md`).
10. **The dingbat ruling (2026-07-13)** drew the line by *what the mark does*, not what it is. That reasoning generalizes — apply it verbatim to settle `Glyph` vs `Icon` (F-10).

---

## 7. System asks

What the design system must add so this area can be rebuilt from it alone.

**Tokens**
1. `BORDER = { hairline:1, thin:1.5, ink:2, inkThick:2.5, rail:3 }` — 412 literals have no home.
2. `OPACITY = { pressed, dim, gated, disabled, ghost, wash }` — and **one** `pressed` value, replacing the five in `Button`/`SegmentedControl`/`IconButton`/`ConfirmDialog`/`Spotlight`.
3. `TINT = { angel, goblin, miasma, highlight, well }` — the 41 `rgba()` scrims and washes.
4. `MOTION_SPRING = { tap, settle, sway, overshoot }`, one parameterization only; `MOTION_DURATION` gains `pulse` and a `cosmetic` family.
5. `BUTTON_GRADIENT` + `WHIMSY.goldInk` (`#5A3F00`) + `UI_COLORS.successBorder` — get the CTA's hexes out of `Button.tsx`.
6. `WOOD = { top, bottom, frame, nail, grain }` — the tab bar deserves the treatment `bark` got.
7. `COSMETIC_ACCENT` — `cosmeticFx.ts`'s 10 theme hues, moved into the palette.
8. `TILT = { card:-0.6, dialog:-0.8, tape:-8, row: ROW_TILTS }` — one tilt vocabulary.
9. `RULE_WIDTH = 64`; `SPACE.smd = 10`; `RADII.pillLg = 27`; `TYPE.labelSm` (11), `TYPE.cardTitleXs` (17), `TYPE.numeralLg` (20–26), and a `lineHeight` on **every** `TYPE` role.
10. A **text-safe disabled ink** (`WHIMSY.muteDim`) so `textDisabled` stops meaning a 3.78:1 color; rename today's to `UI_COLORS.uiMuted` and forbid it as text.
11. An `accent` that clears AA on all 12 `StickerColor` fills (or a documented `accentOnTint` second step).

**Primitives** (ranked by literals retired per unit of work)
12. **Text role components** — `<Display> <PageTitle> <SectionTitle> <CardTitle> <Body> <BodySm> <Label> <Kicker> <KickerPill> <Numeral>`, each owning color-by-default and the `★ ` prefix where it applies. Retires most of 521 bare `fontSize` mechanically and kills `ThemedText`.
13. **`ListRow`** — `Sticker` + tilt from `ROW_TILTS` + leading/title/subtitle/trailing slots + press + `accessibilityRole`. The app is mostly lists.
14. **`Chip` / `Pill`** — `RADII.pill`, ink border, `SHADOW_SM`, tone variants, optional `Glyph`/`Icon`, optional dismiss.
15. **`Sticker` press support** — `onPress` renders a `Pressable` with the shadow-collapse press and a11y forwarding. One change, 58 files.
16. **`Card` slots on `Sticker`** — `title` / `right` / `footer`, so the title row is decided once instead of 58 times.
17. **`Sheet`** — the *panel*, not just the chrome: paper body, `SheetGrabber`, padding, safe-area bottom, optional header row. `SlideUpSheet` becomes its animation layer.
18. **`Toast`** — promote and generalize `components/PurchaseToast.tsx` into `ui/`.
19. **`Stat`** — `TYPE.numeral` + `Glyph`/`Icon` + label, the count readout the app repeats everywhere.
20. **`Spinner` / `Busy`** — a cozy beat that retires the 11 naked `ActivityIndicator`s, including the one inside `TicketButton`.
21. **`Field`** (text input) and **`ProgressBar`** — currently no primitive at all.
22. **`ConfirmDialog` rebuilt as a composition** of `AdaptiveModalScaffold` + `Sticker` + two `Button`s, with `destructive` promoted to a `Button` variant and `busy` to a `Button` `loading` state.

**Rules and process**
23. **A primitive API contract** in `taste-standard.md`: `open`/`onClose`; `label` = visible text; `variant` is the only semantic axis; `size` is `sm|md|lg`; every primitive takes `style?: StyleProp<ViewStyle>` and forwards `testID` + the four `accessibility*` props; interactive primitives require `onPress`.
24. **`Glyph` vs `Icon` ruling** — `Icon` = interface affordances, `Glyph` = subject matter; delete the 16 duplicate names; log the decision.
25. **`components/ui/index.tsx` exports everything**, and the barrel becomes the only sanctioned import path (it currently covers 8 of ~45).
26. **A "which primitive do I reach for?" table** in the taste standard — the adoption gap (F-28) is a discovery problem.
27. **Shadow inventory closed at two tiers** — or every extra tier named and logged (`TICKET_SHADOW`, `SIGN_SHADOW`, `RAIL_SHADOW`) and `TierUpBanner`'s blur deleted.
28. **Extend `colorSystem.test.ts`** to sweep `accent`, `mute`, and `textDisabled` across **all 12** `StickerColor` tokens (not the 9 "calm" ones), to assert non-text pairs (button borders, `RARITY_STRIPE`) ≥ 3:1, and to assert nothing imports `@/constants/Colors`.
29. **A literals guard** beside it: fail CI on a numeric literal in a `components/ui/*` default parameter or `StyleSheet`, and on a bare `Animated.spring({` config outside `MOTION_SPRING`.
30. **`DESIGN.md` regenerated from `theme.ts`** (or explicitly demoted with a "historical export" header). A design doc that states a below-AA accent and a retired Streak metaphor as current fact is worse than no design doc.
