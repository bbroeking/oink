# Songs of the Bog — rhythm clan-war redesign

> A fork of [`mudwar-clan-design.md`](./mudwar-clan-design.md) toward a **Guitar-Hero rhythm**
> skill core, a **two-phase co-op→duel** cadence, and an **active double-blind goblin
> deployment**. Full visual explainer + build plan: **[`mudwar-rhythm-design.html`](./mudwar-rhythm-design.html)**.
> Same living-doc pattern: each `/loop` iteration appends to the Iteration log and rewrites
> the Next prompt; the success test is the three pillars below.

## The three pillars (the rubric — unchanged)

1. **Strategy-predominant.** Outcome decided mostly by decisions with tradeoffs vs a reading
   opponent, not raw activity or twitch.
2. **Coordination is required and amplifying (super-additive).** Can't win solo; 5 coordinated ≫
   5 uncoordinated — a multiplier, not a sum.
3. **Normalized floor + skill ceiling.** Flat baseline inside the war (no pay-to-win, no VIP/grind),
   but individual skill swings the team outcome more than headcount share.

## What this redesign changes vs. Fronts of the Bog

| Layer | Fronts (built, held) | Songs of the Bog (this design) |
|---|---|---|
| Skill core | Slop Toss — hold/release timing on one goblin | **Rhythm run** — tap on the beat against a short goblin stream |
| Fronts | 3 abstract contested fronts | 3 **areas you actively defend** against a deployed wave |
| Hidden info | fuzzy hold-pressure `P` | **active double-blind deployment** — which difficulty wave hits each of *their* areas |
| Cadence | one continuous grind | **Tend (co-op, days 1–2) → Hold (skill, days 3–7)** |
| Stake feel | abstract mud + rope | "goblins steal snouts" framing via a **cosmetic** coffer; rope still moves on normalized mud |

## What is reused (do NOT rebuild)

The whole point of this fork is that it **extends** the validated Fronts substrate:

- **The super-additive fold** `SUM(LEAST(mud,12))` across 2+ members above the `0.6·P` concede
  floor — the exact lever the Monte-Carlo sim measured at **96% coordination-beats-scatter**.
  Short rhythm runs *feed into* this fold; they do **not** replace it with three isolated solo runs.
- The **band-enum wire contract** + server-owned scoring (anti-cheat).
- The **fog RLS** + `test_fog_rls.sql`, the daily-tug rope, the `crew_ratings` Elo ladder,
  `resolve_war` payouts/buff/titles/cosmetics, the `mud_fronts_on()`-style flag machine, the
  `*/15` sweep, `tickle_at_barn`/`barn_visits`, the goblin art, and all of Slop Toss's juice.

## The design (locked)

**Cadence (7-day clock).**
- **Tend the Mire (days 1–2):** co-op build. Flat 7 throws/day (the shipped timing toss) bank
  normalized 0–3 band-mud into a chosen area via `mud_front_pushes`; depth = `SUM(LEAST(mud,12))`.
  Self-assign which area you'll hold (`mud_war_plans`, multiple members per area allowed). No snouts spent.
- **Loose the Horde (end of day 2, re-choosable per Hold day):** each crew secretly maps its three
  waves easy/med/hard one-to-one onto the **opponent's** three areas (new `mud_war_deploys`,
  leader-only, fogged). Double-blind.
- **Hold the Line (days 3–7):** defenders play **short rhythm runs** (3 scored notes, ~12s) against
  the wave the enemy deployed; 2–3 members co-defend one area and their mud **sums** under the 12-cap.
  Each day folds through `fold_front_outcome → coord_notch → rope`, **unchanged**. Leader has one
  redeploy token. An un-played area scores a deterministic **floor-defense**, not auto-concede.
- **The Mire Settles (day 7 or rout ±12):** `resolve_war` fires unchanged + a new 24h `crews.next_war_at`
  cooldown to kill win-trade farming.

**The firewall (Pillar 3).** The **rope moves only on normalized band-mud**. A separate, purely
**cosmetic** `snout_coffer` per area is fed by difficulty-scaled hits (easy +2 / med +3 / hard +4)
and drained by leaks (−4/−6/−8), clamped at 0 — pure juice for the "goblins steal snouts" feel,
**never** read by the fold. **No snout buy-in;** no one's spendable balance is ever at risk.

**How difficulty actually moves the rope (the corrected model — Pillar 1).** A hit's *value* is always
normalized (a perfect is always 3), so the floor stays flat and a skilled defender saturates on any
difficulty (skill ceiling preserved). Difficulty's rope effect is **hold-pressure**: the bar of banked
mud needed to hold an area is `HOLD_COEF · P_i · PRESS[difficulty]` (`PRESS` = easy 0.80 / med 1.0 /
hard 1.30). A **hard** wave on the marquee raises the bar past what *two* capped members cover, so the
defender must commit a **third body** there — or a skilled crew clears it with fewer. Difficulty also
mildly **tightens the timing windows** (×1.30 / 1.0 / 0.82), suppressing a *weak* defender's banked mud.
So the deploy is a genuine Blotto resource-drain: aim your single *hard* wave where they're thin or weak
to force an over-commit or deny an area; your single *easy* is a cheap gift elsewhere.
**Sim-validated** (`scripts/sim_deploy.py`, see below) — genuine dilemma, no dominant deploy or defense.

**Coordination = one lever (Pillar 2).** Super-additivity is the proven body-concentration fold
(2–3 defenders on the marquee clear a floor one can't → the (3,2,0) Blotto move). The unvalidated
×1.75 "backing" multiplier is **dropped**. Tickle/barn fuel is an **access lever only**: a barn-visit
mints a flat war-scoped token worth **+1 short-song attempt per recipient per Hold day** — roster
relief, crew+war-scoped (not friends-graph), scoring the *submitted* run (not best-of-N), so it can't
leak VIP-tickle wealth into the war or be farmed by alts.

**Anti-cheat.** Wire stays band-enum-only. A Hold run submits an array of ≤3 bands; the server
regenerates the chart from `CHART_SEED = hashtext(war:day:area:diff:caller_id) & 2147483647`, validates
length, maps via the existing `throw_mud` CASE, banks summed normalized mud, enforces the per-day budget
via `ON CONFLICT`. Folding `caller_id` in defeats copy-a-perfect-array between co-defenders; a forged
all-perfect run equals an honest flawless one (**exploit ceiling == skill ceiling**).

## Pillar verdict (sim-validated)

`scripts/sim_deploy.py` ran the deploy-Blotto + rhythm model across 5 seeds — all three pillars hold.

| Pillar | Status | Evidence (sim, 5 seeds) |
|---|---|---|
| 1 — strategy | **pass** | Deploy×defense matrix: **0 pure saddle points, no dominant deploy, no dominant defense**, best-response cycle ≥2; the deploy swings the defender's held-V by ~2.7 (mean) and the attacker's best `hard` target is **non-constant** across where the defender hides weak players |
| 2 — coordination | **pass** | **coord > scatter 78–80%** at equal high skill (concede the cheap area, stack the marquee — a 3rd body is needed when `hard` lands there); one capped contributor can't hold a contested area alone |
| 3 — normalized + skill | **pass** | **skilled-scatter > unskilled-coord 86–93%** (coordination can't substitute for skill); flat floor, no buy-in, rope on normalized mud, difficulty never caps a hit's value. Build rule: the access token scores the *submitted* run, not best-of-N |

Other checks: mirror (coord vs coord) draw **37–41%** (not perpetual); a 3-active crew's maximin defense
**holds 5V** (the marquee) — never auto-locked-out.

## Integration decision (how it sits on the Fronts substrate)

Reading `20260667` surfaced a fold mismatch the synthesis glossed, now resolved:

- The **built fronts fold is head-to-head** (`fold_front_outcome`: both crews push mud onto the *same*
  front; more mud wins it). The **sim-validated rhythm model is a mirror**: each crew defends its *own*
  mud on each (shared) area vs the **opponent's deployed difficulty's hold-pressure**
  (`HOLD_COEF·P·PRESS[diff]`), and the day's margin = `challenger_held_V − defender_held_V`.
- So rhythm adds a **new mirror-pressure fold** (`fold_rhythm_margin`), gated as a **third mode** on top
  of fronts: `rhythm ⊃ fronts ⊃ classic`. It **reuses every fronts table** — `mud_war_fronts` (the 3-area
  board), `mud_front_pushes` (each crew's per-area mud, written by *both* the Tend toss and the Hold run),
  `mud_war_plans` (assignment). When `rhythm_enabled`, `score_mud_war_days` folds via `fold_rhythm_margin`
  instead of `fold_front_margin`; when only `fronts_enabled`, the head-to-head fold; else base-only.
- **Phase = neutral deploy, not a hard no-op.** Deploys default to `med` when unset, so Tend days (1–2,
  no deploy yet, throws via the toss) fold as a gentle even-pressure build; Hold days (3–7, rhythm runs)
  fold under the real deployed pressure. This is simpler than special-casing the scorer and still matches
  the sim (the deploy read only bites once difficulties diverge).
- **Cooldown via trigger**, not by rewriting every challenge path: `crews.next_war_at` stamped at
  `resolve_war`, enforced by a `BEFORE INSERT` trigger on `mud_wars` (covers house + crew challenges
  without carrying `challenge_crew`).

## Data-model deltas

- **New tables:** `mud_war_deploys` (the hidden deployment), `mud_war_access` (war-scoped access pool).
- **Changed (additive, as built):** `mud_wars += rhythm_enabled, build_ends_at`; `crews += next_war_at`
  (the cooldown); `mud_slings += runs_today` (the Hold run budget); `score_mud_war_days` += the gated
  mirror-fold branch (`rhythm ⊃ fronts ⊃ classic`); `throw_mud` carried verbatim + a Hold phase-gate;
  `resolve_war` += the real-war-only cooldown stamp; `war_state` += `phase`/`rhythmEnabled`/`buildEndsAt`;
  `war_fronts_state` += `phase`/`myDeploy`/`accessTokens` + the mirror recap (all additive supersets).
- **Deferred to P5:** `mud_war_fronts.snout_coffer` (the cosmetic "stolen snouts" coffer) — it's pure
  juice, firewalled from the rope, so it's not needed for the rope model; it lands with the P5 UI.
- **Migration:** `supabase/migrations/20260668000000_mud_war_rhythm.sql`, **one** file, minimal-surface
  (only the **7** changed functions re-declared, each carrying its 20260667 body verbatim + a gated delta),
  flag-gated `mud_rhythm_on()=false`, with `scripts/golden_output.sql` (off-path smoke regression) +
  deploy-fog assertions in `scripts/test_fog_rls.sql`.

## Locked constants (sim-tuned)

`BUILD_DAYS/WAR_DAYS=2/5` · `AREAS=3, V=[5,4,3]` · `NOTES_PER_RUN=3` · `RUN_LENGTH_MS=12000` ·
`RUNS_PER_DAY=2 (+1 token)` · base windows `45/90/150ms` · **`HOLD_COEF=0.78`** ·
**hold-pressure `PRESS = easy 0.80 / med 1.0 / hard 1.30`** (the deploy's rope lever) ·
**window-tightness mult `1.30/1.0/0.82`** · skill σ (timing-error ms) `high 34 / med 64 / low 108`
(calibration only) · cosmetic coffer value/leak `e +2/−4, m +3/−6, h +4/−8` (off-rope juice) ·
`PER_AREA_CAP=12` · `P=[26,22,18]` · `FRONT_SCALE=4`, clamps `±4/±2/±5`, `ROUT=12` ·
`ATTEMPT_TOKEN_CAP=1`, `RALLY_PER_PAIR_PER_DAY=1` · `WAR_COOLDOWN_HOURS=24` · flag default false.

> Note: `PRESS`, `HOLD_COEF`, and the window multipliers are the **rope-relevant** difficulty knobs
> (sim-validated). The `+2/−4 …` coffer numbers are cosmetic flavor only and can be tuned freely.

## Resolved design question — defender feel (DECIDED: B)

**The defender plays their own area's-band song; the deploy is a hidden pressure (option B).** Locked by
the user. The playable song difficulty = the area's public `p_band` (light/medium/heavy); the opponent's
deployed difficulty is the hidden hold-pressure, revealed only in the post-day recap. This keeps the
sim-validated double-blind Blotto. (Original framing of the two options kept below for the record.)

- **(A) Reveal-at-play (closer to the original pitch).** Each Hold day both leaders deploy
  simultaneously-blind; the waves then *reveal*, and each defender plays the **actual difficulty
  deployed at their area** — a hard wave = a faster, tighter song that a weak player leaks. Difficulty
  bites via *window-tightness* (the sim's `DIFF_MULT`) on top of hold-pressure. The blind/Blotto part is
  the Tend-phase defender assignment + the simultaneous deploy. Fog reveals the deploy-at-you at Hold-day
  start (not at fold).
- **(B) Bank-blind, pressure-only (what the migration currently implements).** The deploy stays
  **fully fogged until the daily fold**; the defender plays a song and only learns at rollover whether
  their banked mud cleared the hidden hold-pressure. This is the **validated double-blind Blotto** (the sim
  assumed hidden allocation). "Three songs / three difficulties" still lands — tie the *playable* song's
  difficulty to the **area's own public `p_band`** (light/medium/heavy, already on the board), so defending
  a "heavy" area is a harder song, while the *deployed* difficulty is the hidden pressure on top. The
  trade-off vs (A): the defender doesn't face the *opponent's* specific wave, only their area's band.

  Note (A) has a cost the sim flags: revealing the deploy-at-you at play-time means *both* crews see *both*
  deploys once locked (you know yours; you see theirs-at-you), so the double-blind largely collapses to the
  Tend-phase assignment — weaker than the validated (B) Blotto. **Recommendation: ship (B) with area-band
  songs;** revisit (A) only if "face their exact wave" feel beats the stronger hidden game.

Both are pillar-valid — the sim showed **hold-pressure is the dominant lever** and `DIFF_MULT` is
secondary (negligible for skilled players, ~2–3 mud for weak ones), so the strategy/coordination/skill
results hold either way. The migration ships **(B)** because it's the cleaner, fully-fogged v1; flipping
to **(A)** is a moderate change (reveal the deploy at Hold-day start + render the difficulty client-side).
**This wants a user decision before P3 (the rhythm component), since it changes what the player sees.**

## Open forks (proceeding on the bolded default)

- **Concentration cap.** Default: **uncapped headcount, 12-mud per-member cap**. Alt: hard-cap 2/area.
- **Coffer payout.** Default: **pure vanity, never pays real snouts**. Alt: tiny house-funded bonus (defer).
- **Deploy authority.** Default: **leader-only**. Alt: per-member counter-waves (defer).
- **Access-token timing.** Default: **same-day extra run**. Alt: banked for next Hold day (defer).
- **Difficulty rope knobs.** ~~Default: lock after `sim_deploy.py`~~ **RESOLVED** — `PRESS=0.80/1.0/1.30`,
  `HOLD_COEF=0.78`, window mult `1.30/1.0/0.82` locked from the sim (genuine dilemma across 5 seeds).

## Build plan

| Phase | Deliverable | Gate |
|---|---|---|
| **P0** ✅ | `scripts/sim_deploy.py` — **DONE, PASS across 5 seeds.** Genuine dilemma (0 saddles, no dominant deploy/defense), coord>scatter 78–80%, skilled-scatter>unskilled-coord 86–93%, mirror draw ~40%, 3-active holds 5V. Numbers locked. | ✅ passed |
| **P1** ✅ | `20260668000000_mud_war_rhythm.sql` (schema + mirror fold + `submit_run` + `set_deploy` + phase gates + cooldown + bot path, flag off) + `golden_output.sql` + deploy-fog assertions in `test_fog_rls.sql`. **Authored + 5-agent audited (0 blockers; 3 majors fixed: bot-war cooldown, Tend/Hold phase exclusivity, header/golden-output).** Held — no DB push. | ✅ audited |
| **P2** ✅ | `constants/mudFights.ts` (rhythm constants) + `utils/mudWars.ts` (`submitRun`/`setDeploy` + extended types/recap union) + `hooks/useMudWar.ts` (phase-aware, `submitRun`/`setDeploy`). Typecheck-clean. | ✅ |
| **P3** ✅ | New `components/mudwar/RhythmDefense.tsx` — temporal `classifyDt(\|dt\|)`, 3-note runs, area-band song (decision B), reuses all of SlopToss's juice. (Reviewer fixed a hit-stop/advance race.) | ✅ |
| **P4** ✅ | Two-phase UI — `FrontBoard.tsx` (build vs Hold; leader deploy sheet w/ 3-distinct bijection; mirror recap) + `app/mud-war.tsx` (SlopToss in Tend, RhythmDefense in Hold; all Hold UI gated on `rhythmEnabled`). Typecheck-clean. | ✅ |
| **P5** ✅ | `20260669000000_mud_war_rhythm_access.sql` — a `barn_visits` AFTER-INSERT trigger that mints an access token for the host when a crewmate visits during an active rhythm war (calls `grant_war_access`; 1/recipient/day cap; flag-safe no-op off-path). Cosmetic `snout_coffer` left client-side (deferred). Held — no DB push. | ✅ |

## Iteration log

- **Iter 0 (this pass — DESIGN).** User pivoted from Fronts/Blotto to a Guitar-Hero direction
  (goblins stream + tap to throw mud, 3 songs/difficulties, snout coffer, hidden deployment, co-op
  build then skill war, one-area-per-person, tickle/barn boosts). Ran a 12-agent loop: 5 dimension
  drafts (rhythm core / strategy meta / economy+cadence / coordination+access / data-model), 6
  adversarial critics (3 pillars + ops + exploit + cozy-feel; **12 blockers**), 1 synthesis. Key
  fixes folded in: (a) **keep the super-additive fold** — short runs feed it, not replace it; (b)
  **strike the snout buy-in** — rope on normalized mud, snouts become a cosmetic coffer (firewall);
  (c) **difficulty cosmetic-only on the rope** + relative leak penalties so HARD isn't dominant;
  (d) **drop the unvalidated ×1.75 backing multiplier**; (e) access tokens score the *submitted* run,
  crew+war-scoped, flat-capped; (f) **one migration** + golden-output regression vs the carry-latest
  footgun; (g) softened cozy copy + short retryable runs. Produced `mudwar-rhythm-design.html` +
  this doc.
- **Iter 1 (P0 SIM — DESIGN VALIDATED + a flaw fixed).** Built `scripts/sim_deploy.py` and Monte-Carlo'd
  the deploy-Blotto. It **refuted** the synthesis's "difficulty is cosmetic-only on the rope" claim — if
  difficulty never touches the rope, the hidden deployment can't affect who wins (the Blotto is flavor).
  **Found the fix:** difficulty raises an area's **hold-pressure** (`PRESS=0.80/1.0/1.30` × `HOLD_COEF=0.78·P`),
  so a *hard* wave forces a 3rd defender (or a skilled crew clears it with fewer) — plus a mild
  window-tightening that suppresses weak defenders. Iterated the model (added the dropped base per-capita
  notch; raised the hold coefficient so concentration pays) until **all three pillars pass across 5 seeds**
  (dilemma genuine; coord>scatter 78–80%; skilled-scatter>unskilled-coord 86–93%; under-roster holds 5V).
  Locked the rope-relevant difficulty knobs. **P0 gate green.**
- **Iter 2 (P1 BUILD + AUDIT — migration).** Read 20260667 in full; discovered the head-to-head-vs-mirror
  fold mismatch and chose the mirror as a 3rd gated mode. Authored
  `20260668000000_mud_war_rhythm.sql` (minimal-surface: 7 carried functions + the mirror fold, `submit_run`,
  `set_deploy`, `grant_war_access`, the cooldown trigger, 2 new tables, deploy fog RLS), flag-gated off. Ran
  a **5-agent adversarial audit** (carry-latest / fog-RLS / SQL / fidelity / abuse): **0 blockers, fog-RLS
  clean**, 3 distinct majors — all **fixed**: (a) the cooldown wrongly stamped the human crew on *bot*
  practice wars → gated to real wars only; (b) Tend/Hold weren't mutually exclusive → added phase gates to
  `submit_run`/`throw_mud`/`set_deploy` (re-declared `throw_mud` to carry the gate); (c) the header referenced
  a non-existent `golden_output.sql` and an over-stated byte-identity claim → authored `golden_output.sql`
  and softened the header to name the one intentional global change (the cooldown). Plus nits: idempotent
  `war_fronts_state` REVOKE, empty-run guard, `runs_today` CHECK, deploy-fog test assertions. **Surfaced one
  real design fork** (reveal-at-play vs bank-blind — see above) for the user. **Held — no DB push.**
- **Iter 3 (P2–P4 BUILD — client, decision B locked).** User picked **option B** (area-band songs + hidden
  deploy pressure). Built the client layer (delegated + reviewed): `constants/mudFights.ts` rhythm constants,
  `utils/mudWars.ts` `submitRun`/`setDeploy` + extended types (discriminated recap union), `hooks/useMudWar.ts`
  phase-aware actions; new `components/mudwar/RhythmDefense.tsx` (temporal `classifyDt`, 3-note runs, song
  difficulty from the area's `p_band`, all SlopToss juice reused); two-phase `FrontBoard.tsx` (leader deploy
  sheet w/ 3-distinct bijection + mirror recap) and `app/mud-war.tsx` (SlopToss in Tend, RhythmDefense in
  Hold). Key correctness call: gate all Hold UI on `rhythmEnabled` (non-rhythm fronts wars also report
  `phase:'war'`). **Review caught + fixed** a hit-stop/advance race in RhythmDefense (good/perfect taps
  started two competing laps → visible jump). Whole tree **typecheck-clean** (`tsc --noEmit`, 0 errors).
  **Held — no DB push.** Remaining: P5 (server access-token barn hook + cosmetic coffer) + playtest.

- **Iter 4 (PLAYABILITY AUDIT — traced the live loop).** Traced create→Tend→Deploy→Hold→fold→resolve
  across migration + client. **Verdict: fully WIRED, not yet smoothly playable** — every RPC/type/UI/phase
  connects (entry via bot challenge works; the area picker renders in both phases so you CAN choose your Hold
  area; `defendedPBand` and `submit_run` both default to the lowest-VALUE area, so the song shown matches the
  area banked; the deploy sheet is leader/Hold-gated with client bijection; the mirror recap renders; the
  `*/15` sweep cron folds days; resolve pays out). **Two real blockers found + FIXED:** (1) **no dev path to
  the Hold phase** — a fresh war starts in Tend (`build_ends_at`=+2d) and `dev_end_war_now` only resolves, so
  the rhythm core was un-playtestable → added `dev_skip_to_hold` (admin-gated, `20260670…`) + a "skip to Hold
  (dev)" button; (2) **`runsRemaining` never reset at UTC rollover** → multi-day prod play stranded the player
  at "out of runs" → keyed the reset on the UTC day. **Noted (by design, not fixed):** a SOLO dev can't *win*
  a bot rhythm war (the per-member 12-cap means one player can't clear the marquee pressure — a real 3–5 crew
  can; solo can still play + resolve + see the fold). Typecheck-clean. **Held — no DB push.**

- **Iter 5 (DEPLOY TO PROD + a security bug found live).** User said "apply and walk the playtest." Found
  `db:push` targets the **production** project `wbcnhvvakptoinwkulmn` (the live app's DB — no local Supabase);
  confirmed with the user, then pushed the 5 held migrations (666–670) dark (flags false). Wire-verified with
  the anon key (`scripts/verify_rhythm.mjs`) — and **caught a real security bug the trace/typecheck couldn't**:
  the internal `SECURITY DEFINER` helpers' `REVOKE … FROM PUBLIC` was **ineffective** because this project
  grants `anon`/`authenticated` EXECUTE via default privileges, so `anon` could call `apply_crew_elo`
  (**ladder tamper**) and `fold_front_outcome`/`fold_rhythm_margin`/`rhythm_area_holds` (**fog bypass** — RLS
  is bypassed by `SECURITY DEFINER`). Fixed in `20260672…_harden_internal_revokes.sql` (REVOKE from
  `anon, authenticated` explicitly) + pushed; re-probe confirms all helpers now **BLOCKED (42501)** while the
  client RPCs still work. Flipped the flag via `20260671…_enable_rhythm.sql`. **Prod now at migration 672,
  rhythm ON, fog+ladder hardened.** Remaining: the actual in-app/RPC playthrough.

## Next prompt (fed back into the loop)

> **P0–P4 are DONE** (decision B locked): sim gate green; migration authored + audited + fixed; client
> layer (constants, wrappers, hook, `RhythmDefense`, two-phase UI) built, reviewed, and typecheck-clean —
> all **held, no DB push**. The end-to-end experience is reachable in local dev once the migration is applied
> and `mud_rhythm_on()` is flipped. **Remaining before launch:** (1) **P5** — a server migration adding the
> `barn_visits` post-hook that calls `grant_war_access` (the access-token mint) + the cosmetic
> `snout_coffer`; (2) **apply the migration locally** (needs explicit user "go") and run
> `scripts/golden_output.sql` + `scripts/test_fog_rls.sql`; (3) flip `mud_rhythm_on()` → true; (4)
> **playtest** via the `__DEV__` fast-forward harness — verify Tend banks via the toss, Hold runs bank via
> the rhythm conveyor, the leader deploy sheet fogs, the daily fold moves the rope by base+coord, the recap
> reveals both sides + which wave hit where, and a rout resolves + updates the ladder; (5) confirm the
> off-path (flag off) is unchanged. **Hold for the user's explicit "go" before any DB push.**
