# TTP Long-Term Mode Synthesis — The Schism Front and What Hangs Off It

*Decision-ready consolidation of the long-term concept designs + landscape research. Solo-dev biased: player-behavior-as-content over authored-content treadmills.*

## 1. The one fact that decides everything

The codebase audit and the landscape research agree on a single highest-leverage finding:

> **TTP's Greedy<->Giver alignment is 100% a PRIVATE per-player number.** `profiles.alignment_score` is read/written only per-user; `alignment_leaderboard()` and `finalize_season()` rank individuals and **sum nothing at the side level**. There is no row, RPC, view, or column anywhere that tracks an aggregate Generous-vs-Greedy WORLD total.

Meanwhile the *fiction* — goblins-vs-angels, a cosmic schism, the `AlignmentBadge` on every identity surface, the Judgement Day finale — **promises a collective war the mechanics never deliver.** TTP has already built the two ingredients that are hardest and most expensive to create: a **persistent moral world-state** and a **built-in finale that aggregate behavior already moves.** It just never surfaced the aggregate.

Every durable-retention structure studied (Helldivers galactic war, r/place, Reddit's The Button, EVE, Fallen London) converges on the same minimal recipe for a world that feels alive for **months** without a content treadmill:

1. A **shared visible tally** only players move.
2. State that **persists** (loss is real, not reset nightly).
3. A **slow cadence** you cannot rush.
4. **Legible** per-act readouts so each small act visibly nudges the whole.
5. A **narrator** who frames the aggregate — *including loss* — as story.
6. **Factions** so the tally becomes us-vs-them, the engine of retellable drama.

The content is the players; the dev writes the frame, not the grind.

## 2. Flagship recommendation: THE SCHISM FRONT

A server-wide cooperative-vs-cooperative moral war on the **existing** Greedy<->Giver axis — Helldivers' galactic-war shape de-fanged into a cozy cosmic tug-of-war. Every blessing (+1), curse (−1), trade (±2), visit/truffle act that already calls `shift_alignment` feeds **one persistent world meter — the Tide** — that tilts the world toward a season-ending fate: a **Golden Age** (Givers hold the line) or a **Reckoning** (Goblins overrun). A ring of 5 named **territories** flip overnight when the Tide crosses a threshold, producing the visible *"the world shifted last night"* drama. It does not replace Judgement Day — it **resolves at** Judgement Day.

### Why it wins on all four weights

- **Retention power.** Adds the four feelings TTP most lacked and that are hardest to fake: **PERSISTENT-WORLD FOMO** (territories flip whether you logged in or not), **BELONGING** (the two alignment sides become teams with a shared visible goal), **SLOW TIME** (nightly+weekly+seasonal cadence you cannot rush), **EMERGENT DRAMA** (knife-edge flips become stories players self-organize around).
- **Feel.** Converts the private alignment number into the collective war the fiction already promises, voiced by the cheapest renewable content there is: one hand-written narrator dispatch per week (templated dispatches cover the rest).
- **Effort.** Lowest-effort path to a living world: it **sums deltas the per-player axis already records** at the single `shift_alignment` chokepoint (~15 call sites), rides the existing judgement-day `pg_cron` pattern, reuses INLINE `system_announcements`, and reskins the Mud-Off faction pair as the Generous/Greedy armies (no new faction column — the pinned doc's branching idea #7).
- **Meaning (the key insight).** It is a **META-FRAME**: it gives every short mode a reason to exist because they can all push the Tide (see §6).

### Cadence — three nested clocks, only the slowest carries the stakes

This is the explicit fix for TTP's daily-FOMO exposure (daily blessings + curses + bounties already approach the Pokemon-GO chore-stack).

- **INSTANT** — every `shift_alignment` call bumps the live Tide counter (no cron; captured at the existing chokepoint), so an individual act feels responsive.
- **SLOW (overnight)** — one nightly `pg_cron` tick (00:30 UTC) runs `settle_schism_day()`: read the Tide, flip any territory that crossed its threshold, write a dated `schism_days` row, INLINE a personal "the world shifted last night" dispatch.
- **WEEKLY (the heartbeat you return for)** — Sunday `settle_schism_week()` writes the hand-authored **Schism Tally**: the week's net movement, which side gained ground, the narrator dispatch; banks the week into the season ledger.
- **SEASONAL (the climax)** — Judgement Day (the **existing** cron) reads the final Tide to pick the world-fate (Golden Age / Reckoning / Knife's Edge), grants the dated season-fate cosmetic to the winning side, banks the immutable outcome into the permanent `schism_seasons` ledger (**Hall of Schisms**), and resets the Tide. **Score resets, record never does.**

### Retention arc

- **Week 1** — "the world is at war and I can move it": your blessing visibly nudges the global Tide bar; the morning dispatch tells you a territory you contributed to flipped overnight.
- **Week 4** — the front has a history you're part of (held/lost territories, a personal "battles fought" tally); the Sunday Tally is an appointment; the Oracle lets you bet on next week's flips.
- **Month 3** — the Judgement Day fork is in sight and *close* (knife-edge tuning); the narrator counts down which fate the world is headed for; the permanent Hall of Schisms makes this season's outcome unerasable history. You return to be on the right side of history and earn the dated season-fate cosmetic that ships once.

### Schema sketch (migration prefix ≥ 20260624000000)

- `world_tide(id int PK CHECK(id=1), season_key text, net_today bigint, net_week bigint, net_season bigint, updated_at timestamptz)` — the singleton the front reads.
- `schism_territories(slug PK, name, threshold int, holder CHECK IN('generous','greedy','contested'), flipped_at)` — 5 seed rows.
- `schism_days(season_key, day date, net_day, holders jsonb, flips jsonb, PK(season_key,day))`.
- `schism_weeks(season_key, week int, net_week, leading_side, dispatch, PK(season_key,week))`.
- `schism_seasons(season_key PK, fate CHECK IN('golden_age','reckoning','knifes_edge'), final_net, generous_territories int, greedy_territories int, resolved_at)` — the **permanent** Hall of Schisms, never reset.
- **Accumulation (the only hot-path edit, inside `shift_alignment` after the profiles UPDATE):** `UPDATE world_tide SET net_today=net_today+delta, net_season=net_season+delta, updated_at=now() WHERE id=1;`
- **RPCs:** `world_front_status()` (STABLE, SECURITY DEFINER, GRANT authenticated) returns Tide %, territory holders, per-side contributor counts (clone `alignment_leaderboard` shape), caller battles tally. `settle_schism_day/week/season()` are SECURITY DEFINER, NOT granted to authenticated (cron/service-role only), each INLINEs `system_announcements`.
- **Cron:** `cron.schedule('schism-night','30 0 * * *', …)`; `cron.schedule('schism-week','0 12 * * 0', …)`; `settle_schism_season()` is CALLED from inside `finalize_season()` (no new seasonal cron), wrapped in its own BEGIN/EXCEPTION so a world-fate failure can never roll back the working per-player verdict + reset.

### Economy fit

Zero new currency mint and zero inflation surface by construction. The front moves on alignment deltas (a reputation signal, not a currency). Snout sinks come via the bolted-on Oracle bets (pari-mutuel counter→counter transfer, zero-sum). Tickle faucets are bounded and over-cap-safe via `grant_tickles` only (a banded ~5/15/30 weekly "you fought in the schism" consolation, a rounding error vs the home loop, and it pays down display-debt). Cosmetics ship once per season per side via `user_hats ON CONFLICT DO NOTHING` (cost 0, non-purchasable). No tradable hard-currency market — the front is a reputation war, not an economy, so it sidesteps the Neopets inflation trap entirely.

### Anti-burnout

For players: the slow clock is the *feature*. Daily acts are optional nudges (your normal tickling already contributes); the weekly Tally is the only real appointment; missing days never punishes (the Tide is a community total, not a personal streak). No hard windows; flips are async and overnight. Even a Reckoning loss grants a dated Reckoning-Survivor title — loss is a story, not a punishment (Helldivers-style). For the dev: the content is the players and the clock. Author the frame once (5 territories, the fate fork, ~30 reusable dispatch templates). The only recurring labor is one hand-written paragraph per week — optional, since templates cover it. No new content per season; only the dated cosmetic changes (a recolor + a year-stamped title).

### MVP (one migration + one hook + one RPC + one component)

Proves the "private number → living shared front" transform with NO mini-games, NO map art, NO territories:

1. One migration adding the `world_tide` singleton + `schism_seasons` ledger.
2. Two lines inside `shift_alignment` accumulating the signed delta into `world_tide`.
3. `world_front_status()` returning season Tide % + which side leads + caller's contribution-this-season.
4. ONE Barn-Exterior strip: a Generous<->Greedy tug-of-war bar — *"The Schism: the world is 58% Generous"* + *"you've pushed +12 for the Givers"* (clone `AlignmentBadge` styling).

That alone delivers PERSISTENT-WORLD FOMO + BELONGING. **Increment 1**: nightly cron + "the world shifted last night" dispatch. **Increment 2**: 5 territories + map + weekly Tally. **Increment 3**: chain `settle_schism_season()` into `finalize_season()` for the fate + dated cosmetic + Hall of Schisms. Mini-games bolt on **last**, after the front exists for them to feed.

### Risks & mitigations

- **Singleton contention** on `world_tide` if many casts hit concurrently — fine at TTP's async scale; one-line fallback is to move accumulation out of the hot path and SUM in the nightly tick (eventually-consistent).
- **Legibility** — an aggregate the player can't feel is inert. Always show "your side gained X today" next to the global bar; surface the caller's "battles fought" tally.
- **Faction death-spiral** — keep the existing +3-climb-out / +2-fall-in redemption asymmetry as a Tide-level rubber-band; knife-edge threshold tuning (Helldivers-style); per-side consolation ladder so the losing side still gets paid.
- **Tone drift** — keep the dispatch voice playful/mythic, not vicious (the r/place-2022 hostility trap). A schism of conscience, not PvP.
- **Over-coupling Judgement Day** — wrap the schism call in its own BEGIN/EXCEPTION so a world-fate bug can't break the per-player finale.

## 3. All long-term concepts, ranked

| # | Concept | Horizon | Effort | Top feel | Fit with the spine |
|---|---------|---------|--------|----------|--------------------|
| 1 | **The Schism Front** | nightly→weekly→seasonal→multi-season saga | L (MVP small) | Persistent-world FOMO + Belonging + Slow Time + Emergent Drama | **Perfect** — closes the #1 gap by summing existing deltas; meta-frame for every mode |
| 2 | **The Barn Almanac** (serialized mystery on the gauge) | weekly page-turn → finite arc → cross-season legacy | L (writing-bound) | Wonder + Discovery-as-Content + Slow Time | **Strong** — same gauge plumbing; best as the *narrative skin* on the Front |
| 3 | **Snout Almanac + Hog Line** (collection + legacy) | daily sets → seasonal → generational | L (content labor) | Discovery + Identity + Earned Mastery | **Strong & complementary** — warmest reframe of the alignment reset; Front pays trophies into it |
| 4 | **The Homestead** (idle/prestige farmstead) | daily → weekly Tally → seasonal prestige | L (sprite-art cost) | Slow Time + Earned Mastery + deepest snout sink | **Good** — daily alignment pump + sink, but tone-risk + sink cannibalization |
| 5 | **The Circuit** (show-pig ladder) | weekly pen → seasonal tier → cross-season Hall | L (thin read-layer) | Earned Mastery + Belonging | **Moderate** — research's most-dangerous cozy structure; ranks modes, doesn't give them meaning |
| 6 | **The Wandering Almanac** (calendar + pilgrimage + letters) | daily → ~weekly waypoints → annual → lifetime map | XL | Slow Time + Wonder + Hangout | **Good but overscoped** — harvest its cheap slices, don't build the whole journey |

### The strategic read across the ranking

Concepts 1 and 2 are **the same plumbing** (an aggregated alignment gauge) wearing different skins — systems-war vs serialized-mystery. **Build the gauge once (the Front), add the Almanac's narrator/story layer as a skin** rather than as a second project. Concept 3 (Almanac + Hog Line) is the strongest *complement*: orthogonal to the war but the warmest possible reframe of the existing alignment reset, and the Front's fate cosmetics can pay into its trophy room/Herd. Concepts 4–6 are good adjacent mechanics but each is either heavier, tone-riskier, or a weaker meta-frame than the Front.

## 4. More options — the breadth sweep (shorter/adjacent mechanics & hooks)

These are cheaper levers, several of which should ship *alongside* the flagship:

- **Slow-time calendar skin on the Exterior** — real-season palette + Rosie seasonal idle + monthly "what's in bloom" Garden rotation, authored once, replayed annually via the `daily_shop` hashtext seed. Highest-ROI standalone slice from the Wandering Almanac.
- **Daily date-seeded narrator dispatch** — one hand-written line keyed to the world-state band; the cheapest renewable content lever in all the research. Ship it even before the full Front so the world has a voice.
- **Streak / Devotion / Garden** — finally *build* the spec-only daily-return engine; add a streak factor to `regen_secs_for()`, the 5-stage Garden visual, and a streak-FREEZE token (the mandatory forgiveness mechanic). The everyday return reason every long mode hangs on.
- **Collection Almanac milestone tiers** — gated cosmetic rewards at 40/70/95% of a season's catalog + one line of lore per item (Stardew-museum model).
- **Communal Granary / shared-goal pot** — cozy Helldivers cousin, clone of the shipped Trough/truffle-pot primitive; cooperative-only, async, recurring.
- **Oracle bets resolved by world-state** — front-resolvable resolver_keys reading `world_tide`; pure snout sink.
- **Hall of Schisms / Hall of Judgement Days** — permanent dated readable world-history; the "reset the score never the record" fix.
- **Sounder-level rollup** — your friends' aggregate Generous/Greedy lean, no new membership table.
- **Hidden-interaction discovery layer** — tap-the-lantern-7-times secrets seeded with the `daily_shop` idiom; folk-knowledge spread by players.
- **Async pen-pal letters** — canned-phrase composer (no free-text moderation) + small cosmetic gift; Sounder-only first.
- **Judgement-Day prediction market** — pari-mutuel stake on the final tally; deflationary sink + finale appointment.
- **Weather / daily omen** — date-seeded flavor that makes a day feel distinct at zero cron cost.
- **Dated lineage epitaphs / ancestor wall** (Hog Line) — retired pigs as a portrait gallery; emergent drama for free.
- **Streak-freeze / vacation mode** as a first-class forgiveness primitive for any streak-like mode.
- **Recurring annual festivals** (Stardew model, not Pokemon-GO live-ops) — author once, replay yearly; multi-day async windows, never 3-hour windows.

## 5. Anti-patterns to avoid as the long-game spine

Confirmed by the burnout/economy literature and the cozy-tone constraint:

- **Full battle pass / season track** — the archetypal content treadmill; a fresh authored reward track every season is unsustainable solo. If any track is used, copy Halo Infinite: permanent, non-expiring, slow, generous — and attach it to the calendar, not a monetized pass.
- **Competitive Elo ladder with relegation** — the single most dangerous structure for a cozy game (the Circuit must be heavily de-fanged or dropped to promotion-only).
- **Live-ops event firehose** (Pokemon GO Community Day) — needs a team and synchronous windows that clash with async cozy play. Steal the *ritual* (recurring annual festivals), not the cadence.
- **Tradable hard-currency open market** — the Neopets inflation death-spiral; near-impossible to police solo. Keep the economy sink-heavy and cosmetic-only.
- **Miss-it-forever exclusives** — weaponized FOMO; make everything recur annually so "missed it" is "see you next year."

## 6. How the flagship gives MEANING to the already-designed modes

The Schism Front is the meta-frame because it is the only proposed system whose currency is **alignment itself** — and almost every other mode already touches alignment or can be wired to it. Today the Oracle, Pageant, Mud-Off, and mini-games are isolated competitive loops: you win a daily cosmetic or a pot, and nothing carries forward. The Front gives each a **season-scale consequence** with zero re-architecture:

- **Snout Oracle** → a betting metagame *on the war*. Its pari-mutuel question catalog gains front-resolvable resolver_keys ("how many territories will the Givers hold Sunday?", "does the Mire fall this week?") resolved by reading `world_tide`. The pot rides the slow clock; players gain skin in the war beyond their own casts.
- **Pageant / Showdown** → winning a daily cosmetic contest injects a one-time **Tide bonus** to the winner's alignment side via a `shift_alignment`-style accumulation. Your style victory tilts the schism.
- **Mud-Off** → the cleanest fit. Its two factions **ARE** the Generous/Greedy armies (no new faction column), so its bi-weekly per-capita settle directly tips the Tide. The Front *absorbs* Mud-Off's plumbing instead of competing with it.
- **Mini-games / Daily Riddle** → a winning side gets Tide points via the same award path; throwaway wins become faction contributions.

The result is a nested economy of meaning: a single Oracle bet (daily) → nudges the Tide (instant) → a territory flip resolves (nightly) → the weekly Tally narrates it (weekly) → the Golden-Age/Reckoning fate banks it permanently (seasonal). Every short mode stops being a vending machine for cosmetics and becomes **a front in a war the whole sounder is fighting** — and the dev authors the frame once while players and the clock generate the news forever.

## 7. Recommended sequence

1. **Now:** Schism Front MVP (one migration + accumulation hook + `world_front_status()` + the Exterior tug-of-war strip). Stands alone on the existing alignment loop.
2. **+ Daily narrator dispatch** and the **slow-time calendar skin** (cheap ambient that makes the world feel alive immediately).
3. **+ Increment 1–3:** nightly cron + dispatch → territories + map + weekly Tally → chain `settle_schism_season()` into `finalize_season()` for the fate + dated cosmetic + Hall of Schisms.
4. **+ Devotion/Garden + streak-freeze** (the daily-return engine the Front leans on).
5. **+ Short modes wired in:** Oracle bets on flips, Mud-Off-as-armies, Pageant Tide bonus — each feeding the Front as it lands.
6. **Later, complementary:** Snout Almanac + Hog Line (collection + warm reset reframe), paying its trophies from the Front's fate cosmetics; optionally the Barn Almanac serialized-mystery as a narrative skin on the same gauge.

## 8. Open questions

1. Ship the Front as a pure systems layer first and add the Barn Almanac serialized-mystery as a skin on the same gauge later — or commit to the authored-arc from the start?
2. Confirm the world's stakes shift to **weekly** (Sunday Tally), daily acts staying optional nudges — nothing new becomes daily-mandatory?
3. Start with a single global Tide bar (no map) for the MVP, adding the 5 territories only if the bar proves engaging?
4. Commit to Mud-Off's factions *being* the Generous/Greedy armies (branching idea #7), so the Front absorbs Mud-Off?
5. Keep the one-line singleton-contention fallback ready (move accumulation into the nightly tick) if it ever bites?
6. Confirm "reset the alignment SCORE at Judgement Day, never the record" — build the permanent Hall of Schisms / dated fate cosmetics?
7. Ship the Front's MVP now (it stands alone) and wire modes in as they land, or sequence the Oracle first?
8. Confirm the dispatch voice stays playful/mythic and the losing side always gets a dated consolation title (loss as story, not punishment)?
9. Build Devotion (the daily-return engine) and/or the Interior trophy room before or alongside the flagship, or defer?