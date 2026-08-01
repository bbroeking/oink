---
target: completed Truffle Patch page in Screenshot 2026-07-25 at 10.09.32 PM
total_score: 21
p0_count: 0
p1_count: 3
timestamp: 2026-07-26T02-14-56Z
slug: components-mudwar-trufflepatch-tsx
---
Method: dual-agent (A: /root/patch_design_review · B: /root/patch_detector)

# Truffle Patch completed-dig state

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 1/4 | The receipt signals completion, but the persistent “dig quick, dig quiet” header and help control still imply an active dig. |
| 2 | Match system / real world | 2/4 | Cozy language fits the game, but “finds against the Hungerer,” “board’s 2,” and “golden in 7 digs” require translation. |
| 3 | User control and freedom | 3/4 | The finished patch can be reviewed and the player can exit; the exit is simply too quiet. |
| 4 | Consistency and standards | 2/4 | The whole gold statistic banner is tappable even though only “share it” looks actionable. |
| 5 | Error prevention | 2/4 | A distracted player can tap the strongest result surface and unexpectedly open the native share sheet. |
| 6 | Recognition rather than recall | 1/4 | Four numbers describe different systems without making those distinctions legible. |
| 7 | Flexibility and efficiency | 2/4 | The board is sensibly collapsed, but the most likely next action is visually demoted. |
| 8 | Aesthetic and minimalist design | 2/4 | Strong authored visual identity, but too many text voices and nested frames compete. |
| 9 | Error recovery | 3/4 | No error is present here; the exit is preserved and submission refusals have dedicated copy elsewhere in the component. |
| 10 | Help and documentation | 3/4 | Contextual help exists and is reachable, though it remains prominent after play has ended. |
| **Total** | | **21/40** | **Acceptable — significant clarity work needed** |

## Anti-patterns verdict

This does not look generically AI-generated. The paper palette, hard ink borders, display type, icon treatment, and sticker shadows are specific to Tickle the Pig.

The editorial structure does show accretion: each mechanic received its own phrase, counter, and typographic treatment without a final decision about what the player needs to understand now. The bespoke art direction is carrying an overloaded information architecture.

The deterministic detector returned zero findings. That is expected to be incomplete: it is an HTML/web rule engine scanning a React Native component, so the clean result is not evidence that the native screen passes accessibility or hierarchy checks. No false positives were emitted.

Browser overlays were not applicable because this is a native React Native surface with no DOM target. The supplied 622×754 screenshot and source were used instead.

## Overall impression

The screen is intended to be a triumphant post-dig receipt:

1. The Hungerer wakes.
2. The player escapes safely with everything gathered.
3. The game itemizes what was banked.
4. A lucky statistic offers a social brag.
5. The player returns to the season.

That is a sensible emotional arc. It fails because the screen never changes cleanly from “digging” to “done.” The active-game header remains, the outcome headline sounds partly like failure, four unrelated counts arrive at once, sharing becomes the loudest action, and leaving becomes the quietest.

## What is working

- The scrapbook/paper-craft identity is coherent and recognizably authored.
- Collapsing the dead board behind “peek at the patch” is good progressive disclosure.
- The receipt rows use a fixed icon column and scan more clearly than centered prose would.

## Priority issues

### P1 — Completion is not stated plainly

“The Hungerer stirred” sounds like failure while “you trotted off with everything” describes success. The persistent “dig quick, dig quiet” title continues to frame the state as active.

Fix: switch the entire header into an end mode, hide the how-to-play control, lead with “Dig complete,” and use the Hungerer line as secondary story copy.

Suggested command: `$impeccable clarify`

### P1 — The receipt makes the player solve the economy

The screen presents “+1 Golden Truffle,” “1 of the board’s 2,” “+2 finds,” and “7 digs.” Each number is valid, but each counts a different thing and the labels do not expose those distinctions.

Fix: lead with the reward, translate the season contribution into plain language, rename action count explicitly, and move secondary accounting behind detail disclosure.

Suggested command: `$impeccable distill`

### P1 — The action hierarchy is backwards

The widest, brightest control shares externally. “Back to the season,” the likely primary action after a short mobile session, is a quiet tertiary link. Because the entire gold banner is one button, tapping the result statistic also opens sharing.

Fix: make “Back to season” the clear filled primary button, make “Share result” a smaller secondary button, and keep the lucky statistic noninteractive.

Suggested command: `$impeccable layout`

### P2 — “Peek at the patch” floats without a clear parent

The control sits in a large empty band before the receipt, separated from both the hidden board and the outcome it supplements.

Fix: rename it “View finished patch” and attach it to the receipt’s bottom edge or place it directly beneath the completion summary.

Suggested command: `$impeccable layout`

### P2 — Accessibility behavior is under-specified

The receipt has no explicit heading/status announcement or focus transfer. The share button’s accessibility label omits the lucky statistic, and long-press-to-copy has no hint. The small muted subline and one-line gold banner are fragile under Dynamic Type.

Fix: announce completion, expose the receipt as a coherent group, allow wrapping, strengthen muted contrast, and expose copy as an explicit accessible action if it matters.

Suggested command: `$impeccable harden`

## Persona red flags

**Jordan, first-timer:** Cannot infer why one truffle produces two “finds,” what “against the Hungerer” changes, or whether waking him means the dig was lost.

**Casey, distracted mobile player:** Sees the gold share surface first, can accidentally open sharing, and may miss the quiet exit. The screen takes too long to answer “Did I get it, and am I done?”

**Sam, accessibility-dependent player:** Encounters small muted copy, dense decorative type, an icon-only help affordance, no completion announcement, and a hidden long-press action.

## Minor observations

- “The Hungerer’s gorging” is lore-heavy and grammatically awkward as a persistent task title.
- The outer patch frame plus inner receipt frame makes the state feel like a modal nested inside another modal.
- “Golden Truffle” capitalization is inconsistent.
- The tiny mark beside the heart row reads like stray punctuation or a rendering artifact.
- The gold banner’s handwritten lead, oversized numeral, sparkle, and bold share label all compete inside one row.
- The share banner’s explicit accessibility label does not include the visible “found in 7 digs” result.

## Questions to consider

- Is stirring the Hungerer a failure, a neutral timer expiry, or a successful escape condition?
- If the player remembers one thing, should it be the truffle earned, the season contribution, or the share prompt?
- Does sharing deserve the strongest control on a private end-of-session receipt?
- If “finds against the Hungerer” cannot be explained in five plain words, should that metric appear here?
