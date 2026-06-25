---
name: tickle-the-pig
description: "The North Star and product charter for Tickle the Pig. Consult before any product, design, content, or economy decision and weigh the choice against the three pillars. A living document — append important decisions to the log as we make them."
---

# Tickle the Pig — what we're building, and what we believe

## North Star

**Tickle the Pig is a fun game that connects friends, gives them things to collect, and gives them reasons to work together.**

Connect · Collect · Cooperate. One sentence; everything serves it. When a choice doesn't, we change the choice — not the sentence.

## The three pillars

- **Connect friends.** The game is a reason to reach out. Visiting a friend's Barn, blessing them, tickling their pig, noticing their mood — these are the heart. A feature earns its place when it gives one player a warm reason to think about another.
- **Collect things.** Cosmetics, titles, habitat décor, a happy pig, a growing garden. Collecting should feel like *accomplishment and self-expression*, never a slot-machine or a grind wall. What you own says who you are and how you've played.
- **Work together.** Trades, mutual visits, seasons, your Sounder. The best moments leave two players better off than one. Cooperation beats competition; we reward showing up *for each other*.

## The decision lens

Before building anything, answer:

1. **Which pillar does this serve?** If it serves none of Connect / Collect / Cooperate, push back before writing code.
2. **Is it cozy, not grindy?** Warmth over pressure — a daily ritual, not a daily chore. No feature should make a player feel *behind*.
3. **Does it respect the player?** No dark patterns, no manufactured FOMO that punishes, no pay-to-win, no shame mechanics. Generosity should feel good and *be* good.
4. **Is it honest about feelings?** The pig is a companion, not a dashboard. Show state through Rosie and the world (mood = her sprite, streak = the garden) — never a raw number or meter.
5. **Does it keep the social loop fair?** Anti-exploit work isn't punitive — it protects the ritual so connection stays meaningful for everyone.

If a change can't answer #1 and survive #2–#5, it isn't ready.

## What we believe

- **Cozy beats competitive.** We'd rather a player feel *invited* than *ranked*.
- **Earned over bought.** Identity and status — titles, achievements, mastery — are earned through play and friendship, not purchased. Money buys *expression* (cosmetics), never advantage or accomplishment.
- **The pig has feelings, and they're shown, not stated.** Mood, garden, aura. Numbers are the heart-counter's job; everything emotional is visual.
- **Generosity is the core economy.** Showing up — and showing up for friends — is what the game rewards.
- **Small, warm, daily.** A few delightful minutes that make you smile and maybe text a friend — not a session that demands an hour.
- **Craft is part of the belief.** No emoji in UI (use art / Glyph / Icon). Technical names in code, cozy names in the UI. The world should feel alive and respond *now* — a cleansed curse vanishes immediately, not on next launch.

## Anti-patterns we refuse

- Grind walls, energy-timers-as-monetization, pay-to-win, loot-box dark patterns.
- Leaderboards or mechanics that shame or punish absence.
- Features that isolate a player instead of pointing them at a friend.
- Showing a feeling as a number when Rosie or the world could show it instead.

## How to use this document

- **Every session, reflect.** Hold each proposed change against the North Star and the lens above *before* building it.
- **When we make an important product, design, content, or economy decision, append it to the log below** — what we chose and *how it serves the three pillars*. This is how the charter grows and stays honest. Keep entries dated, newest-first, and short.

## Decision log

> Each entry: date — the decision — which pillar(s) it serves and why.

- **2026-06-25 — Subscriptions are cosmetic/convenience, never pay-to-win.** Removed the VIP 2× tickle regen — everyone regenerates at the same rate now. The VIP perk is the larger tickle-bank *cap* only (50 vs 25), which with equal regen is a reserve/convenience, not a power edge (total earning rate is regen-gated for all). Slop Club value = expression (cosmetics, drops, a VIP battle pass) + convenience, never advantage. Serves *Collect* + the "earned over bought / no pay-to-win" belief.
- **2026-06-25 — Barn visits: the 3-hour per-friend cooldown starts at the VISIT (first tap), and leaving forfeits any unused taps.** A random 3–7 cap rolls per visit; you spend it in that sitting, and once you visit you can't return for 3h. **Supersedes** the earlier 20260676 model ("leaving never forfeits; cooldown anchored to the cap-hitting tap") — the stricter "one visit per 3h" reads as a more intentional, valued ritual than an open-ended tap budget. Serves *Connect* + *Cooperate*: a real, repeatable little ritual, not a farmable grind. No daily cap (the per-friend gate is the ceiling).
- **2026-06-25 — Titles are earned, never bought (shipped in build 101).** The shop Titles tab is gone; all 10 titles now drop from achievements spanning the three pillars — a new **Devotion** ladder (lifetime tickling), generosity (trades/blessings), and mischief (curses/lucky). Prior buyers keep theirs (no refund). Serves *Collect*: status should mean *you did something*, not *you paid* — money buys expression (cosmetics), never accomplishment. We also added a **"ready to claim" badge** on the Achievements entry so players can *see* when they've earned something — the joy of collecting only lands if you know there's something to claim.
- **2026-06-25 — Curse cleanse and friend-request decline now resolve instantly and correctly in-app.** Serves *Connect* + craft: the social world should feel alive and respond now; the friend graph must work in both directions (accept *and* decline) for healthy boundaries.
