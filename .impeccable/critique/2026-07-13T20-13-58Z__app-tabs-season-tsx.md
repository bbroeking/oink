---
target: season tab
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-07-13T20-13-58Z
slug: app-tabs-season-tsx
---
Method: dual-agent (A: design review · B: detector + native sweep)

# Critique — Season tab (`app/(tabs)/season.tsx` + season1 components)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Live "now" pin, shared countdowns, lit roster rings — the tab's superpower |
| 2 | Match System / Real World | 2 | "Root the patch" needs a permanent "dig for truffles" subtitle; ~22 terms first session |
| 3 | User Control and Freedom | 3 | All dismissible; but guide auto-pops over the first visit |
| 4 | Consistency and Standards | 2 | Premium named four ways; two claim-button styles; Slop Club paywall behind "Unlock Premium Pass" |
| 5 | Error Prevention | 3 | Busy-guards, two-tap leave, disabled guarded CTA |
| 6 | Recognition Rather Than Recall | 3 | Next-reward as art ✓; three unlabeled header icon circles ✗ |
| 7 | Flexibility and Efficiency | 3 | Stall-compression, scroll-to-pass, notify chip (but only in one branch) |
| 8 | Aesthetic and Minimalist Design | 2 | Tier state triple-encoded ×30 rows; five overlapping explainer surfaces |
| 9 | Error Recovery | 3 | Specific claim-failure copy; "Locked" alert title for already_claimed is sloppy |
| 10 | Help and Documentation | 3 | Abundant but fragmented — ladder rendered identically in two modals |
| **Total** | | **28/40** | Good real UI; two structural gaps (vocabulary, premium naming), not a polish problem |

## Anti-Patterns Verdict

**LLM assessment:** nobody would say "AI made that" — derived-never-typed numbers, a self-retiring onboarding machine, and a voice no template produces. By the repo's own slop definition (governance erosion): `#C99B23` inlined 5× where `COLORS.goldDeep`/`WHIMSY.bless` exist; `#F58F4A` flame with no token; `borderRadius: 999` where `RADII.pill` exists; SounderLaunchModal is pre-system (no Sticker, raw radii/sizes); 6 native `Alert.alert` calls punch iOS chrome through the paper-craft world; and SaaS grammar is leaking in (CLAIMED/READY/LOCKED tags, display-only stats pills, "VIP" pills).

**Deterministic scan:** detector: 1 advisory (`#fff` on a dev-only chip). Native sweep: 8 raw hexes (7 = the gold dupe pattern), 67 raw fontSize literals coexisting with 75 TYPE uses, 14 raw radii, 0 rgba, 0 emoji (★/✦/›/· confirmed as sanctioned typography per the 2026-07-13 dingbat ruling), 0 ActivityIndicator, 6 Alert.alert, **17 Pressables with no pressed feedback** (incl. all three YourTakeStrip cells, the hero banner, "Maybe later", the premium Unlock).

**Agreement:** both assessments independently flagged the gold-hex duplication, the pill-radius literal, Alert.alert, and raw-Pressable CTAs. B's 17-item pressed-feedback list is the precise version of A's spot checks. False positives: ★/✦ glyphs (sanctioned), 999-as-pill (debatable), dev-chip hits (low priority).

**Visual evidence:** unavailable — sim booted but dev client had no JS bundle (known stale-dev-client state); source-derived reasoning used.

## Overall Impression

The restructure landed: state is truthful, copy can't lie (numbers derive from constants), and commitment moments are the best-designed axis of the tab. The two things holding it at 28: the player-facing *language* (premium has four names; the core verb needs a permanent subtitle) and the *ending* (every session ends scrolling a 20-row lock wall). Biggest single opportunity: make the tab end warm.

## What's Working

1. **The derived onboarding machine** — `useSounderPath` + self-retiring step card; evidence-derived state, stall-compression instead of nagging. Rare product craft.
2. **Copy that cannot lie** — WindowStrip and the dig CTA share countdown math; "25 stirs, not 20" and payout numbers derive from `STIR_BUDGET` / `RACE_TRUFFLE_TABLE`.
3. **Stake-lowering voice at commitment moments** — founding/join/first-dig copy removes anxiety without leaving the storybook register.

## Priority Issues

1. **[P1] Premium identity is four-named and the purchase story misleads.** "Premium" tab · "★ VIP" kicker · "★ Premium Pass — Unlock" banner · opens the *Slop Club subscription* paywall; a dormant fifth path (BattlePassSaleModal) lingers. Fix: one name; banner states the truth ("the premium track is a Slop Club perk"); quarantine the dead path. → /impeccable clarify
2. **[P1] The page ends on 20+ locked rows** — peak-end violation; the last thing every session shows is what the player doesn't have. Fix: current ±2 tiers + next milestone, collapse the rest ("…and 18 more tiers ›"), end the scroll on a warm beat. → /impeccable distill
3. **[P1] Guarded-phase dead-end for retained players.** NotifyChip exists only in the first_dig onboarding branch; CrewedHome's guarded state is a disabled button. Fix: move the chip to the shared CTA area; give the weekly beat's "one more snout must dig" line a poke action. → /impeccable polish
4. **[P2] Tier-row state triple-encoded ×30** (node fill + badge + text tag + dashed border + strikethrough). Keep a tag only for READY; drop or activate the display-only stats pills. → /impeccable distill
5. **[P2] First-session sequencing:** the guide auto-pops onto a tab the player hasn't seen, right after the intro video — two lore walls back-to-back, ladder duplicated in two modals. Fix: 3-step guide, ladder lives in the hero sheet only, auto-open on second visit. → /impeccable onboard

## Persona Red Flags

**Jordan (first-timer):** guide modal lands before the tab does; "Join a Sounder" SectionHeader sits above a step card saying "Try a dig — no herd needed" — two competing imperatives; "spend at the Exchange ›" against a zero balance; three indistinguishable unlabeled header circles.
**Sam (crewed casual, 2 minutes):** patch open = excellent 3-tap session; patch guarded = disabled button + countdown, no notify, no crew-poke, then a scroll past 30 pass rows.
**Riley (competitive grinder):** the weekly race (the thing that pays Monday) is the smallest text in its section, under a season-cumulative board; "4 READY" pills look tappable and aren't; XP rates hide behind an unlabeled star.

## Minor Observations

Header kicker duplicates the title's words · "The Great Hungerer — Gorged" can read as the *player's* status · StepDots show an unreachable 4th dot · free-track "VIP" pill reads as VIP-only · dead StoneThumb icon branches · WindowStrip `nowFrac` epoch-modulo assumption vs server boundary · "Claim reward ✦" / "Unlock" bypass the Button primitive · tickle cell taps into a lore sheet.

## Questions to Consider

1. Six countable resources on a "feelings shown, not numbered" charter — if only two numbers survive on this tab, which?
2. If the verb needs a permanent caption, is the caption the real label ("dig for truffles") and "rooting" the flavor?
3. Would moving the 30-tier track to its own screen let the Season tab end on the dig-off — the Contend pillar — instead of a lock wall?
