# Combined-build ship audit (2026-10-29)

The consolidated `main` (`feat/matchmade-play` fast-forwarded, tip after
`3f7a87af`) is what a combined build would carry. This matrix lists every
player-reachable or bundled feature in that tree: where it lives, how it is
gated, which server migration it needs (and whether that migration is on prod),
and the recommended posture for this build.

**Posture key:** **ON** = live for players. **DARK** = shipped in the binary,
off behind a server flag or an inactive server row. **DEV-ONLY** = only reachable
under `__DEV__`; production redirects. **REMOVE** = should not ride this build,
or not in the tree at all.

**Gates on this tree (2026-10-29):**
- Jest: 325 suites passed, 1 skipped. 3,772 tests passed, 2 skipped, 0 failed.
- `tsc --noEmit`: clean. Checked on the working tree and on a clean worktree of the committed tip.
- `npm run lint`: 0 errors, 531 warnings.
- `npm run lint:web`: green.
- DB harness: green with the documented arg list, including the new A2 referral-cleanup smoke.

## Pending migrations (none pushed)

| File | Sorts after the applied `20261004201000`? | What it does |
|---|---|---|
| `20260922100000_endless_wallow` | **No.** Needs a re-timestamp before any push | The W7+ rank prizes, re-slots the Marsh Wreath, takes decor gifts off the ladder, back-pays W7+ |
| `20260922120000_preset_sounder_message_copy` | **No.** Needs a re-timestamp | Takes the em dash out of the `patch_open` preset (CHECK, sent rows, `send_sounder_coordination`) |
| `20261004230000_matchmade_play` | Yes | `play_*` tables, `play_leaderboard`, `app_config.multiplayer = false`, `app_settings.multiplayer.url` |
| `20261004231000_catalog_copy_polish` | Yes | Exact-match copy UPDATEs to titles and achievements |
| `20261014180000_seasonal_card_item_unlocks` | Yes | Seasonal card sets and unlocks, seeded **inactive**, no mappings |
| `20261014200000_halloween_login_costume_gift` | Yes | Costume catalog and login-gift campaign, seeded **inactive**, with a `minimum_client_build` gate |
| `20261029170000_halloween_weekend_shelf` | Yes | Main session's. Untracked here. `daily_shop()` leads with 4 existing items, 10-30 to 11-02 UTC |

Applied on prod and now tracked: `20261004201000_account_deletion_referral_cleanup` and
`20261013000000_extend_great_hunger_season`. Before any push, re-check
`migration list --linked`, because parallel sessions push too.

## Ship matrix

| # | Feature | Where | Gate | Server dependency | Posture |
|---|---|---|---|---|---|
| 1 | **Shop and daily shop** | `app/(tabs)/shop.tsx`, `components/shop/*`, `useShopCatalog` | none | `daily_shop()` (`20260761000000`, applied). The weekend shelf `20261029170000` is unpushed and server-only, so old binaries see it too | **ON** |
| 2 | Halloween weekend shelf (Skull Mask, Pumpkin Patch, Firefly Lantern, Candy Land) | server only | date window in SQL | `20261029170000`, not pushed (main session) | **ON on push go.** No client change |
| 3 | **Halloween accessories (29)** | not in the tree. Art is being produced into untracked `assets/images/hats/halloween-2026/` | none | no `hats` rows, no RelSpec, no `HAT_IMAGES` entries | **REMOVE** (not in this build) |
| 4 | **Halloween backgrounds (9)** | not in the tree (untracked `assets/images/backgrounds/halloween-2026/`) | none | none | **REMOVE** (not in this build) |
| 5 | **Halloween costumes (11)** | `features/cards/data/costumeFits.ts`, `assets/images/costumes/` | Rosie-only fits, no equip slot | `costume_catalog` in `20261014200000`, inactive | **DARK**, but see row 6 for the bundle cost |
| 6 | **Halloween login gift** | `components/HalloweenLoginGift.tsx`, `hooks/useHalloweenLoginGift.ts`, `utils/halloweenLoginGift.ts`, wired in `app/_layout.tsx` (popup slot 35) | Server: campaign `active=false`, plus `minimum_client_build`. Client: native build > 0. A missing RPC reads as `inactive` | `20261014200000`, not pushed | **DARK.** Mounted in production, and `_layout` imports `costumeFits`, so about **19 MB of costume PNGs** and `CostumeRosieStage` from `components/prototypes` are in the release bundle |
| 7 | **Spooky Snouts card set** (`halloween_2026_v1`) | `features/cards/*`, `assets/images/trading-cards/halloween-2026/` (80 MB in git) | `__DEV__` routes only | `20261014180000`, inactive, not pushed | **DEV-ONLY** |
| 8 | **Card-packs prototype** | `app/card-packs-prototype.tsx` → `components/prototypes/card-packs/CardExperience`, Rive in `assets/rive/card-packs/` | `__DEV__ ? require(...) : <Redirect href="/(tabs)/shop">` | none (local prototype authority) | **DEV-ONLY.** The route exists in production and redirects |
| 9 | **Halloween gallery** | `app/halloween-gallery.tsx` | same `__DEV__` pattern | none | **DEV-ONLY** |
| 10 | **Old Wisp** spooky-trader prototype | `features/cards/domain/spookyTrader.ts`, `components/prototypes/card-packs/SpookyTraderMiniGame.tsx` | reachable only inside the `__DEV__` card prototype | none. Blocked on the per-copy ownership vs. permanent-unlock conflict (plan, Phase 3) | **DEV-ONLY** |
| 11 | **Ghost Sheep trader** (live) | `components/trader/*`, `utils/trader.ts`, the fan row in `BarnButton` | server `trader_status()`. A missing RPC reads as "not here" | `20260917170000` and `20260920100000` (pays tickles). Both applied | **ON** |
| 12 | **Matchmade Play** (Play hub, 5 boards, invites, matchmaking, wins board) | `app/play/{index,[code],wins}.tsx`, `hooks/useMultiplayer.tsx`, `utils/multiplayer/*`, `multiplayer/` engine | `useFeatureFlagState("multiplayer")`. `EXPO_PUBLIC_PLAY_FORCE_ON` is honoured only under `__DEV__` | `20261004230000`, **not pushed**: the flag row does not exist, so Play is off for everyone. **Needs the `server/` Play server deployed:** a Node 24 WebSocket service on **Render** (`render.yaml`, service `ttp-play`, Ohio, `0.5c-512mb` paid, 1 instance, manual deploys, secrets set in the dashboard). Client default URL is `wss://ttp-play.onrender.com/ws` (`utils/multiplayer/config.ts`), with an override in `app_settings.multiplayer.url`. **`https://ttp-play.onrender.com/healthz` returned 404 on 2026-10-29, so the service is not deployed** | **DARK** |
| 13 | **Pig errands** | `hooks/usePigErrands.ts`, `utils/errands.ts`, `components/PigPenView.tsx`, `app/pen.tsx` | server `pig_errands()`, flag off for non-test players | `20260918120000`, applied 2026-09-18 | **DARK** |
| 14 | **Snout Deep** | `components/mudwar/SnoutDeep*`, `utils/snoutDeep.ts`, `useRooting` rules 2 | `useFeatureFlag("snout_deep")`, ON since 2026-09-17 | `20260913060000` and the 0917 attention rules, applied | **ON** |
| 15 | **Endless wallow** (lifetime W-rank, regalia, a prize every rank) | `utils/wallow.ts`, the rank sheet, Me row, Home tickle mark (`f384a5c9`) | **none on the client.** The UI already shows the ladder and has removed the Prestige gear row, the Closet prestige filter and the Barn decor rank-gifts | `20260922100000`, **not pushed**, and it sorts before the applied `20261004201000` | **Founder decision.** Push it (re-timestamped) before release, or the binary promises W7+ prizes the server does not pay |
| 16 | **Drum draw** (Season page: Feed · Draw · Pass) | `components/season1/almanac/DrawPanel.tsx`, `MondayDrawSheet`, `DrawRevealSheet` | none | `20260921150000`, applied with build 196 | **ON** |
| 17 | **Satchel and swaps** | `components/satchel/*`, `components/visit/{SatchelStrip,OfferTray,WishBubble}`, `utils/satchel.ts` | none | `20260915010000`, `20260917100000` and `20260918090000`, applied | **ON** |
| 18 | **Feeding schedule, player-local mode** | `utils/feedingConfig.ts`, `useFeedingTimeZoneRegistration` | `app_settings.feeding_schedule`, currently uniform 8 h (reverted 2026-09-17) | already applied, so it is only a settings UPDATE | **DARK.** Flip only after 1.3 (or this binary) is the store build, because build 143 compiles the 8 h clock in |
| 19 | **Season machinery** | `hooks/useSeason.ts`, `useSeason1Active` (`world_boss` flag), `app/(tabs)/season.tsx` | server `active_season()` | `snout_season_1` ends **2026-11-12 00:20 UTC** (`20261013000000`, applied) | **ON.** A successor is needed by 11-12 (see below) |
| 20 | Copy sweep (no em dashes), slop-tells fixes | about 128 files (`5452304c`) | lint rule `ttp/no-em-dash-copy` | the server copy halves are `20260922120000` and `20261004231000`, both unpushed | **ON.** Push the two copy migrations so server strings match |
| 21 | Accessory attachment and shared pig playback | `components/ui/{PigStage,SpritePig,usePigPlayback}.tsx`, `constants/pigAttachmentFrames.generated.ts` | none | none | **ON.** Fresh device acceptance is still owed (`pig-accessory-frame-attachment` follow-up) |
| 22 | Account-deletion referral repair | server only | none | `20261004201000`, applied | **ON** |
| 23 | Rewarded ads | `features/rewarded-ads/*` | `useFeatureFlag("rewarded_ads")` | applied | unchanged by this build |

## Season machinery and old binaries

- **How the season is chosen.** `public.active_season()` (latest definition in
  `20260709000000_season_renumber.sql`) returns the newest `seasons` row with
  `starts_at <= now() <= ends_at`. A per-profile `feature_overrides.world_boss`
  pins `snout_season_1`. The client hardcodes no season id: `useSeason` reads
  everything from `get_season_state`, and "Season 1 exists" is the separate
  `app_config.world_boss` flag (`hooks/useSeason1Active.ts`).
- **Gaps.** When no row is active, every build shows "No season is running
  right now." This happened on 10-12 until `20261013000000` was applied.
- **Old binaries (App Store 1.2 = build 143).** When a new `seasons` row
  becomes active, old binaries pick it up automatically, because they render
  tiers and XP from the server. They can only draw reward items whose art is
  compiled into build 143. A new item's id falls through `HAT_IMAGES[id] ?? null`,
  so that slot renders without art.
- **The season successor must therefore:**
  - reuse existing art, or accept blank tiles on 1.2;
  - keep the RPC shapes that 1.2 calls (`get_season_state`, `wallow`,
    `daily_shop`, `open_rooting`).

## Force update / minimum version

**There is none.** A search of `app/`, `components/`, `hooks/`, `utils/`,
`constants/` and `features/` for min-version, force-update, required-build,
`minSupported` or store-version patterns finds nothing. There is no
`expo-updates`.

- The installed build number is read in three places:
  - `app/_layout.tsx`: only to feed the Halloween gift's server-side `minimum_client_build`;
  - `hooks/useMultiplayer.tsx`: `clientInfo()` for the play server;
  - `components/Account.tsx`: display only.
- The only server-side build gate in the repo is `login_gift_campaigns.minimum_client_build` in the unpushed `20261014200000`.
- Every compatibility promise is therefore fail-soft per RPC (`missing_function` → off). Old binaries can never be made to upgrade.

## `__DEV__`-only routes still bundled (route registered; production redirects)

All of these use `const Screen = __DEV__ ? require(...) : <Redirect/>`, so Metro
drops the prototype module from a release bundle. The route itself still exists.

| Route | Route | Route |
|---|---|---|
| `ad-refill-preview` | `idle-battler-prototype` | `ritual-bubble-preview` |
| `barn-housing-preview` | `living-mud-preview` | `rosie-gallery` |
| `barn-visit-preview` | `lounge-prototype` | `snout-deep-preview` |
| `card-packs-prototype` | `member-perks-prototype` | `ui-audit` |
| `expedition` | `pen-preview` | `while-away-preview` |
| `halloween-gallery` | `pig-angle-audit` | |
| | `pig-side-preview` | |

Partial `__DEV__` gates inside live screens:
- `app/lounge.tsx`: a debug HUD;
- `app/mote-machine.tsx`: `?acceptance` param;
- `app/(tabs)/season.tsx` and `app/_layout.tsx`: dev affordances.

**Exception:** the Halloween login gift is not `__DEV__`-gated. It pulls
`components/prototypes/card-packs/CostumeRosieStage` and the costume art into
production (row 6).

## Rows that need a founder decision

1. **Endless wallow (row 15):** push the re-timestamped migration before this binary ships, or the ladder UI over-promises.
2. **Login-gift bundle weight (row 6):** ship the dark modal plus 19 MB of costume art, or unwire it from `_layout` for this build.
3. **Matchmade Play (row 12):** stays dark until the Render service is deployed and `20261004230000` is pushed. Decide whether to deploy now (for `is_test` testers) or after.
4. **Season after 11-12 (row 19):** extend again or start Season 2. Author by 11-07, mindful of build 143's art.
5. **Copy migrations (row 20):** re-timestamp and push `20260922120000`. Push `20261004231000`.
6. **Weekend shelf (row 2):** push go by 10-30.
7. **Halloween accessories and backgrounds (rows 3–4):** not in this build. The binary to carry them is 1.4.
8. **Feeding local mode (row 18):** flip only after a 1.3+ build is the store build.
9. **Card / Old Wisp prototypes (rows 7–10):** keep them dev-only. Their card and Rive art is reachable only through `__DEV__` requires, so it is not in the release bundle (it is still about 90 MB in git).
10. **Accessory attachment (row 21):** device acceptance before release, since it changes every head item's per-pose scale.
