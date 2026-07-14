# Season-pass XP audit — 2026-07-13

Full audit of battle-pass XP: (1) does the members pass share the same XP/tier
track, (2) does each action grant what we intended. Sources: newest ("carry-
latest-def") SQL definitions, design statements in docs/builds + specs, and
live prod data (season `snout_season_1` / The Great Hunger, day 1).

## Verdict 1 — member pass parity: SOUND

One shared XP pool for everyone. `user_season_progress.xp` is the only track;
tier = `floor(xp / 100) + 1`, 30 tiers, 100 XP/tier (3,000 to cap). Nothing in
any migration multiplies XP by `is_vip` or `premium_unlocked` — membership
never changes how fast you tier up, only what you can claim:

- `claim_tier_reward` / `season_state` (newest def: `20260686000000_slop_club_
  includes_season_pass.sql`) compute premium as
  `stored premium_unlocked OR is_vip` **at read/claim time** — so Slop Club
  members get the premium lane on every season automatically, no per-season
  flag write needed. (Prod shows all-false `premium_unlocked` on the new
  season's rows; that is fine — the OR covers members.)
- `premium_plus_unlocked` exists but nothing uses it.
- Client: `PAID_BATTLE_PASS_ENABLED = false` in `app/(tabs)/season.tsx` — the
  premium tab is currently hidden for everyone, and the per-season purchase
  lane in `docs/pass-and-slop-club-spec.md` (`season_passes` table +
  `has_season_pass`) was never built; the live gate is the flag + `is_vip` OR.
  Decide before enabling paid passes.

## Verdict 2 — per-action XP: one major imbalance, one live exploit, several drifts

### The big one: barn visits are ~5× the intended ceiling

`tickle_at_barn` (newest def `20260705300000_barn_forage_truffle.sql:170`)
grants **+5 XP per tap, no daily XP cap**. When +5 was set (build 88), a
visitor got ~1 tap per friend per day; since then the barn rework raised the
cadence to **7 taps per friend-pair per 24 h** with no cap on pairs — the XP
was never revisited. XP now scales linearly with friend count:

> Prod, season day 1: "I Love Brian" made 109 barn taps across 21 friends in
> 24 h ≈ **545 XP from the barn lane alone** (654 total, tier 7 on day one).
> Intended engaged ceiling (build 88): **~100–120 XP/day**, pass completion in
> ~30 days. A social grinder completes the 3,000-XP pass in **under 6 days**.

**RESOLVED 2026-07-13**: nerfed to **+2 XP/tap** (user decision) —
`20260738700000_barn_tap_xp_nerf.sql`, staged with the batch. A 21-friend
grinder's barn ceiling drops ~530 → ~210 XP/day; still the top social lane
without dwarfing the rest. (Alternatives considered: daily gate on the lane;
first-tap-per-friend bonus.)

### Live exploit: bury→reclaim→re-bury (fix staged, not yet pushed)

`bury_truffle` pays 1/2/5 XP per bury; `reclaim_truffle` (20260656) refunds the
full remaining stake and frees the slot — infinite XP at zero cost. **Observed
in prod 2026-07-13 01:41Z**: bury 50 → reclaim after 12 s → re-bury 5 s later
(+10 XP, zero net snouts). Fix already staged locally:
`20260738400000_truffle_reclaim_cooldown.sql` (12 h re-bury cooldown after a
self-reclaim; friends digging the pot dry still allows immediate re-bury).
Farm rate until pushed: unbounded.

### Grant table — intended vs actual (newest defs)

| Action | Intended (docs) | Actual | Cap | Verdict |
|---|---|---|---|---|
| Home tickle | +3 | +3 (direct insert, `20260624_harden_home_tickle:110`) | tickle bank/regen | OK |
| Barn visit tap (visitor) | +5 (when ~1/day/pair) | +5/tap (`20260705300000:170`) | 7 taps/pair/24 h, pairs unbounded, **no XP cap** | **IMBALANCED** (see above) |
| Bury truffle | +5 first/day (b88) → 1/2/5 every bury (20260637, deliberate) | 1/2/5 per bury | one active pot; **reclaim loophole** | **EXPLOIT** (fix staged) |
| Dig friend's truffle | +3 first/day | +3 first/day (`20260706500000:152`) | 1/day | OK |
| Send blessing | +5, 1/day | +5, 1/day (`20260704900000:130`) | 1/day | OK |
| Send curse | +2, 1/day | +2, 1/day (`20260613:536`) | 1/day | OK |
| S2 rooting dig | +20/submit | +20 (`20260730_patch_carryover` carried) | 8 h feeding windows | OK |
| S2 war participant | +30 on resolve | +30 (`20260706400000:242`) | per war, active only | OK |
| S2 war winner bonus | +60 (=90 total) | +60 (`20260706400000:264`) | per war | OK |
| Chorus / crew kick | (undocumented) | +5 (`20260714_coop_dig_rebuild:760`) | crew-sync gated | OK — document it |
| Referral (complete / ladder / free-month) | +50 "deferred to its own pass" (never built) | +3 in each of three lanes (20260644 / 20260683 / 20260680) | per event | DRIFT — intent doc stale; actual is fine, update docs |

### Stacking note (worth a decision, not a bug)

Season 2's design brief says XP "comes primarily from the bog + scuffles", but
all Season 1 social lanes remain live and stack on top (tickle + barn + bless +
curse + dig + bury + rooting + war). Even after fixing the barn lane, an
engaged player's ceiling is well above the 100–120/day the pass curve was
tuned for. If pass pacing matters, retune either the lanes or the curve — one
decision, applied in one migration.

### Low-confidence items (verify before acting)

The audit surfaced possible direct `user_season_progress` inserts inside older
side-effect lanes (`apply_happiness` wiring 20260599, lucky-number 20260506,
VIP tickle bonus 20260504). These may be tickle inserts misread as XP — they
predate the XP system's current shape. Verify each newest def before assuming
extra XP leaks; none showed up in prod day-1 totals as anomalies.

## Recommended actions (in order)

1. Push the staged truffle-cooldown migration (closes the live exploit).
2. Barn XP gate — one small migration to `tickle_at_barn` (choose a shape above).
3. Decide S2 stacking posture (keep stacked & raise curve, or gate S1 lanes).
4. Before enabling `PAID_BATTLE_PASS_ENABLED`, reconcile the entitlement lane
   (`is_vip OR premium_unlocked` today vs the spec's per-season `season_passes`).
5. Doc cleanup: record chorus +5 and the referral +3s; retire the stale +50 note.
