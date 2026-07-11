# App Store listing — Tickle the Pig (v2 — Season 1: The Great Hunger)

Drafts for the App Store Connect submission. Edit to taste, then paste into ASC →
your app → **App Information** + **iOS App** version. (v1 listing lives in git
history — this revision is the Season-1 rewrite, 2026-07-07, build 105.)

---

## App Name (30 char max)

```
Tickle the Pig
```

## Subtitle (30 char max)

```
Cozy pig game with friends
```

(v1 was "Cute pig dress-up + tickle" — the subtitle now carries the Connect
pillar; dress-up moved into the description.)

## Promotional Text (170 char max — editable any time)

```
Season 1: The Great Hunger is here! Team up with friends, dig for truffles, and race rival squads — best diggers win prizes every Monday. New hats every week.
```

(161/170 chars. Editable in ASC any time without a new submission.)

## Description (4000 char max)

```
Meet Rosie. She's a pig. Tickle her.

That's the whole pitch, really — except now the valley she lives in has a problem, and the problem has a crown, a bib, and a bottomless appetite.

Tickle the Pig is a cozy little world you check in on the way you'd check on a friend: tickle Rosie, dress her ridiculous, and — new this season — round up your friends to out-dig a villain who ate the valley's joy and would like seconds.

★ TICKLE THE PIG
Tap Rosie. She giggles, bounces, waves, occasionally falls over. Every tap earns hearts. It is exactly as soothing as it sounds.

★ DRESS HER RIDICULOUS
100+ hand-drawn cosmetics: mushroom caps, jam-jar lenses, a paper boat, a tiny umbrella she absolutely does not need. Mix, match, and show off on the leaderboard.

★ FORM A SOUNDER
That's the real word for a group of pigs — we checked. Squad up with up to four friends, give your herd a name (or roll one of ours, like The Muddy Barons), and dig together.

★ FIGHT THE GREAT HUNGER
Season 1's villain gorged himself on the valley's joy. Every few hours the Truffle Patch opens: root up truffles across three little mini-games, and every truffle starves him back toward sleep. Your herd's finds count forever.

★ RACE EVERY OTHER HERD
Every Sounder is automatically racing every other Sounder — no signups, no brackets, just truffles. The best diggers take prizes every Monday, and you can tap any team on the board to see exactly who's carrying (and who's napping).

★ SEASONS + PASS
Every season brings a story, a villain, and a 30-tier reward path. Free track for everyone; premium pass for the big collectors.

★ SLOP CLUB
The membership for pigs who want it all: more capacity, faster regen, every premium pass, exclusive animated cosmetics. Monthly, yearly, or lifetime.

NO ADS. NO ALGORITHMS. NO FEEDS.
The shop rotates on a fixed daily schedule. The leaderboard is just counting. The race is just truffles. Nothing here is engineered to trap you — Rosie simply likes seeing you.

Built by one person who really likes pigs. Bug reports, hat ideas, strong opinions about truffles: find me on TikTok @ticklethepig.
```

## What's New in This Version (v2 — paste into ASC)

v1 was Rosie solo: tickles, hearts, the closet, daily lucky numbers. v2 is the
social season — everything below is new since the first release.

```
Rosie's biggest update yet — bring your friends!

SEASON 1: THE GREAT HUNGER
A very hungry villain has stolen the valley's joy, and it takes a whole herd to win it back.

• TEAM UP — form a Sounder (your pig squad!) with up to 4 friends, and give it a name
• DIG TOGETHER — root through the new Truffle Patch, with three mini-games to master
• BEAT THE BOSS — every truffle your squad digs up weakens the Great Hunger
• WIN THE WEEK — your squad races every other squad, and the best diggers take prizes every Monday
• SEE WHO'S DIGGING — live stats for every member of your squad (and your rivals')
• A NEW STORY — watch the opening tale and meet the Hunger himself
• NEW TREASURES — 8 new hats, 2 new barn backgrounds, and fresh sounds

Plus a cleaner season screen and a basket of small fixes. Grab your friends — the patch is open.
```

## Keywords (100 char max, comma-separated)

```
pig,cute,cozy,pet,dress up,kawaii,friends,co-op,truffle,farm,casual,idle,tickle,collect
```

(87 chars. Dropped "clicker/mobile game/cosmetic" for "friends,co-op,truffle,farm".)

## Categories

- Primary: **Games > Casual**
- Secondary: **Games > Simulation**

## Age Rating

- 4+ (no objectionable content)

## Pricing

- App: **Free**
- IAP: Slop Club membership + season pass. **Set these prices as Apple price
  points in App Store Connect** (RevenueCat reads them onto the paywall — the app
  does not hardcode subscription prices):
  - Slop Club **monthly** — **$2.99** (299)
  - Slop Club **yearly** — **$24.99** (2499)
  - Season pass (battle pass) — consumable; price lives in the DB
    (`season.premium_price_cents`), unchanged unless you say so.
  - (v1 doc previously listed monthly $4.99 / yearly $39.99 / lifetime $19.99.)

## Support / Marketing URL

```
https://bbroeking.github.io/oink/
```

## Privacy Policy URL

```
https://ticklethepig.com/privacy
```

(This is what the build ships as EXPO_PUBLIC_PRIVACY_URL — keep ASC consistent
with the binary, not the old github.io URL.)

## App Privacy

- Data Linked to You: Identifiers → User ID; Purchases → Purchase History
- Data Not Linked to You: Diagnostics → Crash Data (Sentry)
- Tracking: **No**

---

## Screenshots — v2 set

**Required size: 6.9" iPhone — capture on iPhone 16 Pro Max simulator
(1320 × 2868). ASC autoscales the smaller tiers from it.** iPad 13"
(2064 × 2752) only if supportsTablet.

### Shot list (in order)

1. **Barn hero** — Rosie in a new-season hat, hearts mid-drift.
   Caption: "Tickle a pig. It's that simple."
2. **Season tab** — the Great Hunger hero + your Sounder card, roster lit.
   Caption: "Dig together. Starve the Hunger."
3. **Truffle Patch mid-dig** — uncovered truffles, stir meter going.
   Caption: "Three dig games. One herd."
4. **The dig-off board** — season standings with a member ledger expanded.
   Caption: "Race every herd. Spoils on Monday."
5. **Closet** — a loud outfit, item grid visible.
   Caption: "100+ cosmetics, fresh weekly."
6. **Friends / leaderboard** — the social proof shot.
   Caption: "Bring your whole sounder."

### How to capture

1. Boot iPhone 16 Pro Max simulator, run the dev client
2. Stage each screen, **Cmd-S** saves PNG to Desktop
3. Caption banners in Figma/Canva in the whimsy sticker style

---

## v2 submission checklist (ASC)

- [ ] **Marketing version**: the binary ships `CFBundleShortVersionString 1.0.0`
      (build 128). If 1.0.0 was already RELEASED publicly, ASC needs a new
      version string (bump `version` in app.json → rebuild). If the app is
      still pre-release, 1.0.0 stands.
- [ ] **Demo account must see Season 1**: reviewer account
      `demo@ticklethepig.com` is flag-dark for `world_boss` — flip its
      per-user override (same one-liner as the founder's) or flip the global
      flag BEFORE submitting, or the What's New copy describes features the
      reviewer can't reach (metadata rejection risk).
- [ ] Update `docs/app-store/reviewer-notes.md` five-minute flow for Season 1
      (Season tab → join Sounder → dig the patch).
- [ ] New 6.9" screenshot set uploaded (shot list above).
- [ ] What's New pasted; promo text pasted.
- [ ] App Privacy answers unchanged (no tracking).
- [ ] Export compliance: answer via ITSAppUsesNonExemptEncryption (see review
      audit). **DONE in build 106** (`Info.plist` now sets it false).
- [ ] **Marketing version resolved**: ships as **1.1** (build 131). 1.0.0 train
      closed; create version 1.1 in ASC.

## Slop Club (auto-renewable sub) — DEFERRED to v1.2

Decision 2026-07-09: ship 1.1 **without** IAP (build 106 has no paywall), turn
in Slop Club as a follow-up 1.2. First auto-renewable sub must be reviewed
alongside the binary that contains it, so 1.2 must be the IAP-enabled build.

Code is ~90% wired (entitlement `tickle_the_pig_pro`, RC webhook, Restore,
disclosure, live Terms/Privacy). **Three code blockers before a 1.2 IAP build**
(none done — deferred):
1. `EXPO_PUBLIC_IAP_ENABLED=true` in eas.json `build.production.env` — else the
   whole paywall/Restore/legal card is hidden (`utils/iap.ts:52`, `Account.tsx:551`).
2. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (prod key) — default is a `test_`
   sandbox key (`utils/iap.ts:59-61`); no real purchase without it.
3. `__DEV__`-gate or remove the "Unlock (dev)" alert (`Account.tsx:329-345`) +
   drop the optimistic `setIsVip(true)` — reviewer-facing rejection risk.

Then the dashboard work in `docs/revenuecat-asc-setup.md` (RC offering + paywall,
ASC subscription group + products + review screenshot, webhook deploy).
```
