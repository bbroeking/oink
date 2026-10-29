# Consolidate and ship: 1.3 approval, Halloween in the shop, the roaming trader

Written 2026-10-29. Planning and review stay in the main session; every work package below is executed by an Opus subagent (`model: "opus"`) handed the package text, `CLAUDE.md`, and the files it names. DB pushes, git pushes, builds, Transporter and App Store Connect steps wait for the founder's explicit go.

## Where things stand (verified 2026-10-29)

**Repos.** `oink` is the only repo with anything left to absorb. The three siblings fork from build 180 (`7f71b90`) and are already in `oink`:

| Repo | Verdict |
|---|---|
| `oink-feeding-release` | Nothing to absorb (only deleted `output/` files) |
| `oink-living-mud-release` | Fully absorbed in `a59d5c51` |
| `oink-server-clock-release` | Absorbed in `d03246d7`; one test (`useRootingClockGate.test.tsx`) never ported, and only its `clock_unavailable` case still lacks coverage (`hooks/useRooting.ts:414`) |

Inside `oink` the real consolidation is git hygiene:
- 221 uncommitted entries on `feat/matchmade-play` (141 modified, 80 untracked).
- `feat/matchmade-play` is 9 commits ahead of `main`.
- Local `main` is 1 ahead of `origin/main` (`f384a5c9`, endless ladder).
- `20261004201000_account_deletion_referral_cleanup.sql` is applied on prod but untracked here; it is only committed on `codex/release-1-3-deletion-repair`.
- 64 `codex/homegrown-*` branches are August prototype comparisons. Only `a1b03a54` (stray Adventure moth, web prototype) is a real fix.

**Release.**
- **Live on the App Store:** 1.2 (build 143).
- **v1.3:** never submitted. The App Store Connect draft has no build selected.
- **Build 196:** delivered 2026-09-21 and Ready to Submit. Its release-candidate status was withdrawn 10-04 because the account-deletion repair changed prod.
- **Build 198:** planned as 196 source plus that one migration (already applied on prod), so its client binary would be identical to 196. Never built.
- **Build 199:** TestFlight-only validation build. Never built.
- **Checklist:** `docs/app-store/1.3-remaining-checks.md`.

**Tests on the working tree:**
- Jest: 3,769 pass, 2 fail (`relPerAnim`, `pigStageSideSprite`, the accessory-geometry pair the Halloween preflight recorded).
- `tsc`: clean.
- Lint: 0 errors, 531 warnings.

**Season.** Prod `snout_season_1` ends **2026-11-12 00:20 UTC** (the 10-13 extension is applied). Something must replace or extend it before then.

**Migrations not yet pushed:**
- `20260922100000_endless_wallow` and `20260922120000_preset_sounder_message_copy`. Both sort before the applied `20261004201000`, so they need re-timestamping.
- `20261004230000_matchmade_play`
- `20261004231000_catalog_copy_polish`
- `20261014180000_seasonal_card_item_unlocks`
- `20261014200000_halloween_login_costume_gift`

**Halloween.** None of the 49 designed items (29 accessories, 11 costumes, 9 backgrounds; `docs/design/halloween-2026/content.json`) is buyable:
- no transparent shop art (card art only);
- no RelSpec;
- no `hats` row.

Costumes have Rosie front-idle fits only, and there is no costume slot to equip into. There is **no `expo-updates`**, so every new item needs a binary through App Review. The full set cannot reach players by 10-31.

Four items already in the shipped catalog read as Halloween and are sellable rows on prod:

| Item | Rarity | Price |
|---|---|---|
| Skull Mask | epic | 818 |
| Pumpkin Patch | rare | 650 |
| Firefly Lantern | rare | 600 |
| Candy Land | rare | 711 |

**Trader.** The live Ghost Sheep buys Satchel finds for tickles: one 6 h visit per pig per local day, 3 / 8 / 20 by rarity, the fancied find ×2, six per visit, tuning in `app_settings.trader_tuning`. The uncommitted "Old Wisp" (`features/cards/domain/spookyTrader.ts`, `components/prototypes/card-packs/SpookyTraderMiniGame.tsx`) is a local-only prototype: wearable requests plus friends swapping wearables. "Broker" and "roaming" appear nowhere in the docs yet.

**Claude Design.** The Design canvas type can be created and filled from the session (`create_from_type` + `publish_files`). **No Tickle the Pig Design System exists in Claude Design** (only Duskhold and Scoreboard), so a canvas made today would not carry `theme.ts`.

## Phase 0: unblock (today)

- **0.1 Supabase CLI auth.** The CLI cannot read its token from the keychain. To bypass the keychain:
  1. Create a personal access token at supabase.com › Account › Access Tokens.
  2. Save it in `.env.supabase` as `SUPABASE_ACCESS_TOKEN=…`. `.env*` is gitignored. Add `SUPABASE_DB_PASSWORD=…` if `db push` asks for it.
  3. Every CLI call runs as `set -a; source .env.supabase; set +a; npx supabase …` (the same pattern as the Sentry token).

  Read-only prod checks of public tables also work without the CLI, through the anon key in `utils/supabase.ts`.
- **0.2 Season after 11-12.** Founder decides: extend The Great Hunger again (copy `20261013000000`, keep the never-shorten guard) or start Season 2. Author by 11-07 and push on go by 11-10.

## Phase 1: one app, and 1.3 approved

Two tracks in parallel. The 1.3 binary comes from the release line, not from the consolidated tree, so consolidation can't put the release at risk.

### Track A: consolidate (Opus, no behaviour change)

| # | Package | Done when |
|---|---|---|
| A1 | Commit the working tree as reviewable commits, one per bucket: em-dash/copy sweep + 10-04 polish (~128 files); App Store 1.3 docs + build records; accessory attachment / pig playback; Halloween costumes + login gift (campaign off); trading cards / card-packs prototype (dev-gated); matchmade Play explorations. Leave out `build-*.ipa` and `.impeccable/` scratch | `git status` clean except ignored files; each commit builds (`tsc`) |
| A2 | Commit `20261004201000_account_deletion_referral_cleanup.sql` (identical to `3a07655c`) and wire it into `scripts/db-harness/run.sh` | Harness green |
| A3 | Port the `clock_unavailable` case from `oink-server-clock-release/__tests__/useRootingClockGate.test.tsx` against today's `useRooting` | New test passes |
| A4 | Resolve the two geometry failures. Main session rules on whether the expectation or `PigStage.resolveSlot` is right before Opus edits | Jest fully green |
| A5 | Re-timestamp `endless_wallow` and `preset_sounder_message_copy` past `20261004231000`, checking `migration list --linked` first (parallel sessions push too) | Pending set sorts after everything applied |
| A6 | Merge `feat/matchmade-play` → `main` and push both to `origin` | **Founder go**; `origin/main` = consolidated tree |
| A7 | Move the three sibling repos to `~/projects/_archive/`. Skip `a1b03a54` unless the founder wants the web prototype fixed | **Founder go** |

Gate for Track A: Jest green, `tsc` clean, lint 0 errors, `npm run lint:web` green, design scorecard still 0.

### Track B: 1.3 to the App Store

1. **Pick the binary.**
   - **Recommended: resubmit build 196.** It's already processed, and build 198's client binary would be byte-for-byte the same code (its only change is a migration that is server-side and already on prod).
   - **By the book:** build 198 from `3a07655c`, at the cost of a build, an IPA inspection and a processing cycle.
2. Founder rules on the exception list and the unanswered device checks in `1.3-remaining-checks.md`.
3. Founder runs device acceptance on the chosen binary against today's prod, including deleting a dedicated referrer and confirming the referee keeps their account with `referred_by` cleared. Check Sentry symbols and release health.
4. Founder go/no-go. Then, in App Store Connect: select the build, attach `monthly` and `yearly`, Add for Review, Submit.
5. After approval, the founder gives a separate go for the manual release.
6. **After 1.3 is live:** flip `app_settings.feeding_schedule` to the player-local mode that waited for 1.3 (decision log 2026-09-17), on go.

Matchmade Play, cards and Halloween stay out of 1.3.

## Phase D: the Claude Design gate (blocks 2b and 3)

Every trading- or item-related screen is designed from the ground up on a Claude Design canvas before any implementation.

"Ground up" means the experience, flows and layouts are new. The look stays governed by `docs/design/taste-standard.md` and the tokens in `constants/theme.ts`, because that governance is the taste standard's definition of quality.

- **D0: a Tickle the Pig Design System artifact.** Built from:
  - `DESIGN.md`, `constants/theme.ts` (`WHIMSY`, `FONTS`, `RADII`, `SPACE`, `TYPE`, sticker shadows), `web/tokens.css` and `web/sticker.css`;
  - the shared primitives (`Sticker`, `Button`, `SectionHeader`, `EmptyState`/`LoadingBeat`, `Glyph`/`Icon`);
  - the painted glyph family.

  Every canvas installs it.
- **D1: canvases.** Phone artboards at 390×844, using real art uploaded as assets, with two or three directions per surface. Each canvas also gets a local copy under `docs/design/claude-design/<surface>-<date>/`.

| Canvas | Surfaces replaced | Blocks |
|---|---|---|
| 1. Shop | `app/(tabs)/shop.tsx`, `components/shop/*`, `useShopCatalog`, `shopShelves`, `shopCounter`: shelves, a dated **seasonal shelf**, buy flow, members band | 2b |
| 2. Item preview + Closet | `ItemPreviewModal`, `HabitatItemPreviewModal`, `ClosetView`: try-on, equip, owned states | 2b |
| 3. Satchel + swaps | `SatchelSheet`, `visit/SatchelStrip`, `OfferTray`, `WishBubble` | 3 |
| 4. The trader | `components/trader/*`, the fan row in `BarnButton`: the visit as a scene, the trade, the receipt | 3 (after scope) |
| 5. Receiving an item | `DrawRevealSheet`, `MysteryHatReveal`, `RewardReturn`, `BarnRewardClaimSheet` | later |

For each canvas:
1. The founder picks a direction.
2. Log the decision in the taste-standard log, and in `SKILL.md`'s log when it's a product decision.
3. The main session writes the implementation brief.
4. Opus builds against the canvas.
5. The main session reviews the result against the artboard and the scorecard.

Canvases 1 and 2 go first because Halloween waits on them.

## Phase 2: Halloween in the shop

- **2a. Optional, server-only, by 10-31: a Halloween weekend shelf in the live app.**
  - **What:** one migration makes `daily_shop()` serve Skull Mask, Pumpkin Patch, Firefly Lantern and Candy Land between 10-30 and 11-02 UTC, then fall back to the normal hash.
  - **Before shipping:** confirm each item's art is in the build-143 binary. Pumpkin Patch landed 07-11, close to that build.
  - **Design gate:** none needed, because no screen changes; it is the existing shelf with different stock.
  - **Needs:** 0.1 working and the founder's push go by 10-30.
- **2b. The Halloween set, shipping in 1.4.**
  1. Canvases 1 and 2 (Phase D).
  2. **Art:** `tools/regen_studio.py` produces transparent, front-silhouette shop art for the 29 accessories and scene art for the 9 backgrounds. Every image is shown to the founder.
  3. **Placement:** `tools/placement_studio.py` gives each accessory a RelSpec. Review on the Sheet tab across pigs and poses. A4 lands first.
  4. **Server:** a migration with `hats` rows inside the rarity bands, a dated sale window (columns or a `seasonal_shelves` table) read by a seasonal-shelf RPC, and a window check in `buy_hat`. Authored in the main session, validated on the stubbed-Postgres harness, pushed on go.
  5. **Client:** `HAT_IMAGES` and the backgrounds map, plus the seasonal shelf built to canvas 1.
  6. **Costumes (11): recommend deferring.** They need a new full-body slot across Closet, Home and Visit for every pig and pose. The login-gift campaign stays off.
  7. Card packs and the Halloween gallery stay dev-gated and out of scope.
- **Open:** when the set runs. Either a dated late-autumn window when 1.4 lands, or held for October 2027 with the seasonal-shelf machinery reused for a winter set.

## Phase 3: the roaming trader

1. **Scope ruling (founder, with the `SKILL.md` lens).** Candidates:
   - **Trade-up and hands** (`docs/design/finds-sets-and-scavenging-2026-09-17.md` §4): three alike for one of the next rarity; pairs and flushes.
   - **The aspects round**: rumours of friends' wishes, a regulars' ledger and wearable, a weekly herd fancy, the visit as a scene.
   - **A broker between friends**: the Old Wisp's wearable requests and swaps. This is blocked on two things: tracking each wearable as an individual owned copy conflicts with the permanent-unlock promise, and paid items must never become convertible to currency.
   - **Roaming**: the visit moves between friends' barns, so the herd shares one sighting (Connect).
2. Append the ruling to `SKILL.md`'s decision log.
3. Canvases 3 and 4.
4. A spec, then a migration authored in the main session (extending `trader_status`, `trader_tuning`, and new RPCs if trading moves between players), validated on the harness and pushed on go.
5. Opus implements against the canvases, folding in or retiring the Old Wisp prototype.
6. Ships in 1.4 if ready alongside Halloween, otherwise 1.5.

## Release map

| Release | Contents |
|---|---|
| 1.3 (196 or 198) | Approval only; then the feeding-schedule flip |
| 1.4 | Consolidated `main` (copy sweep, matchmade Play dark), the redesigned shop / preview / closet, Halloween accessories and backgrounds, a season after 11-12 if it needs client work |
| 1.5 | Trader v2 if it isn't ready for 1.4; costumes |

Every build: changelog in `docs/builds/` first, then `eas build --local` with the 16 GB heap and the Sentry token sourced, then `build-N.ipa` → Transporter.

## Execution protocol for Opus packages

Each package handed to an Opus subagent carries:
- the goal and the exact file scope;
- the constraints: `CLAUDE.md`, the taste standard, no em dashes in copy, no DB push, no git push, python for multi-line edits;
- the verify steps: the named tests, `tsc`, lint, and a simulator screenshot for UI.

The main session reviews every diff before the next package starts. Packages with no shared files run in parallel: A1–A3 together, art production alongside canvas work.
