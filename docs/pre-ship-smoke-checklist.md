# Pre-ship core-loop smoke checklist

Run this on a **real device with a non-admin account** before every TestFlight/App Store build. It exists because build ~90 shipped a regression where **you could not tickle your own pig** (a side-effect in the home tickle RPC silently rolled back the whole transaction; visiting still worked, so it slipped through). One line of this checklist would have caught it.

> The rule: **a change is not shippable until the core loop is verified to still work — on device, as a normal user.** Tests + typecheck are necessary but not sufficient; the loop must be physically tapped.

## The non-negotiable five (the core loop)

1. **Tickle your OWN pig.** Tap Rosie on the Barn home screen. Confirm: she reacts (bounce + oink + heart float) **AND** `READY TO TICKLE` decrements **AND** `TICKLES EARNED` increments. ← *the exact thing that broke.*
2. **Run the bank to zero.** Keep tickling until empty. Confirm the "Out of tickles!" toast appears (not silence) and regen countdown shows.
3. **Visit a friend and tap their pig.** Confirm the visit tickle works and both pigs respond. (Home and visit are *separate* RPCs — verify both, since one breaking while the other works is exactly how the last regression hid.)
4. **Spend → earn.** Confirm snouts (`counter`) rise with tickling and a shop purchase debits them.
5. **No silent failures.** If any tap does nothing, that is a P0 — a core action must always either succeed or show feedback, never silently no-op.

## Popup / overlay sanity (the build-90 failure class)

6. **Cold launch → land on Barn → immediately tickle.** Dismiss any launch popups (schism / finale / rituals / achievements / release notes), then confirm the very first tap on Rosie tickles. (Invisible native `<Modal>`s can eat touches — see `components/ui/PopupQueue.tsx`.)
7. **Lucky-pig + 6-7 + title-unlock flows** dismiss cleanly and return you to a tappable Barn.

## Regression-guard principle (for new core-action RPCs)

When adding or editing any RPC behind a player-facing core action (tickle, visit, spend, claim):

- **The core mutation commits first and unguarded.** Best-effort side-effects (XP, lucky rolls, happiness, announcements, push) go in their own `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING; END` sub-block so a side-effect fault can **never** roll back the player's action. See `20260624000000_harden_home_tickle.sql` for the pattern.
- **Never call `send_system_announcement()` from a user RPC** — it's admin-gated and raises `admin_only` → silent rollback for non-admins. INLINE the `system_announcements` INSERT instead.
- **Client call sites must check the `rpc()` result for `null`** and surface it; an ignored null is a silent failure.

## Mechanical gates (run before the device pass)

- [ ] `npx tsc --noEmit` clean
- [ ] `npx jest` green
- [ ] DB migrations applied to the target env (`npm run db:push`) **before** the build that depends on them
