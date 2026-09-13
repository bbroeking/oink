# Findings — Area C · Season / Contend / Dig

Auditor C. 57 files, ~19,000 lines: the Season tab and its `season1/` composition, the Dig-Off standings +
Leaderboard, the Truffle Patch dig and its sheets, the Bounty board, the Expedition prototype, and three shared
`ui/` primitives that only this area mounts.

---

## 1. Area summary

This is the app's **Contend** surface and it is, structurally, the most ambitious work in the codebase: `season.tsx`
composes eleven sub-surfaces into one scroll, `TrufflePatch.tsx` is a live gesture game with per-tile VoiceOver
actions and custom accessibility rotor verbs, and `race-standings.tsx` carries three lenses (week / history /
season) × two metrics without ever showing a ladder you can fall down. Token adoption is genuinely high in the
newest files — `vlStyles` (the pass track), `contraptions.tsx`, `dig-collection.tsx` and `digging-stats.tsx` are
close to token-pure, and the dig's tension reads as a *word* ("calm" → "he's lifting his snout") rather than a
number, which is exactly the taste law.

The single biggest systemic gap is **the interaction layer has no governance at all**. Color, type, radius and
spacing each have a token family and roughly 70–85% adoption here; *pressed*, *disabled*, *shadow-tier*,
*border-width* and *opacity* have none, and the area has independently invented **nine different pressed states,
five disabled-by-dissolve crushes, four extra shadow tiers past the sanctioned two, four segmented-control
implementations (one primitive already exists), and three page crowns**. Two of those unowned lanes have produced
real accessibility failures: the season pass's READY and CLAIMED badges sit at **1.8:1 and 2.0:1** contrast, and
every snout/truffle **spend** button in the area ships with zero accessibility props.

No P0. There is **no emoji in any render** in this area (the two the baseline counted — `🔒` in `season.tsx:236`,
`🪙` in `BountyCard.tsx:178` — are both inside comments), **no `Alert.alert`**, and **no black wrapper on a screen**.

**Counts:** P0 · 0 | P1 · 11 | P2 · 18 | P3 · 5

---

## 2. Inventory table (P5)

| Element | Where | Primitive or hand-rolled | States present | Duplicate elsewhere |
| --- | --- | --- | --- | --- |
| Season page crown | `season.tsx:1417–1434` | **hand-rolled** (kicker + title + rule + 3 icon btns) | default, pressed | `PageHeader` (`dig-collection.tsx:87`, `digging-stats.tsx:105`) |
| Dig-Off page crown | `race-standings.tsx:162–183` | **hand-rolled** (back + kicker + hangers + Sticker plaque) | default, pressed | same |
| Contraptions crown | `contraptions.tsx:152–172` | **hand-rolled** (back chip + centered kicker/title) | default, pressed | same |
| Section header | `season.tsx:1571,1668,1848`, `dig-collection.tsx:104`, `BountyBoard.tsx` | `SectionHeader` ✓ | default | — |
| Pass tier row (node + card) | `season.tsx:268–400`, `vlStyles:757–870` | hand-rolled card (not `Sticker`) | claimed · ready · locked · pressed | — |
| Tier state badge | `season.tsx:316–333` | hand-rolled | claimed · ready · locked | `stateTag` in the same row (two badges, same state) |
| Stats pills (CLAIMED/READY/LOCKED) | `season.tsx:249–263` | hand-rolled, display-only | static | — |
| Free/Premium track toggle | `season.tsx` `PassTrackTabs`, `passTabStyles:887–912` | **hand-rolled** | selected · idle | **`SegmentedControl`** exists; `Leaderboard.tsx` uses it ×2 |
| Period toggle (week/past/season) | `race-standings.tsx:405–419` | **hand-rolled** `SegmentPill` | selected · idle | same |
| Metric toggle (per snout/overall) | `race-standings.tsx:422–474` | **hand-rolled** `MetricToggle` | selected · idle | same |
| Claim-all bar | `season.tsx:630–693` | hand-rolled | default · pressed · busy | — |
| Claim CTA (tier row) | `season.tsx:396–400` | `Button variant="dark"` ✓ | default · pressed | — |
| Claim CTA (bounty) | `BountyCard.tsx:225–246` | **hand-rolled** `cta` | ready · claimed · in-progress · busy | `Button` primitive |
| Claim CTA (verdict) | `JudgementDayModal.tsx:199–210` | **hand-rolled** `claimBtn` | default · pressed | `Button` primitive |
| Slop Club unlock chip | `season.tsx:1698–1724` | hand-rolled | live · coming-soon | `Button variant="gold"` |
| Spend CTA (bury) | `BuryTruffleSheet.tsx:137–145` | **hand-rolled** `buryBtn` | default · disabled · busy | `Button` primitive |
| Spend CTA (top-up / reclaim) | `BuriedTruffleSheet.tsx:231,249` | **hand-rolled** | default · disabled · armed | — |
| Spend CTA (exchange buy) | `TruffleExchangeSheet.tsx:160–190` | **hand-rolled** | default · owned · unaffordable | — |
| Reroll pill (spend) | `BountyCard.tsx:200–212` | **hand-rolled**, ~22pt | default · pressed · busy | — |
| Wind button (spend acorns) | `contraptions.tsx:304–320` | hand-rolled, **fully labelled** ✓ | default · disabled · busy · pressed | — |
| Stake chips | `BuryTruffleSheet.tsx:112–132`, `BuriedTruffleSheet.tsx:202–228` | hand-rolled | selected · idle · unaffordable | `SegmentedControl` (radiogroup semantics) |
| Bottom sheet chrome | `BuryTruffle`, `BuriedTruffle`, `TruffleCatalog`, `EnemyBreakdown`, `TickleBreakdown` | `SlideUpSheet` ✓ | open · closing | — |
| Bottom sheet chrome | `TruffleExchangeSheet.tsx:101–105` | **hand-rolled** raw `<Modal>` + duplicate grabber | open | `SlideUpSheet` + `SheetGrabber` |
| Modal (season) | `season.tsx:2082,2126,2515`, `HungerHero:275`, `SeasonGuideModal:101`, `SeasonInfoModal:61`, `DevSeasonStatesSheet:64` | raw `<Modal>` | visible | `AdaptiveModalScaffold` (used 3× in area) |
| Modal (ceremony) | `SeasonEndModal:175`, `JudgementDayModal:114`, `AlignmentSchismModal:180`, `GreatHungerIntroModal:50` | raw `<Modal>` | visible · skipping | — |
| Dialog close row | — | **absent everywhere** | — | `DialogCloseRow` used 0× in this area |
| Confirm dialog | `BountyCard.tsx:247`, `SeasonGuideModal.tsx` | `ConfirmDialog` ✓ | open | `BuriedTruffleSheet` arm-then-confirm (inline) |
| Empty state | `season.tsx:1387`, `race-standings.tsx:366`, `TrainingSheet`, `CardHand` | `EmptyState` ✓ | empty | — |
| Loading state | `season.tsx:1380`, `race-standings.tsx:509`, `contraptions.tsx:184`, `TruffleCatalogSheet` | `LoadingBeat` ✓ | loading | — |
| Dig board tile | `TrufflePatch.tsx:1078–1120` | hand-rolled, **full a11y actions** ✓ | buried · charging · silhouette · revealed · cleared · gilded | — |
| Stir meter | `TrufflePatch.tsx:965–979` | hand-rolled | calm · stirring · waking | `GreatHungerMeter.tsx` (same concept, different drawing) |
| Standings row | `race-standings.tsx:918–970`, `Leaderboard.tsx:318+` | hand-rolled ×2 | default · mine · pressed · expanded · muted | two implementations of one row |
| Postcard card | `DigPostcardInbox.tsx:166–207` | hand-rolled, 6 raw hex | unread · cheered · waiting | `PostcardModal.tsx` (expedition) |
| Bounty card | `BountyCard.tsx:264–280` | hand-rolled tilt + border + shadow | in-progress · ready · claimed · rerolled | `Sticker` primitive |
| Celebration overlay | `TierUpBanner.tsx:167–190` | hand-rolled, **soft shadow** | entering · resting · reduced-motion | `Ceremony.tsx` (expedition) |
| Icon art | `Glyph` 48× / `Icon` 32× across area | ✓ consistent, no mixed icon families | — | — |
| Shovel / SnoutCoin | `ui/Shovel.tsx`, `ui/SnoutCoin.tsx` | inline SVG | static | — |

---

## 3. Findings

### [P1] C-01 · Nine pressed states, no token
**Location** `season.tsx:2380–2391` · `YourTakeStrip.tsx:103,146,174` · `SounderHomeCard.tsx:165,371,376,391` ·
`SounderStepCard.tsx:156,181,289` · `TruffleExchangeSheet.tsx:165,182,209` · `BountyCard.tsx:206,240` ·
`contraptions.tsx:434` · `MoteMachineCard.tsx:73` · `race-standings.tsx:378,923`
**Prompt(s)** P4, P5, P8 (Jakob), P10(e)
**Evidence** The same "this is being pressed" affordance is drawn nine ways in one area:
`opacity: 0.5` · `0.6` · `0.65` · `0.7` · `0.76` · `0.85` · `0.9` · `transform: [{scale: 0.97}], opacity: 0.86`
(`contraptions.tsx:434`) · `transform: [{translateX:2},{translateY:2}], shadowOpacity: 0` (the sink-into-shadow
idiom, `season.tsx:2380`). `season.tsx` defines `headerBtnPressed` and `chipPressed` as byte-identical duplicates
eleven lines apart.
**Expected standard** Taste standard §"Motion has weight and warmth" and the paper-craft DNA: a sticker that is
pressed **sinks into its own hard shadow**. That is a specific, hand-made behaviour — 22 sibling call sites instead
fade it like a web link.
**Gap** No `PRESSED` token and no pressable primitive owns the behaviour, so every file re-guesses an opacity.
**Recommendation** Add `PRESSED` to `constants/theme.ts` as the sanctioned sink (`{ transform:[{translateX:2},
{translateY:2}], shadowOpacity: 0, elevation: 0 }`) plus `PRESSED_FLAT` (`{ opacity: 0.7 }`) for the shadowless
case, and export a `Pressable`-wrapping `Tappable` primitive that applies the right one based on whether the style
carries a shadow. Ban bare `pressed && { opacity: … }` in review.
**Pillar** Craft / governance — the interaction layer is the last ungoverned lane.

### [P1] C-02 · The pass track's state badges fail contrast at 1.8:1 and 2.0:1
**Location** `app/(tabs)/season.tsx:320`, `328`, `786`, `789–794`
**Prompt(s)** P3 (color contrast), P6
**Evidence**
`cornerBadgeClaimed: { backgroundColor: COLORS.success }` (`#5BC97D`) carrying
`<Icon name="check" size={11} color={WHIMSY.paper} …/>` → **2.00:1**.
`cornerBadgeReady: { backgroundColor: WHIMSY.roseDeep }` (`#f8a8b3`) carrying
`cornerBadgeText: { color: WHIMSY.paper }` rendering `!` → **1.80:1**.
The comment at `:785` claims the saturated fill was chosen "so the paper check reads with contrast."
**Expected standard** WCAG AA: 4.5:1 for the `!` (it is text) and 3:1 for the check (a non-text state indicator).
`UI_COLORS` already carries `successText`/`successSurface` for exactly this.
**Gap** The READY badge is the single most important state on the season pass — the mark that says *a reward is
claimable right now* — and it is the least legible thing on the card. Both badges invert the app's own rule that
ink rides pastel.
**Recommendation** Swap both marks to `WHIMSY.ink` (→ **8.61:1** on `roseDeep`, **7.73:1** on the green) and
retire `COLORS.success` here in favour of `WHIMSY.sage` + ink, matching the `stateTagClaimed` pill six lines below
that already does it correctly. System rule: **badge glyphs are always ink on a pastel fill; paper-on-pastel is
never a legible pair in the WHIMSY palette.**
**Pillar** Collect — you cannot claim what you cannot see is claimable.

### [P1] C-03 · Every snout- and truffle-spend control in the area is unlabelled
**Location** `BuryTruffleSheet.tsx:112,125,137` · `BuriedTruffleSheet.tsx:202,218,231,249` ·
`TruffleExchangeSheet.tsx:160,177,209` · `BountyCard.tsx:200,225` · `TruffleCatalogSheet.tsx:113` ·
`EnemyBreakdownSheet.tsx` · `TickleBreakdownSheet.tsx` · `SeasonEndModal.tsx:204` · `JudgementDayModal.tsx:199` ·
`AlignmentSchismModal.tsx` · `TrainingSheet.tsx`
**Prompt(s)** P1 (h5, h6), P6
**Evidence** 20 `Pressable`s across 11 files carry **zero** `accessibilityRole` / `accessibilityLabel` /
`accessibilityState`. Among them: `Bury for visitors · ${stake} snouts` (`BuryTruffleSheet.tsx:137`), the
5/10/25/Max stake chips that are a radio group with no radio semantics (`:112`), `Swap · ${REROLL_COST}` snouts
(`BountyCard.tsx:200`), the truffle Exchange buy buttons (`TruffleExchangeSheet.tsx:160`), and the **only escape
from a full-screen season-end ceremony** (`SeasonEndModal.tsx:204`, the "Skip" chip).
**Expected standard** Baseline: 70 of 98 files with pressables carry accessibility props; `contraptions.tsx:304–311`
in this same area is the model — `accessibilityRole`, `accessibilityState={{disabled, busy}}`, and a label that
names the cost.
**Gap** A screen reader user cannot tell a stake chip from a buy button, cannot hear what a purchase costs, cannot
hear that a control is disabled, and cannot find the way out of the ceremony.
**Recommendation** Route every spend CTA through the `Button` primitive (it already takes `accessibilityLabel`,
`accessibilityState`, `accessibilityHint`) and every selection chip group through `SegmentedControl` (it already
emits `radiogroup`/`radio` + `selected`). New system rule: **a control that moves currency must state its cost in
its accessibility label.** Close affordances get `DialogCloseRow`, which is used zero times in this area.
**Pillar** Collect / Craft — "fair by construction" has to include *legible* by construction.

### [P1] C-04 · Primary actions below the 44pt minimum
**Location** `race-standings.tsx:743` (`backBtn: minHeight: 30`), `:784` (`segBtn: minHeight: 38`), `:853`
(`metricBtnCompact: minHeight: 30`, and `compact` is the variant actually mounted at `:331`) ·
`SounderHomeCard.tsx:594` (`joinBtn: minHeight: 32`, `paddingVertical: 5`) ·
`BountyCard.tsx:324–327` (`rerollBtn: paddingVertical: 4` + 11px text ≈ 22pt, no `hitSlop`) ·
`BountyCard.tsx:381–384` (`cta: paddingVertical: 8` + 13px text ≈ 33pt)
**Prompt(s)** P6, P8 (Fitts)
**Evidence** Five of the six are the *primary* action of their surface: go back, switch the board, switch the
metric, **join a Sounder**, spend snouts to swap a bounty.
**Expected standard** `IconButton`'s doc comment: "a semantic icon action with a **guaranteed 44pt hit target**…
the tappable frame never shrinks." `PageHeader.backBtn` is `minHeight: 44, minWidth: 44`. `race-standings.tsx:868`
even comments "Arrow targets stay at the iOS 44pt minimum" — for the week arrows, three styles above a 30pt back
button.
**Gap** The rule is known and written down in two primitives; it is not enforced where the control is hand-rolled.
**Recommendation** Add a `TAP_MIN = 44` token; give `Button size="xs"` a `minHeight: 44` floor with the *visual*
height driven by padding (the `IconButton` `visualSize` vs frame split, generalised). Hand-rolled pressables must
carry `TAP_MIN` or an explicit `hitSlop` that reaches it.
**Pillar** Connect — "join a Sounder" is the pillar's front door and it is a 32pt target.

### [P1] C-05 · Four segmented controls, one primitive, and a comment asserting the primitive doesn't exist
**Location** `season.tsx:885–886` + `passTabStyles:887–912` · `race-standings.tsx:405–419` (`SegmentPill`) ·
`race-standings.tsx:422–474` (`MetricToggle`) · vs `Leaderboard.tsx` (`SegmentedControl` ×2) and
`components/ui/SegmentedControl.tsx`
**Prompt(s)** P1 (h4), P5
**Evidence** `season.tsx:886` — `// Mirrors the app's pill/segment look (ink outline, whimsy font) — there's no
shared segment primitive.` There is: `components/ui/SegmentedControl.tsx`, exported from `components/ui/index.tsx`,
with `SegmentOption` icons, `accessibilityRole="radiogroup"`, per-option `selected` state, and full 44pt targets.
`race-standings.tsx` then hand-rolls **two more** in one file — one as `role="tablist"/"tab"` (`:275`, `:412`), the
other as `role="radiogroup"/"radio"` (`:434`, `:438`) — so the same "pick one of these" gesture is announced two
different ways on the same screen.
**Expected standard** Taste standard rule 1 + the "use the shared primitives" clause of `CLAUDE.md`.
**Gap** Three divergent looks (`FONTS.display` 13 vs `FONTS.bodyExtra` 13 vs `FONTS.whimsy` 15), three target
sizes (38 / 30 / 44), two a11y vocabularies, one primitive.
**Recommendation** Delete `PassTrackTabs`, `SegmentPill` and `MetricToggle`; mount `SegmentedControl`. Delete the
stale comment at `season.tsx:886`. If the pass tabs need a locked/premium affordance the primitive lacks, add a
`disabled`/`badge` prop to `SegmentedControl` rather than forking it. Rule: **only the primitive announces a
mutually-exclusive choice, and it always says `radiogroup`.**
**Pillar** Craft / governance.

### [P1] C-06 · Four shadow tiers past the sanctioned two
**Location** `ui/TierUpBanner.tsx:208–212` · `JudgementDayModal.tsx:310–314` · `BountyCard.tsx:271–277` ·
`BountyCard.tsx:288–293`
**Prompt(s)** P2, P3 (layout), P10(i)
**Evidence**
```
TierUpBanner:  shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: {0, 8}, elevation: 12
JudgementDay:  shadowOffset: { width: 3, height: 3 }, elevation: 3   // claimBtn
BountyCard:    shadowOffset: { width: 3, height: 3 }, elevation: 3   // card — comment: "matches Sticker primitive"
BountyCard:    shadowOffset: { width: 1.5, height: 1.5 }, elevation: 2  // iconWell
```
**Expected standard** `theme.ts:321–325`: "`SHADOW_SM` … the lighter companion to `STICKER_SHADOW` (4,4) — the
**ONLY** two shadow tiers per the June 2026 UI audit. The retired soft `SHADOWS.card` export … was deleted here so
no new surface can import a soft-shadow slop template."
**Gap** `TierUpBanner` is the app's *only* soft shadow (per the whole-app baseline) and it lands on the season's
celebration moment — the one beat that should look most hand-made. `BountyCard`'s comment claims parity with
`Sticker` while using a different offset.
**Recommendation** `TierUpBanner.banner` → `STICKER_SHADOW`; `JudgementDayModal.claimBtn` and `BountyCard.card` →
`STICKER_SHADOW`; `BountyCard.iconWell` → `SHADOW_SM`. Then make the rule mechanical: **`shadowOffset` and
`shadowRadius` may not be written literally outside `constants/theme.ts`.**
**Pillar** Craft / the sticker language.

### [P1] C-07 · Disabled controls are still being dissolved
**Location** `BuryTruffleSheet.tsx:183` (`chipOff: { opacity: 0.4 }`), `:200` (`buryBtnOff: { opacity: 0.45 }`) ·
`race-standings.tsx:887` (`weekArrowDisabled: { opacity: 0.28 }`) · `contraptions.tsx:409`
(`windDisabled: { opacity: 0.5 }`) · `TruffleCatalogSheet.tsx:155` (`thumbLocked: { opacity: 0.32 }`) ·
`TruffleExchangeSheet.tsx:295` (`buyBtnOff: { opacity: 0.7 }`) · `WindowStrip.tsx:155` (`segIdle: { opacity: 0.5 }`)
**Prompt(s)** P1 (h4), P3 (button usability), P10(j)
**Evidence** Seven outlined, ink-bordered controls whose disabled state is a blanket opacity crush down to as low
as **0.28**.
**Expected standard** Taste-standard decision log, 2026-07-07: *"the `locked` Button variant is now 'a button,
asleep' … it now carries full button chrome: the signature 2px ink outline, `paper3` fill, `ink4` text, and **no**
opacity crush … Rule going forward: waiting/cooldown states keep the control's shape — you mute the fill, you never
dissolve the outline."*
**Gap** The ruling was applied inside `Button` and nowhere else. Every hand-rolled control in this area still
dissolves. At 0.28 the Dig-Off's "older week" arrow stops reading as a control at all.
**Recommendation** Add a `DISABLED` style token to `theme.ts` implementing the ruling
(`{ backgroundColor: UI_COLORS.surfaceStrong, borderColor: UI_COLORS.border, color: UI_COLORS.textDisabled }`) so
hand-rolled controls can consume the ruling without adopting `Button` wholesale. Grep-ban `opacity` in any style
whose name matches `/Off$|Disabled$|Locked$/`.
**Pillar** Craft / hierarchy & comprehension.

### [P1] C-08 · The dig — the area's most animated surface — ignores Reduce Motion entirely
**Location** `components/mudwar/TrufflePatch.tsx` (40 `Animated.*` drivers, **0** references to `useMotionPolicy`)
· `components/mudwar/ReclaimSlam.tsx` (5 drivers, 0)
**Prompt(s)** P6, P10(e)
**Evidence** `TrufflePatch` runs tile reveal springs (`:700`), a press-charge telegraph (`:424,439`), a Hungerer
flinch (`:465–472`), a reveal beat (`:486–494`), a stir-meter fill (`:685`), big-truffle pops (`:592,599`) and a
dirt-fleck field (`:2133`) with no policy check. `hooks/useMotionPolicy.tsx` exists and exposes
`reduceMotion` + `allowDecorativeMotion`; `TierUpBanner`, `SeasonEndModal`, `AlignmentSchismModal`,
`AlignmentExplainerModal`, `TruffleButton`, `GreatHungerMeter`, `Ceremony`, `PostcardModal` and `PigStage` all
consume it.
**Expected standard** Brief P6: "Reduce Motion has a still or crossfade alternative for every decorative loop."
**Gap** The one screen a Reduce-Motion player is most likely to be hurt by — a shaking, flecking, popping gesture
game they must stay in for a full feeding — is the one screen that never asks.
**Recommendation** Mount `useMotionPolicy()` in `TrufflePatch` and gate the three *decorative* systems (dirt flecks
`:2096+`, Hungerer wobble/flinch, reveal-beat overshoot) on `allowDecorativeMotion`, while keeping the two
*informational* ones (tile reveal, stir fill) as instant state changes under `reduceMotion`. Same for
`ReclaimSlam`. System rule: **a file that imports `Animated` imports `useMotionPolicy`.**
**Pillar** Contend — the dig is the race; it has to be runnable by everyone.

### [P1] C-09 · The truffle-spend sheet re-hand-rolls the sheet chrome that exists to stop exactly this
**Location** `components/mudwar/TruffleExchangeSheet.tsx:101–105`, `:231`
**Prompt(s)** P1 (h4), P5, P10(e)
**Evidence**
```tsx
<Modal visible transparent animationType="slide" onRequestClose={onClose}>
  <View style={styles.backdrop}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
    <View style={[styles.sheet, { maxHeight: screenH * 0.85 }]}>
      <View style={styles.grabber} />
```
and `grabber: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, … }`.
**Expected standard** `components/ui/SlideUpSheet.tsx:1–15` — "this owns only the Modal, the scrim, the slide, and
the bottom anchoring, **which were hand-rolled identically in** `BuryTruffleSheet` / `BuriedTruffleSheet` /
`TruffleCatalogSheet` / `EnemyBreakdownSheet` / `TickleBreakdownSheet` / `HoofprintsSheet`. The grabber pill those
panels put at the top is exported as `SHEET_GRABBER` so the 44×4 hairline stays one definition." The five sheets
named were migrated; this one — added since — was not.
**Gap** Worse than a duplicate: `animationType="slide"` is the exact behaviour the primitive's comment says to
avoid ("drags the whole full-screen scrim up as one body, which reads as a grey flash"). The Golden Truffle
Exchange — a *spend* surface — is the one sheet in the app that opens with a grey flash.
**Recommendation** Wrap in `SlideUpSheet` and use `SheetGrabber`. Then add a review rule: **a component named
`*Sheet` mounts `SlideUpSheet`; a component named `*Modal` mounts `AdaptiveModalScaffold`.** 14 raw `<Modal>`s in
this area; only 3 use `AdaptiveModalScaffold`.
**Pillar** Collect — the Exchange is where truffles become things.

### [P1] C-10 · Three page crowns and two kicker typographies
**Location** `season.tsx:1417–1434` + `styles:2360–2405` · `race-standings.tsx:162–183` + `styles:739–770` ·
`contraptions.tsx:152–172` + `styles:335–353` — vs `dig-collection.tsx:87` and `digging-stats.tsx:105` using
`PageHeader`
**Prompt(s)** P1 (h4), P9, P10(g)
**Evidence** Three separate re-implementations of the same anatomy:

| | kicker font | kicker case | title | rule | back |
| --- | --- | --- | --- | --- | --- |
| `PageHeader` (canonical) | `KICKER_PILL` (Nunito XB, tracked) | UPPERCASE | `TYPE.pageTitle` 26 | ✓ 64pt | 44pt `‹ back` |
| `season.tsx` | `KICKER_TEXT` (PatrickHand) | lowercase | bare `fontSize: 30` | ✓ 64pt | n/a (tab) |
| `race-standings.tsx` | bare `FONTS.hand` 13, `letterSpacing: 2.5` | UPPERCASE | Sticker plaque, `fontSize: 26` | ✗ | 30pt |
| `contraptions.tsx` | `TYPE.label` | UPPERCASE (literal) | `TYPE.pageTitle` ✓ | ✗ | 44pt chip |

`PageHeader` supports `right` and `below` slots — `season.tsx`'s three header icon buttons and
`race-standings`'s hangers-plus-plaque are both expressible through it.
**Expected standard** Taste standard rule 5 ("every screen wears the same crown") and roadmap item 3, marked
**done**: "`PageHeader` is the canonical page-header crown … adopted on achievements, sounder, sounder-progress,
clan-ladder, mud-war."
**Gap** The migration stopped before the Season area. `season.tsx:2360–2405` still carries the dead per-screen
header styles the roadmap's item 4 says to prune.
**Recommendation** Adopt `PageHeader` on all three. The Dig-Off plaque is a real design idea worth keeping — add
`PageHeader variant="plaque"` (Sticker title + hangers) rather than leaving it as a private implementation.
Resolve the kicker question as a ruling: **`KICKER_PILL` (tracked uppercase) is the page crown; `KICKER_TEXT`
(PatrickHand) is the in-card kicker** — or the reverse, but pick one; right now `season.tsx` and `PageHeader`
disagree and `race-standings.tsx` is a third thing.
**Pillar** Craft / "designed throughout."

### [P1] C-11 · `#D5E4C9` leaks back in — a hex the token layer says it already retired
**Location** `components/AlignmentSchismModal.tsx:98`, `105`, `112`
**Prompt(s)** P4, P10
**Evidence** `buttonBg: "#D5E4C9"` ×3.
**Expected standard** `constants/theme.ts:184–192`: "Blessing / curse pair … **Five files hand-mixed this pair
off-palette (`#C99B23` / `#5E7E49` / `#7BA266` / `#D5E4C9` / `#5b8a4a`); tokenized once so 'matches Barn' is
matched by token, not by copy-paste. (2026-07-12)**"
**Gap** `#D5E4C9` is named verbatim in the token comment as one of the leaks that was folded into
`WHIMSY.curseGreen`, and it is back in a goblin-side modal three months later. This is the governance-erosion
failure mode the taste standard is written against, caught in the act.
**Recommendation** Replace with the tint the token family intends. Since `curseGreen` is a *text/fill* hue and
`#D5E4C9` is its pale *surface*, the token family is genuinely incomplete — add `WHIMSY.curseSurface` /
`WHIMSY.blessSurface` beside them, and note in the theme comment that surfaces, not just fills, were the reason it
leaked.
**Pillar** Craft / governance.

### [P2] C-12 · Eight `rgba(42,31,21,…)` ink-alpha literals, and `UI_COLORS.scrim` is a near-duplicate
**Location** `TrufflePatch.tsx:115,2258,2305,2312,2350,2355` · `race-standings.tsx:831,915`
**Prompt(s)** P3, P4
**Evidence** `rgba(42,31,21,0.55)` · `0.32` · `0.25` · `0.22` (×3) · `0.18` · `0.1` · `1`. `42,31,21` is
`WHIMSY.ink` (`#2a1f15`) decomposed. Meanwhile `UI_COLORS.scrim = "rgba(40,30,20,0.55)"` — the *same* concept at
the *same* alpha with a **different, wrong** RGB triple.
**Expected standard** Taste standard rule 1: "If a value isn't a token, either use an existing token or add one."
**Gap** There is no way to express "ink at N% alpha" through the token layer, so eight sites decomposed the hex by
hand, and the one token that does exist drifted two points per channel from the ink it is supposed to be.
**Recommendation** Add an `INK_ALPHA` scale to `theme.ts` — `{ hairline: 0.10, divider: 0.22, veil: 0.25,
silhouette: 0.55 }` resolved through one `inkAlpha(a)` helper derived from `WHIMSY.ink` — and correct
`UI_COLORS.scrim` to `inkAlpha(0.55)` so the two stop being different colours.
**Pillar** Craft / governance.

### [P2] C-13 · Legacy `COLORS.*` on a tab screen and on the spoils podium
**Location** `season.tsx:786` (`cornerBadgeClaimed: { backgroundColor: COLORS.success }`) ·
`season1/RaceSection.tsx:320,327,334` (`tint: COLORS.gold` / `COLORS.silver` / `COLORS.bronze`)
**Prompt(s)** P4
**Evidence** Four of the whole app's 14 remaining legacy-palette references are in this area, and `RaceSection`'s
three are on the **weekly spoils podium** — the visual payoff of the Contend pillar. Note `COLORS.gold` is
`#F5C44A`, *byte-identical* to `WHIMSY.slopGold`: the podium's first-place gold and the Slop Club members gold are
the same colour reached through two names, so a palette tune to one silently moves the other.
**Expected standard** `WHIMSY` is the one palette; `RARITY_STRIPE` / `RARITY_GRADIENT` show the pattern for a
per-rank colour map.
**Gap** `WHIMSY` has no podium family, so the podium reaches past the token layer.
**Recommendation** Add `PODIUM: { gold, silver, bronze }` to `theme.ts` beside `RARITY_STRIPE`, with a comment
noting that podium gold is **deliberately** distinct from `slopGold` (earned vs bought — the charter's "money buys
expression, never advantage or accomplishment" line makes that a design requirement, not a nicety). Replace
`COLORS.success` per C-02.
**Pillar** Contend / Collect.

### [P2] C-14 · The dig-tile palette exists twice, with different colours
**Location** `DigPostcardInbox.tsx:195–205` vs `TrufflePatch.tsx:114–115`
**Prompt(s)** P3 (color), P4, P9
**Evidence**
```
TrufflePatch:  mud: ["#c2a077", "#a5825f", "#8a6b4f"]   silhouette: "rgba(42,31,21,0.55)"
DigPostcard:   mud: "#9a7552"  truffle: "#e8b636"  shimmer: "#8ed9d0"  unique: "#865ba8" / border "#d8a82d"
```
**Gap** The postcard mini-grid is a *receipt for the dig you just did* — it is the same board, redrawn in six
hexes that match nothing on the board. Nine raw hex across two files for one concept.
**Recommendation** Lift a `DIG_TILE` map into `theme.ts` (`mud[0..2]`, `truffle`, `shimmer`, `unique`,
`uniqueEdge`, `silhouette`) and have both surfaces consume it, the way `RARITY_STRIPE` consolidated the shop's and
closet's divergent rarity maps.
**Pillar** Connect — the postcard is the thing you send a friend.

### [P2] C-15 · A semantic ✓ rendered as `Text`
**Location** `components/season1/HungerHero.tsx:176` (`<Text style={styles.check}>✓</Text>`, style at `:477` —
`FONTS.bodyBlack, fontSize: 18`)
**Prompt(s)** P2, P9
**Expected standard** Taste-standard decision log, 2026-07-13 — the dingbat ruling: "**`✓`, `✕`, and `♥` are
SEMANTIC** … and must scale and color like the rest of the iconography, so they render through the `Icon`/`Glyph`
primitives (`Icon "check"` …), never as a raw `Text` glyph."
**Gap** `season.tsx:319` draws the identical concept — a claimed/complete tick — as `<Icon name="check" …/>` on the
Hunger ladder's sibling surface.
**Recommendation** `<Icon name="check" size={18} color={WHIMSY.ink} strokeWidth={3} />`. The `★` two lines below
(`:178`) is sanctioned typography and stays as `Text`.
**Pillar** Craft / governance.

### [P2] C-16 · Sub-pixel type on the standings rows
**Location** `race-standings.tsx:942` (`rowName: fontSize: 16.5`), `:943` (`rowSub: fontSize: 12.5`)
**Prompt(s)** P3 (text readability), P4
**Expected standard** `theme.ts:304–307`: the `kickerPillSm` token was introduced explicitly to kill sub-pixel type
— "the 9s move up to 10, a negligible visual delta that **kills the sub-pixel shadow scale**."
**Gap** The Sounder name — the most-read string on the Contend surface — is set at a half-pixel size, on rows that
carry `SHADOW_SM`.
**Recommendation** `rowName` → `TYPE.cardTitle` with `fontFamily: FONTS.display`; `rowSub` → `TYPE.bodySm`. Add
the rule to the standard: **`fontSize` is an integer.**

### [P2] C-17 · Bare `borderRadius` where the token exists
**Location** `TrufflePatch.tsx:2340,2382` (`999`) · `race-standings.tsx:928` (`18`), `:960` (`999`) ·
`Leaderboard.tsx:830` (`18`), `:1019` (`999`) · `BountyCard.tsx:266` (`14`), `:280` (`12`), `:349,383` (`999`) ·
`JudgementDayModal.tsx:163` (`radius={16}`), `:311` (`999`) · `SeasonEndModal.tsx:470` (`999`), `:534` (`28`),
`:568` (`4`) · `AlignmentSchismModal.tsx:270` (`999`), `:286` (`14`) · `AlignmentExplainerModal.tsx:226` (`999`) ·
`TierUpBanner.tsx:201` (`22`) · `MoteMachineCard.tsx:84` (`36`) · `GreatHungerMeter.tsx:163` (`110`) ·
`SounderStepCard.tsx:363,369` (`3`, `4`) · `DigPostcardInbox.tsx:195,196,198,203` (`3`, `8`, `3`, `3`)
**Prompt(s)** P4
**Evidence** 26 sites. Twelve are `999` — the idiom `RADII.pill` was added to name. Five more restate existing
tokens (`18` = `xl`, `14` = `lg`, `12` = `md`, `22` = `xxl`, `8` = `sm`). Six are genuinely new (`16`, `28`, `36`,
`110`, `4`, `3`).
**Recommendation** Mechanical swap for the 17 that have tokens. Add `RADII.xs: 4` for the micro-radius the system
lacks; collapse `16` into `lg` or `xl`; `28`/`36`/`110` are capsule cases that should be `RADII.pill`.

### [P2] C-18 · 53 `SPACE.x ± n` arithmetic expressions — the scale is missing its odd steps
**Location** `season.tsx` (14) · `TruffleExchangeSheet.tsx` (13) · `BuriedTruffleSheet.tsx` (11) ·
`BuryTruffleSheet.tsx` (7) · `TruffleCatalogSheet.tsx` (4) · `GreatHungerMeter.tsx` (2) · `race-standings.tsx` (1) ·
`GuardedCtaExtras.tsx` (1)
**Prompt(s)** P4, P8 (Gestalt proximity)
**Evidence** `SPACE.xs + 2` ×16 → 6 · `SPACE.sm + 2` ×11 → 10 · `SPACE.lg - 2` ×6 → 14 · `SPACE.md + 2` ×5 → 14 ·
`SPACE.md - 2` ×4 → 10 · plus `+1`, `+3`, `+4`. Separately, `paddingHorizontal: 14` appears bare **7×** in
`Leaderboard.tsx` and 3× in `race-standings.tsx`.
**Expected standard** `theme.ts:334`: "Spacing scale — use **ONLY** these for gaps / margins."
**Gap** Authors obey the letter of the rule and route around it arithmetically, which is *worse* than a literal:
`SPACE.lg - 2` and `SPACE.md + 2` are the same 14px written two ways, so a future change to the scale breaks them
in opposite directions.
**Recommendation** Add the half-steps the area demonstrably needs — `{ xxs: 2, xs: 4, xsPlus: 6, sm: 8,
smPlus: 10, md: 12, mdPlus: 14, lg: 16, lgPlus: 18, xl: 24 }` (naming to taste) — and ban arithmetic on `SPACE` in
review. 53 sites is not authors being sloppy; it is the scale being too coarse for a paper-craft layout that lives
on 2px ink borders.

### [P2] C-19 · 24 bare `fontSize` on the Season tab, two of them above the top of the scale
**Location** `season.tsx:686,721,909,2186,2202,2216,2223,2258,2354,2397,2423,2464,2487,2562,2577,2578,2581,2601,2608,2613,2616,2630,2642,2650`
**Prompt(s)** P3, P4
**Evidence** `:2397` `title: { fontSize: 30, fontFamily: FONTS.whimsy, lineHeight: 32 }` — between
`TYPE.pageTitle` (26) and `TYPE.display` (32), matching neither. `JudgementDayModal.tsx:240` goes further with
`fontSize: 36`. Values 11, 12, 13, 14, 15, 16, 22, 24, 26, 30 — nine of the ten already have a `TYPE` role.
**Expected standard** Taste standard rule 2: "A bare `fontSize: 15` in new code is a smell."
**Gap** The tab screen with the most text in the area has the least `TYPE` adoption; `contraptions.tsx` and the
truffle sheets in the same area are near-pure.
**Recommendation** Mechanical migration under "leave it better." The two genuine gaps: the season title at 30 and
the ceremony headline at 36 want a `TYPE.displayLg` (36/38), with the season title collapsing to `display` (32) —
one big-title role, not three sizes.

### [P2] C-20 · The season-end ceremony's only exit is unlabelled
**Location** `components/SeasonEndModal.tsx:204–210`
**Prompt(s)** P1 (h3 user control), P6
**Evidence** `<Pressable onPress={close} style={[styles.skip, …]} hitSlop={12}>` with no `accessibilityRole` or
`accessibilityLabel`. The comment two lines above reads "A season moment must never trap."
**Recommendation** `accessibilityRole="button"` + `accessibilityLabel="Skip the season recap"`. Better: adopt
`DialogCloseRow`, which is used **zero** times across this area's 14 modals.

### [P2] C-21 · `TierUpBanner` announces nothing to a screen reader
**Location** `components/ui/TierUpBanner.tsx:167–190`
**Prompt(s)** P6, P7 (peak)
**Evidence** `<View pointerEvents="none" …>` containing `SNOUT SEASON` / `Tier N Unlocked!` / `New reward waiting
below ↓`, with no `accessibilityLiveRegion` / `accessibilityRole="alert"` / `announceForAccessibility`.
**Gap** `TrufflePatch.tsx:887` does this correctly — `useEffect(() => { if (whisper)
AccessibilityInfo.announceForAccessibility(whisper); }, [whisper])`. The tier-up is the loudest moment on the
season tab and it is silent to VoiceOver.
**Recommendation** Announce on fire, using the same call `TrufflePatch` uses. System rule: **a transient overlay
that carries news announces it.**

### [P2] C-22 · Two confirmation grammars for two spend paths in the same feature
**Location** `BuriedTruffleSheet.tsx:125,249–263,357` (arm-then-confirm: the button re-labels itself and turns
`WHIMSY.rose` on first tap) vs `BountyCard.tsx:247` (`ConfirmDialog`)
**Prompt(s)** P1 (h5 error prevention), P7
**Evidence** Reclaiming a buried pot — the *irreversible, larger* action — uses an inline arm-then-confirm with no
dialog; swapping a bounty for `REROLL_COST` snouts — the *smaller, weekly* action — gets a full `ConfirmDialog`.
**Gap** The cheaper action is the better-protected one, and a player who learns one grammar is surprised by the
other.
**Recommendation** Rule: **irreversible or currency-moving actions use `ConfirmDialog`; arm-then-confirm is
reserved for reversible toggles.** Route reclaim through `ConfirmDialog`.

### [P2] C-23 · Three ungoverned dark surfaces where the palette sanctions one
**Location** `SeasonEndModal.tsx:460` (`root: { flex: 1, backgroundColor: WHIMSY.ink }`) ·
`JudgementDayModal.tsx:125` (`colors={["#1a1411", "#2a1f15", "#4a2f1f"]}`) · vs `WHIMSY.bark` (`#3a2c1e`)
**Prompt(s)** P2, P4, P10(f)
**Evidence** `#1a1411` and `#4a2f1f` are raw; `#2a1f15` is `WHIMSY.ink` written as a literal. `JudgementDayModal`
also carries `rgba(255,216,122,0.18/0.22)` light rays (`:141,146,151` — `WHIMSY.sun` at alpha),
`textShadowColor: "rgba(0,0,0,0.35)"` (`:245`) and `color: "rgba(255,250,240,0.75)"` (`:253`) where
`UI_COLORS.textOnDark` exists.
**Expected standard** `theme.ts:169–172`: "Dark 'storyteller' callout … **One sanctioned dark surface**, tokenized
before first use, so the storyteller voice stays governable."
**Gap** Two ceremonies later there are three dark surfaces and only one is a token. These are *good* designs — a
season should end somewhere other than cream — but they are outside the system.
**Recommendation** Grow the family on purpose: `WHIMSY.stage` (the ceremony ground) and an
`EMBER_GRADIENT: readonly [string, string, string]` beside `RARITY_GRADIENT`, both with a comment naming the two
ceremonies that own them. Then `SeasonEndModal.root` → `WHIMSY.stage` and the rays → a sun-alpha helper.

### [P2] C-24 · Dead and duplicate styles in `season.tsx`
**Location** `season.tsx:2379–2391` (`headerBtnPressed` and `chipPressed` are byte-identical) · `:818–820`
(`cardReady: { ...STICKER_SHADOW }` — a no-op; `card` at `:808` already spreads it) · `:2360–2405` (the per-screen
header styles roadmap item 4 marks for pruning once `PageHeader` lands)
**Prompt(s)** P4, P5
**Recommendation** Collapse to one `PRESSED` token (C-01); delete `cardReady` or give it the highlight it was
meant to carry; prune the header block with the `PageHeader` adoption (C-10).

### [P2] C-25 · `ActivityIndicator` imported but never rendered
**Location** `app/contraptions.tsx:3`
**Evidence** Imported; the screen correctly uses `LoadingBeat` at `:184`.
**Gap** A dead import of the exact primitive the taste standard retired ("never a naked spinner") is a live
temptation in a file someone will edit next.
**Recommendation** Delete the import. Consider a lint rule banning `ActivityIndicator` outside `components/ui/`.

### [P2] C-26 · The Season tab stacks eleven decision surfaces in one scroll
**Location** `season.tsx:1529–1900`
**Prompt(s)** P7, P8 (Hick, Von Restorff)
**Evidence** In order: HungerHero → FeedingAction → MoteMachineCard → WindowStrip → "your Sounder"
SectionHeader + guide link → SounderStepCard *or* SounderHomeCard → YourTakeStrip (3 tappable cells) →
RaceSection → BountyBoard → pass SectionHeader (3 right-slot buttons) → XP subtitle → XP bar → WallowCard →
PassTrackTabs → PremiumLockedBanner → ClaimAllBar → VerticalListPassTrack (N rows) → Alignment placard.
Simultaneously visible tappables on a loaded screen regularly exceed twelve.
**Gap** Von Restorff: on a "rewards ready" load, the sun-yellow highlight is worn by the `ClaimAllBar`, every ready
tier card, the ready `stateTag`, the `cornerBadgeReady`, the active pass tab, and the `FeedingAction` — six things
shouting at once, so nothing is the one thing. The screen's *actual* primary action (dig, or claim) is not
reliably the most dominant element.
**Recommendation** A composition ask, not a token ask: introduce a **one-hero rule** for the tab — at most one
surface may wear the `WHIMSY.sun` full-card highlight at a time, chosen by a single `primaryAction` derivation
(dig-available > rewards-ready > join-a-Sounder > browse), with everything else falling back to outline-only. The
pieces to build it already exist (`useFeedingCta`, `useSounderPath`, `readyTiers`).
**Pillar** Contend — "legibility beats depth" is the charter's own first belief.

### [P2] C-27 · `…` means two different things on the same card
**Location** `BountyCard.tsx:209` (`{busy ? "…" : …}`), `:238` (`{busy ? "…" : "Claim"}`), `:245`
(`ctaProgressText` renders a literal `…` for the *not yet claimable* state)
**Prompt(s)** P1 (h1 visibility of status), P9
**Gap** The same ellipsis is both "working on it" and "not ready yet," on the same card, sometimes at once.
**Recommendation** The in-progress CTA shows the fraction it already computes (`{progress}/{goal}`); busy uses the
`Button` primitive's busy state. Rule: **a control never uses the same glyph for busy and for blocked.**

### [P2] C-28 · Five border widths, no token
**Location** area-wide — `borderWidth: 2` ×92, `1.5` ×42, `2.5` ×6, `3` ×3, `1` ×2, plus `Sticker border={3}` ×10,
`border={2.5}` ×3, `border={2}` ×1. Concentrated examples: `race-standings.tsx:778` (`periodToggle` 2.5), `:815`
(`boardCard` 3), `:929` (`rankBadge` 2.5), `season.tsx:764` (`node` 2.5), `DigPostcardInbox.tsx:171` (`card` 1.5)
**Prompt(s)** P4
**Expected standard** The 2px ink border is named in the taste standard as DNA ("2px ink border, hand-drawn tilt,
hard offset drop-shadow"). It has no token, so 1.5 and 2.5 propagate as free variation.
**Recommendation** Add `BORDER = { hair: 1.5, ink: 2, bold: 2.5, heavy: 3 }` to `theme.ts` with a comment stating
which is the default and what the others *mean* (hair = inner divider, bold = emphasis frame, heavy = page plaque).
Undecided variation is the definition of governance erosion.

### [P2] C-29 · Three surfaces in the area carry none of the paper-craft DNA
**Location** `app/contraptions.tsx` (no `Sticker`, no tilt, no hard shadow on the header, flat cards) ·
`components/BountyCard.tsx` (hand-rolls tilt + border + shadow instead of mounting `Sticker`) ·
`components/DigPostcardInbox.tsx` (flat `SHADOW_SM` card, six raw hex, no tilt)
**Prompt(s)** P2 (design-specificity verdict)
**Evidence** `contraptions.tsx` answers the specificity question **FAIL**: strip the copy and it is a generic
settings screen — centered header, flat card, two rectangular buttons. `BountyCard` answers **PARTIAL**: it has
the tilt and the ink border, but reaches them by hand rather than through `Sticker`, and so drifts (3,3 shadow,
`borderRadius: 14`).
**Recommendation** `BountyCard` and `DigPostcardInbox` mount `Sticker` (both already do everything `Sticker` does,
worse). `contraptions.tsx` gets `PageHeader` + `Sticker` + a `Glyph` and a tilt — the content is charming
("WORKSHOP SHELF", "ITS STOPPING RULE", "Resting · wind it when you want service"); the chrome does not match it.
**Pillar** Craft — a designer who knows this game would not ship a flat card here.

### [P3] C-30 · Directional marks rendered as text
**Location** `TierUpBanner.tsx:186` (`New reward waiting below ↓`) · `AlignmentExplainerModal.tsx:146,152`
(`▲` / `▼` at `moveArrow: { fontSize: 14 }`)
**Prompt(s)** P2, P9
**Gap** The 2026-07-13 dingbat ruling sanctions `★ ✦ ·` as flourish and routes semantic marks to `Icon`/`Glyph`.
`↓ ▲ ▼` are semantic (they point at something) and are drawn nowhere else in the app as text.
**Recommendation** `Icon name="arrowRight"` rotated (the pattern `contraptions.tsx:161` already uses), or extend
the ruling's sanctioned list explicitly. Either is fine; silence is not.

### [P3] C-31 · `☁` joined the sanctioned dingbat list without a ruling
**Location** `components/BountyCard.tsx:61–63` — `return { kind: "char", text: "✦" }` / `text: "☁"`, under a
comment at `:49` asserting "a sanctioned typographic flourish (★ ✦ ☁ …)".
**Gap** The 2026-07-13 decision log names `★ ✦ ·` only. `☁` (U+2601) is a pictograph one code point from emoji
presentation; the app draws a cloud as `Glyph "cloud"` elsewhere (`season.tsx:1389`).
**Recommendation** Route to `Glyph name="cloud"` — the ruling's own test is "the same concept the app already
draws as art elsewhere."

### [P3] C-32 · Untokenized art hex in a shared `ui/` primitive
**Location** `components/ui/Shovel.tsx:13,21,23` — `fill="#c3ccd4"`, `#c98a5e`, `#e0a36e`
**Gap** Illustration fills are a reasonable exception, but `Shovel` lives in `components/ui/` alongside the
primitives, so the exception should be stated rather than assumed.
**Recommendation** Either lift to a `GLYPH_PALETTE` in `theme.ts` beside `RARITY_STRIPE`, or add a one-line
comment declaring inline art fills sanctioned inside `ui/` SVG art. Prefer the token.

### [P3] C-33 · Hold-to-shove has no non-timed alternative for sighted motor-impaired players
**Location** `TrufflePatch.tsx:832–836` (`if (!g.movedFar && dt >= SHOVE_HOLD_MS)`), `:800` (14px jitter tolerance)
**Prompt(s)** P6
**Evidence** The "snout shove" requires a stationary press held past `SHOVE_HOLD_MS` within a 14px radius.
VoiceOver users are fully served (`:1113–1120` exposes it as a custom `accessibilityActions` verb, "Snout shove"),
but a sighted player with a tremor has no route to it. Plain tap → rub is the fallback for *rub*, not for *shove*.
**Recommendation** Surface the shove as an explicit control too — e.g. a "shove" mode toggle beside the stir meter
that converts the next tap into a shove — reusing the `applyAction("shove", idx)` path that already exists.

### [P3] C-34 · `digging-stats` retry button unlabelled
**Location** `app/digging-stats.tsx:117` — `<Pressable onPress={tryAgain} …><Text>Try again</Text></Pressable>`
**Recommendation** `accessibilityRole="button"`, or route through `Button variant="ghost"` — the screen is
otherwise a model citizen (`PageHeader`, `Sticker`, `LoadingBeat`, `Glyph`, near-total `TYPE` adoption).

---

## 4. Heuristic scorecard (P1)

### `app/(tabs)/season.tsx` — the Season tab

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | XP bar + tier readout + stats pills are strong; `busy` on claim is a bare `opacity: 0.7` with no busy semantics (`:651`) |
| 2 | Match with the real world | 4 | "your take", "the dig-off", "steal back the tickles" — cozy nouns throughout, no code nouns leak |
| 3 | User control and freedom | 3 | Every modal has `onRequestClose`; `ClaimAllBar` sweeps N claims in one tap; but 3 raw `<Modal>`s carry no visible close row |
| 4 | Consistency and standards | **1** | C-05 (hand-rolled segment + stale comment), C-10 (hand-rolled crown), C-01 (two pressed idioms in one StyleSheet), C-13 (`COLORS.success`) |
| 5 | Error prevention | 3 | Claim is idempotent server-side; `Coming Soon` state prevents a dead IAP tap (`:1717`) |
| 6 | Recognition over recall | 3 | Node + card + badge + tag says the state four ways; `tierLabel` and `display_label` carry meaning |
| 7 | Flexibility and efficiency | 4 | `ClaimAllBar` and `openPassSection()` scroll-to-claim are real expert affordances |
| 8 | Aesthetic and minimalist | **2** | C-26: eleven stacked surfaces, six simultaneous sun-yellow highlights |
| 9 | Error recovery | 3 | The inline claim dialog replaced a native `Alert` (`:2115` comment); network reason falls through to one warm message (`:1250`) |
| 10 | Help and documentation | 4 | `SeasonGuideModal`, `SeasonInfoModal` ×2, `XPHowToModal`, "how it works ›" — genuinely well-documented |

### `components/mudwar/TrufflePatch.tsx` — the dig

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | **4** | The stir meter names its stage in words (`:858–862`), ticks at the thresholds (`:975–976`), and colours sage → sun → rose. Exemplary |
| 2 | Match with the real world | 4 | "his attention", "a crewmate dug this feeding — up to 5 more rubs", "practice dig — nothing banks, all the fun" |
| 3 | User control and freedom | 3 | `patchOpen` peek-at-the-board after the end (`:2614`); no undo on a rub, correctly (it is the game) |
| 4 | Consistency and standards | 3 | Token adoption is high; `borderRadius: 999` ×2 and 6 ink-alpha literals are the gaps |
| 5 | Error prevention | 4 | Stir budget capped client-side "so it can never trip the server's budget" (`:532`); 14px jitter tolerance before a hold degrades |
| 6 | Recognition over recall | 3 | Crack texture at partial depth (`:1050`) and gilded silhouettes teach depth without a legend; the help scroll (`:1338`) carries the rest |
| 7 | Flexibility and efficiency | 3 | Tap = one rub, scrub = many, hold = shove — three grammars, well layered; C-33 is the gap |
| 8 | Aesthetic and minimalist | 4 | The board is the screen; the vignette drops the instant the dig ends (`:940` comment) |
| 9 | Error recovery | 3 | `onPanResponderTerminate` springs the telegraph back when the gesture is stolen (`:838`) |
| 10 | Help and documentation | 4 | "How the dig works" explainer is one labelled tap from the header (`:927`) |

### `app/race-standings.tsx` — the Dig-Off board

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 4 | "showing N of M sounders", per-board caption ("this race settles Monday"), the sticky my-Sounder pin when your row is off-screen |
| 2 | Match with the real world | 4 | "the dig-off", "sounders, one board", "per snout" / "overall" |
| 3 | User control and freedom | 3 | Three lenses × two metrics, each remembering its own default (`:216`); back button is 30pt (C-04) |
| 4 | Consistency and standards | **1** | C-05 (two hand-rolled segments in one file, two a11y vocabularies), C-10 (third crown), C-16 (sub-pixel type), C-07 (`opacity: 0.28`) |
| 5 | Error prevention | 4 | History rows are deliberately non-expandable because the detail RPC is live-only (`:260–262`) — honest by construction |
| 6 | Recognition over recall | 3 | Rank stamps + `rowMine` sun highlight; `rankingNote` explains when the metric and the rank disagree (`:334`) |
| 7 | Flexibility and efficiency | 3 | Paginated reveal in 25s; metric remembered per board |
| 8 | Aesthetic and minimalist | 4 | The plaque + hangers header is the most specific composition in the area |
| 9 | Error recovery | 3 | `EmptyState` distinguishes "the archive is waking up" from "no past races yet" (`:369–380`) — warm, not shaming |
| 10 | Help and documentation | 2 | No route to "how does rank work" from the board itself; `rankingNote` is the only explanation and appears in one metric combination |

---

## 5. Token triage (P4)

| Cluster | Count in area | Verdict | Action |
| --- | --- | --- | --- |
| Raw hex (non-comment) | 17 in 6 files | mixed | `#D5E4C9` ×3 = **regression**, token exists (C-11). `#1a1411`/`#4a2f1f` = **missing token** (`WHIMSY.stage`, `EMBER_GRADIENT`, C-23). 6 in `DigPostcardInbox` + 3 in `TrufflePatch` = **missing token** (`DIG_TILE`, C-14). 3 in `Shovel.tsx` = art, declare the exception (C-32). `#000` in `TierUpBanner` = **delete with the shadow** (C-06) |
| `rgba(` | 15 | **missing token** | `rgba(42,31,21,…)` ×8 → `INK_ALPHA`; `rgba(255,216,122,…)` ×3 → sun-alpha; `rgba(255,250,240,…)` ×2 → `UI_COLORS.textOnDark`; `rgba(0,0,0,0.35)` ×1 → ink-alpha (C-12, C-23) |
| Legacy `COLORS.*` | 4 (`season.tsx` ×1, `RaceSection` ×3) | **has token / missing token** | `COLORS.success` → `WHIMSY.sage` + ink (C-02); `gold/silver/bronze` → new `PODIUM` map (C-13) |
| Bare `fontSize` | 118 across 27 files; `season.tsx` 24, `race-standings.tsx` 14, `BountyCard.tsx` 10, `Leaderboard.tsx` 9, `JudgementDayModal.tsx` 8, `AlignmentExplainerModal.tsx` 8 | mostly **has token** | 11/12/13/14/15/16/17/22/26 all map to `TYPE` roles. Genuinely missing: `TYPE.displayLg` (36) for ceremony headlines. Kill `16.5` / `12.5` outright (C-16, C-19) |
| Bare `borderRadius` | 26 sites, 14 distinct values | mostly **redundant** | 12× `999` → `RADII.pill`; `18/14/12/22/8` → existing tokens; **missing**: `RADII.xs: 4` (C-17) |
| Bare padding/margin/gap | ~230 sites; `season.tsx` 59, `Leaderboard.tsx` 57 | **missing token** | Dominant off-scale values are 6, 10, 11, 14, 18 — and 53 more are reached by `SPACE.x ± n` arithmetic. The scale needs half-steps (C-18) |
| `fontWeight` | **0** | ✓ clean | The four-font system is fully honoured; no file in the area reaches for a weight |
| `shadowRadius > 0` | 1 (`TierUpBanner.tsx:210`) | **violation** | The app's only soft shadow (C-06) |
| Hand-rolled `shadowOffset` | 5 (`3,3` ×2, `1.5,1.5`, `2,2`, `0,8`) | **violation** | Four extra tiers past the sanctioned two (C-06) |
| `opacity` literals | 22 distinct values, ~90 sites | **missing token** | Splits into two families: *pressed* (9 idioms, C-01) and *disabled* (5 crushes, C-07). Both need tokens; neither has one |
| `borderWidth` | 5 distinct values, 145 sites + 14 `Sticker border=` props | **missing token** | `BORDER = { hair, ink, bold, heavy }` (C-28) |
| Emoji in a render | **0** | ✓ clean | The two the baseline flagged for this area (`season.tsx:236`, `BountyCard.tsx:178`) are both comments |
| `Alert.alert` | **0** | ✓ clean | `season.tsx:2115` documents having *replaced* one with an in-app dialog |
| `ActivityIndicator` | 1 import, 0 renders | **dead** | `contraptions.tsx:3` (C-25) |
| Mixed icon families | **0** | ✓ clean | `Glyph` 48× + `Icon` 32×, no vector-icon library anywhere in the area |

---

## 6. What's working (keep and replicate)

- **`components/mudwar/TrufflePatch.tsx:1078–1135` is the accessibility model for the whole app.** Every tile
  carries `accessibilityLabel` (position + contents), `accessibilityHint`, `accessibilityValue` ("3 layers of
  mud"), `accessibilityState`, and — the part nobody else does — **custom `accessibilityActions`** so a VoiceOver
  player can choose "Rub quietly" or "Snout shove" from the rotor while the sighted gesture stays a single
  PanResponder. The comment at `:1086–1092` explains exactly why pointer events and accessibility activation are
  decoupled. Cite this in the design system as the reference for any gesture surface.
- **Feelings are never numbers.** `TrufflePatch.tsx:858–862` renders the Hungerer's attention as
  `"calm" / "stirring" / "he's lifting his snout"` with a colour ramp (`:851–856`) and a wobble (`:863`), never a
  percentage — the taste law executed precisely. `GreatHungerMeter.tsx` does the same.
- **`app/dig-collection.tsx` and `app/digging-stats.tsx` are what a token-pure screen looks like here.**
  `PageHeader` + `SectionHeader` with a `right` count + `Sticker` + `LoadingBeat` + `Glyph`, zero raw hex, zero
  `rgba`, and (in `dig-collection`) zero bare radii. Rebuild anything in this area *from these two*.
- **`app/contraptions.tsx:304–320` is the accessibility model for a spend button** — `accessibilityRole`,
  `accessibilityState={{ disabled, busy }}`, and a label that names the cost. Every other spend control in the
  area (C-03) should copy this signature verbatim.
- **The vertical pass track (`season.tsx:268–400` + `vlStyles:696–870`) is excellent composition.** Dashed
  connectors that stop at the node boundary, a locked state expressed as *dashed border + no shadow* (shape kept,
  fill muted — the C-07 ruling done right), a `clubCrest` that says "there's also a Slop Club reward here" without
  ever reading as "VIP-only", and a claimed row that line-throughs its own label. Only the badge contrast (C-02)
  and the `COLORS.success` leak keep it off a perfect score.
- **`components/ui/SlideUpSheet.tsx` is the right kind of primitive** — its header comment names the six files it
  consolidated and explains *why* `animationType="slide"` was rejected. Five of six sheets in this area use it.
  Write more primitives like this one (and finish the migration, C-09).
- **Warm losing states throughout.** `race-standings.tsx:369–380` ("the archive is waking up" / "the first table
  settles Monday"), `:549` (sub-quorum → "no placement, a warm thank-you"), `TrufflePatch`'s "nothing made it to
  your pouch" instead of a zero, and `season.tsx:1389` ("A new season will roll in soon"). Charter lens 4 passes
  everywhere I looked — no public zero and no shaming copy anywhere in this area.
- **`SeasonEndModal.tsx:202–210`** anchors its Skip chip below the notch from `insets.top` with the comment "A
  season moment must never trap." The instinct is right; it just needs a label (C-20).
- **Reduce Motion is genuinely handled in 11 of 13 animated files**, including both ceremonies and `TierUpBanner`
  (which swaps the translate for an opacity crossfade at `:167–178`). The pattern is established; two files just
  need to join it (C-08).

---

## 7. System asks

The tokens, primitives and rules this area cannot be rebuilt without. Ordered by how many findings each closes.

1. **`PRESSED` / `PRESSED_FLAT` style tokens + a `Tappable` primitive.** Closes C-01 (9 idioms), contributes to
   C-24. The sink-into-shadow behaviour is DNA and currently lives in three files as a copy-pasted transform.
2. **`DISABLED` style token implementing the 2026-07-07 "a button, asleep" ruling** — muted fill, outline
   preserved, `textDisabled` ink, **no opacity**. Closes C-07. The ruling exists but only `Button` obeys it;
   hand-rolled controls need a token they can spread.
3. **`TAP_MIN = 44` + a `Button size="xs"` whose frame floors at 44pt while its visual height stays small** (the
   `IconButton` `visualSize`/frame split, generalised). Closes C-04.
4. **`SPACE` half-steps** (6 / 10 / 14 / 18) and a ban on `SPACE.x ± n`. Closes C-18 (53 arithmetic sites + ~230
   bare values). The current 5-step scale is too coarse for a layout built on 2px ink borders.
5. **`BORDER = { hair: 1.5, ink: 2, bold: 2.5, heavy: 3 }`** with each step's *meaning* documented. Closes C-28
   (145 sites, 5 undecided values) and gives `Sticker`'s `border` prop a vocabulary.
6. **An `INK_ALPHA` scale + an `inkAlpha(a)` helper derived from `WHIMSY.ink`, and a correction of
   `UI_COLORS.scrim`** (currently `rgba(40,30,20,…)` where ink is `#2a1f15`). Closes C-12, part of C-23.
7. **`SegmentedControl` grows a `disabled` / `badge` option prop**, and the three hand-rolled toggles are deleted.
   Closes C-05. Also delete the false comment at `season.tsx:886` — a stale "there's no primitive" note is how the
   next author makes a fifth one.
8. **`PageHeader variant="plaque"`** (Sticker title + hangers) so the Dig-Off's genuinely good crown becomes part
   of the system instead of a private fork, plus a **ruling on which kicker is the page kicker** (`KICKER_PILL` vs
   `KICKER_TEXT`) — `PageHeader` and `season.tsx` currently disagree. Closes C-10.
9. **Dark-surface family: `WHIMSY.stage` + `EMBER_GRADIENT`**, beside `bark`, with a comment naming the ceremonies
   that own them. Closes C-23. The principle from the `bark` entry ("tokenized before first use, so the
   storyteller voice stays governable") is right; it just needs applying twice more.
10. **`PODIUM = { gold, silver, bronze }`** beside `RARITY_STRIPE`, deliberately *not* equal to `slopGold`, with a
    comment citing the charter's "money buys expression, never advantage or accomplishment." Closes half of C-13.
11. **`DIG_TILE` palette map** (`mud[0..2]`, `truffle`, `shimmer`, `unique`, `uniqueEdge`, `silhouette`) shared by
    the patch and the postcard. Closes C-14.
12. **`RADII.xs: 4`**, and a ruling that collapses `16` into `lg` or `xl`. Closes the residue of C-17.
13. **`TYPE.displayLg` (36/38)** for ceremony headlines, so `JudgementDayModal`'s 36 and `season.tsx`'s 30 resolve
    to one role instead of two literals. Closes the residue of C-19.
14. **Rules to add to `docs/design/taste-standard.md`** (no code, but the area cannot be governed without them):
    - `fontSize` is an integer.
    - `shadowOffset` / `shadowRadius` may not be written outside `constants/theme.ts`.
    - A component named `*Sheet` mounts `SlideUpSheet`; `*Modal` mounts `AdaptiveModalScaffold`; every dialog
      wears `DialogCloseRow` (used **0×** across this area's 14 modals).
    - A control that moves currency states its cost in its `accessibilityLabel`.
    - A file that imports `Animated` imports `useMotionPolicy`.
    - Irreversible or currency-moving actions use `ConfirmDialog`; arm-then-confirm is for reversible toggles only.
    - A transient overlay carrying news announces it (`AccessibilityInfo.announceForAccessibility`).
    - Badge glyphs are ink on a pastel fill — paper-on-pastel is never a legible pair in WHIMSY.
15. **A "one hero" composition rule for the Season tab** — at most one surface wears the full sun-yellow
    highlight, selected from a single `primaryAction` derivation. Closes C-26; needs design intent, not a token.

---

## Conformance pass — 2026-09-11 (wave 3, section C)

**Result: 1,137 → 0 `ttp/*` warnings across 48 files; lint flipped to error for the area in `.eslintrc.js`.**
Six parallel passes (the Season tab · the Truffle Patch + mudwar · the race boards · the season cards · the
ceremonies + sheets · expedition + stats), each against `03-section-pass-brief.md`. No `eslint-disable` anywhere;
surviving literals are named, commented drawing constants (`NODE`, `STONE`, `PATCH_SPRITE`, `STIR_TRACK_H`,
`COLLAGE`…). Full suite 205/205 green.

**Findings closed:** C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, C-09, C-10, C-11, C-12, C-13, C-14, C-15,
C-16, C-17, C-18, C-19, C-20, C-22, C-23, C-24, C-25, C-26, C-27, C-28, C-29, C-30, C-34. Highlights: the three page
crowns are `PageHeader` (`tab` on the Season tab, `plaque` on the Dig-Off); nine pressed idioms and five dissolves are
tokens; the Great Hunger and Zoomies meters are `ProgressTrack` with worded spoken labels and no numeric
announcement; the dig honours Reduce Motion (informational drivers become instant state, decorative ones rest);
every spend/claim control names its cost and consequence; the "one hero" rule holds on the Season tab via a single
`primaryAction` derivation; the reclaim flow's arm-then-confirm is a `ConfirmDialog`; every standings row is a
`ListRow`; every `*Sheet` is a `Sheet`, every raw Modal a scaffold with an exit.

**Primitive growth the section forced (landed):** `ProgressTrack.accessibilityLabel` + `announceValue`;
`Chip`/`Tag` tones `sky`/`roseDeep`/`muted`, `art` (image mark), `Chip.coin`; `Ribbon.corner`; `T` tones
`onDarkAccent`/`bless`/`curse`; `Sticker.borderStyle`; `Button` variants `handLink` and `lilac`;
`PageHeader` right-slot gap; `Sheet.modalVisible`; `ConfirmDialog` `confirmHint`/`cancelHint`/`presentation`;
`AdaptiveModalScaffold.dismissOnBackdrop`.

**Deliberate calls:** `SounderHomeCard`'s roster stays a wrap grid (rows would be a redesign); the spoils strip
stays a `Sticker` + roles rather than a bark band; ScuffleView's HP width-tween is gone (the hit reads in the
recoil); the digging hero numeral folds to `displayLg` (no Caprasimo above 36 by decision); the ceremonies present
as near-full-bleed stages inside the scaffold with the close row floated over the art.

**Open, for the card owners:** the one-hero rule reaches only what `season.tsx` draws — `FeedingAction`,
`SounderHomeCard`/`SounderStepCard` and `HungerHero` want a `hero`/`primaryAction` prop so the rule holds across
the whole scroll (wave 4 polish).
