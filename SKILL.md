---
name: tickle-the-pig
description: "The product charter for Tickle the Pig. Consult before any product, design, content, or economy decision and weigh the choice against the pillars and the lens. A living document — append important decisions to the log. Rewritten 2026-07-07 to match the game as it actually is; the previous charter and its decision log are preserved in git history."
---

# Tickle the Pig — what we're building, and what we believe

## North Star

**Tickle the Pig connects friends into herds, gives them things to collect, and gives the herd a race to run — together.**

Connect · Collect · Contend. One sentence; everything serves it. When a choice doesn't, we change the choice — not the sentence.

## The three pillars

- **Connect friends.** The game is a reason to reach out. Visiting a friend's Barn, blessing them, digging the same feeding, rallying the herd before Thursday's bell — a feature earns its place when it gives one player a warm reason to think about another. Rivalry counts: "we're two finds behind" is a text message.
- **Collect things.** Cosmetics, titles, truffles, a happy pig. Everything with status attached is **earned through play, never bought** — money buys expression, never advantage or accomplishment. Collecting is self-expression and proof you were there.
- **Contend as a herd.** The competitive unit is the Sounder, never the lone pig against a friend's pig. The season board accumulates — every find counts forever *within the season* — and resets when the world's story does; the weekly spoils race keeps every Monday winnable by anyone. No standing outlives a season. Competition exists to make cooperation urgent — you dig *together* or you place nowhere.

## The decision lens

Before building anything, answer:

1. **Which pillar does this serve?** If none, push back before writing code.
2. **Can a player hold it in one sentence?** If the mechanic needs two explanations, it's wrong — cut layers until the sentence survives. (This lens killed the fronts board, the mud unit, the fixture league, and the 1-v-1 duel. It will kill again.)
3. **Is it fair by construction?** Scoring per digging snout, participation-gated rewards, server-side minting, quorums that make ghost rosters self-defeating. Fairness added afterward is a patch; fairness by construction is a design.
4. **Does losing still feel warm?** Losers keep everything they earned; sleeping pigs never drag their herd down; sub-quorum herds are nudged, never named and shamed; there is no decline button, no public zero, no ladder to fall down.
5. **Can the reward pipeline actually sustain it?** A reward cadence the art pipeline can't feed becomes a broken promise on a schedule. Queues with graceful fallbacks, or don't ship it.

## What we believe

- **Legibility beats depth.** A week of design taught us this the expensive way: five clever layers compound into noise. One legible loop, then earn each addition.
- **Competition is social fuel, not a hierarchy.** Twice a week every herd runs the same race; Monday it's forgotten. Rankings live on their own card — never on Rosie, never on the Barn.
- **Earned over bought.** Titles, milestones, podium art: play only. The economy's mints are closed, audited, and server-side.
- **The world responds now, and speaks in pictures.** The Hungerer weakens visibly; moods are sprites; a find names itself the moment it surfaces. Numbers are honest and small — a find is a find, not a thousand of anything.
- **Rendezvous over grind.** 8-hour feedings, three-day races, notification-based moments ("the race is run") — the game calls you at human intervals and never punishes the hours between.
- **Craft is belief.** No emoji in UI; technical names in code, cozy names on screen; tokens over inline values; footguns get comments.

## Anti-patterns we refuse

- Mechanics that need explaining twice — to a player *or to their own designer*.
- Standings that outlive a season; weekly rewards a herd can't win by simply showing up strong this week.
- Shame states: drag-down averages, public zeros, rejection buttons, "your herd let you down" framing.
- Pay-to-win in any costume; status you can buy; reward faucets without sinks.
- Reward cadences that outrun the art pipeline.
- Scoring chains more than two nouns long (the cautionary tale: dig → mud → rope → fixture → ribbons).

## How to use this document

- **Every session, reflect.** Hold each proposed change against the North Star and the lens *before* building it.
- **Append important product, design, content, or economy decisions to the log below** — what we chose and which pillar it serves. Dated, newest-first, short.
- The pre-2026-07-07 charter and its decision log (Seasons 0–1 archaeology: alignment, Judgement Day, mud wars, the league, the co-op teardown, the duel) live in git history and on the `archive/sounder-league-2026-07-06` branch.

## Decision log

> Each entry: date — the decision — which pillar(s) it serves and why.

- **2026-07-13 — The Season-1 finale reward is title + exclusive cosmetic for every digger with ≥10 finds.** When the herd starves the Great Hungerer to Famished (or the season ends, whichever comes first — the grant is fired manually by the admin), every player whose Season-1 credited finds ≥ 10 receives the Hungerer's Crown (an exclusive hat, taken as a trophy — the lore already says "Hungry, his crown sits crooked", so at Famished the herd takes it) + the "Starver of the Hunger" title. Serves **Contend** — it's "I was there" prestige for the whole season-long co-op grind, earned-only (participation-gated at ≥10 finds), and mints zero currency so it can't inflate the economy. Grant RPC `grant_season1_finale()` is SECURITY DEFINER, revoked from authenticated (service-role/SQL-console only — dodges the `admin_only`-RAISE silent-rollback footgun), idempotent, and inlines its own `system_announcements` INSERT. Migration `20260739100000_season1_finale_reward.sql` (authored, unpushed).

- **2026-07-11 — Redemption codes ("Golden Tickets") grant, never sell.** Event/booth QR codes redeem to a hat, golden truffles, or snouts through one server RPC (`redeem_code`) — `max_uses` + per-user-once (`redemption_claims` PK) + ~39-bit Crockford-coded entropy + RLS-with-zero-policies (clients can never enumerate the codes table), all guards server-side. Truffles ride the existing `mint_truffles` ledger (999-cap-clamped, `war_truffles` audit row); snouts use the bounty `counter` idiom; hats reuse the `user_hats` grant. One legible loop: scan-or-type → named reveal → done (no inventory, no multi-grant bundles). Serves **Collect** (fair-by-construction: server-side, ledgered, per-user-once, cap-respecting, refusal-enveloped) — status stays earned/gifted, never bought. Migration `20260732000000_qr_redemption.sql` (authored, unpushed).

- **2026-07-11 — The season-flip login liturgy is canonical: old business → thank-you → new story → what you missed → the one ask → (next session) housekeeping.** Concretely, by popup-queue priority: Schism/Judgement verdicts (if pending) → Season-End recap + Founding Herd gift → **Great Hunger intro (newly queue-integrated at ~27, on the main page — it was a raw Modal that could co-present over the recap)** → While-Away → Sounder nudge; achievements + release notes are suppressed on any login where a ceremony fired and surface next session. Serves legibility ("one moment at a time") + Connect (the Sounder ask lands right after the story explains why herds exist). Ceremony beats housekeeping.

- **2026-07-11 — The Truffle Patch becomes a full fossil-dig loop: choose-what-you-get boards, UNIQUES, and the Burrow Book.** Founder session decisions: (1) **boards are no longer fully clearable** — depth tuned so ~60–70% of the mud is diggable per session; every dig is a choice, every session usually leaves a story behind. (2) **Uniques** — a Season 1 pool of 10–12 one-tile relics; the server rolls whether a board carries one (~2 in 5) and which (rarity-weighted); silhouettes are deliberately mysterious (no telling truffle from unique until you commit). First catch lights the relic's entry in **the Burrow Book** (a Pokédex-style collection page); dupes bump a found-count and pay extra meter drain. Set completion will pay the season's one dig-exclusive cosmetic. (3) **The One That Got Away** (next pass): a half-dug find returns gilded — presence grows on the board, value grows as catalog tier, never as minted currency (kills the leave-one-behind farming exploit); personal first, then single-object crew echo (a miss is ONE object that hops patches — never duplicated, never silently consumed). Shards rejected (currency in costume, gacha-adjacent, redundant with the Exchange); motes stay ambient plumbing. Serves **Collect** (the Book is proof-you-were-there, earned only) + **Contend** (uniques drain the meter; choice pressure makes the co-op dig matter) + **Connect** (crew echo, later). Art: uniques sprites via the new Codex/ImageGen pipeline.

- **2026-07-07 (night) — Rankings go season-cumulative with weekly spoils; the season tab's Sounder section collapses to one card.** Founder call after seeing the shipped sprint: the headline board is **total herd finds, accumulating all season** (every find counts forever, resets with the season) with the pinned-row UI; the **weekly race** (now Monday-anchored, 7 days — was Mon/Thu) survives underneath as the spoils engine — per-snout + quorum keeps Mondays fair and winnable by small herds, paying the truffle table + podium art. UI: the stepper, herd-presence card, and milestones card merge into **one Sounder card** — your actual pigs (presence lit on the roster), the dig button with the live cooldown, a one-line milestone strip — with the game's explanation moving into the season guide dialog (and "leave your Sounder" tucked there too). Serves **Connect** (the card is literally your herd's faces) + **Contend** (one number that always grows — the cozy read of ranking — plus a weekly beat anyone can take) + legibility (three stacked cards become one; explanation on demand, not furniture). Amends the charter's sprint language: accumulation within a season is in; standings never outlive one. Migration `20260720000000_weekly_race_season_board.sql`.

- **2026-07-07 — Charter rewritten to match the shipped game; the old charter + log retired to git history.** As of tonight the game is: the cozy core (Rosie, barn, friends, blessings, trades, visits) + Season 1's Great Hunger arc (crew-gated Truffle Patch digs every 8h feeding; finds mint Golden Truffles, drain the Hungerer, and build herd milestones) + **the Dig-Off Race** (every Sounder vs every Sounder, Mon/Thu cycles, finds-per-digging-snout, quorum 2, rank-scaled truffle spoils + podium art, pinned-row standings, push-driven) + the earn-only economy (Exchange, pass, achievements, titles). Specs: `docs/season1-coop-dig-spec.md`, `docs/digoff-race-spec.md`. Open gate: `race_podium_queue` needs its first art batch before real players hit a race end.

- **2026-07-13 — Leaving a Sounder never claws back what you dug for it.** A departed member's finds stay in the crew's weekly tally, lifetime count, milestones, and quorum (removing them would shrink the herd's earnings through no fault of its own — the no-shame rule). The *ledger* tells the membership truth instead: departed diggers' rows stay (the finds are real) but dimmed, sorted after current members, captioned "trotted on" — a pig never *appears* to be in two Sounders. Digs made after joining a new crew belong to the new crew. Serves **Connect** (leaving is safe, herds keep their story) and **Contend** (tallies stay honest). Live case: sivleg's 4 finds for The Truffle Barons after moving to The Bramble Snouts. **The one downside of leaving (confirmed, by design): you forfeit your claim to that crew's Monday spoils** — `_race_pay_cycle` pays current members only, and only those who dug for that crew this cycle, so leavers lose the credit and Sunday-night joiners can't freeload. Everything personal (XP, titles, finale finds) travels with the pig. `20260739200000_race_ledger_departed.sql`.
