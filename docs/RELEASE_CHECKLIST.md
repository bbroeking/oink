# Build and release checklist

The canonical runbook for generating and shipping distributable Tickle the Pig
builds. The iOS lane is primary; Android-specific additions live in
[`google-play/release-checklist.md`](google-play/release-checklist.md).

## Which lane applies?

Classify the build before doing any build work:

| Lane | Trigger | Required scope |
| --- | --- | --- |
| Development build | Simulator/dev client/debug build that will not be distributed | Normal development verification; this document is not required |
| Distributable build | Production-profile IPA/AAB, TestFlight build, or Play-track build | Sections 1–5; section 6 if uploaded |
| Release candidate (RC) | The user calls it “release candidate,” “RC,” “candidate for release,” or identifies it as the intended store binary | Every applicable section, including all **RC-only** items |
| Production release | An accepted RC selected for App Store/Play release | Sections 7–8 |

“Release candidate” is an explicit promise about one exact binary, not a loose
description of the current branch. If any code, asset, build configuration,
entitlement, or required migration changes after the RC is built, mark it
**rejected** and produce a new incremented build.

## Build record

Copy these fields into the build changelog:

- Classification: distributable build / release candidate
- Release/version:
- iOS build number:
- Android version code (if applicable):
- Candidate commit:
- Working-tree state/diff reference:
- Previous live build:
- Release owner:
- Target: TestFlight / phased App Store / manual App Store / Play test track /
  Play production
- Planned release date:
- Build changelog:
- Database state required:
- Feature flags or timed events:
- Rollback decision-maker:
- RC status: not applicable / pending / accepted / rejected

Every checked item needs evidence in the build changelog: command result, test
count, artifact inspection result, manual tester/date, or a link to the source
document. Unchecked items must be recorded as **pending**, **not applicable**
with a reason, or an explicitly accepted exception. Never silently skip a gate.

Immediately before invoking EAS, report:

- build classification and intended target;
- passed automated/manual gates;
- pending gates and who owns them;
- accepted exceptions and their risk;
- required database/rollout state.

Immediately after the build, report the actual build number, artifact path,
signed-binary inspection, build failures/consumed numbers, and the remaining
upload, exact-binary device-test, or go/no-go gates.

## Hard stops

- **Database:** do not run `npm run db:push` or `npx supabase db push` until
  the user explicitly says **go**.
- **iOS upload:** build locally and upload with Transporter. Never use
  `eas submit`.
- **Transporter:** Apple ID sign-in and the final **Deliver** click belong to
  the user.
- **Release actions:** do not send launch pushes, run one-off release SQL, or
  flip timed production settings until both the binary and required database
  state are ready.

## 1. Freeze the candidate

- [ ] Classify the build using the table above and record the classification.
- [ ] Define the user-facing scope and explicitly list deferred work.
- [ ] Review `git status --short`; every included change is intentional.
- [ ] Record the candidate commit. If building from a dirty tree, record that
      fact and preserve the exact diff in the build changelog.
- [ ] **RC only:** all build-input changes are committed, or the complete
      intentional dirty diff is preserved and explicitly accepted before the
      build. Identify unrelated dirty files.
- [ ] **RC only:** record the previous live store build and review the complete
      candidate-vs-live change set.
- [ ] **RC only:** freeze scope. New work waits for the next release unless it
      fixes a release-blocking defect.
- [ ] Check `app.json` version, bundle/package identifiers, entitlements,
      privacy strings, icons, and splash assets.
- [ ] Check `eas.json` production environment:
      `EXPO_PUBLIC_PRIVACY_URL`, Sentry, IAP, and RevenueCat values match the
      intended release.
- [ ] Confirm `constants/featureFlags.ts` and timed release behavior match the
      rollout plan.
- [ ] Confirm App Store / Play reviewer credentials work and land in a useful,
      populated non-admin account.
- [ ] Identify every migration added since the last shipped build and classify
      it as:
      - required before binary;
      - safe before or after binary;
      - release-day activation; or
      - deferred.
- [ ] Confirm every new migration filename sorts after the latest applied
      migration and no timestamp prefix collides.
- [ ] **RC only:** write a rollout order for binary, migrations, flags, timed
      events, one-off SQL, and launch messaging, including safe partial-deploy
      behavior.

## 2. Write the release notes first

- [ ] Create `docs/builds/YYYY-MM-DD-build-N.md` **before building**, following
      [`builds/README.md`](builds/README.md).
- [ ] Include headline, user-facing changes, internal changes, migrations,
      known issues, required production state, and release-only actions.
- [ ] If the app should show a new “What’s new” entry, update
      `constants/release_notes.ts` and its version/date.
- [ ] Prepare TestFlight “What to Test” text from
      [`RELEASE_NOTES.md`](RELEASE_NOTES.md).
- [ ] Update App Store / Play listing copy, reviewer notes, screenshots, IAP
      review notes, privacy answers, or data-safety answers if behavior changed.
- [ ] **RC only:** draft the final store “What’s New,” reviewer notes, and
      release-specific test plan before building.
- [ ] **RC only:** list release blockers and accepted known issues separately;
      assign an owner or follow-up to every accepted issue.

## 3. Verify code and data

Run from the repository root:

```sh
npx tsc --noEmit
npx jest --runInBand
npx expo lint
```

- [ ] TypeScript passes.
- [ ] Full Jest suite passes; record suite/test totals in the build changelog.
- [ ] Lint passes. If pre-existing repo-wide failures block it, record the
      command and failures, and verify no changed file introduces a new error.
- [ ] Run any feature-specific tests, asset validators, or generation checks
      named in the feature spec/build changelog.
- [ ] Run the relevant database harness for changed migrations.
- [ ] Run `npx supabase db push --dry-run` and record the remote/queued
      migration boundary. This is read-only planning, not authorization to push.
- [ ] With explicit user **go** only: apply required migrations.
- [ ] After a push, execute the documented server smoke checks and verify
      backward compatibility with the currently live binary.
- [ ] **RC only:** all automated gates are green or each exception is explicitly
      accepted in the changelog before building. A release-blocking failure
      cannot be waived merely to obtain an artifact.
- [ ] **RC only:** verify upgrade/backward compatibility across the previous
      live client, candidate client, current database, and planned database.

## 4. Test before packaging

- [ ] Start Metro with the required heap when a local packager is involved:

  ```sh
  NODE_OPTIONS="--max-old-space-size=16384" npx expo start
  ```

- [ ] Run the complete
      [`pre-ship-smoke-checklist.md`](pre-ship-smoke-checklist.md) on a real
      device with a non-admin account.
- [ ] Verify cold launch, background/resume, offline/reconnect, sign-out/sign-in,
      and reinstall/account recovery.
- [ ] Verify notification permission plus cold, warm, and foreground tap
      routing when notification behavior changed.
- [ ] Verify universal links, referral/redemption links, and camera
      denied/granted paths when link or camera behavior changed.
- [ ] Verify purchase, restore, entitlement webhook, expiration/cancellation,
      and the IAP-disabled fail-closed path when monetization changed.
- [ ] Verify accessibility basics: Dynamic Type at a large setting, VoiceOver
      labels on changed controls, contrast, reduced motion, and no clipped
      critical actions.
- [ ] Inspect changed screens on the smallest and largest supported phone sizes.
- [ ] Check Sentry during testing; no unexplained new errors or silent core
      actions remain.
- [ ] Record accepted known issues and their owner/follow-up.
- [ ] **RC only:** complete the release-specific acceptance test plan and record
      who tested it, on which device/OS, and when.
- [ ] **RC only:** no unresolved P0/P1 issue, silent core-action failure,
      purchase/entitlement defect, data-integrity risk, or privacy/security
      regression remains.

## 5. Build iOS locally

- [ ] Confirm signing/provisioning and production entitlements are available.
- [ ] If symbol upload is expected, confirm the Sentry build token/config is
      available. If upload is intentionally allowed to fail, record the loss of
      symbolication in the build changelog.
- [ ] Build locally—never consume the cloud quota:

  ```sh
  NODE_OPTIONS="--max-old-space-size=16384" \
    eas build --local --platform ios --profile production
  ```

- [ ] Record the actual EAS/iOS build number (failed attempts may consume one)
      and update the changelog filename/title if necessary.
- [ ] Rename the artifact to `build-N.ipa`.
- [ ] Inspect the signed binary: bundle ID, marketing/build versions, production
      push entitlement, associated domains, required usage descriptions, and
      expected extensions.
- [ ] Install/test the exact release archive when practical.
- [ ] Preserve the candidate commit and build changelog that produced the IPA.
- [ ] Update the build changelog with every preflight result, the actual build
      number, artifact path, and any failed/consumed build numbers.
- [ ] **RC only:** mark RC status **pending**. From this point, any source,
      configuration, entitlement, or required-database change rejects it.

If CocoaPods fails with the known null-byte/cache flake:

```sh
cd ios
pod cache clean --all
rm -rf Pods Podfile.lock
COCOAPODS_DISABLE_STATS=true pod install
```

Then return to the repository root and rebuild.

## 6. Upload and TestFlight

- [ ] Open the artifact in Transporter:

  ```sh
  open -a Transporter build-N.ipa
  ```

- [ ] User signs in and clicks **Deliver**.
- [ ] Wait for App Store Connect processing; resolve export-compliance or other
      processing questions.
- [ ] Confirm the processed build shows the expected version/build number and
      no warning changes the release decision.
- [ ] Add TestFlight “What to Test,” groups, and tester access.
- [ ] Install **from TestFlight** on a real device; do not treat a dev-client or
      simulator pass as equivalent.
- [ ] Re-run the non-negotiable core-loop smoke plus all release-specific
      acceptance checks on the TestFlight binary.
- [ ] Verify production Sentry events are symbolicated when expected.
- [ ] Verify production IAP against Apple’s sandbox when IAP is enabled.
- [ ] **RC only:** run the full real-device checklist against the exact
      TestFlight-installed binary, even if the same flows passed in a dev build.
- [ ] **RC only:** compare the processed build number and signed capabilities to
      the local inspection record; they must describe the same artifact.
- [ ] Obtain an explicit user go/no-go decision for App Store
      submission/release.
- [ ] Record the decision as RC **accepted** or **rejected**, with date and
      reason. A rejected RC is never silently reused.

## 7. Submit or release

- [ ] Confirm this is the exact RC marked **accepted**; do not substitute a
      newer build without repeating RC verification.
- [ ] Select the verified build in App Store Connect.
- [ ] Confirm screenshots, description, “What’s New,” support/privacy URLs,
      age rating, reviewer contact, demo account, and reviewer notes.
- [ ] Confirm IAP/subscription products required by this version are attached
      and ready for review.
- [ ] Choose the intended release mode (manual, automatic, or phased) and record
      it above.
- [ ] Submit for review.
- [ ] When approved, confirm the release owner explicitly authorizes release.
- [ ] Confirm the public App Store page and install path serve the intended
      version before performing post-release activations.

## 8. Post-release

- [ ] Apply post-binary migrations/settings only with explicit user **go**.
- [ ] Run one-off release SQL and launch pushes only after their documented
      prerequisites are true; record who ran them and when.
- [ ] Smoke a clean App Store install and an upgrade from the previous version.
- [ ] Verify auth, tickling, visiting, shop/IAP, notifications, universal links,
      and any release headline feature in production.
- [ ] Monitor Sentry and Supabase logs immediately after release and again after
      the first meaningful traffic window.
- [ ] Check RevenueCat/App Store transaction and webhook health if monetization
      is enabled.
- [ ] Confirm analytics/operational signals expected from the new feature.
- [ ] Update the build changelog with the final database boundary, release time,
      activation actions, and any incident/follow-up links.
- [ ] Announce only after the store binary and server state are both verified.

## Rollback / hotfix decision

Stop rollout or prepare a hotfix for any of the following:

- core action silently fails or mutates the wrong account/economy state;
- crash loop, launch failure, auth lockout, or broken upgrade path;
- destructive or incompatible migration behavior;
- incorrect purchase, entitlement, price, or restore behavior;
- privacy/security regression or unintended data exposure;
- launch push or timed event would route users into an unavailable feature.

For an App Store binary issue, pause a phased release if available, disable the
feature through an existing safe flag/server control when possible, and build a
new incremented candidate. Never “roll back” the production database with an
ad-hoc destructive command; write and review a forward repair migration, then
wait for explicit user **go** before pushing it.

## Android addendum

For Android, complete this checklist plus
[`google-play/release-checklist.md`](google-play/release-checklist.md). Build
locally with:

```sh
NODE_OPTIONS="--max-old-space-size=16384" \
  eas build --local --platform android --profile production
```

Rename the artifact to `build-N.aab`, upload it to the intended Play track, and
test the Play-installed build. Billing must be tested through a Play test track;
push requires the configured Firebase/FCM credentials described in the Android
checklist.
