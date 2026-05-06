# RevenueCat → Supabase webhook

Server-side entitlement validation. RC fires events for purchases, renewals,
cancellations, and refunds. This function flips the user's `is_vip` /
`premium_unlocked` based on the truth from Apple, not the client.

## Deploy

```bash
# 1. Set the shared secret
openssl rand -hex 32 | xargs -I {} supabase secrets set RC_WEBHOOK_AUTH_HEADER={}

# 2. Deploy
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is required — the request comes from RevenueCat's
servers, not an authenticated user. We do our own auth via the bearer token.

## Configure in RevenueCat dashboard

1. RC dashboard → your project → **Integrations → Webhooks → Add Webhook**
2. URL:
   ```
   https://<your-supabase-project-ref>.supabase.co/functions/v1/revenuecat-webhook
   ```
3. Authorization header:
   ```
   Bearer <the secret you set above>
   ```
   Get the secret value with `supabase secrets list`.
4. Save. Click **Send Test Event** to verify the function returns `200 ok`.

## Test locally

```bash
supabase functions serve revenuecat-webhook --env-file ./supabase/.env.local
# then in another terminal:
curl -X POST http://localhost:54321/functions/v1/revenuecat-webhook \
  -H "Authorization: Bearer YOUR_LOCAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "INITIAL_PURCHASE",
      "app_user_id": "<some-user-uuid>",
      "entitlement_ids": ["tickle_the_pig_pro"]
    }
  }'
```

## What's handled

| RC event | Action |
|---|---|
| `INITIAL_PURCHASE` | Set is_vip=true |
| `RENEWAL` | Set is_vip=true (refresh expiration) |
| `PRODUCT_CHANGE` | Set is_vip=true |
| `NON_RENEWING_PURCHASE` | Set is_vip=true (lifetime) |
| `UNCANCELLATION` | Set is_vip=true |
| `CANCELLATION` | Set is_vip=false |
| `EXPIRATION` | Set is_vip=false |
| `BILLING_ISSUE` | Set is_vip=false |
| `REFUND` | Set is_vip=false |
| `SUBSCRIPTION_PAUSED` | Set is_vip=false |
| `TEST_NOTIFICATION` | 200 ok, no DB change |
| Other (`TRANSFER`, etc.) | 200 ok, no DB change |

## Known limitations

- Does not currently mirror to season-pass `premium_unlocked`. The
  `dev_unlock_premium(plus: true)` RPC needs an `authenticated` JWT context;
  call sites in this function are admin-context. To wire it properly, write
  a `set_premium_for_user(uid, plus)` admin-only RPC and call that instead.
- `app_user_id` must be the Supabase user UUID — confirmed via
  `Purchases.configure({ appUserID: userId })` in `utils/iap.ts`.
