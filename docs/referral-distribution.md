# Referral distribution & deep linking — Spec

Why referrals "aren't working for people," and the path to fixing it. This is the **distribution layer** — how a code travels from inviter to invitee and gets into the app. It's distinct from `docs/referrals.md` (reward economics) and `docs/referral-feedback.md` (inviter-side celebration). Both of those assume the code *arrives*; this doc is about why it currently often doesn't.

---

## The referral system has three layers

| Layer | What it does | Status |
|---|---|---|
| **1. Distribution** | Get the code from inviter → invitee → into the app | **BROKEN** — links dead-end in Safari |
| **2. Redemption** | `redeem_referral_code(p_code)` validates + attributes + pays the +50 | Works (if a code reaches it) |
| **3. Reward** | Engagement gate credits the inviter +100 once the invitee proves engagement | Works (see `docs/referrals-debug.md`) |

Layers 2 and 3 are solid. **Layer 1 is the problem**, and it's almost certainly why "it's not working for people."

---

## Why distribution is broken right now

The code in `utils/referrals.ts` + `app/_layout.tsx:388` is built to handle a Universal Link: `https://ticklethepig.com/r/<code>`. But the infrastructure that makes a Universal Link actually open the app **does not exist**:

| Requirement | Present? | Consequence if missing |
|---|---|---|
| A registered domain (`ticklethepig.com`) | **No** | The link points nowhere |
| `associatedDomains` entitlement (`applinks:ticklethepig.com`) in the build | **No** (entitlements only have Apple Sign In) | iOS never associates the app with the domain → tapping the link opens Safari, not the app |
| An `apple-app-site-association` (AASA) file served from the domain | **No** | Even with the entitlement, iOS can't verify the association |
| A landing page for uninstalled users | **No** | Uninstalled friends hit a 404 / parked-domain page |
| Custom URL scheme set to something real | **No** — it's the default `myapp` | Custom-scheme deep links (`myapp://`) are generic + unused |

**Net effect:** any "tap to join" link a user shares goes to Safari and dies. The *only* working path today is fully manual:

```
Inviter texts the code as plain text  →  new user joins (somehow)  →
  types/pastes "ROSIE-K3T9" into the onboarding code-entry screen
```

The onboarding screen does try a clipboard sniff (`parseReferralCodeFromClipboard`), so if the inviter's code happens to be on the clipboard at first launch, it pre-fills. But nothing *puts* it there reliably, so in practice it's manual typing.

---

## How mobile apps usually do referrals

Three approaches, roughly in order of magic (and cost):

### A. Manual code entry (most robust, zero infra)
The inviter shares a code as text; the invitee types it in. Reddit, many indie apps, and most early-stage apps do exactly this. **It always works** — no domain, no entitlement, no attribution service. The downside is friction (the user has to copy/type) and no "tap → done" wow.

> TTP already has this fully built (the onboarding `ReferralCodeEntry` step + `redeem_referral_code`). It's the one path that works today.

### B. Universal Links (for users who already have the app)
`https://yourdomain.com/r/CODE` taps open the app directly (if installed) and route to a handler. Requires:
- A domain you control
- The `associatedDomains` entitlement in the build
- An AASA file at `https://yourdomain.com/.well-known/apple-app-site-association`

This handles the "existing user taps a friend's link" case elegantly. It does **not** solve the new-user case (app not installed) — that's deferred deep linking (below).

### C. Deferred deep linking (the "tap link → install → auto-applies code" magic)
This is what makes referrals feel seamless: a brand-new user taps a link, installs from the store, opens the app, and the code is *already applied* — no typing. iOS has **no native mechanism** for this (the original URL is lost across the App Store install). You need one of:

- **Branch.io** — the industry standard for referral deep linking. Free tier covers most indie needs. Uses probabilistic matching (IP + device fingerprint) + clipboard to bridge the install gap. Adds an SDK + dashboard config.
- **AppsFlyer / Adjust / Singular** — attribution platforms; heavier, more marketing-oriented, usually paid.
- **Apple's clipboard bridge** (what TTP half-attempts) — the landing page copies the code to the clipboard; the app reads it on first launch. Free, no SDK, but fragile: iOS shows a paste banner, clipboard can be cleared, and Apple discourages silent clipboard reads. Works ~"okay," not great.
- **Firebase Dynamic Links** — was the popular free option, but **Google shut it down (sunset 2025)**. Don't build on it.

Most apps land on: **B (Universal Links) for installed users + a deferred service (Branch) or the manual code for new users.**

---

## The TestFlight reality (this is the crux right now)

The app is in TestFlight, not on the App Store. That fundamentally constrains referral distribution:

- **New users cannot "install from the App Store"** — the app isn't public. They must join via TestFlight (a public TestFlight link, capped at 10,000 external testers, or an email invite).
- **So the deferred-deep-link "tap → install → auto-apply" flow is impossible during beta** regardless of infrastructure — there's no App Store to install from.
- **Universal Links DO work in TestFlight builds** — the entitlement + AASA are what matter, not App Store distribution. So an *installed* tester tapping a friend's link can open the app and pre-fill the code, once the domain is set up.
- **Manual code entry works perfectly in TestFlight** — get the new person into TestFlight, they type the code in onboarding. This is the only end-to-end path that works pre-launch.

**Implication:** during TestFlight, lean entirely on the manual code path, and optionally a landing page that hands out the TestFlight join link + the code. Don't invest in deferred-deep-link infrastructure (Branch) until you're approaching App Store launch, because it literally cannot do its job until there's an App Store to install from.

---

## Should you buy a domain? Yes — here's what it unlocks

A domain (say `ticklethepig.com`) is worth the ~$12/year. Here's the value, in order of when it pays off:

| Use | When it helps | Requires |
|---|---|---|
| **Landing page for shared links** | Now (TestFlight) — a friend taps the link, sees "Join the Tickle the Pig beta" + the TestFlight join button + the code to copy | Domain + a static page (one HTML file on Vercel/Netlify/GitHub Pages) |
| **Universal Links for installed testers** | Now (TestFlight) — installed friend taps link → app opens → code pre-fills | Domain + `associatedDomains` entitlement + AASA file |
| **AASA-verified deep links at launch** | App Store launch | Same as above (already set up) |
| **Deferred attribution (auto-apply on install)** | App Store launch | Domain + Branch (or clipboard bridge) |

You do **not** need the domain to make referrals work *at all* — manual codes work without it. But the domain is the foundation for every non-manual path, and setting it up now means it's battle-tested before launch.

---

## Recommended phased plan

### Phase 0 — Make the manual path bulletproof (now, no domain needed)
The path that works today should be frictionless:
- Ensure `redeem_referral_code` is **actually deployed to production** (per `CLAUDE.md`, DB pushes need explicit "go" — verify it's pushed; if not, *nothing* works, which would fully explain "not working for people").
- The Account "Refer friends" card's Share button should share a message that includes the **code prominently** and clear instructions: "Join the Tickle the Pig beta: <TestFlight link>. Use my code ROSIE-K3T9 when you start." (Today `shareMessageForCode` builds a `ticklethepig.com/r/...` URL that dead-ends — change it to surface the code + TestFlight link instead while there's no live domain.)
- Confirm the onboarding code-entry step is reachable and the clipboard pre-fill works.

### Phase 1 — Domain + Universal Links (small infra, big polish)
1. Buy the domain.
2. Add `associatedDomains` to `app.json` (see config below) and rebuild.
3. Host the AASA file at `https://<domain>/.well-known/apple-app-site-association`.
4. Put up a one-page landing site that shows: the code (from the `/r/<code>` path), a "Join the beta" TestFlight button, and a Copy button.
5. Now installed testers get tap-to-open; uninstalled friends get a real landing page instead of a dead link.

### Phase 2 — App Store launch: decide deferred attribution
When you're public, decide between:
- **Branch.io** (recommended if referrals are a growth lever) — true tap→install→auto-apply.
- **Clipboard bridge** (free, already half-built) — landing page copies the code, app reads it on first launch. Acceptable for a cozy game where referral volume is modest.

---

## Concrete setup for Phase 1

### `app.json` — add the entitlement

```jsonc
{
  "expo": {
    "scheme": "ticklethepig",   // rename from the default "myapp" while here
    "ios": {
      "bundleIdentifier": "com.broeking.ttp",
      "associatedDomains": ["applinks:ticklethepig.com"]
      // ...existing entitlements
    }
  }
}
```

Rebuild required (entitlements are baked at build time — a new `eas build --local` + TestFlight upload).

### AASA file — served at `https://ticklethepig.com/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAM_ID>.com.broeking.ttp",
        "paths": ["/r/*"]
      }
    ]
  }
}
```

- `<TEAM_ID>` is your Apple Developer Team ID (App Store Connect → Membership). The file must be served over HTTPS, with `Content-Type: application/json`, **no redirect**, and no `.json` extension on the path.
- Apple caches AASA via its CDN (`https://app-site-association.cdn-apple.com/a/v1/ticklethepig.com`); for TestFlight, the CDN-cached copy is what's used.

### Landing page — minimum viable

A single static HTML page at `https://ticklethepig.com/r/<code>` (or a catch-all that reads the path) that renders:
- The code, big and copyable ("Your friend's code: **ROSIE-K3T9**")
- A "Join the Tickle the Pig beta" button → the public TestFlight link (swap to the App Store badge at launch)
- A line: "After you install, enter this code when the app asks."

Host on Vercel / Netlify / GitHub Pages — all free, all support the `.well-known` path + a catch-all route. No backend needed.

---

## Decisions to make

1. **Domain name.** `ticklethepig.com` is what the code already assumes (`REFERRAL_URL_HOST` in `utils/referrals.ts`). If you buy a different domain, that constant + the AASA `appID` + the `associatedDomains` entitlement all have to match it. Cheapest to just buy the one the code expects.
2. **Deferred attribution at launch: Branch vs clipboard.** Defer this decision until Phase 2 — it doesn't matter during TestFlight.
3. **Share message copy now.** Whether to change `shareMessageForCode` immediately to surface the code + TestFlight link instead of the dead `ticklethepig.com/r/...` URL. Recommend yes — it's a one-line fix that makes the working (manual) path clearer.

---

## Heads-up

- **First, verify the migration is deployed.** Before any of this, confirm `redeem_referral_code` exists in production. If the referrals migration (`4c07a75`) was never pushed (`db:push` needs explicit "go" per `CLAUDE.md`), then code entry itself fails and *no* distribution work matters. This is the single most likely cause of "not working for people." Check via `docs/referrals-debug.md`.
- **The current share URL is a trap.** `shareMessageForCode` builds a `ticklethepig.com/r/<code>` link. With no live domain, every shared link dead-ends in Safari — which looks exactly like "referrals are broken" to a user who taps it. Until the domain is live, the share message should lead with the code + TestFlight join link, not the URL.
- **TestFlight public link has a 10k cap** and requires Apple's beta-review for the first build of each version. Fine for a beta; just know the ceiling.
- **Don't build on Firebase Dynamic Links** — Google sunset them in 2025.
- **Universal Links need a real rebuild to test.** The `associatedDomains` entitlement is compiled in; you can't test it via Expo Go or a JS-only reload. Budget a TestFlight build for Phase 1 verification.
- **Clipboard reads are increasingly user-visible.** iOS 14+ shows a paste banner when an app reads the clipboard. If you lean on the clipboard bridge, the user sees "TTP pasted from Safari" — not harmful, but not invisible. Branch handles this more gracefully.
