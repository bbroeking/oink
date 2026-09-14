# Friends tab — visual regression review (2026-09-13)

Compares the Friends tab as it renders on `main` @ `50a061b` (tonight) against
build 179 (2026-08-30, base commit `dd4516b` + the Aug–Sep dirty workspace that
became the `a59d5c5` "pre-deslop snapshot"). Captured on the iPhone 17 Pro
simulator, dev client, demo account (one friend: FunnelWalker), Metro verified
current before capture. The blue gear in some shots is the expo-dev-client
launcher, not app UI.

Screenshots live in `friends-2026-09-13/`:

| # | Shot | What it shows |
|---|------|---------------|
| 01 | `01-friends-list.png` | Friends segment, top to bottom (the whole list fits on one screen with one friend) |
| 02 | `02-friend-row-tray-open.png` | The redesigned friend row with its tray open — the bottom-of-page area where the recent changes landed |
| 03/04 | `03-profile-sheet-*.png` | UserSheet (Profile), top and scrolled to Report · Block |
| 05 | `05-add-tab.png` | Add tab: search, suggestions, referral footer |
| 06 | `06-inbox.png` | Inbox segment |
| 07 | `07-rankings.png` | Rankings segment (Global · Friends · Pairs) |
| 08 | `08-sounder.png` | Sounder segment |
| 09/10 | `09-…inside.png`, `10-…outside.png` | Barn visit reached from the row's Visit cell (guestbook retired) |

## Where the diff actually is

The deslop sweep (`d03246d`) did **not** touch `Friends.tsx`, `friends.tsx`,
`FriendInvitePicker`, or `PigFriendsLaunchModal`. Every Friends-surface change
since build 179 landed in the `a59d5c5` wip snapshot (row-tray redesign,
guestbook/kindness-card retirement, Wave-3 primitive conformance) plus a small
follow-up in `5c545dd` (visit mounts as a `Ceremony`). Client RPC/table
references dropped since `dd4516b`: `my_barn_guestbook`,
`leave_barn_kindness_card` (via the retire migration), `choose_allegiance`,
`mark_67_seen`, `submit_rooting`. Nothing else friend-related was unwired.

## Checklist — what we appear to have lost vs. build 179

Legend: **CUT** = removed on purpose and recorded; **MOVED** = still exists but
lives somewhere else / one more tap away; **CAN'T FIND** = not visible in the
sim and not obviously in code — needs a human answer.

### Friend row (shot 01 → 02)

- [ ] **MOVED — Visit button.** Build 179 had the barn door inline on every row (one tap). Now it's inside the tray: tap row/chevron → tap Visit (two taps).
- [ ] **MOVED — Favorite star → "Pin".** Was an inline star on the row; now a link in the tray. Same `friend_favorites` table; row still floats to the top when pinned.
- [ ] **MOVED — Row tap no longer opens the profile.** 179: tap row → UserSheet (ask / bless / curse / visit / block). Now: tap row → expands tray; Profile is a text link at the bottom of the tray. Everything on the sheet still exists, it's just deeper.
- [ ] **CAN'T FIND (while tray is open) — row meta.** Tickles (♥ 20), "wears X", "in {Sounder}", the "tickled today" hint and the visit-streak chip all disappear when the tray expands (compare 01 vs 02). Intentional compaction per the code comment, but it means the streak chip and the crew line are only readable with the tray closed.
- [ ] **NEW, not lost — bless door on the rail, curse in the tray.** 179 had neither on the row (both were UserSheet-only). Worth confirming the two-tap curse arming doesn't read as broken.

### Friends panel / hub (shots 01, 05)

- [ ] **Nothing cut.** `Friends · N` / `Add` tabs, Porch Round scrapbook card, "your Sounder" banner, today's blessing + curse pills, FIND A FRIEND search, Suggestions, referral footer — all present.
- [ ] **CHANGED — Sounder segment gating.** 179: `world_boss || __DEV__`. Now: `useSeason1Active()` only (no dev bypass, retired 2026-09-12). Prod `world_boss` is `enabled=true`, so it renders today — but a dev build with a per-user override off, or Season 1 ending (`snout_season_1` cutoff 2026-10-12), silently drops the fourth segment and the "your Sounder" banner. If someone tested on an account with the override off, that's the "where did Sounder go?" report.
- [ ] **CAN'T FIND — "Rosie's friends have arrived / Slop Club Pen" launch modal.** `PigFriendsLaunchModal` still mounts from `app/_layout.tsx`, but its copy was rewritten; the "NEW IN THE SLOP CLUB" kicker/"Meet the pigs waiting in Rosie's new Pen" strings are gone. Didn't fire on this account — confirm it's still meant to.

### Profile sheet (shots 03, 04)

- [ ] **Nothing cut.** GIVEN / RECEIVED / TICKLES, "you two" pair chip, "how'd they earn it?" → Digging story, Visit Barn, Ask · Bless · Curse, today's blessing card, Report · Block all present. "Trade in progress" / "Cooling off" ask-blocked states still in code.
- [ ] **CAN'T FIND — Remove / unfriend.** Not on the sheet in either build (Block is the only exit); flagging because it's the kind of thing a re-review asks about.

### Barn visit (shots 09, 10)

- [ ] **CUT — Barn guestbook.** "BARN GUESTBOOK" dock, "Sign the Barn guestbook" stamp flow, "The hoofprint says plenty", `my_barn_guestbook`. Founder call 2026-09-12; migration `20260913020000_retire_barn_guestbook.sql` shipped in build 183.
- [ ] **CUT — Kindness card.** `leaveKindnessCard` / `leave_barn_kindness_card` rode on a stamp; went with the guestbook. The Guestbook Keepsake furnishing is `active=false`.
- [ ] **CUT — "shared this visit" / "Back to the Barn" / "All tickled out!" copy.** Replaced by "Head home" / "Just head home" and the parting-note sheet. Parting emotes (`leave_visit_emote`) survived.
- [ ] **CAN'T FIND — any on-screen tickle affordance.** Both Inside and Outside show two pigs and nothing that says "tap her". `tickle` is still wired to the host pig press, but there's no prompt, and "3 of 3 visits left" didn't decrement on entry. 179 had the same silent-tap model, so probably not a regression — but it's the thing that *feels* most like lost functionality on a fresh look.
- [ ] **NEW — Inside / Outside toggle** (habitat rooms) is post-179; the barn interior is empty because starter barns now begin empty (`20260913050000_empty_starter_barns`).

### Inbox / Rankings / Sounder (shots 06, 07, 08)

- [ ] **Nothing cut.** Inbox still has needs-you / Your trades / out-to-market / What happened / Load more (sections are conditional — this account only had one event, so the other sections don't render; not a regression). Rankings still Global · Friends · Pairs + Preview Wallow ranks. Sounder still has Call a snout / Recruit any snout / Oink the Sounder / Rewards / Exchange.
- [ ] **Stale comment, not a bug:** `app/(tabs)/friends.tsx` still says the board is "Global · Friends · Sounders" and that a Sounder-card jump lands on a Sounders scope; the Leaderboard's third scope is `pairs` in both builds.

### Not lost, but renamed by the Wave-3 primitive pass (2026-09-11)

Hand-rolled nav stickers → `SegmentedControl icon-over-label`; kicker/title/rule
→ `PageHeader variant="tab"`; `TabBtn` → `SegmentedControl`; initial-circle
avatar → `PrestigeAvatar` (hat shows on the sprite); friend rows → `ListRow` +
`RowTray`. Same features, different components — the diff looks bigger than it is.

## Bottom line

On the Friends tab proper, the only *functional* cuts since build 179 are the
guestbook and the kindness card, both deliberate and logged. The "we lost a lot"
feeling most likely comes from three things that are still there but
harder to reach: Visit / Pin / Profile moved into a collapsed tray, the row's
meta lines hide while the tray is open, and the Sounder segment now depends on
the live `world_boss` flag with no dev bypass.
