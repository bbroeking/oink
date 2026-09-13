# TTP UI — section map for the reimagining passes

Every player-reachable surface, grouped into the sections we'll redesign one at a time.
Each section gets its own pass; status column tracks where it is. Prototypes / dev-only
routes are listed at the bottom and are out of scope.

Read alongside `docs/design/taste-standard.md` (craft lens) and `SKILL.md` (product lens).

## Sections

| # | Section | Pillar | Entry | Surfaces (files) | Status |
|---|---|---|---|---|---|
| 1 | **Barn (Home)** | Collect | Tab 1 | `components/Barn.tsx` orchestrator: `PigStage` + tickle loop, `TruffleButton`, `BarnStructure` (exterior → interior door), `BarnBountyChip`, `AdRefillOffer`, `BuryTruffleSheet` / `BuriedTruffleSheet`, `LuckyPigModal`, `TickleBreakdownSheet` | **Decided 2026-09-13** — comp: `claude-design/barn/barn-home.html` (two corners E — earned stamp + coin — + Barn button; steady / busy / fanned). Built 2026-09-13 (`EarnedStamp`, `TickleCoin`, `BarnButton`, `BuriedMound`); tap = face's action, `+` fans. Open: go-in motion (`door-motion.html`). Explorations kept: `receipt`, `plank`, `coin` (v3), `action-button` |
| 2 | **Barn Interior + Habitat** | Collect | Barn door | `app/barn-interior.tsx`, `app/barn-collection.tsx` (catalog + wishlist + journal), `components/habitat/*` (`HabitatEntry`, `HabitatDoorTransition`, `HabitatGiftReveal`, `HabitatExpansionDiscovery`), `BarnVisitModal` (friend visit) | todo |
| 3 | **Friends hub — Friends + Inbox** | Connect | Tab 2 (segments `friends`, `inbox`) | `app/(tabs)/friends.tsx` segmented shell, `components/Friends.tsx`, `components/friends/*` (row bless/curse doors), `Inbox.tsx`, `DigPostcardInbox.tsx`, `UserSheet.tsx` (profile sheet + `RitualPicker`), `PlayerInvitePicker`, `ReferralCodeEntry`, `components/visit/*` (visit + streak), `BlockedUsersSheet` | todo |
| 4 | **Friends hub — Rankings** | Contend | Tab 2 (segment `board`) | `components/Leaderboard.tsx`, `hooks/useLeaderboard.ts` | todo |
| 5 | **Sounder (crew)** | Connect/Contend | Tab 2 (segment `sounder`) | `SounderCard.tsx`, `components/sounder/*`, `JoinableSounders.tsx`, `FriendInvitePicker.tsx`, `SounderOinkSheet`, `TransferLeadershipSheet`, `EnemyBreakdownSheet`, `components/mudwar/*` — prior Claude Design pass: `docs/design/claude-design/sounder/` + `sounder-invite-brief.md` | partial (invite page done) |
| 6 | **Season pass** | Collect/Contend | Tab 3 | `app/(tabs)/season.tsx` (2.5k lines): `StatsPills`, `BountyBoard`/`BountyCard`, `WallowCard`, `PremiumLockedBanner`, `ClaimAllBar`, `VerticalListPassTrack`/`VLTierRow`/`StoneThumb`, `ClaimRewardDialog`, `ClaimNoticeDialog`, `XPHowToModal`, Alignment standing block, `AlignmentExplainerModal`, `BattlePassSaleModal`, `SeasonEndModal` | todo |
| 7 | **Truffle Patch (dig) + Race** | Contend | Season / Barn | `app/porch-round.tsx`, `PorchRoundLaunchCard`, `app/race-standings.tsx`, `GreatHungerMeter`, `components/season1/*`, `app/digging-stats.tsx`, `app/dig-collection.tsx` (Burrow Book), `TruffleCatalogSheet` (Field Guide) | todo |
| 8 | **Mote Machine + Contraptions** | Collect | Season / Barn | `app/mote-machine.tsx`, `components/mote-machine/*`, `app/contraptions.tsx`, `MysteryHatReveal` | todo |
| 9 | **Shop** | Collect | Tab 4 | `app/(tabs)/shop.tsx` ("the shop", "today's drop", "decorate your room"), `ItemPreviewModal`, `PurchaseToast`, `TroughSection` (Slop Club / drives), member band | todo |
| 10 | **Me (scrapbook)** | Collect | Tab 5 | `components/Account.tsx` ("your scrapbook", "all you've done", "your prestige / Wallow rank", "settings"), `ClosetView` (cosmetics + equip), `PigPenView` / `PigRosterPicker`, `TitlesSection`, `app/achievements.tsx`, `app/recruits.tsx` + `app/recruits-progress.tsx`, `ReleaseNotesModal`, `ActiveEffects` (Hoofprints sheet) | todo |
| 11 | **Onboarding + auth** | Connect | first launch | `Onboarding.tsx`, `SupaAuth` / `AppleAuth` / `GoogleAuth`, `UsernameSetup`, `app/scan-code.tsx`, `app/i/[code].tsx` (invite deep link), `app/auth-callback.tsx` | todo |
| 12 | **App shell + system popups** | all | global | `app/(tabs)/_layout.tsx` hanging-signs tab bar, `app/_layout.tsx` popup stack: `PopupQueue`, `WhileAwayModal`, `AchievementDigestModal`, `GreatHungerIntroModal`, `JudgementDayModal`, `AlignmentSchismModal`, `PigFriendsLaunchModal`, `CleanseModal`, `ConfirmDialog`, `+not-found` | todo |
| 13 | **Lounge** | Connect | — | `app/lounge.tsx` (964 lines, sprite lounge) — confirm it's still player-reachable before redesigning | todo |

## Out of scope (prototypes / previews / dev)

`ui-audit`, `member-perks-prototype`, `lounge-prototype`, `idle-battler-prototype`,
`mote-machine-prototype`, `expedition` (Beyond the Hedge, not shipped), `barn-visit-preview`,
`barn-housing-preview`, `living-mud-preview`, `ad-refill-preview`, `rosie-gallery`,
`components/dev/*`, `components/prototypes/*`.

## Suggested order

Highest player-time surfaces first, and the one already half-done last so its pass is
cheap: **1 Barn → 6 Season → 3 Friends/Inbox → 9 Shop → 10 Me → 7 Dig/Race → 8 Mote →
2 Interior → 4 Rankings → 12 Shell/popups → 11 Onboarding → 5 Sounder (finish) → 13 Lounge.**

## Per-section pass (the pattern)

1. Brief: `docs/design/<section>-brief.md` — jobs in priority order, states, row anatomy,
   what "messy" means today, tokens (non-negotiable). Model: `sounder-invite-brief.md`.
2. Directions: 3 distinct mocks → `docs/design/claude-design/<section>/*.html`.
3. Pick + log the decision in `taste-standard.md` (and `SKILL.md` if product-level).
4. Implement against tokens; keep scorecard at 0 and `lint:web` green.
