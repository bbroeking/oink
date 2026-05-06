# App Store listing — Tickle the Pig

Drafts for the App Store Connect submission. Edit to taste, then paste into ASC →
your app → **App Information** + **iOS App** version.

---

## App Name (30 char max)

```
Tickle the Pig
```

Backup options if taken:
- `Tickle the Pig: Cozy`
- `Tickle the Pig — Pet`

## Subtitle (30 char max)

```
Cute pig dress-up + tickle
```

## Promotional Text (170 char max — editable any time)

```
A new lucky tickle drops every day! Hit one and earn bonus hearts. New seasonal items every Sunday.
```

## Description (4000 char max)

```
Meet Rosie, the cuddliest pig you'll ever tap.

Tickle the Pig is a cozy mobile game where you give Rosie a tickle, watch her giggle, and dress her up with hundreds of cute cosmetics. No timers blocking you, no algorithms deciding what you see. Just you, your pig, and a lot of hats.

★ TAP TO TICKLE
Each tap earns you a heart. Rosie reacts with happy bounces, surprise face, waves — every tap feels different. Build up a tickle streak and watch your collection grow.

★ 100+ COSMETIC ITEMS
Hats, glasses, bows, masks, scarves, capes, necklaces, magic wands, and more. Mix and match. Show off your style on the global leaderboard or set your own vibe in the wardrobe.

★ DAILY LUCKY NUMBERS
Every day, three lucky tickle numbers are drawn. If your tickle lands on one, you win bonus hearts. First player to claim each number wins. The race is on.

★ SEASONS + PASS
Each season brings a new theme, exclusive cosmetics, and a 30-tier reward path. Free track for everyone, premium pass for big collectors.

★ PIG PRO
Want more cap, faster regen, all premium passes, and exclusive items? Pig Pro unlocks all of it. Monthly, yearly, or lifetime.

NO ALGORITHMS. NO FEEDS. NO RECOMMENDATIONS.
The shop rotates by deterministic daily hash. The leaderboard is plain DESC sort by lifetime tickles. Lucky numbers are random integers picked once a day. That's it.

Built by one person who really likes pigs. Suggestions, bug reports, hat ideas — find me on TikTok @ticklethepig.

— What's New —
* 100 cosmetic items
* Daily lucky tickles
* Whimsy paper-sticker UI
* Sprite-based pig animations (idle, jump, sad, surprise, wave)
* In-app purchases for Pig Pro
```

## Keywords (100 char max, comma-separated)

```
pig,cute,casual,cozy,idle,clicker,pet,dress up,kawaii,tap,tickle,mobile game,cosmetic,collection
```

## Categories

- Primary: **Games > Casual**
- Secondary: **Games > Simulation**

## Age Rating

- 4+ (no objectionable content)

## Pricing

- App: **Free**
- IAP: yes
  - `lifetime` Non-Consumable — $19.99
  - `yearly` Auto-Renewable — $39.99/yr (with 7-day free trial)
  - `monthly` Auto-Renewable — $4.99/mo (with 7-day free trial)

## Support URL

```
https://bbroeking.github.io/oink/
```

(or your custom domain once configured)

## Marketing URL

Same as support URL until you build a separate marketing site.

## Privacy Policy URL

```
https://bbroeking.github.io/oink/privacy.html
```

## App Privacy ("Data Used to Track You" section)

If you don't add tracking SDKs (Sentry only collects crash data, not user identifiers), select:

- **Data Not Collected** — `false`
- **Data Linked to You**:
  - Identifiers → User ID (email/Apple ID for sign-in)
  - Purchases → Purchase History (subscriptions)
- **Data Not Linked to You**:
  - Diagnostics → Crash Data (Sentry)

Tracking: **No**

---

## Screenshots — required sizes

You need 3+ screenshots for **6.7" (Pro Max)** and the same for **iPad 13"**
if you support iPad. ASC autoscales to other sizes.

**6.7" iPhone**: 1290 × 2796 px
**iPad 13"** (only if supportsTablet): 2064 × 2752 px

### Recommended 5 screenshots (in order)

1. **Hero**: home screen showing pig wearing cowboy hat + sun-yellow stat tickets. Caption: "Tickle a pig. It's that simple."
2. **Wardrobe / item variety**: shop browse view showing legendary crown + multiple colorful items. Caption: "100+ cosmetics, fresh daily."
3. **Jump animation**: pig mid-jump with tickle counter rising. Caption: "Every tap is a tiny celebration."
4. **Lucky tickle**: pig surprised with lucky number toast visible. Caption: "Hit a lucky tickle, win bonus hearts."
5. **Leaderboard**: champion poster with bunting. Caption: "Top of the wall — show off your collection."

### How to capture

1. Boot the simulator at exactly 6.7" (iPhone 15 Pro Max or 16 Plus)
2. Set up the screen state you want (equip the right item, etc.)
3. **Cmd-S** in the simulator → saves a 1290×2796 PNG to Desktop
4. Open in Preview → no edits needed if framing is right
5. ASC accepts portrait PNG/JPG up to 8MB each

For text overlay (the captions): use Figma or Canva, drop the screenshot in,
add a caption banner at the top in matching whimsy style.

---

## "What to Test" (TestFlight notes)

Use the block from `docs/RELEASE_NOTES.md` and update per build.
