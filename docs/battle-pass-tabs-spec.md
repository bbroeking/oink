# Battle Pass — Free / Premium tab display (spec)

**Goal.** Turn the season pass from a single free list (with premium markers) into
a **two-track tab display**: a "Free" / "Premium" toggle. Both tracks are always
*viewable*; the Premium track's rewards are shown **under glass (locked)** until
the pass is bought, so players can see what they're missing and there's a clear
unlock CTA. UI only — the data + claim + unlock plumbing already exist.

**Live code.** `app/(tabs)/season.tsx`. The rendered track is
`VerticalListPassTrack` (line ~757, used at ~1558). `SnakingPassTrack` (~262) is
dead — ignore it.

**Data already present (no server change):**
- `SeasonState.tiers` — `TierRow[]` with `track: "free" | "premium"`, `display_label`.
- `tiersByNumber[t]` → `{ free?, premium? }` (both rewards per tier).
- `claimedSet` keys: `` `${tier}:${track}` `` (already track-aware).
- `handleClaim(tier, track)` → `claim_tier_reward` (already track-aware; returns
  `premium_locked` reason if you claim premium without the pass).
- `premium = state.premium_unlocked ?? false` (~1309).
- `setSaleOpen(true)` opens `BattlePassSaleModal` (the unlock paywall).
- `PAID_BATTLE_PASS_ENABLED` (~74, currently `false`) gates the *purchase*, not the display.

## Behavior

1. **Track tabs** — a 2-segment toggle "Free" / "Premium" above the list.
   - Active segment: `WHIMSY.sun` fill + ink outline + whimsy font; inactive: paper.
   - Premium segment shows a small `lock` Icon when `!premium` (still tappable — viewing a locked track is the whole point).
   - Show the tabs only when the season actually has premium rewards (some tier has `.premium`); otherwise render the free list alone (today's behavior).
2. **`VerticalListPassTrack`** gains props `track: "free" | "premium"` and `premiumUnlocked: boolean`:
   - Render `tiersByNumber[t]?.[track]` (not always `.free`).
   - **Free track:** unchanged (claimed if `${t}:free`, else ready if `t <= currentTier`, else locked). Keep the existing VIP pill on rows that also have a premium reward.
   - **Premium track, `!premiumUnlocked`:** every row renders `locked` (view-under-glass, no claim button), regardless of tier reached. Drop the VIP pill (redundant — the whole track is premium).
   - **Premium track, `premiumUnlocked`:** same states as free, keyed on `${t}:premium`; `onClaim(t, "premium")`.
3. **Unlock banner** — when `track === "premium" && !premiumUnlocked`, a `Sticker`
   banner above the list: "★ Premium Pass" + "Unlock to claim every premium
   reward." + an "Unlock" button wired to an `onUnlock` callback that
   `SeasonScreen` supplies (`() => setSaleOpen(true)`). The banner is the primary
   unlock CTA for the locked premium view.
4. **`SeasonScreen`** — add `const [passTrack, setPassTrack] = useState<"free"|"premium">("free")`;
   render the tabs above `VerticalListPassTrack`; pass `track={passTrack}`,
   `premiumUnlocked={premium}`, and the `onUnlock` callback.

## Notes
- Purchase stays gated by `PAID_BATTLE_PASS_ENABLED` + `IAP_ENABLED`; this spec only
  makes the premium track *visible + browsable + lockable*. When those flags flip
  on (1.2), the unlock CTA becomes a real purchase with no further UI change.
- No emoji (house rule): use `Icon`/`Glyph` for the lock + star.
- Ships in a future build (1.2), not build 106.
