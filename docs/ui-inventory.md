# Tickle the Pig — UI Inventory

Every screen, surface, and modal in the app, described for **UI-mock
generation**. Current as of the Season-1 social redesign (Phases A–E)
+ the emoji-art pass. One entry per mockable surface: purpose, layout
top-to-bottom, key elements, and notable states.

---

## 0. Visual identity  *(every mock shares this)*

A cozy hand-drawn **storybook** look — think a children's picture book.

- **Backgrounds** — warm cream `#F4EFE6` paper; the Home screen sits on
  a painted desert/barn scene.
- **`Sticker` cards** — the core surface unit: a rotated (±1–2°) paper
  card, **bold ~2px black outline**, hard drop-shadow, rounded corners.
  Everything lives on Stickers.
- **Type** — display font is a fat rounded hand (`Caprasimo` /
  "whimsy"); body is a friendly sans (`Nunito` / "hand"). Section
  **kickers** are tiny caps with a leading `★` ("★ welcome").
- **Palette (`WHIMSY`)** — `ink` dark brown (text/outlines), `paper`
  cream, `sun` warm yellow, `lilac` soft purple (primary buttons),
  `cream`, `accent`. Greedy↔Generous = gold↔lilac.
- **Pig** — Rosie: a round pink cartoon pig, bold outline, animated
  (idle / jump / happy / surprise / wave / sad).
- Bottom **tab bar** — 5 tabs: Home · Friends · Season · Shop · Account.

---

## 1. Onboarding & auth

**1a. Sign-in (`SupaAuth`)** — splash-art background; app logo;
"Sign in with Apple" button + email sign-in. First launch only.

**1b. Username setup (`UsernameSetup`)** — splash-art bg, one white
card: "Pick a name" + a 3–24-char input, a "Got a friend's code?
(optional)" referral field, a Save button.

**1c. Onboarding carousel (`Onboarding`)** — a few full-screen
storybook panels ("★ welcome", "★ how it works") explaining tickling
+ Season 1; swipe through, then into the app.

---

## 2. Home — the Barn  (`index.tsx` → `Barn`)

The tickle screen — the heart of the app.

- **Background** — painted desert/barn scene.
- **Top-left card** — "TICKLES EARNED" + a big number + ♥.
- **Top-right card** — "READY TO TICKLE" — the regenerating tickle
  **bank** (e.g. `21 / 25`), with a countdown to the next regen.
- **Centre** — Rosie the pig, large, idle-animating. Tap her to
  tickle → counter ticks up, she reacts (jump/happy/wave), a tickle
  spends from the bank.
- **Equipped cosmetics** render on the pig (hat, glasses, held item,
  aura, background).
- **`BarnOverlay`** — a full-screen wash: cloud puffs (angel) / gold
  coins (goblin) by alignment; a warm glow when blessed, green miasma
  when cursed.
- **6-7 / Lucky** — tickling can trigger a "6-7" bounce or a Lucky-Pig
  window (see modals).
- Empty bank → a denied tap shows an "Out of tickles!" toast.
- *(Dev-only chips top-right: lucky / align / anchors — not shipped.)*

---

## 3. Friends hub  (`friends.tsx`)

The whole social layer, one tab. Header "**Friends**" + a 3-segment
pill control: **Friends · Inbox · Board**. The Inbox segment carries
an unread count badge.

**3a. Friends segment (`Friends`)** — "★ friends" kicker; two
sub-tabs **Friends · N** / **Add**.
- *Friends list* — a stack of paper rows, one per friend: name +
  `tickles ♥`, a `›` chevron; tap a row → UserSheet.
- *Add* — a handle search (`username#1234`) with prefix autocomplete;
  send-request rows.
- Empty: "No friends yet. Tap Add to send your first request."

**3b. Inbox segment (`Inbox`)** — the activity feed, three bands:
- **Out to market** — your outgoing trade requests, each with a
  Withdraw.
- **Needs you** — incoming friend requests (Accept / decline) and
  incoming trade requests, styled as wooden **pen cards** (Give N /
  pass).
- **Recent** — passive events: "your trade was answered +N", "X
  blessed you", "X cursed you" — each with a real-art icon.

**3c. Board segment (`Leaderboard`)** — the leaderboard.
- A scope toggle: **Global / Friends / Alignment**.
- A `ChampionPoster` for #1; ranked rows (avatar, handle, score);
  tap a row → UserSheet.

---

## 4. Season  (`season.tsx`)

Season 1 "Goblins vs Angels" — the battle pass + bounties.

- **`BountyBoard`** (top) — 3 weekly bounties as `BountyCard`s:
  a task, a progress bar, a snout reward, a Claim button.
- **Season pass track** — a winding path of reward **"stones"**;
  each stone is an icon (tickles / title / boost / background / aura
  / cape / mystery box / cap increase / pig skin), in a state:
  locked / claimable / claimed. A "Claim" button on reachable stones.
- Premium (VIP) stones are marked; the final stone reads **FINALE**.
- Surfaces the player's current tier + progress.

---

## 5. Shop  (`shop.tsx`)

Cosmetics store.

- **Featured row** — large hero cards for spotlight items (thumb,
  rarity tag, name, description, price, Equip/Buy).
- **Category sections** — Hats, Glasses, Bows, Scarves, Masks, Capes,
  Necklaces, Held, Auras, Backgrounds — each a grid of item cards.
- **Item card** — the item art on a rarity-tinted card
  (common→legendary), a `RARITY` tag, name, a price row (`SnoutCoin`
  + number), and a state button: Buy / Equip / Unequip / Locked.
- **Wardrobe** — the player's owned items; empty state shows the pig +
  "Your closet is bare".
- Buying fires a `BuyCelebration` particle burst.

---

## 6. Account  (`account.tsx` → `Account`)

The player's profile + settings.

- "★ your scrapbook" — identity card: avatar, handle, alignment.
- Lifetime tickle stats; the alignment bar (Greedy ◄──► Generous).
- An **Achievements** entry row → the Achievements screen.
- **`TitlesSection`** — "★ titles · N" — owned titles, equip one.
- **Sounder card** — "★ your sounder" — referral count + milestone
  progress; a **"Copy my code"** button (copies `username#1234`).
- Settings: notifications, sign out; dev links (dev builds only).

---

## 7. Sub-screens

**7a. Achievements (`achievements.tsx`)** — "★ N / M unlocked";
category filter chips; a grid of achievement cards — a **medallion
icon**, name, description, a progress bar, a "Ready ✓" tag when
claimable, reward chips (title / item / snouts).

**7b. Sounder / referral leaderboard (`sounder.tsx`)** — "★ top
recruiters"; a "★ sounder sire ★" champion banner; ranked rows of who
has referred the most, with milestone titles.

---

## 8. Modals & overlays

| Surface | Trigger | Looks like |
|---|---|---|
| **UserSheet** | tap any user anywhere | bottom sheet — avatar, handle, title, alignment bar, GIVEN/RECEIVED stats, a state-aware action (Add friend / Accept / Cancel / a 1-5 **Ask** picker), and for friends a bless/curse panel |
| **RitualPicker** | inside UserSheet (friends) | a panel — today's blessing/curse (icon, name, blurb), a Cast button, then a prominent "✦ sent ✦" confirmation |
| **CleanseModal** | auto, when cursed | "you've been cursed" — lists active curses, "Cleanse for 5 🪙" |
| **ReleaseNotesModal** | first launch after update | "★ what's new" — version, a list of feature items (icon + title + body) |
| **AchievementUnlockModal** | achievement earned | "★ achievement unlocked ★" — two-beat reveal: medallion → name → "View reward" → reward chip |
| **LuckyPigModal** | Lucky-Pig trigger | "★ lucky pig! ★" — celebratory burst, the lucky window |
| **LuckyTitleUnlockModal** | rare lucky sub-roll | "★ rare title unlocked" — a one-off folklore title |
| **AlignmentSchismModal** | first ±25 alignment | fullscreen — "the schism stirs" / "a goblin nature stirs", you're becoming Generous/Greedy |
| **JudgementDayModal** | season finalised | "⚖ judgement day ⚖" — your verdict + tiered rewards |
| **BattlePassSaleModal** | season-pass upsell | "★ snout season 1" — VIP / pass purchase, "BEST VALUE" |
| **ItemPreviewModal** | tapping a shop item | the item previewed on the pig before buying |
| **BuyCelebration** | a purchase | a particle burst overlay |
| **TierUpBanner** | season tier gained | a banner sliding in |

---

## 9. Not for mocks — dev tools

`align.tsx`, `item-anchor.tsx`, and the browser tool
`tools/item-anchor/` are `__DEV__`-only alignment editors — exclude
from any UI-mock set.

---

## Suggested mock set

A complete pass = **~6 main screens** (Home, Friends×3 segments,
Season, Shop, Account) + **3 onboarding** + **2 sub-screens** +
**~13 modals** ≈ 26 mocks. Highest-traffic first: Home, the three
Friends segments, Shop, Account.
