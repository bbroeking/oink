# Open items + launch checklist

Updated 2026-06-07. Most of the prior arc (happiness, barn visiting, Closet,
World Cup, push notifications, referral cutover) has shipped — builds 80–87 are in
TestFlight. What's left is launch-day flips + a couple of follow-ups.

## 🚀 LAUNCH CHECKLIST — do these when the App Store listing goes live

The listing isn't public yet (`itunes lookup id=6740339848` → resultCount 0). When
it goes live:

1. **Switch "Refer a Friend" to public.** Set **`SOUNDER_VISIBLE = true`** in
   `constants/featureFlags.ts` (currently `false` — the Sounder / referral UI is
   dark-launched: the "Your Sounder" card + `/sounder` route don't render, the
   RPCs are already live). Flipping this surfaces the referral program publicly.
   Then rebuild + ship.
2. **App Store link cutover — AUTO, nothing to do.** `landing/index.html` +
   `docs/index.html` already self-upgrade their Join/CTA buttons from TestFlight to
   `apps.apple.com/app/id6740339848` via a JSONP check against Apple's lookup API
   the moment the listing publishes. (A session cron, job `7a6c0910`, is also
   watching it every 2h.)
3. **Verify** the install-from-link path on a fresh device once live (link →
   landing → App Store → install → code pre-fills onboarding).

## Notifications — final device verification (was task #11)
Setup is DONE: `aps-environment=production` entitlement, APNs key uploaded to EAS,
provisioning profile regenerated, shipped in build 82+. **Remaining:** install
build 87 on a real device → open the Friends tab → accept the iOS prompt → confirm
a token registers (`push_tokens`) and a test push (friend request / trade answer /
barn visit) arrives. Sim can't get push tokens.

## Blessings — `halo_kiss` is a no-op (under investigation 2026-06-07)
The daily-rotation blessing `halo_kiss` ("a faint halo glow for 6h") has **no
implemented effect** — it stores a 6h row + shows an effect card + fires a push,
but nothing reads it (no regen mod, no lucky-pig boost, no pig visual). Every 4th
day the blessing does nothing. Secondary: `bountiful_snouts` grants +5 snouts but
shows no active-effect receipt (it's instant → filtered out of `my_active_effects`
by the `expires_at IS NOT NULL` clause). Decide what `halo_kiss` should DO, then
fix. See the blessing flow notes in this session.

## Teams push-pull + mini-games (was task #18)
Design-only so far — see `docs/teams-pushpull-design.md` (3 batches: core fork →
scoring/cadence/rewards/mini-game → edge cases/build path). A clickable mock lives
on branch `social-teams-pushpull`. Real build gated on the framing fork (new axis
vs alignment-reframe vs re-skinnable Rivalry event — leaning the latter).
