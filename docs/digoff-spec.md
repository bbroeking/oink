# The Dig-Off — 24-hour Sounder skirmishes (spec)

> **SUPERSEDED 2026-07-07 (same day)** by `docs/digoff-race-spec.md` — the
> 1-v-1 duel became a global Mon/Thu race after one day live. Kept for
> history only.

**Status:** adopted 2026-07-07 (grill session; decision logged in `SKILL.md`).
**Amends:** `docs/season1-coop-dig-spec.md` — the "no opposing Sounder, ever"
clause is superseded; everything else in that spec (dig loop, truffle economy,
milestones, no public rankings, surfaces) stands.

## The sentence

**"Rally your herd, find a rival, and out-dig them for a day — the pot spoils
his feast either way."**

## Shape

- **24 hours, 3 feedings.** Both herds dig the same feedings they'd dig
  anyway — the dig-off adds zero new verbs, only stakes.
- **One number: finds per digging snout**, quorum 2. A sleeping pig neither
  adds nor drags (active-only denominator). Both sides under quorum → no
  result; one side quorate → they win. **Ties are ties** — no tiebreak chain.
- **One active dig-off per Sounder**; instant re-match after resolve.

## Initiation (leader-only, both doors)

- **Find a rival:** auto-match from a looking pool (prefer closest roster
  size); the house herd (bot) fills in when nobody's looking. No
  accept/decline dance.
- **Friend challenge:** from a friend's Sounder in the friends surfaces; the
  defender's **leader** accepts. Unanswered challenges expire silently after
  24h — there is no decline button and no rejection moment.
- The crown declares war: consistent with the leader owning identity-level
  acts (rename, kick, crown-passing).

## The drain twist ("done at the end")

- **Outside a dig-off:** every find drains the Hungerer instantly (unchanged).
- **During a dig-off:** both herds' finds **bank into a visible pot**; at
  resolution the combined pot slams him in one chunk — the feast spoiled.
  The in-patch slam beat re-themes to a pot drop for the skirmish's duration.
- Truffle minting, echo gilds, herd milestones, and season XP are unaffected
  by banking — only the meter timing changes.

## Rewards (closed-economy-legal)

- **Winners:** +1 bonus Golden Truffle per feeding the member personally dug
  (max +3; `mint_truffles` reason `digoff_win`) + the herd regen glow
  (`war_winner_regen` kind, ×0.85 / 72h).
- **Bot wins:** glow only — no truffle farming.
- **Draws:** glow both sides, no truffles.
- **Losers:** keep everything they dug. Nothing is ever taken.

## Record

- **No public boards** — the no-herd-rankings decision stands.
- Private match history (last skirmishes: opponent, result, final averages)
  on the herd's own season tab. Resolved `dig_offs` rows are the history.

## Surfaces

- **Sounder card (Friends hub):** people (roster, invites, join-first, crown,
  leave, milestones) + the economy doors (Truffle Exchange, spoils catalog).
- **Season tab:** the war — feeding strip, herd presence, find-a-rival CTA,
  live skirmish card (both averages · pot · countdown · member pips), resolve
  ceremony, match history.

## Server sketch

- `dig_offs` (status pending/active/resolved/expired; outcome a/b/draw/
  unanswered; pots), `dig_off_digs` (per-user per-window attribution),
  `digoff_queue`. No `mud_wars` machinery returns.
- `find_rival()` / `cancel_rival_search()` / `challenge_crew_digoff(p_crew)` /
  `accept_digoff(p_digoff)` — leader-gated; `digoff_state()` for the card +
  history; resolution is lazy (first read past `ends_at`), idempotent.
- `submit_rooting` banks finds into the pot while the crew's dig-off is
  active; otherwise drains instantly as before.
- Membership gates: join/leave/kick blocked while a dig-off is pending or
  active (the one war-gate worth keeping — no mid-skirmish mercenaries).
- Migration `20260715000000_digoff.sql`; constants mirrored in
  `constants/dig.ts` (DIGOFF_HOURS 24, DIGOFF_QUORUM 2,
  DIGOFF_WIN_TRUFFLE_MAX 3).

## Charter check

1. **Pillar:** Connect (a named rival + a 24h clock are a reason to rally the
   herd today; friend-challenges carry the trash-talk) + Cooperate (the score
   is the herd digging together, and even the rivalry drains HIM — both pots
   spoil the feast) + Collect (the prize is the game's own currency, tiny and
   participation-scaled).
2. **Cozy, not grindy:** 3 feedings, no banking across days, quorum instead of
   average-drag, silent expiry instead of rejection, ties allowed, losers lose
   nothing.
3. **Respects the player:** leader-only declarations mean nobody is
   conscripted; no purchasable edge anywhere in the loop.
4. **Honest about feelings:** the Hungerer's hurt is staged, not spreadsheeted
   — one pot, one slam.
5. **Fair social loop:** all scoring/minting server-side in the lazy resolve;
   active-denominator + quorum make ghost rosters self-defeating; bot pays no
   currency; membership locks stop join/leave gaming.
