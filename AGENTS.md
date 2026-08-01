# Tickle the Pig — Codex project notes

Single-developer React Native / Expo 52 game with Supabase backend. Ships to iOS via TestFlight / App Store. Notes here orient Codex sessions in this repo; the domain glossary lives in `CONTEXT.md` next to this file.

## Build + ship

- **Every distributable build follows `docs/RELEASE_CHECKLIST.md`.** This means
  any local production-profile IPA/AAB, TestFlight build, Play-track build, or
  App Store/Play release build. Before invoking EAS: classify the build, create
  its changelog, run and record the applicable preflight gates, and state any
  unchecked/manual gates. Give the user a short pre-build gate report before
  invoking EAS; do not silently start a distributable build. Afterward: record
  the actual build number, rename and inspect the artifact, update the changelog
  with the result, and report remaining upload/device/manual gates.
- **Release candidates use the stricter RC lane.** Treat the build as an RC
  whenever the user says "release candidate", "RC", "candidate for release",
  or otherwise identifies the binary as the one intended for store release.
  Complete the RC-only gates in `docs/RELEASE_CHECKLIST.md`, preserve exact
  source provenance, test the exact TestFlight/Play-installed binary, and wait
  for an explicit go/no-go. Any code, asset, configuration, entitlement, or
  migration change after an RC is built rejects that RC and requires a new
  incremented build.
- **Local builds only.** `eas build --local --platform ios --profile production` — cloud quota fills up.
- **Metro needs 16 GB heap.** Prefix any `npx expo start` or `eas build` with `NODE_OPTIONS="--max-old-space-size=16384"`.
- **CocoaPods occasionally null-byte-flakes.** When pod install fails: `cd ios && pod cache clean --all && rm -rf Pods Podfile.lock && COCOAPODS_DISABLE_STATS=true pod install`.
- **Upload via Transporter, never `eas submit`.** After `eas build --local`, rename the artifact to `build-N.ipa` and run `open -a Transporter build-N.ipa`. Apple-ID sign-in + Deliver click stay with the user.
- **Write the build changelog BEFORE building.** Convention: `docs/builds/YYYY-MM-DD-build-N.md`.

## Database

- **DB pushes require explicit user "go".** Never run `npm run db:push` or `npx supabase db push` autonomously. Wait for the user to say "push it now" or equivalent before applying a migration.
- Migration filenames are timestamped `YYYYMMDDHHMMSS_description.sql` and must be alphabetically *after* the latest already-applied migration. Two files with the same prefix will collide on `schema_migrations.version` (PK).

## Layout + API quality loop

- Use `npm run quality:loop` while changing player-facing layouts or
  server/API contracts. It reruns the fast layout and security gates after
  relevant source changes.
- Run `npm run quality:check` before handing off layout or API changes.
- `npm run quality:check:full` adds the full Jest suite, production-source
  lint, a simulator-free iOS export, the database harness, and linked database
  lint. It is the local release-grade quality gate, but does not replace device
  acceptance in `docs/RELEASE_CHECKLIST.md`.
- Quality commands are verification only. They do not authorize a database
  push, distributable build, upload, or production mutation.

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI, in `bbroeking/oink`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). The first four don't exist in the repo yet and will be created via `gh label create` on first triage-skill use. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. `CONTEXT.md` at the repo root captures the project's domain language + architectural seams; `docs/adr/` is created lazily when an architectural decision warrants recording. See `docs/agents/domain.md`.
