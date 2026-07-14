---
target: season tab
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-13T20-48-23Z
slug: app-tabs-season-tsx
---
Method: dual-agent (A: design review · B: detector + native sweep + live sim)

# Critique — Season tab (run 2, post-polish)

## Design Health Score: 31/40

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | System status | 4 | Now-pin, live countdowns, quiet dashes — unchanged superpower |
| 2 | Match to real world | 3 | "stirs" used in the join pitch, defined nowhere on the tab |
| 3 | User control | 3 | Leave/rename hidden inside the help modal footer |
| 4 | Consistency | 3 | `Icon "premium"` means Slop Club AND Golden Truffles AND aura fallback |
| 5 | Error prevention | 4 | Busy guards, derived onboarding can't nag falsely, feature-dark renders nothing |
| 6 | Recognition | 3 | Three unlabeled header icon doors; hunger thresholds obfuscated |
| 7 | Flexibility | 2 | N READY tiers = N×(tap→dialog→dismiss); no claim-all |
| 8 | Minimalist | 2 | 11 stacked surfaces before the first tier row; display-only StatsPills |
| 9 | Error recovery | 4 | Per-reason in-world ClaimNoticeDialog ("Already yours") |
| 10 | Help | 3 | Five overlapping explainer entries; loop told four ways |

## Anti-Patterns Verdict
LLM: not slop — a governed system used mostly correctly; erosion localized to the new vlStyles block (raw SPACE/TYPE values, hand-rolled shadow, COLORS.successText as a fill), ~130 lines of dead snake-track styles, and SounderLaunchModal's hand-rolled primary button. Detector: **[] — zero findings.** Native sweep: 0 hex, 0 rgba, 0 Alert.alert, 0 ActivityIndicator, 0 emoji; 61 raw fontSizes (mostly legacy season-0 + dev blocks), 9 raw radii; pressed-feedback gaps down to 3 (SeasonGuideModal rename/leave links, SounderStepCard replay link). Live sim screenshots: clean render, no clipping/overflow; dev-only founder chip visible in dev.

## Fixed since run 1 (verified blind)
Premium truth-telling (banner praised as "states plainly what the premium track is"), warm ending (SeasonEndBeat called "real peak-end craft"), guarded NotifyChip for retained players, verb swap, Alert.alert eliminated, pressed gaps 17→3.

## Priority Issues (new)
1. **[P1] First-session modal gauntlet** — tale → guide auto-pop → launch nudge before the first tap, while the step card already teaches by doing. Fix: kill the guide auto-open (behind "how it works ›" only); move GUIDE_EVERY_VISIT behind __DEV__ (shipping footgun). → onboard
2. **[P1] Golden Truffles wear the Slop Club crest** — YourTakeStrip pouch cell renders Icon "premium" for the free-earned currency; the same icon is the paywall crest below. Fix: HAT_IMAGES.golden_truffle art in the cell; reserve "premium" for Slop Club. → clarify
3. **[P2] Multi-claim friction** — claim-all when READY ≥ 2, or chain the dialog. → polish
4. **[P2] "stirs" + the two-diggers dead-end** — reword pitch to a felt benefit; make "invite a second snout" a button. → clarify
5. **[P3] vlStyles token migration + dead-style purge + SounderLaunchModal Button.** → polish

## Personas
Jordan: modal stack + guide step 1 references a "+ slot" that doesn't exist on this tab. Sam: guarded-phase visits still end at a disabled verb (NotifyChip is right but link-weight); YourTake "claim ›" implies one tap but requires scroll-find-claim. Riley: weekly rank still least-weighted line in RaceSection; no claim-all; thresholds obfuscated.

## Questions
1. Is the Season tab two products (daily dig loop vs pass ledger) sharing one scroll?
2. Could "under glass" premium mean sun-lit aspiration with a lock footnote, instead of 30 dashed greys?
3. If tickles never buy/gate/rank anything here, should "tickles reclaimed" BE the season XP?
