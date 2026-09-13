# Findings — Auditor D · Shop / Collect / Rewards

Audited 2026-09-11 from source. 25 files, 9,289 lines. Full ten prompts on `app/(tabs)/shop.tsx`,
`components/ClosetView.tsx`, `components/ItemPreviewModal.tsx`; P4 token grep + P5 inventory on every
other file in the area.

**Counts:** P0 × 1 · P1 × 9 · P2 × 12 · P3 × 4 (26 findings).

---

## 1. Area summary

This is the **Collect** pillar's home turf: the three-view Shop (Today / Closet / Pen), the item preview
and purchase flow, the Trough co-funding lane, Achievements and Titles, and the two reward surfaces
(Mote Machine, rewarded-ad refill). The bones are genuinely strong — the Shop grid, the Closet
paper-doll, `TicketButton`, `TroughSection`, `MoteMachineFallback` and `AdRefillOffer` are as
token-disciplined as anything in the app, and the rarity-tint/stripe system in `theme.ts` is a real
piece of design governance. Two things are working against them.

The **single biggest systemic gap is that this area's spend, claim and equip controls are the least
governed controls in the app.** Every irreversible or costly action here is either a hand-rolled
`Pressable` that duplicates an existing primitive (`Button`, `SegmentedControl`, `ConfirmDialog`,
`AdaptiveModalScaffold`, `SlideUpSheet`), or a system `Alert.alert` — 8 of them, in the exact paths
`components/ui/ConfirmDialog.tsx:1-6` says it exists to replace. The consequence compounds: **13
Pressables across the Collect/Rewards half carry no accessibility props at all**, and every one of them
is a spend, a claim, or a filter — the shop grid itself included.

The second gap is that the rarity badge — the collectible's status marker, the thing this whole area
exists to sell — **fails WCAG AA at all five rarities**, in two files, from a third rarity color map
that lives outside `theme.ts`. `MoteWageringScreen` is the area's one outright design-specificity
failure and it is live (`MOTE_MACHINE_VISIBLE = true`).

---

## 2. Inventory table (P5)

| Element | File | Primitive or hand-rolled | States present | Duplicate elsewhere |
| --- | --- | --- | --- | --- |
| Shop page header (kicker + title + balance + ticket chip) | `shop.tsx:767-796` | **hand-rolled** | default | `PageHeader` (used on `achievements.tsx:150`) |
| Shop view toggle (Today/Closet/Pen) | `shop.tsx:863-893` | **hand-rolled** | default · pressed · active | `SegmentedControl` |
| Trough accordion header | `shop.tsx:800-837` | **hand-rolled** | default · pressed · expanded | — |
| Rarity legend (5 dots) | `shop.tsx:143-161` | **hand-rolled**, non-interactive | default | closet stripe (`ClosetView.tsx:623`) |
| Shop item card | `shop.tsx:193-278` | **hand-rolled** (not `Sticker`) | default · owned · wearing · members · locked · can't-afford · season-pass | `ClosetView` item card |
| Members ribbon | `shop.tsx:230-233` | hand-rolled chip | gated · identity | — |
| Catalog error card | `shop.tsx:895-914` | **hand-rolled** + `Button ghost` | error | `EmptyState` |
| Today empty / loading | `shop.tsx:939-945` | `EmptyState` / `LoadingBeat` | empty · loading | ✅ correct |
| Closet paper-doll slot chip | `ClosetView.tsx:388-418` | **hand-rolled** + `IconButton` remove | default · pressed · filled · empty | — |
| Closet title chip (nameplate) | `ClosetView.tsx:500-514` | **hand-rolled** | default · pressed · empty | — |
| Closet filter chips (5) | `ClosetView.tsx:533-550` | **hand-rolled** (`role="radio"`, no group) | default · selected | `SegmentedControl`; achievements chips; Titles chips |
| Closet category section head | `ClosetView.tsx:561-583` | **hand-rolled** | default · pressed · collapsed | `SectionHeader` |
| Closet item tile | `ClosetView.tsx:597-698` | **hand-rolled** | default · pressed · owned · wearing · unowned | shop card |
| Closet hint strip (dashed) | `ClosetView.tsx:518-522` | **hand-rolled** one-off | static | — |
| Closet empty | `ClosetView.tsx:705-709` | `EmptyState` | empty | ✅ correct |
| Item preview modal | `ItemPreviewModal.tsx:222-395` | `AdaptiveModalScaffold` + `Sticker` + `Button` | owned · wearing · affordable · locked · not-today · earned-not-sold · busy | ✅ best-in-area |
| Rarity badge | `ItemPreviewModal.tsx:277-284` | **hand-rolled** | default | `MysteryHatReveal.tsx:242-252` (same AA failure) |
| Trough CTA (seed spend) | `ItemPreviewModal.tsx:344-387` | `Button ghost` | default | — |
| Tickle-particle preview loop | `ItemPreviewModal.tsx:24-126` | bespoke `Animated` | looping only | **no Reduce Motion state** |
| Pen hero / fence scene | `PigPenView.tsx:132-163` | hand-drawn Views, tokenised | default | — |
| Pen pig card | `PigPenView.tsx:259-319` | **hand-rolled**, nested Pressable | default · previewing · recruited · disabled | shop/closet cards |
| Pen "Join Slop Club" CTA | `PigPenView.tsx:211-229` | **hand-rolled** | default · pressed · busy (`ActivityIndicator`) | `Button variant="gold"` |
| Pen companion confirm | `PigPenView.tsx:100-110` | **`Alert.alert`** | — | `ConfirmDialog` |
| Trough preset chips + Max | `TroughSection.tsx:247-277` | **hand-rolled**, no a11y | default · selected · unaffordable | `SegmentedControl` |
| Trough "Chip in N" (spend) | `TroughSection.tsx:280-291` | **hand-rolled**, no a11y | default · pressed · disabled · busy ("…") | `Button` |
| Trough progress bar | `TroughSection.tsx:209-211` | **hand-rolled** | 0–100% | achievements progress bar |
| Trough receipt card | `TroughSection.tsx:147-154` | hand-rolled sage card | success | — |
| Achievements page header | `achievements.tsx:150-169` | `PageHeader` | default | ✅ correct |
| Achievements filter chips (7) | `achievements.tsx:186-208` | **hand-rolled**, no a11y, badged | default · pressed · active · badge | Closet/Titles chips |
| Achievement card | `achievements.tsx:270-366` | hand-rolled | in-progress · ready · claimed-viewed | — |
| Achievement Claim button | `achievements.tsx:321-330` | **hand-rolled**, ~34pt, no a11y | default · pressed | `Button variant="gold"` |
| Achievements empty / loading | `achievements.tsx:218-232` | `EmptyState` / `LoadingBeat` | empty · loading | ✅ correct |
| Achievement digest modal | `AchievementDigestModal.tsx:108-182` | **raw `<Modal>`** + `Sticker` + `DialogCloseRow` | default | `AdaptiveModalScaffold` |
| Digest "Got it" button | `AchievementDigestModal.tsx:170-178` | **hand-rolled**, no a11y | default · pressed | `Button variant="dark"`; `LuckyPigModal.tsx:552` |
| Titles chips | `TitlesSection.tsx:96-117` | **hand-rolled**, no a11y | default · pressed · active · busy | `SegmentedControl` |
| Titles empty | `TitlesSection.tsx:77-86` | **hand-rolled `Sticker`** | empty | `EmptyState` |
| Titles unequip link | `TitlesSection.tsx:122-128` | **hand-rolled** underlined text | default · pressed | 3 ad-hoc link styles in area |
| Battle-pass sale modal (dormant) | `BattlePassSaleModal.tsx:63-151` | raw `<Modal>` + `Sticker`/`Tape` + `TicketButton` | default · busy | `AdaptiveModalScaffold` |
| Lucky Pig modal | `LuckyPigModal.tsx:~496-560` | **raw `<Modal>`**, no-op close | enter · sustain · outro · equipping | `AdaptiveModalScaffold` |
| Mystery hat reveal | `MysteryHatReveal.tsx:180-271` | raw `<Modal>` + `Sticker` + `Button dark` | box · open · fallback | `AdaptiveModalScaffold` |
| Buy celebration burst | `ui/BuyCelebration.tsx` | bespoke `Animated.Text` | fire only | **no Reduce Motion state** |
| TicketButton | `ui/TicketButton.tsx` | **primitive** (SVG ticket) | default · pressed · loading · disabled | ✅ best-in-area a11y |
| AnimatedCosmetic | `ui/AnimatedCosmetic.tsx` | primitive | motion · rest (policy-aware) | ✅ correct |
| RitualIconWell | `ui/RitualIconWell.tsx` | primitive | blessed · cursed | — |
| Mote Machine screen | `app/mote-machine.tsx` | tokenised custom + `Button gold` | idle→settled (7 phases) · error | ✅ token-clean |
| Mote wagering screen | `mote-machine/MoteWageringScreen.tsx` | **hand-rolled throughout** | 7 phases · uncertain · error | `SlideUpSheet`, `SegmentedControl`, `IconButton` |
| Mote machine fallback | `mote-machine/MoteMachineFallback.tsx` | `Sticker` + `Tape` + `PageBackground` | loading · error | ✅ best-in-area error state |
| Ad refill offer + sheet | `rewarded-ads/AdRefillOffer.tsx` | `Sticker` + raw `<Modal>` | hidden · age-gate · available · loading · granted · pending · closed · unavailable | `AdaptiveModalScaffold`, `Button` |
| Rosie gallery | `app/rosie-gallery.tsx` | dev-only `Redirect` shim (5 lines) | — | — |
| Ad refill preview | `app/ad-refill-preview.tsx` | dev-only `Redirect` shim (8 lines) | — | — |

---

## 3. Findings

### [P0] D-01 · System `Alert.alert` is the spend-and-commit dialog across the whole area

**Location** `app/(tabs)/shop.tsx:566, 581, 599, 606, 626, 639` · `components/PigPenView.tsx:100` ·
`components/TitlesSection.tsx:67`
**Prompts** P1 (heuristics 4, 8), P2, P10(f), P7
**Evidence**
```ts
// shop.tsx:639 — the buy path
Alert.alert("Today only", "This item is only available in today's shop.");
// PigPenView.tsx:100 — a permanent, unchangeable choice
Alert.alert(`Choose ${pig.name} as Rosie's friend?`,
  "This is your one long-term companion choice. You can't change it right now.", […]);
```
**Expected standard** `components/ui/ConfirmDialog.tsx:1-6`, verbatim: *"Replaces React Native's bare
Alert.alert for in-app actions that cost snouts or are otherwise irreversible. The system Alert is
jarring inside the paper-sticker / ink-border world the rest of the app lives in."* The prompt file
names "a system Alert in a spend path" as an **automatic P0 taste failure**.
**Gap** Eight system alerts, in the Slop Club purchase flow, the buy flow, the one-time-companion
commit, and the title equip. The most irreversible decision in the game (`PigPenView.tsx:100`) is
confirmed by an OS dialog in Helvetica on a grey sheet. The shop already has `showPurchaseToast` for
every *other* failure in the same function (`shop.tsx:654-701`) — the alerts are the inconsistent path,
not the norm.
**Recommendation** Rule: **no `Alert.alert` in `app/` or `components/` — ever.** Irreversible or costly
confirmations use `ConfirmDialog`; failures and info use `showPurchaseToast`. Add an ESLint
`no-restricted-properties` rule on `Alert` so the ban is enforced, not remembered.
**Pillar** Collect (the purchase is the collectible's moment) · craft/governance.

---

### [P1] D-02 · The rarity badge fails WCAG AA at every rarity, from a third rarity map outside `theme.ts`

**Location** `constants/hats.ts:1033-1039` · `components/ItemPreviewModal.tsx:194, 280, 471-476` ·
`components/MysteryHatReveal.tsx:247, 334-340`
**Prompts** P3 (color contrast), P4, P6
**Evidence**
```ts
// constants/hats.ts:1033 — the third map
export const RARITY_COLORS = { common:"#9098A2", uncommon:"#5BC97D", rare:"#5C9DFF",
  epic:"#9078FF", legendary:"#F5C44A" };
// ItemPreviewModal.tsx:471 — 11px text on it
rarityText: { fontSize: 11, fontFamily: FONTS.bodyExtra, color: WHIMSY.paper, letterSpacing: 1.2 }
```
Contrast of `WHIMSY.paper` (#fffaf0) on each fill: common **2.84:1** · uncommon **2.01:1** · rare
**2.63:1** · epic **3.26:1** · legendary **1.58:1**. AA for 11px text is 4.5:1. **All five fail; the
legendary badge — the one that matters most — is the worst.**
**Expected standard** `theme.ts:236-247` states the intent explicitly: *"One source of truth so the two
surfaces can't drift apart again."* It ships `RARITY_GRADIENT`, `RARITY_BG_SOLID` and `RARITY_STRIPE`.
`UI_COLORS` pairs every surface with a text-safe ink (`textPrimary`, `textSecondary`, `textOnDark`).
**Gap** A fourth, un-tokenised rarity map in `constants/hats.ts` that nothing in `theme.ts` knows about,
carrying five raw hex values, used as a *text background* with the lightest ink in the palette.
**Recommendation** Retire `RARITY_COLORS` into `theme.ts` as `RARITY_BADGE: Record<rarity, {bg, ink}>`
where `ink` is `WHIMSY.ink` on the light rarities and `WHIMSY.paper` only where it clears 4.5:1 — in
practice **every rarity badge takes ink text on the saturated fill**, matching the ink-on-sun of the
shop's price chip (`shop.tsx:402, 411`). One map, one pair, contrast validated at the token.
**Pillar** Collect (rarity is the collectible's grammar) · craft/governance.

---

### [P1] D-03 · The shop grid and the Shop's primary navigation carry no accessibility props

**Location** `app/(tabs)/shop.tsx:193-209` (ShopCard) · `shop.tsx:869-891` (view toggle)
**Prompts** P6, P1 (heuristic 4), P8 (Jakob)
**Evidence**
```tsx
// shop.tsx:193 — every purchasable item in the game
<Pressable ref={ref} onPress={onPress} onLayout={…} style={[shopCardStyles.card, …]}>
// shop.tsx:869 — Today / Closet / Pen
<Pressable key={v} onPress={() => { setView(v); setPrestigeOnly(false); }} style={…}>
```
No `accessibilityRole`, no `accessibilityLabel`, no `accessibilityState`. A screen-reader user hears the
card's text runs ("Top Hat", "1,200") with no indication it is tappable, no rarity, no owned/locked
state, and no idea that tapping opens a buy sheet. The view toggle announces three bare words with no
selected state. App baseline is 70 of 98 files carrying *some* a11y prop; this is a tab screen.
**Expected standard** `ClosetView.tsx:611-621` — in the same feature, by the same author — is the model:
`accessibilityRole="button"` + a composed label (`"${item.name}, ${active ? "wearing" : owned ? "owned"
: "not owned"}"`) + a state-aware `accessibilityHint`.
**Gap** The Closet pattern was never carried back to the Shop grid.
**Recommendation** Lift ClosetView's label/hint composition into a shared
`cosmeticAccessibility(item, {owned, active, locked, canAfford})` helper in `utils/`, and have both
grids consume it. Swap the view toggle for `SegmentedControl` (see D-10), which already ships
`accessibilityRole="radiogroup"` + per-option selected state.
**Pillar** Collect · craft.

---

### [P1] D-04 · Thirteen unlabeled Pressables — and every one is a spend, a claim, or a filter

**Location** `TroughSection.tsx:247, 264, 280, 300` · `achievements.tsx:186, 321` ·
`TitlesSection.tsx:96, 122` · `AchievementDigestModal.tsx:170` · `LuckyPigModal.tsx:~535, ~548` ·
`MysteryHatReveal.tsx:192` · `ClosetView.tsx:388, 500`
**Prompts** P6, P1 (heuristic 4)
**Evidence** `grep -c "<Pressable"` vs `grep -c accessibilityRole`: `TroughSection` 4/**0**,
`achievements` 2/**0**, `TitlesSection` 2/**0**, `AchievementDigestModal` 1/**0**, `LuckyPigModal`
2/**0**, `MysteryHatReveal` 1/**0**.
```tsx
// TroughSection.tsx:280 — spends real snouts, announced as "Chip in 25"
<Pressable onPress={() => donate(d, amt)} disabled={!canAfford || busy === d.id} style={…}>
```
**Expected standard** `components/ui/TicketButton.tsx:146-149` is the bar: `accessibilityRole`,
`accessibilityLabel ?? label`, `accessibilityHint`, and `accessibilityState={{disabled, busy}}`.
**Gap** The four files with the *best* token discipline in the area (`TroughSection` has zero raw
values) have the *worst* a11y coverage — the discipline was applied to style, never to semantics.
**Recommendation** Route every one through `Button` / `IconButton` / `SegmentedControl`, which carry
the props by construction. Where a bespoke Pressable must stay, the rule is: **a Pressable without
`accessibilityRole` + `accessibilityLabel` does not ship** — add it to the lint config alongside D-01.
**Pillar** Collect · Connect (the Trough is the social lane) · craft.

---

### [P1] D-05 · The Achievements Claim button is ~34pt tall and hand-rolled

**Location** `app/achievements.tsx:321-330, 552-565`
**Prompts** P6 (44pt), P8 (Fitts), P5
**Evidence**
```ts
claimBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: RADII.pill,
  borderWidth: 2, borderColor: WHIMSY.ink, backgroundColor: WHIMSY.sun, ...SHADOW_SM },
claimBtnText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
```
9 + ~16 (13px line box) + 9 ≈ **34pt**, no `hitSlop`, no `accessibilityRole`. It is the primary action
of the screen and sits inside a list row, where mis-taps are most likely.
**Expected standard** `ui/Button.tsx:38-42` — `SIZE_MAP.sm = { minH: 44, px: 14, py: 10, fs: 13, br: 22 }`.
Every `Button` size already guarantees 44pt. The Impeccable native check and the mobile-game
accessibility heuristics both set 44pt as the floor.
**Gap** `Button variant="gold"` renders exactly this look (sun gradient, ink border, `SHADOW_SM`,
13px ExtraBold) at a compliant size, and was not used.
**Recommendation** Replace with `<Button variant="gold" size="sm" accessibilityLabel={…}>Claim ✦</Button>`.
Add a system rule: **the minimum interactive height is `SIZE_MAP.sm.minH` (44); no bespoke control
declares its own padding-derived height.**
**Pillar** Collect.

---

### [P1] D-06 · `MoteWageringScreen` is the area's design-specificity FAIL — and it ships

**Location** `components/mote-machine/MoteWageringScreen.tsx:213-214, 224 (sheet header), styles.scrim,
styles.iconButton, styles.sheet` · flag `constants/featureFlags.ts:26` (`MOTE_MACHINE_VISIBLE = true`)
**Prompts** P2, P3, P4, P6, P10(d)(f)(g)(i)
**Evidence**
```tsx
<Pressable …><Text style={styles.iconText}>‹</Text></Pressable>
<Pressable …><Text style={styles.iconText}>⚙</Text></Pressable>
<Pressable …><Text style={styles.iconText}>×</Text></Pressable>
scrim: { …, backgroundColor: "rgba(34,20,17,0.45)" }
iconButton: { …, borderRadius: 22, … }  iconText: { fontSize: 24, color: WHIMSY.ink }
```
Plus: a raw `<Modal animationType="slide">` bottom sheet, a native `<Switch>`, `disabled:{opacity:0.35}`,
two `StyleSheet.hairlineWidth` borders, and **not one** `Sticker`, tilt, `STICKER_SHADOW`, or whimsy font
on the whole screen.
**Expected standard** P2's question — *could an unrelated product use this composition, interaction and
visual language unchanged?* — answers **yes**. The paper-craft DNA present: none. Missing: Sticker,
hard shadow, tilt, whimsy title, hand kicker, Glyph art. The dingbat ruling (2026-07-13) puts `×`
squarely in the semantic class that must render through `Icon "x"`. `MODAL_BACKDROP_BG`
(`theme.ts:200`) exists for exactly the scrim that is hand-mixed here. `SlideUpSheet`
(`ui/SlideUpSheet.tsx:1-16`) exists for exactly this bottom sheet, and lists the six hand-rolls it was
built to retire.
**Gap** A slot machine in a paper-craft storybook, built as a slot machine. Its sibling
`app/mote-machine.tsx` is token-clean, and `MoteMachineFallback.tsx` is the area's *best* card — the
wagering screen is the outlier, not the house style.
**Recommendation** Three swaps, in order: `SlideUpSheet` for the raw sheet Modal; `IconButton
name="x"` / a new `Icon "arrowLeft"` + `"gear"` for the three text glyphs; `MODAL_BACKDROP_BG` for the
rgba. Then a Sticker/tilt pass on the controls panel so it reads as the same world as the cabinet art
above it.
**Pillar** Collect · craft (this is the taste standard's "governance erosion" in its purest form).

---

### [P1] D-07 · `LuckyPigModal` has no escape hatch

**Location** `components/LuckyPigModal.tsx:~494` (`onRequestClose={() => {}}`)
**Prompts** P1 (heuristic 3 — user control and freedom), P6, P8 (Jakob)
**Evidence**
```tsx
<Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
```
No `DialogCloseRow`, no backdrop dismiss, and the Android hardware back is explicitly a no-op. The only
exit is the primary button, whose handler `handleViewReward` awaits `onEquipTitle` — if that RPC hangs,
`equipping` stays true, both buttons stay disabled, and the player is trapped in a celebration.
**Expected standard** Every other reward modal in the area gives a dismiss:
`AchievementDigestModal.tsx:124` (`DialogCloseRow`), `MysteryHatReveal.tsx:184` (back routes to the
next beat), `AdaptiveModalScaffold` (`showCloseButton` + `onAccessibilityEscape`). The mobile-game
accessibility heuristic is "sheets have an obvious close".
**Gap** A celebration is still a dialog.
**Recommendation** Move it onto `AdaptiveModalScaffold` with `showCloseButton`; wire `onRequestClose`
to the same dismiss the primary button calls, and time-box `equipping` so a stalled RPC releases the
controls. System rule: **`onRequestClose` is never an empty function.**
**Pillar** craft · Connect (losing/stuck states stay warm).

---

### [P1] D-08 · Four hand-rolled clones of `Button`, two of them byte-identical across files

**Location** `AchievementDigestModal.tsx:263-275` · `LuckyPigModal.tsx:552-560` ·
`PigPenView.tsx:438-455` · `achievements.tsx:552-565` · `AdRefillOffer.tsx:310-331` ·
`TroughSection.tsx:395-404`
**Prompts** P5, P2, P4
**Evidence** The same object, in two different files, written twice:
```ts
// AchievementDigestModal.tsx:263  ≡  LuckyPigModal.tsx:552
{ alignSelf:"center", marginTop:16, paddingHorizontal:24, paddingVertical:11,
  borderRadius:14, backgroundColor: WHIMSY.ink }
```
That is `Button variant="dark"` (`ui/Button.tsx:60`: `{bg: UI_COLORS.textPrimary, color:
UI_COLORS.textOnDark}`) with a raw `borderRadius: 14` instead of `SIZE_MAP.md.br = 22`, and no a11y.
`PigPenView.tsx:438` re-rolls `variant="gold"`; `AdRefillOffer.tsx:310` and `TroughSection.tsx:395`
re-roll a sun-filled primary; `achievements.tsx:552` re-rolls gold at a sub-44pt height (D-05).
**Expected standard** App baseline: the `Button` primitive is used in only 16 of 194 files. Taste
standard rule 1 — reach for the token/primitive, never inline.
**Gap** Six spend/claim/dismiss CTAs in this area alone, each drifting a few px and losing the
primitive's disabled/pressed/busy semantics and its `accessibilityState`.
**Recommendation** Swap all six to `Button`. Where the missing piece is a *tertiary* text action
(three underlined-text links in the area: `TitlesSection.tsx:127`, `PigFriendsLaunchModal.tsx:176`,
`LuckyPigModal.tsx:~562`), that is a genuine gap — add `Button variant="link"` (see System asks) rather
than letting each surface invent one.
**Pillar** craft/governance.

---

### [P1] D-09 · The Trough seed spends snouts on one tap of the *least* prominent button

**Location** `components/ItemPreviewModal.tsx:342-392`
**Prompts** P7, P8 (Von Restorff), P1 (heuristic 5)
**Evidence**
```tsx
<Button size="md" variant="ghost" full onPress={async () => {
  const seed = Math.ceil(item.cost * 0.1);
  const r = await rpcAction(…, { target_item_id: item.id, seed_snouts: seed });
```
`variant="ghost"` is the palette's quietest fill (`ui/Button.tsx:53-57`: paper bg, separator border) —
it sits *below* the disabled `locked` variant in visual weight, and it is the only control in the modal
that spends money without an intermediate step. The cost appears only in the caption *underneath*
(`:388-391`), not on the button. The Buy CTA above it, which also spends in one tap, at least states its
price in the `priceWrap` row.
**Expected standard** P7: *high-stakes moments (spending snouts…) are given reassurance and an
undo/cancel path*. Charter decision-lens 4: *does losing still feel warm?* — the Trough carries a
3-day opener cooldown, so a mis-tap costs the player three days.
**Gap** Both spend paths in the preview are one-tap-no-confirm, and the cooldown-bearing one is the
quieter of the two.
**Recommendation** (a) Put the cost on the label: `Open a Trough · {seed}` with a `SnoutCoin`, the way
`ConfirmDialog`'s `confirmLabel`/`confirmCoin` API already models. (b) Gate it behind `ConfirmDialog`
(it has a cooldown; the Buy does not). (c) Add a **balance-after line** to both spend paths — `"you'll
have {balance - cost} left"` — as a reusable `SpendReassurance` row. Rule: **a control that spends
states its cost on its own face.**
**Pillar** Collect · Connect (the Trough is the friends-chip-in lane).

---

### [P1] D-10 · `SegmentedControl` is bypassed four times, each with a different look and 5–7 options

**Location** `shop.tsx:863-893` (3 opts) · `ClosetView.tsx:524-553` (5 opts) ·
`achievements.tsx:176-211` (7 opts) · `TitlesSection.tsx:92-120` (n opts)
**Prompts** P5, P8 (Hick), P7, P3 (layout), P6
**Evidence** Four filter/segment rows, four visual languages: Shop = pill track with rose active
(`viewToggle`); Closet = `RADII.pill` chips, muteSoft→ink border swap, sun active; Achievements =
`RADII.pill` chips, 1.5 ink border, lilac active, with a badge; Titles = `RADII.lg` chips, lilac active,
two-line. Only the Closet row declares `accessibilityRole="radio"`, and it has no `radiogroup` parent.
**Expected standard** `ui/SegmentedControl.tsx:27-42`: *"Compact mutually-exclusive choices with full
44pt targets and explicit selected semantics"* — ships `accessibilityRole="radiogroup"`, a required
`label`, per-option icons, and 44pt targets by construction.
**Gap** Beyond the duplication: **Achievements shows 7 filters and the Closet 5 at a single decision
point**, past P7's >4 threshold, and the Achievements row scrolls horizontally so options 6–7 ("Social",
"The Dig") are off-screen with no affordance that they exist.
**Recommendation** Adopt `SegmentedControl` in all four. Where a set exceeds 4, the system needs a
second shape — recommend collapsing Achievements to **All · Ready · Category ▾** (a 3-segment control
plus a category menu) rather than a 7-wide scroller. Add a scroll-edge fade to any horizontal chip row
that survives.
**Pillar** Collect · craft.

---

### [P2] D-11 · Two decorative loops with no Reduce Motion alternative

**Location** `components/ui/BuyCelebration.tsx:34-156` · `components/ItemPreviewModal.tsx:24-126`
**Prompts** P6, P10(e)
**Evidence** `grep useMotionPolicy|reduceMotion` → `BuyCelebration` **0** hits across 7 `Animated.`
uses; `ItemPreviewModal` **0** across 6. The particle preview runs `setInterval(burst, 1100)` firing
6–8 animated floats **for as long as the modal is open** (`:74`), unconditionally.
**Expected standard** `PigFriendsLaunchModal.tsx:36-40`, `MysteryHatReveal.tsx:90`,
`AnimatedCosmetic.tsx:59-67` (`startDecorativeLoop`), `LuckyPigModal`, `AchievementDigestModal` all
honour `useMotionPolicy` — 5 of 7 animated files in the area do it right.
**Gap** The two that don't are the purchase celebration (fires on every buy, app-wide, mounted at the
shop root) and the tickle-particle product shot (a perpetual loop).
**Recommendation** `BuyCelebration.fire` → when `reduceMotion`, skip the burst and play only the haptic
+ toast. `TickleParticlePreview` → when `reduceMotion`, render a single static sprite ring with a
"particles drift up on each tickle" caption. Rule already implied by `startDecorativeLoop`: **every
`Animated.loop` and every particle burst routes through `useMotionPolicy`.**
**Pillar** craft.

---

### [P2] D-12 · Bordered controls are dissolved by opacity, against the 2026-07-07 ruling

**Location** `TroughSection.tsx:254` (`opacity:0.4`) · `PigPenView.tsx:595` (`0.5`) ·
`MoteWageringScreen.tsx` `disabled` (`0.35`) · `shop.tsx:383, 409` (`0.85`) ·
`ClosetView.tsx:987` (`0.42`) · `achievements.tsx:444` (`0.86`)
**Prompts** P3, P10(j), P4
**Evidence**
```ts
// TroughSection.tsx:254 — a bordered, ink-outlined preset chip
!afford && { opacity: 0.4 }
```
**Expected standard** Taste-standard decision log, 2026-07-07: *"waiting/cooldown states keep the
control's shape — you mute the fill, you never dissolve the outline."* `Button`'s `locked` variant
implements it (`ui/Button.tsx:63-70`: muted fill, ink text, full 2px outline, **no opacity crush**).
`shop.tsx:406-410` gets it right for the price chip (cream fill + muteSoft border **and** 0.85), and
wrong for the card (`:383`, a blanket 0.85).
**Gap** Six opacity values (0.35 · 0.4 · 0.42 · 0.5 · 0.85 · 0.86) doing the job one variant should do,
and no opacity token exists (app-wide: 0.7 × 70, 0.85 × 28, 0.6 × 22, …).
**Recommendation** Two tokens and one rule. `STATE_OPACITY = { pressed: 0.7, gated: 0.85 }`; **disabled
is a fill+ink swap, never an opacity.** Route the four disabled cases to `Button variant="locked"` or a
`chipLocked`-style fill swap; keep `gated` only for whole-card dimming.
**Pillar** craft/governance.

---

### [P2] D-13 · Three hand-rolled progress bars, no `ProgressTrack` primitive

**Location** `TroughSection.tsx:209-211, 354-362` · `achievements.tsx:334-342, 505-518`
**Prompts** P5, P3 (layout), P4
**Evidence**
```ts
// TroughSection.tsx:354                    // achievements.tsx:505
track: { height:14, borderRadius:RADII.pill,    progressTrack: { height:12, borderWidth:2,
  borderWidth:2, borderColor:WHIMSY.ink,          borderColor:WHIMSY.ink, borderRadius:RADII.pill,
  backgroundColor:WHIMSY.cream2, overflow:"hidden" }   backgroundColor:WHIMSY.cream2, overflow:"hidden" }
fill: { height:"100%", backgroundColor:WHIMSY.sun }   progressFill: { height:"100%", backgroundColor:WHIMSY.lilacDeep }
```
Same component, two heights (14 vs 12), two fill hues, and neither declares
`accessibilityRole="progressbar"` / `accessibilityValue`.
**Expected standard** Netguru/UXPin component-inventory method: the same job done twice with a
different look is a missing primitive.
**Gap** No `ProgressTrack` exists; the season pass track is a likely third instance outside this area.
**Recommendation** Add `components/ui/ProgressTrack.tsx` — `{value, max, tone: "sun"|"lilac"|"sage",
height?: 12}` — carrying the ink border, `RADII.pill`, `cream2` bed, `overflow:hidden`, and
`accessibilityRole="progressbar"` + `accessibilityValue={{min,max,now}}` for free.
**Pillar** Collect · Contend (progress is the shared readout) · craft.

---

### [P2] D-14 · Five raw `<Modal>` mounts with fixed-height heroes that clip at large Dynamic Type

**Location** `AchievementDigestModal.tsx:108` (list `maxHeight: 238`) · `LuckyPigModal.tsx:~492`
(`heroWrap` 220×220, no scroll) · `MysteryHatReveal.tsx:180` (`hero`/`boxTap` 160×160, no scroll) ·
`BattlePassSaleModal.tsx:63` · `AdRefillOffer.tsx:80, 160`
**Prompts** P6 (200% Dynamic Type), P5, P10(g)
**Evidence**
```ts
list: { width:"100%", maxHeight: 238, marginTop: 14 }   // AchievementDigestModal.tsx:227
heroWrap: { width:220, height:220, … }                   // LuckyPigModal.tsx
```
None of the five gives its content a scroll path, and three pin a hero at a fixed pt size above text
that grows.
**Expected standard** `ui/AdaptiveModalScaffold.tsx:46-50`, verbatim: *"Phone-first modal shell that
remains usable on compact-height windows and with accessibility text sizes. The frame is sized from the
current window… respects safe areas, and always gives dense content a scroll path."* App baseline: 33
files mount a raw `<Modal>`; 13 use the scaffold. `ItemPreviewModal.tsx:222` in this same area does it
right.
**Gap** Five of the area's reward/purchase moments — the ones most likely to matter to a player — will
clip at 200% text.
**Recommendation** Move all five onto `AdaptiveModalScaffold`. For the fixed heroes, express the size as
a fraction of the scaffold's computed `availableHeight` rather than a constant, or let them shrink under
`maxHeight` with the text scrolling past.
**Pillar** craft.

---

### [P2] D-15 · The Shop wears no crown; the Closet's sections wear no `SectionHeader`

**Location** `shop.tsx:767-796, 1048-1058` · `ClosetView.tsx:561-583, 931-953` ·
`TitlesSection.tsx:79, 91, 136`
**Prompts** P5, P9, P10(g)
**Evidence**
```tsx
// shop.tsx:771 — hand-rolled kicker + title, the exact shape PageHeader ships
<View style={{ flex: 1 }}>
  <Text style={styles.kicker}>★ your closet</Text>
  <Text style={styles.title}>Shop</Text>
</View>
// ClosetView.tsx:941 — a section title off the TYPE scale
sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink }
```
`TYPE.sectionTitle` is 22/24; this is a bare 20.
**Expected standard** `ui/PageHeader.tsx:19-25`: *"Mirrors the hand-rolled headers on Shop / Friends /
Achievements so they can't drift apart again."* The Shop is named in the primitive's own docstring as
the thing it was built to absorb, and still hasn't been migrated. Taste-standard roadmap item 4 flags
exactly this: *"pruning the now-dead per-screen header styles the `PageHeader` swap left behind."*
Also note the Shop kicker reads **"★ your closet"** above the title **"Shop"** — the kicker names a
different destination from the title, and "Closet" is one of the three tabs *below* it.
**Gap** Achievements migrated (`achievements.tsx:150`); Shop and Closet did not.
**Recommendation** `PageHeader` on Shop, with the balance pocket + ticket chip in `right` and the
segmented toggle in `below`; fix the kicker to `★ the shop`. `SectionHeader` for the Closet's category
rows (its `right` slot takes the "N owned · M missing" line) and for `TitlesSection`'s `★ titles · N`.
**Pillar** craft ("every screen wears the same crown").

---

### [P2] D-16 · Five bare `ActivityIndicator`s and an inline status string where the system has cozy states

**Location** `PigPenView.tsx:223, 309, 325, 327` · `TicketButton.tsx:190` · `AdRefillOffer.tsx:195`
**Prompts** P5, P10(h), P2
**Evidence**
```tsx
{loading && busyPigId == null ? <ActivityIndicator size="small" color={WHIMSY.ink} /> : null}
{message ? <Text style={styles.message}>{message}</Text> : null}   // PigPenView.tsx:324-327
```
`PigPenView` reports every recruit/activate outcome as a bare centred sentence at the bottom of a
long scroll — often off-screen from the button that caused it — while the rest of the Shop uses
`showPurchaseToast`.
**Expected standard** Taste-standard rule 4: *"A `Sticker` with a `Glyph` and a warm line — never a bare
gray string or a naked spinner."* `EmptyState`/`LoadingBeat` exist and are used correctly at
`shop.tsx:939`, `achievements.tsx:218`, `ClosetView.tsx:705`. App baseline: 11 files still use
`ActivityIndicator`.
**Gap** The Pen — the Slop Club's shop window — is the least cozy surface in the area.
**Recommendation** `LoadingBeat label="gathering the pigs"` for the roster load; `Button`'s own busy
state (or `TicketButton`'s `loading`/`loadingLabel`) for the per-card action; `showPurchaseToast` for
the outcome message. Keep the inline `ActivityIndicator` only inside a control that is itself the
progress indicator.
**Pillar** Collect · craft.

---

### [P2] D-17 · Capitalisation and naming drift: three conventions, one dishonest label

**Location** `mote-machine.tsx:632-651` + `MoteWageringScreen.tsx` (ALL-CAPS) · `achievements.tsx:329`
("Claim ✦") · `shop.tsx:772` ("★ your closet" over "Shop") · `ClosetView.tsx:136` ("BG")
**Prompts** P9, P10(b)
**Evidence** Sentence case dominates the area ("Buy now", "Wear", "Take off", "Chip in 25", "Got it",
"Oink!", "Watch ad"). The two Mote surfaces are entirely upper: `"PULL THE LEVER"`, `"CHECK LAST PLAY"`,
`"FIND A MOTE"`, `"WAGER 3 MOTES"`, `"PAYTABLE"`, `"HISTORY"`, `"INVENTORY"`, `"RELOAD MACHINE"`,
`"LOAD 20 MORE"`. That is not the tracked `kickerPill` caps (a typographic device) — it is button and
status *copy* set in caps.
Separately, `achievements.tsx:14-16` documents that *"auto-grant of the reward itself happens
server-side when the threshold is crossed"* — the button labelled **"Claim ✦"** only stamps `viewed_at`.
**Expected standard** P9 label consistency; charter — *"cozy names on screen"*, *"Numbers are honest"*.
**Gap** A player who taps "Claim" believes they are collecting something that is already theirs; a
failure of that RPC (fire-and-forget, `:142`) would look like a lost reward.
**Recommendation** One convention: **sentence case for all button and status copy; UPPERCASE reserved
for `TYPE.kickerPill` / `kickerPillSm` label typography only.** Rename `"Claim ✦"` → `"Got it ✦"` (it
matches the digest modal's own "Got it", which does the identical job). Fix the Shop kicker (D-15) and
spell "BG" as "Scenes".
**Pillar** craft · Collect (honest rewards).

---

### [P2] D-18 · Colors computed or inlined past the token layer

**Location** `PigPenView.tsx:273` + `PigFriendsLaunchModal.tsx:96` (`pig.accent + "33"`) ·
`ui/AnimatedCosmetic.tsx:213` (`"#F5C44A"`) · `:248` (`"#FFFFFF"`) · `LuckyPigModal.tsx` `sparkleDot`
(`"#FFB000"` + `"rgba(255,215,0,0.6)"`) · `utils/pigs.ts:21-56` (6 raw `accent` hex)
**Prompts** P4, P3 (color contrast)
**Evidence**
```tsx
<View style={[styles.pigArt, { backgroundColor: `${pig.accent}33` }]}>   // PigPenView.tsx:273
backgroundColor: fx.glow.color ?? "#F5C44A",                             // AnimatedCosmetic.tsx:213
```
`#F5C44A` **is** `WHIMSY.slopGold` — tokenised on 2026-07-12 precisely to stop this literal leaking, and
it leaked again into the members-only cosmetic renderer.
**Expected standard** Taste-standard rule 1 — *"If a value isn't a token, either use an existing token
or add one — never inline a raw hex."* The 2026-07-12 log entry names `#F5C44A` by name.
**Gap** Six pig accents live outside `WHIMSY` entirely, and `+"33"` string-concatenation makes their
20% tints uninspectable and untunable.
**Recommendation** Move the pig accents into `WHIMSY` as a `PIG_ACCENT` record with an explicit
`{solid, tint}` pair (no alpha concat — a tint is its own token, so contrast is checkable). Replace
`AnimatedCosmetic`'s default with `WHIMSY.slopGold` and `"#FFFFFF"` with `WHIMSY.paper`. Retire
`LuckyPigModal`'s `sparkleDot` `textShadow` outright — it is the area's only soft shadow
(`textShadowRadius: 6`), against the two-hard-tiers rule.
**Pillar** craft/governance.

---

### [P2] D-19 · Semantic marks still rendered as text glyphs

**Location** `ClosetView.tsx:409, 851` (`+`) · `ui/RitualIconWell.tsx:66` (`☁`) ·
`MoteWageringScreen.tsx` (`‹`, `⚙`, `×` — see D-06)
**Prompts** P6 (icon-set consistency), P2, P10(d)
**Evidence**
```tsx
<Text style={styles.slotPlus}>+</Text>        // ClosetView.tsx:409
slotPlus: { fontSize: 22, color: WHIMSY.mute }
<Text style={styles.badgeGlyph}>{blessed ? "✦" : "☁"}</Text>   // RitualIconWell.tsx:66
```
`Icon` already exports `"plus"` (`ui/Icon.tsx:39`). `☁` means *cursed* — it carries meaning, it scales
and colours independently of the icon set, and it has no `accessibilityLabel` beside it.
**Expected standard** The dingbat ruling (2026-07-13): *"`✦` and `·` are SANCTIONED as label
typography… `✓`, `✕`, and `♥` are SEMANTIC — they carry meaning and must scale and color like the rest
of the iconography."* `+`, `‹`, `⚙`, `×` and `☁` are all in the semantic class.
**Gap** The ruling swept the three named marks; the class it defined was never applied to the rest.
**Recommendation** Restate the rule by class, not by character: **any mark that names an action or a
state renders through `Icon`/`Glyph`; only flourish marks (`★ ✦ ·`) stay as `Text`.** `Icon "plus"`
for the empty slot; a `Glyph "cloud"` for the curse badge; see System asks for the missing `arrowLeft`
and `gear`. Also note the `✦` art fallback at `shop.tsx:98, 130` and `ItemPreviewModal.tsx:120` is a
*missing-art placeholder*, not a label — it should be a `Glyph "sparkle"` (which `ClosetView.tsx:645`
already uses for the same case).
**Pillar** craft/governance.

---

### [P2] D-20 · Hand-rolled empty and error states where `EmptyState` is the rule

**Location** `TitlesSection.tsx:77-86` · `shop.tsx:895-914`
**Prompts** P5, P10(h), P2
**Evidence**
```tsx
<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.empty}>
  <Text style={styles.emptyText}>Earn titles by climbing the snout season pass.</Text>
</Sticker>                                            // TitlesSection.tsx:80-84
```
No glyph, no title line, a 13px hand font as the only content. The shop's error card
(`:895-914`) is a bespoke `COLORS.paper2` row (legacy palette, `theme.ts:104`).
**Expected standard** `ui/EmptyState.tsx:19-22`: *"Pick a glyph that fits the surface… the contextual
art is the cozy, intentional touch a bare string can't carry."* App baseline: `EmptyState` in 30 files.
**Gap** The Titles empty state is the *first* thing a new player sees in that section, and it is the
least designed.
**Recommendation** `<EmptyState glyph="star" title="No titles yet" sub="Climb the snout season pass to
earn your first." />`. For the shop error, an `EmptyState` variant with a retry slot — or add
`action?: ReactNode` to `EmptyState` so error, empty and locked all compose from one card (see System
asks).
**Pillar** Collect · craft.

---

### [P2] D-21 · "Loss" — the one place a reward surface states a cold feeling

**Location** `components/mote-machine/MoteWageringScreen.tsx` (`outcomeLabel`, `receiptCopy`, `status`)
**Prompts** P7, P10(c), P2
**Evidence**
```ts
outcomeLabel = { legacy_resource:…, loss: "Loss", returned_stake: "Stake returned", small: "Small win",
  big: "Big win", jackpot: "Jackpot" }
// rendered as: "Loss · 3 Motes staked · 0 Motes returned · -3 net · 12 available · v4"
status = "A wager can lose the full stake. Review the paytable before playing."
```
A bare noun, a negative number, and five dot-separated figures — the receipt reads like a betting slip.
**Expected standard** Charter decision-lens 4 — *"Does losing still feel warm? …there is no decline
button, no public zero."* Taste standard — *"Show feelings, never state them."* Compare the area's own
best line, `MoteMachineFallback.tsx:44`: *"Your Mote was not spent. Reload the machine or go back."*
**Gap** Every other loss-adjacent surface in the area is warm (`shop.tsx:943` "All sold out for today /
A fresh drop arrives at sunrise"; `TroughSection.tsx:37` "leave room for the rest of the sounder").
**Recommendation** Rewrite the outcome vocabulary in Rosie's voice ("The reels went quiet." / "Nothing
this time — your Motes keep coming."), and move the audit figures behind the existing **HISTORY** sheet
where a player who wants them can look. The headline is one warm sentence; the ledger is a detail view.
**Pillar** Collect · charter (warm loss).

---

### [P2] D-22 · A third shadow tier and a fifth border weight

**Location** `ClosetView.tsx:973` (`shadowOpacity: 0.35`) · `AchievementDigestModal.tsx:240` +
`LuckyPigModal.tsx` `titleReward` + `MoteWageringScreen.tsx` `row`/`history`
(`StyleSheet.hairlineWidth`) · `ui/TicketButton.tsx:79, 98` (SVG shadow at 5,5; `strokeWidth={3}`)
**Prompts** P3, P4, P10(i)
**Evidence**
```ts
itemCardUnowned: { borderColor: WHIMSY.muteSoft, shadowOpacity: 0.35 }   // ClosetView.tsx:971-974
borderBottomWidth: StyleSheet.hairlineWidth                              // ×4 in the area
```
**Expected standard** `theme.ts:80-88, 174-182` — *"the ONLY two shadow tiers per the June 2026 UI
audit"*, both at `shadowOpacity: 1, shadowRadius: 0`. App-wide there is exactly **one** soft shadow
(`TierUpBanner`); `ClosetView.tsx:973` makes two.
**Gap** `shadowOpacity: 0.35` on a hard-offset shadow produces a grey ghost offset — neither tier.
`StyleSheet.hairlineWidth` (~0.33pt) is a sub-pixel hairline inside a 2px-ink paper-craft world, and
the border weights now run 0.33 · 1 · 1.5 · 2 · 2.5 · 3 with no token naming any of them.
**Recommendation** Replace `shadowOpacity: 0.35` with the existing gated fill/border swap (D-12). Add
`BORDER = { hair: 1, thin: 1.5, ink: 2 }` to `theme.ts` (app baseline: 2 × 255, 1.5 × 129, 1 × 12 — the
scale already exists, it just has no name) and ban `StyleSheet.hairlineWidth` in favour of
`BORDER.hair`.
**Pillar** craft/governance.

---

### [P3] D-23 · Residual token leakage (see the triage table in §5)

**Location** across the area; worst in `ItemPreviewModal.tsx` (8 raw `fontSize`, 15 raw pads),
`ClosetView.tsx` (8 / 17), `BattlePassSaleModal.tsx` (11 / 20), `achievements.tsx` (10 / 15)
**Prompts** P4
**Expected standard** Taste-standard rule 2 + rule 3 ("leave it better").
**Gap** 62 raw `fontSize`, 16 raw `borderRadius`, 131 raw padding/margin/gap in-area, against an app
baseline of 521/169/980 — i.e. this area holds ~12% of the app's raw type and ~13% of its raw spacing
in ~13% of its files. **Proportionate, not exceptional** — this is the app-wide sweep, not an area fire.
**Recommendation** Fold under the roadmap's file-by-file sweep. Two quick wins that retire whole
clusters: `TYPE.cardTitleSm` (15px Caprasimo) covers `shop.tsx:386, 411` and `ClosetView.tsx:1009`;
`RADII.pill` covers `shop.tsx:397`; `RADII.lg` covers the two `borderRadius: 14` dark buttons (D-08).
**Pillar** craft/governance.

---

### [P3] D-24 · Dead styles and a dormant shipped modal

**Location** `ItemPreviewModal.tsx:443-461` (`previewPig`, `overlayBox`, `emojiPlaceholder`) ·
`achievements.tsx:373` (`statsLine: {}`) · `components/BattlePassSaleModal.tsx:1-7` ·
`AchievementDigestModal.tsx:201` (redundant `...STICKER_SHADOW` on a `Sticker`)
**Prompts** P4, P5
**Evidence** `BattlePassSaleModal.tsx:1-7` self-documents: *"DORMANT (2026-07-13)… No live caller
today"* — 240 lines with 11 raw `fontSize` and 20 raw pads still in the bundle. `emojiPlaceholder:
{fontSize: 80}` is a fossil of the pre-`Glyph` era.
**Recommendation** Delete the four dead style objects. Keep `BattlePassSaleModal` per its own note, but
move it under `components/dormant/` (or behind the same `__DEV__` require shim `app/rosie-gallery.tsx:2`
uses) so it stops counting against the area's token debt and can't be resurrected without a review.

---

### [P3] D-25 · Icon-set gaps force rotation hacks and text glyphs

**Location** `app/mote-machine.tsx:523, 703` (`arrowRight` rotated 180°) ·
`MoteWageringScreen.tsx` (`‹`, `⚙`) · `ClosetView.tsx:409` (`+`)
**Prompts** P6 (icon consistency), P5
**Evidence** `ui/Icon.tsx:16-45` has `arrowRight`, `chevronDown`, `check`, `x`, `plus`, `lock` — but no
`arrowLeft`, `chevronLeft`, or `gear`.
```ts
backIcon: { transform: [{ rotate: "180deg" }] }   // mote-machine.tsx:703
```
**Recommendation** Add `arrowLeft`, `chevronLeft` and `gear` to `IconName`, drawn as first-class paths
(a rotated arrow is a different optical shape, and the 180° hack breaks any future asymmetric arrow).
Then D-06's and D-19's swaps have somewhere to land.

---

### [P3] D-26 · `emoji` survives as a code noun in a no-emoji app

**Location** `ui/BuyCelebration.tsx:20-26, 68, 149` · `ItemPreviewModal.tsx:210` ·
`shop.tsx:489` (`emoji: catalogItem?.emoji`) · `constants/emojiArt.ts` (module name)
**Prompts** P9, P10(d)
**Evidence**
```ts
type Particle = { id:number; dx:number; dy:number; rot:number; emoji: string };
emoji: palette[Math.floor(Math.random() * palette.length)],   // holds "★" | "✦" | "♥"
```
No emoji character renders — the values are sanctioned print glyphs, and `constants/emojiArt.ts`
actually serves PNG art. The *name* is the problem.
**Note on the `♥` carve-out:** `BuyCelebration.tsx:49-54` asserts in a comment that `♥` rides as
animated confetti outside the dingbat ruling's semantic class. That carve-out is not in the taste
standard's decision log. Either log it (the reasoning is sound — a `Glyph` mid-burst would fracture the
palette) or swap the burst to `Glyph "heart"` sprites throughout.
**Recommendation** Rename to `glyph` / `constants/glyphArt.ts` per the project convention *"technical
names for modules… player-facing words stay in UI, not code"* — here the code noun names a thing the
charter bans. And log the `♥` ruling either way.

---

## 4. Heuristic scorecard (P1)

| # | Heuristic | Shop (`shop.tsx`) | Closet (`ClosetView.tsx`) | Preview (`ItemPreviewModal.tsx`) |
| --- | --- | --- | --- | --- |
| 1 | Visibility of system status | **3** — balance snaps optimistically (`:708`), countdown in header; busy state is only a dimmed button | **3** — equip is instant + haptic; no confirmation that the write landed | **2** — `busy` only dims the CTA; no progress, no post-buy state in-sheet |
| 2 | Match to the real world | **4** — "Today's Drop", snouts pocket, closet, drop resets at sunrise | **4** — paper-doll fitting room is the right metaphor, exactly | **4** — product shot on a rarity panel; the frozen-pig ruling is correct |
| 3 | User control and freedom | **2** — no undo on buy; "Today only" is a dead-end `Alert` (D-01) | **4** — every equip is one tap to reverse; ✕ on each slot | **3** — close is present; the Trough seed has no confirm and a 3-day cooldown (D-09) |
| 4 | Consistency and standards | **2** — hand-rolled header, toggle, card; `COLORS.*` legacy at `:246, 421, 439, 1125` | **2** — hand-rolled section head, filters, tiles; `fontSize: 20` off-scale | **3** — scaffold + `Button` used; rarity badge off-token (D-02) |
| 5 | Error prevention | **2** — client gates `cost<=0`/not-daily, but the fallback is an `Alert` | **4** — unowned tiles route to preview, never a failed equip | **3** — every unbuyable state has its own `locked` label; no balance-after |
| 6 | Recognition over recall | **4** — rarity legend, owned check, price on the face | **3** — good tile states; "BG" needs recall | **4** — the sheet states everything |
| 7 | Flexibility and efficiency | **3** — three views, deep-link params, no search/sort | **3** — 5 filters + collapse + slot-jump, no search over a full catalog | n/a |
| 8 | Aesthetic and minimalist design | **4** — the redesign's restraint (dot + legend, no word pills) is genuinely good | **3** — the dashed hint strip and two competing corner badges add noise | **4** — clean; the hero carries it |
| 9 | Error recovery | **2** — error card is hand-rolled + legacy palette; alerts are dead ends | **3** — no error surface at all (silent) | **3** — Trough failures map to warm, specific copy (`:371-382`) — the area's best error mapping |
| 10 | Help and documentation | **3** — no "how the shop works"; the Trough explainer lives a level down | **4** — the "★ Owned items dress Rosie" hint (`:520`) is exactly right | **3** — "Earned, not sold" teaches well |

**Totals:** Shop **27/40** · Closet **33/40** · Preview **33/40**.

---

## 5. Token triage (P4)

Counts are per-file grep for raw `#hex` · `rgba(` · `fontSize: N` · `borderRadius: N` ·
`padding|margin|gap: N` · legacy `COLORS.*`.

| File | hex | rgba | fSize | bRadius | pad/gap | COLORS.* | Top literals | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `shop.tsx` | 0 | 0 | 7 | 4 | 12 | **4** | `fontSize 11/12/15/16`; `borderRadius 6/7/13/999`; `gap 6`, `pV 8` | `999`→`RADII.pill`; `15`→`TYPE.cardTitleSm`; `COLORS.successText`→`UI_COLORS.successText`; `COLORS.paper2`→`WHIMSY.cream` |
| `ClosetView.tsx` | 0 | 0 | 8 | 3 | 17 | 0 | `fontSize 11×3/13/14×2/20/22`; `bR 11/12/16`; `gap 10`, `pad 14`, `pV 5/6/9` | `20`→`TYPE.sectionTitle` via `SectionHeader`; `13`→`cardTitleSm`; `11`→`kickerPillSm`; `10`→`SPACE.sm`(8) or `md`(12) |
| `ItemPreviewModal.tsx` | **1** | 0 | 8 | 1 | 15 | 0 | `fontSize 11/13/14/15/22/26/38/80`; `bR 8`; `pT 58`, `pH 22`, `pB 24` | `26`→`TYPE.pageTitle`; `22`→`TYPE.sectionTitle`; `15`→`TYPE.body`; `8`→`RADII.sm`; 3 dead style objects (D-24) |
| `PigPenView.tsx` | 0 | 0 | 1 | 0 | 1 | 0 | `fontSize 26` (`pigName`); `${accent}33` | `26`→new `TYPE.handDisplayLg` or `handDisplay`(21); accent→token (D-18). **Otherwise exemplary** |
| `PigFriendsLaunchModal.tsx` | 0 | 0 | 0 | 1 | 5 | 0 | `bR 3`; `gap 6/8`, `pB 12`, `pV 1`, `pH 6` | `3` is below `RADII.sm`(8) — nearest is `sm`; `6/8`→`SPACE.sm` |
| `TroughSection.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | **Zero leakage. The area's token exemplar.** |
| `BattlePassSaleModal.tsx` | 0 | 0 | **11** | 0 | **20** | 0 | `fontSize 12×4/13/14×5/22×2/26`; `pad 14/16/18/22` | Dormant — move out of the bundle (D-24) rather than sweep |
| `LuckyPigModal.tsx` | **4** | **1** | 8 | 1 | 16 | 0 | `#FFB000`, `rgba(255,215,0,0.6)`; `fontSize 11/12/14/15/16/22/28`; `bR 14` | Hex→`WHIMSY.sun`/`goblin`; drop the `textShadow`; `14`→`RADII.lg`; button→`Button dark` (D-08) |
| `MysteryHatReveal.tsx` | 0 | 0 | 4 | 0 | 13 | 0 | `fontSize 11/15/26/72`; `pad 24`, `mT 6/8`, `pV 3` | `26`→`pageTitle`; `11`→`kickerPillSm`; rarity pill→D-02 |
| `ui/BuyCelebration.tsx` | 0 | 0 | 1 | 0 | 0 | 0 | `fontSize 28` | Fine; the gap is Reduce Motion (D-11) and the `emoji` noun (D-26) |
| `ui/TicketButton.tsx` | 0 | 0 | 4 | 0 | 1 | 0 | `fontSize 11×2/17/18` overriding `TYPE.*` | `TYPE.cardTitleSm`(15) / `kickerPillSm`(10) exist to retire these overrides |
| `ui/AnimatedCosmetic.tsx` | **2** | 0 | 0 | 0 | 0 | 0 | `#F5C44A`, `#FFFFFF` | →`WHIMSY.slopGold`, `WHIMSY.paper` (D-18) |
| `ui/RitualIconWell.tsx` | 0 | 0 | 1 | 1 | 0 | 0 | `fontSize 11`; `bR 8` | `bR 8`→`RADII.sm`; `☁`→`Glyph` (D-19) |
| `achievements.tsx` | 0 | 0 | 10 | 3 | 15 | 0 | `fontSize 11×3/12×2/13×4/18`; `bR 9×2/28`; `pad 14×4`, `mT 6/8`, `pV 9` | `18`→`TYPE.cardTitle`; `12/13`→`label`/`bodySm`; `bR 9/28`= circles, keep as `size/2`; also the only `fontWeight` in-area (`:477`) |
| `AchievementDigestModal.tsx` | 0 | 0 | 5 | 1 | 13 | 0 | `fontSize 12/14/16×2/25`; `bR 14`; `pad 20/24`, `mT 14/16` | `25`→`TYPE.pageTitle`(26); `16`→`TYPE.numeral`; `14`→`RADII.lg`; button→`Button dark` |
| `TitlesSection.tsx` | 0 | 0 | 4 | 0 | 3 | 0 | `fontSize 11/12/13/14`; `pad 14` | `14`→`TYPE.cardTitleSm`(15); `11`→`kickerPillSm`; empty→`EmptyState` |
| `app/rosie-gallery.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | Dev-only shim. Clean. |
| `app/mote-machine.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | **Zero leakage.** Gaps are caps-copy (D-17) and the rotated back arrow (D-25) |
| `mote-machine/MoteMachineFallback.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | **Zero leakage. Best card in the area.** |
| `mote-machine/MoteMachineRive*.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | Clean (renderer shims) |
| `mote-machine/MoteRosieStage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | Clean; correctly `accessibilityElementsHidden` |
| `mote-machine/MoteWageringScreen.tsx` | 0 | **1** | 1 | 1 | 0 | 0 | `rgba(34,20,17,0.45)`; `fontSize 24`; `bR 22` | The leak is small; the **DNA** is the problem (D-06) |
| `app/ad-refill-preview.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | Dev-only shim. Clean. |
| `rewarded-ads/AdRefillOffer.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | — | **Zero leakage.** Gaps are `Button`/scaffold adoption + a sub-44pt "Not now" |
| **Area total** | **7** | **2** | **62** | **16** | **131** | **4** | — | ~12–13% of the app's raw type/spacing in ~13% of its files |

---

## 6. What's working — keep and replicate

- **`components/ui/TicketButton.tsx`** — the a11y model for the whole app: `accessibilityRole`, label
  fallback, hint, and `accessibilityState={{disabled, busy}}` (`:146-149`), plus a genuinely
  TTP-specific artifact (a perforated paper ticket drawn as one SVG path so the ink outline follows the
  notch, `:42-46`). Nothing else could wear this button. **Use it as the template for D-04's sweep.**
- **`components/mote-machine/MoteMachineFallback.tsx`** — the best error state in the area and possibly
  the app: `Sticker` + `Tape` + the resting-cabinet art + copy that tells the player exactly what their
  money did (*"Your Mote was not spent"*, `:47`). Zero raw values. This is what D-20 should copy.
- **`components/TroughSection.tsx`** — zero token leakage across 439 lines, an honest headroom
  calculation folded into the UI so a button never promises more than the server takes (`:159-169`),
  social proof placed exactly where it converts (`:219-230`), and six distinct failure reasons mapped to
  six warm sentences (`:30-47`). Fix its a11y (D-04) and it is a model file.
- **`components/ItemPreviewModal.tsx`'s CTA ladder** (`:302-336`) — seven mutually exclusive states
  (wearing / owned / earned-not-sold / not-today / can't-afford / legendary / buyable), each with its
  own honest label, all composed from `Button` variants. "Earned, not sold" and "Rotates in soon — not
  today's pick" teach the economy in five words. Keep this exact pattern.
- **`ClosetView.tsx`'s accessibility composition** (`:611-621`) — the state-aware label + hint,
  including the Slop Club gate in the hint text. Lift it to a shared helper (D-03).
- **The rarity token system** (`theme.ts:230-260`) — `RARITY_BG_SOLID` (panel) + `RARITY_STRIPE`
  (marker), consolidated from two divergent hand-rolled maps, with the reasoning written into the file.
  This is what good governance looks like; D-02 is just the third map that never got the memo.
- **`ClosetView.tsx`'s paper-doll** (`:463-496`) — slots that appear only where you own something
  (`:350-361`), Rosie centred in a scene window showing the equipped background, live frame-sync so the
  item rides the breathing pig (`:482-483`, honouring the 2026-07-16 ruling). Unmistakably this game.
- **`PigFriendsLaunchModal.tsx`** — staggered spring reveal with a clean `reduceMotion` still
  (`:36-40`), tape on every card, and it reaches for `TicketButton` and `Button variant="gold"` rather
  than rolling its own.
- **Empty/loading adoption** — `shop.tsx:933-946` (a loading shop that can't be misread as sold out,
  with the reasoning in a comment), `achievements.tsx:218-232`, `ClosetView.tsx:704-710`. The roadmap's
  item 2 landed here properly.

---

## 7. System asks

What `theme.ts` and `components/ui/` must gain so this area can be rebuilt from the system alone.

**Tokens**
1. `RARITY_BADGE: Record<Rarity, {bg: string; ink: string}>` in `theme.ts`, replacing
   `constants/hats.ts:RARITY_COLORS`. Each pair validated at ≥4.5:1 for 11px text. (D-02)
2. `BORDER = { hair: 1, thin: 1.5, ink: 2 }`. The scale already exists in usage (2 × 255, 1.5 × 129,
   1 × 12 app-wide) and has no name; `StyleSheet.hairlineWidth` is banned once `hair` exists. (D-22)
3. `STATE_OPACITY = { pressed: 0.7, gated: 0.85 }` — two values, and a rule that **disabled is a fill
   swap, never an opacity**. Retires 0.35/0.4/0.42/0.5/0.65/0.82/0.86. (D-12)
4. `PIG_ACCENT: Record<PigId, {solid: string; tint: string}>` in `WHIMSY`, retiring the six raw hex in
   `utils/pigs.ts` and both `accent + "33"` concatenations. (D-18)
5. A documented `startDecorativeLoop` requirement — every `Animated.loop` and particle burst in `app/`
   and `components/` routes through `useMotionPolicy`. (D-11)

**Components and variants**
6. `Button variant="link"` — a tertiary underlined text action at a 44pt target. Three ad-hoc versions
   exist (`TitlesSection.tsx:186`, `PigFriendsLaunchModal.tsx:268`, `LuckyPigModal.tsx` `keepLaterText`)
   and `BattlePassSaleModal.tsx:214, 233` adds two more. (D-08)
7. `ProgressTrack` — `{value, max, tone, height?}` with the ink border, `RADII.pill`, `cream2` bed, and
   `accessibilityRole="progressbar"` + `accessibilityValue` built in. Two instances in this area, a
   third on the season pass. (D-13)
8. `EmptyState` gains an `action?: ReactNode` slot so **empty · loading · error · locked** all compose
   from one cozy card. Would absorb `shop.tsx:895-914` and `TitlesSection.tsx:77-86`. (D-20)
9. `SpendReassurance` — a one-line "cost now · balance after" row that every spend control renders
   above its CTA. Pairs with a rule: **a control that spends states its cost on its own face.** (D-09)
10. `Icon` gains `arrowLeft`, `chevronLeft`, `gear`. Three surfaces currently fake them with a 180°
    rotation or a raw text glyph. (D-25)
11. `Glyph` gains `cloud` (the curse mark), so `RitualIconWell`'s `☁` can leave the text layer. (D-19)
12. A `cosmeticAccessibility(item, state)` helper in `utils/` producing the label + hint pair, consumed
    by both cosmetic grids. (D-03)

**Rules to codify (append to the taste standard)**
13. **No `Alert.alert` in `app/` or `components/`.** `ConfirmDialog` for irreversible/costly;
    `showPurchaseToast` for outcomes. Enforced by lint. (D-01)
14. **No `Pressable` without `accessibilityRole` + `accessibilityLabel`.** Enforced by lint. (D-04)
15. **Minimum interactive height is 44pt** — `Button`'s `SIZE_MAP.sm.minH`; no bespoke control derives
    its height from padding alone. (D-05)
16. **`onRequestClose` is never an empty function**; every modal has a visible dismiss. (D-07)
17. **Sentence case for all button and status copy;** UPPERCASE is reserved for `TYPE.kickerPill` /
    `kickerPillSm` label typography. (D-17)
18. **Extend the dingbat ruling from three characters to a class:** any mark naming an action or a state
    renders through `Icon`/`Glyph`; only flourish marks (`★ ✦ ·`) stay as `Text`. Log the `♥`
    confetti carve-out, or retire it. (D-19, D-26)
19. **Raw `<Modal>` requires a written exception.** `AdaptiveModalScaffold` for dialogs, `SlideUpSheet`
    for bottom sheets. (D-14, D-06)

---

## Conformance pass — 2026-09-11 (wave 3, section D)

**Result: 487 → 0 `ttp/*` warnings across 17 files; lint flipped to error for the area.** Three parallel passes
(shop + pen · closet + rewards · Mote Machine + rewarded ads) against `03-section-pass-brief.md`. No `eslint-disable`;
surviving literals are named drawing constants. Full suite 205/205 green.

**Findings closed:** D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-17,
D-18, D-19, D-20, D-21, D-22, D-23, D-24, D-25. Highlights: the rarity badge is a `Tag` reading `RARITY_BADGE`'s
validated ink-on-bg (hue coding kept) and the Closet stripe has its ink edge; the shop grid and every spend/claim/
filter control carry `cosmeticAccessibility(item, state)` labels (new helper in `utils/cosmetics.ts`); the MEMBERS
ribbon is `Ribbon icon="lock"` while gated; the Today/Closet/Pen switch is `SegmentedControl`; the Trough seed is the
one primary `Button` behind a `ConfirmDialog` with the balance-after line; `LuckyPigModal` has an escape hatch;
**`MoteWageringScreen` — the audit's specificity FAIL — is rebuilt** as a paper console on a `WHIMSY.stage` readout
(`Chip art` stakes, `Stat tone="onDark"`, `Sheet` paytable/history/settings, gold lever with cost + consequence);
`AdRefillOffer` is a `Sticker` + gold `Button` + `handLink` decline with `EmptyState kind="error"` for no-fill.
`MOTE_MACHINE_VISIBLE` stays false pending the founder's relaunch call.

**Primitive growth (landed):** `Tag`/`Chip` `ink` override; `Ribbon.icon`; `Button variant="handLinkOnDark"`;
`Stat tone="onDark"`; `EmptyState.art`; `LoadingBeat`'s dead `glyph` prop removed (four callers fixed).

**Deliberate calls:** no members `Ribbon` on Closet tiles (would be new copy); the daily grid's unreachable
`membersOnly` path left as is; `RARITY_COLORS` in `constants/hats.ts` still has two callers outside the area
(`scan-code`, `TruffleExchangeSheet`) — delete in wave 4; the settings toggle is still a native `Switch` (a `Toggle`
primitive is a wave-4 item); `Chip` `sub`/`badge` slots noted for wave 4.
