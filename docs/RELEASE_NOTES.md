# Tickle the Pig — Release Notes

## What to test (paste into App Store Connect → TestFlight → this build → "What to Test")

```
Build 196 (v1.3) — Barns, Satchel swaps, and Monday's Drum.

Install this exact build from TestFlight on a physical iPhone and use ordinary non-admin accounts. Record the device, iOS version, and test date.

Start with the core loop: tickle your own pig, verify the bank decreases and earned total rises, empty the bank, visit and tickle a friend's pig, earn Snouts, and buy an item. Cold launch and dismiss every popup; the first tap on Rosie must work. Any silent core-action failure blocks release.

Barns: enter and leave Inside, furnish and save, relaunch, switch presets, and visit a friend's saved room. A fresh account starts with an empty room. Check room ownership and conflict/retry recovery.

Dig and Satchel: brush/shove the Living Mud Patch, finish a dig, and verify the receipt and Satchel find arrive once. Relaunch or reconnect after submission; rewards must not duplicate and the Barn must remain tappable. Swap a matching find during a friend visit, try Just give it, revisit the same day, and check both players' finds and Tickle rewards.

Season: check Feed / Draw / Pass, player-local Feeding edges, completed-dig hiding, and a phone clock set ahead/behind. On Monday, draw an earned Drum purse and verify balls, odds, the best roll, one payout, and the notification route. The old Race / Dig-Off must not pay prizes.

Also test upgrade from public v1.2, sign-in/sign-out and recovery, background/resume, offline/reconnect, purchases and Restore purchases, notification/universal/referral/redemption routes, camera permissions, large text, VoiceOver, and Reduce Motion. Check production Sentry for unexplained errors and expected symbolication. Mote Machine and Lounge remain hidden; Pig Errands depend on a separate server gate.
```

Brian reported on 2026-10-03 that this exact TestFlight build passed on a physical iPhone for Monday Drum, upgrade from v1.2, and core gameplay smoke. Device/iOS and detailed evidence were not supplied; the other checks above remain to be recorded or dispositioned.

Acceptance details and remaining release gates: [v1.3 release packet](app-store/1.3-release-packet.md). This text does not mark build 196 accepted or submitted.

## How to set this in App Store Connect

1. Build locally with the production profile and open the inspected IPA in
   Transporter, following `docs/RELEASE_CHECKLIST.md`.
2. Sign in to Transporter and click **Deliver**, then wait for Apple to process.
3. Open [App Store Connect](https://appstoreconnect.apple.com/), then
   **Tickle the Pig → TestFlight**.
4. Click build 196 → **Test Information** → paste the block above
   into **What to Test**.
5. Save. Testers see it on their next TestFlight launch.

`xcrun altool` doesn't set release notes — that's why this is a manual
copy-paste step.

## Build 180: Barn housing acceptance

Housing is enabled for everyone who installs build 180. Existing installed
clients are unaffected; no remote habitat flag flip is required. Housing
migrations through `20260910130000_habitat_completion.sql` are already applied.
The empty starter migration `20260913050000_empty_starter_barns.sql` (renumbered from `20260912153621` on 2026-09-13 so it sorts after the applied boundary) remains
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
