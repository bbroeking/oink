# App Store Review Notes — Tickle the Pig

Paste the **Demo Account** + **Notes** sections below into App Store Connect → App Information → **App Review Information**.

---

## Demo Account

> Use email/password sign-in instead of Apple Sign-In to see a pre-populated account with friends, progress, and a working social loop. Apple Sign-In creates a fresh empty account per Apple ID, which doesn't show off the gameplay.

**Email:** `demo@ticklethepig.com`
**Password:** `TicklePig2026!`

To use:
1. Open the app
2. Tap **"or use email"** beneath the Apple Sign-In button on the welcome screen
3. Enter the email + password above
4. Tap **Sign in**

---

## Notes for Review

**What the app is:**
Tickle the Pig is a quiet, cosy social pet-care game. The player taps Rosie the pig to "tickle" her, earning a tickle-bank currency. Tickles convert into snouts (the spending currency) which buy cosmetic items — hats, glasses, auras, backgrounds — in a daily-rotating shop. Friends form a sounder; players can trade tickles, bless each other (small buffs), or curse each other (small debuffs) in a one-per-day ritual.

**Five-minute flow to evaluate everything:**
1. **Sign in** with the demo credentials above → lands on the **Barn** (home screen) with Rosie waiting
2. **Tap Rosie** a few times → tickles count up, particles drift up, a sound plays
3. **Tap the Friends tab** → see the demo account's 5 friends (the Sounder)
4. **Tap the Inbox segment** at the top → see the activity feed (blessings/curses/trades that have happened)
5. **Tap the Season tab** → see weekly bounties + the season pass tier ladder
6. **Tap the Shop tab** → see today's drop with Wear / Buy buttons depending on ownership
7. **Tap the Me tab → Achievements** → tap the Ready filter chip to see the gold Claim button treatment

**What to look for:**
- No ads anywhere
- No third-party tracking — no IDFA prompt, no ATT
- Sign-in supports both Apple Sign-In (production) and email/password (this demo)
- Push notification permission prompt is opt-in (decline = app still works)
- Privacy policy: https://bbroeking.github.io/oink/privacy.html
- Support: https://bbroeking.github.io/oink/support.html

**Known notes / not bugs:**
- The "snout pass" premium track is hidden in this version (gated behind a feature flag) — only the free tier is visible. No in-app purchases ship in v1.
- The "Your Sounder" referral program is also hidden behind a feature flag — visible only when we enable it post-launch.
- The Barn's home screen uses Apple's TrueType / Caprasimo / Patrick Hand fonts for the storybook look — fonts are bundled via expo-google-fonts, not fetched at runtime.

**Contact for review questions:**
`iamactuallyinthearena@gmail.com`
