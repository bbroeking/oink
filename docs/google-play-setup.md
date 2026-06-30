# Google Play Store — Launch Guide (Tickle the Pig)

A self-contained playbook for taking the **currently iOS-only** Expo 52 app to
the Google Play Store. Pick it up cold: it has the *why*, the exact in-repo
changes, the external/account steps, the TTP-specific gotchas, and the timeline.

> **Architecture context:** managed Expo workflow — there is **no `android/`
> folder**; EAS (or `expo prebuild`) generates the native Android project at
> build time. Android package = `com.broeking.ttp` (mirrors the iOS bundle id).
> Last verified against the repo on the date this guide was written.

---

## 0 · TL;DR

- **Effort:** ~1 week of actual work.
- **Wall-clock:** ~3–4 weeks — dominated by Google's **closed-testing wait**
  (~12 testers for ~14 days) that new personal dev accounts must clear before
  production unlocks. *Nothing else gates on it, so start the account first.*
- **No blockers** in the app architecture — `react-native-purchases` already
  supports Play Billing, the RevenueCat webhook is store-agnostic, and the
  managed workflow generates Android natively.
- **Status:** `eas.json` Android build/submit profiles are **done**; the rest is
  one in-repo pass + your account/secret setup + Play Console listing.

---

## 1 · Where things stand (snapshot)

| Piece | State |
| --- | --- |
| `app.json` → `android` | `package` + `adaptiveIcon` only (enough to build) |
| `eas.json` | ✅ Android `app-bundle` build + submit stub added (this guide's commit) |
| `react-native-purchases` | `^10.1.0` — supports Google Play Billing |
| `utils/iap.ts` | iOS-only; explicit no-op Android branch (ready to wire) |
| Push (`expo-notifications`) | APNs only — needs FCM for Android |
| Auth (`expo-apple-authentication`) | iOS-only; Android falls back to email/password (works) |
| `rive-react-native` | installed but **unused** — drop it |
| `android/` native folder | none (managed — generated at build) |
| Signing / `google-services.json` / Play account | not set up (your steps) |

---

## 2 · The journey (phases + what gates on what)

```
A. In-repo Android config      ──┐
B. Accounts & secrets (you)    ──┼─→  C. External setup (Play Console / Firebase / RevenueCat)
                                 │         │
                                 └─────────┴─→  D. Build → closed test (~14d) → production
```

A, B, and C can largely run in parallel. **D's testing wait is the long pole** —
register the Play account (step B1) on day one.

---

## 3 · Phase A — In-repo Android config

### A1. `eas.json` Android build + submit  ✅ DONE
Added to the `production` profile:
```jsonc
"android": { "buildType": "app-bundle", "image": "latest" }   // build → AAB
"android": { "serviceAccountKeyPath": "./google-play-key.json", "track": "internal" }  // submit
```
`appVersionSource: "remote"` + `autoIncrement: true` means **EAS manages
`versionCode`** (strictly increasing) — don't hardcode it.

### A2. `utils/iap.ts` — Android RevenueCat branch  🔧 DRAFTED (apply on go)
There's already a no-op placeholder at the `Platform.OS !== "ios"` early-return.
Wire it, gated on the env key so it stays a no-op until the key exists:
```ts
// near REVENUECAT_IOS_API_KEY:
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

// in initIAP(), replacing the `Platform.OS !== "ios"` early-return:
const apiKey = Platform.OS === "android" ? REVENUECAT_ANDROID_API_KEY : REVENUECAT_IOS_API_KEY;
if (!apiKey) return;                         // Android key not wired yet → Play Billing off
if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
await Purchases.configure({ apiKey, appUserID: userId });
```

### A3. `app.json` — FCM hook  🔧 (after Firebase exists)
```jsonc
"android": { "googleServicesFile": "./google-services.json", /* …existing… */ }
```

### A4. Auth  🔧 (optional)
`expo-apple-authentication` is iOS-only. Android users get the **email/password
fallback today** — shippable as-is. For nicer UX, add
`@react-native-google-signin/google-signin` and a `signInWithIdToken({ provider:
"google" })` path mirroring the Apple flow.

### A5. Cleanup  🔧
Remove `rive-react-native` from `package.json` (unused; avoids Android build
friction) — or confirm it's a planned feature before keeping it.

---

## 4 · Phase B — Accounts & secrets you provide (🔑)

| Item | Where to get it | Where it goes |
| --- | --- | --- |
| **Play Developer account** | play.google.com/console — **$25 one-time** + tax/merchant info | — (do this first) |
| **Upload keystore** | `keytool` or let EAS generate/manage | EAS credentials (or `credentials.json`); back it up — losing it blocks updates |
| **`google-services.json`** | Firebase project → Cloud Messaging | repo root (gitignored) → referenced by `app.json` |
| **RevenueCat Android key** | RevenueCat → add Android app → Play Billing public SDK key | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (EAS env/secret) |
| **`google-play-key.json`** | Google Cloud → service account w/ Play access | repo root (gitignored) → used by `eas submit` |

---

## 5 · Phase C — External setup (🌐)

1. **Create the app** in Play Console with package `com.broeking.ttp`.
2. **IAP products** — recreate the 3 App Store products with the **same ids** —
   `yearly`, `monthly`, `seasonPass` — and map them in RevenueCat.
   - The `supabase/functions/revenuecat-webhook` is **store-agnostic — no change.**
3. **Firebase / FCM** — create project, enable Cloud Messaging, link to the
   Expo `projectId` (in `app.json`).
4. **Store listing assets:**
   - App icon **512×512**, **feature graphic 1024×500**, phone screenshots
     (reuse the screenshot rig — drive the app on an Android emulator, capture at
     Play's portrait sizes).
   - Short (≤80 char) + full (≤4000 char) description — adapt from ticklethepig.com.
   - **Privacy policy URL** — already have `https://ticklethepig.com/privacy`.
   - **IARC content rating** questionnaire (likely Everyone — cozy, no violence).
   - **Data Safety** form — declare: email (auth), usernames/progress (UGC),
     Sentry crash data; encrypted in transit; not sold/shared.

---

## 6 · Phase D — Build, test, ship

```bash
# 1. Build an AAB (managed; keystore must be configured in EAS first)
eas build  --platform android --profile production

# 2. Upload to the closed-testing track (needs google-play-key.json)
eas submit --platform android --profile production
#    …or download the AAB and upload it manually in Play Console.
```
3. **Closed testing** — add ~12 testers; Google requires **~14 days** of testing
   before production unlocks (new personal dev accounts). Start this ASAP.
4. **Promote** closed → (optional open beta) → **production**.

> **Local vs cloud builds:** the iOS convention here is *local* builds (cloud
> quota). For the first Android AAB, **EAS cloud is simpler** (no Android
> Studio/JDK/keystore wrangling locally). Switch to local only if quota forces it.

---

## 7 · TTP-specific gotchas

| Risk | Why | Fix |
| --- | --- | --- |
| IAP won't sell on Android | Products must exist in Play Console + be mapped in RevenueCat | Phase C2; test in Play sandbox |
| No Android push | `expo-notifications` needs FCM, not APNs | Phase B (`google-services.json`) + Phase C3 |
| Apple Sign-In absent on Android | It's iOS-only | Email fallback works; optional Google Sign-In (A4) |
| `rive-react-native` build friction | Installed, unused | Remove (A5) |
| Target API level | Play requires a recent target (API 35 era) | Expo 52 defaults are current; verify at build |
| `versionCode` collisions | Must strictly increase | Handled by EAS remote auto-increment |
| Lost keystore | Can't ship updates | Let EAS manage it / back it up offline |

---

## 8 · Build-pipeline health (the Metro OOM, for context)

`eas build --local` runs the same Metro bundler that OOMs the local dev server.
Known state + mitigations (already applied in-repo): watchman installed,
`_mudwar_raw` excluded via `metro.config.js`, oversized PNGs compressed, Node
pinned to 22 via `.nvmrc`, heap raised. **It is still a Metro/Expo 52 leak that
climbs to the heap ceiling on long runs** — for *local* builds, give it the big
heap (`NODE_OPTIONS=--max-old-space-size=24576`) and a fresh start. **Cloud EAS
builds run on EAS's own infra, so the Android AAB build is unaffected** — another
reason to prefer cloud for the first Android build.

---

## 9 · Critical path & realistic timeline

1. **Day 0:** register Play account ($25) — starts the only unskippable clock.
2. **Week 1 (parallel):** in-repo edits (A2–A5) · keystore · Firebase/FCM ·
   RevenueCat Android key + Play IAP products · store-listing assets.
3. **~Day 7:** first AAB → closed testing with ~12 testers.
4. **+~14 days:** testing window clears → promote to production.

→ **~3–4 weeks wall-clock, ~1 week of work.**

---

## 10 · References

- `eas.json` (build/submit), `app.json` (Android config + Expo `projectId`),
  `utils/iap.ts` (RevenueCat), `supabase/functions/revenuecat-webhook/` (entitlements),
  `scripts/ship-ios.sh` (iOS ship flow — Android equivalent TBD).
- Privacy/ToS already self-hosted on ticklethepig.com.
- Companion: `metro.config.js` + `.nvmrc` (dev-server/build OOM mitigations).
