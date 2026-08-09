# AdMob rewarded-ad callback

This public Edge Function accepts Google AdMob server-side verification (SSV)
callbacks. It verifies Google's ECDSA signature and the configured ad unit,
reward item, reward amount, timestamp, and opaque attempt before calling the
service-role-only `finalize_rewarded_ad` RPC.

Production setup (not performed by local implementation):

1. Push the rewarded-ad migrations only after explicit approval.
2. Set Edge Function secrets:
   - `ADMOB_REWARDED_IOS_UNIT_ID`
   - `ADMOB_REWARD_ITEM=personal_tickles`
   - `ADMOB_REWARD_AMOUNT=3`
3. Deploy `admob-reward-callback` with JWT verification disabled (also declared
   in `supabase/config.toml`).
4. Put the resulting function URL in the AdMob rewarded unit's SSV settings and
   configure that unit's reward as exactly 3 `personal_tickles`.
5. Keep both `app_config.rewarded_ads` and `rewarded_ad_settings.enabled` off
   until signed callback verification has been exercised with a test account.

Do not log callback URLs or query strings: they include the opaque attempt ID.
