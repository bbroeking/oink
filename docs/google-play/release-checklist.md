# Google Play first-release checklist

## Current repo state (2026-07-18)

- [x] Android application ID is `com.broeking.ttp`
- [x] EAS production output is an Android App Bundle (`.aab`)
- [x] App icon and adaptive icon are configured
- [x] Unused Android microphone permission is blocked
- [x] Android billing fails closed: purchase surfaces stay hidden until a
  RevenueCat Google Play public key is supplied
- [x] In-app account deletion exists
- [x] Privacy policy and terms contain Android/Google language
- [x] Store listing copy and Data safety working sheet are in this directory
- [x] Android local build toolchain installed (Android Studio, Java 17, SDK/NDK)
- [x] Pixel 7 Android 15/API 35 emulator created as `TicklePig_API_35`
- [x] Debug app built, installed, and launched successfully on the emulator
- [ ] Google Play developer account verified and payments profile complete
- [ ] App record created in Play Console with package `com.broeking.ttp`
- [ ] Google Play App Signing enabled
- [ ] Stable populated reviewer credentials confirmed
- [ ] Google Play/Firebase push credentials configured, or Android push behavior
  explicitly accepted as unavailable for the first release
- [ ] Android billing configured, or the first release explicitly accepted with
  Slop Club/Season Pass hidden on Android
- [ ] Production AAB built, installed through a Play test track, and smoke-tested

## Build prerequisites on this Mac

This Mac has Android Studio, Java 17, the Android SDK/NDK, and an Android 15
Pixel 7 emulator installed. To boot the emulator, build/install the debug app,
and connect it to Metro, run:

```sh
npm run android:local
```

The first native compile can take several minutes; later builds reuse Gradle's
cache. The script also sets the required 16 GB Node heap and local SDK paths.
Confirm the underlying tools with:

```sh
java -version
adb version
sdkmanager --list
```

Expo SDK 52 targets Android API 35 by default. That is accepted for new apps
until Google Play's API 36 deadline on **2026-08-31**. This project must upgrade
before an update submitted on or after that date.

## Optional platform services

### Push notifications

Create/register the Android app `com.broeking.ttp` in Firebase, download
`google-services.json`, add `android.googleServicesFile` to `app.json`, and
upload the FCM v1 service-account credential to EAS. Do not commit private
service-account keys.

### Google Play Billing / RevenueCat

1. Create the Android app in the existing RevenueCat project.
2. Connect its Google Play service credentials.
3. Create Play products that match the intended cross-platform identifiers and
   map them to the existing RevenueCat entitlement and offerings.
4. Add `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` to the production build environment.
5. Test purchases and cancellation from a Play testing track. Sideloaded builds
   are not a valid billing test.

Until all five are complete, the Android build remains playable but hides
purchase entry points.

## Build and upload

Write `docs/builds/YYYY-MM-DD-build-N.md` before the build, per project policy.
Then build locally:

```sh
NODE_OPTIONS="--max-old-space-size=16384" \
  eas build --local --platform android --profile production
```

Rename the output to `build-N.aab`. The first AAB should be uploaded manually in
Play Console to **Internal testing**. API/service-account submission can be set
up only after the Play app exists and the first release has been created.

## Play Console forms

- Main store listing: use `store-listing.md`
- App access: provide reviewer login and instructions
- Ads: No
- Data safety: complete from `data-safety.md`, verifying the final AAB
- Content rating: answer from the live game (social interaction, user-created
  names, and fantasy/cartoon themes); do not guess based only on screenshots
- Target audience and content: select 13+ consistent with the Terms
- News apps: No
- Government apps: No
- Financial features: No
- Health apps: No
- App category and contact details: Casual game; values in `store-listing.md`
- Privacy policy: https://ticklethepig.com/privacy
- Account deletion: in-app path plus the public deletion-request page/email

## Test-track gate

Run the full `docs/pre-ship-smoke-checklist.md` on a real Android device using a
non-admin account installed from Play. Also cover:

- email sign-up/sign-in and keyboard behavior
- Android back button on every modal/sheet
- camera denied/granted flows and manual referral-code entry
- notification permission and warm/cold notification taps if push is enabled
- purchases, restore, cancellation, and entitlement sync if billing is enabled
- layout on a small phone and a tall phone

If the developer account is a personal account created after 2023-11-13,
Google currently requires a closed test with at least 12 continuously opted-in
testers for 14 days before applying for production access. Internal testing is
still the correct first upload.
