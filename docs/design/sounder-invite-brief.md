# Sounder Invite Page — design brief

The description that drives the cleaner UI. Feed this to Claude Design (or
any mockup pass) alongside `docs/design/taste-standard.md` and the shipped
in-crew card (see the Jul-6 screenshot: crew sticker with pips + "+" slots,
roster rows, "THE SCUFFLE" section, hand-written leave line) — the invite
surfaces must feel like siblings of that card.

## The one rule that shapes everything

**A pig rides with exactly one Sounder at a time** (server-enforced:
unique membership + `already_in_crew` on every path; founding/joining
auto-declines your other pending invites). The invite page is therefore a
*matchmaking* page, not an inbox: its whole job is moving a crewless pig
into their one herd — or quietly holding asks a crewed pig can't act on.

## Surfaces covered

1. **The crewless Sounder tab** (Friends hub → Sounder, no crew) — the
   "invite page" proper.
2. **The friend-invite bottom sheet** (`FriendInvitePicker`, opened from a
   "+" roster slot when in a crew).
3. **The invites strip** shown to a pig who already has a crew.

## Jobs, in priority order (crewless)

1. **Answer a personal ask.** Incoming invites are the warmest path — a
   named friend wants *you*. They lead the page. One tap Join, quiet
   decline.
2. **Join an open Sounder.** The browse list (`find_joinable_crews`: has a
   free slot, not mid-scuffle). Fullest-first so herds fill. One tap Join.
3. **Found your own** — deliberately DEMOTED. A hand-written "or found
   your own ›" link that expands the name + Found form. It leads only when
   there is nothing to join and nobody asking.

## States

| State | What shows |
|---|---|
| Invites + joinables | Invites section, then "open Sounders", then the found link |
| Joinables only | Open Sounders, then the found link |
| Nothing to join | Found form expanded, copy: "raise the first banner and the bog fills in behind you" |
| In a crew, invites pending | Invites rendered non-actionable: the ask + decline only, plus the line "one Sounder at a time — leave yours to answer an invite" |
| Join races (crew filled/warring between render and tap) | Inline note ("Just filled up — the bog moves fast."), list refreshes |

## Row anatomy

- **Invite row**: [friends Glyph] "**Rosie** wants you in **The Mud
  Maulers**" · [Join] [decline (hand-font underline)]
- **Open Sounder row**: [friends Glyph] crew name (bold) / "3 of 5 snouts
  · Rosie's banner" (hand font) · [Join]
- **Bottom-sheet friend row**: [PigAvatar] name#disc / status line —
  "in <Sounder>" (taken), "rides with you" (crewmate), "waiting…"
  (pending) — or [Invite].

## What "messy" means today (the fixes the mockup should make)

- Three visually different row treatments (invite rows, joinable rows,
  create form) sit as separate full Stickers with no shared rhythm —
  unify: ONE paper sticker, section kickers inside it, same row grammar.
- The create form reads as co-equal to joining; it should read as a
  footnote unless it's the only path.
- Buttons: mixed sizes (Button sm vs custom sun pills). Pick the sun pill
  (bordered, Fredoka 13) everywhere a row has a Join/Invite.
- No identity: joinable crews are text-only. Give each row the round
  paper portrait treatment from the war-banner design direction (pig
  silhouette until real crests exist).
- Copy voice drifts between UI-speak ("Pending invites") and game-speak.
  Everything in game voice: "waiting on Jen…", "room for two more
  snouts".

## Tokens (non-negotiable)

WHIMSY palette only; Caprasimo headlines / Fredoka buttons / Nunito body /
PatrickHand kickers+links; Sticker with 2–3px ink border, ±0.5–1.5° tilt,
hard shadows (4,4 or 2,2); RADII/SPACE/TYPE roles; Glyph/Icon, no emoji.
