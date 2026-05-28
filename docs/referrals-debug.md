# Referrals — debug + verification

Companion to `docs/referrals.md` (the spec). This doc is the on-call playbook for the recurring complaint: *"my friend used my code and I never got my +100 snouts."*

The referral flow has **two distinct credit events** that often get conflated:

| Event | When | Reward | Where defined |
|---|---|---|---|
| **Redemption** | Invitee enters a valid code in onboarding | Invitee +50 snouts | `redeem_referral_code` RPC |
| **Engagement gate** | Invitee crosses both **lifetime tickles ≥ 100** AND **distinct active days ≥ 3** | Inviter +100 snouts + milestone | Inline block at the bottom of `update_profile_and_item_count` |

The first one is immediate. **The second one is on a delay measured in days, by design.** Most "didn't credit" reports are reports about a player who hasn't crossed the second threshold yet.

---

## Diagnostic flow

When someone reports "I didn't get my +100 snouts for the friend I invited," walk these checks in order:

### Step 1 — Identify the invitee

Get the invitee's username (the *redeemer*, not the inviter). The reporter is usually the inviter; they know their friend's pig name.

### Step 2 — Run the diagnostic query

Paste `scripts/diagnose-referral.sql` into Supabase Studio's SQL editor, substituting the invitee's username. The query returns a single row with everything needed to triage:

| Column | What "good" looks like |
|---|---|
| `invitee_username` | Matches the reported friend |
| `referred_by_username` | The reporter's username (the inviter). **If NULL: redemption never happened.** |
| `referral_redeemed_at` | A timestamp. **If NULL alongside non-NULL `referred_by`: something is very wrong.** |
| `tickles_earned` | ≥ 100 for the gate to be eligible. Below 100 = invitee hasn't played enough. |
| `distinct_active_days` | ≥ 3 for the gate to be eligible. Below 3 = invitee hasn't played on enough distinct days. |
| `last_active_date` | A recent date. NULL = invitee has never tickled since referrals migration deployed. |
| `referral_completed_at` | **A timestamp = gate fired successfully** (inviter was credited). NULL = gate hasn't fired. |
| `inviter_completed_count` | The inviter's `referrals_completed` count. Should match the count of distinct invitees whose `referral_completed_at` is non-null. |

### Step 3 — Match the symptom to the failure mode

| Symptom | Likely cause | Resolution |
|---|---|---|
| `referred_by` is NULL | Invitee never successfully redeemed | Confirm with the invitee — did they actually enter the code? `redeem_referral_code` rejects on `too_old` (>24h after signup) and `too_active` (>5 tickles before redemption). |
| `tickles_earned < 100` | Invitee hasn't played enough yet | Tell the inviter to be patient — gate fires automatically on the invitee's 100th tickle on day 3+. |
| `distinct_active_days < 3` | Invitee hasn't played on enough distinct UTC days | Same as above. **Note:** active days are bumped *only* by tickling — trade claims and season-pass claims do not count. |
| All thresholds met, `referral_completed_at` IS NULL | **Real bug.** Gate should have fired but didn't | See "When the gate fails to fire despite thresholds met" below. |
| Inviter says they haven't seen the snouts but `referral_completed_at` IS NOT NULL | Credit fired on backend but UI didn't refresh, or push failed to deliver | Check inviter's `counter` value. If it includes the +100, the credit landed; the push or UI surface is the issue. |

---

## When the gate fails to fire despite thresholds met

This is the only path that requires actual debugging. Possible causes:

1. **The function definition in production doesn't include the engagement-gate block.** A future migration may have redefined `update_profile_and_item_count` without re-including it (the function is a single-file replace, and the engagement gate is an inline block at the bottom, not a separate function — easy to miss when copy-pasting). Verify with:
   ```sql
   SELECT pg_get_functiondef('public.update_profile_and_item_count'::regproc);
   ```
   The output must contain the comment `-- ── Referral engagement gate ───`. If it doesn't, the gate was dropped.

2. **A race condition at the threshold-crossing tickle.** Possible but unlikely — the function runs in a single transaction with `FOR UPDATE` on `user_items`, so the row state should be consistent within the call. If suspect, look at the invitee's most recent tickle timestamp + the inviter's `counter` history.

3. **The migration was applied but the backfill UPDATE for existing users didn't run.** Specifically, if any existing user already had `referred_by` set from the older Sounder system (`20260520020000_sounder.sql`) AND has `referral_completed_at` IS NULL AND already crosses the thresholds, the gate should fire on their next tickle. If it doesn't, dig into the function definition (see #1).

---

## How to repro the gate locally

This is what the pgTAP test in `supabase/tests/01_referrals_gate.sql` automates. The manual procedure:

```bash
# 1. Start local Supabase (one-time).
npx supabase start

# 2. Apply all migrations to the local DB.
npx supabase db reset

# 3. Open psql against local.
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres"

# 4. In psql:
#    a. Create two auth.users (inviter + invitee).
#    b. Their profiles + referral_code get auto-created via the handle_new_user trigger.
#    c. Call redeem_referral_code as the invitee.
#    d. Manually bump invitee.tickles_earned to 99 and distinct_active_days to 2.
#    e. SET role authenticated; SET request.jwt.claims TO '...' to impersonate the invitee.
#    f. Call update_profile_and_item_count(<invitee_uid>).
#    g. Verify referral_completed_at is now set and inviter.counter went up by 100.
```

The pgTAP test does all of this in a transaction with `ROLLBACK` at the end, so nothing persists.

---

## Running the test framework

### pgTAP (the real integration test)

```bash
# Requires local Supabase running.
npx supabase test db

# That command runs every .sql file in supabase/tests/ in order.
# The new 01_referrals_gate.sql is the one that exercises the engagement gate.
```

The test creates two fixture users, walks the entire referral flow, and asserts every state transition. If the gate breaks in a future migration, this test fails — *that's the regression net*.

### Jest (typed-wrapper + client-side flow)

```bash
npm test
```

The existing `__tests__/referrals.test.ts` covers:
- `REFERRAL_CODE_PATTERN` regex matches
- `referralErrorMessage` mapping for every reason code
- `parseReferralCodeFromUrl` + `parseReferralCodeFromClipboard` parsers
- Typed RPC wrappers call the right RPC name with the right param shape

These tests run without a database — they mock `supabase.rpc`. Fast, run in CI, catch regressions on the client side. The engagement gate itself is **out of scope for Jest** — it's a SQL function and only pgTAP can meaningfully verify it.

---

## When to add to the test framework

Add a new pgTAP test (in `supabase/tests/01_referrals_gate.sql` or a new file) when:
- A new threshold or condition is added to the engagement gate (e.g. "must also have alignment != neutral")
- A new milestone is added (e.g. 5-referral Slop Club trial — currently deferred per spec §1)
- The reward amount changes (currently +100 snouts / Messenger Hat at 3)
- A new redemption guard is added (e.g. IP cap — currently deferred per spec §72)

Add a new Jest test when:
- A new client-side helper is added to `utils/referrals.ts`
- A new failure-reason → user-copy mapping is added to `referralErrorMessage`
- The deep-link URL shape changes

---

## Heads-up

- **The engagement gate fires lazily.** It runs on the invitee's NEXT tickle after both thresholds are met. There's no cron, no trigger. If the invitee crosses the thresholds at 11:50 PM and then doesn't touch the app for two days, the inviter doesn't get credited until that next tickle. This is intentional — it means there's no background job that can silently fail — but it can confuse users who expect immediate credit.
- **Active days bump only via tickling.** Trade claims, season-pass claims, and title rewards bump `tickles_earned` but NOT `distinct_active_days`. A whale who claims 200 tickles from a trade on their first day still has `distinct_active_days = 1`. They need to come back on 2 more separate UTC days and tickle for the gate to fire.
- **`distinct_active_days` is a UTC concept.** A player who tickles at 11:50 PM Eastern (3:50 AM UTC next day) and again at 8:00 AM Eastern (12:00 PM UTC same day) has logged TWO distinct UTC days for a single human session. This generally over-credits (good for retention; never under-credits).
- **The Messenger Hat milestone only fires when `referrals_completed = 3` exactly.** If for any reason the count jumps from 2 to 4 (which shouldn't happen but is conceptually possible), the milestone is missed. Worth a sanity check in the diagnostic query.
- **Self-referral check uses `inviter_id = caller_id`** — straightforward. Multi-account farming via two devices is not blocked by the schema; it's blocked socially (you'd need a fresh phone signup + manual code entry within the 24h window + < 5 tickles).
- **Push notification to the inviter is fire-and-forget** — wrapped in a `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL END;` block. The credit is still written even if the push fails. Don't infer "no push received" = "credit didn't fire."
