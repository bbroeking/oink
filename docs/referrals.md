# Referrals — Spec

The fix for "Season 1 said referrals would arrive 'later' and they
haven't." Derived from a structured design interview; every decision
below is locked. Companion to `season-1-social-redesign.md`
(decision #8 there — "Referral revived via Universal Link + a
referral-code field at signup" — this is that build).

The goal: every existing player has a code to share, friends who
redeem it get a small immediate reward, the inviter gets a bigger
reward *once the invitee proves they're playing for real*. Links
work for installed friends (Universal Link → app) and uninstalled
friends (landing page → App Store → manual code entry).

---

## Decisions (locked)

| # | Decision |
|---|---|
| 1 | **Asymmetric reward, inviter-heavy.** Invitee +50 snouts immediate on redemption. Inviter +100 tickles per *completed* referral, plus milestone rewards beginning at 3 invites. |
| 2 | **One persistent code per user**, format `ROSIE-K3T9` (display name + 4 random alphanumeric chars). Generated at signup, never changes. Shared freely. |
| 3 | **Redemption window is signup only.** New users see a "got a friend's code?" step in onboarding. After first launch there is **no in-app way to redeem** — gates alt-account farming. Self-referral blocked server-side. |
| 4 | **One-mark engagement gate.** Inviter rewards (+100 tickles + milestone count) fire when the invitee reaches **100 lifetime tickles**. Invitee +50 snouts remain immediate. |
| 5 | **Universal Link for installed users; static landing page for uninstalled.** `https://ticklethepig.com/r/<code>` → app if installed (code pre-fills onboarding); else Safari renders a page with the code prominently shown + an App Store badge + a Copy button. No SDK. No deferred-deep-link attribution. |
| 6 | **Account screen card** is the single share surface ("Refer friends" card with code + Copy + Share). Same shelf as the Slop Club card. No dedicated referral screen. |
| 7 | **Ships in the next TestFlight build** as one bundle. New build, new changelog under `docs/builds/`. |

---

## Reward economics

```
                  ┌────────────────────────┐
                  │ Friend taps your code  │
                  │  ─── ROSIE-K3T9 ───    │
                  └───────────┬────────────┘
                              ▼
       ┌──────────────────────────────────────────────┐
       │ Redemption (immediate, in-app)               │
       │  • Invitee: +50 snouts                       │
       │  • profiles.referred_by = inviter_id         │
       │  • profiles.referral_redeemed_at = now()     │
       │  • (Inviter: NOTHING yet — gate not crossed) │
       └──────────────────────────────────────────────┘
                              ▼
              ┌──────────────────────────────┐
              │ Invitee plays the game…      │
              │ tickle count climbs          │
              └──────────────┬───────────────┘
                             ▼
       ┌──────────────────────────────────────────────┐
       │ Engagement gate met                          │
       │  tickles_earned ≥ 100                        │
       └──────────────┬───────────────────────────────┘
                      ▼
       ┌──────────────────────────────────────────────┐
       │ Inviter credit (fires once, atomically)      │
       │  • Inviter: +100 tickles                     │
       │  • Inviter.referrals_completed += 1          │
       │  • Invitee.referral_completed_at = now()     │
       │  • Milestone check:                          │
       │       referrals_completed == 3 → grant       │
       │       Messenger Hat to inviter               │
       │  • Push notification to inviter:             │
       │       "Your friend Rosie made it! +100"      │
       └──────────────────────────────────────────────┘
```

**Spam-farming defense:**
- Self-referral blocked (`inviter_id != invitee_id`).
- Redemption gated on account age < 24h AND tickles < 5.
- Engagement gate requires real elapsed play (tickle regen physically caps the speed of the lifetime counter; 100 tickles ≈ many hours).
- Milestones are one-shot per inviter (3-invite hat granted once, not on every multiple of 3).
- Per-IP soft cap on redemptions (10/day, server-side) — deferred until we see real abuse signals.

---

## Schema

### `profiles` — new columns

```sql
ALTER TABLE public.profiles
    ADD COLUMN referral_code         text UNIQUE,
    ADD COLUMN referred_by           uuid REFERENCES public.profiles(id),
    ADD COLUMN referral_redeemed_at  timestamptz,
    ADD COLUMN referral_completed_at timestamptz,
    ADD COLUMN referrals_completed   int  NOT NULL DEFAULT 0,
    ADD COLUMN distinct_active_days  int  NOT NULL DEFAULT 0,
    ADD COLUMN last_active_date      date;
```

- `referral_code` — the persistent code shown on Account. Generated at signup (or backfilled lazily).
- `referred_by` — write-once. Set by `redeem_referral_code` RPC; never updated.
- `referral_redeemed_at` — when the invitee entered the code.
- `referral_completed_at` — when the engagement gate fired and the inviter was credited. NULL until then.
- `referrals_completed` — cached count of *completed* referrals for the inviter. Drives milestone checks.
- `distinct_active_days` — count of distinct UTC dates the user has tickled. Bumped at most once per day.
- `last_active_date` — the UTC date of the most recent tickle. Used to decide whether to bump `distinct_active_days`.

### Indexes

```sql
CREATE INDEX idx_profiles_referred_by ON public.profiles(referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;
```

### Why no separate `referrals` table

Each profile has at most one inviter (a 1:1 relationship: invitee → inviter). The columns above carry every piece of state we need; a join table would add no information and would scatter the lifecycle across two writes. Audit history (if we ever want it) can be added as a `referral_events` log later without changing the read path.

---

## Backend

### `generate_referral_code()` — RPC

Called automatically by `handle_new_user` trigger on signup. Returns the new code.

- Code format: `<UPPER 5 chars from username, padded with X if shorter>-<4 random alphanumeric, [A-Z0-9]>`.
  - Example: username "rosie" → `ROSIE-K3T9`; username "br" → `BRXXX-V8M2`.
- Uniqueness: retry up to 5 times on collision (the random suffix gives 36^4 ≈ 1.6M combinations per prefix; collisions are negligible at TTP scale).
- Idempotent: if the user already has a code, return it.

### `redeem_referral_code(p_code text)` — RPC

Called by the onboarding code-entry step. Returns:

```ts
{ ok: true; inviter_username: string }
| { ok: false; reason: "code_not_found" | "self_referral" | "already_redeemed" | "too_old" | "too_active" }
```

Server-side checks (all required):
1. The caller's `referred_by` is NULL (no double-redemption).
2. A profile exists with this `referral_code`.
3. The inviter's `id != auth.uid()` (no self-referral).
4. The caller's account is < 24h old.
5. The caller's `tickles_earned < 5`.

On success:
1. `UPDATE profiles SET referred_by = inviter_id, referral_redeemed_at = now(), snouts = snouts + 50 WHERE id = auth.uid()`.
2. Return `{ ok: true, inviter_username }`.

On any check failure, return the specific `reason` for client-side messaging — never throw.

### Engagement gate — called by `update_profile_and_item_count`

After the tickle increments `tickles_earned`, call the idempotent helper:

```sql
PERFORM public.complete_referral_if_eligible(uid);

-- The helper atomically guards referral_completed_at, requires
-- tickles_earned >= 100, grants the inviter 100 spendable tickles through
-- grant_tickles(), increments referrals_completed, and applies milestones.
```

The helper owns completion, payout, milestones, announcement, and push. Its guarded update makes repeated calls safe.

### `my_referral_summary()` — RPC

For the Account card. Returns:

```ts
{
    code: string;
    referrals_completed: number;
    referrals_pending: number;        // redeemed but gate not yet crossed
    next_milestone_at: number | null; // e.g. 3 if user has 1 completed, null at cap
}
```

---

## Universal Link

### Domain

`ticklethepig.com` is the apex. The `/.well-known/apple-app-site-association` JSON identifies the app and the path pattern:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.ticklethepig.app"],
        "components": [
          { "/": "/r/*", "comment": "Referral codes" }
        ]
      }
    ]
  }
}
```

(Served from the static host with `Content-Type: application/json`; no `.json` extension; no redirects.)

### Expo / iOS config

`app.json`:

```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:ticklethepig.com"]
    }
  }
}
```

### Landing page

A single static HTML page at `https://ticklethepig.com/r/<code>` (or the route that catches the wildcard). Server-side: read `<code>` from the path; if it matches an active `referral_code`, render:

```
[ TTP wordmark ]

Your friend invited you to Tickle the Pig.

  Your code:     [  ROSIE-K3T9   ]   [ Copy ]

[ Download on the App Store ]  ← App Store badge linking to the listing

After you install, open the app and tap "Got a friend's code?" on
the first screen.
```

If the code doesn't exist (typo / deleted account), render a generic "Welcome to TTP — install below" page with no code. Don't 404 — most users won't notice the typo.

The page also includes the standard meta tags for Universal Link interception (`apple-itunes-app: app-id=...`) so iOS Safari can offer the smart banner to existing-app users.

### In-app handler

`app/_layout.tsx` (Expo Router root) gets a `Linking.addEventListener` on `url` that:
1. Matches `^https://ticklethepig\.com/r/(.+)$`.
2. Extracts the code.
3. If the user is signed in, surfaces an alert: "Apply your friend's code?" (legitimate use case: existing TTP user opens the link by mistake; almost never crosses the gate so the rare hit doesn't matter).
4. If the user is not yet signed in, persists the code in AsyncStorage under `pending_referral_code`. The onboarding code-entry step reads + pre-fills + clears it.

### Clipboard fallback

If the AsyncStorage key is empty *and* the clipboard contains a string matching the `^[A-Z]{5}-[A-Z0-9]{4}$` pattern, the onboarding step shows: "Got a friend's code? Looks like **ROSIE-K3T9** is on your clipboard — tap to apply." This catches the install-from-landing-page → manual paste path with one tap.

---

## UX surfaces

### Onboarding — code entry step

A new step in the signup flow, immediately after username + display-name are chosen, before the Barn is shown.

```
┌──────────────────────────────────────┐
│  ★ got a friend's code? ★            │
│                                      │
│  Skip if not — most pigs don't have  │
│  one their first time.               │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  ROSIE-K3T9                    │  │  ← pre-filled if clipboard/AsyncStorage matched
│  └────────────────────────────────┘  │
│                                      │
│       [ Apply ]      [ Skip ]        │
└──────────────────────────────────────┘
```

States:
- **Empty** — text input, both buttons enabled (Skip continues to Barn).
- **Pre-filled** — code shown bold, "Apply" button reads "Apply ROSIE-K3T9".
- **Applied** — replace with success card: "Welcome to Rosie's sounder! +50 snouts." Single "Continue" button to Barn.
- **Error** — show the error string mapped from the reason: `code_not_found` → "Not a real code. Check with your friend?"; `self_referral` → "You can't use your own code"; `already_redeemed` → "Already used"; `too_old` / `too_active` → "Codes are for new players only — you're past the welcome window."

Server reasons map to copy via a `referralErrorMessage()` helper, same shape as the existing `friendActionMessage()` in UserSheet.

### Account screen — "Refer friends" card

Drops between the Slop Club card and the Account-deletion card on the Account screen.

```
┌──────────────────────────────────────┐
│  ★ REFER FRIENDS ★                   │
│                                      │
│  Your code:                          │
│  ┌────────────────────────────────┐  │
│  │  ROSIE-K3T9       [ Copy ]     │  │
│  └────────────────────────────────┘  │
│                                      │
│  [ Share invite ]                    │  ← system share sheet
│                                      │
│  Friends invited: 1 / 3              │
│  ━━━━━░░░░░░░░░░░ Messenger Hat      │
│                                      │
│  Each completed referral: +100 ★     │
│  (Your friend must play a bit before │
│  the credit lands — keeps it fair.)  │
└──────────────────────────────────────┘
```

Share-sheet message body:
```
Come tickle a pig with me. My code:
ROSIE-K3T9

https://ticklethepig.com/r/ROSIE-K3T9
```

Milestone progress is computed off `my_referral_summary().referrals_completed`. When the user crosses 3, the bar fills + the card shows a small "✓ Hat earned" badge.

---

## Implementation phases

### Phase 1 — Schema + backend (DB push required)

- Migration: new `profiles` columns + indexes.
- Migration: `generate_referral_code` RPC + invoke from existing `handle_new_user` trigger.
- Migration: `redeem_referral_code(p_code)` RPC with all five server-side checks.
- Migration: gate logic appended to `increment_tickle_count` (or its trigger).
- Migration: `my_referral_summary()` RPC.
- Migration: backfill `referral_code` for existing profiles (one-shot UPDATE).
- Push to live DB once user gives the explicit "go." Do not push before sign-off.
- Add the three new RPCs to `utils/referrals.ts` (typed wrappers using `rpc<T>()`) — same pattern as `utils/activeEffects.ts`.
- Unit tests for the typed wrappers (cast + null paths).

### Phase 2 — Universal Link infra (no app build needed)

- Host the apex-domain landing page (static HTML; one route `/r/:code` with code lookup against the live profiles table).
- Host `/.well-known/apple-app-site-association` JSON.
- Verify with Apple's [App Site Association validator](https://search.developer.apple.com/appsearch-validation-tool).
- App config: add `"associatedDomains": ["applinks:ticklethepig.com"]` to `app.json` ios block.

### Phase 3 — App integration

- `app/_layout.tsx` deep-link handler: parse `/r/:code`, persist to AsyncStorage under `pending_referral_code`.
- Onboarding code-entry step (new screen between username and Barn).
- AsyncStorage + Clipboard pre-fill detection.
- Server reason → user copy mapping (`referralErrorMessage`).
- Account screen "Refer friends" card with milestone progress + Copy + Share.

### Phase 4 — Notifications + monitoring

- Push notification to inviter when their referral completes ("Your referral Rosie made it! 100 tickles"). Hooks into the existing `send_push_to_user` RPC; the completion helper sends it after the gate fires.
- Optional: client-side WhileAwayModal entry for when the inviter opens the app after their friend crosses the gate (analogous to bless/curse arrival).
- Light analytics on the landing page: page view + Copy button click + App Store click. (No SDK; basic server log parsing is fine.)

### Phase 5 — Build + ship

- New build (`docs/builds/YYYY-MM-DD-build-N.md` changelog written *before* the build).
- Local build via `eas build --local` (per project memory).
- Upload via Transporter (per project memory).
- Monitor: do TestFlight redemptions complete when the referred player reaches 100 tickles?

---

## Testing

- **`__tests__/referrals.test.ts`** — pure helpers:
  - Code generator: 5-char prefix from username (uppercase, X-padded), 4-char alphanumeric suffix, format regex.
  - `referralErrorMessage(reason)` — every reason maps to a non-empty user-facing string.
  - Clipboard regex: matches `ROSIE-K3T9`, rejects `rosie-k3t9`, `ROSIE-K3T`, `ROSIE-K3T9X`, `random-text`.
- **Unit-test the gate logic** via SQL or a thin wrapper:
  - At 99 tickles → no completion.
  - At 100 tickles with fewer than 3 active days → completion fires once.
  - At 101 tickles → completion doesn't refire.
- **Manual smoke** in TestFlight:
  - Two accounts, one device. Account A creates, gets code. Account B (different test email) signs up, enters code in onboarding, sees +50 snouts. Play to 100 tickles. Account A receives 100 tickles, any earned milestone reward, and a push.
  - Open `https://ticklethepig.com/r/ROSIE-K3T9` in Safari on a device WITHOUT TTP installed — verify landing page renders. Install from App Store from the badge link. Verify clipboard pre-fill (after copy on landing page).
  - Open the same URL on a device WITH TTP installed (and signed in) — verify the deep-link handler surfaces the right confirm.

---

## Heads-up

- **The "5-invite Slop Club trial" milestone is intentionally deferred.** It re-enters scope when Slop Club lands on main. At that point: add a `slop_club_trial_until` column on profiles + extend `useProEntitlement` to honor it. ~30 lines.
- **No third-party SDK is being added.** If install-attribution accuracy becomes a real bottleneck (we see "the landing page got 200 clicks but we got 30 redemptions"), Branch.io / AppsFlyer can be layered on later without schema changes.
- **Backfilling codes for existing users** is a one-shot SQL update at deploy time. The first time a long-time user opens the new build, their Account card already has a code — no need to "claim" it.
- **The grace window for redemption (24h + <5 tickles) is tunable.** First-week TestFlight data will tell us if it's too tight; the values are constants in the `redeem_referral_code` RPC.
- **Linear inviter rewards are uncapped in this spec.** If we ever see one user racking up dozens of completions, we'll cap (e.g., max 25 lifetime completed referrals earn snouts; further completions still count toward sharing leaderboards but no more snouts). Defer until needed.
