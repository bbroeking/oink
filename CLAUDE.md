# Tickle the Pig — Claude Code project notes

Single-developer React Native / Expo 52 game with Supabase backend. Ships to iOS via TestFlight / App Store. Notes here orient Claude Code sessions in this repo; the domain glossary lives in `CONTEXT.md` next to this file.

## North Star

`SKILL.md` (repo root) is the product charter: **Tickle the Pig connects friends into herds, gives them things to collect, and gives the herd a race to run — together (Connect · Collect · Contend).** Consult it and run changes through its decision lens before any product, design, content, or economy decision. When we make an important such decision, append it to `SKILL.md`'s decision log (what we chose + which pillar it serves). (Charter rewritten 2026-07-07; the old charter/log live in git history.)

## Design taste

`docs/design/taste-standard.md` is the **craft lens** — the visual-quality companion to `SKILL.md`'s product lens. Consult it before any layout, component, color, type, spacing, or motion decision, and ask its two questions together: *which pillar does this serve?* and *would a designer who knows this game make this exact choice?* TTP's "slop" is **governance erosion** — the intentional tokens in `constants/theme.ts` (`WHIMSY`, `FONTS`, `RADII`, `SPACE`, `TYPE`, the sticker shadows) silently bypassed — not a generic-SaaS look. "Better frontend" means enforcing the taste that already exists. Reach for tokens, never inline a raw hex / size / radius / pad; use the shared primitives (`Sticker`, `Button`, `SectionHeader`, `EmptyState`/`LoadingBeat`, `Glyph`/`Icon`). Append important visual decisions to the standard's decision log.

## Cosmetic placement

`tools/placement_studio.py` (→ `http://127.0.0.1:8124/`) is the **single** tool for placing cosmetics on Rosie — item anchors (Items mode) and pig anatomy anchors (Pig mode). It auto-discovers every item, shows a live on-pig preview matching `PigStage.resolveSlot`, and autosaves: item RelSpecs → `constants/hat_rel.generated.ts` (rebuild-all, sorted), pig anchors → `PIG_FRAME_ANCHORS` in `constants/hats.ts` (and keeps `REST_ANCHORS` synced). `RelSpec` (pivot/widthFrac/anchor) is canonical; the legacy `HAT_OVERLAYS` path is being retired — `scripts/compute_overlays.py` now emits overlays only for items WITHOUT a RelSpec. Full workflow in `docs/placement-process.md`. (The old `item-anchor*`/`anchor-editor` tools were removed.)

## Build + ship

- **Local builds only.** `eas build --local --platform ios --profile production` — cloud quota fills up.
- **Metro needs 16 GB heap.** Prefix any `npx expo start` or `eas build` with `NODE_OPTIONS="--max-old-space-size=16384"`.
- **CocoaPods occasionally null-byte-flakes.** When pod install fails: `cd ios && pod cache clean --all && rm -rf Pods Podfile.lock && COCOAPODS_DISABLE_STATS=true pod install`.
- **Upload via Transporter, never `eas submit`.** After `eas build --local`, rename the artifact to `build-N.ipa` and run `open -a Transporter build-N.ipa`. Apple-ID sign-in + Deliver click stay with the user.
- **Write the build changelog BEFORE building.** Convention: `docs/builds/YYYY-MM-DD-build-N.md`.

## Database

- **DB pushes require explicit user "go".** Never run `npm run db:push` or `npx supabase db push` autonomously. Wait for the user to say "push it now" or equivalent before applying a migration.
- Migration filenames are timestamped `YYYYMMDDHHMMSS_description.sql` and must be alphabetically *after* the latest already-applied migration. Two files with the same prefix will collide on `schema_migrations.version` (PK).

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI, in `bbroeking/oink`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). The first four don't exist in the repo yet and will be created via `gh label create` on first triage-skill use. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. `CONTEXT.md` at the repo root captures the project's domain language + architectural seams; `docs/adr/` is created lazily when an architectural decision warrants recording. See `docs/agents/domain.md`.
