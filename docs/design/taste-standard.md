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
- **Show feelings, never state them.** Mood = Rosie's sprite. Streak = the Garden growing.
  No meters/numbers/labels for anything emotional — the heart-counter is the *only* number that
  earns its place. (Progression systems — XP, tiers, prices — may show numbers; feelings may not.)
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
