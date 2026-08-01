# Legacy iOS shipping paths

> This document describes older Xcode/scripted paths and is retained for
> troubleshooting. The canonical release process is
> [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md): local EAS production build,
> upload through Transporter, and no `eas submit`.

Two paths. Pick one.

---

## Path A — Xcode Organizer (easiest, recommended for first time)

**One-time setup**
1. Open Xcode.
2. `Settings → Accounts` — sign in with your Apple ID.
3. Confirm team `Brian Broeking (Z8F75879GQ)` is listed.

**Each ship**
1. Bump build number:
   ```bash
   ./scripts/bump-build.sh
   ```
2. Open the workspace in Xcode:
   ```bash
   open ios/ttp.xcworkspace
   ```
3. Top toolbar — set destination to **"Any iOS Device (arm64)"** (NOT a simulator).
4. `Product → Archive`. Wait ~10 min.
5. When done, **Window → Organizer** opens automatically.
6. Select the latest archive → **Distribute App**.
7. Choose **App Store Connect** → **Upload** → keep defaults → **Upload**.
8. Apple processes (~10 min). You'll get an email when ready in TestFlight.

That's it. Same end result as `eas submit` but free and unlimited.

---

## Path B — Fully scripted (after you have a working Path A)

**One-time setup**
1. Generate an App Store Connect API key:
   - https://appstoreconnect.apple.com/access/integrations/api
   - Role: **App Manager**
   - Download the `.p8` file
2. Save it where altool expects:
   ```bash
   mkdir -p ~/.appstoreconnect/private_keys
   mv ~/Downloads/AuthKey_*.p8 ~/.appstoreconnect/private_keys/
   ```
3. Note the **Key ID** (e.g. `4FSMZP75WV`) and **Issuer ID** (UUID at top of API Keys page).
4. Add to your shell profile (`~/.zshrc`):
   ```bash
   export ASC_KEY_ID="4FSMZP75WV"
   export ASC_KEY_ISSUER="00000000-0000-0000-0000-000000000000"
   ```
   Reload: `source ~/.zshrc`

**Each ship**
```bash
./scripts/ship-ios.sh
```

That bumps the build, archives, exports, and uploads in one command.

---

## When something goes wrong

**"No signing certificate" / "No matching provisioning profile"**
Open Xcode, target `ttp` → **Signing & Capabilities** → check **Automatically manage signing** + Team set.

**"Apple is rejecting my build for missing privacy strings"**
Edit `ios/ttp/Info.plist` — add the missing `NS<...>UsageDescription` string.

**Build is huge / slow upload**
Run `pnpm install` and ensure no garbage in `node_modules` (the .ipa itself only ships the JS bundle + assets).

**Build number conflicts ("already used")**
Re-run `./scripts/bump-build.sh` until you get a fresh number, then re-archive.

---

## What this replaces

| Old EAS command | New local equivalent |
|---|---|
| `eas build --profile production` | `./scripts/bump-build.sh` + Xcode Archive (or `./scripts/ship-ios.sh`) |
| `eas submit --latest` | Xcode Organizer → Distribute → Upload (or scripted via altool) |

EAS is no longer required. The `eas.json` and `app.json` configs can stay for now (don't hurt anything).
