# The Wallow — prestige and rooting loop

## Decision

Rooting activity should not introduce another currency. It already converges on
season XP, so the missing conversion belongs at the end of the pass:

`bury snouts / dig friends' pots / dig the Golden Truffle Patch → season XP → Wallow → faster tickle regeneration`

At one full pass of XP (`total_tiers × xp_per_tier`, currently 3,000), a player
may **Wallow**. They keep every reward, cosmetic, title, friend, Golden Truffle,
and snout already earned. Their visible pass returns to tier 1, overflow XP is
preserved, their permanent Wallow rank rises by one, and their tickle regeneration
accelerates by 25% per Wallow. Rank 1 is 25% faster and Rank 2 is 50% faster;
gameplay power caps there, while the public rank and prestige laps keep rising.

Leaderboard avatars gain an earned gold/fire rank frame with a compact `W1`,
`W2`, etc. badge and `Wallow Rank N` copy. Regeneration details stay off the
competitive board and live on the player's Me scrapbook, alongside a five-rank
Wall of Tiers. On living pig surfaces, five visual stages appear as an earned gold aura:
soft radiance at first, then a hotter animated flame from rank two onward. The
aura keeps escalating visually through five stages even after clock power caps.
iOS Reduce Motion freezes the aura at a readable frame.

After the first Wallow, the ordinary Free/Premium pass becomes a single earned
**Prestige Path**. It has only five repeatable milestone rewards across 30 tiers:
125 snouts at tier 5, two Golden Truffles at 10, a Mystery Hat Box at 15, 250
snouts at 20, and two Golden Truffles at 25. Tier 30's reward is the next Wallow
rank itself. Claims are keyed by season + Wallow lap, so each new path is fresh;
there is no paid prestige track.

## Why this loop

- **Momentum, not a payout.** Wallowing grants no tickles or snouts. It permanently
  shortens the normal regeneration interval, so the reward is more opportunities
  to return to Rosie and play.
- **Burying matters without becoming an exploit.** Fresh stakes award scaled XP,
  while the existing one-active-pot and 12-hour self-reclaim cooldown prevent a
  free bury/reclaim loop. Top-ups remain XP-free.
- **Golden Truffles keep their identity.** Feeding-window digs award 20 XP and
  still mint Golden Truffles only through `mint_truffles`; prestige never
  converts or counterfeits the Exchange currency.
- **No lost progress.** XP is monotonic. Prestige advances a lap counter rather
  than resetting the XP column, so late/concurrent grants survive.
- **No missed rewards.** The server refuses a Wallow until every currently
  claimable free (and unlocked premium) reward is claimed.

## Server contract

- `user_season_progress.wallow_count`: Wallows in the active season.
- `profiles.wallow_count`: permanent public standing across seasons.
- `season_state()`: returns lap-local `xp`, `wallow_count`, `can_wallow`, and the
  current/next regeneration power and exact effective tickle intervals, plus the
  sparse Wallow tier catalog and current-lap claims.
- `wallow()`: row-locked, server-authoritative, one lap per full pass of XP.
- `claim_wallow_tier()`: claims one current-lap milestone, using the audited
  Golden Truffle and Mystery Box grant paths.
- `regen_secs_for()`: applies `1 − min(wallow_count, 2) × 0.25` alongside the
  existing happiness, alignment, blessing, curse, and war-winner modifiers.

The migration is intentionally not pushed automatically. Database deployment
still requires the project owner's explicit go.
