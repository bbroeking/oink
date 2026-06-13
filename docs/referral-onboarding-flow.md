# Referral code onboarding — the whole flow

**Status:** plan, awaiting 3 decisions (bottom). **Context:** the forced referral
step was bypassed in build 89 (`setNeedsReferralStep(false)`, app/(tabs)/_layout)
because it collided with the login-flow modal bugs. Those are fixed (popup state
machine + `usePopupHold`), but the bypass orphaned everything: `ReferralCodeEntry`
never mounts, and deep-linked codes stash to `PENDING_REFERRAL_CODE_KEY` that no
code ever reads. Result: referrals silently evaporate; there is no place to type
a code.

## The three entry paths

### Path A — deep link install (the golden path, fully automatic)
1. Friend shares `ticklethepig.com/r/BRIAN-QFUI` (Share invite button).
2. New player taps → installs → opens. `_layout`'s link handler stashes the code
   (already works).
3. Sign-in → username → **auto-redeem fires silently** after the username step:
   read the pending key, call `redeem_referral_code`, clear the key.
4. Success surfaces as a **welcome moment, not a form**: While-Away-style note on
   first Barn landing — "You're in BRIAN's sounder — +50 snouts to get you
   started." Failure (expired window, already redeemed) clears the key silently;
   never show a new player an error for a flow they didn't initiate.

**Why auto-redeem:** the player already proved the referral by arriving through
the link. Asking them to re-type a code we're holding is pure friction.

### Path B — manual entry during onboarding (the missing UI)
Re-enable `ReferralCodeEntry` as a real step: **after UsernameSetup, before the
storybook** (its original spec position) — but soft:
- Headline "Did a friend send you?" + code field (pre-filled if a stash exists
  but auto-redeem failed network-side) + a **prominent Skip**.
- Skip is sticky (`hasSeenReferralStep`) — never re-prompts.
- The popup hold already covers this screen (it's inside the gate expression),
  so launch popups can't stack on it — the build-89 failure mode is dead.

### Path C — late entry (forgot during onboarding)
The Me-page "refer friends" card gains a small **"Have a code?"** row, visible
ONLY while the player is still eligible (server window). Disappears after
redemption or window expiry. This catches "my friend told me the code at lunch"
without cluttering veterans' screens.

## Referrer-side feedback (currently silent!)
`redeem_referral_code` should INSERT an inline announcement to the REFERRER:
"<name> joined with your code — 1 of 3 toward the Messenger Hat." Today the
referrer learns nothing until they check the Me page. This is the viral loop's
reward beat; it's one INSERT in the redeem RPC (inline, never
send_system_announcement).

## Eligibility window (server, `redeem_referral_code`)
Today: account **< 24h old AND < 5 tickles** — tight enough that a slow first
day disqualifies legitimate referrals. Proposal: **≤ 7 days AND < 100 lifetime
tickles**. Still blocks established-account farming; forgives a weekend.

## Build order
1. Migration: widen eligibility + referrer announcement (one file).
2. Client: auto-redeem hook post-username (Path A) + welcome note.
3. Client: re-enable the soft step (Path B) — flip the build-89 bypass to
   `hasSeenReferralStep()` and verify against the popup hold.
4. Client: Me-page "Have a code?" row (Path C, eligibility-gated).
5. Tests: redeem-window units; the auto-redeem hook's stash-consume-clear.

## Decisions needed
1. **Path B placement** — between username and storybook (spec position), or as
   a card INSIDE the storybook (one less screen)? Lean: spec position, it's one
   tap to skip.
2. **Eligibility window** — 7 days / <100 tickles OK, or different numbers?
3. **Referrer announcement** — every redemption, or only milestone hits (1/3,
   2/3, 3/3)? Lean: every one — they're rare and each is a dopamine beat.
