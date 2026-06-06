# Roadmap — June 2026 (next steps)

Captured 2026-06-05 right after the World Cup build (build 79 / CFBundleVersion
86). Organizes the next wave of work into buckets + a recommended sequence.

## A. Ship-blockers / distribution (do first — unblocks growth)

1. **Refer-a-friend install link.** Need a shareable "magic link" that gets a
   new person to *install*. The universal-link layer exists (build 78:
   `ticklethepig.com/r/<code>` → app if installed; landing page → TestFlight
   public link `testflight.apple.com/join/5dDhSNN9` if not). Tasks:
   - Verify the uninstalled-user path end-to-end (link → landing → TestFlight →
     install → code pre-fills onboarding).
   - **App Store cutover:** we're approved for App Store (public) soon. Swap the
     landing "join" button + any in-app copy from the TestFlight join URL to the
     App Store product URL when it goes live. (`landing/index.html:452` is the
     swap point, already commented for it.)
2. **Demo Rosie fix** — the App Store reviewer demo account
   (`demo@ticklethepig.com` / `demo_rosie`, seeded by
   `20260563000000_demo_reviewer_account.sql`). *Need detail on what's broken*
   (can't log in? empty Barn? stale state?). The migration only seeds if the
   auth user already exists — a likely failure mode is the auth user was never
   created via the signup curl, so the seed silently skipped.
3. **Spanish Terms of Service** — *need detail*. Today the in-app "Terms" link
   (`BattlePassSaleModal`) points at Apple's standard EULA
   (`apple.com/legal/.../stdeula/`), which localizes to the device language.
   Open question: is the problem that it shows Spanish to some users, that we
   need our own/localized ToS, or an App Store metadata ToS field? Clarify, then
   fix.

## B. World Cup follow-ups (tournament is live)

4. **Soccer ball — always purchasable.** A soccer-ball cosmetic available in the
   Shop at *all times* during the World Cup (not just the daily rotation). Needs:
   art (generate), a catalog row, and an "always-stocked WC shelf" surface (the
   daily_shop RNG won't guarantee it — add a pinned WC section or a flag on the
   item). 
5. **More World Cup items** (after the ball) — open bucket: jerseys, scarves,
   cleats for the pig, a vuvuzela held-item, confetti tickle-particle, etc.
6. (Done) Allegiance pick, 47 flags, 4 soccer backgrounds, flag on Barn.

## C. Social layer — the next big direction (design first)

See `docs/social-layer-ideas.md`. Two framings:
7. **Barn visiting** (Idea 2) — visit each other's pigs; "a better tickle
   trade." Recommended **first** — smaller, foundational primitive.
8. **Teams / push-pull** (Idea 1) — Team A vs Team B tug-of-war + mini-games.
   Larger meta-game; build on top of visiting. Biggest open question: how it
   relates to the existing angel/goblin alignment schism.
9. **Mini-games** — open bucket hanging off teams. Penalty-kick is a natural
   World Cup tie-in.

## D. Carry-over

10. **Notifications on real device** (task #11) — verify APNs path on hardware
    once build 86 is in TestFlight.

## Recommended sequence

1. **A1–A3 distribution + reviewer/legal fixes** (small, unblock public launch).
2. **B4 soccer ball** (quick WC win while the tournament's hot).
3. **C7 barn visiting** (the social primitive — design pass first).
4. **C8 teams + C9 a first mini-game** (the meta-game, once visiting exists).

Rationale: clear the public-launch blockers first (we're approved), bank an
easy WC item, then invest in the social layer that defines the next era —
foundational primitive (visiting) before the meta-game (teams).
