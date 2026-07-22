# Google Play Data safety working sheet

This is a repo-derived working sheet, not legal advice. Re-check every answer
against the exact production AAB and Google's current definitions when filling
out Play Console. Service-provider processing can qualify for Google's
"service provider" sharing exception; confirm that the contracts and actual
use match that exception before answering **not shared**.

## Top-level answers

- Does the app collect or share required user-data types? **Yes — collects**
- Is all collected data encrypted in transit? **Yes**
- Can users request deletion? **Yes** — in-app Account → Delete account, plus
  https://ticklethepig.com/privacy and brian@broeking.dev
- Ads or advertising use: **No**
- Sale of data: **No**

## Data types to declare as collected

| Google Play category | Tickle the Pig data | Required? | Main purposes |
| --- | --- | --- | --- |
| Personal info → Email address | Email/password accounts; Apple may provide email | Required for email accounts; optional for Apple | Account management, app functionality |
| Personal info → User IDs | Supabase/Apple account ID, username and tag | Required | Account management, app functionality, fraud/security |
| Financial info → Purchase history | Product, transaction/entitlement status via store and RevenueCat | Optional | App functionality, account management |
| App activity → App interactions | Tickle/game progress, inventory, social actions, seasonal progress | Required to play | App functionality, analytics, fraud/security |
| App activity → Other user-generated content | Username, crew name, and moderation report text | Optional except username | App functionality, account management, fraud/security |
| App info and performance → Crash logs | Sentry crash events and stack traces | Collected automatically in production | Analytics, developer communications |
| App info and performance → Diagnostics | Device model, OS/app version, breadcrumbs, performance samples | Collected automatically in production | Analytics, app functionality |
| Device or other IDs | Expo push token; diagnostic identifiers exposed by SDKs | Push token optional | App functionality, developer communications |

## SDK/service cross-check

- Supabase: authentication, database, realtime
- Sentry: crashes, diagnostics, account ID and username attached to events
- Expo: push token and notification delivery
- RevenueCat: account ID, products, transactions, entitlements when billing is
  enabled on that platform
- Apple / Google: identity or store billing as applicable

Before submission, inspect the final merged Android manifest and the Play SDK
Index warnings. The app intentionally blocks `RECORD_AUDIO`; camera access is
optional and used only after a user opens the QR-code scanner.

