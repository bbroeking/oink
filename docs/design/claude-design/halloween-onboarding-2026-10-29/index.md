# Halloween onboarding (2026-10-29)

Design canvas: https://claude.ai/artifact/PehtL42yhS4vevyh8iqcmm

Onboarding that introduces the Halloween content (the Pop-up Stall, full costumes, the Halloween weekend shelf) and explains how it works. Two directions, one row each, 390x844 boards, a sticky per row with pillar fit, trigger, build minutes and winter reuse, plus a recommendation sticky.

| Direction | Boards | The idea | Trigger | Build |
| --- | --- | --- | --- | --- |
| A · Three cards, then the stall | `Main` (card 1: the stall), `A2_Costumes`, `A3_Where`, `A4_StepIn` | A 3-card intro sheet (AdaptiveModalScaffold card, GreatHungerIntro chrome): stall, full costumes, where to look; "Step in" lands on the stall's New tab. | Shop tab mounts while a stall is open and `stall_intro_seen:<set_key>:<user>` is unset; usePopupSlot priority 60, behind What's New; seen-key written on present, so Skip / back / Step in all end it for good; once per set key. | ~45 min: one new `components/StallIntroModal.tsx` + ~10 lines in the Shop tab. Static sprite Images, not PigStage. |
| B · The stall teaches itself | `B1_Shop` (new-here tag + weekend shelf), `B2_New`, `B3_Back`, `B4_Yours`, `B5_Costume` | No modal: a "new here?" tag on the stall card, a one-time coach strip per stall tab, a one-time costume explainer in front of the first costume try-on, the weekend shelf taught by its own section kicker. | Tag until first visit (`stall_visited:<set_key>`); strip once per tab (`stall_coach:<tab>`), Got it or leaving the tab; explainer once ever (`costume_explainer_seen`). | ~45 min across four files: tag (5), CoachStrip + 3 keys (15), explainer (15), kicker (5), QA (5). |

Recommendation on the canvas: build A this week and fold in B1's "new here?" tag (5 min). B's coach strips are the follow-up once the stall has a second tenant.

Art: costume sprites are `assets/images/sprites/costumes/<slug>/idle_1.png`; the stall backdrops are `assets/images/backgrounds/halloween-2026/` (graveyard, porch); the pieces are `assets/images/hats/halloween-2026/`; glyphs are the painted set. Hat placement on Rosie is eyeballed, not the renderer's RelSpec. Tokens are the "Tickle the Pig" design system (installed on the canvas) copied by hand into the CSS. Regenerate with `python3 gen.py` (asset urls are the canvas's uploads); `canvas.json` lays the boards out.
