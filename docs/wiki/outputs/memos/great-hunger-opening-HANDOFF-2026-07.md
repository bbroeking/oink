---
title: "The Great Hunger — opening cinematic: HANDOFF"
type: handoff
date: 2026-07-02
tags: [great-hunger, season-2, cinematic, storyboard, art, world-boss, handoff]
status: in-progress
---

# HANDOFF — "The Great Hunger" opening cinematic

Self-contained state so another person/agent can pick this up cold.

## 1. What we're building

A **~30-second opening cinematic** for **Season 2** of *Tickle the Pig* (TTP). It introduces **"The Great Hunger"** — the season's server-wide cooperative **world boss**: a giant, charming, gluttonous **Hog King** who steals the world's **tickles** (the game's golden joy-motes / core currency-of-feeling). The cinematic's job is to set up the *problem* so players are motivated to band together and fight back (the Season-2 "Mud Wars" fight-back loop). Serves the **Cooperate** pillar of `SKILL.md`.

Two eventual delivery targets for the art:
- **Static storyboard** (7 shots) — concept + marketing.
- **In-app animated intro** — `components/GreatHungerIntroModal.tsx` (a 5-beat Reanimated storybook that currently uses PLACEHOLDER art; real shot/hog art swaps in later).

## 2. The locked storyline

**Logline:** The world runs on *tickles* — glowing golden motes of joy. One night the **Hog King** ("the Great Hunger") creeps in and devours them all; the valley goes grey and Rosie is left with nothing.

**Emotional arc — ENDS DOWN (important):** joy → theft → grey → empty world → **the Hunger begins.** This is the *beginning* of the season, so it does **NOT** resolve. Rosie is **never happy or victorious** in the opening — she earns that by playing. It ends on the low: the Hog King triumphant atop his hoard, the valley grey, and a hook ("help win them back"), **not** a celebration.

## 3. Art approach (hard-won — do not re-litigate)

- **Anchor on the game's REAL art, not an invented style.** AI-invented looks (flat sticker, gouache, felt) were all **tried and rejected** by the user.
- **Rosie** is anchored via her **real sprite dragged into ChatGPT** as a fixed character reference: `~/Desktop/ttp-refs/soccer-regen/idle_1.png` (a copy of `assets/images/sprites/rosie/idle_1.png`). Rosie's full expression set lives at `assets/images/sprites/rosie/{idle,happy,tired,surprise,sad,jump,walk}_{1-4}.png`.
- **Backgrounds** are described to match real game scenes: `assets/images/backgrounds/{golden_mire_bg, homestead_barn.jpg, bog_dusk_bg, reed_marsh_bg, sunset_farm}.png`.
- **Style anchor** (in the brief): warm children's-storybook illustration — thick warm dark-brown ink outlines, soft cel shading, chunky rounded proportions, warm cream-gold-and-pastel palette, painterly golden-hour bog/mire backgrounds, glowing golden sparkle-motes = "tickles." Cozy, whimsical, gently comedic. NEVER scary/photoreal. Portrait 9:16.
- **Villain:** no Hog King reference image exists yet. Plan: let **ChatGPT design the boar-hog fresh in Shot 3 and reuse that same hog** in Shots 4 & 7 (self-consistent within one conversation). If a specific Hog King design is chosen later, drag it in on Shot 3 instead.

## 4. The 7 shots

| # | Beat | On-screen text | Rosie (real sprite) | BG (real) | + |
|---|---|---|---|---|---|
| 1 | Valley of tickles | *"Once, the valley glowed gold…"* | — (wide) | `golden_mire_bg` | swarms of gold motes |
| 2 | Rosie asleep | *"…no one loved them more than Rosie."* | tired | `homestead_barn` | shadow creeping in |
| 3 | The Hog King comes | *"But then… the Great Hunger."* | — | `bog_dusk_bg` | **Hog**, moonlit tiptoe |
| 4 | **The theft** (thesis) | *"He ate every last tickle."* | — | `bog_dusk_bg` | **Hog** slurps the motes; barn dims gold→grey |
| 5 | Grey dawn | *"Morning came. The gold was gone."* | surprise→sad | `reed_marsh_bg` (desat) | one pink cheek = last color |
| 6 | The empty valley | *"The tickles were gone. Every last one."* | sad | `golden_mire_bg` greyed | Rosie tiny/alone in drained valley |
| 7 | **The Hunger begins** (ends DOWN) | *"The Great Hunger has begun."* → CTA *"Help win them back."* | sad/tired, small | grey valley + dark hill | **Hog** gloating atop hoard-mountain; NO celebration |

## 5. Generation process (ChatGPT via Claude-in-Chrome connector — the `icon-gen` flow)

- **Executable brief:** `/tmp/gh_chatgpt_brief.md` — has the paste-once `## Style anchor` block + `## Batch 1–7` prompt blocks (already synced to the sad ending).
- **Constraint:** the Chrome connector **cannot upload files** — the user must **drag** the Rosie ref into ChatGPT manually. Downloads ARE automatable (open the generated image → viewer → top-right download button ~1433,27 → saves to `~/Downloads`; verify distinct byte sizes, not filenames).
- **Flow:** user drags Rosie + says "staged" → paste style anchor, wait for "ready" → send Batch 1…7 one at a time, download each as it renders.
- **Rate limit:** ChatGPT free tier caps ~**3–5 images/day**. Expect to split the 7 shots across days; stop on "You've hit the limit for image creation."

## 6. Where we are RIGHT NOW

- **Blocked on one manual step:** a **fresh ChatGPT tab is open** (was `tabId 17019182` this session — tab IDs don't survive sessions, re-fetch via `tabs_context_mcp`) and the `~/Desktop/ttp-refs/soccer-regen/` Finder window is open. Waiting for the user to **drag `idle_1.png` into the composer and say "staged."** Nothing has been generated yet.
- Once staged: paste style anchor → run the 7 batches → download.

## 7. Related in-repo state (context, not blocking the cinematic)

- **Feature flags:** `mud_wars` server flag is **committed + pushed** (migration `20260692000000_feature_flags.sql`: `app_config` table + `profiles.feature_overrides` jsonb + `feature_flags()` RPC; Brian's override = TRUE). A `world_boss` flag key was added to `hooks/useFeatureFlags.tsx` (**uncommitted**; would need a migration seed to exist server-side).
- **In-app intro:** `components/GreatHungerIntroModal.tsx` (uncommitted) — 5-beat animated storybook, currently placeholder art (`assets/images/pig.png` tinted + bog backgrounds); gated on `world_boss` flag; dev-preview chip wired in `app/(tabs)/season.tsx` (uncommitted). This is where the real generated shot art / hog art will eventually land.
- **Storyboard doc:** `docs/wiki/outputs/memos/great-hog-storyboard-v2-2026-07.md` (the authoritative board; v1 superseded).
- **Uncommitted wiki memos** from the Season-2 planning arc: `world-boss-the-great-hunger-2026-07.md`, `mudwar-*-2026-07.md`, `great-hog-opening-storyboard-2026-07.md` (v1).

## 8. Definition of done

7 shots generated in the game's storybook style with a consistent Rosie + consistent Hog, downloaded and assembled into the ~30s opening (as a marketing piece and/or feeding `GreatHungerIntroModal`'s per-beat art), ending on the down/ominous "the Hunger begins" beat with the CTA to fight back.

## 9. Constraints to respect

- DB pushes require an explicit user "go."
- Never emojis in UI (use ChatGPT art / `Glyph` / `Icon`).
- Always show generated images to the user (SendUserFile).
- Build locally (`eas build --local`).
