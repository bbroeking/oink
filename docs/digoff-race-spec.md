# The Dig-Off Race — every Sounder vs every Sounder (spec)

**Status:** adopted 2026-07-07 evening (grill session; decision logged in
`SKILL.md`). **Supersedes** `docs/digoff-spec.md` (the 1-v-1 duel, which
lived for one day — its plumbing survives, its shape retires).

> **Amended 2026-07-07 (night):** cycles are now **weekly (Monday 00:00 UTC,
> 7 days)** — the Mon/Thu split lasted one evening — and the headline board is
> **season-cumulative total finds** (no quorum, dense ranks, resets with the
> season) with the weekly per-snout race surviving underneath as the spoils
> engine. The season tab's Sounder section is one consolidated card (roster
> with presence, dig CTA + cooldown, milestone line, guide dialog). Migration
> `20260720000000_weekly_race_season_board.sql`.

## The sentence

**"Every find counts forever — and every Monday, the week's best diggers take spoils."**

## Shape

- **One global race.** Every non-bot Sounder is automatically in the current
  cycle — no challenges, no matchmaking, no bot rival, no accept dance.
- **Cycles are weekly-anchored:** a new race starts every **Monday and
  Thursday at 00:00 UTC** — a 3-day and a 4-day race alternate, back to
  back, forever. Boundaries are pure clock math (`race_cycle_at`, mirrored
  in `utils/dig.ts raceCycle`) — no cron decides when a race starts.
- **Score: finds per digging snout** (herd finds ÷ distinct diggers).
  **Quorum 2 diggers to be ranked**; solo-digger herds appear grayed and
  unranked with *"dig with a second snout to join the race."* Ties share
  the better rank (dense ranking, no tiebreak chain).
- **Drain is instant, always.** The banked-pot rule died with the duel; the
  meter breathes with every dig, and the race's drama is the ceremony.

## Rewards (paid at cycle end, per member, gated on that member digging ≥1 that cycle)

- **Truffle table by final rank** (server-tunable; mirrored as
  `RACE_TRUFFLE_TABLE`): 1st **6**, 2nd **5**, 3rd **4**, top half **3**,
  every other ranked herd **2**. Reason `race_rank` through `mint_truffles`.
- **Podium (top 3): one fresh cosmetic per qualifying member each cycle** —
  founder-committed new art via the icon-gen pipeline, served from
  `race_podium_queue` (topped up in batches). Fallbacks so the race never
  breaks: empty queue → a random unowned piece from the exchange catalog;
  member owns everything → +2 truffles.
- Sub-quorum herds collect nothing and are never called out for it.

## Standings UI (the pinned-row rule)

Lives on the season tab where the skirmish card was. Top ranks visible;
**your Sounder is always findable**: highlighted in place when it's inside
the visible rows, otherwise anchored below a separator with its true rank
("… #14 Sonder"). Grayed unranked section beneath; race countdown; last-race
line ("Last race: 3rd of 12 — +4 truffles each") doubling as the herd's
history. The Board grows no new scope — the race lives here only.

## Notifications

Riding the existing push pipeline (`send_push_to_user`, screen `season`):
- **Race start** (first sweep after a boundary): "A new race is on."
- **Race end** (at payout, ranked herds only): "⟨crew⟩ placed ⟨rank⟩ of
  ⟨of⟩ — your spoils are in."
- The 10-minute sweeper (`sweep_race`, replacing `digoff-sweep`) pays ended
  cycles and sends both, so nothing waits for someone to open the app.

## What retires from the one-day duel

`find_rival` / queue / bot fill / `challenge_crew_digoff` / `accept_digoff`
/ `digoff_state` / 1-v-1 pushes / membership war-gates. `dig_offs` +
`dig_off_digs` stay as dormant history. New attribution flows through
`race_digs`, written by every real dig.

## Charter check

1. **Pillar:** Connect (twice a week every herd shares the same rendezvous;
   the quorum nudge points solo pigs at recruiting) + Cooperate (per-snout
   scoring — the herd digs together or places nowhere) + Collect (placement
   truffles feed the Exchange; podium art is the freshest earn-only drop).
2. **Cozy, not grindy:** a race resets every 3–4 days — nothing accumulates,
   no ladder to fall down, showing up late costs one sprint, never standing.
3. **Respects the player:** rewards earn-only; every ranked herd collects
   something; participation gates per member so nobody free-rides or is
   farmed.
4. **Honest about feelings:** the meter stays a picture of HIM; the race
   numbers live on the race card, not on Rosie.
5. **Fair social loop:** scoring and payouts entirely server-side in the
   idempotent sweep; the bot is excluded; quorum + per-snout make ghost
   rosters and solo domination both self-defeating.

## Ship gate

**Podium art batch #1 must exist in `race_podium_queue` before the flag
flips** — the queue starts empty and the fallback (catalog pull) is a
degraded, not intended, first impression. Icon-gen session required.
