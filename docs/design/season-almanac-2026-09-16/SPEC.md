# Season tab — the Almanac (build spec)

Design canvas: https://claude.ai/code/artifact/32867725-d25e-4ad8-a020-afda24a2b7e3 (Almanac page).
Reference renders: `screens/*.png` (390×844, tab-bar reserve included). Decided 2026-09-16 after
four directions, two hand reviews and two loop rounds (Nielsen 23 → 26/40).

## The shape

One page, no vertical scroll on a 17 Pro. Three bands:

1. **Title row** — kicker `day N of 60 · the Hungerer is <Stage>` (hand, accent), title
   `The Great Hunger` (pageTitle), the Hungerer's sprite (44pt) and the existing `?` door.
   The Hungerer is the page's protagonist; he never appears twice on one screen.
2. **Verb tab strip** — four compact `Sticker` cells in one row: **Feed · Herd · Race · Pass**.
   Each carries a kickerPill label (11px) and ONE nowrap Caprasimo value (16px):
   Feed `2h 59m` / `5h 12m` (open) / `Dug`; Herd `4 of 6` / `Join`; Race `3rd` / `Run` / `—`;
   Pass `Tier 4` / `2 ready` (+ a 6px progress bar). States: selected = blush `cream`, 4px
   sticker shadow, −1° tilt; unselected = flat paper, value in `mute`; **todo** = `sun` fill
   (Feed when the feeding is open, Pass when a claim is ready, Race on Monday until the purse is
   drawn) — gold means act-now and nothing else.
3. **Panel** — the selected tab's content, fitted to the space above the hanging-signs tab bar
   (`HangingSignsTabBar` ≈ 94pt + 14pt + home indicator; use `TAB_SAFE` / insets, never a magic
   number).

## Panels

- **Feed** — hero sticker (cream): Hungerer sprite 84pt left; right column kicker
  `next feeding` / `feeding open · 5h 12m left`, Caprasimo 26 `Opens in 2h 59m` / `The patch is
  open` / `Rosie dug.`, hand sub-line. Under it the six-stage meter (Gorged … Famished, sage
  filled / sun current / paper next / dashed last) with hand labels and one sentence: *Every find
  starves him a little — the herd wants him Famished by day 60.* CTA row: closed → `Remind me
  when it opens` (gold); open → `Dig the Truffle Patch` (gold, existing feeding CTA); dug →
  `Oink at the herd — N seats still open` (gold). Second sticker `Last feeding` / `This feeding`:
  avatar row (dug = full colour, not-yet = dashed 50%, never named), one sentence of totals
  (`7 finds · 3 Golden Truffles · +20 Pass XP`), and Pepper's find line as a 44pt door row
  (avatar · `Pepper found the Pressed Clover Frame — it's hanging in her Barn.` · chevron →
  her Barn). When Rosie dug: her finds as icon-over-label tiles.
- **Herd** — sage sticker: crew name (sectionTitle), meta `6 snouts · 212 finds together`, one
  hand sentence that never names a sleeper (*Four snouts dug last time — enough to count; six is
  a full herd.*). Roster sticker `Last feeding · who dug`: one 44pt row per member, avatar +
  name + hand sub (`dug 3 finds` / `dug · found a frame · visit her Barn` / `next feeding in
  2h 59m`), trailing check (dug) or chevron (a door) — **no per-pig Nudge**. One gold CTA
  `Oink at the herd — next feeding in 2h 59m`. No Sounder: Rosie sprite, *Rosie digs with a
  herd.*, gold `Start one with a friend`, `Herds with a seat open` list rows (existing
  `useJoinableCrews`).
- **Race** — cream sticker `The race` / `most finds by Monday wins · fresh Monday` + rust link
  `all 12 herds ›` (44pt): top 4 rows (`brow`: rank Caprasimo 16, name, score Caprasimo 18),
  the player's herd pinned gold; nobody dimmed. `Monday's spoils`: two cards — `all who dug` →
  Barn Bunting (barn pill) and `1st place` → Gold Bunting (gold card; art tinted gold until an
  asset exists). `Your Monday tickle draw` door row (pink art, `four Mondays since a rare ·
  1 in 3 for rare or better`, chevron). Gold CTA `Oink at the herd — two behind`. Monday
  (race run): Race cell `Run` gold; `The race is run` / `last week's finals`; spoils ladder with
  a `Claim` on the bunting; gold `Draw your Monday purse`.
- **Pass** — `The ladder` / `36 XP to tier 6`: 3 tier rows in one bordered sticker
  (art 40pt · `TIER N` + type pill (`wear` lilac / `barn` sage / `title` rose / `tickles` sky /
  `milestone` rose) + name · trailing = check `claimed` | gold `Claim` (44pt) | hand `N XP
  away`), ready rows on `sun`. Under it a paper button `See all 26 tiers · 8 more for the Barn`
  (opens the existing full track in a sheet). `This week's quests` sticker: two one-line rows
  (`Lucky Hog · dig 3 feedings` bar + `Claim 100 XP` / `Well-Wished · bless 3 friends` bar +
  `1 of 3`).

## Sheets

- **Claim a Barn furnishing** — kicker `season pass · tier 5`, tilted 148pt art card, name
  (pageTitle), one pill `barn · wall`, hand description, gold `Hang it in the Barn` (opens the
  Barn editor with the item in hand — never auto-places), paper `Claim, hang it later`, footer
  hand `Yours to keep, season over or not.`
- **Monday draw** — kicker `monday · every snout that dug draws its own purse`, 148pt pink
  disc with the amount in `TYPE.hero` (Fredoka) + `tickles`, verdict Caprasimo 26 (`A good
  purse.` / `A rare purse!` / `Jackpot.`), tier tiles `20 common · 60 good · 150 rare · 400
  jackpot` with `you` over the hit, warming row (ember glyph + *Four Mondays without a rare, so
  next Monday's warmer: 1 in 3 for rare or better.*), gold `Pocket 60 tickles`.

## Economy (server)

- **Barn furnishings as pass rewards.** New `reward_type = 'habitat'` with `reward_value
  {item_id}`; the claim RPC grants the catalog item into the player's habitat inventory
  (idempotent, already-owned is a no-op that still marks the tier claimed). Seed: tier 5
  `firefly_lantern`, 7 `patchwork_rug`, 9 `hay_bale`, 10 `milk_can_lamp`, and four more across
  11–30 from `HABITAT_CATALOG` (`isForSale` items only; keepsakes stay prestige-only).
- **Weekly spoils → furnishings.** Every digging snout in a herd that met quorum gets
  `barn_bunting`; 1st place gets `gold_bunting` (new catalog item; reuse the bunting asset with
  `prestigeRank`-style exclusivity until art lands). Replaces the herd tickle payout.
- **Monday tickle draw** — per player, participation-gated (dug ≥1 feeding that week),
  server-side, one draw per ISO week. Tiers 20/60/150/400 with base odds 60/28/10/2 %. Catch-up
  (soft pity): each consecutive Monday without rare-or-better raises the rare+jackpot share
  (×1.5 after two, ×2 after three; cap ×3); a herd finishing in the bottom half of the board
  adds one step. State exposed as `{ eligible, drawn, amount, tier, mondays_since_rare,
  next_rare_odds }` so the client can print `1 in N`. All numbers are tuning placeholders.
- Migrations are **written, not pushed** — pushes wait for an explicit go.

## Rules that hold everywhere

Tokens only (`WHIMSY`, `TYPE`, `SPACE`, `RADII`, `BORDER`, `ART_SIZE`); `Sticker`, `Button`,
`Chip`/`Tag`, `T`/`Hand`/`Kicker`, `Glyph`/`Icon` — no emoji, no raw hex/size. Every tappable
thing ≥ `TAP_MIN`. Feelings shown (sprites), never stated. No shame states: never name who
slept, never dim a loser, no public zero. One sentence per mechanic. Reduce Motion: the tab
switch is a cut. Scorecard stays 0; `tsc` clean; Jest green.
