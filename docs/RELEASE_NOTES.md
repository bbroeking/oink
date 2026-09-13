# Tickle the Pig — Release Notes

## What to test (paste into App Store Connect → TestFlight → this build → "What to Test")

```
Build 180 (v1.3) — personal Barn housing and the current app redesign.

Use ordinary non-admin accounts. Cold-launch Home and confirm Rosie reacts to tickles while Ready to Tickle decreases and earned tickles/Snouts increase; spend the bank to zero and verify visible feedback. Open the personal Barn, check starter ownership, place and remove furnishings, save/relaunch, buy a design and verify exactly one charge. Check prestige gifts, collection discovery, wishlist and both room presets, including reconnect/conflict recovery. Visit two differently decorated friends and confirm the host, saved room, two pigs, tickle target and Visit allowance agree; verify blocked/non-friend access is refused and guestbook access still works. Check Home/Friends/Shop/Season/Account layouts with large text, VoiceOver and Reduce Motion. Smoke sign-in, background/resume, purchases/restore, notifications and deep links. Mote Machine and Lounge should remain hidden. The new three-image background chooser is not part of this app. Empty starter placement is pending its separately authorized server migration; record database state when testing it.
```

## How to set this in App Store Connect

1. Build locally with the production profile and open the inspected IPA in
   Transporter, following `docs/RELEASE_CHECKLIST.md`.
2. Sign in to Transporter and click **Deliver**, then wait for Apple to process.
3. Visit https://appstoreconnect.apple.com/apps/6740339848/testflight/ios
4. Click build 180 → **Test Information** → paste the block above
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
