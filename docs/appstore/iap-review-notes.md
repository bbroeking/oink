# App Review Notes — in-app purchases (paste into the 1.3 version's "App Review Information → Notes")

This is the single most important field for getting the IAPs approved. Apple
rejects when the reviewer can't find/trigger the purchase. These notes point
them straight at it. Paste into App Store Connect → 1.3 version → App Review
Information → Notes.

---

## Paste this:

This build introduces our subscription (Slop Club) and a consumable (Season Pass).

HOW TO REACH THE PURCHASE:
1. Launch the app and sign in (email sign-in is available on the first screen —
   tap "or use email"). You may create a test account or use the sandbox tester.
2. Tap the "Me" tab (bottom-right).
3. On the account screen, tap "Join the Slop Club." This opens the paywall with
   the Monthly ($2.99) and Yearly ($29.99) subscription options.
   • The same paywall is also reachable from the "Season" tab (the "A Slop Club
     perk — Join the Slop Club" banner) and from the "Shop" tab's members band.

WHAT EACH PRODUCT UNLOCKS:
• Slop Club (monthly / yearly auto-renewable subscription, entitlement
  "tickle_the_pig_pro"): member-only cosmetics, a higher tickle cap with faster
  regeneration, and the season's premium reward track.
• Season Pass (consumable, product id "season_pass"): unlocks the current
  season's bonus reward track. (Note: the Season Pass purchase surface is not yet
  exposed in this build's UI; the product is submitted so it is review-approved
  and ready for a following update — the subscription is the active purchase to
  test here.)

Subscriptions are managed through RevenueCat; the entitlement is granted
server-side on purchase. No account/registration is required beyond the in-app
sign-in above.

TEST ACCOUNT (if needed):
[fill in a demo login here, or "use the provided sandbox tester"]

Thank you for reviewing!

---

## Notes for us (not for Apple)
- Fill in the TEST ACCOUNT line before submitting — give the reviewer a working
  email login so they don't have to create one. Use the demo account or a fresh
  one; do NOT paste a real password anywhere sensitive beyond this field.
- The Season Pass caveat is deliberately honest: its buy surface isn't wired in
  the client yet, so we tell the reviewer that up front (submitting it now gets
  it approved so a later code-only update can turn it on). If you'd rather NOT
  submit season_pass with this version, remove it from the version's IAP list and
  drop that paragraph.
- The three entry points (Me / Season / Shop) all open the same RevenueCat
  paywall via presentPaywall(OFFERING_IDS.slopClub).
