# World Cup — Allegiance pick (post-build modal)

Status: **building** (branch `world-cup-event`)

On the first app open after the World Cup build ships, every player is shown a
one-time modal inviting them to **pick a country to support** for the
tournament. Picking is a small commitment with a teaser of an end-of-tournament
payoff.

## Decisions (settled 2026-06-05)

- **Pick list** = the 47 qualified teams already in `WORLD_CUP_TEAMS`
  (`constants/worldCupFlags.ts`). Flag item id is `flag_<slug>`.
- **Locked once chosen.** A player commits to one country for the whole
  tournament — no switching to the eventual winner at the end. Enforced
  server-side in `choose_allegiance` (no-op if `allegiance_country` already set).
- **Skippable modal, persistent invite.** Not blocking. "Maybe later" hides it
  for the current session only (in-memory — no persistent dismiss), so the
  invite re-surfaces on each launch for the rest of the tournament until they
  pick, then stops for good once `allegiance_country` is set.
- **Re-entry for skippers.** A "Back your country" card in the Shop (daily view,
  `components/AllegianceCard.tsx`) shows while `allegiance_country` is null and
  opens the same modal — so people who skipped can come back any time.
- **Grants on pick:**
  1. The **flag** of the chosen country (`flag_<slug>`), auto-equipped
     (`active_flag_id`) so allegiance shows on the pig + leaderboard.
  2. One **soccer background** — the default `soccer_field_day` ("Sunny Pitch"),
     granted *and* equipped (`active_background_id`) as a celebratory wallpaper.
- **"Pick the right one" reward** = teaser only for now. We store the choice
  (`allegiance_country` + `allegiance_chosen_at`); a later finalize step rewards
  players whose pick matches the actual champion. No reward logic ships today —
  just the hint copy and the stored choice to grade against later.

## Soccer backgrounds (4, provided as art)

Seeded as `background` catalog items (cost 600, rare) so they also live in
browse / the WC shop; the allegiance grant hands out `soccer_field_day` free.

| id | name | art |
|----|------|-----|
| `soccer_field_day` | Sunny Pitch | day stadium, blue sky |
| `soccer_street` | Joga Bonito | sunset street pelada ("JOGA COM ALEGRIA") |
| `soccer_podium` | Champions' Podium | gold trophy, confetti |
| `soccer_field_night` | Night Match | floodlit night stadium |

Art must be dropped at `assets/images/backgrounds/<id>.png` before bundling.

## Pieces

- **DB** `supabase/migrations/20260585000000_world_cup_allegiance.sql`
  - seed the 4 soccer backgrounds
  - `profiles.allegiance_country` (FK → hats.id) + `allegiance_chosen_at`
  - `choose_allegiance(p_flag_id text)` — validate, lock-guard, set allegiance,
    grant + equip flag, grant + equip `soccer_field_day`
- **Constants** `constants/hats.ts` — 4 background `require()`s
- **UI** `components/AllegianceModal.tsx` — flag grid, reward hint, confirm/skip
- **Mount** `app/_layout.tsx` — fetch own `allegiance_country`; show when null +
  not locally dismissed
