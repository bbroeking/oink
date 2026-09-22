# The Wallow — an endless prestige ladder

Rewritten 2026-09-22 (the July 2026 "momentum" spec is in git history). Companion design:
`docs/design/2026-09-21-wallow-rethink.md` and the canvas under `docs/design/claude-design/wallow-2026-09-21/`.

## Decision

Rooting activity converges on season XP, and the conversion sits at the end of the pass:

`bury snouts / dig friends' pots / dig the Golden Truffle Patch → season XP → Wallow → a rank other pigs can see`

At one full pass of XP (`total_tiers × xp_per_tier`, currently 3,000) a player may **Wallow**. They keep
every reward, cosmetic, title, friend, Golden Truffle and snout already earned. Their visible pass returns
to tier 1, overflow XP is preserved, and their permanent Wallow rank rises by one.

**The progression never ends.** There is no final rank. Every Wallow, at any rank, grants a real reward
by the rules below, and every mark of rank is defined by a rule that holds for any number, not by a
finite table. A pig at W11, W40 or W100 has something new to show that a pig one rank below does not.

The Wallow is a rank, not a payout. Wallowing never grants tickles. The faster tickle clock is a private
perk of the first six ranks and caps there; the public rank keeps climbing forever.

## What a rank grants

### Ranks 1–6: the first chapter

| Rank | Clock (refill · visits) | Aura stage | Regalia piece (slot) | Keepsake |
| --- | --- | --- | --- | --- |
| W1 | 45m · 7h | 1 | Rookie Wallow Cap (hat) | Bronze |
| W2 | 30m · 6h | 2 | Bronze Wallow Specs (glasses) | — (frame pending art) |
| W3 | 27m · 5h | 3 | Marsh Wreath (necklace) | Silver |
| W4 | 24m · 4h | 4 | Gilded Wallow Bow (bow) | — (frame pending art) |
| W5 | 21m · 3h | 5 | Golden Wallow Trowel (held) | — (frame pending art) |
| W6 | 18m · 3h | 5 (holds) | Wallow Sovereign Crown (hat; replaces the cap, both stay owned) | Gold |

The six pieces are one outfit and can be worn together: five slots plus the aura. The set completes at
W6, the same rank at which the clock caps. The Sovereign Crown is a static piece; it does not grow.

### Ranks 7 and up: the rule

Every rank past W6 grants, in addition to the fresh Prestige Path below, exactly one rank prize, checked
in order:

1. **Keepsake rank** — rank 10, then every fifth rank (W10, W15, W20, …): a new inscribed keepsake frame
   for the Barn. W10 is Celestial. A keepsake rank with no drawn frame yet falls through to the next rule
   that matches (W15 pays truffles, W20 pays the aura) until its art exists; the inscription on every
   owned frame still advances.
2. **Aura rank** — rank 8, then every third rank (W8, W11, W14, …): a new aura stage. Stages past the last
   drawn ring hold the latest drawn ring until its art exists; the badge and inscription still advance.
3. **Every other rank** (W7, W9, W12, W13, …): two Golden Truffles and one Mote, minted through the
   existing audited grant paths.

Also on every rank: the portrait badge numeral advances without limit, and every keepsake the pig owns
shows the current permanent rank. No rank past W6 changes the clock, and no rank at any level grants
tickles or snouts. Rank prizes are receipted by (pig, rank) so they are granted once; pigs already past
W6 when this shipped were back-paid for ranks 7 through their rank.

### Every rank: the Prestige Path

Each Wallow starts a fresh sparse Prestige Path for that lap: 375 snouts, four Golden Truffles, one
Mystery Hat Box across 30 tiers, plus five Motes per lap from permanent rank 3. Tier 30's reward is the
next Wallow. Claims are keyed by season + lap, so each path is new; there is no paid prestige track.

## The marks: where rank shows

- **On the homepage**: the rank mark sits just behind the available tickle count, as part of the
  counter, not as a layer on or around the pig. Rosie herself carries no rank aura or ring on Home.
  W0 shows the counter alone.
- **On portraits** (leaderboard, friends, Me, user sheets): the aura ring for the pig's stage plus the
  `W<n>` numeral badge. iOS Reduce Motion freezes any motion at a readable frame.
- **In the Barn**: the keepsake frames, each inscribed with the current rank.

Rank is legible to a visitor without opening any sheet, and never by decorating the pig.

## Where prestige lives

The **rank sheet** (opened from the Wallow row on Me) is the only place the ladder is explained: the
current rung, the next rung and its prize, every later rung with its prize and a lock, the clock, and how
to wallow. Earned regalia is worn from the sheet ("wearing / wear it"). The Barn keepsakes and the
Season tab's Wallow card are doors, not copies.

Removed 2026-09-22: the Closet's prestige-only filter, the Me "Prestige gear" row, and Barn decor items
as rank grants. Those decor items stay for sale; pigs already granted one keep it through their grant
receipts.

## The clock

Regeneration is `1 − min(rank, 2) × 0.25 − max(0, min(rank, 6) − 2) × 0.05`, capped at 70 % faster at
W6 (18-minute refills). Friend-visit cooldown falls one hour per rank from 8h to a floor of 3h. Both are
server tuning (`app_settings.wallow_tuning`), not client constants. The W6 rung on the sheet states that
the clock is at full blaze so no later rank is mistaken for a missing step.

## Why this loop

- **Standing, not a payout.** The reward for wallowing is a rank everyone can see, growing without limit.
- **Nothing ends.** Every mark and every prize is a rule over the rank number, so the ladder needs no
  final row and art can be added behind the rule as it is drawn.
- **Burying matters without becoming an exploit.** Fresh stakes award scaled XP; the one-active-pot and
  12-hour self-reclaim cooldown prevent a free bury/reclaim loop. Top-ups remain XP-free.
- **Golden Truffles and Motes keep their identity.** Rank prizes use the existing mint paths; prestige
  never converts or counterfeits them.
- **No lost progress.** XP is monotonic; prestige advances a lap counter rather than resetting XP.
- **No missed rewards.** The server refuses a Wallow until every claimable free (and unlocked premium)
  reward is claimed.

## Server contract

- `profiles.wallow_count`: permanent public rank, unbounded. `user_season_progress.wallow_count`: laps in
  the active season.
- `season_state()`: lap-local `xp`, `wallow_count`, `can_wallow`, current/next regeneration and effective
  intervals, the sparse Prestige Path catalog and current-lap claims.
- `wallow()`: row-locked, server-authoritative, one lap per full pass of XP; grants the rank's regalia
  piece (ranks 1–6) and applies the rank-prize rule (ranks 7+) idempotently by (user, rank) via
  `wallow_rank_prizes` receipts.
- `claim_wallow_tier()`: claims one current-lap Prestige Path milestone.
- `_reconcile_habitat_prestige()`: grants keepsakes whose `prestige_rank` the pig has reached; decor items
  no longer carry a `prestige_rank`.
- `regen_secs_for()`: applies the capped clock formula alongside happiness, alignment, blessing, curse and
  war-winner modifiers.
- Aura stage and keepsake tier are derived from the rank by the same rule on client and server; no table
  lists ranks individually past six.

## Invariants

1. No rank grants tickles. No rank grants snouts outside the Prestige Path.
2. Every rank grants at least one real reward.
3. Every mark of rank is a rule over an unbounded integer.
4. The clock never changes past W6.
5. Anything with status attached is earned, never bought.

Migrations are never pushed automatically. Database deployment requires the project owner's explicit go.
