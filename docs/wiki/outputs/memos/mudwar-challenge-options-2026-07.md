---
title: "Mud Wars — three options for the weekly clan-vs-clan challenge"
type: memo
date: 2026-07-02
tags: [mud-wars, season-2, clan-wars, ideation, founder-decision, buffs-debuffs]
status: draft
---

# Mud Wars — three options for the weekly clan-vs-clan challenge

Founder ask: *"My clan can challenge your clan (≤5 people each). Cooperative games we play together against the opponent; better score at the end of the week wins. Little buffs and debuffs. Look at a couple different options."*

Ground truth: the rhythm war is **already built and live on prod**, dark behind the `mud_wars` flag; the weekly **siege modifier is stored + displayed with zero gameplay effect** — it is the free buff/debuff socket. Everything below is graded against the nine principles and the isolation firewall (war scoring starts at zero; no outside wealth/buffs leak in). See [[mudwar-consolidated-brief-2026-07]] for the full substrate and [[mudwar-whats-next-2026-07]] for rollout preconditions — all four still gate the flip regardless of which option is picked.

---

## Option A — "Songs of the Bog, Weathered" (ship what's built + live siege weather + Mud Fort)

**Pitch:** Flip on the war that already exists, make the inert siege modifier a real weekly "bog weather" twist, and bolt on the cheapest kept-artifact co-op (Mud Fort) — the fastest path to a live clan war.

**The week (unchanged 7-day clock):** Days 1–2 Tend the Mire (Slop Toss, 7 throws/day). End of day 2: Loose the Horde (leader's double-blind wave deploy). Days 3–7 Hold the Line (rhythm runs, 2–3 co-defenders per area, 12-cap). Day 7 or rout ±12: the Mire Settles.

**Challenge flow:** as shipped — `challenge_crew` → mutual accept; house bot fallback; 24h cooldown.

**Co-op game:** the shipped fold already *is* the co-op (concentration past hold-pressure, barn-visit attempt tokens). Add **Mud Fort** (idea A1): the crew's rope/per-capita progress renders as a staged fort (lot→fence→wall→ramparts→gate→flag). Pure derived view — zero new tables/verbs. Gives the crew a visible shared thing they're building all week (principle 6) and a kept cosmetic on any win (principle 7).

**Buff/debuff layer — "Bog Weather."** One modifier drawn per war, **applies to BOTH crews symmetrically** (weather, not an advantage — this is what keeps it firewall-clean). All effects touch only war-scoped constants; none touch snouts, regen, or core-loop anything.

| Modifier | Effect | Scope/cap |
|---|---|---|
| **Deep Mud** | Marquee area (V=5) hold-pressure ×1.15 | fold input only |
| **Loose Lids** | +1 Slop Toss throw on Tend days (7→8) | daily mud cap 21→24 |
| **Songbird's Gift** | Barn-visit attempt tokens cap 1→2 per Hold day | war-scoped tokens only |
| **Thick Fog** | Opponent difficulty revealed only at war end (not daily recap) | info, not score |
| **Slick Rope** | Rout threshold 12→10; notch clamp ±5→±6 | faster, swingier wars |
| **Echo Verse** | A perfect on a run's last note = +1 mud | still under the 12 area cap |

**Win + rewards:** unchanged — rope holder wins; spoils drop + titles + `war_winner_regen`. Add the A13 consolation valves (loser/no-quorum Muddy-tier drop) so "everyone scores win or lose" gets closer to true.

**Build cost: S–M.** Siege effects = plumb `mud_wars.siege_modifier` (already stored) into the fold/chart constants; Fort = client render + resolve announcement; consolation = extend the existing grant trigger. Also close the redeploy-picker gap (B9) while in there.

**Principle risks:** stays a duel (D9 unresolved — accepted for v1); thin-crew problem (C3) only softened by consolation valves. Symmetric weather deliberately forgoes asymmetric buffs to avoid reopening snowball.

---

## Option B — "The Rival's Gauntlet" (challenge menu: the challenger stakes the week's terms)

**Pitch:** Challenging a clan means naming the terms — pick the week's *war song* (game variant) and pin a modifier; the defender counter-pins one — turning the challenge itself into the first strategic move.

**The week:** same 7-day clock, but its shape depends on the picked variant:
- **Classic Bog** — the shipped rhythm war, unchanged.
- **Mudslide Derby** — Tend-heavy: 4 Slop Toss days, deploys once on day 5, 2 Hold days. For timing-toss crews.
- **The Long Night** — Hold-heavy: 1 Tend day, 6 Hold days, deploys re-choosable daily. For Blotto strategist crews.

All variants are re-parameterizations of shipped verbs (`BUILD_DAYS/WAR_DAYS`, throw counts, deploy cadence) — no new minigame.

**Challenge flow:** challenger sends `challenge_crew` **with a staked variant + 1 pinned modifier from a weekly hand of 3**; defender sees the terms before accepting (mutual-accept = informed consent, already shipped) and counter-pins 1 modifier of their own. Both modifiers apply to both crews (stacked weather). As compensation for terms disadvantage, the **defender gets +1 redeploy token** — which finally activates the unspendable token and forces building the redeploy picker (B9).

**Co-op game:** per-variant same as Option A; carry Mud Fort or the score-neutral **Wallow chain meter** (A7) as the kept artifact.

**Buff/debuff layer:** the same Bog Weather table as Option A, but **drafted, not rolled** — pick/counter-pick is the buff system. Weekly hand rotation prevents a solved meta (you can't pin Deep Mud every war).

**Win + rewards:** per-variant rope; the variant stamps the spoils pool (Derby weeks drop Mud-Derby-set items) — a clean hook into the A12 themed-sets economy.

**Build cost: M.** Variant param plumbing per war; challenge-sheet UI (pick + counter-pick + terms display); redeploy picker; modifier effects (shared with A).

**Principle risks:** teachability — three variants × modifier draft is a lot for a ~27-player beta; still a duel (D9); pick-your-best-game meta could stale matchmaking (mitigated by hand rotation and mutual accept). Strongest on the bluff/identity axis; weakest on simplicity.

---

## Option C — "The Hunger's Hoard" (race, not duel — both clans race to win tickles back from the Great Hunger)

**Pitch:** Fold the clan war into the season story: the Great Hunger hoards the valley's tickles on three hoard-hills, and both clans **race** to carve more back per-capita by week's end — the loser still keeps everything they carved.

**The week:** Days 1–2 Tend (Slop Toss builds your carving mud, unchanged). Days 3–7 the Carve: rhythm runs against **the Hunger's waves** — server-seeded pressure (the `CHART_SEED` infra already generates charts), identical for both crews, so the race is fair by construction. No opponent deploy step; your strategy is allocating 2–3 carvers across hills of different value. Day 7: whoever carved more per-capita "drives the Hunger off"; a 12-point gap routs him early.

**Challenge flow:** as shipped (challenge → accept), but the opponent is optional — a crew with no rival races the **house pace-hog ghost**. This dissolves the solo/thin-crew dead-end (C3): a 2-person crew still carves, still gets paid.

**Co-op game:** the co-defend fold carries over; graft **Cover for a Crewmate** (A9 — help a genuinely-absent mate to a capped floor, helper rewarded) since race semantics make helping strictly cozy.

**Buff/debuff layer — "the Hunger's Moods"** (rolled weekly, symmetric, PvE-flavored):

| Mood | Effect |
|---|---|
| **Gluttonous** | Marquee hill pressure ×1.2 — concentrate or lose it |
| **Drowsy** | Timing windows ×1.1 — everyone's runs land easier |
| **Greedy** | Steals 2 mud/day from any hill with zero runs — anti-ghosting bite |

Player-side: **Rally Snacks** — extend the shipped barn-visit token (C2) into a small war-scoped consumable (+1 run, +1 throw, or one double-carve run; each capped 1/member/war).

**Win + rewards:** carved tickles pay out as **Golden Tickles — a war token**, both sides, proportional to own carve; winner gets the spoils drop + a hoard bonus. This is where the open **economy-wall decision (B2) lands naturally**: build the token ledger once, in the shape this option needs, and the raw-snout faucet closes.

**Build cost: L.** Race fold (replaces the mirror margin), hoard-meter UI (rope reskin), war-token ledger + redemption, Hunger moods, PvE wave seeding. Reuses every shipped verb and the chart infra, but the settlement layer is new.

**Principle risks:** resolves D9 ("everyone scores win or lose" becomes literally true) and C3, at the cost of head-to-head spice — mitigate by keeping Elo scaled on margin and the winner's spoils premium. Biggest real risk is scope: it's the only option that can't flip this month.

---

## Comparison

| | A — Weathered | B — Rival's Gauntlet | C — Hunger's Hoard |
|---|---|---|---|
| Build cost | **S–M** | M | L |
| % shipped infra | ~95% | ~80% | ~60% |
| Duel/race (D9) | duel | duel, leans in | **race — resolved** |
| Thin crew (C3) | valves only | valves only | **resolved** |
| Buffs/debuffs | rolled weather | **drafted weather (strategic)** | PvE moods + Rally Snacks |
| Season-story fit | neutral | neutral | **the Great Hunger IS the opponent** |
| Economy wall (B2) | still open | still open | **solved via war token** |
| Teachability | high | low | medium |
| Time to flip | **weeks** | ~a month | 6+ weeks |

## Recommendation

**Ship A now, and make C the mid-season evolution — deciding B2 (the war token) in C's shape today.** A is the only option that gets a live clan war in front of the beta population this month, and it converts the two cheapest dead assets (the inert siege modifier, the unspendable redeploy token) into visible play. Cooperate is already served by the shipped fold + Fort's shared artifact; Connect by challenge/accept and barn-visit tokens; Collect by spoils + consolation valves. C is the strategically right destination — it aligns the clan war with the Great Hunger narrative the opening cinematic is selling ("help win them back"), resolves the race-not-duel tension and the thin-crew dead-end, and closes the economy faucet — so the war-token wall (precondition 2) should be built **once, in C's Golden-Tickles shape**, not as a throwaway. B's challenge-menu draft is the best *live-ops beat* in the pile: hold it until the population can sustain variant matchmaking, then ship the pin/counter-pin as a mid-season content drop.

## Connects to
- [[mudwar-consolidated-brief-2026-07]] — substrate, idea bank, principles
- [[mudwar-whats-next-2026-07]] — rollout preconditions that gate any option
- [[world-boss-the-great-hunger-2026-07]] — the season narrative Option C folds into
