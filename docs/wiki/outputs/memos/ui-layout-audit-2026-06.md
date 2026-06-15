---
title: "UI Layout Audit — June 2026"
type: memo
date: 2026-06-13
tags: [design, ui, audit]
---

# UI Layout Audit — June 2026

Inventory of each in-scope TTP page's current layout, synthesized into a cross-page design system and a layout-fix brief. The token-level system is strong and coherent; the divergence is all in **spacing, headers, and shadow application**.

## Status — applied 2026-06-14

A design-system pass landed the **foundation tokens** plus the high/med-priority **mechanical fixes** across all six in-scope screens. `tsc` clean · 247 jest green.

**Foundation** (`constants/theme.ts`, `components/ui/SectionHeader.tsx`): added `SPACE` (4/8/12/16/24), `SHADOW_SM` (the 2,2 chip/button/row tier), `PAGE_PAD` (18), `TAB_SAFE` (74); `SectionHeader` default `ruleWidth` 90 → **64**.

**Applied per screen:**
- **Home/Barn** — conditional-render-proof band spacing (statsRow owns mb 16, truffle band owns mt 12, effects-strip mt → 0), `PAGE_PAD` 18 across statsRow + effects strip, symmetric lucky badge (12/12). Onboarding card snapped to tokens (`KICKER_TEXT`, radius 8, gaps to scale, marginHorizontal 18).
- **Account** — Alignment block + Achievements row + Sounder card → **Stickers** (2px ink + `STICKER_SHADOW`, non-paper bg); single 16 column gap; referral-label hierarchy fixed; rule width 64; `TAB_SAFE`.
- **Achievements** — canonical `KICKER_PILL` header + 64 rule; stats line → `KICKER_PILL`; card marginVertical 0 (grid gap 12); two-tier shadows (card 4,4 / claim 2,2); `TAB_SAFE`; title-row `flex-start`.
- **Season** (representative page) — XP fill `sun` → `lilacDeep`; `PAGE_PAD` 18 header + scroll; `#cfe2c6` → `WHIMSY.sage`; radii snapped (10/20/26 → scale); ready-card 3,3 → two-tier; both rule widths 64; `TAB_SAFE`; inter-section gap 16.
- **Shop** — ShopTitleRow → sticker (`STICKER_SHADOW` + 2px ink); 44px `hitSlop`s; `PAGE_PAD` chrome (grid keeps 12 for tile-width math); symmetric ShopCard foot (12); 8px badge insets; locked price-chip differentiated (opacity + lock, identical size); two-tier shadows; radii + border weights snapped; `TAB_SAFE`.
- **Friends** — removed the double kicker; added the 64 rule to the Friends segment; list-row gap unified to 12 (Leaderboard 8 → 12); stronger locked-trade button (Inbox); champion poster 14 H-pad; `KICKER_PILL`/`KICKER_TEXT` split applied; Leaderboard empty state → Sticker; score column no-wrap; `TAB_SAFE`.

**Deferred — need on-device visual QA (intentionally NOT applied):**
1. **#11 — modal CTA / `Button.tsx` rework.** `components/ui/Button.tsx` still uses the legacy `COLORS` palette (pink gradients, `#1A1A1A`), not the WHIMSY sticker language. Routing all modal CTAs through it (primary=lilac, success=sun, dark=ink, 2px ink + hard shadow) **recolors its current consumer** (ItemPreviewModal) — a real visual change to verify on device before shipping.
2. **#4 — SafeAreaView / Platform-`paddingTop` rewrap.** Every screen with a `Platform.OS` paddingTop fork got a `// TODO(ui-audit): SafeAreaView inset + 8` marker but kept current behavior; the rewrap is a per-device layout change to verify.

_Minor/optional:_ `components/BuryTruffleButton.tsx` carries an inline 2,2 shadow + radius 14 (already the right *values*, just not the `SHADOW_SM`/`RADII` tokens) — a cosmetic token-snap with no visual change.

## De-facto Design System

A cozy storybook / paper-scrapbook aesthetic. Strong and coherent at the *token* level; the divergence is all in *spacing, header, and shadow application*.

### Palette (`constants/theme.ts` → WHIMSY)

- **ink** `#2a1f15` — all text, borders, outlines (every interactive surface gets a 2px ink border)
- **paper** `#fffaf0` — default card/sticker bg; **cream** `#fbeee2` — page bg; **cream2** `#f6e6d4`
- Accent fills: **sun** `#ffd87a` (active/primary CTA, balance), **lilac** `#d6c8f0` / **lilacDeep** `#a89bff` (secondary buttons, progress), **rose** `#ffd6dc` / **roseDeep** `#f8a8b3`, **peach** `#ffc8a8`, **sage** `#c9dec1`, **sky** `#c8e3f0`
- **accent** `#c25a3f` (hand-red kicker/links), **mute** `rgba(40,30,20,0.6)`, **muteSoft** `rgba(40,30,20,0.4)` (dashed dividers)
- Alignment: **angel** `#a89bff` (generous), **goblin** `#d4a437` (greedy)
- Rarity: RARITY_GRADIENT + RARITY_BG_SOLID (common → legendary), one source of truth

### Type

- **whimsy** Caprasimo_400 — display/titles/values/names (22–36px headers, 30px stat values)
- **hand** PatrickHand_400 — body, kickers, secondary labels (11–16px)
- **bodyExtra** Nunito_800 — tracked-uppercase labels, buttons, chips, kicker-pills (10–14px)
- **displaySemi** Fredoka_600 — Shop card names only (one-off)

### Recurring component patterns

- **Sticker card** — 2px ink border, hard `STICKER_SHADOW` (offset 4,4 / radius 0 / opacity 1), subtle `rotate ±0.3–1.5°`, radius 14–22. The brand's base unit (`components/ui/Sticker.tsx`).
- **Page header** — KICKER (★ prefix) → display title → TITLE_RULE underline. Shared tokens `KICKER_TEXT`, `KICKER_PILL`, `TITLE_RULE` exist in theme.ts.
- **SectionHeader** (`components/ui/SectionHeader.tsx`) — kicker + title + right-slot + rule, per-section.
- **Flat-list sticker** — one Sticker wrapping rows with `padding:0`, dashed muteSoft `borderBottom 1.5` between rows; "you"/highlight rows get cream bg. (leaderboard, friends, inbox, settings)
- **Pill toggle / segmented control** — paper Sticker, padding 4, gap 4, radius 22; buttons flex:1, radius 18, active = sun (or lilac) + 1.5 ink border.
- **Chips/tags** — radius 999 pills, 1.5–2px ink border; price/state chips, rarity legend, category filters.
- **Buttons** — 2px ink border + hard shadow; sun = primary CTA, lilac/lilacDeep = secondary, ink = high-emphasis. `components/ui/Button.tsx` exists (variants primary/gold/ghost/locked, size md h44/px18/fs15/br22) but is only used by ItemPreviewModal.
- **Icon bubble / well** — circle, 2px ink border, 26–56px, paper bg (sun when "ready").
- **Modals** — MODAL_BACKDROP_BG `rgba(40,30,20,0.55)`, centered Sticker card, header → content → footer.

### Defined-but-under-enforced tokens (the lever for cleanup)

`RADII` (8/12/14/18/22), `STICKER_SHADOW`, `SHADOWS.card`, `KICKER_TEXT`, `KICKER_PILL`, `TITLE_RULE`, `ROW_TILTS`. These already exist — most inconsistencies are screens hardcoding values instead of importing these.

## Cross-page Inconsistencies

### 1. Page header — kicker token & sizing

**Pages:** Account, Achievements, Friends Hub, Season, Shop, Modals

Two kicker tokens both exist (KICKER_TEXT = hand 13px accent; KICKER_PILL = Nunito800 11px mute uppercase) and screens pick differently: Account uses KICKER_TEXT, Friends/Shop use KICKER_PILL, SectionHeader hardcodes 13px, modals range 11–13px. Achievements has NO kicker at all (bare stats line).

**Standard:** one canonical page-header kicker = KICKER_PILL (Nunito800 11px, mute, letterSpacing 1.6, uppercase, ★ prefix), marginBottom 6. KICKER_TEXT (hand 13px accent) reserved for in-card section kickers (SectionHeader). Apply both as imported tokens, never inline.

### 2. Page header — title rule width

**Pages:** Account, Season, Friends Hub, Shop

TITLE_RULE width is arbitrary per screen: Account 80, Friends 110, Season Bounties 84 / Pass 110, Shop varies. Looks incomplete/misaligned.

**Standard:** fixed rule width 64px under the page title (or match title text width via onLayout). Use the shared TITLE_RULE token + marginTop 6 / marginBottom 14.

### 3. Header horizontal padding

**Pages:** Home / Barn, Season, Shop, Friends Hub, Account, Achievements

Header/content horizontal padding drifts: Barn statsRow 14, BarnEffectsStrip 16, Season header 18 / scroll 14, Shop header 18 / grid 12 / chips 14, Friends/Account/Achievements 18. Causes left/right edges to misalign within a page and across tabs.

**Standard:** PAGE_PAD = 18 for the page header AND the scroll content edges on every tab. Grids that need numeric-width math keep 12 internally only if the SectionHeader/legend/chips above them also use 12 — never mix 12 content with 14/18 chrome.

### 4. Header top padding (platform)

**Pages:** Home / Barn, Season, Shop, Friends Hub, Account, Achievements

paddingTop forks Platform.OS (iOS 8–12 vs Android 20–24) inconsistently and ignores safe-area insets, so the header sits at a different height per tab.

**Standard:** wrap every screen in SafeAreaView (edges top) and use a single paddingTop = 8 on top of the inset — drop the Platform fork.

### 5. Card border + shadow

**Pages:** Shop, Achievements, Account, Season, Home / Barn, Friends Hub

Card shadow + border weight inconsistent: most cards use STICKER_SHADOW (4,4) but ShopTitleRow & Account Achievements-row use soft SHADOWS.card (0,4 / opacity 0.06) making them feel un-sticker-like; chips/buttons use 2,2; Season 'ready' cards use 3,3; Achievements cards use 3,3; border weight ranges 1.5/2/2.5.

**Standard:** TWO shadow tiers only — cards/stickers = STICKER_SHADOW (4,4); interactive chips/buttons/rows = SHADOW_SM (offset 2,2 / radius 0 / opacity 1). No soft drop shadows in sticker contexts. Border weight: 2px for cards & primary buttons, 1.5px for chips/dividers/inputs; reserve 2.5 for the one hero element per screen (champion poster).

### 6. Non-sticker cards breaking rhythm

**Pages:** Account, Shop

Account Alignment block is a bare View (no card) and the Achievements row uses a plain paper box with soft shadow; Shop's ShopTitleRow uses horizontal soft-shadow layout. These are the only non-Sticker surfaces and read as un-designed.

**Standard:** every standalone content surface is a Sticker (2px ink border + STICKER_SHADOW). Wrap the Alignment block and Achievements row in Sticker; give ShopTitleRow the STICKER_SHADOW + ink border like ShopCards.

### 7. Section / card vertical spacing

**Pages:** Home / Barn, Season, Shop, Account, Achievements, Friends Hub

Inter-section gaps are ad-hoc and conditional-render-fragile: Barn band gaps depend on whether the effects strip renders (8/10/14, asymmetric lucky badge 8 top/4 bottom); Account 16/18/22; Season SectionHeader mb 12 vs scroll gap 14; Achievements card marginVertical 6 fights grid gap 12 (=24 effective).

**Standard:** spacing scale 4/8/12/16/24. Inter-section gap = 16 (use ScrollView contentContainerStyle gap, not per-child margins). SectionHeader marginBottom 12. Card-to-card gap 12 with marginVertical 0. Bands keep fixed gaps regardless of conditional siblings.

### 8. Scroll paddingBottom (tab-bar clearance)

**Pages:** Season, Shop, Friends Hub, Achievements, Account

Bottom safe-zone hardcoded 80–120 (Season 110, Shop 100, Friends 110, Achievements 80, Account 120) for a ~50px tab bar — leaves a dead gap on short lists.

**Standard:** one constant TAB_SAFE = tabBarHeight + 24 (~74), or useBottomTabBarHeight() + 24. Apply identically everywhere.

### 9. Radius off the scale

**Pages:** Season, Shop, Friends Hub, Achievements, Account, Home / Barn

RADII (8/12/14/18/22) is defined but bypassed: in-the-wild radii include 9, 10, 16, 20, 26, plus 999 pills.

**Standard:** snap everything to RADII — cards lg14 or xl18, pill toggles xxl22, chips/buttons md12, pills 999. Replace 9→8, 10→12, 16→18, 20→22, 26→22 unless the value is a true circle (radius = size/2 for avatars/bubbles).

### 10. Chip / button sizing

**Pages:** Shop, Season, Friends Hub, Achievements, Modals, Home / Barn

Pills/buttons vary: paddingV 3/4/5/6/7/8/9/10, paddingH 8/10/11/12/14; toggle button radius 9 (Friends) vs 18 (others); ShopCard foot padding asymmetric (H11/T9/B11). Many tap targets under 44px (rarity dots 11px, decline ✕ 32px).

**Standard:** CHIP = radius 999, padH 12 / padV 6, gap 6, 1.5px border, min hit-slop to 44. BUTTON = radius 12 (or 999 pill CTA), padH 16 / padV 10, 2px border, min height 44. Toggle buttons radius 18 everywhere. ShopCard foot symmetric padding 12.

### 11. Modal button language

**Pages:** Modals

Four modals use four different button treatments (WhileAway lilac/br14; Judgement sun/br999/shadow3,3; AchievementUnlock ink/paper-text/br12; ItemPreview Button component).

**Standard:** route ALL modal CTAs through components/ui/Button.tsx (variants primary=lilac, success=sun, dark=ink; size md h44/px18/br22). Unify modal kicker to KICKER_TEXT 13px; internal content gaps to the 4/8/12 scale.

### 12. Progress-bar fill contrast

**Pages:** Season

XP bar track cream2 (#f6e6d4) vs fill sun (#ffd87a) is near-isoluminant at 12px height — empty vs filled barely read.

**Standard:** track = cream2, fill = lilacDeep (#a89bff, already the Achievements progress fill) for one consistent progress language app-wide; keep height 12, border 2 ink, radius 999.

## Per-page Fixes

### Home / Barn — priority: high

- Make band spacing conditional-render-proof: give statsRow marginBottom 16 (not relying on the effects strip's marginTop). Wrap the optional bands (effects strip, truffle button, lucky badge) in a single column container with a fixed gap (12) so the truffle button and pig keep identical spacing whether or not the effects strip renders.
- Unify horizontal padding to PAGE_PAD 18: statsRow (currently 14) and BarnActiveEffectsStrip (currently 16) both → 18 so left/right edges line up.
- Fix lucky badge asymmetry: marginTop 12 / marginBottom 12 (currently 8/4) so it never crushes the pig.
- statsRow paddingTop: drop the Platform fork (12 iOS / 24 Android) — use SafeAreaView top inset + 8.

### Account — priority: high

- Wrap the Alignment story block in a Sticker (cream or lilac bg, 2px ink border, STICKER_SHADOW, padding 16) — it is currently a bare View and reads as undesigned.
- Convert the Achievements row from a plain paper box (soft shadow) to a Sticker (STICKER_SHADOW, 2px ink border) to match every other surface.
- Give the Sounder card a non-paper bg (cream or lilac) so it reads as a distinct surface against the cream page.
- Standardize inter-section gaps to 16 via a single column gap (replace the 16/18/22 mix of per-section margins).
- Raise referral 'Got a code from a friend?' label from hand 12px mute to bodyExtra 13px ink (fix inverted hierarchy).
- Set TITLE_RULE width to the canonical 64 (currently 80, looks arbitrary).

### Achievements — priority: high

- Add the canonical page header: KICKER_PILL kicker + TITLE_RULE (token exists, unused) so it matches Account/Season; give the stats line KICKER_PILL treatment instead of bare body text.
- Fix spacing arithmetic: card marginVertical 6 → 0, rely on grid gap 12 (currently 24 effective).
- Align chip-row bottom spacing to grid: filter chips paddingBottom 8 → 12, and unify all edges to PAGE_PAD 18.
- Snap card shadow to the two-tier system (cards = STICKER_SHADOW 4,4; claim button = SHADOW_SM 2,2) — currently 3,3.
- Reduce paddingBottom 80 → shared TAB_SAFE.
- Card title row alignItems 'baseline' → 'flex-start' to avoid tag drift when the name wraps.

### Season — priority: high

- Fix XP progress-bar contrast: fill sun → lilacDeep (matches Achievements), keep cream2 track.
- Unify header padding to PAGE_PAD 18 across header AND scroll content (currently 18 header / 14 scroll); drop the Platform paddingTop fork for SafeArea inset.
- Replace hardcoded sage tint #cfe2c6 (VL card bgs) with WHIMSY.sage token.
- Snap card radii to scale (cards 14/18, pills 999) — remove 10/20/26 one-offs.
- Normalize 'ready' card shadow from 3,3 to the two-tier system (card 4,4 / chip 2,2).
- Set both SectionHeader rule widths to the canonical 64 (currently 84 / 110).
- Reduce scroll paddingBottom 110 → shared TAB_SAFE.

### Shop — priority: high

- Give ShopTitleRow the sticker treatment: STICKER_SHADOW (4,4) + 2px ink border instead of soft SHADOWS.card so titles read like the rest of the shop.
- Bump rarity dots / owned-badge / decline targets to a 44px hit area (hitSlop) — current 11px dots fail tap-target minimums.
- Align all horizontal padding: header 18, but make grid content, category chips, and RarityLegend share ONE value (12 if grids need numeric math, applied to chips + legend too — currently 12 grid / 14 chips / 2 legend).
- Match ShopTitleRow kicker to the canonical header kicker (currently fs10/ls1.4 vs SectionHeader fs13).
- Symmetrize ShopCard foot padding to 12 (currently H11/T9/B11) and align corner badges to a single 8px inset.
- Reduce all paddingBottom 100 → shared TAB_SAFE.
- Differentiate locked vs buy price chip beyond color (e.g. lock icon + muted text + reduced opacity), keep identical size.

### Friends Hub — priority: med

- Remove the double kicker when viewing the Friends segment (hub header kicker + Friends.tsx inline kicker) — render the segment without its own kicker.
- Add the missing TITLE_RULE to the Friends segment header so it matches the scrapbook header pattern.
- Unify list-row gap: Friends flatRow gap 12 vs Leaderboard row gap 8 → pick 12 everywhere so the same avatars align across boards.
- Strengthen the locked-trade button (penBtnLocked muteSoft-on-paper fails contrast): use cream bg + mute (not muteSoft) text/border, keep disabled.
- Align champion poster padding to row padding (16 → 14 horizontal) so the poster edge lines up with the ranked rows below.
- Unify SectionHeader kicker (13px) with the page kicker (11px) — pick KICKER_PILL for both, or document the two-level hierarchy and apply consistently.
- Give the Leaderboard empty state a Sticker card (matches Friends empty state) instead of bare padded text.
- Cap leaderboard score column / let it flex so 5-digit scores don't wrap the unit to a second line.
- Reduce all contentContainerStyle paddingBottom 110 → shared TAB_SAFE.

### Key Modals — priority: med

- Route all modal CTAs through components/ui/Button.tsx (primary=lilac, success=sun, dark=ink) so WhileAway / Judgement / AchievementUnlock / ItemPreview share one button language.
- Unify modal kicker to KICKER_TEXT 13px across all four.
- Standardize internal content gaps to the 4/8/12 scale (currently mixed 6/8/10/12).
- Add visible scroll affordance to WhileAwayModal ScrollView (showsVerticalScrollIndicator or a fade) so overflow is discoverable.
- Add responsive guards on <375px: ItemPreviewModal close-button position, JudgementDay verdict-box min/max width, AchievementUnlock reward-chip wrap margins.

## Representative Page

**Season Tab (Battle Pass & Bounty Board)**

It is the single richest mix of every pattern we need to standardize in one scroll: the canonical page header (kicker + title + rule + optional banner), a SectionHeader (BountyBoard), multiple Sticker card types (bounty cards, 'How to earn XP' card, tier-row cards in normal/ready/locked states), a progress bar, stat pills, chips/state tags, and both primary (sun) and secondary CTA buttons — plus it already exhibits the worst offenders (XP-bar contrast, padding 18-vs-14 drift, off-scale radii, 3,3 shadow, varying rule widths, excessive paddingBottom). Locking the header + card + section + chip + progress + button spec here exercises nearly the whole vocabulary, so approval on Season transfers cleanly to Shop, Achievements, Friends, and Account. Home/Barn is more bespoke (pig focal point, absolute overlays) and a poorer template; Season is the workhorse list-and-card layout most other tabs resemble.

## Standardized Spec

Apply app-wide — values are concrete.

### 1. Spacing scale (use ONLY these)

`SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }`

- Inter-section gap (between cards/sections) = **16** — apply via ScrollView `contentContainerStyle.gap`, not per-child margins (kills conditional-render fragility).
- Card-to-card within a group = **12**, with `marginVertical: 0`.
- Intra-card content gaps = 8 or 12.
- `PAGE_PAD = 18` — horizontal padding for the page header AND scroll content edges on every screen. (Grids needing numeric-width math may use 12 internally, but the SectionHeader/legend/chips directly above them must use the SAME value.)
- `TAB_SAFE = useBottomTabBarHeight() + 24` (~74) — the ONLY scroll paddingBottom. Replaces all 80/100/110/120.

### 2. Radius (snap to RADII, already in theme.ts)

`sm 8 · md 12 · lg 14 · xl 18 · xxl 22`, plus `999` pills and `circle = size/2` for avatars/bubbles. Map strays: 9→8, 10→12, 16→18, 20→22, 26→22. Cards = lg 14 (or xl 18 for hero), pill toggles = xxl 22, chips/buttons = md 12.

### 3. Shadows (two tiers only)

- `STICKER_SHADOW` (offset 4,4 / radius 0 / opacity 1) → all cards/stickers.
- `SHADOW_SM` (offset 2,2 / radius 0 / opacity 1, elevation 2) → chips, buttons, list rows, small pills.
- NO soft `SHADOWS.card` in sticker contexts (retire it from ShopTitleRow + Account Achievements row). Drop the 3,3 variant.

### 4. Canonical page header

```
<View paddingHorizontal=18 paddingTop={inset+8}>
  Kicker:  KICKER_PILL (Nunito800 11 / mute / ls 1.6 / uppercase, "★ …"), marginBottom 6
  Title:   FONTS.whimsy 32 / ink / lineHeight 34
  Rule:    TITLE_RULE, width 64, marginTop 6, marginBottom 14
  (optional right-slot: balance chip / link, vertically centered with title)
</View>
```

Wrap every screen in SafeAreaView (edges=['top']); never Platform-fork paddingTop.

### 5. Section header (in-scroll, components/ui/SectionHeader.tsx)

```
Kicker:  KICKER_TEXT (PatrickHand 13 / accent), marginBottom 4
Title:   FONTS.whimsy 22 / ink   (+ optional right-slot)
Rule:    TITLE_RULE width 64
marginBottom: 12
```

Standardize all rule widths to 64 (retire 70/84/88/96/110 one-offs).

### 6. Card pattern (Sticker)

2px ink border · STICKER_SHADOW · `rotate` from ROW_TILTS (±0.4–1.2°) · radius **14** (hero 18) · padding **14** (large 16/18) · bg from WHIMSY palette. Every standalone surface is a Sticker — no bare Views, no plain paper boxes. State variants change BG/border-style/opacity, never shadow offset (locked → dashed border + muteSoft, still STICKER_SHADOW; ready → sun/border emphasis, still 4,4).

### 7. Flat-list sticker (rows)

One Sticker, `padding:0`; rows = paddingH 14 / paddingV 12, gap 12, dashed `borderBottom 1.5` muteSoft between rows; highlight/"you" row = cream bg. Row gap is **12** everywhere (unify Leaderboard 8 → 12).

### 8. Chips & buttons

- **Chip / pill / tag**: radius 999, paddingH 12 / paddingV 6, gap 6, 1.5px ink border, `SHADOW_SM` if floating; hitSlop to reach 44px.
- **Button**: route through components/ui/Button.tsx. Default size md = height 44 / paddingH 18 / radius 22 (or 12 for square). 2px ink border. Variants: **primary = lilac**, **success/CTA = sun**, **dark = ink (paper text)**, ghost = transparent + muteSoft border, locked = cream bg + mute text.
- **Pill toggle / segmented control**: paper Sticker, padding 4, gap 4, radius xxl 22; segment buttons flex:1, paddingV 8, radius **18** (fix Friends' 9), active = sun + 1.5 ink border.
- Min tap target 44×44 (fix rarity dots, decline ✕, plan toggles).

### 9. Progress bar (one language)

height 12 · radius 999 · 2px ink border · track cream2 · **fill lilacDeep #a89bff** · overflow hidden. (Fixes Season XP contrast; matches Achievements.)

### 10. Kicker token rule (resolve the fork)

Page-header kicker = **KICKER_PILL** (11px tracked uppercase). In-card SectionHeader kicker = **KICKER_TEXT** (13px hand accent). Always import the token; never inline a kicker. Never stack two kickers in one view (fix Friends double-kicker).
