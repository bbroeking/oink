# Apple sign-in on the iOS simulator

Use a normal Debug simulator build with signing enabled:

```sh
NODE_OPTIONS="--max-old-space-size=16384" npx expo run:ios
python3 scripts/verify-ios-simulator-auth.py
```

The verifier defaults to the installed `com.broeking.ttp` app on the booted
simulator. Pass a simulator `.app` path to check an artifact before installing.
It checks the actual main executable's embedded Apple sign-in entitlement,
not just the source entitlements file. It does not validate Apple-account
credentials or complete the Supabase login.

Do not disable signing for auth acceptance. An unsigned simulator compile can
launch and render the game while Apple authorization fails immediately.
Rebuild through Xcode/Expo so the simulator entitlements are linked correctly;
adding a signature to an existing executable is not an equivalent repair.

## September 8, 2026 diagnosis

On the iPhone 17 Pro / iOS 26.4 simulator, tapping Sign in with Apple failed
before presenting the Apple sheet. The logs showed
`AKAuthenticationError -7026`, `AuthorizationError 1000`, and Expo's
`ERR_REQUEST_UNKNOWN`. Supabase's token exchange was never reached.

Source configuration already declared `usesAppleSignIn`, the Expo plugin,
the `Default` Apple sign-in entitlement, bundle ID `com.broeking.ttp`, and
the correct Xcode team. The installed executable had neither simulated
entitlements nor a signed entitlement plist. The exact build invocation that
produced that defective executable was not established; an older successful
build log did not describe the installed executable's actual signing state.

The regression check reproduced the artifact defect:

```text
$ python3 scripts/verify-ios-simulator-auth.py
FAIL: main executable has no readable entitlement plist
```

A local Debug Xcode rebuild with `CODE_SIGNING_ALLOWED=YES` succeeded. The
rebuilt artifact contained `com.apple.developer.applesignin = [Default]`
and `application-identifier = Z8F75879GQ.com.broeking.ttp`. After reinstalling
without deleting app data, the verifier passed and the same Apple sign-in
button opened Apple's native prompt asking the user to sign in to an Apple
Account in Settings. This verifies removal of the immediate authorization
failure. Full Apple-account sign-in and the subsequent Supabase session still
require account authentication; they were not completed in this session.

No app auth logic or production configuration changed. No distributable build
was created. Physical-device sign-in remains part of release acceptance.

[Expo documents limited simulator testing](https://docs.expo.dev/versions/latest/sdk/apple-authentication/#development-and-testing)
and recommends validating on a physical device.
