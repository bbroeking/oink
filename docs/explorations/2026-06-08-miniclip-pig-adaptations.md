# MiniClip → Pig: canon, adaptations, and a ranked build shortlist

> Synthesized 2026-06-08. The brief: *"pull up a list of popular MiniClip games and adapt them to pig/barn/farm."* This doc delivers (1) the **canon** of popular MiniClip-era games with a one-line pig adaptation each, and (2) a **ranked shortlist** of pig mini-games to actually build for Tickle the Pig (TTP), biased to slot into the already-pinned build order.
>
> **TTP tech ceiling (hard constraints):** Expo 52 / RN 0.76 / Supabase, solo dev, **no game server**. Async-authoritative is the realistic max. No live realtime multiplayer; Supabase Realtime is cosmetic-only, never source of truth.
>
> **Loop:** pay SNOUTS to enter, win TICKLES (capped regen bank; `grant_tickles()` is the only over-cap-safe faucet) OR a zero-sum SNOUT pot (pari-mutuel `counter->counter` transfer, never minted). Entries gated by a cooldown (daily-quota or `lock_at`).
>
> **Cheat model is paramount** (client computes, so the server must validate). Ranked best→worst: **(a)** server owns the answer (pick'em/oracle) — cheat-proof; **(b)** shared daily seed — everyone gets the same board, server re-derives/validates + plausibility caps; **(c)** deterministic input-log replay — most fragile, AVOID; **(d)** trust + caps + anomaly batch — weakest.
>
> **Reused shipped primitives:** Buried Truffle (stake→pot→atomic first-to-act claim, one-action-per-player ledger); trough/item-drive (cooldown + claim + shared-goal bar); `daily_shop()` date-seed (`abs(hashtext(id||current_date))`, deterministic daily content, no cron); INLINE `system_announcements` INSERT for notifies (NEVER `send_system_announcement` — admin-gated, silently rolls back); `grant_tickles` faucet; snout `counter->counter` transfers.

---

## 1. Why the puzzle/daily cluster is the best fit

The single best-fit MiniClip cluster for TTP's async-authoritative ceiling is **puzzle / match / word / daily** (Wordle, 2048/Threes, Mahjong, Sushi Cat/Plinko). Every member is natively turn-by-turn / submit-a-run / daily-puzzle with **zero realtime requirement**, and the dominant social hook (Wordle's emoji-grid flex, 2048's high-score chase) was always **asynchronous bragging**, not live competition.

The cheat problem solves itself here because **the daily-puzzle idiom IS the shared-seed idiom** — the same `current_date::text + hashtext(x||seed)` trick `daily_shop()` already ships lets the server re-derive every board and validate every submitted result.

The repo's own pinned design (`docs/explorations/2026-06-08-pinned-design-teams-pageant-minigames.md` §5) already encodes the right order: **Snout Oracle (pari-mutuel pick'em) ships first** as the cheapest cheat-proof loop, the **Wordle-like Daily Riddle** is v1.1 (and pays the `GREATEST(...)` over-cap display-debt fix on the first real faucet), then shared-seed daily high-score, then async-duel. This shortlist is built to drop straight onto that ladder.

---

## 2. The MiniClip canon (with pig adaptation one-liners)

### 2a. Flash-portal era (Miniclip.com, ~2001–2012)

| Game | Genre | Core mechanic | Pig adaptation |
|---|---|---|---|
| 8 Ball Pool | Aim/trajectory cue sports | Drag-aim cue + power to pocket balls, wager coins/frame | **Trough Pool** — DEFERRED (live read-the-leave needs a physics server) |
| Bowman 2 | Aim/trajectory archery duel | Drag back angle+power, release to arc a shot | **Acorn Arc / Hoofbow Duel** — async joust on a shared windy seed, server settles closest-to-bullseye |
| Mini Golf / Mini Putt | Aim/trajectory golf score-chase | Aim+power, sink in fewest strokes | **Mud Putt** — same daily seeded green for all; submit ≤4 (angle,power) pairs, server re-sims strokes |
| Darts (301/Cricket) | Aim/trajectory precision | Release to hit scoring segments | **Snout Darts** — 3 throws at a seeded board w/ hot/cold overlay; submit coords, server recomputes |
| Dunkers / 1v1 Basketball | Aim/trajectory hoops | Time jumps + release to dunk/sink | **Hay-Bale Heave** — trick-shot pick'em on the daily auto-cannon |
| Fragger | Aim/trajectory physics puzzle | Lob grenades on an arc over walls | **Slop Lob** — one daily seeded arc; submit final (angle,power), server does ONE forward-sim |
| Raft Wars | Aim/trajectory turn combat | Angle+power lobs at enemy rafts | folded into **Slop Lob / Acorn Arc** |
| Learn to Fly | Physics-launch upgrade-launcher | Launch off a ramp, upgrade to fly farther | **The Great Hog Hurl** — daily seeded launch via discrete choice vector + server-owned upgrades |
| Burrito Bison | Physics-launch upgrade-launcher | Bodyslam + bounce, spend on distance | **Stampede the Slop-Slide** — co-op weekly distance bar (trough shape) |
| Hedgehog Launch | Physics-launch upgrade-launcher | Fling + boosters toward orbit | folded into **The Great Hog Hurl** |
| Earn to Die | Physics-launch continuous driving | Drive as far as fuel allows, upgrade | **Mud-Truck Maraud** — DEFERRED (continuous throttle = tier-c replay) |
| Motherload | Management / mining | Drill deeper, balance fuel/cargo, upgrade | **Deep Roots (Truffle Mine)** — commit an ordered dig PLAN, server walks it w/ hazard stop-rule |
| Helicopter Game | Reaction one-button flyer | Hold to rise / release to fall through a cave | folded into **Flappy Hog** |
| Gravity Guy | Reaction auto-runner | Flip gravity on a tap | **Gravity Piglet** — second skin on the Flappy Hog daily-seed engine |
| Bubble Trouble | Reaction arcade-puzzle | Harpoon to split/pop bouncing bubbles | niche daily seeded split-the-slop-bloon variant |
| Monkey Lander | Reaction lunar-lander | Feather thrusters to land gently | **Sky-Sow Landing** — daily seeded precision, server caps at seed optimum |
| Commando 2 | Action run-and-gun | Run/cover/gun through bases | no honest async fit — deferred |
| Heli Attack 3 | Action 2D arena | Blast endless heli waves | deferred (cheat-safe reskin = pick'em) |
| Tank Trouble | Action top-down arena | Ricochet shells off maze walls | **Mud Pit Melee** — DEFERRED (live shared arena) |
| On the Run | Action/racing dodger | Weave through traffic | **Pick the Plucky Piglet** — pick'em on a seeded racer field |
| Sushi Cat | Puzzle/physics Plinko | Drop a cat through pegs to eat sushi | **Snout Drop (Truffle Plinko)** — drop column only, server runs the seeded bounce, pays truffle-pot share |
| Mahjong solitaire | Puzzle/match | Match free pairs to clear a layout | **Trotter Tiles** — same daily pyramid; submit pair-removal list, server replays it |
| Fireboy & Watergirl | Co-op puzzle-platformer | Two elementals, each passes own hazards | deferred (mandatory live co-op) |
| Soccer Stars | Sports flick football | Flick disc-players at the ball | **Barnyard Flick-Ball** — DEFERRED (live react-to-shot physics) |
| Jet Ski / Powerboat | Sports/racing time-trial | Steer buoy courses for best time | niche; continuous steering leans deferred |
| Canyon Defense | Tower defense | Place/upgrade turrets vs waves | **Fence the Sounder (Coyote Watch)** — same seeded canyon+wave script; submit placement array, server re-sims |

### 2b. The .io / mobile / casual canon people conflate with MiniClip (~2013–2022)

| Game | Genre | Core mechanic | Pig adaptation |
|---|---|---|---|
| Agar.io | .io arena eat-em-up | Steer a cell, absorb smaller, flee bigger | **Sounder Stampede** — async daily shared trough, atomic snout-funded lunges, pari-mutuel payout |
| Diep.io | .io twin-stick tank | Shoot for XP, branching upgrade tree | **Tusk Tank Oracle** — pick'em on a seeded auto-battle build bracket |
| Slither.io | .io multiplayer snake | Eat pellets, cut off rivals | **Snout-to-Snout** — async length duel on a shared pellet field, cut-overlap kill |
| Wordle | Daily word puzzle | Guess a 5-letter word in 6, color feedback | **Slopword / Daily Riddle** — server owns the word, returns only color pattern + emoji-snout grid |
| 2048 | Sliding-tile number puzzle | Swipe to merge doubling tiles | **Piglet Pile** — seeded spawn sequence, server replays the swipe list |
| Flappy Bird | One-tap endless arcade | Tap to flap through pipe gaps | **Flappy Hog** — shared seeded fence-gaps, server validates vs reachable ceiling |
| Crossy Road | Hyper-casual Frogger | Tap to hop across roads/rivers | folded into **Gravity Piglet / Flappy Hog** |
| Cookie Clicker | Idle / incremental | Click + auto-producers, numbers escalate | **The Slop Cauldron** — server-owned communal fill bar, capped cooldown-gated pours |
| Words With Friends | Async word board | Turn-based crossword tiles, push per turn | **Trough Talk** — DEFERRED (XL board/rack/turn state machine) |
| Threes | Sliding-tile number puzzle | 1+2→3, combine multiples of three | folded into **Piglet Pile** |
| Vampire Survivors | Run-based roguelite | Auto-fire, survive hordes, pick synergies | niche/deferred (continuous-input dodging) |
| Club Penguin | Social MMO / virtual world | Waddle, chat, mini-games for coins, decorate | **Already TTP's spine** — Barn + Visit + Sounder + mini-games |
| Bloons | Aim puzzle / TD | Aim limited darts to pop balloons | **Boar Darts** — free-aim DEFERRED; shippable reframe = discrete preset, server resolves pop |

---

## 3. Ranked shortlist — what to actually build

Ranked by **fit × fun × low-effort × cheat-proof**, biased to the pinned build order (pick'em → daily high-score → async-duel). Effort: S/M/L/XL.

### #1 — Snout Oracle (Hog Cup Snout-Picks) · pickem-oracle · **S** · cheat tier (a)
*Source: 8 Ball Pool / Football Strike / Dunkers / Diep.io / On the Run — the sports-and-arena spectacle monetized as prediction, not performance.*

- **Loop:** Daily/periodic slate of pig fixtures or a trick-shot-of-the-day. Player pays a fixed snout buy-in into a shared pari-mutuel pot, picks an outcome before `lock_at`. After lock the **server settles** the predetermined result, scores tickets, splits the pot among correct pickers (`counter->counter`, no mint).
- **Why #1:** Already Phase 1 in the pinned doc — *the cheapest cheat-proof loop*. Clones `choose_allegiance`. Proves the entry-fee / pool / lazy-resolve / idempotent-claim / transfer **spine** every later mode reuses. Economically inert (`SUM(counter)` conserved per round modulo `floor()` dust). One `OracleCard`, ~4 RPCs.
- **Cheat model:** Tier **(a) server owns the answer.** Outcome generated/sealed server-side, revealed only at `lock_at`; client submits a pick before lock with no way to compute it. Nothing to fake.
- **Reuses:** `choose_allegiance` settle scaffold · `lock_at` gate · pari-mutuel `counter->counter` pot (truffle ledger) · INLINE `system_announcements` settle notify.

### #2 — Slopword (Daily Riddle) · shared-seed-leaderboard · **M** · cheat tier (b)→(a)
*Source: Wordle + Words With Friends share layer.*

- **Loop:** Once/UTC-day, six tries at a hidden farm word; green/amber/grey feedback; solve in N → tickle payout scaling inversely with N (2 big, 6 small, fail 0). Shareable emoji-snout grid drops into the Sounder feed; fewest-guesses leaderboard among friends. Free entry — it's the ritual hook.
- **Why #2:** Pinned as the **v1.1 viral hook**, and it carries the `GREATEST(...)` **over-cap display-debt fix** that must ship on the first real `grant_tickles` faucet (per the `settle_tickles` header). Cheapest path to daily-ritual + emoji-grid flex.
- **Cheat model:** Tier **(b) hardened to (a).** Answer never sent. `word_of_day := answers[abs(hashtext('slopword'||current_date)) % count]` inside a SECURITY DEFINER RPC. `score_guess(guess)` returns ONLY the color pattern + increments a server-side counter; enforces max 6, one/day, real dictionary word, monotonic. Payout = pure function of server-counted guesses.
- **Reuses:** `daily_shop()` seed · `grant_tickles` faucet (+ GREATEST fix) · `donated_today` UTC cooldown · INLINE `system_announcements` feed drop · `are_friends()` scoping · `grant_season_xp` first-of-day +5.

### #3 — Snout Drop (Truffle Plinko) · co-op-pot · **M** · cheat tier (b)≈(a)
*Source: Sushi Cat (Plinko/Pachinko).*

- **Loop:** Host stakes snouts to open a Snout-Drop pot (like burying a truffle). Each friend gets ONE drop: choose a column (a discrete `1..N`), the server runs a deterministic seeded bounce to a payout bin and pays a **share of the host's pot** (`counter->counter`), depleting until empty.
- **Why #3:** Heaviest reuse of a *shipped* primitive — it's Buried Truffle wearing a peg board. Cozy + social, lucky-pig burst-modal reveal for a big bin.
- **Cheat model:** Tier **(b) near-(a).** Only input is the drop column (one int); `landing_slot := deterministic_bounce(seed, column)` computed server-side — no trajectory crosses the wire. Atomic share = `truffle_digs` PK + `FOR UPDATE`; cap `LEAST(share, remaining)` so a drop can't over-draw the pot.
- **Reuses:** `bury_truffle` stake · `truffle_digs` one-action ledger (PK race) · `dig_truffle` `FOR UPDATE` depletion · `truffles_one_active_per_host` partial unique index · `shift_alignment(+1)` tied to recipient · `daily_shop()` seed.

### #4 — Mud Putt (The Daily Pin) · shared-seed-leaderboard · **L** · cheat tier (b)→(a)
*Source: Mini Golf / Mini Putt + Darts.*

- **Loop:** Server seeds today's hole (pin, slope/wind, par) from `current_date`. Player pays entry, takes ≤N aim-and-power shots; client runs deterministic putt physics. Submit only the per-shot `(angle, power)` vectors (≤~4). Server re-runs the same deterministic sim and computes the true stroke count, discards the client number. Leaderboard = fewest strokes, tiebreak submit time, one/UTC-day.
- **Why #4:** The canonical **shared-seed daily high-score** — the brief's next-cheapest tier after pick'em. Establishes the *seed + submit-a-tiny-input + server-re-sim* harness that Slop Lob, Sky-Sow Landing, and the Acorn Arc duel all inherit.
- **Cheat model:** Tier **(b) hardened to (a).** Board seeded + identical for all; client commits a handful of scalars; the SERVER runs the step-integrator to derive the result. NOT input-log replay — bounded scalars, one stable pass, with a known best-possible-strokes floor per hole.
- **Reuses:** `daily_shop()` seed · `shop_resets_in_seconds()` countdown · `grant_tickles` placement faucet · `counter` entry sink (`bury_truffle` pattern) · `wasted_tickles_leaderboard` SQL shape.

### #5 — Sounder Stampede (daily Trough scramble) · shared-seed-leaderboard · **M** · cheat tier (b)
*Source: Agar.io.*

- **Loop:** Each UTC day a single shared trough spawns with a date-seeded pellet pool. Spend snouts to **lunge**; each lunge atomically claims `min(your_bite, remaining)`; bite grows with how much you've eaten today (eat-to-grow), capped by a daily lunge quota. When the pool empties, your snout share = `pot * (your_pellets / total_eaten)`, paid `counter->counter`.
- **Why #5:** The honest, cheat-proof async answer to the .io eat-or-be-eaten fantasy, and a natural extension of the shipped trough/drive shared-goal bar. "Get there before the barn does," zero realtime.
- **Cheat model:** Tier **(b) + server-owned shared resource.** Pool size date-seeded; every bite is a SECURITY DEFINER atomic `UPDATE ... RETURNING` decrement (the `dig_truffle` pattern, generalized to partial claims); bite size derived server-side from recorded intake. Daily quota caps extraction. Server owns the pool and the arithmetic.
- **Reuses:** `buried_truffle` atomic claim · `daily_shop()` seed · item-drive shared-goal bar UI · snout transfer · trough nudge (INLINE `system_announcements`).

### #6 — The Slop Cauldron · co-op-pot · **S** · cheat tier (a)
*Source: Cookie Clicker (idle/incremental).*

- **Loop:** A communal weekly Cauldron bar needs X snouts to boil over. Each player pours a capped amount, gated by a 12h cooldown (verbatim `donate_to_drive`). On boil-over, contributors claim `floor(contribution/10)` tickles proportional to their share; a fresh Cauldron seeds.
- **Why #6:** Tiny lift that turns the genre's most cheat-prone shape into the safest one. On-tone Sounder belonging. Ideal low-risk filler to ship beside a bigger mode.
- **Cheat model:** Tier **(a).** No client simulation — the number is a server-side `raised_snouts` counter incremented only inside a SECURITY DEFINER RPC that debits snouts (`FOR UPDATE`), enforces cap + 12h cooldown, clamps to remaining. The idle-clicker cheat surface is removed entirely.
- **Reuses:** `donate_to_drive` + `my_drives` almost verbatim · `grant_tickles` on fund · INLINE `system_announcements` boil-over notify · `TroughSection` bar UI.

### #7 — The Great Hog Hurl · shared-seed-leaderboard · **M** · cheat tier (b)→(a)
*Source: Learn to Fly / Burrito Bison / Hedgehog Launch.*

- **Loop:** Once/UTC-day a shared seed fixes ramp bands, gusts, and a bounce-pad map. Player makes a small set of **discrete** choices (angle 1-of-8, 1-of-3 pre-charge timing, place ≤3 snort-boosts) and submits only the choice vector. Server re-runs `distance(seed, choices, upgradeTiers)`. Pari-mutuel pot to the top ~25%, plus a small `grant_tickles` consolation. **Slop-Rocket Upgrades** = server-owned, capped stat tiers bought with snouts (the numbers-go-up sink).
- **Why #7:** Captures the irresistible launcher hook on the Mud Putt harness, and spawns three cheap recombinations once `distance()` exists: co-op Slop-Slide bar, Hurl-Off async duel, Call-the-Hurl pick'em.
- **Cheat model:** Tier **(b)→(a).** Conditions date-seeded; client submits a small discrete choice vector + server-known upgrade tier; distance is a pure server function. The fragile bounce-chain is **never replayed** — the server computes a closed-form ceiling for `(seed, tier)`. Out-of-range vectors rejected; one hurl/day via unique `(user, hurl_date)` index. Upgrade tiers live server-side (à la `user_hats`), clamped on buy (blessing-cap idiom).
- **Reuses:** `daily_shop()` seed · `grant_tickles` faucet + snout sink · `user_hats`-style ownership table · `one_ritual_per_day` unique-index cooldown · first-of-day +5 XP · snout pari-mutuel transfer.

### #8 — Acorn Arc (Slingshot Standoff) · async-duel · **L** · cheat tier (b)+(a)-settle
*Source: Bowman 2 + Raft Wars / Fragger arc-lob.*

- **Loop:** Player A stakes snouts and challenges a Sounder friend on a fresh per-match seed (target, wind, obstacles). Both shoot the SAME seeded board whenever they like (Words-With-Friends pacing), each committing only `(angle, power)`. Server scores both arcs and settles closest-to-bullseye; winner takes the escrowed pot, tie splits back. `lock_at` per side = commit-before-reveal; timeout forfeits/refunds.
- **Why #8:** The cheapest honest **async-DUEL** (the brief's third tier) and the first head-to-head snout-pot mode. Honest caveat keeps it last on the shortlist: duels need matchmaking + a turn/commit state machine TTP doesn't have yet — so build it **after** the solo seed harness (Mud Putt) ships, not before.
- **Cheat model:** Tier **(b)** for the score (shared seed re-derived from a tiny committed input) **+ (a)-flavored settlement** (server runs the arc sim for both, decides the winner). Stakes escrowed `counter->counter` on accept; atomic `UPDATE ... WHERE not-settled RETURNING` prevents double-payout (the `dig_truffle` race).
- **Reuses:** per-match seed (`daily_shop` idiom salted w/ match id) · `lock_at` / timeout-refund · snout escrow (truffle pot) · `are_friends()` scoping · `utils/friendships.ts` opponent selection · INLINE `system_announcements` turn/result notify.

---

## 4. Deferred — great games that need realtime or fragile replay

| Pig name (source) | Why deferred |
|---|---|
| **Trough Pool** (8 Ball / Carrom) | Board state is path-dependent on prior shots — a shared seed can't derive it. Honest async needs the server to authoritatively simulate multi-ball collisions per shot = a real game server (none) or tier-(c) input-replay. |
| **Barnyard Flick-Ball** (Soccer Stars / Carrom / Air Hockey / Dunkers) | Fun is reacting to the board the opponent just made. Remove live reaction and it collapses into Acorn Arc. Faithful version needs a live physics server or full interleaved input-log replay. |
| **Mud Pit Melee / The Big Pen** (Tank Trouble / Mini Militia / Agar / Slither / Diep live arenas) | Inseparable from sub-100ms shared live state. Needs an authoritative tick server; Supabase Realtime is cosmetic-only. No viable cheat tier. |
| **Mud-Truck Maraud** (Earn to Die) | Distance is skill-expressive only with continuous throttle, validatable only via tier-(c) replay. Discrete reskin guts the feel and becomes a worse Hog Hurl. |
| **Trough Talk** (Words With Friends full board) | Cheat-safe in principle (server owns rack draw + dictionary, per-rack RLS) but XL: full board/tile-bag/rack/multi-game turn state machine. Defer until Acorn Arc proves the turn/commit plumbing. |
| **Free-aim Boar Darts** (faithful Bloons) | Continuous-aim physics replay drifts into fragile tier-(c). The discrete-preset reframe (tier a) is the shippable path; free-aim waits for a server-side physics validator. |
| **Barnyard Tycoon** (true idle / live co-build TD) | True idle = client computes production over wall-clock (clock-spoof/memory-edit cheat); the only safe version is the Slop Cauldron / existing capped tickle-regen. Live co-build TD needs realtime authoritative state. |
| **High-Score Gauntlet** (deterministic-replay arcade ports) | The repo's own pinned doc lists this under *Defer indefinitely* — honest validation needs tier-(c) replay. Use the Flappy-Hog reachable-ceiling model (tier b) or a pick'em (tier a) instead. |

---

## 5. Build-order recommendation (drops onto the pinned ladder)

1. **Snout Oracle (S, tier a)** — keystone; proves the entry/pool/resolve/claim/transfer spine. *Optionally bundle Slopword for feel + virality.*
2. **Slopword / Daily Riddle (M, tier b→a)** — viral hook; ships the `GREATEST(...)` over-cap fix on the first faucet.
3. **Snout Drop (M, tier b≈a)** — max truffle-primitive reuse; first co-op-pot beyond drives.
4. **Mud Putt (L, tier b→a)** — the shared-seed skill-leaderboard harness everything else inherits.
5. **Sounder Stampede (M, tier b)** + **Slop Cauldron (S, tier a)** — cheap on-tone co-op layered onto the trough bar.
6. **The Great Hog Hurl (M, tier b→a)** — the launcher hook + the `distance()` engine for 3 future recombinations.
7. **Acorn Arc (L, tier b+a-settle)** — first async-duel; builds the matchmaking/turn-commit plumbing Trough Talk would later need.

**Migration hygiene:** new files must sort **after** `20260623000000` (i.e. `>= 20260624000000`); same-prefix collisions break on the `schema_migrations.version` PK. Every user-facing notify INLINEs the `system_announcements` INSERT — never `send_system_announcement` (admin-gated, silent rollback).
