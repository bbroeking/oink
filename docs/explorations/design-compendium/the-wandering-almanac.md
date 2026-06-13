# The Wandering Almanac
> Rosie's barn keeps a real calendar — the seasons turn outside her window, today's forage blooms in the Garden, and a friendly stranger on the road writes you a letter you can answer with a postcard.

**Tier:** Long-term (ambient connective tissue) · **Effort:** M for the harvested slices / XL for the full pilgrimage · **Mode:** Async, date-seeded (no realtime, no cron required for the MVP slices) · **Depends on:** nothing — standalone; *composes with* the Schism Front meta-frame and the Sounder, but does not require them.

## The fantasy
You live inside a barn that knows what month it is. Frost rimes the pasture in winter and clover blooms in spring; Rosie's idle pose shifts with the season; a weathered almanac on the wall turns a fresh page each morning with a single line of weather, what's in bloom, and a wry word from the road. Once in a while a stranger you've never met — a traveling tinker, a goose with opinions — sends a letter down the road to your Sounder, and you stamp out a reply from a deck of canned postcards. The full fantasy (which we are explicitly *deferring*) is that all of this is the slow approach to a season's festival: a months-long pilgrimage route you and the strangers walk toward together. For now, the fantasy we actually ship is quieter and just as warm: **the world outside is real time, and it remembers what day it is even when nothing is happening.**

## Player loop
The Almanac is three nested slices, each shippable alone. Only the first two are MVP; the third is a small follow-on; the pilgrimage is deferred.

**Daily (the almanac page — zero-cost ambient):**
1. Open the Barn Exterior. The background palette, sky, and Rosie's seasonal idle reflect the real calendar season (derived client-side from the device/`current_date`, no fetch).
2. A one-line **dispatch** sits on the barn wall: *"June 8 — warm and bright. The clover's up. A tinker passed at dawn and left muddy hoofprints by the gate."* It is deterministic from `current_date` + a band read of world-state — same line for everyone on the same day, so it's shareable folk-knowledge, not a personalized feed.
3. The **Garden** (the existing streak surface) shows a small "in bloom this month" sprite swap — a monthly forage rotation that is purely cosmetic ambient dressing near Rosie.

**Occasional (pen-pal letters — the social slice):**
4. A few times a week, a **road-stranger letter** lands in your inbox surface (a new card in the existing "while you were away" announcement modal). The letter is canned-phrase text assembled server-side from a template bank — no free-text, so no moderation surface.
5. You answer by picking from a **postcard deck**: a small grid of canned reply phrases + an optional cosmetic stamp. Sending costs nothing but a tap (and optionally a tiny snout sink if you attach a gift — see Economy). The reply may route to a friend in your Sounder (a real pen-pal) or to a system "road-stranger" persona.
6. Completing a back-and-forth exchange logs a line in your **letterbox** (a dated readable history) and, on milestones, grants a one-time cosmetic stamp/postmark for the closet.

**Seasonal stakes (deferred — the pilgrimage):**
7. *Deferred.* The daily dispatch and weekly letters would accumulate into **waypoints** along a route to that season's festival; reaching the festival (an annual, recurring, multi-day async window — Stardew model, never a 3-hour live-ops window) would unlock the festival's dated cosmetic. We spec the shape below but do not commit to building it.

## Mechanics

### Slice A — Real-season Exterior skin (cosmetic, client-side)
- **Season derivation:** `season_of(date)` → one of `winter | spring | summer | autumn`, computed from `current_date` month (N hemisphere default; a profile flag can later flip it). No DB write; purely a render selector.
- **Palette + sky:** each of the existing canvas backgrounds (`homestead_barn`, `sunset_farm`, `forest_grove`, etc. in `constants/hats.ts`) gets an optional per-season tint/overlay layer applied in the Exterior renderer. Authored **once** as 4 overlays, replayed annually — no per-year content.
- **Rosie seasonal idle:** an additive idle-pose selector layered *under* the happiness-mood sprite owner. Mood (Sad/Content/Happy) still owns Rosie's pose per `CONTEXT.md`; the season skin only changes ambient dressing (scarf in winter, etc.) and never the mood band.
- **Monthly forage in the Garden:** a 12-entry rotation keyed to month; the Garden's streak-stage visual is untouched (streak owns it), the forage is a sibling ambient sprite.
- **Caps/edges:** no caps — it's cosmetic. Hemisphere ambiguity → default N, fix later. Leap-day and month boundaries handled by the date function.

### Slice B — Daily date-seeded dispatch
- **Determinism:** clone the `daily_shop()` idiom exactly — `abs(hashtext(seed_text)) % N` where `seed_text = current_date::text` (the proven pattern across `20260502030000_shop_catalog.sql` and the many `daily_shop` bumps). Same day → same line for everyone.
- **Band-aware:** the dispatch picks from a template pool *banded by world-state* so it can narrate the Schism if present: `SELECT body FROM almanac_dispatches WHERE band = current_band ORDER BY hashtext(current_date::text || id) LIMIT 1`. If the Schism Front isn't built yet, `current_band = 'neutral'` and it reads pure weather/flavor. ~30 templates per band (the docs' "cheapest renewable content lever").
- **No cron:** computed on read, like `daily_shop()`. Zero scheduled jobs for the MVP.
- **Refresh window:** rolls at `current_date` boundary (server clock), matching `daily_shop`'s `(current_date + INTERVAL '1 day')` reset idiom.

### Slice C — Canned-phrase pen-pal letters
- **Letter generation:** a letter is `(template_id, fill_slots jsonb)` — fully canned phrases, server-assembled. No user free-text ever enters a letter body. Strangers are seeded personas; friend-pen-pals address a real Sounder member.
- **Reply:** `reply_letter(p_letter_id, p_phrase_id, p_stamp_id)` — validates the phrase_id is in the allowed deck, validates the stamp is owned (or free), writes the reply row, and **INLINEs** a `system_announcements` row to the recipient (NEVER `send_system_announcement` — admin-gated, silently rolls back per the carried footgun). 
- **Cadence/caps:** at most **1 inbound stranger letter / 2 days** per player (date-seeded so it can't be farmed); friend pen-pal letters capped at **3 outbound / day** to a friend, **1h per-target cooldown** (mirrors the Visit cooldown shape in `CONTEXT.md`). An exchange = inbound + your reply; completing one is what logs to the letterbox.
- **Milestone cosmetics:** at 5 / 20 / 50 completed exchanges, grant a postmark cosmetic via `INSERT … user_hats … ON CONFLICT DO NOTHING` (cost 0, non-purchasable — same idiom as `choose_allegiance`).
- **Edge cases:** unfriending mid-exchange → letter goes stale, no error; blocked user → reply RPC rejects (reuse the friend-request block check just fixed in `20260620000000_fix_friend_request_block_check.sql`); duplicate reply → the reply row PK (`letter_id, replier_id`) absorbs it idempotently.

### Slice D — Pilgrimage (DEFERRED — specified, not built)
- A `pilgrimage_route(season_key, waypoint int, ...)` ladder where N completed dispatches + exchanges advance a shared async marker toward a festival date; festival grants a dated cosmetic via the same `ON CONFLICT DO NOTHING` idiom. Resolution would chain off `finalize_season()` like the Schism Front does — never its own seasonal cron. **Not in scope; do not build until the cheap slices prove the ambient layer earns its keep.**

## Schema sketch
Migration prefix must sort **after** `20260623000000` (i.e. ≥ `20260624000000`).

**Slice A — no schema.** Pure client render (`utils/almanac.ts` exporting `seasonOf(date)`, `forageOf(date)`).

**Slice B — dispatch (clones `daily_shop()` determinism):**
```
almanac_dispatches(
  id           bigserial PK,
  band         text NOT NULL DEFAULT 'neutral',   -- 'neutral'|'generous'|'greedy'|'knifes_edge'
  body         text NOT NULL,                      -- canned, ≤140 chars
  weight       int  NOT NULL DEFAULT 1,
  active       boolean NOT NULL DEFAULT true
)  -- seed ~30 neutral rows; band rows added when the Schism lands

todays_dispatch() RETURNS jsonb            -- STABLE, SECURITY DEFINER, GRANT authenticated
  -- returns { date, band, body }; picks via hashtext(current_date::text || id), clones daily_shop()
```

**Slice C — letters (clones the truffle-ledger + announcement-inline patterns):**
```
almanac_letters(
  id           bigserial PK,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id    uuid REFERENCES auth.users(id),       -- NULL = system road-stranger persona
  persona      text,                                 -- 'tinker'|'goose'|... when sender_id NULL
  template_id  text NOT NULL,
  fill_slots   jsonb NOT NULL DEFAULT '{}',
  sent_at      timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
)
almanac_replies(
  letter_id    bigint NOT NULL REFERENCES almanac_letters(id) ON DELETE CASCADE,
  replier_id   uuid NOT NULL REFERENCES auth.users(id),
  phrase_id    text NOT NULL,
  stamp_id     text,
  replied_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (letter_id, replier_id)                 -- idempotency, clones truffle_digs PK
)  -- RLS read-own, like truffle_digs_read_own

send_pen_pal(p_friend_id uuid, p_phrase_id text, p_stamp_id text) RETURNS jsonb
  -- SECURITY DEFINER, GRANT authenticated; cap 3/day + 1h/target; block-check;
  -- INSERTs almanac_letters + INLINEs system_announcements to recipient
reply_letter(p_letter_id bigint, p_phrase_id text, p_stamp_id text) RETURNS jsonb
  -- SECURITY DEFINER, GRANT authenticated; validates phrase deck + stamp ownership;
  -- INSERT almanac_replies ON CONFLICT DO NOTHING; INLINE system_announcements
my_letterbox() RETURNS jsonb                          -- STABLE, read-own dated history
```
Stranger letters are minted by a **read-time, date-seeded** check inside `my_letterbox()` / a login pass (no cron): "if no stranger letter in the last 48h and `hashtext(current_date::text || uid) % 2 = 0`, mint one." This clones the cron-free determinism of `daily_shop()` rather than the `judgement-day-season-1` `cron.schedule` path.

## Economy
- **Tickle faucets:** none by default. If a "first letter of the day" tiny reward is ever added, it must route through `grant_tickles()` (the only over-cap-safe faucet) and — being the first over-cap grant — must ship the `GREATEST(...)` display-debt fix to `home_stats` + `admin_tickle_overview` noted in `20260580000000_settle_tickles.sql`. Default spec ships **no faucet** to avoid that obligation.
- **Snout sinks:** attaching a **gift postcard** is an optional small sink — a counter→counter *transfer* to the recipient (SNOUTS move, never mint), or a pure burn for a system-stranger gift (e.g. 5 snouts to "tip the tinker"). Both are zero-mint.
- **Cosmetic rewards:** postmark stamps + festival cosmetics granted via `user_hats … ON CONFLICT DO NOTHING`, cost 0, non-purchasable, non-tradable.
- **Why it can't inflate:** the entire feature mints **zero** currency. Dispatch and season-skin touch no economy at all; letters move snouts only as zero-sum transfers or burns; cosmetics are non-market grants. There is no tradable hard-currency surface, so it sidesteps the Neopets inflation trap the synthesis warns against.

## Anti-abuse / cheat model
- **No free-text → no moderation cheat surface.** Letters and replies are canned `phrase_id`s validated server-side against an allowed deck; an attacker cannot inject arbitrary text (Tier-1 content abuse eliminated by construction).
- **Reply idempotency:** `almanac_replies` PK `(letter_id, replier_id)` makes double-submit a no-op — the same depleting-claim discipline as `truffle_digs`' PK guards `dig_truffle`.
- **Cosmetic-farming resistance:** stranger-letter minting is **date-seeded per-user** (`hashtext(current_date::text || uid)`), so spamming logins can't summon extra letters; friend letters are rate-capped 3/day + 1h/target. Milestone cosmetics are one-time `ON CONFLICT DO NOTHING` grants.
- **Collusion / vote-gaming:** there is nothing to vote on and no leaderboard, so the Tier-2 collusion vectors (ring-trading, sockpuppet upvotes) don't apply. The only social transfer is the optional snout gift, which is zero-sum and already covered by the closed-economy invariant.
- **Block respect:** `send_pen_pal` reuses the friend-request block check (`20260620000000_fix_friend_request_block_check.sql`) so a blocked user cannot pen-pal-spam around the block.
- **Determinism = no server trust in the client:** the dispatch is computed server-side via `todays_dispatch()`; the client can't forge tomorrow's line.

## Feel
- **Slow time** (the headline lens): the calendar turns at the pace of the real world; you cannot rush a season or summon a stranger faster than the date-seed allows. This is the synthesis's "slow cadence you cannot rush," delivered ambiently.
- **Wonder / discovery-as-content:** a shared deterministic dispatch becomes folk knowledge ("did you see what the almanac said today?"), the same emergent-discovery texture the docs call out in the hidden-interaction layer.
- **Hangout / belonging:** canned-phrase letters give a low-stakes, low-anxiety reason to reach into the Sounder — warmth without the pressure of a chat box.
- **Cozy guardrail:** no loss, no punishment, no PvP, no streak attached. Missing a day costs nothing; the world simply turned without you and tells you so gently. Voice stays playful/mythic, never vicious — the same tone guardrail the Schism dispatch holds.

## How it composes
- **Schism Front meta-frame:** the daily dispatch is the *cheapest renewable content lever* the synthesis names, and Slice B is built **band-aware** precisely so that when the Front exists, `todays_dispatch()` reads the Tide band and narrates the war ("the Mire held through the frost") — the Almanac becomes the Front's *voice* with no rework. This is the doc's "build the gauge once (the Front), add the Almanac's narrator/story layer as a skin."
- **Garden / Devotion:** the monthly forage rotation sits beside the streak's 5-stage Garden visual without contending for Rosie's pose (happiness owns that), respecting the established ownership seams.
- **Sounder:** pen-pal letters ride the existing friends graph and the "while you were away" announcement modal — no new membership table, mirroring the synthesis's "Sounder-level rollup, no new table" instinct.
- **Festival (deferred) ↔ finalize_season:** if the pilgrimage is ever built, its festival resolves by chaining off `finalize_season()` in its own `BEGIN/EXCEPTION` block, exactly as the Schism Front's `settle_schism_season()` is specified to — never a competing seasonal cron.

## MVP
The smallest shippable seed proves "the world knows what day it is" with **one migration + one RPC + one component**, no cron, no letters, no map:
1. **One migration** (`≥ 20260624000000`): create `almanac_dispatches`, seed ~30 neutral templates, add `todays_dispatch()` (clone of the `daily_shop()` hashtext idiom; STABLE, SECURITY DEFINER, GRANT authenticated).
2. **One client util** (`utils/almanac.ts`): `seasonOf(date)` + the 4 season overlay selectors (Slice A, zero schema).
3. **One component:** an Exterior almanac strip rendering the season palette overlay + `todays_dispatch().body` on the barn wall (style after the existing `BarnActiveEffectsStrip` chips).

That alone delivers Slow Time + Wonder as standalone ambient tissue. **Increment 1:** monthly forage sprite in the Garden. **Increment 2:** Slice C pen-pal letters (the social slice) — `almanac_letters` / `almanac_replies` + `send_pen_pal` / `reply_letter` + postcard-deck component. **Increment 3 (only if warranted):** band-wire the dispatch to the Schism Tide. **Deferred indefinitely:** the pilgrimage route + festival.

## Risks & open questions
- **Solo-dev content cadence is the real cost.** ~30 dispatch templates × bands + a postcard phrase deck + 4 season overlays is the upfront authoring; cadence is the hazard the synthesis flags about the Wandering Almanac. Mitigation: author once, replay annually; lean on banding so the Schism reuses the same pool.
- **Hemisphere skew:** Slice A defaults to N hemisphere; S-hemisphere players see "winter" in their summer. Acceptable for MVP; a profile flag fixes it later.
- **Device-clock spoofing of Slice A:** purely cosmetic, so low stakes; the dispatch (Slice B) is server-computed and unforgeable.
- **Ambient inertness:** an ambient layer nobody notices is wasted. Mitigation: make the dispatch shareable (deterministic, same for all) so it becomes folk-knowledge, and surface the season change as a one-time "the seasons turned" announcement card.
- **Overscope creep:** the pilgrimage is genuinely XL and tone-risky (mandatory-feeling waypoints clash with the cozy, no-punishment guardrail). Keep it **deferred** until the cheap slices demonstrably make the world feel alive.

**Questions:**
1. Default the season skin to N hemisphere for MVP, adding a per-profile hemisphere flag only if S-hemisphere players complain?
2. Ship Slice C pen-pal letters as Sounder-only first (no system "road-stranger" personas) to halve the authoring and defer the persona voice?
3. Confirm the dispatch ships band-aware from day one (so the Schism narrator layer is free later), even though the only seeded band at MVP is `neutral`?
4. Confirm **no tickle faucet** in v1 (so the first over-cap `grant_tickles` + `GREATEST` display-debt fix obligation does not land on this feature)?
5. Hold the full pilgrimage as deferred indefinitely, revisiting only after the ambient slices prove retention lift?