# Tickle the Pig — Release Notes

## What to test (paste into App Store Connect → TestFlight → this build → "What to Test")

```
Whimsy reskin pass — paper-sticker UI, hand-drawn fonts, sage/rose pastel
palette across all five tabs. New slow-breathing pig avatar with full
expression set (idle / jump / sad / surprise / wave) on the home screen.
Tickle interaction now plays a 4-frame jump.

No algorithms. No feeds. No recommendations. The shop rotates daily by
deterministic hash, the leaderboard is plain DESC sort by lifetime tickles,
and the lucky-tickle bonus picks 3 random integers per day. That's it.

Things to try:
• Tap the pig — should play a small jump, then settle back into idle.
• Scroll all 5 tabs — Home, Ranks, Season, Shop, Account.
• Open the wardrobe in Shop — see your owned items, equip / take off.
• Tap "Manage subscription" or the VIP card — purchase flow opens (sandbox).

Known:
• Most cosmetic items still render as emoji placeholders. Real PNG art
  is in progress.
• Item overlays may sit slightly off the pig's anatomy — alignment tool
  available on the Account tab in dev builds for tuning.
```

## How to set this in App Store Connect

1. Run `pnpm ship` (or `./scripts/ship-ios.sh`) — uploads the build.
2. Wait ~10 min for Apple to process. You'll get an email.
3. Visit https://appstoreconnect.apple.com/apps/6740339848/testflight/ios
4. Click the new build → **Test Information** → paste the block above
   into **What to Test**.
5. Save. Testers see it on their next TestFlight launch.

`xcrun altool` doesn't set release notes — that's why this is a manual
copy-paste step.
