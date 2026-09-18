# Pig errands — spec (Build 1 of the scavenging pigs)

Plan: `docs/design/scavenging-plan-2026-09-17.md` (§2 rulings R1–R12, §3 Build 1). Canvas: `docs/design/claude-design/errand-2026-09-17/`. Style and seams follow `docs/satchel-spec.md`: the Satchel is the only bag, the swap is the only gift, the server owns every number.

**One sentence.** Send a pig to look for a Find; hours later it comes back with it or without it; you give it to the friend who wished for it, or keep it.

## The spine

- **Only a Find is ever minted.** `claim_errand` inserts at most one `satchel_items` row (two when Pockets allows, Build 2), through the same insert path a dig receipt uses. Give is `swap_with_host`'s gift path with `source = 'errand'`. Nothing else moves.
- **One errand per pig per local day.** A recall spends the day. A failed send doesn't.
- **Rosie is sendable.** Home shows the empty yard and says when she's back. A companion is a second worker at the same rate.
- **Fail closed.** Every RPC answers `{ok:false, reason}`; the client never rolls, never guesses a return, never draws a pin from local state.

---

## Step 1 — Tuning and the flag

`app_settings.errand_tuning` (compiled fallback `constants/errands.ts`, read through a config cell in `utils/errands.ts` exactly like `utils/satchel.ts`):

```json
{"enabled": false,
 "duration_hours": {"trot1": 6, "trot2": 4, "trot3": 2},
 "target_odds_pts": {"common": 60, "uncommon": 40, "rare": 20},
 "nose_bonus_pts": {"1": 0, "2": 10, "3": 20},
 "anything_weights": {"glint1": [70,25,5], "glint2": [60,30,10], "glint3": [50,35,15]},
 "distracted_pts": 10,
 "board_cap": 3,
 "pigs": {"rosie":   {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
          "copper":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
          "pepper":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
          "bandit":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
          "pickles": {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
          "biscuit": {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null}}}
```

Build 1 ships every pig identical (Trot 2 = 4 h). Build 2 is a JSON change to `pigs` plus the `family` column. `enabled=false` hides the action, the fan row and the yard line; open errands still return and can be claimed.

**Done when:** the config cell returns the fallback offline and the row online; a unit test proves a malformed row falls back per key, not per document.

## Step 2 — Migration `2026MMDDHHMMSS_pig_errands.sql` (additive; no push without the explicit go)

```
pig_errands (
  id bigserial PK,
  user_id uuid NOT NULL,
  pig_id text NOT NULL,                       -- rosie | copper | … (CHECK against the roster)
  target_find_id text NULL REFERENCES satchel_finds(id),   -- NULL = anything
  for_user_id uuid NULL,                      -- the friend whose wish it is
  for_wish_no bigint NULL,                    -- their wish number at send time
  local_day date NOT NULL,                    -- the pig's feeding time zone, like trader_visits
  started_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  seed text NOT NULL,                         -- committed at send; the roll is a pure function of it
  status text NOT NULL CHECK (status IN ('out','back','kept','given','recalled')),
  result_find_ids text[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz NULL, claimed_at timestamptz NULL,
  nonce text NOT NULL,
  UNIQUE (user_id, pig_id, local_day),
  UNIQUE (user_id, nonce)
)
```

RLS: owner reads own rows; every write is through the RPCs (SECURITY DEFINER, `REVOKE … FROM PUBLIC, anon`).

Helper: `_errand_local_day(uid)` = the same time-zone rule `trader_visits` uses. `_errand_roll(seed, target, pig)` = a pure SQL function: `_trader_unit(seed || ':find')` against `target_odds_pts + nose_bonus_pts` → hit; else `distracted_pts` → one *anything* find by the pig's Glint weights; else empty. Build 1's pigs make Nose/Glint constants, but the function reads the tuning so Build 2 is data.

**Done when:** the migration runs on the stubbed-Postgres harness (`scripts/db-harness/run.sh`) and `_errand_roll` is deterministic under `ttp.fake_now` (same seed → same result at any time).

## Step 3 — RPCs

| RPC | Does | Refuses (`reason`) |
| --- | --- | --- |
| `send_pig(pig_id, target_find_id?, for_user_id?, nonce)` | Checks the roster (pig owned or Rosie; a lapsed member's companion → `pig_resting`); one per pig per local day; `for_user_id`'s live wish equals `target_find_id` (else `target_not_wished` with the live wish); writes the row `out`, `ends_at = now + duration(trot)`, seed; if `pig_id` is the pig at Home, flips `pig_away = true` on the profile (Step 6). Same nonce → the original row, `replay: true`. | `errands_disabled`, `pig_unknown`, `pig_resting`, `pig_already_out`, `errand_used_today`, `target_not_wished`, `not_friends` |
| `pig_errands()` | Materialises: any row `out` with `ends_at <= now` → `_errand_roll` → `back`, `resolved_at`. Returns every `out`/`back` row plus today's used-flag per pig, the board (`back` rows, newest first, capped by `board_cap`), tuning. Read on every Pen open, Home open, fan open. | — |
| `claim_errand(id, action, nonce)` | `keep`: inserts the result rows into the Satchel through the dig-receipt insert (bag full → `bag_full`, row stays `back` — "he's keeping it in his mouth"). `give`: calls the gift path of `swap_with_host(for_user_id, …)` with `source='errand'`; if the friend's wish moved → `wish_moved` and the client offers *keep*; if the friend's bag is full → `host_bag_full`, same. Marks `kept`/`given`, `claimed_at`. Nonce-idempotent. | `not_back`, `bag_full`, `wish_moved`, `host_bag_full`, `already_claimed` |
| `recall_pig(id)` | `out` → `recalled`, empty result, `pig_away = false`. The day stays spent. | `not_out` |
| `dev_summon_return(id)` | DEV (`is_test` + the `dev_end_war_now` gate): sets `ends_at = now`. | — |

`tickle_breakdown` and the swap ledger carry verbatim: an errand pays no tickles of its own; a Give pays through the swap lane that exists (flat 3 each, the pair and pig caps).

**Done when:** harness tests cover every `reason` above, replay, recall-spends-day, failed-send-doesn't, and "give is exactly one `swap_with_host` gift row with `source='errand'`".

## Step 4 — The push

pg_cron every minute: rows `out` with `ends_at <= now` and `notified_at IS NULL` → enqueue through the existing push sender with `screen = 'pen'`, title *"{Pig}'s back"*, body *"{He/She} found {the thing} {Friend}'s {pig} was hoping for."* or *"Back from the hedge — come and see."* (the body never reveals an empty result; the Pen does that warmly). `utils/notificationRouting.ts`: `pen` → `/pen` (the table is the one source of truth; add the guard-test row).

**Done when:** the routing guard test lists `pen`; a fake_now run enqueues exactly one push per errand.

## Step 5 — Roster and the yard

`utils/pigRoster.ts` / `hooks/usePigRoster.ts` learn `away: PigId | null` (from `pig_errands()`): the Home greeter is *away* when its errand is `out`. Home (`components/Barn.tsx` exterior): when the greeter is away, no `PigStage` — the mound, the sticker *"Rosie's out looking · back by 7:40 · tap to visit the Pen"*, corners intact, the fan gains a `Rosie · out` row (`components/BarnButton.tsx`, beside Trader, never replacing it). Tickle taps on the empty yard wobble the sticker.

**Auto-Tickler pauses** while the greeter is away (`utils/activeEffects` / the contraption service checks `away`). A visitor (`app/visit`) sees the same sticker; bless/wish work; the tap-tickle bar reads *she's out*; the Visit Streak credit is unchanged (opening the yard is the visit).

**Done when:** the Barn snapshot test renders the empty yard; the Auto-Tickler test proves zero automatic spends while `away`.

## Step 6 — The Pen (screen)

`app/pen.tsx` keeps its crown; `components/PigPenView.tsx` is rebuilt from the canvas:

1. `components/pen/Paddock.tsx` — the sky sticker; `PigStage` ×2 (Rosie + the pig the card is about) on idle loops; Reduce Motion = rest frame; the pig that is out is absent and the note says so.
2. `components/pen/FenceRow.tsx` — six medallions (Rosie first): `home · selected · out (dashed, faded) · back (sun dot) · resting (lapsed)`. Tap = the card is about that pig.
3. `components/pen/PigCard.tsx` — nameplate (tap → the about-sheet, Build 2; Build 1 shows coat only), the **job segment** *At home · In the Pen · Out looking* (At home/In the Pen is the existing `activate` toggle; *Out looking* is a readout, never a tap target), and **one action** by state: *Send {pig} to look for…* · the errand in progress + *Call him home* (ghost) · the homecoming (below) · the join/recruit actions the Pen has today for a non-member / unrecruited member.
4. `components/pen/SendSheet.tsx` — friends' wishes (`friend_wishes()` exists) first, your pig's wish, *anything*. Rows are `ListRow`; the find is a coin.
5. `components/pen/ErrandTicket.tsx` — the one confirm both entrances land on: target stub, `pigPick` (every pig at home; one already out is dashed *out*), back-by from `duration(trot)`, *one errand a day*, **Send {pig}** (gold). Send is optimistic: the pig walks out; `{ok:false}` walks him back with the toast.
6. `components/pen/Homecoming.tsx` — plays once per `back` row on the first open: walk in, the find on the `snout` anchor (`resolveSlot` with a find glyph as a `held`-style overlay), tape note, **Give it to {friend}** (gold) / **Keep it** (paper), the honest line (*giving pays you both 3 · keeping puts it in your Satchel 4 of 6*). Empty result: muddy trotters, *Ok, {pig}*. Bag full: *Open the Satchel* / *Toss it*.
7. `components/pen/Corkboard.tsx` — under the fence row when any `back` row is unclaimed: pins (*for Maya · anything · muddy trotters*), tap → the homecoming for that row. Cap `board_cap`; the pig's card says *resting until you look* when at cap.
8. Friends row (`components/Friends.tsx` / `SocialRows`): a wish you can fill keeps *give it*; one you can't gets *send a pig* → the ticket with `for_user_id` preset; one a pig is out for shows *back ~7:40*.

Every surface: `Sticker`/`Button`/`Tag`/`EmptyState`/`LoadingBeat`/`Glyph`, tokens only, no emoji, motion through `useMotionPolicy`. Error and loading states as drawn on the canvas's states board.

**Done when:** the canvas's nine boards each have a matching screenshot from the 17 Pro sim (demo account, `dev_summon_return`), and the UI tests cover: optimistic send + revert, board cap, homecoming shows once, recall dialog copy.

## Step 7 — Art

One Codex ImageGen pass per pig from the Lounge walk strips (`project_lounge_sprite_pipeline`): *walk out* (right-facing, 6 frames) and *walk in* (left-facing = mirrored). Slice → strip disc/specks → `normalize_body_pink --check` → wire as a new render-only variant on the `walk` anchors (hats keep the walk family's anchors; nothing new to place). The find glyphs exist.

**Done when:** the six strips pass the pink-band check and the placement studio's Sheet tab shows every hat on the walk-out pose.

## Step 8 — Instrumentation and docs

Events, emitted in the RPC transaction: `errand_sent {pig, target_kind: friend|own|anything}`, `errand_returned {found: 0|1|2}`, `errand_claimed {give|keep}`, `errand_recalled`. Field Guide page *the Pen* (silhouette until the first send; numbers from tuning). `CONTEXT.md`: **Errand**; amend **Pig roster**. `SKILL.md` decision log entry on ship. Build changelog before the build (`docs/builds/`).

## Step 9 — Rollout

1. Migration validated on the harness → **wait for "push it now"** → push.
2. `enabled=false` in prod; `is_test` accounts flip a per-profile override for one week (`profiles.is_test` gate, like `dev_summon_trader`).
3. Watch: sends/day, return-open-within-24 h, Give:Keep, Trader applied tickles per pig-day (must stay within ±20%), Auto-Tickler spends while away (must be 0).
4. `enabled=true`. Kill switch is the same flag; open errands still return.

## Edge cases (the list the harness tests)

- **Empty hands** — `back` with `result_find_ids = '{}'`: muddy trotters; the wish stays; tomorrow is free.
- **Satchel full on keep** — `bag_full`; the row stays `back`; the pin stays; Give still works (a gift never enters your bag).
- **Friend's wish moved while out** — Give answers `wish_moved`; the client offers Keep with *"someone beat him to it"*.
- **Friend's bag full** — `host_bag_full`; offer Keep.
- **Recall** — empty-handed, day spent, `pig_away` cleared; the dialog says so before the tap.
- **Send failed** — no row; the pig turns round at the gate; a toast; the day is not spent.
- **Push before materialisation** — the Pen shows the pig *at the gate* with a `LoadingBeat` until `pig_errands()` answers.
- **Two devices** — nonce replay returns the original row; a second `claim_errand` answers `already_claimed`.
- **Lapsed member** — companion `pig_resting`; Rosie still goes.
- **Rosie out + visitor** — empty yard, bless/wish work, no tickle, streak credit unchanged.
- **Clock skew / fake_now** — every time check is `_patch_now()`; `ends_at` is server time; the client shows *back by* from the row, never its own clock.
