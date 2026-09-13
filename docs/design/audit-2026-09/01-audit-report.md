# TTP UI/UX audit report — 2026-09-11

Seven Opus auditors ran the ten evaluation prompts in `00-evaluation-prompts.md` against every UI file in the
Oink repo (194 app files + 11 web surfaces), each writing a findings file with `file:line` evidence. This report
synthesizes them. The per-area files remain the evidence of record; this document is the map.

## 1. Executive summary

**The bones are strong and the system is real** — but it stops at the token file. `constants/theme.ts` is a
well-governed, comment-documented token layer with a semantic role layer and an executable contrast test on top.
The primitives that were designed as primitives (`PageHeader`, `AdaptiveModalScaffold`, `SegmentedControl`,
`IconButton`, `DialogCloseRow`, `PopupQueue`) are close to exemplary. The newest screens (`scan-code`,
`dig-collection`, `digging-stats`, the invite pickers, the pass track) are token-pure and prove the approach works.

**The debt is not that screens ignore the tokens. It is that the system never gave them a component to put the
tokens inside.** The app mounts 357 pressables across 104 files but only 95 `Button`s and 3 `IconButton`s;
33 files hand-roll a raw `Modal`; there is no `ListRow`, `Chip`, `Toast`, `Sheet` panel, `TextField`,
`ProgressTrack`, `Stat`, or text-role component. Every hand-rolled pressable is a place where a designer's decision
had to be re-typed as literals — that is where the 980 bare spacings, 169 bare radii and 521 bare font sizes come from.

| Area | Files | P0 | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- | --- | --- |
| A · Home / Barn / Habitat | 36 | 1 | 9 | 10 | 7 | 27 |
| B · Friends / Social / Sounder | 26 | 1 | 8 | 9 | 8 | 26 |
| C · Season / Contend / Dig | 57 | 0 | 11 | 18 | 5 | 34 |
| D · Shop / Collect / Rewards | 25 | 1 | 9 | 12 | 4 | 26 |
| E · Account / Onboarding / Shell | 30 | 2 | 11 | 13 | 6 | 32 |
| F · Primitives + tokens | 45 | 0 | 13 | 16 | 7 | 36 |
| G · Web surfaces | 11 | 1 | 9 | 9 | 4 | 23 |
| **Total** | | **6** | **70** | **87** | **41** | **204** |

Design-specificity verdicts: every Barn/Friends/Season/Shop/Me surface **passes** (an unrelated product could not
ship them). Three surfaces **fail**: the Habitat cluster (`barn-collection`, `barn-interior`, `components/habitat/*`),
`MoteWageringScreen`, and `landing/redeem/`. Two web surfaces are only partial (the landing family is set in Archivo,
a typeface that exists nowhere in the game).

## 2. Cross-area findings, prioritized

Each item names the auditor finding ids that carry the evidence. Severity is the highest severity among them.

### P0 — automatic taste failures on primary paths

**X-1 · A system `Alert.alert` is the commit dialog for the game's most irreversible moments.**
The one-time companion choice (`PigPenView.tsx:100`, `PigRosterPicker.tsx:61`), the referral-code grant and Golden
Ticket redeem at app root (`app/_layout.tsx:730`, `:819`), and eight shop spend/equip paths (`shop.tsx:566…639`,
`TitlesSection.tsx:67`) all leave the storybook for a grey iOS dialog — in exactly the paths
`components/ui/ConfirmDialog.tsx:1-6` says it exists to replace. Nine files total. [A-17, B-01, D-01, E1, E2]
→ Rule: *refusals are toasts · decisions are ConfirmDialog · Alert is for nothing.* Lint it.

**X-2 · Emoji still render on two of the most-seen surfaces.** `🔥` at `Barn.tsx:299`, twelve lines below two
`Glyph name="flame"` draws of the same flame; `🐽` at `landing/i/index.html:399`, the invite page — the most-shared
link in the product. (The other two emoji the baseline counted are inside comments.) [A-01, G-01]
→ Lint the codepoint range in `.tsx` renders and web text.

### P1 — system rules broken on primary surfaces

**X-3 · The interaction layer has no governance.** Color, type, radius and spacing each have a token family and
70–85% adoption; *pressed*, *disabled*, *border width*, *opacity* and *shadow tier* have none. The Season area
alone invented nine pressed idioms, five disabled-by-dissolve crushes (down to `opacity: 0.28`), and four shadow
tiers past the sanctioned two. The 2026-07-07 "a button, asleep" ruling is honored by exactly one `Button` variant;
seven sites in Friends and five in Season still dissolve the outline, and two of them fail AA as a result.
`borderWidth` ships as 2/1.5/1/2.5/3 (412 literals) with no name. [C-01, C-06, C-07, B-08, A-15, A-25, F-05, D-12, E2-ask]
→ `BORDER`, `OPACITY`, `TINT`, `PRESSED`/`DISABLED` style tokens; `Button`'s default disabled becomes the locked look.

**X-4 · Three parallel modal systems.** A tokenized `ConfirmDialog`/`AdaptiveModalScaffold`/`SlideUpSheet` set
(20 consumer files); 33 files hand-rolling a raw `Modal` with their own backdrop/card/button row (`Account` alone
re-rolls the shell three times; `BarnVisitModal` hand-rolls three full-screen dialogs, two with no close path;
Friends has four bottom-sheet chromes and three grabbers); and the nine `Alert` files. `DialogCloseRow` is used
0× across Season's 14 modals; `LuckyPigModal` has no escape hatch. [E12, A-08, B-06, C-09, D-07, D-14, F-13]
→ One `Sheet` panel primitive; `ConfirmDialog` rebuilt on the scaffold with a `DialogButtonRow`; raw `Modal` requires a written exception.

**X-5 · Spend controls are invisible to VoiceOver.** 20 unlabeled pressables in Season (every snout/truffle spend,
the ceremony's only exit), 13 in Shop (the whole shop grid, the Trough donate), 20 in Friends (including the
shared `CrewRow`), `CleanseModal`'s four pressables with zero labels, and `ConfirmDialog` itself — the canonical
spend dialog — carries no accessibility props. App-wide, 28 of 98 files with pressables carry none.
[C-03, D-03, D-04, B-04, A-05, E5, E9, F-03]
→ Accessibility lives in the primitive: `Button`/`IconButton`/`ListRow`/`Chip` require a label; spend controls state their cost in it. Lint bare `Pressable`.

**X-6 · Contrast failures from the token layer down.** `WHIMSY.muteSoft` fails AA on all 14 sanctioned surfaces
(3.78:1 on paper) yet `UI_COLORS` names it `textDisabled` and it is used as placeholder text. `WHIMSY.accent` —
the kicker color — fails on 6 of 14 surfaces (lilac, peach, roseDeep, lilacDeep, slopGold, goblin). The rarity
badge fails at every rarity (1.58:1 legendary) from a third rarity map in `constants/hats.ts:1033`. The pass track's
READY/CLAIMED badges sit at 1.8:1 and 2.0:1. Slop Club fine print and Terms/Privacy are 3.36:1 / 3.85:1 from an
opacity crush on the purchase surface. On the web, `--mute #9a8c7a` (3.15:1) carries body text on six files and the
site kicker is rose-deep at 1.87:1. [F-06, F-07, E10, E4, D-02, C-02, G-03, G-04, G-05]
→ A text-safe `muteDim`; `textPlaceholder` role; `RARITY_BADGE {bg, ink}` validated ≥ 4.5:1; badge glyphs are ink on pastel, never paper on pastel; extend `colorSystem.test.ts` to all 12 fills.

**X-7 · Governance leaks inside the primitives themselves.** `Sticker` hard-codes `radius = 14` and never imports
`RADII` (58 files inherit it); `Button` carries 12 literals including 5 hexes and its whole size scale;
`TierUpBanner` ships the app's only blurred shadow; `SectionHeader`/`EmptyState` carry their own paddings; `Icon`
mixes three icon systems and defaults to a non-ink color; `Glyph` and `Icon` define the same 16 concepts with no
rule for which wins; the barrel exports 8 of ~45 primitives and omits the 8 most used. [F-01, F-02, F-04, F-10, F-11, F-12, A-04]
→ Primitives consume tokens only; a literals guard in CI; `Glyph` = subject matter, `Icon` = affordance; the barrel exports everything.

**X-8 · Second design systems inside the product.** The Habitat cluster is meticulously labelled for VoiceOver but
built from a different vocabulary (borderless panels, translucent white pills, `MaterialCommunityIcons`, flat sun
rectangles, bare `ActivityIndicator`, no shadow tier) — `barn-collection.tsx` is 805 lines with one shared primitive.
`MoteWageringScreen` is live and fails specificity. On the web, the sticker card is re-declared ~18 times across 9
files with 6 border widths, 16 radii and 10 shadow tiers; `landing/i/` is a 67% copy of `landing/index.html` that
has already drifted; `redeem/` is off-palette entirely. [A-02, A-03, D-06, G-02, G-06, G-07, G-10]
→ Rebuild Habitat and Mote Machine from the primitives; a generated `tokens.css` + shared `sticker.css` for the web.

**X-9 · Failure reads as empty, or as loading forever.** A failed profile fetch renders `LoadingBeat` forever
(`UserSheet.tsx:559`) with its error copy in an unreachable branch; `sounder-progress` and `porch-round` render a
null fetch as an empty state; the Me tab assembles itself in front of the player with no loading state.
[B-02, B-14, E7]
→ Rule: `null` = unknown → error/retry; `[]` = empty → `EmptyState`. `EmptyState` gains `kind: "error"` + `action`.

**X-10 · Irreversible actions fire on one tap.** Leaving a Sounder and passing the crown are unconfirmed; "Sign
out" fires on one tap one row above a confirmed "Delete account"; the Trough seed spends snouts on the *least*
prominent button. [B-03, E6, D-09]
→ Any action that cannot be undone by the same control renders through `ConfirmDialog`; a control that spends states its cost on its own face.

**X-11 · Reduce Motion is honored by policy, ignored by the busiest surfaces.** `Barn.tsx` ignores the policy the
file next door uses; the dig — the most animated surface — ignores it entirely; `SlideUpSheet`, `BuyCelebration`
and the purchase toast animate off-policy; 96% of motion bypasses the motion tokens and no spring token exists
(20 springs, 14 configs, two parameterizations). [A-06, A-07, C-08, F-08, F-09, D-11]
→ `MOTION` durations + `MOTION_SPRING`; a file that imports `Animated` imports `useMotionPolicy` (lintable).

**X-12 · One concept, several drawings; one crown, several shapes.** The active blessing/curse is drawn three ways
in three components; `SegmentedControl` is bypassed four times in Season and four in Shop (one with a comment
asserting the primitive doesn't exist); no tab screen uses `PageHeader` — all five hand-roll kicker + title + rule,
and `PageHeader` and `season.tsx` disagree on which kicker is the page kicker; the Inbox draws five of six event
icons as text glyphs; 68 `›` text chevrons exist because the icon set has no chevron. [A-10, C-05, C-10, D-10, E13-ask, B-07, E18]
→ `EffectCard`; `PageHeader variant="tab" | "plaque"`; `Icon` gains chevrons; extend the dingbat ruling to `› ‹ ▾ ＋`.

**X-13 · Token drift concentrates in a few files.** `Account.tsx` holds 81 bare `fontSize`, 140 bare pad/margin/gap
and 7 raw `radius={n}` — ~15% of the app's bare-fontSize budget on one primary tab (its own `wallowWallStyles`
block is fully tokenized and is the in-file template). `#D5E4C9` leaks back in after the token layer retired it.
53 sites do arithmetic on `SPACE` (`SPACE.xs + 1`). `DESIGN.md` is stale on eight points (accent `#c25a3f`,
"streak is a garden", 11 of 15 TYPE roles). [E3, C-11, C-18, B-18, F-30]
→ Wave-3 file-by-file migration; ban `SPACE` arithmetic; regenerate `DESIGN.md` from `theme.ts`.

### P2/P3 themes (see area files)

Sub-44pt targets on primary actions (`C-04`, `D-05`, `E4`, `E9`); the Expo starter theme still reachable via
`+not-found` (`E8`); `<Stack>` declares no `screenOptions` (`E13`); two things called "your code" on one screen
(`E11`); sentence-case vs UPPERCASE drift on button copy (`D-17`); tape/prestige/pig-accent hexes living in
`utils/pigs.ts` and `cosmeticFx.ts` (`B-ask`, `D-18`, `F-7`); the web's missing focus rings and hrefless `<a>`
(`G-08`, `G-09`).

## 3. Per-area reports

### A · Home / Barn / Habitat — `findings-A-home-barn.md`
Two design systems in one area. The Barn cluster (`PaperTicket`, `BarnUpdatesTray` with its pressed shadow-collapse,
`BarnSounderChip`'s bark panel, `HoofprintsSheet`) is as good as the taste standard gets — zero soft shadows, raw hex
nearly extinct. The Habitat cluster is the mirror image: best VoiceOver labelling in the area, wrong visual
vocabulary. P0: emoji on the Barn's most-looked-at chip. P1s: Habitat off-system (×2), icon-set drift, spend/cast
paths unlabelled, toast never announced, Barn ignores Reduce Motion, `BarnVisitModal`'s three hand-rolled dialogs,
inaccessible `Spotlight`, three drawings of one effect.

### B · Friends / Social / Sounder — `findings-B-friends-social.md`
The newest layer (`CrewRow`/`CrewSheet` and the four sheets on it) is the best-governed code in the app: the invite
pickers have zero literals. The older surfaces re-rolled the primitives and the duplicates are now load-bearing: four
bottom-sheet chromes, three grabbers, three segmented controls, eight button shapes, four confirmation grammars.
P0: `Alert` gates the permanent companion choice. P1s: failed fetch loads forever, unconfirmed leave/crown, 20
unlabelled pressables incl. `CrewRow`, identity primitives bypass tokens, Inbox text glyphs, dissolved disabled
states (two fail AA), Friends empty/search bypass `EmptyState`.

### C · Season / Contend / Dig — `findings-C-season-contend.md`
The most ambitious work in the codebase. `TrufflePatch.tsx:1078–1135` is the app's best accessibility work (per-tile
labels, custom rotor actions) and its stir meter names tension in words, never a number. No P0, no emoji, no Alert,
no black wrapper. The gap is the ungoverned interaction layer: nine pressed states, five dissolves, four extra shadow
tiers, four segmented controls, three page crowns; READY/CLAIMED badges at 1.8:1 / 2.0:1; every spend control
unlabelled; primary actions under 44pt; the dig ignores Reduce Motion; `#D5E4C9` leaks back.

### D · Shop / Collect / Rewards — `findings-D-shop-collect.md`
`TicketButton` (the a11y template), `TroughSection` (zero leakage, six warm failure messages), `MoteMachineFallback`,
`ItemPreviewModal`'s seven-state CTA ladder and the Closet paper-doll are strong. P0: `Alert` is the spend dialog
across the area (8 sites). P1s: rarity badge fails AA at all five rarities from a third map outside `theme.ts`;
shop grid and primary nav unlabelled; 13 unlabelled spend/claim/filter pressables; ~34pt Claim button; live
`MoteWageringScreen` specificity FAIL; `LuckyPigModal` no escape; four `Button` clones (two byte-identical);
Trough seed spends on the least prominent button; `SegmentedControl` bypassed four times.

### E · Account / Onboarding / Auth / Shell — `findings-E-account-shell.md`
`PopupQueue` is the best-engineered module in the repo; `APP_NAV_THEME` pins navigation to `UI_COLORS`;
`scan-code.tsx` is the model rebuilt screen; the "saddling up" gate is the loading bar. P0s: companion choice and
referral/redeem grants confirmed in system Alerts. P1s: `Account.tsx` is the largest governance leak; fine print /
Terms fail AA and 44pt on the purchase surface; `ConfirmDialog` has zero a11y; unconfirmed sign-out beside
confirmed delete; no Me-tab loading state; Expo starter theme reachable; `muteSoft` as placeholder text; "your code"
ambiguity; three parallel modal systems; `<Stack>` without `screenOptions`.

### F · Primitives + tokens — `findings-F-primitives-tokens.md`
The token layer is unusually well-reasoned (provenance comments, semantic roles, executable contrast test). The
system stops there: 357 pressables vs 98 primitive buttons; 28 raw Modals; no Chip/ListRow/Toast/Sheet/Field/Stat/
text-role components; the barrel exports 8 of ~45. Leaks at the root (`Sticker` radius, `Button` hexes and sizes,
`TierUpBanner` blur); no `BORDER`/`OPACITY`/`TINT`; `muteSoft` and `accent` contrast; motion tokens bypassed, no
spring token; `Glyph`/`Icon` overlap; no shared API conventions; `DESIGN.md` stale.

### G · Web surfaces — `findings-G-web.md`
Eleven independently-authored surfaces with no shared stylesheet or token file. The analytics dashboard's `.sticker`
rule and the adventures prototype's `styles.css` (focus ring, 44px targets, reduced motion, zero raw hex outside
`:root`) are the models. P0: emoji on the invite page. P1s: landing set in Archivo; `--mute` at 3.15:1; kicker at
1.87:1; the retired `#c25a3f` accent on both token-literate surfaces; sticker re-declared ~18×; `redeem/` off-palette;
no focus indicators on the dashboard; hrefless `<a>`; `landing/i/` a drifted 67% copy.

## 4. What's working — keep and replicate

- **Governance artifacts:** `theme.ts` provenance comments; `__tests__/colorSystem.test.ts`; `BarnOverlay:85`'s documented raw-literal carve-out; `inviteState.ts`'s centralised, tested failure copy.
- **Reference primitives:** `PageHeader` (zero literals), `AdaptiveModalScaffold`, `SegmentedControl`, `IconButton`, `DialogCloseRow`, `PopupQueue`, `useMotionPolicy` as a degrade policy.
- **Reference screens:** `scan-code`, `dig-collection`, `digging-stats`, `porch-round`, `FriendInvitePicker`/`PlayerInvitePicker`, `contraptions`, the pass track's `vlStyles`.
- **Reference interactions:** `BarnUpdatesTray`'s pressed shadow-collapse (the DNA pressed state); `TrufflePatch`'s rotor actions and worded tension; `ItemPreviewModal`'s CTA ladder; pre-disabling instead of failing (Inbox `canAfford`, Friends pair-locks); warm losing copy everywhere.
- **Web:** the dashboard's `.sticker` `--fill`/`--tilt` API; `svg.js`'s `GlyphSprite`; `report.html`'s radio-card picker and copy.

## 5. Reconciliation into the design system

Every "system asks" section was merged into `docs/design/design-system-spec.md` §1–§3 and the canvas. Adopted:
`BORDER`, `OPACITY`, `TINT` (scrim corrected to derive from ink), `MOTION` + `MOTION_SPRING`, `TAP_MIN`, `SPACE.xxs/
xxl/card`, `RADII.hair`, `GRADIENT`, `TYPE.displayLg/numeralLg` + lineHeight on every role, the palette extensions
(`goldInk`, `sageInk`, `muteDim`, `textPlaceholder`, `focus`, `curseSurface`/`blessSurface`, `RARITY_BADGE`, `PODIUM`,
`DIG_TILE`, `PIG_ACCENT`, `COSMETIC_ACCENT`, `WOOD`, `stage`/`EMBER_GRADIENT`), and the primitives `Text` roles,
`Sheet`, `ListRow`/`NavRow`, `Avatar`, `Chip`/`Tag`/`Ribbon`/`Toast` (+ error/info tones), `TextField`,
`ProgressTrack`, `Stat`, `EffectCard`, `DialogButtonRow`, `ActionSheet`, plus the variants on `Button` (link, xs,
loading, destructive), `SegmentedControl` (icon-over-label, disabled/badge), `PageHeader` (tab, plaque), `Sticker`
(onPress, card slots, shadow sm), `EmptyState` (kind error, action). Declined, with reason, in the spec's §5:
`TYPE.labelLg/profileName/cardTitleXs` (fold to existing roles), `SPACE` 6/10 half-steps (fold), `BORDER 2.5` (fold).

## 6. Evaluation prompts used

The ten prompts, their sources and the severity scale are in `00-evaluation-prompts.md`. In practice the
highest-yield prompts were **P4 token triage** (every P1 in X-3/X-6/X-7/X-13), **P5 inventory** (X-4, X-8, X-12),
**P6 accessibility** (X-5, X-6, X-11) and **P10 charter compliance** (X-1, X-2, X-9, X-10). **P2 specificity** cleanly
separated the three off-system surfaces from the rest. **P1 heuristic scorecards** were the least discriminating —
scores cluster at 2–3 on every screen — and are best read per screen in the area files rather than averaged.
