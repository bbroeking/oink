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

- **2026-07-04 — Battle-pass cosmetics are earn-only, enforced structurally, and this is now audited every season.** The Season 2 pass ("The Great Hunger") is seeded from the 25 Mud Wars War Spoils cosmetics + new S2 titles + tickle bundles (30 tiers, free/premium), dark-launched with a Jul-12 start so it appears exactly when S2 flips. Pass rewards must never be shop-buyable — but an audit found 13 Season-1 pass cosmetics (backgrounds/auras like `forest_grove`, `pink_glow`, `sunset_farm`) were *both* pass rewards and priced in the daily shop, because the `pass_exclusive` sync trigger (20260675) only watched `reward_type='hat'` and every other cosmetic type slipped through. We broadened the trigger to flag whatever hat a tier actually *grants* (the same `COALESCE(hat_id, bg_id, aura_id, …)` the claim path uses), so exclusivity is self-maintaining for all future seasons and the leak is closed retroactively. Scope note: "exclusive" means *not sold in the shop* — War Spoils stay obtainable in the Truffle Exchange (which gates on `war_exclusive`, not `pass_exclusive`). Serves **Collect** ("status/expression is earned, not bought" — the same belief as titles-are-earned and no-pay-to-win) + **Cooperate** (the pass rewards the collective Mud Wars economy). Migrations: `20260706000000_pass_exclusive_all_cosmetics.sql`, `20260706100000_season2_battle_pass.sql`.

- **2026-07-03 — The Truffle Patch is Season 2's heartbeat minigame; Golden Truffles are the war economy.** A playable-mock bake-off (three browser prototypes, hosted unlisted at ticklethepig.com/labs/*) crowned the Pokémon-mining-wall-style **Truffle Patch**: every 8 hours the Hungerer gorges at his trough — distracted — and each pig gets one chill scratch-to-dig session (rub quiet / snout-shove loud against a cozy "stir" meter; no fail state, everything uncovered is kept). Single-player and additive: clanmates who dig in the same feeding gild each other's truffles retroactively; dug truffles are kept as **Golden Truffles**, the war-only currency that replaces `resolve_war`'s raw-snout mint (closing the open economy wall) and prices a rotating Truffle Exchange of war exclusives. The war reads as *"who rooted better and grabbed more back from the Hungerer"* — winners take the rope, losers keep their carve plus a consolation drop, and ALL effort drains his season-wide energy meter (Gorged→Famished, Judgement-Day finale). Serves **Cooperate** (sync-additive digging; the duel is narratively collective) + **Collect** (a real war economy, never buyable with money or snouts) + **Connect** (feeding-window rendezvous with named crew echoes). Corpus: `docs/wiki/outputs/memos/mudwar-{hunger-arc-cadence,dig-minigame,rewards-spec,progress-views}-2026-07.md`.
- **2026-07-02 — Season 2 is "The Great Hungerer": the Mud Fights become the collective weapon against a co-op world-boss.** The season antagonist is the **Great Hungerer**, an enormous gluttonous **Hog** — a dark mirror of Rosie (not the earlier Goblin-King framing) — who hoards the world's truffles and joy. The **Sounder Mud Fights (crews, cap 5) are woven into the boss fight**: every clan-vs-clan war *also* drains the Hungerer's shared server-wide HP, so the whole barnyard bands together to beat him; the top-contributing clan gets a bonus trophy, but **no clan "loses."** His motivation is **loneliness** — he was once a beloved, tickled pig who forgot how to *feel* joy, so he *consumes* it instead; the **end-of-season reveal is that he was never bad, only starving to belong**, and the cure is being tickled back into the sounder. Serves **Cooperate** (the war reframed as collective kindness — everyone-with-everyone, not zero-sum) + **Connect** (the antidote to the villain *is* friendship + the game's core verb), and stays **cozy-not-punishing** (menacing in fiction, gentle in mechanics: mild self-easing blight, no failure state, gift-framed rewards). Minions ("Hungerlings") to be art-tested in both hog and goblin variants; all art grounded in the existing Rosie kawaii-sticker aesthetic. Supersedes the two-separate-systems framing in `docs/wiki/outputs/memos/world-boss-the-great-hunger-2026-07.md` (Mud Wars + boss are now one woven season).
- **2026-06-26 — Barn visits, made dead-simple: one tickle per friend, 3 friends per window, each friend once a day.** Three rules a player can hold in their head: (1) a visit = **one tickle** (you both get leaderboard credit); (2) you get **3 visits, which all refresh together 3 hours after your *first* one** (anchored, not rolling — using only 1 or 2 still refreshes all 3 at first+3h); (3) **24h pairwise cooldown** (each friend once a day). **Supersedes** the 2026-06-25 entry below and the earlier same-day drafts; fixes a live leaderboard exploit (20260676 dropped the per-visitor daily cap claiming "the per-friend gate is the ceiling," but that only bounds *one* friend — with many friends, tickles scaled with friend count: "I get way more tickles than Jen"). We deliberately dropped the random 3–7 multi-tap and "leaving forfeits" because they were the confusing parts — a player asked us to make it *not confusing*, and we surface the three rules in-app (the visit screen's "VISITS LEFT" bar + a plain "3 friends every 3 hours · each friend once a day" caption). Serves *Connect* + *Cooperate* (visit lots of different friends, lightly, over a day) and *Cozy-beats-competitive* (no friend-count farming, no fiddly tap-budget).
- **2026-06-26 — Referrals earn a free month of Slop Club (5 completed referrals → 30 days of membership).** The reward is *granted* server-side via `is_vip` + a separate `slop_club_grant_until` expiry (not an IAP discount) — bringing five friends who genuinely play (the existing 100-tickle / 3-day gate) comps you the membership. Serves *Connect* + *Cooperate* + "generosity is the core economy": you earn premium by growing the world for others, never by paying. We chose granting membership *time* over an App Store offer-code discount precisely because "invite friends, you both get Slop Club" is warmer and more on-brand than nudging a friend to pay (even at a discount).
- **2026-06-25 — Subscriptions are cosmetic/convenience, never pay-to-win.** Removed the VIP 2× tickle regen — everyone regenerates at the same rate now. The VIP perk is the larger tickle-bank *cap* only (50 vs 25), which with equal regen is a reserve/convenience, not a power edge (total earning rate is regen-gated for all). Slop Club value = expression (cosmetics, drops, a VIP battle pass) + convenience, never advantage. Serves *Collect* + the "earned over bought / no pay-to-win" belief.
- **2026-06-25 — Barn visits: the 3-hour per-friend cooldown starts at the VISIT (first tap), and leaving forfeits any unused taps.** A random 3–7 cap rolls per visit; you spend it in that sitting, and once you visit you can't return for 3h. **Supersedes** the earlier 20260676 model ("leaving never forfeits; cooldown anchored to the cap-hitting tap") — the stricter "one visit per 3h" reads as a more intentional, valued ritual than an open-ended tap budget. Serves *Connect* + *Cooperate*: a real, repeatable little ritual, not a farmable grind. No daily cap (the per-friend gate is the ceiling).
- **2026-06-25 — Titles are earned, never bought (shipped in build 101).** The shop Titles tab is gone; all 10 titles now drop from achievements spanning the three pillars — a new **Devotion** ladder (lifetime tickling), generosity (trades/blessings), and mischief (curses/lucky). Prior buyers keep theirs (no refund). Serves *Collect*: status should mean *you did something*, not *you paid* — money buys expression (cosmetics), never accomplishment. We also added a **"ready to claim" badge** on the Achievements entry so players can *see* when they've earned something — the joy of collecting only lands if you know there's something to claim.
- **2026-06-25 — Curse cleanse and friend-request decline now resolve instantly and correctly in-app.** Serves *Connect* + craft: the social world should feel alive and respond now; the friend graph must work in both directions (accept *and* decline) for healthy boundaries.
