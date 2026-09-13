# Tickle the Pig — Design Taste Standard

The visual-craft companion to `SKILL.md`. `SKILL.md` decides **what** we build (Connect ·
Collect · Cooperate); this decides **whether it's built with taste**. Consult it before any
layout, component, color, type, spacing, motion, or visual decision.

The interface should not merely function. It should feel intentional, hand-made, cozy, and
clearly designed by someone who cares — not assembled from the average of the internet.

## The two questions, asked together

Before shipping any UI, pause and answer both:

1. **Which pillar does this serve?** (the `SKILL.md` product lens)
2. **Would an experienced product designer who has internalized *this game's* DNA
   intentionally make this exact decision?** (the craft lens)

If the answer to #2 is "no — this is the default, the obvious, the one the model has seen a
thousand times," improve it before proceeding. A correct-but-generic screen still fails.

## What "taste" means *here* (read this before importing generic advice)

TTP is **not** a SaaS dashboard, and the usual "eliminate AI slop" advice (kill the cards,
flatten the gradients, calm the motion, default to system fonts) is **wrong for this app**.
TTP's taste is a deliberate, maximalist, paper-craft storybook aesthetic. The whimsy *is* the
design, not the slop. Our DNA:

- **Paper-craft stickers.** Everything lives on a `Sticker` / `Tape` primitive — 2px ink
  border, hand-drawn tilt (±0.5–1.5°), hard offset drop-shadow. Cards are *good* here. Tilt is
  *good* here. A perfectly-aligned, borderless, soft-shadow card is what reads as slop in TTP.
- **Two shadow tiers, both hard.** `STICKER_SHADOW` (4,4 / radius 0) and `SHADOW_SM` (2,2 /
  radius 0). Soft blurred shadows are retired from sticker contexts. No new shadow tiers.
- **Four intentional fonts, each with a job.** Fredoka (display), Nunito (body), Caprasimo
  (whimsy titles), PatrickHand (hand-drawn kickers). Never reach for a system font.
- **One palette: WHIMSY.** Muted storybook pastels on warm paper/cream. Accent rust for
  kickers. Alignment = angel-lilac vs goblin-gold. New color = a token, never a fresh hex.
- **Show feelings, never state them.** Mood = Rosie's sprite, never a number. Streak is an
  engagement progression rather than a feeling: its explicit consecutive-day count earns a
  fiery treatment around the Home/Barn Tickle-bank counter. The retired Garden metaphor must
  not return as a second Streak readout. (Progression systems — Streak, XP, tiers, prices — may
  show numbers; feelings may not.)
- **No emoji in UI, ever.** Use `Glyph` (hand-drawn art) or `Icon` (SVG). An emoji character in
  a render is an automatic taste failure.
- **The world responds *now*.** A cleansed curse vanishes immediately, a claim animates on tap.
  Latency-as-default is a taste failure even when it's "correct."

## Where the real slop is in TTP (June 2026 audit)

The bones are strong — custom hanging-signs tab bar, Sticker/Tape system, the season pass
track, a cohesive shop redesign. The slop is **governance erosion**, not bad design:

| Symptom | Reality | Severity |
| --- | --- | --- |
| **No type scale** | 634 hardcoded `fontSize`; `ThemedText` effectively dead (6 uses) | High — the biggest gap |
| **Radii ignored** | `RADII` tokens at ~5% adoption; 268 hardcoded `borderRadius`, the same `14` reinvented inline | Medium |
| **Spacing bypassed** | `SPACE` at ~54 uses vs 75+ hardcoded paddings | Medium |
| **Inline hex leak** | ~125 raw hex literals past the WHIMSY token layer (accent/functional colors) | Medium |
| **Account black flash** | `account.tsx` wrapped in `#1A1A1A` — a black flash before session loads, breaking the cream continuity | Low (fixed) |
| **Bare empty/loading states** | Plain "Nothing here." / `ActivityIndicator` — utilitarian, not cozy | Low |
| **Stack headers off-system** | `← back` + title on `/achievements`, `/sounder` don't use the `SectionHeader` pattern of the main tabs | Low |

None of this is "looks like Tailwind." It's the intentional system being silently bypassed.
Fixing it means **enforcing the taste that already exists**, not imposing a new look.

## The rules (ongoing standard)

1. **`constants/theme.ts` is the single source of truth.** Reach for `WHIMSY`, `FONTS`,
   `RADII`, `SPACE`, `TYPE`, `STICKER_SHADOW`/`SHADOW_SM`. If a value isn't a token, either use
   an existing token or add one — never inline a raw hex / size / radius / pad.
2. **Compose text from roles, not numbers.** Use the `TYPE` role styles (and the existing
   `KICKER_TEXT` / `KICKER_PILL` / `TITLE_RULE`). A bare `fontSize: 15` in new code is a smell.
3. **Leave it better.** When you touch a file, migrate the styles you pass through to tokens.
   The 634 hardcoded sizes get retired incrementally, not in one mega-diff.
4. **Empty and loading states are cozy, not utilitarian.** A `Sticker` with a `Glyph` and a
   warm line — never a bare gray string or a naked spinner. (Barn's "saddling up" beat is the bar.)
5. **Every screen wears the same crown.** Stack-screen headers use the `SectionHeader` pattern,
   not an ad-hoc back-arrow row. Every tab is cream/paper — no black wrappers.
6. **Motion has weight and warmth.** Springy, slightly-overshooting, hand-wound (the tab-bar
   sway, heart floats, chain-tug). Never a linear fade that could belong to any app.

## Roadmap (ranked by impact × confidence)

1. ~~**Codify `TYPE` in `theme.ts`**~~ — **✓ done.** Role-based scale (display / pageTitle /
   sectionTitle / cardTitle / numeral / body / bodySm / label / kicker / hand / kickerPill);
   `KICKER_TEXT`/`KICKER_PILL` derive from it and `SectionHeader`/`PageHeader`/`EmptyState`
   consume it. The 634 raw `fontSize` sites migrate incrementally under "leave it better" — reach
   for a `TYPE` role in all new code, never a bare `fontSize`.
2. ~~**Cozy empty + loading states**~~ — **✓ done.** `components/ui/EmptyState.tsx`
   (`EmptyState` + `LoadingBeat`); rolled across shop, season, achievements, sounder, inbox.
3. ~~**Harmonize stack headers**~~ — **✓ done.** `components/ui/PageHeader.tsx` is the canonical
   page-header crown (uppercase kicker + whimsy title + rule + optional `‹ back`/`right`/`below`);
   adopted on achievements, sounder, sounder-progress, clan-ladder, mud-war. Note: page headers
   (top of screen) use `PageHeader`; in-screen *section* headers use `SectionHeader`.
4. **Radius + spacing token sweep**, file-by-file under the "leave it better" rule. *(invisible
   but compounding; never a blocking mega-PR)* — includes pruning the now-dead per-screen header
   styles (`header`, `title`, `kicker`, `titleRule`, …) the `PageHeader` swap left behind.
5. **Inline-hex audit** — fold the ~125 leaked literals back into WHIMSY/COLORS. *(low risk)*

## Decision log

- **2026-08-28 — Streak moves from the Garden to the fiery Home Tickle counter.** The Garden
  metaphor and its no-number rule are retired. The Home/Barn spendable Tickle-bank counter now
  carries a fire treatment plus the explicit number of consecutive personal days, keeping the
  loyalty signal attached to the manual action that sustains it. Auto-Tickler activity never
  advances or preserves the count. Serves **craft / comprehension** (one Streak surface rather
  than two competing metaphors) and **Connect** (a clear achievement can become something worth
  sharing without making an empty state public).

- **2026-07-16 — The shop item preview is a product shot; living surfaces stay alive.** The preview
  pig animated its idle loop while the equipped item stayed pinned to frame 0's anchor (PigStage
  resolves anchors at `pigFrameIdx=0` but never fed SpritePig a `frameIdx`) — the item visibly
  detached from the moving pig. Ruling: in the **shop item preview** the pig FREEZES at the rest
  frame — the exact pose the placement studio tunes anchors against — so the cosmetic reads
  pixel-perfect; mood does not display there (CONTEXT.md's Mood entry carries the carve-out).
  The **Closet and visit screens are living mood surfaces** — they get the Barn's frame-sync
  treatment (`pigFrameIdx` + `onPigFrame`) so the pig keeps breathing and the item rides along.
  Rule going forward: a surface either syncs anchors to the live frame or freezes at rest —
  a moving pig with a pinned item is never acceptable. Serves **craft / the sticker language**
  (cosmetics are the product; they must sit on the pig exactly).

- **2026-06-26 — Adopted this Taste Standard.** Codifies TTP's paper-craft DNA as an enforceable
  craft lens beside the `SKILL.md` product lens. Reframes "eliminate AI slop": TTP's slop is
  *governance erosion* (tokens bypassed), not generic-SaaS look. Serves the **"craft is part of
  the belief"** clause of the charter. Fixed the Account black-flash wrapper as the first
  application.
- **2026-06-26 — Two shared primitives, two roadmap items shipped.** `EmptyState`/`LoadingBeat`
  retire bare "Nothing here." text and naked spinners across 5 screens; `PageHeader` makes every
  stack screen wear the same crown as the tabs (fixing the `sounder` outlier's centered title and
  stray `←`). Both consolidate patterns already invented ad-hoc, so future screens compose instead
  of re-rolling their own. Wired the standard into `CLAUDE.md` so it's consulted before UI work.
  Serves **craft / "designed throughout."**
- **2026-06-26 — Codified the `TYPE` scale.** Extracted role-based text tokens from the values
  already shipping in the redesigned primitives (not invented), so adoption preserves the look.
  `KICKER_TEXT`/`KICKER_PILL` now derive from `TYPE`; the three header/text primitives consume it.
  Retires the "no type scale / 634 raw sizes" gap at the root; screen-level sizes migrate
  incrementally. Serves **craft / hierarchy & comprehension.**

- **2026-07-06 — Added the `bark` token family (`WHIMSY.bark`/`barkText`/`barkMute`) for dark storyteller callouts.** The "Your Sounder" design (Claude Design → Simplifying page hierarchy) introduces ink-dark panels that carry the Great Hunger fiction on the war surfaces ("why we scuffle", "vs the Great Hunger"). Rather than let `#3a2c1e` leak as inline hex, the trio joins `WHIMSY`: bark panel, warm cream text, softer cream body — kickers on bark use `WHIMSY.sun`. One sanctioned dark surface, tokenized before first use, so the storyteller voice stays governable. Serves **craft / governance** (the token system grows on purpose, never by leak).

- **2026-07-12 — Members-only shop items read as Slop Club at a glance.** Replaced the small, ambiguous round lock badge with a compact **MEMBERS** corner ribbon in the newly-tokenized Slop Club gold (`WHIMSY.slopGold`/`slopBand` retire the leaked `#F5C44A`/`#FFE7AD`), with the signature ink border + `SHADOW_SM`; the lock glyph rides the ribbon only while an item is still gated (for members the ribbon stays as identity, no lock). The owned-check badge keeps precedence. The members band header wears a subtle gold wash and, for non-members, a `gold` `Button` "Join Slop Club" CTA routing to the same RevenueCat Slop Club offering Account/season use; locked cards dim via the shared `opacity: 0.85` "gated" lane. Serves **Collect** — the members catalog is now unmistakably a thing to join-and-collect, expressed in the sticker language rather than as an ad banner. Serves **craft / governance** (two shop golds folded into WHIMSY before reuse).
- **2026-07-13 — The dingbat ruling: `✦`/`·` are typography; `✓`/`✕`/`♥` are semantic.** The audit kept flagging the same character two ways across files, so we drew the line by *what the mark does*, not by what it is. **`✦` and `·` are SANCTIONED as label typography** — hand-drawn marks in the whimsy voice (a sparkle flourish on a CTA label, a mid-dot separator), like `★` before them. They stay as `Text`. **`✓`, `✕`, and `♥` are SEMANTIC** — they carry meaning (done / dismiss / love-count) and must scale and color like the rest of the iconography, so they render through the `Icon`/`Glyph` primitives (`Icon "check"`, `Icon "x"`, `Glyph "heart"`), never as a raw `Text` glyph. Why: `✦`/`·` read as flourish and never need to match an icon's weight or hue; `✓`/`✕`/`♥` are the *same concept the app already draws as art elsewhere in the same file*, and a text-glyph version of a semantic mark is the inconsistency the June audit named. Swept the remaining player-facing `✓`/`✕`/`♥` text glyphs onto the primitives where an equivalent exists. Serves **craft / governance** (one concept, one drawing).

- **2026-07-07 — The `locked` Button variant is now "a button, asleep."** The disabled/waiting CTA used to render as a borderless `paper3` pill under a blanket `opacity: 0.5` crush — a washed-out ghost that didn't read as a button at all. It now carries full button chrome: the signature 2px ink outline, `paper3` fill, `ink4` text, and *no* opacity crush (the muted fill/ink already say "disabled"; dimming a bordered pill just erases the shape). Rule going forward: waiting/cooldown states keep the control's shape — you mute the fill, you never dissolve the outline. Also moved the season guide link ("how it works ›") out of the Sounder card body and into the "your sounder" `SectionHeader`'s right slot, so the card starts at content and the header owns navigation. Serves **craft / hierarchy & comprehension** (a disabled control still reads as a control).

- **2026-09-11 — Full UI/UX audit run; Design System v1 drafted for ratification.** Seven parallel Opus auditors ran ten
  selected evaluation prompts (`docs/design/audit-2026-09/00-evaluation-prompts.md`) against every app and web UI file:
  204 findings (6 P0 · 70 P1 · 87 P2 · 41 P3), synthesized in `docs/design/audit-2026-09/01-audit-report.md`. The
  headline: the system stops at the token file — 357 pressables vs 98 primitive buttons, 33 raw Modals, nine files
  using a system `Alert` as the commit dialog, two rendered emoji, no `BORDER`/`OPACITY`/`TINT`/`PRESSED`/`DISABLED`
  tokens, and contrast failures rooted in `muteSoft`/`accent`/the rarity badge. The draft system that answers it lives
  in `docs/design/design-system-spec.md` and the "Tickle the Pig Design System" canvas (`docs/design/design-system-canvas/`):
  the shipped tokens verbatim, the proposed token families, fourteen primitives, the state/behaviour/a11y/naming/web-parity
  laws, a lint rule set, and a five-wave migration. **Status: proposed, pending founder ratification** of the six open
  questions in the spec's §5. Serves **craft / governance** (enforcing the taste that already exists, through components
  rather than discipline).

- **2026-09-11 — Design System v1 ratified in principle; wave 0 begins.** Founder delegated the six open questions in
  `docs/design/design-system-spec.md` §5 and set one: **the Mote Machine is hidden** (`MOTE_MACHINE_VISIBLE = false`)
  until `MoteWageringScreen` is rebuilt from the primitives. The delegated calls: Fredoka keeps one job as `TYPE.hero`;
  the accent stays a single token restricted by rule to the six fills where it clears AA (ink elsewhere);
  `SPACE.card 14` is sanctioned as the Sticker's inner pad; Habitat is rebuilt on the primitives with its VoiceOver
  labelling kept as the reference; `DESIGN.md` is demoted to a historical export until a generator regenerates it.
  Wave 0 lands now: every `Alert.alert` outside `components/dev/**` becomes a toast (outcome), `ConfirmDialog`
  (decision) or the new `ActionSheet` (pick-where-to-go); the two rendered emoji become `Glyph`/SVG; three ESLint rules
  (`no-restricted-properties` for `Alert.alert`, `no-restricted-imports` for `@expo/vector-icons`, `no-restricted-syntax`
  for emoji in JSX) land as errors, plus `npm run lint:web` for the landing/dashboard. Rule going forward: **refusals are
  toasts · decisions are ConfirmDialog · Alert is for nothing.** Serves **craft / governance** (the door closes while it
  has only nine offenders).

- **2026-09-11 — Wave 1 of the design system lands: the token families exist, the legacy palette is gone, lint sees the
  whole debt.** `constants/theme.ts` gains `BORDER`, `OPACITY`, `TINT` (+ `inkAlpha`, scrim corrected to derive from
  ink), `PRESSED`/`DISABLED`, `MOTION`/`MOTION_SPRING`, `TILT`, `TAP_MIN`, `GRADIENT`, `BUTTON_SIZE`, `PODIUM`,
  `RARITY_BADGE` (every pair ≥ 4.5:1), `DIG_TILE`, `PIG_ACCENT`, `COSMETIC_ACCENT`, `WOOD`, `SPACE.xxs/card/xxl`,
  `RADII.hair`, `TYPE.hero/displayLg/numeralLg` and a lineHeight on every role. Contrast at the root: `textDisabled`
  now resolves to the text-safe `muteDim`; `muteSoft` becomes `uiMuted` (icons, rules, never text); the accent is nudged
  `#a13f30` → `#a03e2f` so it clears AA on all seven `ACCENT_SAFE_FILLS`. `Button` disabled is the locked look for
  every variant (no opacity), `Sticker` reads its radius/border/tilt from tokens and grows `shadow="sm"`, and the
  app's last blurred shadow (`TierUpBanner`) is gone. The Expo template palette (`COLORS`, `Colors.ts`, `ThemedText`,
  `ThemedView`, `useThemeColor`, `useColorScheme`) is deleted and `+not-found` is rebuilt on the system. Seven
  `eslint-plugin-ttp` rules run in warn mode (baseline ≈ 3.7k warnings: 2,924 raw style literals, 192 unlabelled
  pressables, 108 `SPACE` arithmetic, 33 raw Modals, 13 spinners, 10 motion-policy gaps); each file flips to error as it
  migrates. Serves **craft / governance** (the vocabulary exists before the screens are asked to speak it).

- **2026-09-11 — Wave 2 lands: the vocabulary exists.** `components/ui/` gains the primitives the audit said the app
  builds most and never had: text roles (`T` + `Display…Numeral`, `Kicker`/`KickerPill` own the ★), `Sheet` (the panel
  on `SlideUpSheet`, Reduce Motion fade), `ListRow`/`NavRow`, `Avatar`, `Chip`/`Tag`/`Ribbon`, `Toast` (success · fail ·
  info, announced), `TextField`, `ProgressTrack`, `Stat`, `Divider`/`TitleRule`, `DialogButtonRow`, `EffectCard`
  (one drawing for the blessing/curse at chip · row · detail). `Sticker` gains press (the shadow-collapse DNA press) and
  title/right/footer slots; `Button` gains `link`, `destructive`, `xs`, `loading`; `SegmentedControl` gains
  icon-over-label and per-option disabled/badge; `PageHeader` gains `tab` and `plaque`; `EmptyState` gains
  `kind="error"` + an action slot; `ConfirmDialog` is rebuilt on the scaffold with full a11y; `Spotlight` cannot strand
  a VoiceOver player. Rulings recorded in code: **page kicker = `KickerPill`, section kicker = `Kicker`; the page title
  is `pageTitle` in every variant** (the tabs' 32px display folds). The barrel exports everything (140 symbols) and is
  the one sanctioned import path. `npm run scorecard` measures conformance per file. Serves **craft / governance** —
  from here on, a screen that re-rolls a row, a sheet, a chip or a kicker is choosing to.

- **2026-09-11 — Wave 3 · section A: the Barn and its Habitat are on the system.** 27 files, 556 → 0 taste-lint
  warnings, lint flipped to error for the area. The Habitat cluster — the audit's one design-specificity failure inside
  the app — is rebuilt on the primitives with its VoiceOver labelling untouched; the blessing/curse is one `EffectCard`
  drawing everywhere; every spend/cast control names its cost and consequence to a screen reader; three hand-rolled
  full-screen dialogs are scaffolds with a visible exit; the Barn honours Reduce Motion. The section forced eleven small
  primitive additions (recorded in `findings-A-home-barn.md`'s conformance note) — the expected shape of a section
  pass: the screen asks, the system grows, the screen composes. Serves **craft / governance**.

- **2026-09-11 — Wave 3 · section C: Season, the Dig-Off and the dig are on the system.** 48 files, 1,137 → 0
  taste-lint warnings, lint at error for the area. The three page crowns are one `PageHeader`; the interaction layer
  the audit called ungoverned (nine pressed idioms, five dissolves, four extra shadow tiers, four segmented controls)
  is tokens and primitives; the Great Hunger and Zoomies meters are `ProgressTrack`s that speak a word, never a
  number; the Truffle Patch honours Reduce Motion while keeping the app's best VoiceOver work intact; every spend
  control names its cost and consequence; the Season tab wears one hero. Fourteen small primitive additions landed
  on the section's asks. Serves **Contend** (a race everyone can read, in one language) and **craft / governance**.

- **2026-09-11 — Wave 3 complete: every screen in the app speaks the system.** Sections A (Barn), C (Season/Dig),
  D (Shop), B (Friends) and E (Account/shell) landed the same day, each as parallel section passes against
  `docs/design/audit-2026-09/03-section-pass-brief.md`: 3,269 → 0 taste-lint warnings across 201 files, lint at error
  for every area, no `eslint-disable` left standing, 207 suites green. The app's three specificity failures (the
  Habitat cluster, `MoteWageringScreen`, and the web's redeem page still pending in wave 5) are down to one. Every
  spend, cast, claim and irreversible action names its cost and consequence to a screen reader; every `null` fetch is
  an error with a retry; every meter that is a feeling speaks a word. The system grew by ~45 small additions the
  sections asked for — each recorded in its area's conformance note — which is the proof the shape was right: the
  screen asks, the system grows, the screen composes. Serves **craft / governance**, and all three pillars by making
  Connect, Collect and Contend read as one hand.

- **2026-09-11 — Wave 4 lands: the polish list is closed and the token file reaches the web.** The taste rules are
  errors by default for `app/` + `components/` (no per-area overrides); `Toggle` and `PageDots` join the primitives;
  `Chip` gains `sub`/`badge`; the social rows (`CrewRow`, `SunPill`, `HandLink`, `CrewPortrait`) graduate into
  `components/ui`; `BlockedUsersModal` is `BlockedUsersSheet`; the one-hero rule is a unit-tested derivation
  (`utils/seasonHero.ts`) across the whole Season scroll; `PIG_ACCENT` solids clear ink contrast; a dead roster read is
  an error with a retry; portrait+name rows are `UserSheet` doors; `/sounder` is `/recruits` (the route was referrals,
  not the herd); the lounge is dark-launched behind `LOUNGE_VISIBLE` instead of an unconditional redirect. Two
  generators now derive `web/tokens.css`, `web/sticker.css` and `DESIGN.md` from `constants/theme.ts`, and
  `npm run lint:web` fails when they drift — the web parity law has teeth before wave 5 migrates a single page.
  Serves **craft / governance**.

- **2026-09-11 — Wave 5 lands; the migration is complete.** Every public web surface — the landing family, the legal
  and report pages, redeem, the adventures click-through and the analytics dashboard — consumes `tokens.css` and
  `sticker.css` generated from `constants/theme.ts`; no HTML file declares a `:root`; Archivo is gone; the sticker card
  is drawn once; the invite page is a thin page over the landing page's shared block; focus rings, contrast and the
  silent copy failure are fixed. Standing gates from here on: `npx eslint` (taste rules are errors), `npm run scorecard`
  (prints 0), `npm run lint:web` (emoji + generated-CSS freshness), `npm run build:tokens` after any theme edit. The
  2026-06 audit's verdict was "governance erosion"; the answer was not discipline but components — the vocabulary
  exists, the screens speak it, and the lint keeps it so. Serves **craft is belief**, across every surface at once.

- **2026-09-11 — One door language at two scales.** The barn structure's leaves and the full-screen panels are the same doors: both *slide* apart (never rotate), both fade after 35% of travel, both take the rest pose under Reduce Motion (zero travel, `crossfade`). Two tempos, both from `MOTION_DURATION`: the **threshold** on the Exterior closes at `state` (220ms), the **room** opens at `celebration` (450ms) — the route cut happens behind closed doors where it cannot be seen. Sprite dimensions, leaf travel and the ground offset are named art constants, never `SPACE` steps. Serves **craft** (the object you tap is the object that becomes the transition).

- **2026-09-12 — The stat tickets stay a matched pair; the streak is a stamp, not a row.** A badge that grows one ticket makes the two-up unbalanced, so the tickets stretch to one height and the streak (flame + day count) becomes a corner stamp overlapping the ticket's top-right edge, like the lucky/wallow ribbon overlaps the bottom. The bank numeral never truncates; the `/ cap` unit yields. Explored on a design canvas (three directions; A chosen). Same day: the glyph sheet's sheet-cut slivers (a stray column of the neighbouring glyph on 23 files) were erased in the assets — the "cut-off emoji" look was asset bleed, not layout. Serves **craft** (balance is a property of the pair, not of one card).

- **2026-09-12 — Rosie's bounce is the app's press, extracted.** Her tickle press (70ms squash to 0.94, spring back at Origami friction 4 ≈ damping 13 / stiffness 230) now lives in `utils/motionRecipes.ts` as `squashAndSpring`, honouring Reduce Motion inside the recipe, and is what the barn structure does on tap; the door leaves and the full-screen panels swing on `MOTION_SPRING` springs (`settle` for the room, `tap` for the threshold) instead of linear timing, clamped at the closed end so an overshoot never crosses the seam. The barn itself is painted art now (ChatGPT ImageGen in Rosie's sticker hand, keyed off magenta and sliced into body + two leaves by `scripts/habitat/slice_barn.py`), replacing the code-drawn SVG. Serves **craft** (rule 6: motion has weight and warmth; one bounce, everywhere).

- **2026-09-12 — A row's actions slide over its name; they never sit beside it.** The friend row's four 32pt controls clipped on phones for a structural reason: `ListRow`'s text column had `flex: 1` without `minWidth: 0`, so a sub line with a non-shrinking `Tag` set the column's floor and shoved the rail past the card — worse under Dynamic Type. The fix is the primitive (`minWidth: 0`, shrinkable sub-line children, a 1.3 font-scale cap on compact rows) plus a rule: **a list row keeps one main control and a chevron in its rail (56pt); everything else lives in a tray that springs in from under the rail and slides over the name column, inside the row's own height**. No row grows on tap, the list never reflows, and the tray's cells are ≥44pt with one-word state lines (`3`, `twice`, `done`). Two phone tiers only (`constants/layoutBreakpoints.ts`): below 390pt the cell labels drop a step. Explored on a design canvas (slide-over vs action sheet vs swipe); chosen for discoverability. Serves **craft** (the name is the row; the actions visit it).

- **2026-09-12 — Chrome caps Dynamic Type at 1.3x; the slot's exit outranks its errand; a room anchors to
  the floor of a short stage.** A 17 Pro `accessibility-medium` pass on the simplified Barn visit found three
  defects with one shape each. (1) **Type.** The visit's chrome is fixed-height around a `flex: 1` stage, so
  past one step of Dynamic Type it clipped rather than grew ("× Lea", "O" / "I", "Leave a h"). `Button`,
  `Chip`/`Tag` and `SegmentedControl` now take an optional `maxFontSizeMultiplier` (undefined by default —
  spec §1.2's 200% is still the rule) and the whole visit chrome passes `VISIT_TYPE_CAP` 1.3, the same cap the
  friend row took. The structural half matters more than the cap: **React Native defaults `flexShrink` to 0**,
  so a `Tag`'s label and a segment's label measured at their content width and pushed their capsule past the
  row instead of wrapping. Both are shrinkable now, and the status capsules carry `maxWidth: "100%"`, which is
  what makes the row's long-claimed `flexWrap` actually wrap. (2) **Precedence.** The bottom slot put the
  hoofprint ahead of the exit — correct under the retired one-tickle visit, wrong under the 3–7 tap cap, where
  the hoofprint has had the whole visit to be taken and the player who is tickled out wants the way out.
  **Tired outranks the errand.** (3) **Anchoring.** `HabitatScene` centres a fixed 390x844 room, which is right
  when the Habitat is the screen and wrong on the visit's short stage, where the leftover read as a cream band
  above the action bar. An additive `anchor="bottom"` (scene) + `ground="transparent"` (doors) pins the floor to
  the stage and hands the leftover to the top, under the header's fade, painted by the host's own background.
  Rule going forward: **a fixed-aspect scene states where its leftover goes, and compact chrome states its type
  ceiling — neither is the caller's problem to patch from outside.** Serves **craft** (the layout holds at every
  text size) and **Connect** (the visit reads, and ends, cleanly).

- **2026-09-12 — Live Dynamic Type changes refresh the native text measurement.** The visit's
  `Leave`, `Outside` / `Inside`, and visits-left labels fit on a cold accessibility-medium
  render but clipped after increasing text size while the visit was open. The same symptom
  is reported upstream for iOS Fabric in React Native [#57512](https://github.com/react/react-native/issues/57512).
  `DynamicTypeText` now observes the system font scale and replaces only its native Text
  node when that scale changes. `Button`, `Chip`/`Tag`, `SegmentedControl`, and the role-based
  `T` use it; the controls and visit state stay mounted. This corrects measurement without
  adding width patches, reducing text size, or changing the existing caps. Verify both
  a cold launch and a live default → accessibility-medium → default transition: static
  prop tests alone cannot catch a native layout cache bug. Serves **craft / comprehension**
  and **Connect** (the visit's controls remain readable).
- **2026-09-12 — Two primitives extracted from copy-paste: `StackPage` and `Receipt`.** `StackPage` (cream ground + SafeAreaView) is the shell every stack screen wears under its `PageHeader` crown — eight screens had hand-rolled it with drift, and rule 5 ("every screen wears the same crown") is now a component rather than a convention. It deliberately carries no `<Stack.Screen>`: the root navigator already hides every header, and a ui primitive must not import expo-router. `ReceiptRows` / `ReceiptRow` / `ReceiptNote` / `ReceiptTotal` are the ledger grammar the tickle and rivalry receipts both drew independently (fixed icon column, `ListRow` lines, hand-voice empty note, dashed-rule total). The retired guestbook, the `habitat`/`coop_dig`/`mud_wars` flags and the v1 Mote Machine screen went in the same sweep; see `SKILL.md`'s log for the product side. Serves **craft / governance**.
- **2026-09-13 — Barn (Home) redesign: the earned stamp, the coin, the Barn button.** Chosen over a paper receipt and a hanging plank because it keeps the painting ≥ 70 % and every number a glance away; within the coin direction, two corners (E) over one strip (F) because the permanent number and the live number get their own objects and the middle of the sky stays empty. Rules it sets: (1) a live ribbon hangs under the coin's regen line as one small tag — no new sticker for a transient state, and the stamp on the left never carries anything live; (2) the Barn button's face is the armed quick action (picked from the fan, kept per installation — see `SKILL.md` 2026-09-13), and the fan is the only place secondary actions live — no more in-scene pills or in-flow control rows; (3) diegetic accessories (a mound for a buried truffle) are allowed for *things in the yard*, never for actions. The `Icon` star was redrawn hand-cut (fat, rounded, a 5° lean, glint when filled) so SVG and painted stars rhyme; `premium` shares the cut. Serves **craft** (one sticker grammar, top to bottom) and **legibility**.

- **2026-09-13 — A sheet's footer sits on the home indicator, not on a phantom tab bar.** `Sheet` padded `TAB_SAFE + insets.bottom` (~108pt) under every footer by default, "to clear the hanging-signs tab bar" — but the panel rides a native Modal, which is *above* the tab bar, so the clearance was dead paper (the buried-truffle sheet's bottom third). The pad is now `SPACE.xl + insets.bottom` for every sheet and the `bottomInset` prop is gone; `TAB_SAFE` stays what the spec says it is — the one scroll `paddingBottom` for content that really does run under the bar. Serves **craft** (the sheet ends where its content ends) and **legibility**.

- **2026-09-13 — The Barn collection is a sticker book: two tiles to a row, one state capsule each, the section header pinned.** `app/barn-collection.tsx` drew every one of its 122 designs as a full-width card — art, name, description, two label lines, a link and a full-width button — so a player scrolled roughly one design per screen and nothing on the tile said whether the design was *in the room* or only *in storage*. The tile is now the Shop's card grammar (square art well on the rarity fill, rarity dot, sage owned check, sun `Ribbon` for new) with `cardTitleSm`, exactly one `Tag` for state — **`In room` (sage, check) · `Owned` (sage) · `Rank N gift` / `Gift at 4 owned` / `Barn gift` (muted, gift glyph)** — and the action (`Place`, or `Buy for N` wearing the locked chrome when the Snouts aren't there; a gift the player doesn't own carries no inert button). Description, earn copy and the wishlist live in the item sheet a tap opens; the tap is the room preview, as before. Sections stay the collections, with a `SectionHeader` that pins (`stickyHeaderIndices`, painted cream edge to edge) and counts `N of M owned` in its right slot; collection progress is a `ProgressTrack` and two gift tags instead of a two-line sky sticker; the ownership filter is a `SegmentedControl`; each empty filter gets its own `EmptyState` line. "In room" is read from the draft when the Barn is mid-edit and from the saved snapshot otherwise — placed and stored are different states and the tile says which. Rule going forward: **a collection tile shows art, name, one state, one action — everything else is the sheet's job.** Serves **Collect** (the book you flip through is the proof you were there) and **craft / governance** (the two Collect surfaces read as one hand).

- **2026-09-13 — Indoors, the pig sits.** The Barn interior looked frozen because the standing idle is, visually, one drawing: `PIG_ANIMATION_SPECS.idle` plays only `idle_2`/`idle_4` (the stance-continuity fix), two poses that differ by ~7 % of edge pixels. The Exterior hides that behind the drifting sky and the tickle reactions; a still room shows it. Ruling: a room (`HabitatScene`) provides a seated rest through `PigRestingPoseProvider`, and `PigStage` takes `sit` in place of a standing idle only — a mood or a reaction plays as it would anywhere, and the Exterior never provides a pose, so its tickle idle is untouched. `sit` is a render-only variant like `bounce`: it rides the happy family's frames AND its per-frame anchors (`pigAnchorAnimation`), so a worn item tracks it with no new art and no new placement work; four legs planted, one silhouette, eyes open (1, 4), a smiling squint (2, 3). It ticks at the shared rest tempo (`PIG_REST_FPS`, 2.5) with a long open hold — a 4 s settle-and-blink, not the 4 fps happy burst — and Reduce Motion rests on the eyes-open frame. Rule going forward: **a rest loop must carry at least two distinct drawings; a variant borrows a whole family (frames + anchors), never frames alone.** Serves **craft** (rule 6: the pig is alive in her own home) and **Collect** (the room is where the collection is worn, and the wearer must move).

- **2026-09-13 — The barn doors are crisp: full-screen raster art is exported at the density its surface needs, and the route cut behind them is declared at the navigator.** The swing looked blurry because `barn_door.png` was a 260×300 export of its SVG, cover-fitted to the whole phone — a ~9.5x bilinear magnification on a 3x Pro Max (2868px tall). `scripts/habitat/generate-art.mjs` now carries a per-asset `RASTER_SCALE` (door = 10x → 2600×3000) so the tallest phone draws it at 1:1; nothing about the drawing changed. Rule for the future: art that `cover`-fills a screen ships at ≥ 3x the tallest supported screen, art that sits in a slot ships at its slot. Same pass: `barn-interior` is registered on the root `Stack` with `animation: "none"` — the `Stack.Screen` options a screen sets on itself arrive via `setOptions` *after* the native push has begun, so the interior slid in as an iOS card with half-open doors over the closed threshold; the route now cuts invisibly behind closed doors, as the 2026-09-11 entry always intended. Serves **craft** (rule 6, and "the object you tap is the object that becomes the transition").
