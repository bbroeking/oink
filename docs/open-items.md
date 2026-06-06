# Open items — to-do

The remaining unstarted work, after the happiness + barn-visiting + Closet +
World Cup arc shipped. Three things plus a build.

## 1. Refer-a-friend install link + App Store cutover (was task #13)
The universal-link layer exists (build 78): `ticklethepig.com/r/<code>` → app if
installed, else the landing page → TestFlight join (`testflight.apple.com/join/5dDhSNN9`).
- **Verify** the uninstalled-user path end-to-end on a device (link → landing →
  install → code pre-fills onboarding).
- **App Store cutover:** we're approved for public launch — swap the landing
  "join" button + any in-app copy from the TestFlight URL to the App Store
  product URL when it goes live. Swap point: `landing/index.html:452` (commented).

## 2. Notifications — APNs entitlement (was task #11)
Root cause found: `ios/ttp/ttp.entitlements` has **no `aps-environment`** entitlement,
so the app can't register with APNs → `getExpoPushTokenAsync` never returns a token.
Fix sequence (touches Apple credentials, so do in order):
1. Enable **Push Notifications** on the App ID (via `eas credentials` interactive
   or the Apple Developer portal).
2. EAS regenerates the provisioning profile with push.
3. Add `aps-environment` to `ios/ttp/ttp.entitlements`.
4. Rebuild + test on a **real device** (sim can't get push tokens). Confirm an
   APNs key is uploaded to EAS.
*Don't add the entitlement before step 1/2 or the next build's code-signing fails.*

## 3. Teams push-pull + mini-games (was task #18)
Big social meta-game; a clickable **mock exists** on branch `social-teams-pushpull`
(Mud Hogs vs Sky Swine tug-of-war). Real build is gated on the design fork:
**is "teams" a new axis or a reframing of the angel/goblin alignment schism?**
See `docs/social-layer-ideas.md`. Build on top of barn visiting (now done).

## 4. Ship a build
A lot has landed since the last delivered TestFlight build (pre-85): happiness
system + mood sprites, barn visiting (visit tap-session + truffle), Closet +
multi-slot cosmetics, World Cup suite, security/lint fixes. Roll `eas build
--local`, changelog first (`docs/builds/YYYY-MM-DD-build-N.md`), upload via
Transporter.
