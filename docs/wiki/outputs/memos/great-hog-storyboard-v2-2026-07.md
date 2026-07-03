---
title: "The Great Hunger — opening storyboard v2 (anchored on real game art)"
type: memo
date: 2026-07-02
tags: [great-hunger, storyboard, cinematic, art, season-2]
status: draft
---

# The Great Hunger — 30-second opening (v2)

Supersedes the v1 storyboard. The change: we **stop inventing a style** (sticker / gouache / felt were all rejected) and instead **generate the storyline from the game's own art** — Rosie's real expression sprites + the real backgrounds — with the **Hog King** (the villain being designed in the parallel MJ tab) as the antagonist.

## The storyline (locked)

**Logline:** The world runs on *tickles* — glowing golden motes of joy. One night the **Hog King** ("the Great Hunger") creeps in and devours them all; the valley goes grey and Rosie is left with nothing. *(This is the Season-2 cold open — it sets up the PROBLEM, not the win.)*

**The arc (ends DOWN):** full valley → the theft → the grey → the empty world → **the Hunger begins.** This is the *beginning* of the season, so it does NOT resolve — Rosie is never happy or victorious here; she earns that by playing. The emotional shape is joy → loss → a small, sad resolve, and it **ends on the low**: the Hog King triumphant atop his hoard, the valley grey below, and a hook ("help win them back"), not a celebration. Rosie is the heart; the Hog King is a charming glutton, not a monster — but right now, he won.

## The style anchor (use on every shot)

> Match the GAME'S OWN look — soft, glossy, hand-illustrated cartoon exactly like the Rosie sprites: chunky rounded forms, soft cel-plus-gradient shading, gentle highlights, warm **painterly** storybook backgrounds. Cozy, whimsical, gently comedic, never scary/photoreal. **NOT** flat-sticker, **NOT** gouache, **NOT** felt. Portrait 9:16.

## The reference set (drag these into MJ/ChatGPT per shot)

- **Rosie:** `assets/images/sprites/rosie/{idle,happy,tired,surprise,sad,jump,walk}_1.png` — pick the expression per beat.
- **Backgrounds:** `golden_mire_bg.png` (the tickle valley), `homestead_barn.jpg` (Rosie's barn), `bog_dusk_bg.png` (night — the theft), `reed_marsh_bg.png` (grey dawn), `sunset_farm.png` (restored valley).
- **Villain:** the **Hog King** design (from your parallel tab — hand it off so I can match it exactly; see bottom).

## The 7 shots (refined)

| # | Beat | On-screen | VO | Rosie ref | BG ref | Also |
|---|---|---|---|---|---|---|
| 1 | The valley of tickles | *"Once, the valley glowed gold…"* | "Once, the whole valley glowed gold with tickles — every single night." | — (wide, tiny pigs) | `golden_mire_bg` | swarms of golden motes |
| 2 | Rosie asleep | *"…and no one loved them more than Rosie."* | "And no one loved them more than a little pig named Rosie." | **tired_1** | `homestead_barn` | a shadow creeping in from frame edge |
| 3 | The Hog King comes | *"But then… the Great Hunger."* | "But one night, over the hill, came the Great Hunger." | — | `bog_dusk_bg` | **HOG KING** tiptoeing, moonlit |
| 4 | The theft (thesis shot) | *"He ate every last tickle."* | "And with one enormous slurp, he ate every last tickle." | — | `bog_dusk_bg` | **HOG KING** slurping a golden river of motes; barn dims gold→grey |
| 5 | Grey dawn | *"Morning came. The gold was gone."* | "Rosie woke to a world gone quiet and grey." | **surprise_1 → sad_1** | `reed_marsh_bg` (desaturated) | one faint pink cheek = last color |
| 6 | The empty valley | *"The tickles were gone. Every last one."* | "By morning, every last tickle was gone." | **sad_1** | `golden_mire_bg` **fully greyed** | Rosie tiny in the vast colorless empty valley; a few other pigs slumped and sad; no motes anywhere |
| 7 | The Hunger begins *(ends DOWN)* | *"The Great Hunger has begun."* → CTA: *"Help win them back."* | "He has them all now." | **sad_1 / tired_1** — small, sad, barely resolute | grey valley + a distant dark hill | the **HOG KING** far off, gorging atop a mountain of stolen glowing tickles, gloating; the grey valley below; Rosie tiny in the foreground looking up — outmatched, not beaten. NO celebration, NO re-lit valley. |

**Per-shot generation recipe:** drop the Rosie expression sprite + the background (+ the Hog King on shots 3/4/7) as image references, then prompt the scene with the style anchor. Rosie's identity comes from her sprite; the world comes from the real backgrounds; only the *composition + lighting + the Hog* are newly generated — so the whole film sits inside the game's real look.

## Open — the Hog King hand-off

The Hog King is being generated in a Chrome tab **outside the connector's reach**, so I can't see or pull it. To wire him in, do ONE of:
1. **Move that tab into the connector's tab group** (or tell me its title) so I can screenshot + download the picks, or
2. **Save the chosen Hog King PNG to `~/Desktop/ttp-refs/great-hunger/`** and I'll grab it, or
3. **Drop the Hog King image into this chat.**

Until then shots 3/4/7 use a `[HOG KING]` placeholder slot.
