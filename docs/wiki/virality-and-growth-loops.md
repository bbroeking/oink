---
title: Virality & Growth Loops
aliases: [virality, growth, viral loops, k-factor, future-vision, growth-model]
tags: [strategy, growth, design, future]
status: draft
sources:
  - memo: outputs/memos/viral-games-research-2026-06.md
  - memo: outputs/memos/future-direction-2026-06.md
  - doc: CONTEXT.md
  - code: utils/referrals.ts
  - code: components/BarnVisitModal.tsx
last_compiled: 2026-06-14
---

# Virality & Growth Loops

TTP's growth model — **how a cozy single-player pig game spreads person-to-person** — and the prioritized future-vision bets that follow from it. Grounded in the external research filed in [[viral-games-research-2026-06]] and mapped onto TTP's actual (mostly already-built) systems. This is the *outward* companion to the *inward* sequencing thesis in [[future-direction-2026-06]].

## The core thesis

**Seal the retention bucket first; then ship the viral artifact.** Two facts from the research set the whole strategy:

1. **At ~27 players, virality is a CAC-subsidizer, not exponential salvation.** A cozy tapper will land a viral coefficient well under 1 (realistically 0.1–0.3); its value is the `1/(1−k)` multiplier on installs you already get, not free exponential growth. The unblock-the-App-Store-listing work in [[future-direction-2026-06]] is therefore the precondition for *any* of this mattering.
2. **Retention causes virality** (the leaky bucket). A retained player gets ~30 invite/share chances a month; a churned one gets one. Growth comes *out of* retention work — so TTP's biggest growth lever right now is making its **already-built but invisible** retention primitives ([[streak-and-garden]], [[happiness-and-mood]]) perceivable, not inventing new viral mechanics.

The happy accident: TTP's [[alignment]] + [[seasons-and-judgement-day]] axis is an unexploited, ready-made **"verdict" engine** — exactly the Wordle-grid / Spotify-Wrapped *shareable-identity-artifact* shape that is the most copyable growth pattern of the last five years.

## TTP's existing viral surface (audit)

TTP has, mostly already in code, one instance of nearly every viral pattern in the research — they are just unlaunched, invisible, or unconnected:

| Research pattern | TTP system | State |
|---|---|---|
| Incentivized referral loop | [[referral-program]] (the Drove) — both-sided +50/+100, engagement-gated | Built, **dark** (`SOUNDER_VISIBLE=false`), blocked on App Store launch |
| Two-sided visiting (cozy "needs-a-group") | [[barn-visiting]] — tap a friend's pig, mutual gain | Built; visitor payout **just restored** (`20260648`, see risks) |
| Gifting / reciprocity | [[trough]] — communal gift fund | Built |
| Flex / status / collection-showoff | [[shop-cosmetics-closet]] + [[achievements-and-titles]] | Built |
| Disposable banner / event allegiance | [[world-cup-allegiance]] | Built; no finale payoff yet |
| Community meta-goal (warm) | [[sounder-mud-fights]] (TRIBE) | Built, dark; competitive not cozy |
| Shareable identity artifact | [[alignment]] + [[seasons-and-judgement-day]] verdict | **Not built** — the biggest gap + biggest opportunity |
| Streak / daily habit (retention base) | [[streak-and-garden]] | Multiplier built, Garden visual **headless/invisible** |
| Synchronized daily moment | the tap loop ([[core-loop-and-tickle-trade]]) | Loop exists; no *shared* daily beat |
| Out-of-app share plumbing | — | **Not built** (no share card, App Clip, or deferred deep links) |

## Areas to explore (the prioritized future-vision bets)

Ordered by the research's "retention base before viral artifact" rule.

### 1. Make the streak visible — ship the Garden + a streak freeze *(retention base)*
The single highest-leverage move. Duolingo's 2.4× retention lift depends on the streak being a *visible possession* — loss aversion can't fire on an invisible number. Ship the 5-stage [[streak-and-garden]] Garden as the readout, with **wilt-on-break** as the loss-aversion trigger and **two free "mud-wallow" freezes for new players** (Duolingo's exact first-7-days scaffold). *Maps to a system that is designed and just needs to ship.*

### 2. One gentle daily appointment push *(retention base)*
Use the existing [[notifications]] plumbing for a single cozy daily nudge tied to a real state ("Rosie hasn't been tickled today — your Garden will wilt soon"). **Permission-prime after the first satisfying session, never at onboarding.** One daily beat max — over-pushing churns cozy audiences fastest.

### 3. Two-sided visiting → self-propagating *(the cozy viral engine)*
[[barn-visiting]] is TTP's Hay-Day/Pocket-Camp "needs-a-group" surface and its casual-contact viral surface (friends *see* each other's dressed-up pigs → "I want that hat"). Now that both visitor and host are rewarded (`20260648`), deepen it: a daily "leave a gift" both-sided action and an explicit gift-back/reciprocity prompt ("Jen visited Rosie — visit back?"). Keep it alive with **1–2 friends** (Chen's density rule).

### 4. The shareable identity artifact — TTP's "Spotify Wrapped" *(the viral artifact)*
The headline opportunity. At the [[seasons-and-judgement-day]] finale, auto-generate a **Judgement Day Verdict Card**: the pig in its current cosmetics, its Saint↔Sinner [[alignment]] score, a one-line persona/title ("Patron Saint of Mud"), top stats, a percentile ("top 4% most viruous"), a watermark + deep link. It hits all seven artifact properties — spoiler-free, identity-signaling, templated, comparable (everyone judged the same day → calendar moment + FOMO), branded-with-a-link, recurring. **Daily counterpart:** a Wordle-grid-style "alignment streak strip" (😇/😈/🟫/🍂 per day) people paste into iMessage. The cosmetics + titles are what make every card *different* and worth posting.

### 5. Collapse install friction for the referral stack *(amplifier)*
The [[referral-program]] is fully built but every shared invite currently dead-ends at a high-friction TestFlight/App-Store install. Add an **App Clip** (let a friend tap *your* pig from a shared link with **no install**) + **deferred deep links via an MMP** (Branch/AppsFlyer — iOS severs the web→install link; ~4× conversion). This shortens *cycle time*, which the research says compounds faster than raising k. Don't ship a bare in-app "Share" button — ~99.8% of users ignore them; ship the *artifact* (bet 4) and make posting it one tap.

### 6. A gentle cozy community meta-goal *(later)*
A small server-wide cozy goal ("the village dug 1M truffles this week → everyone unlocks a cosmetic") borrows Helldivers' meta-goal warmth without combat. **Caveat:** keep it genuinely cumulative and transparent — Helldivers' "Menkent" backlash showed players revolt the moment a meta-goal feels pre-scripted.

## The flywheel

How the bets compound (even with k < 1): **a visible streak (1) + a daily push (2)** seal the retention bucket → long lifetimes → many invite/share cycles per player. **Two-sided visiting (3)** turns the friends graph into mutual-obligation retention *and* a casual-contact viral surface. **The Verdict Card / daily strip (4)** is the periodic, near-zero-CAC organic-distribution artifact. **App Clips + deep links (5)** shorten the loop so each share converts faster. Retention lengthens lifetime → lifetime sums more viral contributions → friends *are* the retention hook for existing users → lifetime lengthens again.

## Connects to

- [[viral-games-research-2026-06]] — the sourced external research this page distills.
- [[future-direction-2026-06]] — the inward sequencing thesis; bet 1/2/4 here are the growth half of its "make loyalty perceivable" + "unblock before depth" arguments.
- [[streak-and-garden]], [[happiness-and-mood]] — the retention primitives to make visible (bets 1–2).
- [[barn-visiting]], [[referral-program]], [[trough]] — the social/acquisition surfaces (bets 3, 5).
- [[alignment]], [[seasons-and-judgement-day]] — the verdict engine behind the identity artifact (bet 4).
- [[achievements-and-titles]], [[shop-cosmetics-closet]] — the cosmetics/titles that make the artifact worth sharing.
- [[snouts-economy]] — any new visitor/referral/meta-goal payout is a faucet to model against the no-sink risk.

## Open questions / risks

- **status: draft** — a strategy/vision page, not a shipped system. Each bet needs its own spec before build.
- **Retention-before-virality is a hard ordering, not a preference.** Shipping the Verdict Card (bet 4) to a leaky bucket wastes it; bets 1–3 gate bet 4.
- **Every new payout is a faucet** against the no-recurring-sink problem flagged in [[future-direction-2026-06]] / [[snouts-economy]]. The `20260648` visitor fix mints **spendable [[snouts-economy|snouts]]** to the visitor (player chose real cash over leaderboard-only) — an adversarial review caught that this opened an *unbounded* faucet (re-tapping one barn 7/hr with no daily cap, ~168/day solo and ~336/day for a 2-account collusion ring, since the RPC has no server-side friendship gate). A per-visitor **20/day mint cap** **and** a **friends-only `are_friends` gate** (server + client) were added to bound it — visiting is now friends-only, resolving the old stranger-visiting question. One interaction remains an open product decision: the **referral "engaged" milestone** (visit-taps now feed the `tickles_earned>=50` +500/+500 *gate* — note the payout itself is snouts, not leaderboard). Lesson: any visiting/meta-goal cash reward needs a cap **and** an anti-collusion gate, not just a per-action rate limit.
- **Cozy guardrail:** the research's sharpest spread levers (meme-able *failure*, streamer chaos, anxiety-FOMO) fight the cozy promise. TTP's vector is the friends graph + a *warm* identity artifact, not Twitch or schadenfreude.
- **Out-of-app plumbing is genuinely unbuilt** — App Clips + deferred deep links (bet 5) are real iOS/MMP integration work, not a config flag.
