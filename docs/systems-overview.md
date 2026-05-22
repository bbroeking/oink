# Tickle the Pig — Systems Overview

Everything built in the build-62 cycle (commits `8995113` … `d45fc42`).
Reference doc — what each system is, how it works, where it lives.

---

## 1. Identity & social foundation

### App identity
- Renamed "ttp" → **"Tickle the Pig"** (iOS `CFBundleDisplayName`).
- Icon flattened (no alpha) for App Store compliance.

### Friends + discriminators
- Discord-style `username#1234` handles — usernames no longer unique,
  the `(username, discriminator)` pair is.
- `send_friend_request` takes a handle; search-by-prefix autocomplete.
- Three-tab Friends screen: your sounder, pending requests, add new.

### UserSheet
- Tap any user anywhere (leaderboard rows today) → a bottom sheet
  with their avatar, title, alignment, given/received trade totals,
  and a state-aware action button (add friend / accept / cancel /
  request tickles / bless / curse).
- Backed by one RPC: `public_user_stats`.

---

## 2. Tickle Trade — the economy

The core social loop, and Season 1's moral engine.

- A asks B for **N** tickles (1-5).
- B **fulfills**: B spends N from their regenerating bank; **A pockets
  2N**. B gets nothing material — only a social promise.
- **No repay step.** A fulfilled trade is terminal.
- **Asking is the profitable move** — this is deliberate. Greed is
  mechanically rewarded; alignment/reputation is the only counterweight.
- 24h per-pair cooldown. One pending request per direction at a time.
- Push notification on request + on fulfill.

---

## 3. Sounder — referral program

- Each player has an invite link (`docs/invite.html` landing →
  `app/invite.tsx` deep link).
- A successful referral earns **both** users 100 snouts.
- Referral leaderboard with milestone titles (Ambassador, Drove
  Captain, Crown Hog).
- `attribute_referral` fires once per referee, idempotent on retry.

---

## 4. Lucky Pig

- Any non-lucky tickle has a **5%** chance (12% during the launch
  window, through 2026-05-22) to open a **10-tickle lucky window**.
- Inside the window, **30%** of tickles double.
- **20%** of triggers also drop a rare one-off folklore title.
- Client-rolled (no per-tap RPC), persisted across launches via
  AsyncStorage.

---

## 5. Achievements

- One unified `achievements` catalog table — category, tier,
  threshold, rewards (title + item + snouts).
- Seeded with the 8 Trade Masters tiers (Generous + Greedy ladders).
- Tier 4 is `is_top_tier` → **infinite levels** past it via
  `LOG(2, progress / threshold)`, +500 snouts per level.
- `try_claim_achievements` auto-grants on the tickle-trade trigger.
- **Reveal modal** — two-stage announcement → "View reward" →
  reward-chip animation; tracks `viewed_at`.
- **Achievements screen** — full grid with category filter chips,
  progress bars, "Ready ✓" tags. Reachable from Account.

---

## 6. Push notifications

- `expo-notifications` + an APNs/Expo pipeline driven from Postgres
  via `pg_net` (`send_push_to_user` RPC + `tickle_trades` trigger).
- Tapping a trade notification deep-routes to Barn.
- `pushNotifications.ts` coalesces permission prompts + caches the
  token. `dev_send_push` for manual SQL smoke-tests.

---

## 7. Cosmetics infrastructure

- **Held-item slot** — a new accessory slot anchored to the right
  hoof, co-exists with hat/glasses/etc. Per-animation anchor drift
  via `CATEGORY_PERANIM_SHIFTS`.
- **Shop titles** — titles purchasable alongside hats; unlock
  instantly on purchase.

---

## 8. Season 1 — "Goblins vs Angels"

The headline feature. One continuum, no teams, derived from behavior.

### Alignment
- `alignment_score` on every profile, **-100 … +100**.
- Derived purely from action: fulfill (giving) **+2**, your request
  fulfilled (pocketing 2N) **-2**, bless **+1**, curse **-1**,
  decline **-1**.
- `alignment_label` with ±34 hysteresis → `goblin | neutral | angel`
  (shown as Greedy / Pilgrim / Generous).
- Visible everywhere identity shows — `AlignmentBadge` on the
  leaderboard, the alignment chip in UserSheet.

### Schism reveal
- First time you cross **±25**, a one-time fullscreen
  `AlignmentSchismModal` fires ("You're becoming Generous/Greedy").
- `_layout` polls `check_schism_status` on launch + foreground.

### Daily Blessings (angel-coded)
- One per day, cast on up to 3 friends. Kind rotates daily:
  Warm Tea (2× regen 1h), Sun Beam (next Lucky Pig doubles), Halo
  Kiss (6h glow), Bountiful Snouts (+5 instant).

### Daily Curses (goblin-coded)
- Symmetric. Sluggish Snout, Phantom Itch, Goblin Whisper, Coin Pinch.
- **Anti-grief**: incoming curses capped at −10 snouts + 2h regen
  debuff per day. A blessing received clears active curses.
  `CleanseModal` — 5 snouts wipes them.

### Weekly bounty board
- 6-bounty pool; **3 rotate in each ISO week**. Progress computed
  live from trades/blessings/curses. Snout rewards on claim.
- Lives at the top of the season tab.

### Alignment leaderboard
- A third leaderboard scope — ranks the most Generous and most
  Greedy via `alignment_leaderboard`.

### Judgement Day finale
- `finalize_season` ranks everyone, grants tiered rewards (top 3 /
  top 10 / participant / neutral), then resets all alignment to 0.
- `JudgementDayModal` shows each player their verdict.
- Top 3 each side earn exclusive "Halo Bearer 2026" / "Goblin King
  2026" titles.

### Barn theming
- `BarnOverlay` tints the Barn by current alignment — cloud puffs
  for angels, gold-coin piles for goblins.

### Cosmetic ladder (design-locked, art pending)
- Angel: daisy_crown → angel_halo → angel_wings → holy_radiance.
- Goblin: gold_tooth → coin_monocle → goblin_ears → goblin_crown.

---

## 9. Developer infrastructure

- **Build changelog** — one markdown per build in `docs/builds/`,
  authored before each build.
- **Release notes modal** — `ReleaseNotesModal` fires the "What's
  new" on first launch after a version bump.
- **Tests** — first tests in the project: 78 TS unit tests across
  10 jest suites + a pgTAP suite (`supabase/tests/`). jest-expo
  config fixed for pnpm hoisting.
- **`icon-gen` skill** — drives ChatGPT via the Chrome connector to
  generate accessory sprite sheets from a prompt brief.
- **`tools/anchor-editor`** — browser tool for tuning hat overlays.

---

## Known gaps (carried)

- Gameplay-effect application for blessings/curses (regen multiplier,
  half-taps, miasma overlay) is **not yet wired into the Barn tickle
  loop** — `my_active_effects()` exposes the data; a follow-up honors it.
- Achievement banner on Barn not wired (reveal modal only shows from
  the achievements screen).
- Saintly/goblin cosmetic icons not generated — ladder grants give
  titles + snouts only for now.
- RPC behavior has no automated tests yet (pure functions are
  covered; fixture-based pgTAP is a follow-up).
- `finalize_season` is a manual SQL call — no cron.
