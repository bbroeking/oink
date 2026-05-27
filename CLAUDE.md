# Tickle the Pig — Claude Code project notes

Single-developer React Native / Expo 52 game with Supabase backend. Ships to iOS via TestFlight / App Store. Notes here orient Claude Code sessions in this repo; the domain glossary lives in `CONTEXT.md` next to this file.

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
