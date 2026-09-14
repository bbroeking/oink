# Weekday rituals — seven blessings, seven curses, cosmetic only

**Status:** plan, 2026-09-14. Replaces the Season 0 and Season 1 ritual sets entirely.
**Pillar:** Connect. A ritual is a message from a friend that the whole Barn can see.
**One sentence:** Every weekday has one blessing and one curse; both are something you *see* on your pig or your Barn for six hours, and neither changes how the game plays.

## Decisions (founder, 2026-09-14)

1. The seven replace Season 1 completely. The `world_boss` switch no longer branches the rotation anywhere, client or server.
2. The rotation is **weekday-locked**: the ISO weekday of the UTC date picks the pair. Monday is always Monday's pair. The old day-of-year modulo four cycle is retired.
3. Rituals stop touching gameplay. No regen change, no lucky boost, no tickle or snout payout, no snout pinch, no tap slip. Casting still counts as a social action (XP, alignment, push, Inbox) exactly as today.

## The week

| Day | Blessing | Channel | Curse | Channel |
| --- | --- | --- | --- | --- |
| Mon | **Cloud Nine** — your pig floats an inch off the mud on a tiny cloud. | pig transform + cloud sprite | **Pickle Brine** — the Barn turns briny green, like it fell in a jar. | scene tint |
| Tue | **Bubble Bath** — soap bubbles drift up around your pig. | pig particles | **Topsy-Turvy** — your pig stands upside down and carries on. | pig transform |
| Wed | **Butterfly Crown** — a butterfly rides on your pig's head all day. | forced head cosmetic | **Pipsqueak** — your pig shrinks to half size; its oink goes up an octave. | pig transform + sound |
| Thu | **Confetti Snout** — every tickle pops confetti. | tap burst | **Little Raincloud** — a small grey cloud follows your pig and drizzles. | follower sprite + particles |
| Fri | **Golden Hour** — the Barn goes warm amber and your pig glows. | scene tint + pig glow | **Bacon Bits** — your pig is striped like a rasher. | pig skin |
| Sat | **Firefly Night** — the Barn dims to dusk and fireflies wander. | scene tint + scene particles | **Hiccups** — every few seconds your pig hops with a "hic!" bubble. | pig transform + bubble |
| Sun | **Sunday Best** — your pig wears a little bow tie over its hat. | forced bow cosmetic | **Old-Timey Pig** — sepia, film grain, and a monocle it didn't ask for. | scene filter + forced face cosmetic |

**Rule:** a player can carry the day's blessing and curse at once, so a day's two recipes never share a channel. A unit test asserts this for all seven days.

Kinds (technical names): `cloud_nine`, `bubble_bath`, `butterfly_crown`, `confetti_snout`, `golden_hour`, `firefly_night`, `sunday_best`; `pickle_brine`, `topsy_turvy`, `pipsqueak`, `little_raincloud`, `bacon_bits`, `hiccups`, `old_timey`.

Untouched, because they are system-granted and never in the rotation: `chorus_glow`, `war_winner_regen`.

## What "weekday lock" changes

Today both `dailyBlessingKind` in `utils/rituals.ts` and `daily_blessing_kind()` in SQL pick `kinds[dayOfYear % 4]`. Four does not divide seven, so a kind lands on a different weekday every week and no day has a reputation. The new rule is `kinds[isoWeekday - 1]` with Monday = 1 and Sunday = 7, computed on the **UTC** date, the same clock the daily cap and the reset countdown already use. Consequences:

- "Bacon Friday" begins at 00:00 UTC, which is Thursday evening in the US. Accepted: the cap, the reset, and the rotation stay on one clock. Revisit only if players notice.
- The Dig-Off race already uses `isodow` in SQL and `getUTCDay() || 7` on the client (`utils/truffleExchange.ts`), so this matches an existing convention rather than adding one.

## Server

One migration, `supabase/migrations/20260915000000_weekday_rituals.sql` (must sort after `20260914090000_loose_pouch.sql`). Every function is carried from its **latest** definition, per the carry-latest-def footgun; the header lists the source migration for each.

1. **Kind constraints.** Extend `blessings_kind_check` (last set in `20260704900000`) and `curses_kind_check` with the fourteen new kinds. Keep the old kinds in the CHECK so history rows stay valid.
2. **Rotation.** `daily_blessing_kind()` and `daily_curse_kind()` become `ARRAY[...][EXTRACT(ISODOW FROM (now() AT TIME ZONE 'UTC'))::int]`, no `app_config` read.
3. **`send_blessing`** (carry from `20260750000000_mudwrap_stacking.sql`). Duration is a flat `interval '6 hours'` times the existing alignment factor for every kind. Remove the wrap-stacking branch, the `+5` tickle grant, and the `+5` snout grant. Keep reach (friends or crewmates), the cap of three, XP, alignment, chorus detection, and the `ok/kind/blessing_id` return shape.
4. **`send_curse`** (carry from `20260634000000_curse_cap_three.sql`). Flat six hours times the curse factor; remove the `coin_pinch` branch and `snouts_taken` from the return.
5. **`ritual_status`** (same file). Add `bless_kind` and `curse_kind` to the JSON so the client stops mirroring the rotation. The client keeps its local weekday table only as a fallback while the RPC is dark.
6. **`ritual_push_notify`** (carry from `20260528000000_ritual_push.sql`). One playful body line per new kind; the `ELSE` fallbacks stay.
7. **New read RPC `active_effects_of(p_target uuid)`**, SECURITY DEFINER, returns `source, kind, expires_at` for a friend or crewmate, no sender. Lets a visitor see the host's Barn as the host sees it (phase 4).
8. Leave `regen_secs_for`, the lucky boost, and the sluggish-regen history untouched. They only ever match old kinds, which stop being cast the moment this migration lands and expire within twelve hours.

Validation: the stubbed plain-Postgres harness (see memory note on local DB validation), then a `db query --linked` smoke of `daily_blessing_kind()` for each weekday by overriding `now()` in a transaction. **DB push waits for an explicit "go".**

## Client

### Catalog and rotation — `utils/rituals.ts`

- `BlessingKind` / `CurseKind` become the fourteen new names plus the two system kinds. Old kinds move to a `LEGACY_RITUAL_META` table so `effectMeta` in `utils/activeEffects.ts` still names a row cast yesterday in the Inbox and the effect cards.
- `BLESSING_ROTATION` and `CURSE_ROTATION` are seven long, Monday first. `dailyBlessingKind(d)` and `dailyCurseKind(d)` index by `isoWeekdayUTC(d)`; the `s1` parameter and `BLESSING_ROTATION_S1` go away. `dayOfYearUTC` stays only if another caller needs it (grep says none).
- `useRitualCaster` drops `useSeason1Active` and prefers `bless_kind` / `curse_kind` from `ritual_status` over the local table.
- Tests: rewrite `__tests__/rituals.test.ts` (seven consecutive days hit seven distinct kinds; a known Monday returns Cloud Nine and Pickle Brine; Sunday wraps to index 7). `friendRitualDoors`, `RitualPicker`, `useRitualCaster`, and `activeEffects` tests update their fixture kinds; `activeEffects.test.ts` gains a legacy-kind case.

### Presentation engine — new, `constants/ritualFx.ts` + `hooks/useRitualPresentation.ts`

One recipe per kind, declared as data, one hook that folds the active effects into a single merged presentation:

```
scene: { tint?: hex, alpha?, dusk?: bool, grain?: bool, particles?: "fireflies" }
pig:   { skin?: "bacon", tint?: hex, glow?: hex, flip?: bool, scale?: number,
         float?: { amp, period }, hop?: { every, height }, forced?: { head?|bow?|face? },
         follower?: "raincloud" | "cloud_under", particles?: "bubbles" }
tap:   { burst?: "confetti" }
sound: { pitch?: number }
```

Consumers, in order of surface weight:

- **`BarnOverlay`** (`components/Barn.tsx` line ~1022) takes `scene` instead of the boolean `cursed`. Golden Hour, Pickle Brine, Firefly Night, and Old-Timey are the same absolute-fill layer Goblin Whisper's haze uses today, with `pointerEvents="none"` (the build-99 footgun).
- **`PigStage`** gains a `presentation` prop. `flip`, `scale`, `float`, and `hop` join the existing breath transform on the stage wrapper, so the raster and Rive renderers both inherit them. `tint` and `skin` ride `skinTintOverride` on `PigRenderer`; Bacon Bits is a flat tint plus a striped mask sprite in the mask slot. `forced` items merge into the equipment selection ahead of the player's own so a bow tie sits over the hat, never instead of it. `follower` and `particles` are `AnimatedCosmetic` recipes, extended with `raincloud`, `cloud_under`, `bubbles`, and `fireflies` primitives beside the existing float/glow/shimmer/sparkle set.
- **Tap loop** in `Barn.tsx`: delete `sunBeam`, `luckyKind`, and `phantomItch` and their branches (lines ~319 to 328, 594, 643 to 690). Add the confetti burst on tickle when `tap.burst` is set.
- **Lists and sheets** (`PigAvatar`, the friends row, `UserSheet`, lounge) receive only the static channels: skin, tint, forced items, flip, scale. No particles or followers outside the Barn, for scroll performance.
- **Reduce Motion**: transforms freeze at their rest value, particles and followers render one static frame, hops and floats are off. `useMotionPolicy` already carries the flag.
- **Sound**: Pipsqueak sets a higher playback rate on the oink one-shot through `utils/sound.ts`. Optional; ships silent if the oink cue is still a placeholder.

### Copy and surfaces

- `BLESSING_META` / `CURSE_META` blurbs are the table's sentences above. `EffectCard`, the Inbox panel, the Barn updates tray, `CleanseModal`, and the friend-row door subs pick them up with no change.
- `luckyPig.ts` loses `LUCKY_TRIGGER_CHANCE_SUNBEAM`; `PHANTOM_ITCH_MISS_CHANCE` goes with it.
- Field Guide: the `mud_wrap` page (`constants/fieldGuide.ts`) becomes a "Rituals" page: "Every day has one blessing and one curse. Friends cast them on you; you wear them for six hours." `utils/fieldGuide.ts` and `useActiveEffects`'s observe hook follow.
- `utils/expedition.ts`'s Warm Tea and Mud Mask are expedition items, not rituals. Untouched.
- Release notes entry + build changelog `docs/builds/2026-09-XX-build-184.md` before the build.
- `SKILL.md` decision log entry (draft below) appended at the start of implementation.

### Art (the pipeline gate, lens question 5)

| Asset | Count | Lane | Blocks |
| --- | --- | --- | --- |
| Ritual icons, one per kind | 14 | `tools/regen_studio.py`, Rosie reference off | Phase 1 ships with `Glyph` stand-ins; icons swap in when done |
| Forced cosmetics: bow tie, monocle, butterfly, bacon stripe mask | 4 | regen studio → placement studio (flat-sticker law) | Phase 3 |
| Sprites: raincloud, under-cloud, hic bubble | 3 | one-shot ImageGen, magenta key slice | Phase 3 |
| Particles: bubbles, fireflies, confetti | 0 | procedural in `AnimatedCosmetic` | none |

## Phases

1. **Catalog + rotation.** Migration authored and harness-validated; client catalog, weekday rotation, `ritual_status` kinds, tests green. Every surface names the new rituals; nothing renders yet beyond the effect cards. Old effects expire on their own.
2. **No-art channels.** Scene tints and filters, pig transforms, the confetti tap burst, Reduce Motion behaviour. Nine of the fourteen rituals are fully visible here: Cloud Nine (transform only, cloud sprite later), Pickle Brine, Topsy-Turvy, Pipsqueak, Confetti Snout, Golden Hour, Firefly Night, Hiccups (hop only), Old-Timey (sepia only).
3. **Art channels.** Bacon Bits, Butterfly Crown, Sunday Best, the monocle, the raincloud, the under-cloud, the hic bubble, bubbles. Icons swap from glyphs to art.
4. **Visitors see it.** `active_effects_of` + `BarnVisitModal` renders the host's scene and pig channels, so a curse is something the caster can go and admire.
5. **Ship.** Changelog, `eas build --local`, Transporter, user's "go" for the DB push before the build reaches TestFlight.

Phases 2 and 3 are Opus implementation work in parallel once phase 1 merges; the recipe file is the contract between them.

## Acceptance

- [ ] `daily_blessing_kind()` and `dailyBlessingKind()` agree for every UTC weekday; same for curses. Neither reads the season flag.
- [ ] Casting any new kind writes a six-hour effect, grants no tickles or snouts, takes no snouts, and still grants social XP and a push.
- [ ] For each weekday, the blessing recipe and the curse recipe touch disjoint channels (unit test over `ritualFx`).
- [ ] With both effects active on a Friday, the Barn is amber and the pig is bacon-striped at the same time, and the effects tray lists both with the caster's names.
- [ ] A row cast under an old kind still renders its old name and icon in the Inbox until it expires.
- [ ] Cleanse still clears every active curse and the presentation returns to rest in the same frame.
- [ ] Reduce Motion on: no transform animates, no particle moves, every ritual is still identifiable.
- [ ] Lint scorecard 0, all ritual tests green, no `sun_beam` / `phantom_itch` / `glimmer_truffle` reference left outside the legacy table.

## Edge cases to test

1. Same-day blessing plus curse (the channel rule), and a stale legacy effect plus a new one during the twelve-hour overlap after the push.
2. The 00:00 UTC boundary: a door armed on Thursday's curse and pressed after midnight sends Friday's, and the toast names the one that was actually cast (the server's returned `kind`, never the local guess).
3. Rive renderer vs raster: flip and scale must look identical on both, and the forced bow tie must anchor correctly at half size.
4. Friends-list scroll with fifty bacon-striped, half-size, upside-down friends: static channels only, no dropped frames.
5. `ritual_status` dark (migration unpushed) and the app already on the new build: doors show the local weekday kind, the cast returns the server's, and the mismatch is impossible because both are the same table.
6. A blocked or unfriended caster: `active_effects_of` returns nothing for a non-friend visitor, and the host's own view is unchanged.

## Decision-log entry (to append to `SKILL.md`)

- **2026-09-14 — Rituals become a weekday of cosmetic effects, and stop touching play.** Seven blessings and seven curses replace both the Season 0 and Season 1 sets outright; the ISO weekday of the UTC date picks the day's pair (Monday is always Cloud Nine and Pickle Brine, Friday is always Golden Hour and Bacon Bits), so days earn reputations and "it's Bacon Friday" is a text message. No ritual changes regen, luck, tickles, or snouts any more; each is something you see on your pig or your Barn for six hours, and a day's pair never fights for the same visual channel. Chosen over a Season 2 set behind the season switch because a rotation that branches on a flag has already bitten once (the S1 mirror), and over the drifting day-of-year cycle because four does not divide seven. Plan `docs/design/2026-09-14-weekday-rituals-plan.md`. Serves **Connect** (a curse is a visible message from a friend, and visitors see it) and **legibility** (one sentence: every day has one blessing and one curse, and you wear them).
