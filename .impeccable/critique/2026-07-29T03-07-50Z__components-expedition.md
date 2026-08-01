---
target: components/expedition (Rosie's Ramble v0 screens, post-fix)
total_score: 27
p0_count: 1
p1_count: 2
timestamp: 2026-07-29T03-07-50Z
slug: components-expedition
---
Method: dual-agent (isolated design-review + detector-evidence subagents)

# Re-critique — Rosie's Ramble v0 screens (post P0–P2 fixes)

## Design Health Score — 27/40 (up from 22; Acceptable, approaching Good)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Journal tickle at 0 tickles or full charge changes nothing on screen |
| 2 | Match System / Real World | 4 | "Tuck," "postcard," "jar," behavior lines — best-in-app vocabulary |
| 3 | User Control and Freedom | 2 | No un-tuck, no unequip-to-empty, no backdrop dismiss on overlays |
| 4 | Consistency and Standards | 3 | Satchel/prediction panels skip Sticker; hand-rolled kicker rows beside SectionHeader |
| 5 | Error Prevention | 2 | Road-card refusal excellent; full-charge spend, 0-tickle taps, no-op Warm Tea play slip through |
| 6 | Recognition Rather Than Recall | 3 | Cushion/Sparkle semantics never stated anywhere |
| 7 | Flexibility and Efficiency | 3 | Right-sized; dev drawer a proper accelerator |
| 8 | Aesthetic and Minimalist Design | 3 | Journal is an 8-block stack; the sum buries the decision |
| 9 | Error Recovery | 2 | Fight log warm; journal mute on every refused action |
| 10 | Help and Documentation | 2 | "Rosie walks while you're away" stated only in the dev drawer |
| **Total** | | **27/40** | |

## Verdict deltas from run 1

Fixed and confirmed: send-off tickle now real (settle carries zoomies — verified in kernel), predictFight names the empty jar, victory shows the right enemy, stat pips + docked prediction landed (send-off now "earns it"), postcard ceremony (spring/tape/stagger) is now the internal bar, Zoomies is sparks + words with a progressbar label (best feelings-not-numbers execution in the feature), 7/7 animations gated through useMotionPolicy.

## New Priority Issues

- **[P0] The journal's gold CTA silently lies three ways.** (a) At 0 tickles, taps do nothing with no feedback; (b) at full charge, a tap SPENDS a tickle for zero gain (Math.min cap after decrement); (c) at a wall, a quiet tickle can fire the Zoomies burst OFF-SCREEN — wall damage/defeat with no fight, no ceremony (JournalHome discards the SwingResult). Fix: kernel-refuse the cap spend; locked "asleep" button at 0 tickles with warm line; cap quiet tickles at ZOOMIES_MAX−1 or route the burst into the fight view.
- **[P1] The flinch advice is unkeepable mid-fight.** "A lid or Warm Tea would block it" — but block resolves only at arrival in settle(); equipping/playing now cannot block the pending peck, and playing Warm Tea burns the fight's one card tap as a no-op. Fix: tickle() re-checks blockActive when openingHitPending + playCard refuses an already-satisfied block; or copy moves to past tense.
- **[P1] Empty-jar copy promises a refill that doesn't exist in v0.** mockTickles only decrements. Add a mock refill or make the copy honest for the slice.
- **[P2] Peak-end inversion: the chapter/boss clear has no ceremony** while the routine postcard has the best one. Reuse the postcard pattern for the clear.
- **[P2] Type-override shadow scale + flat prediction panel.** 17 composed fontSize overrides forming a de-facto 9/10/15/24 scale (missing TYPE roles); the prediction — the most important sentence in the loop — is the one flat, untilted card on the page.

## Evidence summary (Assessment B)

0 raw hex · 0 emoji · 0 shadow violations · 0 production touch-target violations · 0 body-text contrast failures (narrowest margin: TUCKED tag at 4.70) · 7/7 animations reduce-motion-gated (HP width anim is the one layout-property animation, commented deliberate) · detector: 1 hit (SpaceMono, dev drawer) · a11y gaps: no accessibilityViewIsModal on 3 overlays, no selected-state semantics, equipped gear chip has no non-visual selected cue · scrims stop at safe-area edges · jest 31/31, tsc clean, 1 unused import (FONTS).

## Which UI earns its place (delta)

| Surface | Run 1 | Run 2 |
|---|---|---|
| Journal home | Needs rework | Needs rework — CTA honesty P0 + 8-block stack |
| Send-off (gear+cards) | Needs rework | **Earns it** — pips + flavor + tilts + docked prediction |
| Postcard | Earns it | **Earns it** — now the internal ceremony bar |
| Fight | Needs rework | Needs rework — promise layer breaks (flinch advice, no-op plays, off-screen bursts) |
| Bestiary | Earns it | Earns it (modestly) |

## Questions to Consider

1. If Rosie walks regardless, what is the send-off buying? A tucked card that untucks on return — or Zoomies that cool overnight — would make the morning ritual real without violating "absence never hurts."
2. Is the tickle-mash the fight, or the queue for it? Five identical taps buy one interesting event; what if each tickle did something visible so the charge IS the fight?
