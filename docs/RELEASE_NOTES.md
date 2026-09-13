# Tickle the Pig — Release Notes

## What to test (paste into App Store Connect → TestFlight → this build → "What to Test")

```
Build 182 (v1.3) — server-synchronized digging clock.

Use ordinary non-admin accounts. Compare Home and Season countdowns while the phone clock is ahead and behind. Feedings should open at midnight, 8 a.m. and 4 p.m. in the account's registered timezone, and close four hours later. Check the exact opening/closing edges and completed-dig hiding. Start a dig just before close and verify the existing session can finish before its server window ends. Background/resume, switch accounts, and reconnect; neither the old account's clock nor an old response should overwrite current state. Check pending timezone changes and daylight-saving dates. Re-run the core loop: home tickling, empty bank, friend visit, Snout earning and purchase, sign-in, restore purchases, notification/deep-link routing and accessibility. Mote Machine and Lounge remain hidden. This focused build preserves build 181's UI; Living Mud and unrelated Barn changes are not included.
```

## How to set this in App Store Connect

1. Build locally with the production profile and open the inspected IPA in
   Transporter, following `docs/RELEASE_CHECKLIST.md`.
2. Sign in to Transporter and click **Deliver**, then wait for Apple to process.
3. Visit https://appstoreconnect.apple.com/apps/6740339848/testflight/ios
4. Click build 182 → **Test Information** → paste the block above
   into **What to Test**.
5. Save. Testers see it on their next TestFlight launch.

`xcrun altool` doesn't set release notes — that's why this is a manual
copy-paste step.

## Build 180: Barn housing acceptance

Housing is enabled for everyone who installs build 180. Existing installed
clients are unaffected; no remote habitat flag flip is required. Housing
migrations through `20260910130000_habitat_completion.sql` are already applied.
The empty starter migration `20260912153621_empty_starter_barns.sql` remains
pending a separate explicit database go; do not mark that behavior accepted
until it is applied and verified. The generated three-background browser
chooser is not included in this binary.

Follow the evidence and pending acceptance gates in
[the build 180 record](builds/2026-09-12-build-180.md).

Test a fresh and returning non-admin account: the free starter introduction,
Home → Inside, Shop → Barn Furnishings, buying and earning designs, editing in
both modes, saving and relaunching. Visit an accepted friend and confirm both
pigs appear in that friend's committed room with normal Visit/tickle rules.
Confirm no Fixture button or Local acceptance controls in the installed
production build. Physical accessibility and two-account checks must be recorded
against the build under test. See `docs/handoffs/2026-09-08-barn-housing-rollout.md`.
