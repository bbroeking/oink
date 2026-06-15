---
title: Wiki Topics / Taxonomy
type: meta
last_compiled: 2026-06-13
---

# Topics — How TTP's Systems Nest

The LLM-maintained taxonomy. Where [[_index]] is a flat catalog by category,
this file shows how the systems **stack and depend on each other**: which
mechanics feed which, where a player-facing surface sits on top of an internal
engine, and which "pick-a-side" systems share a spine.

## The organizing spine: the identity model (SOUL / TRIBE / BANNER)

TTP grew four overlapping "pick a side" systems in separate design sessions —
[[alignment]], [[world-cup-allegiance]], the [[referral-program]] downline, and
the [[sounder-mud-fights]] crew — and the word "Sounder" ended up naming three
of them at once. The proposed reconciliation, the **[[identity-model]]**, is the
backbone this taxonomy hangs on:

- **SOUL** — permanent moral axis = [[alignment]] (Goblin ◄──► Angel). One pig, one aura.
- **TRIBE** — a durable crew you belong to = the [[sounder-mud-fights]] "Sounder".
- **BANNER** — a disposable, time-boxed flag you fly = events like [[world-cup-allegiance]] (the first "Rivalry-0" frame).
- The **[[friends-graph]]** ("Friends") and the [[referral-program]] downline ("Drove") are the social plumbing *underneath* the spine, not factions on it.

See [[_glossary]] for the term-level disambiguation and the
[Future Direction memo](outputs/memos/future-direction-2026-06.md) for why the
collision matters before any new social surface ships.

## Core Loop & Economy

The engine every other system multiplies into. The loop is: tap → bank tickles →
spend on cosmetics; everything else bends the regen rate or adds a faucet.

- [[core-loop-and-tickle-trade]] — the root loop (tap Rosie → tickles → snouts) and the Tickle Trade that turns it social.
  - [[regen]] — the rate engine the whole loop runs on; `regen_secs_for(uid)` is the multiplier sink.
    - [[happiness-and-mood]] — a care-state multiplier into regen; **Mood** is its only readout (idle sprite, never a number).
    - [[streak-and-garden]] — a loyalty multiplier into regen; the **Garden** is its (currently headless) readout.
    - [[alignment]] — a linear regen factor *and* the season's SOUL axis (also under Season & Competitive).
    - [[blessings-curses-effects]] — timed regen buffs/debuffs landing as effects (also under Social).
  - [[lucky-pig]] — a rare bonus window bolted onto the tap loop; can drop folklore titles.
- [[barn-and-habitat]] — the home-screen orchestrator (`Barn.tsx` + 5 hooks) that *renders* the loop; the unbuilt Exterior/Interior/Habitat split is the decoration layer on top.

## Social

The friend-to-friend layer. All of it gates on the mutual-consent graph.

- [[friends-graph]] — the consent graph (who you can act on); foundation for everything below.
  - [[blessings-curses-effects]] — friend-to-friend rituals (sender side) → active effects / "Hoofprints" (receiver side).
  - [[barn-visiting]] — going to a friend's Barn to tickle their pig *for* them (giving, not earning).
  - [[trough]] — communal gift fund: pool snouts to grant a friend a Shop item.
  - [[referral-program]] — the invite/downline ("Drove") that *grows* the graph; dark-launched.

## Cosmetics & Progression

The sink the whole economy points at, plus the reward catalog that feeds it.

- [[shop-cosmetics-closet]] — the daily snout shop + the typed-slot Closet that dresses Rosie; the one real currency sink.
  - [[achievements-and-titles]] — the threshold catalog that auto-grants snouts/hats/titles; titles are the cross-system reward currency (folklore, finale, referral, event, achievement sources all mint into one owned set).

## Season & Competitive

The time-boxed layer that gives the cozy loop stakes — and the spine of the identity model.

- [[alignment]] (SOUL) — the season-long reputation score.
  - [[seasons-and-judgement-day]] — the finale that ranks + rewards + **wipes** alignment; live `pg_cron` job, July 15.
- [[sounder-mud-fights]] (TRIBE) — the optional clan-war season; buff-free, reset-to-zero, dark-launched.
- [[world-cup-allegiance]] (BANNER) — the reusable time-boxed event/Rivalry frame; no real payoff yet.

## Monetization & Economy

The currency rails and the (kill-switched) products that ride them.

- [[snouts-economy]] — the single soft currency (`profiles.counter`): many faucets, one sink; leaderboard rank is the separate `tickles_earned` axis.
  - [[battle-pass-and-slop-club]] — the two IAP products (Season Pass + Slop Club subscription) layered on top of the currency; both currently off.

## Infrastructure

The delivery + decoupling layer beneath every feature.

- [[architecture-seams]] — the load-bearing boundaries (RPC layer, effects layer, friendships, Barn orchestrator, IAP adapters, rarity tokens) + the recurring SQL footguns.
  - [[notifications]] — Postgres→pg_net→Expo/APNs pushes, with `system_announcements` as the persistent backstop (surfaced via the WhileAway modal).

## Design & Strategy

- [[design-system]] — the WHIMSY token system + Sticker primitive that every screen above is (supposed to be) built from. See the [UI Layout Audit](outputs/memos/ui-layout-audit-2026-06.md) for the application-drift findings.
- [[virality-and-growth-loops]] — the cross-cutting growth model: how the systems above combine into acquisition + retention. Audits which viral pattern each existing system already instances ([[referral-program]] = incentivized loop, [[barn-visiting]] = two-sided/casual-contact, [[trough]] = gifting, [[achievements-and-titles]] = flex, [[alignment]]+[[seasons-and-judgement-day]] = the unexploited "verdict" identity-artifact engine) and names the prioritized future bets. Distilled from the [Viral Games Research](outputs/memos/viral-games-research-2026-06.md) memo; the outward companion to the inward [Future Direction](outputs/memos/future-direction-2026-06.md) sequencing thesis.
- [[onboarding-and-guidance]] — the *entry* into the funnel: how a new player learns the surface above. Sits upstream of [[virality-and-growth-loops]] (onboarding = top of the retention funnel) and reuses [[achievements-and-titles]] (rewarded milestones via `try_claim_achievements`) + the [[architecture-seams|PopupQueue]] presentation backbone. Build spec: `docs/onboarding-first-week-checklist-spec.md`.
