# Collaborator bootstrap — prompt for a fresh Claude Code session

Copy everything below the line into a new Claude Code session on the collaborator's Mac.
Prereq from Brian first: GitHub collaborator access to `bbroeking/oink`, and the `.env`
values (sent privately — never committed).

---

You are setting up and then working in **Tickle the Pig** (TTP) — a single-developer
React Native / Expo 52 iOS game with a Supabase backend, repo `bbroeking/oink`. Your
first job is to build a working dev environment from scratch on this Mac, mimicking the
primary developer's setup. Then read the project's canon before touching anything.

## 1. Install the toolchain (check each; install only what's missing)

- **Xcode** (full app, from the App Store) + `xcode-select --install`; open Xcode once
  to accept the license and install the iOS platform.
- **Homebrew**, then: `brew install node watchman cocoapods gh supabase/tap/supabase colima docker python@3.12`
  - Node 20+ LTS. Verify `node -v`, `pod --version`, `supabase --version`.
- **EAS CLI**: `npm i -g eas-cli` (login only if Brian adds you to the Expo project;
  not needed for simulator work).
- `gh auth login` (GitHub CLI — the repo's issue tracker runs on GitHub Issues).

## 2. Clone and install

```bash
git clone https://github.com/bbroeking/oink.git && cd oink
cp .env.example .env       # then paste the real values Brian sent you
pnpm install               # this repo is pnpm-based (pnpm-lock.yaml) — NOT npm
cd ios && COCOAPODS_DISABLE_STATS=true pod install && cd ..
```

- **The repo uses pnpm**, not npm — install with `pnpm install`. (`npm i -g eas-cli` for
  global CLIs is still fine.)
- **`.env` does NOT drive the app's backend.** The Supabase URL + anon key are hardcoded in
  `utils/supabase.ts`; the `.env` keys (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) are read only by
  tooling (`analytics-dashboard/`, `scripts/`). The app connects even with an empty `.env` —
  still fill it so the tooling works.
- If `pod install` fails with a null-byte/parse error (a known flake) — or leaves
  `ios/Pods/RCT-Folly/folly/portability/` empty (missing `Config.h`, which fails the native
  build later): `cd ios && pod cache clean --all && rm -rf Pods Podfile.lock && COCOAPODS_DISABLE_STATS=true pod install`

## 3. Run it (simulator)

On an Xcode version that Expo 52 supports, `NODE_OPTIONS="--max-old-space-size=16384" npx expo run:ios` is the one-liner.

**On Xcode 26, `expo run:ios` is broken** — its CLI can't parse Xcode 26's `devicectl`
output, so it misroutes every build to the physical-device signing path and dies with
"No code signing certificates are available to use." Until Expo 52's CLI catches up, build
through `xcodebuild` directly and run Metro separately:

```bash
# 1. build for the booted simulator (find its UDID with `xcrun simctl list devices booted`)
xcodebuild -workspace ios/ttp.xcworkspace -scheme ttp -configuration Debug \
  -destination 'platform=iOS Simulator,id=<SIM_UDID>' -derivedDataPath ios/build \
  -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
#    (CODE_SIGNING_ALLOWED=NO sidesteps the "resource fork / detritus not allowed" codesign
#     failure — simulator apps don't need signing.)

# 2. install + start Metro (16 GB heap) + launch, then deep-link the dev client to Metro
xcrun simctl install <SIM_UDID> ios/build/Build/Products/Debug-iphonesimulator/ttp.app
NODE_OPTIONS="--max-old-space-size=16384" npx expo start &   # bundle id: com.broeking.ttp
xcrun simctl launch <SIM_UDID> com.broeking.ttp
xcrun simctl openurl <SIM_UDID> "exp+ttp://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

- **Metro NEEDS the 16 GB heap prefix** on every `expo start` / build command — it OOMs
  at the default on first bundle. Consider `alias exgo='NODE_OPTIONS="--max-old-space-size=16384" npx expo start'`.
- Day-to-day after the first native build: `NODE_OPTIONS="--max-old-space-size=16384" npx expo start` (press `i` only works via the fixed `expo run:ios` path; on Xcode 26, relaunch with the `simctl launch` line above).
- Tests: `npx jest` (should be green before and after your changes).

## 4. Hard rules (these override anything else you'd normally do)

1. **NEVER run `npm run db:push` / `supabase db push`.** Database pushes happen only on
   Brian's explicit go, from his machine. You may WRITE migration files; you never apply them.
2. Migration filenames are `YYYYMMDDHHMMSS_description.sql` and must sort alphabetically
   AFTER the newest file already in `supabase/migrations/` (the remote PK collides otherwise).
3. **Carry-latest-def footgun:** when a migration does `CREATE OR REPLACE` on an existing
   function, copy the body from the LATEST migration that defines it — never an older one —
   or you silently delete later features. `grep -l "function_name" supabase/migrations/ | sort | tail -1` first.
4. Local `supabase db reset` dies at the pg_cron migration — validate new migrations with
   the plain-Postgres Docker harness instead (Colima is the Docker runtime; see
   `docs/agents/` and ask Brian if unclear).
5. **No emoji characters in UI, ever** — use `Glyph`/`Icon` components or generated art.
6. **Design tokens are law:** `constants/theme.ts` (`WHIMSY`, `FONTS`, `TYPE`, `RADII`,
   `SPACE`, the two hard shadows). Never inline a raw hex/size/radius/padding. Read
   `docs/design/taste-standard.md` before ANY visual change.
7. iOS release builds + App Store uploads are Brian-only (his Apple credentials).
   You work against the simulator / dev client.
8. User-facing announcement RPCs must INLINE the `system_announcements` INSERT — calling
   `send_system_announcement()` from a user RPC raises `admin_only` and silently rolls back.

## 5. Read the canon, in this order

1. `CLAUDE.md` (repo root — loads automatically; project operating manual)
2. `SKILL.md` — the product charter: every change must serve **Connect · Collect ·
   Cooperate**. Important product decisions get appended to its decision log.
3. `CONTEXT.md` — domain glossary and architectural seams.
4. `docs/design/taste-standard.md` — the visual-craft lens.
5. `docs/wiki/` — the LLM-maintained game-design bible (open as an Obsidian vault;
   `_index.md` is the catalog, `log.md` the changelog). For the current Season-2 work
   read, in order: `outputs/memos/mudwar-whats-next-2026-07.md` →
   `mudwar-consolidated-brief-2026-07.md` → `mudwar-hunger-arc-cadence-2026-07.md` →
   `mudwar-rewards-spec-2026-07.md` → `mudwar-dig-minigame-2026-07.md` →
   `mudwar-progress-views-2026-07.md` → `clan-buildout-audit-2026-07.md` →
   the three `mudwar-scope-{a,b,c}-*.md` files.
6. When you change or decide something design-relevant, update the matching wiki page
   and append to `docs/wiki/log.md` in the same pass — the wiki stays current because
   the LLM does the bookkeeping.

## 6. Current state (July 2026), so you don't rediscover it

- Season 2 = **Mud Wars vs the Great Hunger** (world-boss glutton hog who stole the
  valley's tickles). The full clan-war backend (crews ≤5, challenges, rhythm war,
  Elo ladder) is **live on prod but dark** behind the `mud_wars` feature flag
  (global=FALSE; Brian's override=TRUE). The client is code-complete behind the same flag.
- Active design direction: wars drain the Hunger's energy season-wide; an 8-hour
  "feeding window" heartbeat; a chill single-player truffle-digging minigame (three
  playable mocks live unlisted at `ticklethepig.com/labs/{truffle-patch,deep-root,snout-hook}`,
  sources in `landing/labs/`); a Golden-Truffle war economy replacing raw-snout payouts.
- Working branch: `feature/closet-titles-truffle-redig`. Branch from it (or from `main`
  per Brian's direction) — never commit straight to `main`.
- Known open build items are enumerated in `mudwar-whats-next-2026-07.md` and the scope
  memos; don't start server work without Brian assigning it.

## 7. Working agreement

- Ask Brian before: any DB push, any deploy of `landing/` (it aliases to ticklethepig.com),
  anything App Store-facing, and any change to the war's scoring math (it's Monte-Carlo
  validated — don't "fix" numbers casually).
- Commit style: conventional-commit-ish, small and scoped (`feat(season): …`,
  `fix(studio): …`). Keep `tsc` and `jest` green.
- If something in the docs contradicts the code, trust the code, then fix the doc.

Start now: run the setup in §1–3, confirm the app boots in the simulator, run the test
suite, then reply with (a) versions installed, (b) simulator boot status, (c) test
results, and (d) the three most important things you learned from the canon read —
then wait for your first assigned task.
