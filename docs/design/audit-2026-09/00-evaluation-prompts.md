# "Is this design good?" — the evaluation prompt set (2026-09-11 UI/UX audit)

Ten prompts, selected from the credible approaches surveyed below and adapted to Tickle the Pig. Every auditor
runs **all ten** against its assigned UI area. Each prompt says what it is for and what shape of answer it wants.

## Sources surveyed (and what each contributed)

| Source | What we took | What we left |
| --- | --- | --- |
| Nielsen Norman Group — 10 usability heuristics (via Lollypop, ParallelHQ, AI UX Playground prompt) | The diagnostic backbone: a scored 0–4 pass per heuristic with a severity per violation | Desktop-centric wording; rewritten for a phone game |
| Impeccable `critique` reference (local, `.agents/skills/impeccable/reference/critique.md`) | The **design-specificity verdict** ("could an unrelated product use this unchanged?"), cognitive-load checklist (>4 options at a decision point), emotional journey (peak-end, reassurance at high stakes), the "strengths first" ordering | Its browser-detector step (no web target for the app) |
| Impeccable `audit.native` reference (local) | P0–P3 severity definitions; the native checks: 44pt targets, Dynamic Type, Reduce Motion, insets, icon-set drift, hard-coded colors | The command-routing output |
| UICrit (arXiv 2407.08850) — 983-screen expert critique dataset | The five critique categories experts actually use (layout · color contrast · text readability · button usability · learnability) and **Sadler's feedback format**: expected standard → identified gap → solution | Bounding-box localisation (we localise by `file:line`) |
| Netguru / UXPin / Awesomic design-system audit guides | The token triage (actual usage · standards compliance · redundancy), the component-inventory-then-categorise method, "pair the visual audit with a code grep for hard-coded values", state coverage per component | Documentation-review steps that don't apply yet |
| Designlab 10-point critique checklist | The "first two seconds" impression, navigation cohesion, label/naming consistency, capitalisation consistency | Usability-testing and handoff-readiness items |
| Game Developer — accessibility heuristics for mobile games | Interactive vs non-interactive distinction, consistent iconography, text resizable to 200%, no precision-drag-only actions, clear ad close | Audio/dubbing items |
| Laws of UX (via the Claude design-critique skill) | Fitts, Hick, Gestalt proximity/similarity, Von Restorff, Jakob's law as a *why* vocabulary | The 5-point per-heuristic scorecard (we use 0–4 to match Impeccable) |
| Medium "12 prompts before every design review" (403 at fetch time; summary only) | The habit of running prompts for **missing states, logic gaps, edge cases** before a review | Nothing verbatim available |
| TTP's own `SKILL.md` + `docs/design/taste-standard.md` | The product lens (pillar · one sentence · fair · warm loss · sustainable) and the craft lens (paper-craft DNA, tokens, no emoji, show-don't-tell, world responds now) | — |

## Severity scale (used by every prompt)

- **P0 Blocking** — prevents task completion, or an automatic taste failure (emoji in UI, black wrapper, system Alert in a spend path).
- **P1 Major** — significant difficulty, an accessibility failure, or a system rule broken on a primary surface (raw hex / raw fontSize on a tab screen, a hand-rolled duplicate of a shared primitive).
- **P2 Minor** — annoyance with a workaround, or a system rule broken on a secondary surface.
- **P3 Polish** — nice-to-fix, no user impact.

## The ten prompts

### P1 · Nielsen heuristics pass
> You are a usability expert. For this screen/component, score each of the 10 heuristics 0–4 (0 = broken, 4 = exemplary; `n/a` if it cannot apply). For every violation: the heuristic, what you see (file:line), why it matters to a player, and the concrete fix expressed as a design-system rule or component, not a one-off tweak.

### P2 · Design-specificity verdict (taste)
> Before anything else: could an unrelated product use this composition, interaction, and visual language unchanged? Answer PASS / PARTIAL / FAIL with evidence. Then ask the taste standard's two questions together: *which pillar does this serve?* and *would a designer who knows this game make this exact choice?* Name the paper-craft DNA elements present (Sticker, hard shadow, tilt, whimsy title, hand kicker, Glyph art) and the ones missing or faked (soft shadow, borderless card, system font, emoji, linear fade).

### P3 · Sadler critique in the five UICrit categories
> For each of **layout · color contrast · text readability · button usability · learnability**, write findings in Sadler's format: **expected standard** (quote the token/rule in `constants/theme.ts` or the taste standard) → **identified gap** (file:line + the literal value) → **solution** (the token, primitive, or new system rule). Skip a category only if you looked and found nothing.

### P4 · Token triage (actual usage · compliance · redundancy)
> Grep this area for raw hex, `rgba(`, bare `fontSize`, bare `borderRadius`, bare padding/margin/gap, `fontWeight`, `shadowRadius > 0`, and `COLORS.*` (legacy palette). For each cluster: is there an existing token it should be? Is it a *missing* token the system needs (name it)? Or is it a redundant near-duplicate of an existing value (say which)? Report counts per file and the top literal values.

### P5 · Component inventory and state coverage
> Inventory every distinct UI element in this area (screen, card, sheet, modal, row, chip, badge, button, input, tab, toast, header, empty/loading). For each: primitive used (`Sticker`, `Button`, `SectionHeader`, `PageHeader`, `EmptyState`, `SlideUpSheet`, `AdaptiveModalScaffold`, `SegmentedControl`, `IconButton`, `Glyph`/`Icon`) **or hand-rolled**; which states exist (default · pressed · disabled/locked · selected · loading · empty · error · success); and whether another element elsewhere in the app does the same job with a different look (name it). Output a table.

### P6 · Mobile-game accessibility pass
> Check: every tappable ≥ 44pt (or hitSlop) and labelled (`accessibilityLabel`/`Role`/`State`); text survives 200% Dynamic Type without clipping the paper; Reduce Motion has a still or crossfade alternative for every decorative loop; contrast of every text/surface pair against WCAG AA (name the pair and the hex); interactive vs non-interactive is visually distinguishable (stickers that look tappable but aren't, and vice versa); icon set is consistent (`Icon`/`Glyph`, not mixed vector-icon families); ads and sheets have an obvious close. Cite file:line.

### P7 · Cognitive load and emotional journey
> Walk the player's path through this area. Flag any decision point with more than 4 visible options, any screen where the primary action is not the most visually dominant element, and any place a number is used to state a feeling (taste law: feelings are sprites, progression may be numbers). Then map the emotional arc: where is the peak, how does it end, and are high-stakes moments (spending snouts, leaving a Sounder, rename, purchase) given reassurance and an undo/cancel path?

### P8 · Laws of UX lens
> Apply Fitts (target size vs distance for the primary action), Hick (choice count), Gestalt proximity/similarity (are related things grouped and unrelated things separated with `SPACE` tokens?), Von Restorff (does the one thing that should stand out actually stand out, and is only one thing standing out?), and Jakob (does a sheet/modal/tab behave as a phone user expects?). One line per law, with the strongest example in this area.

### P9 · First-two-seconds and naming consistency
> For each screen: in two seconds, what does a new player think this screen is for, and what is the one thing to do? Then check labels: capitalisation convention (sentence vs Title Case vs UPPERCASE kicker), punctuation, the ★ / ✦ / · dingbat ruling, player-facing nouns vs code nouns (Hoofprints vs activeEffects), and whether the same concept is named the same way across screens.

### P10 · Charter and taste-standard compliance
> Score PASS / FAIL with evidence for each: (a) serves a named pillar; (b) the mechanic on screen survives the one-sentence test; (c) losing/empty/locked states are warm, never shame; (d) no emoji character in any render; (e) the world responds now (tap → immediate feedback, no latency-as-default); (f) every screen is cream/paper, no black wrapper; (g) stack screens wear `PageHeader`, sections wear `SectionHeader`; (h) empty/loading use `EmptyState`/`LoadingBeat`; (i) only the two hard shadow tiers; (j) disabled controls keep their outline.

## Output contract for auditors

Write findings to `docs/design/audit-2026-09/findings-<area>.md` with these sections, in this order:

1. **Area summary** — 3–5 sentences: what this area is, what's working, the single biggest systemic gap.
2. **Inventory table** (from P5).
3. **Findings** — one block per finding, most severe first:
   `### [P?] <id> · <short title>` then **Location** (file:line), **Prompt(s)** that surfaced it, **Evidence** (the literal code/value), **Expected standard**, **Gap**, **Recommendation** (phrased as a design-system rule, token, component, or variant), **Pillar** it serves.
4. **Heuristic scorecard** (P1, 0–4 per heuristic, one table per major screen).
5. **Token triage table** (P4).
6. **What's working** — patterns to keep and replicate, with file references.
7. **System asks** — the concrete tokens / components / variants / rules the future design system must include so this area can be rebuilt from it alone.
