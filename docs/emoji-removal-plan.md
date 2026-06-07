# Emoji removal — plan & progress

Goal: **no emoji or dingbat glyphs anywhere in the app.** Decided scope (2026-06-07):
replace BOTH color emoji AND the typographic dingbats (★ ♥ ✦ → • ✓ ✕ …), including
ones that sit inside text/copy.

## Approach — HAND-DRAWN IMAGES EVERYWHERE (user decision 2026-06-07)

Single system: every glyph (decorative, pictographic, AND functional → ✕ ✓ •) is a
hand-drawn ChatGPT-generated image in the cozy sticker style, sliced to a transparent
PNG and rendered via `components/ui/Glyph.tsx`. Inline-in-text uses the `IconText`
helper (RN can't drop an image inside a `<Text>` run). NOTE: there is a pre-existing
SVG `components/ui/Icon.tsx` (partially wired, ~24 uses across 6 files) — its usages
are to be MIGRATED to `Glyph` images too (not extended). Functional glyphs (close,
check, arrows, bullet) still need a hand-drawn batch before their call sites can be
swapped — until then, leave the literal char rather than introduce SVG Icon.

Swap screen-by-screen, highest-traffic first.

## Audit (2026-06-07) — app/ components/ constants/ hooks/ utils/

Color/pictograph emoji: **41 distinct, 82 uses.** Symbols: → ×117, ★ ×98, ✦ ×38,
• ×32, ♥ ×30, ✓ ×12, ✕ ×8, ← ×4, ↔ ×2, ↓ ×1, ● ×1.

Concentration: release_notes.ts (16, copy), hats.ts + emojiArt.ts (20, cosmetic
category fallbacks), BuyCelebration.tsx (8, particles), rituals.ts (8), scattered UI.

## Generation batches (ChatGPT — "Cozy Icon Design" convo). Free tier ~3-5 imgs/day.

- **Batch 0 — snout coin** ✅ generated, sliced, wired (`assets/images/snout-coin.png`,
  `SnoutCoin.tsx`).
- **Batch 1 — 10 glyphs** ✅ generated + downloaded (`/tmp/snout/glyphs/batch1.png`,
  1774x887). Order: star, heart, four-point sparkle, sparkle-cluster, padlock, bell,
  trophy, crown, scales, sleepy-Zzz. → TODO: slice into transparent PNGs.
- **Batch 2 (pending)** — pig snout (🐽 bare), pig face (🐷), eyes (👀), handshake (🤝),
  busts/friends (👥), clipboard (📋), magnifying glass (🔍), gem (💎), party popper (🎉),
  green circle/status (🟢).
- **Batch 3 (pending)** — cosmetic category icons: top hat (🎩), eyeglasses (👓), bow
  (🎀), scarf (🧣), dress (👗), prayer beads (📿), magic wand (🪄), performing-arts/mask
  (🎭), superhero (🦸), crown already in B1.
- **Batch 4 (pending)** — scene/misc: sun (☀/🌞), cloud (☁), soccer ball (⚽), coffee (☕),
  national park/scene (🏞), derelict barn (🏚), snail (🐌), ogre (👹), halo face (😇),
  dizzy (💫), pinching hand (🤏).
- **SVG (no generation)** — → ← ↔ ↓ ✕ ✓ • ● : build in `Icon.tsx`.

## Wire order (after slicing + components exist)
Barn → BarnVisitModal → BuryTruffleButton/BuriedMound/BuriedTruffleSheet (the new
stuff) → UserSheet/Friends → alignment/rituals → release_notes/copy → the rest.

## Status
- Batch 0 (snout) + Batch 1 (10 glyphs) generated.
- Batch 1 SLICED -> assets/images/glyphs/{star,heart,sparkle,sparkles,lock,bell,trophy,crown,scales,zzz}.png (256 sq, transparent).
- Built components/ui/Glyph.tsx (Glyph, glyphSource, IconText).
- PROOF wired: BarnVisitModal.tsx -- star/sparkle/heart, flying floats -> Animated.Image,
  zzz nap, snout-coin truffle reward. STILL literal there (await functional batch):
  Leave (close), full (check), Head home (arrow).

- Batch 2 (functional + common) generated + SLICED -> assets/images/glyphs/{arrowRight,arrowLeft,check,close,bullet,gift,party,gem,search,eyes}.png. Added to Glyph map.
- BarnVisitModal.tsx now FULLY glyph-free in UI (Leave close, full check, Head home arrow, -1 ASCII). Only code comments still contain glyphs. Proof screen complete.
- Library now: snout coin + 20 glyphs. (Rate limit not a concern per user 2026-06-07.)

- Batch 3 (cosmetic/character) generated + SLICED + registered: tophat, glasses, bow, scarf, dress, beads, wand, mask, superhero, pigface. Library now snout + 30 glyphs.
- WIRED: BuryTruffleButton, BuriedTruffleSheet, BuriedMound (pigface/star/sparkle). All tsc-clean.

- Batches 4 + 5 generated/sliced/registered. GLYPH LIBRARY COMPLETE: snout coin + 50 glyphs
  (assets/images/glyphs/) covering all 41 audited emoji + premium/flame/globe/ghost for Icon migration.
  WIRED so far: BarnVisitModal + 3 truffle components. ~25 files still to wire.

## BUILD PLAN (user decision 2026-06-07)
Wire the HIGH-TRAFFIC screens, then cut a TestFlight build (deep/rare screens after):
  [x] Barn home (Barn.tsx) — DONE: PaperTicket chips (heart/sparkle in cream coins), lucky badge sparkle, toast heart, HeartFloats particles -> Animated.Image (sparkle/heart). Verified via idb. (WoodenSign ★ + its arrowRight Icon are in the hidden/unrendered component — left as-is.)
  [ ] Friends / Leaderboard (Friends.tsx, Leaderboard.tsx) — ★, ♥, 🏆, crown, flags(leave), status dot
  [ ] UserSheet.tsx — ★ profile, 🏚 visit(barn glyph), ♥ stats/ask, alignment
  [ ] Shop / ClosetView — symbols + category icons
  [ ] Season (app/(tabs)/season.tsx) — its 4 emoji + symbols
Then: changelog (docs/builds/), `eas build --local --platform ios --profile production` (NODE_OPTIONS 16GB),
rename build-N.ipa, `open -a Transporter` (user does Apple sign-in + Deliver). Verify each screen with idb first.

## Done generating
1. (DONE) Generate B4 scene/status (sun, cloud, soccer, coffee, national-park/scene, derelict-barn, snail, green-status-dot, handshake, busts/friends) + B5 faces/misc (halo-face, sleepy-face, dizzy, ogre, pinching-hand, clipboard, pig-snout-bare).
2. Migrate existing SVG Icon call sites (Barn, Account, Leaderboard, BountyCard, JudgementDayModal, HangingSignsTabBar) to Glyph.
3. Roll out screen-by-screen, incl. copy-string emoji via IconText / inline Glyph. Remaining files: Barn, season, UserSheet, Friends, Inbox, AllegianceModal/Card, BountyCard, RitualPicker, alignment.ts, rituals.ts, BuyCelebration, release_notes.ts, hats.ts + emojiArt.ts (category fallbacks), TierUpBanner, JudgementDayModal, AchievementUnlockModal, etc.
