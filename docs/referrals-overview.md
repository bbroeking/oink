# Referrals — how the whole thing works

The canonical explanation. Start here, then follow the links into the focused docs. The referral system spans the app, the database, and a web landing page, and it has four layers — a code has to *travel* to a new player, get *redeemed*, the new player has to *prove engagement*, and then both sides get *feedback*.

| Doc | Covers |
|---|---|
| **this doc** | The full picture — how every piece fits together |
| `docs/referrals.md` | Reward economics + the original locked design decisions |
| `docs/referral-distribution.md` | Deep-linking / Universal Links / TestFlight / the domain |
| `docs/referral-feedback.md` | Inviter-side completion celebration (spec'd, not built) |
| `docs/referrals-debug.md` | Diagnostic playbook for "it didn't work for X" |

---

## The one-paragraph version

Every player gets a permanent share code (`ROSIE-K3T9`) at signup. A *new* player who enters that code gets **50 snouts immediately** and is permanently attributed to the inviter. The inviter gets nothing yet; their **100 tickles** and any milestone reward land when the new player reaches 100 lifetime tickles.

---

## The four layers

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1 — DISTRIBUTION   "get the code from inviter into the app" │
│   share code → link/text → (install) → onboarding code field      │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2 — REDEMPTION     "new player enters the code"             │
│   redeem_referral_code() → +50 to invitee, attribution recorded   │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3 — REWARD GATE    "invitee proves they're real"           │
│   100 lifetime tickles → 100 tickles to inviter, milestone, push │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 4 — FEEDBACK       "both sides see it happened"            │
│   invitee: 'you're in' screen  ·  inviter: celebration (spec'd)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## The complete journey, step by step

### 0. Code creation (at signup)
When any user signs up, the `handle_new_user` trigger calls **`generate_referral_code(uid)`**, which writes a unique `profiles.referral_code`. Format: a 5-letter prefix derived from the username (X-padded if shorter, letters only) + a dash + 4 random alphanumerics → `ROSIE-K3T9`. The client mirror is the regex `REFERRAL_CODE_PATTERN = /^[A-Z]{5}-[A-Z0-9]{4}$/` in `utils/referrals.ts`. Pre-username signups get a temporary `PIGXX-…` code that `my_referral_summary()` upgrades the first time the user has a real username.

### 1. The inviter shares (Layer 1, sender side)
On the Account screen's "Refer friends" card (`components/Account.tsx`), the inviter sees their code with **Copy** and **Share** buttons. Share uses **`shareMessageForCode(code)`** (`utils/referrals.ts`), which produces:
```
Come tickle a pig with me. My code:
ROSIE-K3T9

https://ticklethepig.com/r/ROSIE-K3T9
```
The message carries the code two ways — as **plain text** (the always-works fallback) and as a **link** (the seamless path).

### 2. The link travels (Layer 1, the hard part)
What happens when the recipient taps `https://ticklethepig.com/r/ROSIE-K3T9` depends on whether they have the app:

**They have the app installed → Universal Link.**
iOS recognizes the domain as associated with the app (via the `associatedDomains: ["applinks:ticklethepig.com"]` entitlement in `app.json` + the **AASA file** served at `https://ticklethepig.com/.well-known/apple-app-site-association`). The tap opens the app directly. The handler in `app/_layout.tsx` (`Linking` listener) parses the code with `parseReferralCodeFromUrl`, and — if the user isn't signed in yet — stashes it in AsyncStorage under `PENDING_REFERRAL_CODE_KEY` for onboarding to pick up. If they *are* signed in (rare — an existing user tapped a friend's link), it prompts to apply.

**They don't have the app → landing page.**
The tap opens Safari to the landing page (`landing/index.html`, deployed at the domain). The page:
- extracts the code from the `/r/<code>` path,
- shows it big with a **Copy** button (and silently pre-copies it to the clipboard),
- offers a **"Join the beta"** button (TestFlight public link now; App Store at launch).

After they install and first-launch the app, the onboarding step reads the clipboard via `parseReferralCodeFromClipboard` and pre-fills the field. (iOS has no native "deferred deep link," so the clipboard is the bridge across the install. It's best-effort; the visible code on the landing page is the guaranteed fallback — they can always type it.)

### 3. The onboarding code field (Layer 1, receiver side)
`components/ReferralCodeEntry.tsx` is a one-tap onboarding step (after username setup, before the storybook intro). It pre-fills from AsyncStorage (deep-link stash) first, then the clipboard. The user taps **Apply**, or **Skip**. This step is the *only* in-app way to redeem — by design, redemption is signup-only (anti-farming).

### 4. Redemption (Layer 2)
**`redeem_referral_code(p_code)`** runs five server-side checks, returning a typed reason on failure (mapped to copy by `referralErrorMessage`):

| # | Check | Failure reason |
|---|---|---|
| 1 | Caller is authenticated | `unauthenticated` |
| 2 | Caller hasn't already redeemed (`referred_by` is null) | `already_redeemed` |
| 3 | Code maps to a real profile | `code_not_found` |
| 4 | Not redeeming your own code | `self_referral` |
| 5 | Account is < 24h old | `too_old` |
| 6 | Caller has tickled < 5 times | `too_active` |

On success it sets `referred_by = inviter`, `referral_redeemed_at = now()`, and **+50 snouts** to the invitee. The invitee sees the "★ you're in ★" screen (`ReferralCodeEntry`). **The inviter still gets nothing at this point.**

### 5. The invitee plays (Layer 3 accrues)
Every tickle runs **`update_profile_and_item_count`**, which bumps `tickles_earned` among the rest of the tickle transaction. The referral helper checks that one lifetime counter.

### 6. The engagement gate fires (Layer 3)
Still inside `update_profile_and_item_count`, after the tickle is counted, a block checks the caller:

```
IF  referred_by IS NOT NULL          -- they were referred
AND referral_completed_at IS NULL    -- haven't paid the inviter yet
AND tickles_earned        >= 100     -- the one engagement threshold
THEN
    invitee.referral_completed_at = now()
    grant_tickles(inviter, 100)               -- spendable, over-cap-safe
    inviter.referrals_completed += 1
    IF inviter.referrals_completed == 3 THEN
        grant Messenger Hat to inviter         -- one-shot milestone
    send push to inviter ("Your friend made it! +100")
```

The helper runs immediately after each tickle is counted, so the payout lands on the tickle that reaches 100. The migration backfills already-qualified referrals that were waiting only on the old day gate.

### 7. Feedback (Layer 4)
- **Invitee** gets strong, immediate feedback: the "you're in" screen at redemption.
- **Inviter** today gets weak feedback: a push (only if they enabled notifications — currently only requested on the Friends tab) and a silently-incrementing "Friends invited: N/3" number on the Account card. `docs/referral-feedback.md` specs the fix — a `ReferralCompletedModal` celebration on next app-open, a "N friends on their way" pending line, and closing the push-permission gap. **Spec'd, not yet built.**

---

## The data model

All on `public.profiles`:

| Column | Meaning | Set by |
|---|---|---|
| `referral_code` | The player's permanent share code | `generate_referral_code` at signup |
| `referred_by` | UID of whoever's code this player redeemed | `redeem_referral_code` |
| `referral_redeemed_at` | When this player redeemed a code | `redeem_referral_code` |
| `referral_completed_at` | When this player crossed the engagement gate (inviter got paid) | `update_profile_and_item_count` gate |
| `referrals_completed` | How many of *my* invitees have completed | gate (incremented on the inviter) |
| `tickles_earned` | Lifetime tickle count (gate input 1) | every tickle + trades/claims |
| `distinct_active_days` | Distinct UTC days tickled (used elsewhere; not a referral gate) | tickle handler, once/UTC-day |
| `last_active_date` | Last UTC date tickled (drives the active-day bump) | tickle handler |
| `referral_completion_ack_at` | *(Layer 4, spec'd)* last time inviter saw their completions | `ack_referral_completions` |

---

## The functions

| Function | Layer | Role |
|---|---|---|
| `generate_referral_code(uid)` | 0 | Mints the unique code at signup; idempotent |
| `redeem_referral_code(p_code)` | 2 | The 5-check redemption; +50 to invitee; sets attribution |
| `my_referral_summary()` | 1/4 | Hydrates the Account card (code, completed count, pending count) |
| `update_profile_and_item_count(uid)` | 3 | The tickle handler — contains the engagement-gate block |
| `unacknowledged_referral_completions()` | 4 | *(spec'd)* completions to celebrate |
| `ack_referral_completions(ts)` | 4 | *(spec'd)* mark completions seen |

Client mirror lives in `utils/referrals.ts`: the code regex, the typed RPC wrappers, the URL + clipboard parsers, the error→copy mapping, and the share-message builder.

---

## The reward economics

| Event | Who | Reward | When |
|---|---|---|---|
| Redemption | Invitee | +50 snouts | Immediately on entering a valid code |
| Completion | Inviter | 100 tickles | When invitee hits 100 lifetime tickles |
| 3rd completion | Inviter | Messenger Hat | On the inviter's 3rd completed referral |

Asymmetric and inviter-heavy on purpose: the small immediate invitee bonus is the hook; the larger delayed inviter bonus rewards bringing in players who *actually play*.

---

## Why it's farm-resistant

- **Self-referral blocked** (`inviter_id != caller_id`).
- **Redemption window**: account < 24h old AND < 5 tickles. You can't farm by redeeming on established/throwaway accounts after the fact.
- **Engagement gate**: 100 lifetime tickles is the single qualification mark.
- **Milestones are one-shot** (the Hat is granted once at exactly 3, not every multiple).

---

## Current state — what works vs. what's pending

| Layer | Status |
|---|---|
| 0 Code creation | ✅ Built |
| 1 Distribution — onboarding field + clipboard | ✅ Built |
| 1 Distribution — Universal Link + landing page | ⚙️ **Wired, not deployed.** Needs: domain purchased, Apple Team ID filled into the AASA, landing site deployed, app rebuilt with the `associatedDomains` entitlement. See `docs/referral-distribution.md`. |
| 2 Redemption | ✅ Built — **verify the migration is deployed to prod** (see below) |
| 3 Reward gate | ✅ Built — same caveat |
| 4 Feedback — invitee screen | ✅ Built |
| 4 Feedback — inviter celebration | 📋 Spec'd, not built (`docs/referral-feedback.md`) |

### The single most likely reason "it's not working for people"
Two suspects, in order:

1. **The link layer was non-functional** — until the recent wiring, there was no domain, no `associatedDomains` entitlement, no AASA, no landing page. Every shared *link* dead-ended in Safari. Only manually-typed codes worked. (Now wired; needs deploy + rebuild to go live.)
2. **The migration may not be deployed.** Per `CLAUDE.md`, DB pushes need an explicit "go." If the referrals migration (`4c07a75`) was never pushed, `redeem_referral_code` doesn't exist in prod and *nothing* works. Rule this out first with `scripts/diagnose-referral.sql`.

---

## How to verify a specific case

Someone says "my friend used my code and I got nothing." Run `scripts/diagnose-referral.sql` with the *invitee's* username in Supabase Studio. The `gate_state` column tells you exactly: `BLOCKED` (never redeemed), `PENDING: needs N more tickles / M more days` (working as designed, just not there yet), `COMPLETE` (it fired — check the inviter's snouts/UI), or `BUG` (thresholds met but didn't fire — then check the function definition per `docs/referrals-debug.md`).

---

## Testing & deploying the link layer

See `docs/referral-distribution.md` for the full runbook. The short version:
1. Fill placeholders (Apple Team ID → AASA; TestFlight public link → landing page).
2. Deploy `landing/` to a host at `ticklethepig.com`; verify the AASA serves as `application/json` with no redirect.
3. Rebuild the app (the `associatedDomains` entitlement is compiled in) → TestFlight.
4. On a real device: tap a `/r/<code>` link from Messages/Notes (not Safari's address bar) → app opens + code pre-fills. Use **Settings → Developer → Associated Domains Development** to bypass Apple's AASA cache while testing.
5. TestFlight is fully representative; at App Store launch you only swap the landing page's "Join" button from the TestFlight link to the App Store link.
