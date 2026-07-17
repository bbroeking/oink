# Spec 19 — Copy audit: "friends" vs "Sounder" are different things

**Source:** founder call 2026-07-17. The two concepts must never blur in
player-facing text: **friends** = the pigs you add (the social graph:
visits, blessings, trades, barn-tickling). **Sounder** = your crew — the
herd you DIG with (the Truffle Patch feeding, the race, milestones,
knock-to-join). CONTEXT.md's Sounder entry already records this
("historically the word named the friends graph; the crew owns it now") —
this spec ENFORCES it in copy.

## The audit

Sweep every player-facing string (components/, app/, constants/ — copy in
JSX Text, toasts, announcements' client-side templates, empty states,
buttons, sheet titles; NOT code identifiers, NOT comments, NOT
docs/, NOT migrations' server-side announcement text — server copy changes
require a migration and are OUT of this spec's scope; list any offenders in
the report instead):

1. Places that say "sounder" but mean the FRIENDS graph (adding, visiting,
   blessing, trading with a friend) → rewrite to "friends" / "your
   friends".
2. Places that say "friends" but mean the CREW (dig access, race, herd
   milestones, knock/join, crew invites) → rewrite to "your Sounder" /
   "the herd".
3. Ambiguous copy that addresses both ("your pigs") → only rewrite if it
   genuinely misleads; when unsure, list it in the report as a judgment
   call instead of changing it.

Known surfaces to check (not exhaustive — grep is the tool):
components/Friends.tsx, components/JoinableSounders.tsx,
components/CrewRow.tsx, components/UserSheet.tsx, app/sounder.tsx,
app/(tabs)/friends.tsx, components/season1/* (SounderHomeCard,
SounderStepCard, SeasonGuideModal), onboarding copy, invite/referral copy
(the referral program is FRIEND-adjacent but lands the invitee in your
world — read carefully which concept each line means; the "+100 snouts"
referral copy says "sounder" in places where the mechanic is actually the
friends/referral lane).

## Rules

- Whimsy voice preserved; don't flatten charm into sterile labels.
- "Sounder" is always capitalized as a proper noun in copy; "friends" is
  not.
- Do NOT rename code identifiers, props, routes, or analytics keys — copy
  only (the technical-name rule: player words live in UI strings only).
- Tests: update any string assertions your rewrites break.

## Report

List every changed string as `file:line — before → after`, plus the
out-of-scope server-side offenders and judgment calls. Full suite +
typecheck.
