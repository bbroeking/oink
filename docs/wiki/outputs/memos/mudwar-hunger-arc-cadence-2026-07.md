---
title: "Mud Wars × The Great Hunger — the season arc + the 8-hour heartbeat"
type: memo
date: 2026-07-03
tags: [mud-wars, great-hunger, season-2, cadence, world-boss, founder-direction, design]
status: draft
---

# Mud Wars × The Great Hunger — the arc and the heartbeat

Founder direction (2026-07-03): *"Wars are collaboration efforts of you versus the opponent. There should be some daily or every-eight-hours thing you can do in the clan war until it's resolved. The whole storyline is we're weakening the Hunger — draining his energy."* Refined same day: *"the minigame is based around him burying truffles and then gorging, being distracted, and you do something around that — but chill, like tap-the-pig chill, maybe a different action."*

This memo works that into a concrete design on top of the shipped rhythm war and the [[mudwar-scope-a-weathered-2026-07]] build. It supersedes the pure-duel framing in [[mudwar-challenge-options-2026-07]]: the direction is **Option A's build wearing Option C's story**, plus a new heartbeat verb.

## 1. The three-layer structure (the storyline, systematized)

| Layer | Who | What it feels like | Scoreboard |
|---|---|---|---|
| 1. The crew | your ≤5 clanmates | pure co-op — tend, defend, cover, build the fort | none (shared) |
| 2. The war | clan vs clan | two rival work crews raiding the SAME glutton — race over a feeding ground | rope; better week wins |
| 3. The season | every player on the server | the Great Hunger visibly weakens as ALL war effort accumulates | the Hunger's energy meter |

The fiction that binds layer 2 to layer 3: **both clans are carving tickles out of the Hunger's hoard.** The rope decides who carries more home; *everything carved by either side drains him.* Losing a war still weakened the Hunger — "we lost the rope, but he lost his lunch." This makes the shipped duel narratively cooperative without touching the validated fold.

The shipped copy already half-fits: the deploy verb is "Loose the Horde" — reframed as goading the Hunger's hungerlings at the rival crew's diggings (hungerling art exists: `assets/concepts/great-hungerer/hungerlings_hog_v2_rosie_1.png`; goblins stay as his bog-minions).

## 2. The heartbeat — "Feedings" every 8 hours, and the Truffle Dig

**The fiction:** the Great Hunger can't stop hoarding — he presses stolen tickles into **truffles and buries them** all over the feeding ground. Every 8 hours he lumbers to his trough and **gorges, distracted**. While his snout is buried, the mud shimmers where truffles are hidden — and a pig can **root one up**.

**The verb — the Dig.** As chill as tickling, but a different touch: instead of tapping, you **scratch** — a short back-and-forth rub on the shimmering patch (a 2–3 stroke drag; PanResponder, same grammar family as the tickle tap and the barn's tap-N-times). Mud flecks fly with each stroke; the truffle pops free with a haptic thunk and a sparkle. **No timing, no failure state — a dig cannot whiff.** It's texture, not skill: rooting in mud is the most pig gesture in the game.

- Window index = `floor(extract(epoch from now()) / 28800)` — a global 8h clock; the war screen shows *"He gorges again in 2h 10m."*
- **One dig per member per window.** A dug truffle banks **+1 war mud** (counts toward quorum/active-membership) and **+1 to the season drain meter** — and the truffle itself is **kept as war currency** (Golden Truffles — see [[mudwar-rewards-spec-2026-07]]).
- **Crew echo (the collaboration beat):** if **2+ crewmates dig in the same window**, everyone's truffle turns **golden** — +1 bonus mud each — minted retroactively to all diggers in the window when the second one lands (the opener back-credit primitive, idea A6, so the first pig to show up is never taxed).
- Caps: 3 windows/day → max **+6 mud/member/day** (2/window). Deliberately below the 21/day skill cap — the Dig is the *floor*, throws/runs remain the *ceiling*.

**Why a new verb instead of re-bucketing the existing budgets into windows:** splitting throws/runs into 8h buckets would make the war *demand* 3 check-ins a day — that violates the async principle and the gift-not-guilt rule (Snapchat-streak territory), and punishes anyone with a job. The Dig keeps the existing daily budgets spendable in one sitting (low floor preserved) while giving the 8h rhythm to whoever wants it as pure upside. A missed window costs nothing and is never displayed as a break/loss.

**Why this specific shape passes the nine principles:**
- One rub = the lowest possible binary participation floor (P3); hard-capped so whales/alts gain nothing (cap-and-flatten).
- Window bonus is breadth-scaled co-presence (Heave's validated core, A5) rendered visibly (P6): the feeding ground shows who dug this window as freshly-rooted patches with each pig's name.
- Push-with-a-name (max 1/day, gift-framed): *"Jen rooted up a truffle while he was gorging."* Attributed nudges re-engage ~2× (research memo); one per day stays under the guilt line.
- Isolation firewall intact: the Dig mints war-scoped mud + war currency only; nothing reads wealth/VIP/alignment.

**Cadence answer to the founder's "daily or every eight hours":** both. The *skill* loop stays daily (throws in Tend, runs in Hold — shipped). The *heartbeat* loop is 8-hourly (the Dig). The three windows also line up with the research-validated push windows (8–9am / 6–8pm / 9pm–12am), so the one daily nudge can ride whichever window the crew is actually using.

## 3. Draining the Hunger — the season meter

**The mechanic:** a server-wide **Hunger energy meter** = a derived SUM of all war contribution this season (all crews, all wars, digs + mud — one read, zero new write paths; the same derived-view trick as Mud Fort). He starts at full **"Gorged"** and weakens through staged thresholds:

> Gorged → Stuffed → Full → Peckish → Hungry → **Famished** (driven off)

- **Visible weakening, never a number** (taste standard: feelings are shown, not labeled): his season-screen presence dims stage by stage — aura shrinks, crown tilts, the gloat animation gives way to the tired waddle (both already exist in the v2 sprite pack), the hoard-mountain visibly shrinks and the valley regains a band of color per stage.
- Surfaced in three places: the **season screen** (the big boss vignette — where `GreatHungerIntroModal` already lives), a **small stage chip on the war screen** ("Your war weakened him — he slipped to Peckish"), and the **war resolved modal** (both crews see their combined drain contribution — the loser's consolation line becomes narrative: "You lost the rope — but the Hunger lost 214 tickles").
- **Stage-drop moments are shared wins:** when the server crosses a threshold, everyone who contributed that stage gets the announcement (inline `system_announcements` INSERT — the admin-gated-wrapper footgun applies) and a small cosmetic beat. Community-scaled thresholds so a ~30-player beta can actually move it (tune: full season ≈ 5 stages ≈ the season's expected total war output at ~40% participation; recompute at the flip).
- **Finale coupling:** the Judgement-Day cron (noon UTC 2026-07-15) becomes the Hunger's last stand — the season ends with him driven off if the meter reached Famished (community win beat) or him "lumbering off to digest, vowing to return" if not (no punishment, sequel hook). This gives rollout precondition #4 (launch coupling) its concrete shape.

**Anti-rounding-error guard** (world-boss research, Helldivers lesson): contribution must feel non-trivial at small scale — hence per-stage thresholds sized to the live population and the per-war recap always showing *your crew's* drain ("your war fed 214 into the meter"), never the global percentage alone.

## 4. What this adds to the A-v1 scope

| # | Item | Surface | Est |
|---|---|---|---|
| H1 | `dig_truffle()` RPC — window-index day-bucket upsert (mud_slings pattern), golden-echo bonus w/ retro-credit, caps, truffle-currency mint | 1 migration | 1.0 d |
| H2 | Feeding-ground strip on the war screen — countdown to the next gorge, shimmering patches, scratch-to-dig gesture (mud flecks + haptic pop), rooted patches showing window diggers | `app/mud-war.tsx` + 1 component | 1.5 d |
| H3 | Season drain meter — `hunger_meter()` read (derived SUM + stage thresholds), boss vignette staging on season screen, war-screen chip, resolved-modal drain line | 1 migration (read-only RPC) + season/war/modal surfaces | 1.5 d |
| H4 | Stage-drop announcement + push (inline INSERT; 1 attributed dig-nudge/day) | inside H1/H3 migrations + `notificationRouting` (already in shared S2) | 0.5 d |
| | **Heartbeat + arc total** | | **~4.5 d** |

Revised path to flip: A-v1 (6.5) + heartbeat/arc (4.5) + shared preconditions (5.5) ≈ **16–17 dev-days**, with C's full race mode remaining the mid-season evolution (its `mode` column + token ledger still worth building during this phase per [[mudwar-scope-c-hungers-hoard-2026-07]] — the token IS the Golden Truffle).

Art needs (non-code): shimmer patch + dig-flecks + truffle pop frames (ChatGPT pipeline), staged boss vignette = recomposites of the existing v2 sprite pack + aura dimming (`scripts/soften_aura_edges.py` exists); hoard-mountain shrink states.

## 5. Open tuning knobs

- Dig value (+1) vs golden echo (+1): keep echo ≤ base so solo players lose at most half the heartbeat value.
- Window clock: global 8h epochs (simplest, shipped-style UTC) vs per-user local anchors (cozier, more code). v1 = global.
- Whether a Dig alone satisfies war quorum (recommended YES — it's the participation floor working as intended; the per-capita average still self-corrects).
- Stage thresholds at beta population — set from `war_population_ready()` instrumentation before the flip.
- Gesture: rub/scratch (recommended — distinct from tickle-tap) vs press-and-hold. Prototype both in H2 if unsure.

## Connects to
- [[mudwar-rewards-spec-2026-07]] — the full reward scenario (Golden Truffles, win/lose/participation, exclusives)
- [[mudwar-challenge-options-2026-07]] — superseded framing: this is A's build wearing C's story
- [[mudwar-scope-a-weathered-2026-07]] · [[mudwar-scope-c-hungers-hoard-2026-07]]
- [[world-boss-the-great-hunger-2026-07]] — the boss this drains
- [[clan-buildout-audit-2026-07]] — shared preconditions unchanged
