# Halloween 2026 production readiness

Prepared 2026-10-14 as a production-preparation audit. No EAS build, upload, deployment, database push, setting change, version bump, or campaign activation was performed.

## Decision

**Not ready to package as a release candidate from the current checkout.** The production path is viable, but the candidate must first be isolated and frozen, release-grade automation must pass, and the intentionally limited costume implementation must be described honestly. The production-root login integration is complete and staged; its backend remains disabled by default.

The current costume work is a prototype acceptance surface for **Rosie front idle only**. It must not be represented as production-ready Closet, Home, Barn, Visit, all-pig, or all-pose support. The five additional login-gift costumes also need their final fit/ownership acceptance before campaign activation.

## Current evidence

| Area | Evidence | Result | Owner / next action |
| --- | --- | --- | --- |
| Source | `feat/matchmade-play`, HEAD `16faad00c626e5e52aa9cc9cc80bb79a6ca1cbe6`; 210 dirty status paths, including 139 tracked files with 5,903 additions / 3,329 deletions and 709 untracked paths | **FAIL for RC freeze** | Brian/root: isolate intentional Halloween scope from unrelated owner work, commit it, then record the exact candidate SHA and candidate-vs-live scope |
| App version | `app.json` and native project report marketing version `1.3`; native project has placeholder `CURRENT_PROJECT_VERSION = 6` because EAS remote versioning owns the production counter | Pending release decision | Brian: decide whether this remains 1.3 or requires a later marketing version before the RC freeze |
| EAS counter | Read-only `eas build:version:get --platform ios --profile production --non-interactive` returned iOS build number **197** | PASS, read-only | The next successful/attempted auto-increment is expected to request 198, but failed attempts may consume a number; record only the actual build result |
| Historical records | Build 198 and 199 files both say no artifact was built. The recorded public version `1.2 (143)` was verified on 2026-10-04 only | Historical, not current proof | Re-check App Store Connect/public store immediately before freezing the RC |
| Toolchain | Xcode 26.4.1 / iPhoneOS SDK 26.4; Node 24.12.0 locally while `.nvmrc`/EAS resolves Node 22; npm 11.6.2; pnpm 10.26.0; EAS CLI 16.28.0; CocoaPods 1.16.2; Docker 29.6.0 | Available with version skew | Run release gates and EAS under Node 22; do not upgrade tooling inside the frozen candidate without a new verification pass |
| Production configuration | Bundle ID `com.broeking.ttp`; production push entitlement, Apple Sign In, associated domain, privacy URL, Sentry, IAP and RevenueCat settings are present | Static inspection PASS; signed capability verification pending | Inspect the signed IPA and processed TestFlight build; verify reviewer account and production services manually |
| New login-gift migration | `20261014200000_halloween_login_costume_gift.sql` sorts after `20261014180000`; no duplicate migration prefix found. Campaign row is inserted with `active = false` | Static ordering/disabled-default PASS | Database owner: review/harness first; push only after explicit user **go**; leave campaign inactive through binary acceptance |
| Linked migration boundary | `npx supabase migration list --linked` produced no result and was stopped after hanging; no SQL ran | **PENDING** | Re-authenticate Supabase CLI if needed and rerun sequentially before any push or build classification that depends on DB state |
| Known quality contracts | Fresh `npm run quality:check:full` stopped at 138 layout text clamps against budget 91 and SECURITY DEFINER `public.my_drives()` not revoked from default roles | **FAIL** | Owners must resolve or explicitly disposition these contracts; do not weaken the checks to make the gate green |
| Independent compile/export/DB harness | TypeScript PASS; iOS Metro export PASS (4,532 modules / 1,300 assets); disposable Docker DB harness PASS | PASS | Preserve these results with the candidate and rerun after any source change |
| Jest | Final post-fix run: 320 passed, 2 failed, 1 skipped suites; 3,757 passed, 2 failed, 2 skipped tests. Only the existing `relPerAnim` (126 vs 125.748) and `pigStageSideSprite` (179.655 vs 176.646) geometry checks fail. All Halloween tests pass; focused set is 8 suites / 48 tests PASS | **FAIL** | Resolve or explicitly disposition the two geometry failures, then rerun from frozen source |
| Production lint | Initial login-gift test error was corrected. Full rerun completed with 0 errors and 865 warnings, exit 0 | **PASS with warnings** | Preserve warning count as baseline; do not apply broad auto-fixes in the release freeze |
| Pig sprite validator | `assets/images/sprites/copper/idle_8.png` has an opaque canvas corner | **FAIL** | Asset owner verifies whether this is accepted historical debt or repairs it before candidate freeze |
| Linked DB lint | `npx supabase db lint --linked --level error` emitted no output for 60 seconds and was interrupted; no SQL ran | **PENDING** | Re-authenticate/check linked CLI connectivity, then rerun sequentially |

## Required product boundary

The production claim for this candidate may cover the one-time random login gift only after the exact server contract, authenticated client claim/ack flow, receipt replay, ownership persistence, and campaign gating pass. Costume rendering currently proves Rosie front idle in a controlled fitting room. Shipping claims must explicitly defer:

- every non-idle Rosie pose and transition;
- Copper, Pepper, Bandit, Pickles, and Biscuit fits;
- production Closet/Home/Barn/Visit presentation and occlusion;
- wearable transfer, consumption, and modular-equipment restoration outside the accepted login-gift contract;
- activation of any campaign before exact-binary device acceptance.

## Required rollout order

1. **Freeze source.** Isolate the intended Halloween changes in a clean release checkout. Preserve the exact commit and full intentional diff. Confirm all unrelated dirty files are excluded.
2. **Preserve staged integration.** The authenticated production-root login claim/ack flow is connected with fail-closed inactive behavior. Verify it from the frozen candidate; do not activate the campaign.
3. **Complete automation.** Fix or disposition the recorded contract, lint, sprite, and animation-geometry failures; obtain the post-fix full Jest result; restore linked lint connectivity; then rerun `npm run quality:check:full` from the frozen tree. The current independent iOS export and database harness passes do not make the aggregate gate pass.
4. **Review migrations.** Confirm the linked production boundary and classify every queued migration. The login-gift migration depends on the seasonal-card schema and must be deployed only in a reviewed order.
5. **Explicit database go.** After the user says **go**, deploy the inactive backend schema first. Smoke authenticated inactive behavior, replay isolation, ownership privacy, and backward compatibility. The campaign stays inactive.
6. **Create the actual build record.** Once the remote counter is checked immediately before packaging, create `docs/builds/YYYY-MM-DD-build-N.md` with the actual planned number and attach qualifying release follow-ups. Do not reuse the historical prepared 198/199 files as proof of an artifact.
7. **Pre-build report.** State classification (RC if intended for store), exact source, passed gates, pending/manual gates, accepted exceptions, inactive DB state, and rollout plan.
8. **Build locally.** From the frozen checkout only:

   ```sh
   NODE_OPTIONS="--max-old-space-size=16384" \
     eas build --local --platform ios --profile production
   ```

9. **Record and inspect.** Record the actual consumed build number, rename the artifact `build-N.ipa`, and inspect bundle ID, marketing/build versions, production push entitlement, associated domains, usage descriptions, extensions, and signing. Any source/config/migration change rejects an RC.
10. **Open in Transporter.** Run `open -a Transporter build-N.ipa`. Brian signs in and clicks **Deliver**. Codex does not perform the Deliver action.
11. **Process and TestFlight.** Confirm App Store Connect processing and signed capabilities, add “What to Test,” and install the exact build from TestFlight on a real supported device.
12. **Exact-binary acceptance.** Run the complete real-device checklist plus cold/warm login, reinstall/account recovery, inactive gift behavior, one-time random gift, replay after relaunch/second device, acknowledgement, ownership persistence, locked/equipped behavior, and the accepted Rosie front-idle fit. Confirm the campaign is still inactive for general users during controlled testing.
13. **RC decision.** Record an explicit owner go/no-go. Any code, asset, configuration, entitlement, or required migration change rejects the RC and requires a new incremented build.
14. **Store submission.** Select only the accepted exact build, complete listing/reviewer/privacy/IAP checks, submit, and release only with separate owner authorization.
15. **Activate later.** After the public store serves the accepted version and fit/ownership acceptance is complete, obtain explicit user **go** for the campaign setting change. Set an exact minimum client build matching the accepted binary, activate the campaign within the approved window, smoke one new claim and one replay, then monitor Sentry/Supabase and follow-up checks.

## Safe partial-deploy behavior

- **Schema absent, binary present:** client must handle the RPC as unavailable and show no gift; ordinary login continues.
- **Schema present, campaign inactive, old or new binary:** claim returns inactive; no receipt, card quantity, or costume instance is created.
- **Schema active, old binary:** minimum-client-build gate must keep the old client ineligible.
- **Receipt already committed:** retries and second-device login replay the same receipt and instance; campaign deactivation must not erase the historical receipt.
- **Fit or ownership acceptance fails:** leave the campaign inactive. Do not compensate with manual grants or one-off SQL.

## Hard stops

- No database push without explicit user **go**.
- No campaign activation until inactive-backend deployment, exact TestFlight binary acceptance, ownership/replay verification, and fitted-art acceptance are complete.
- No production claim that these costumes work in Closet, Home, Barn, Visit, all poses, or all pigs on the current evidence.
- No EAS build from the current 210-path dirty checkout.
- No `eas submit`; Transporter upload and its final Deliver click remain with Brian.
