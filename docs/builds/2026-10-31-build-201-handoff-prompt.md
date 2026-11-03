You are picking up **Bullion's Market** in the Tickle the Pig repo (`bbroeking/oink`) on my Mac, to finish it and cut **build 201** locally. Follow `CLAUDE.md` exactly (local builds only, 16 GB Metro heap, Transporter not `eas submit`, changelog before building, **no DB push without my explicit "go"**). Consult `SKILL.md` and `docs/design/taste-standard.md` before any product or visual decision.

## Where things stand

- All code is on branch `claude/backend-ui-implementation-buzz5y` (pushed). Spec: `docs/design/market-2026-10-31/bullions-market.md` (rules, RPCs, audit notes, open questions). Draft changelog: `docs/builds/2026-10-31-build-201.md`.
- Server:
  - `supabase/migrations/20261031100000_bullions_market.sql`: the market. Its dry run listed only this file; I may or may not have pushed it. **Check, don't assume.** Run `npx supabase migration list --linked` and see whether `20261031100000` shows on the remote.
  - `supabase/migrations/20261031110000_market_followups.sql`: authored, unpushed. It hides unpayable wanted ads, restores listed sets if the Season 2 flip is undone, and clears a moved find's cost via a trigger.
  - **Never `supabase db push --include-all`.** These three are deliberately unapplied (dark features): `20261004230000_matchmade_play.sql`, `20261014180000_seasonal_card_item_unlocks.sql`, `20261014200000_halloween_login_costume_gift.sql`. To push, move those three out of `supabase/migrations/`, run `npx supabase db push --linked --dry-run`, and confirm it lists only the market files. Push only after my "go", then move the three back and confirm `git status` is clean.
- Client: `app/market.tsx`, `components/market/*`, `hooks/useMarket.ts`, `hooks/useMarketPing.ts`, `utils/market.ts`, `constants/market.ts`, and a "Market" row on the Barn button's fan (`components/Barn.tsx`). The row only appears once `market_ping()` answers, i.e. after the market migration is live.
- Tests: `npx jest __tests__/market.test.ts __tests__/marketViews.test.tsx`. The DB smoke runs on plain Postgres: `scripts/db-harness/00x_market_prep.sql` then both market migrations, then `C1_bullions_market_smoke.sql` (see the prep file's header).
- Local helper: `scripts/run-market-local.sh` (use `SKIP_DB=1` to skip its DB step).
- I stashed local changes before switching branches (`git stash list`, "local changes before market branch"). Show me what's in it before dropping anything.

## What to do, in order. Stop and ask me where marked.

1. **Get the simulator working.** `SKIP_DB=1 bash scripts/run-market-local.sh` was failing on my Mac with an unknown error. Reproduce it, read the actual error, and fix the cause. That might be pods, Xcode selection, DerivedData, or a JS error. Use CLAUDE.md's CocoaPods recovery if pods fail. Also check that `main` builds, so you know whether the branch or the environment is at fault. Don't change product code to paper over an environment problem.

2. **Server state.** Report whether each market migration is applied. If either isn't, show me the dry run with the three dark migrations set aside, then **stop and wait for my "go"** before pushing.

3. **Simulator pass** with the market live. Check:
   - The Market row appears on the Barn fan.
   - Counter: Sell a set you hold. The confirm shows the price move, a gavel receipt appears, and tickles go up. Buy a set back and check the price rises.
   - Post a For sale listing between Bullion's prices. It appears under Your listings, and Take down brings the set home.
   - The post sheet's price band and steppers work, and VoiceOver can reach the board's buttons.
   - Back navigation inside the market: the header back walks Find → Counter → Market → out.

   Screenshot anything that looks or reads wrong and fix it, keeping to the taste tokens. If I have a second test account, test a friend-only listing ("For you") end to end.

4. **Empty noticeboard at launch: ask me.** Options: (a) ship as is, (b) have Bullion pin a few listings a day inside his own gap (a small server addition plus a SKILL.md decision), or (c) give friends' listings more prominence. Implement only what I pick, and log it in `SKILL.md`'s decision log.

5. **Merge.** Open a PR from `claude/backend-ui-implementation-buzz5y` to `main` (use the repo's PR template if there is one). Wait for my OK to merge.

6. **Cut build 201** from `main` after the merge:
   - Finalise `docs/builds/2026-10-31-build-201.md` with the date, version string, candidate commit, server table state, and gates.
   - Write `docs/builds/expectations/build-201.json`, modelled on `build-200.json`.
   - Commit both **before** building.
   - Gates, recorded in the changelog: full `npx jest --ci`, `npx tsc --noEmit` (only the 3 errors already on `main` are allowed), `npm run lint` (0 errors), `npm run lint:web`, and `NODE_OPTIONS="--max-old-space-size=16384" npx expo export --platform ios`.
   - Build: `NODE_OPTIONS="--max-old-space-size=16384" eas build --local --platform ios --profile production`, and confirm the "Incrementing buildNumber … to 201" line.
   - Rename the artifact to `build-201.ipa`, inspect it the way the build-200 changelog does (version, build number, entitlements, `codesign --verify`), then run `open -a Transporter build-201.ipa`. **The Apple ID sign-in and the Deliver click are mine.**
   - Update the changelog's Release status with the artifact path, size and SHA-256.

## Watch after launch

`scripts/market-economy.sql` has six read-only weekly queries. The main one is the Ghost Sheep loop: buy a set at the counter, hand it to a Sheep that fancies it, and come out ahead. The levers are in `app_settings.market_tuning` and need no build: `price.sell_factor` / `buy_factor`, `price.impact`, and `counter_caps`.
