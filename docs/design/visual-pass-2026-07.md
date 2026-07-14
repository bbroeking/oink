# Visual / simplicity pass — July 2026

Deep audit of every player-facing screen against `docs/design/taste-standard.md` and the
`constants/theme.ts` tokens (WHIMSY / COLORS / TYPE / RADII / SPACE / the two hard shadows /
MODAL_BACKDROP_BG). Findings are checklists: `file:line — issue — fix`, worst-first per screen.

> **Season caveat:** the season tab is being restructured today per
> `docs/explorations/sounder-onboarding-plan.md`. Season findings below target the components
> that survive (HungerHero, the live `VerticalListPassTrack` internals, RaceSection,
> SounderCard/SounderHomeCard, the modals, TrufflePatch) — **not** the tab's layout/ordering.

> **Dingbat policy used here:** `★ › · ! ?` are established house typography (★ appears in 46
> files as the kicker prefix; the no-emoji sweep targeted Unicode emoji like 🔒, not dingbats).
> They are NOT flagged as violations. `✓ ✕ ✦ ♥` ARE flagged where the same file/app already
> renders the concept via `Icon`/`Glyph` — that's the same concept drawn two ways, an
> inconsistency, not an emoji failure.
>
> **RULED 2026-07-13** (taste-standard decision log): `✦` and `·` are sanctioned label
> typography and stay as Text; `✓ ✕ ♥` are semantic and render via `Icon "check"` /
> `Icon "x"` / `Glyph "heart"`. The per-item resolutions below apply that ruling.

---

## Barn (home tab) — `app/(tabs)/index.tsx` → `components/Barn.tsx`

- [x] components/ActiveEffects.tsx:201-202 — raw hex `#C99B23` (= COLORS.goldDeep) and `#5E7E49` (in no palette) for bless/curse countdowns — tokenize a bless/curse pair in WHIMSY and reference it. → already WHIMSY.bless/curseGreen (foundation pass).
- [x] components/ActiveEffects.tsx:165 — raw hex `#7BA266` curse border, hand-mixed green off-palette — same bless/curse token pair. → already WHIMSY.curseGreen (foundation pass).
- [x] components/ui/BarnOverlay.tsx:143 — raw hex `#D9A441` coin fill (near-miss of WHIMSY.goblin `#d4a437`) — use WHIMSY.goblin. → already WHIMSY.goblin (foundation pass).
- [x] components/ui/BarnOverlay.tsx:119-124,134-135,145 — ad-hoc decorative washes `rgba(249,209,76,…)`, `rgba(74,104,58,…)`, `rgba(59,42,30,…)` and `#FFFFFF` puff — derive from WHIMSY.sun/sage/bark + opacity, or document as the sanctioned scene-wash exception. → documented in-file as the sanctioned scene-wash exception (no clean WHIMSY mapping; sun/sage don't match these values).
- [x] components/WhileAwayModal.tsx:213 — raw hex `#D5E4C9` curse row fill — same bless/curse token pair as ActiveEffects. → already WHIMSY.sage (foundation pass).
- [x] components/WhileAwayModal.tsx:107,124 — `★`/`♥` rendered as Text glyphs while Barn's own HeartFloats use `glyphSource("sparkle"/"heart")` images — use Glyph for both. → `♥` → Glyph "heart" (semantic per 2026-07-13 dingbat ruling); `★` stays — sanctioned kicker typography.
- [x] components/WhileAwayModal.tsx:169-177 — "Got it" is a bespoke Pressable+Text styled as a button — use the shared `Button` primitive. → `Button variant="purple"` (lilac-family), dead `btn`/`btnText` styles removed.
- [x] components/WhileAwayModal.tsx:197 — `fontSize: 24` headline off the TYPE scale (22/26 bracket it) — TYPE.sectionTitle or pageTitle. → TYPE.pageTitle.
- [x] components/HoofprintsSheet.tsx:102 — bare `<Text>Nothing on your snout right now.</Text>` — use the `EmptyState` primitive.
- [x] components/HoofprintsSheet.tsx:227,281 — `fontSize: 17` card title / `24` sheet title off the TYPE scale — TYPE.cardTitle (18) / sectionTitle (22). (title now via SectionHeader → sectionTitle; cardName → cardTitle)
- [x] components/HoofprintsSheet.tsx:98-99 — kicker+title rolled inline instead of SectionHeader (ActiveEffects/TroughSection on the same screen use SectionHeader) — adopt SectionHeader.
- [x] components/Barn.tsx:1202 — ad-hoc `rgba(255,255,255,0.45)` generousPuff tint — token-derived translucent or documented exception. → documented in-file as scene-wash exception (same family as BarnOverlay); borderRadius 999 → RADII.pill.
- [x] components/Barn.tsx:1116,1109 — `fontSize: 17` ticketSub / `30` ticketValue off the TYPE scale — numeral/cardTitle roles; document a ticket-numeral role if 30 is intentional. (wontfix: documented in-file as the intentional ticket-numeral treatment — 30 sits between display 32 and pageTitle 26, no clean role)
- [x] components/Barn.tsx:238,277 — `Sticker radius={10}` — 10 is off the RADII scale — RADII.md (12). → RADII.md.
- [x] components/Barn.tsx:1104,1188,1193 — `fontSize: 9/10` micro-labels below the label-12 floor — TYPE.label or kickerPill. → ticketLabel 10→11 (kickerPill floor); barnFlagEmptyText kept at 9 — bump risks wrap in the fixed 76px pennant (noted in-file).
- [x] components/Barn.tsx:1188 — `barnFlagEmptyGlyph` style is dead after the Icon swap — delete. → deleted.
- [x] components/Barn.tsx:720 — SVG `fill="#c44848"` inlines COLORS.barn by value — reference the token. → COLORS.barn.
- [x] components/BarnActiveEffectsStrip.tsx:32-40 — effect chip Pressable has no pressed feedback — add pressed-opacity style function. → pressed opacity 0.7.
- [x] components/BarnActiveEffectsStrip.tsx:108,114,133,138 — whimsy `fontSize: 13` + `11/10/9` micro-text, all off-scale — nearest TYPE roles. → meta 10→11; name 13 / blurb 11 / senderInitial 9 kept — intentional compact chip scale (no whimsy role below 16; 9 in the 16px dot risks clipping).
- [x] components/BarnSounderChip.tsx:110 — kicker is an ad-hoc hybrid (PatrickHand at 11, tracked caps) — KICKER_TEXT or KICKER_PILL, not a blend. → composed from TYPE.kicker (family governed; tracked-caps sun-on-bark overrides kept).
- [x] components/BarnSounderChip.tsx:70-78 — close Pressable has no pressed feedback (the chip itself has it) — add. → pressed opacity 0.7.
- [x] components/BarnSounderChip.tsx:104-105 — `paddingVertical: 9 / paddingRight: 30 / paddingLeft: 10` off the SPACE scale — snap to 8/12/24. → SPACE.sm pads; borderRadius 14→RADII.lg; paddingRight 30 kept + documented (clears the absolute close button).
- [x] components/ActiveEffects.tsx:51,175 — `Sticker radius={10}` off-scale — RADII.md. → RADII.md.
- [x] components/ActiveEffects.tsx:146-151,227 — dead styles (`band`, `sub`) left behind by the SectionHeader migration — delete. → already gone (foundation pass).
- [ ] components/Barn.tsx — density: fully-populated Barn (2 PaperTickets + effect chips + truffle button + sounder chip + flag + toast) hits ~6–8 bordered surfaces over the pig; the top third competes with Rosie — cap simultaneous chips (e.g. collapse effects into the strip only). (deferred: layout restructuring, out of polish-pass scope)
- [x] Barn low-severity group — inlined token-matching values (`gap: 12`, `paddingVertical: 12`, `paddingHorizontal: 18` = PAGE_PAD) plus off-scale `14/11/6/10` pads across Barn.tsx:1050-1082,1233, ActiveEffects.tsx:156-220, HoofprintsSheet.tsx:208-214 — migrate to SPACE under leave-it-better. → exact matches swept to SPACE/PAGE_PAD; off-scale ±2 values (14/11/6 and HoofprintsSheet's sheet insets) kept — snapping would visibly shift.

`app/(tabs)/index.tsx`, `components/TroughSection.tsx`: clean (TroughSection uses SectionHeader, SnoutCoin, token colors).

## Friends tab — `app/(tabs)/friends.tsx` + hub

- [x] components/BarnVisitModal.tsx:421 — raw hex status ramp `#62b048 / #e8a82e / #ef7a5a` for visits-left — tokenize (success / goblin-gold / accent are the closest sanctioned trio). (→ COLORS.successText / WHIMSY.goblin / WHIMSY.accent)
- [x] components/BarnVisitModal.tsx:1130,1160 — scrims `rgba(20,16,28,0.46/0.55)` are NOT MODAL_BACKDROP_BG — use the token. (already MODAL_BACKDROP_BG in the current tree — foundation pass)
- [x] components/BarnVisitModal.tsx:875,981,1029,1046 — more raw hex: `#ffe9a8`, `#e8a82e`, `#fff`, `#8a5a36` — map onto WHIMSY (paper/sun/goblin) or add tokens. (`#ffe9a8` → WHIMSY.slopBand; sun/paper already tokens; `#8a5a36` kept as the dug-earth dirt prop — no WHIMSY brown between paper and near-black bark, documented in-file)
- [x] components/BarnVisitModal.tsx:876-883,921,965-967,1114,1147,1191 — fractional/off-scale font sizes (`23`, `26`, `12.5`, `11.5`, `9.5`, `9`) throughout — snap every one to a TYPE role; fractional sizes are never on the scale. (title/tallyNum → sectionTitle, napTitle → pageTitle, 12.5/11.5 → label/kicker, 9.5/9 → kickerPill)
- [x] components/BarnVisitModal.tsx:473-474 — naked `ActivityIndicator` loading state — LoadingBeat.
- [x] components/BarnVisitModal.tsx:1131,1087,1167 — `borderRadius: 24/16/20` off the RADII scale — 22/14/18. (heartCard→xl, forageReveal→lg, napCard→xl; all pill idioms → RADII.pill)
- [x] components/BarnVisitModal.tsx:1130-1158 — the whole "How visiting works" sheet style block (+ `beatHeart`, tickles/energy bars) appears unreferenced — delete the dead styles before they get copied. (already gone in the current tree — foundation pass)
- [x] components/BarnVisitModal.tsx:870,887,1046 — `paddingTop: 56`, `paddingHorizontal: 13`, `marginTop: -11` plus pervasive 5/7/9/11/13 pads — SPACE sweep; this file was ported from an HTML handoff and never mapped to tokens. (SPACE-swept; paddingTop 56 kept as documented status-bar safe offset)
- [x] components/Leaderboard.tsx:763-764 — raw hex `#C99B23` (= COLORS.goldDeep) and `#5E7E49` (no token) for the alignment section colors — same bless/curse token pair as ActiveEffects (the comment even says "matches Barn" — matched by copy-paste, not by token). → already on WHIMSY.bless/curseGreen (foundation pass).
- [x] components/Leaderboard.tsx:703-714 — hand-rolled decorative tape (raw geometry + `opacity: 0.92`) — use the shared `Tape` primitive from Sticker.tsx. → `<Tape color="roseDeep" rotate={-12}>`; champTape trimmed to positioning only.
- [x] components/Leaderboard.tsx:138,228,662 — `♥` as Text in champ score / row unit / empty copy while the app has heart glyph art — Glyph, or accept `♥` as a text idiom app-wide and write it down (it currently varies by file). → champ score + row unit → Glyph "heart" via IconText (semantic per 2026-07-13 ruling); the :662 "empty copy" heart didn't exist (that line is a ★ cap-note, sanctioned).
- [x] components/Leaderboard.tsx:781-823 — TYPE bypass across all row text (`10/11/14/15/22` raw) — TYPE roles; `10` is below the label floor. → champName→sectionTitle, champScore→hand, rowDisc/rowSub/rowScoreUnit→label; rowRank/rowName/rowScore kept at whimsy-15 (numeral is 16 — the 1px bump shifts fixed rank/score column widths).
- [x] components/UserSheet.tsx:449-451 — naked `ActivityIndicator` loading state — LoadingBeat. → LoadingBeat "peeking in"; ActivityIndicator import removed.
- [x] components/UserSheet.tsx:974-979,1072-1076 — hand-written `{2,2}` shadow configs — spread `SHADOW_SM` instead. → already ...SHADOW_SM (foundation pass).
- [x] components/UserSheet.tsx:1107-1117 — visitBtn `borderWidth: 2.5, borderRadius: 16, paddingVertical: 15`, text `19` — all off-scale; 2 / RADII.lg / SPACE.lg / cardTitle. → all four applied. (Also: `{value} ♥` stat and "Ask for X ♥" button → IconText + Glyph "heart"; the interpolated feedback sentence keeps its ♥ — inline text run.)
- [x] components/UserSheet.tsx:641-655 — Report/Block Pressables have no pressed feedback — add. → pressed opacity 0.7 on both. (Also: 974/1072 hand-written {2,2} shadows → SHADOW_SM.)
- [ ] components/UserSheet.tsx — density: open sheet stacks avatar header + alignment bar + stats card + Visit button + 3-tab control + active panel + moderation row = 7–8 bordered surfaces — collapse moderation behind an overflow, or merge stats into the header. (deferred: layout restructuring, out of polish-pass scope)
- [x] components/Inbox.tsx:886-899 — pen card ships a THIRD shadow tier `{3,3}` — there are exactly two tiers; use SHADOW_SM or STICKER_SHADOW. → already ...STICKER_SHADOW (foundation pass).
- [x] components/Inbox.tsx:918-925 — hand-written `{2,2}` shadow — spread SHADOW_SM. → already ...SHADOW_SM (foundation pass).
- [x] components/Inbox.tsx:702-711,581 — passive-feed glyphs (`♥ ★ + ✦ ☁`) and decline `✕` as Text — Glyph/Icon (the actionable cards already use PNG art). → decline ✕ → Icon "x"; answered ♥ → Glyph "heart"; ★ ✦ ☁ + stay as Text — sanctioned print typography per 2026-07-13 ruling.
- [x] components/Inbox.tsx:566-582 — Accept/decline Pressables have no pressed feedback — add. → pressed opacity 0.7 on both. (Also: {3,3}/{2,2} shadows already on tier constants; content paddingBottom → TAB_SAFE+SPACE.xl.)
- [x] components/Inbox.tsx:765-772 — dead `emptyText` style (EmptyState is used at :484) — delete; `content` paddingBottom `110` should be TAB_SAFE-derived. → both already resolved (foundation pass: style gone, paddingBottom = TAB_SAFE + SPACE.xl).
- [x] components/Friends.tsx:647 — `paddingHorizontal: 14` on the page wrap — PAGE_PAD (18) or SPACE.md; the hub gutter shouldn't be bespoke. → PAGE_PAD.
- [x] components/Friends.tsx:665-679,761-800 — TYPE bypass across the roster (`10/11/12/13/16/18/22` raw) + ad-hoc `tabsRow` segmented control — TYPE roles; see systemic rec on segmented controls. → sounderName→cardTitle, rowDisc/rowWearsText→label, kickerSmall→KICKER_PILL; hand-12/13 + whimsy-16 sites kept (no matching roles); SegmentedTabs primitive stays a systemic rec.
- [x] components/Friends.tsx:717-760,803-813 — three near-identical ink-bordered circle treatments (avatarCircle / rowPigWrap / rowVisitBtn) with magic half-width radii — one shared circle-chip style. → half-width radii → RADII.pill; shared circle-chip primitive deferred (refactor, out of polish scope).
- [ ] components/Friends.tsx:262-275 — hash-tinted initial discs in search rows carry no information (friends rows use PigAvatar) — drop the tint or use PigAvatar everywhere. (deferred: information-design decision, not a token polish)
- [x] components/Friends.tsx:840-846 — `kickerSmall` (10px, tracked) rolled ad-hoc for "FIND A FRIEND"/"SUGGESTIONS" — SectionHeader/KICKER_PILL. → KICKER_PILL.
- [x] app/(tabs)/friends.tsx:272 — `fontSize: 10` whimsy badge text off-scale — TYPE.label. (wontfix: badge count is deliberately whimsy-font in an 18px circle; label's bodyExtra family + 12px would visibly change and crowd it)
- [x] app/(tabs)/friends.tsx:237 — `borderWidth: 2.5` off the 2px signature — 2, or promote 2.5 to a documented weight. → 2.
- [x] components/CrewSheet.tsx:134-140 — grabber `44×5 r3` disagrees with UserSheet's `44×4 r2` — one shared sheet-grabber constant. → aligned to 44×4 r2 (UserSheet's geometry); shared constant deferred to the SheetScaffold systemic rec.

`components/CrewRow.tsx`, `components/FriendInvitePicker.tsx`: clean — the model files for the hub (shared primitives, tokens throughout).

## Season tab — `app/(tabs)/season.tsx` (surviving internals) + season1 + mudwar

- [x] components/mudwar/TruffleExchangeSheet.tsx:188 — backdrop `rgba(20,16,28,0.5)` is not MODAL_BACKDROP_BG — use the token. (already MODAL_BACKDROP_BG — foundation pass)
- [x] components/mudwar/TruffleExchangeSheet.tsx (whole file) — imports zero tokens: raw radii `22/14/10/8`, pads `28/18/14/12/10`, every text a raw `fontFamily+fontSize` (:193,:200,:235,:258) — full token pass; this is the one file that predates the system entirely. (RADII/SPACE/TYPE/PAGE_PAD throughout)
- [x] components/mudwar/TruffleExchangeSheet.tsx:125 — `rarityColor + "22"` hex-alpha string concat — tokenized tint, never string math on colors. (→ RARITY_BG_SOLID by item.rarity)
- [x] components/mudwar/TruffleExchangeSheet.tsx:137-177 — buy/confirm/done CTAs are bespoke Pressable+Text with no pressed feedback — shared `Button`. (kept the sun-sticker CTA family for cross-sheet consistency; added the house pressed-opacity style function to all three — a gradient Button would break the shared warm-pill identity)
- [x] components/mudwar/TruffleExchangeSheet.tsx:85 — "THE TRUFFLE EXCHANGE" kicker rolled ad-hoc — KICKER_TEXT/KICKER_PILL. (→ TYPE.kicker + accent = KICKER_TEXT composition)
- [x] app/(tabs)/season.tsx:173-757 — `TierStone`/`SnakingPassTrack`/`SnakeStone` are never mounted (live track is `VerticalListPassTrack` at :1773) — ~590 lines of dead pass-track code still carrying stale patterns; delete. → deleted 176-565 (TierStone, buildSnakePath, SnakingPassTrack, SnakeStone + SNAKE_* consts + snakeStyles); re-verified zero references. Live `tierStatsFor`/`StatsPills`/`VLTierRow` (interleaved in the range) preserved. Also: scrim → MODAL_BACKDROP_BG; `#5a8338` → COLORS.successText.
- [ ] app/(tabs)/season.tsx:157 — raw hex `#F58F4A` flame color in the live StoneThumb — tokenize (peach/accent family). → SKIPPED: `#F58F4A` is a saturated flame-orange with no near-match token (peach `#ffc8a8` too pale, accent `#c25a3f` too red, goblin `#d4a437` too yellow); substituting any visibly changes the flame Icon. Needs a minted `WHIMSY.flame` in a foundation pass (out of this pass's token-minting scope).
- [x] app/(tabs)/season.tsx:989 — `#5a8338` inlines COLORS.successText by value — reference the token. → COLORS.successText (cornerBadgeClaimed).
- [x] app/(tabs)/season.tsx:958-960,1005-1006,1058,1170-1171 — live vl/passTab/passBanner styles carry off-scale radii (`26/13/10`), pads (`14/10/9/6`), `fontSize: 9/10` — SPACE/RADII/TYPE sweep (~30 sites). → 12× borderRadius 999→RADII.pill, seg pad→SPACE.sm, micro-caps 9/10→11 (kickerPill floor); the 26/13/10 "radii" are true circle radii (half of 52/20px nodes — geometric, kept); 14/10/9/6 intermediate button pads kept (no SPACE token; half-tokenizing a rule reads worse).
- [ ] components/mudwar/TrufflePatch.tsx:1581-1675 — ad-hoc ink tints `rgba(42,31,21,…)` (a different ink base than WHIMSY.mute's 40,30,20) — use WHIMSY.mute/muteSoft or tokenize a patch-ink. → SKIPPED: the six `(42,31,21)` tints carry bespoke opacities (0.1/0.18/0.25/0.32/0.55/1.0); none is visually identical to mute(0.6)/muteSoft(0.4), and they sit in the dig-canvas rendering config + grid-tile styles that were reworked today (instruction: do not touch layout/animations). Warrants a minted `WHIMSY.patchInk` in a foundation pass, not a mute/muteSoft substitution.
- [x] components/mudwar/TrufflePatch.tsx:1714-1825 — pervasive `...TYPE.role` spreads immediately overridden with a raw `fontSize` (11/12/13/14/15) — pick the right role instead of re-sizing it; an override defeats the role it just spread. → endLineText → TYPE.bodySm (the one clean role match); the rest are roles knocked to sizes with NO matching role (no hand-12, no whimsy-14/15) — kept rather than invent fake matches.
- [x] components/season1/RaceSection.tsx:231,477 — `fullFieldLink` and `ceremonyBtn` Pressables have no pressed feedback (SeasonRow next to them has it) — add. → pressed opacity (0.6 link / 0.7 btn).
- [x] components/season1/RaceSection.tsx:593-597 — finds numeral `22` + `9`px caps caption off-scale — sectionTitle-role numeral + TYPE.label. → rowFindsNum→TYPE.sectionTitle, rowRank→TYPE.numeral.
- [x] components/season1/RaceSection.tsx:207-210 — "the patch is quiet" is bare Text — EmptyState (compact) for parity with the rest of the tab. → compact beat (zzz Glyph + hand line) inside the existing Sticker (full EmptyState would double-sticker).
- [ ] components/season1/HungerHero.tsx:115 — `Sticker radius={20}` off the RADII scale — RADII.xxl (22); same at SeasonGuideModal.tsx:143, SeasonInfoModal.tsx:66, BattlePassSaleModal.tsx:69 — `radius={20}` is a recurring off-scale idiom, fix everywhere at once. (deferred: HungerHero/SeasonGuideModal are sibling-agent-owned; every OTHER `radius={20}` site fixed this pass — SeasonInfoModal, BattlePassSaleModal, WhileAwayModal, UserSheet, Account, ReferralCodeEntry, UsernameSetup, SupaAuth, LuckyPigModal, AchievementUnlockModal, AlignmentExplainerModal, AlignmentSchismModal, GreatHungerIntroModal, ItemPreviewModal, season.tsx → RADII.xxl; Skeleton's is a 40px circle, kept)
- [x] components/season1/HungerHero.tsx:307-308 — fractional `fontSize: 13.5` + raw 14/22 — TYPE roles; fractional sizes are never tokens. (fixed post-wave: main session)
- [x] components/season1/HungerHero.tsx:263-270 — in-progress segment (peach) vs eaten segment (sun) reads as two golds — one hue + opacity for the filling state. (fixed post-wave: main session)
- [x] components/season1/SeasonGuideModal.tsx:250,277,308 — `fontSize: 24 / 14.5 / 13.5` off-scale; `ladderLevel` (:302) is dead — roles + delete; share one modal-headline style with SeasonInfoModal (:106, same 24). (fixed post-wave: main session)
- [x] components/season1/SounderHomeCard.tsx:188-193 — practice-dig / Burrow Book links have no pressed feedback — add. → links already carried pressed opacity 0.65 (pre-resolved); joinBtn accept-invite was the true gap — added pressed 0.7.
- [x] components/season1/SounderHomeCard.tsx:330-424 — off-scale pads/sizes (5/8/-2/13) group — SPACE/TYPE sweep. → litRing/track 999→RADII.pill; joinBtnText 13 whimsy (no role), pV 5 (load-bearing button sizing), -2/hairline margins kept.
- [x] components/GreatHungerMeter.tsx:187-196 — `fontSize: 11/12/15` raw (15 whimsy is off-by-one from numeral 16) — TYPE.label/kicker/numeral. → creditLevel→label, creditNum→numeral, creditLabel/creditNext→kicker.
- [ ] components/SounderCard.tsx:571,639 — CTA text overrides a TYPE role's family with FONTS.display — if Fredoka-on-CTA is the house pattern, encode it in Button; don't override roles inline. (deferred: encoding Fredoka-on-CTA into Button is a primitive change — systemic rec, not a call-site polish)
- [x] app/(tabs)/season.tsx:752 — "Claim reward ✦" renders the sparkle as text — consistent with achievements' claim button, so either bless `✦`-in-CTA as house style or swap both to a Glyph; don't leave it per-file. (wontfix: ✦-in-CTA blessed as house label typography by the 2026-07-13 dingbat ruling — see taste-standard decision log)

`components/season1/SeasonStory.tsx`, `components/mudwar/ReclaimSlam.tsx`: clean. `components/SounderCard.tsx` otherwise strong (CrewRow primitives, LoadingBeat, tokens).

## Shop tab — `app/(tabs)/shop.tsx` + purchase surfaces

- [x] app/(tabs)/shop.tsx:224-237 — ad-hoc rarity hex maps (`#cdbfae #7ba868 #5a8bc5 #f4ebe0 #d9ead0 #cfe0ec #e2daf6`) beside the shipped RARITY_GRADIENT/RARITY_BG_SOLID tokens — extend the rarity tokens (stripe + fill) and delete both local maps (see ClosetView below — it re-rolls the same maps with *different* hexes). → already on RARITY_STRIPE/RARITY_BG_SOLID (foundation pass minted RARITY_STRIPE); no local maps remain.
- [x] app/(tabs)/shop.tsx:507 — raw hex `#5b8a4a` OWNED tag — COLORS.successText. → already COLORS.successText (foundation pass).
- [x] app/(tabs)/shop.tsx:494 — `rgba(42,31,21,.34)` border tint (off-base ink) — WHIMSY.mute/muteSoft. → WHIMSY.muteSoft (0.34≈0.4).
- [x] app/(tabs)/shop.tsx:946 — `accent + "33"` hex-alpha concat for the section rule — tokenized tint. → WHIMSY.muteSoft (never string math on colors).
- [x] app/(tabs)/shop.tsx:889-984 — Browse band headers rolled ad-hoc (dot + Text + rule) while Today uses SectionHeader (:1061) — unify on SectionHeader. (wontfix: SectionHeader has no slot for the per-rarity colored dot — unifying drops the rarity semantics; tokenized in place instead — pads→SPACE, text→TYPE.cardTitle base — and noted in-file)
- [x] app/(tabs)/shop.tsx:1028-1046 — view-toggle Pressables have no pressed feedback — add. → pressed opacity 0.7. (Also: chipLocked border → WHIMSY.muteSoft; owned ✓ badge/tag → Icon check; balance fontSize 17 → TYPE.numeral; dead ownedBadgeText removed.)
- [x] app/(tabs)/shop.tsx:393-395,440,464,472 — `fontSize: 10.5 / 9 / 8` micro-text below the 11 kickerPill floor — smallest roles are kickerPill 11 / label 12. → legendLabel 10.5→11; rarityText 8 was in the dead old-mosaic block (deleted with it); membersRibbonText 9 kept — bumping widens the fixed corner ribbon (overflow risk, noted).
- [x] app/(tabs)/shop.tsx:320,338 — owned `✓` as Text while Icon is imported and used elsewhere in the file — Icon name="check". → ownedBadge circle + OWNED/WEARING tag both → Icon check (tag now Icon+Text row, same centered footprint); dead ownedBadgeText removed.
- [x] app/(tabs)/shop.tsx:1284 — balance `fontSize: 17` off-scale — numeral (16) or cardTitle (18). → already TYPE.numeral (foundation pass). (Also this pass: the entire retired bento-mosaic/featured-hero dead style block deleted — 0 references verified.)
- [x] components/TruffleCatalogSheet.tsx:126 — backdrop `rgba(20,16,28,0.5)` not MODAL_BACKDROP_BG — token. (already MODAL_BACKDROP_BG — foundation pass)
- [x] components/TruffleCatalogSheet.tsx:84 — bare Text "Loading rewards…" — LoadingBeat.
- [x] components/TruffleCatalogSheet.tsx:91,161 — `color + "22"` hex-alpha concat — tokenized tint. (→ RARITY_BG_SOLID by rarity; only one such concat in the current tree, :91)
- [x] components/TruffleCatalogSheet.tsx:113,165 — done CTA bespoke Pressable+Text, no pressed feedback — Button. (kept the sun-sticker CTA family; added house pressed-opacity — see TruffleExchange note)
- [x] components/BuryTruffleSheet.tsx:137 — backdrop `rgba(20,16,28,0.5)` not MODAL_BACKDROP_BG — token. (already MODAL_BACKDROP_BG — foundation pass)
- [x] components/BuryTruffleSheet.tsx:119,175 — bury CTA bespoke — Button. (already had pressed feedback; kept the sun-sticker family + full token sweep)
- [x] components/BuriedTruffleSheet.tsx:231 — backdrop `rgba(20,16,28,0.5)` not MODAL_BACKDROP_BG — token. (already MODAL_BACKDROP_BG — foundation pass)
- [x] components/BuriedTruffleSheet.tsx:259 — raw hex `#e8a82e` progress fill — goblin/slopGold token. (→ WHIMSY.goblin)
- [x] components/BuriedTruffleSheet.tsx:255,270 — `rgba(42,31,21,…)` track/divider tints — WHIMSY.mute-family. (track → WHIMSY.cream2 warm empty-track; divider → INK @ opacity 0.12, the house thin-divider pattern)
- [x] components/BuriedTruffleSheet.tsx:113,188,206 — top-up/reclaim CTAs bespoke — Button. (already had pressed feedback; kept the sun-sticker / armed-reclaim family + full token sweep)
- [x] components/PurchaseToast.tsx:150-154 — `{3,3}` shadow — a third tier; SHADOW_SM or STICKER_SHADOW. (already STICKER_SHADOW in the current tree — foundation pass)
- [x] components/PurchaseToast.tsx:105,108 — `#5a8338` inlined (= successText) and `✓`/`!` as Text in the status circle — token + Icon. (→ COLORS.successText; success `✓` → Icon check; fail `!` kept as whimsy-font typographic mark — no exclamation Icon exists, and `x` would misread as reject)
- [x] components/BattlePassSaleModal.tsx:107-119 — the loud gold "Unlock" CTA is hand-rolled — Button (variant gold exists). → `Button variant="gold" full`; dead buyBtn/buyBtnText removed. (Also: Sticker radius 20→RADII.xxl, 16→RADII.lg.)
- [x] components/BattlePassSaleModal.tsx:89,69 — `Sticker radius={16}` and `={20}` off the RADII scale — 14/18/22. → already RADII.xxl/lg (fixed with the :107 Button item). (Also this pass: ✕ close → Icon "x", dead closeText removed.)
- [x] components/MysteryHatReveal.tsx:336 — done CTA bespoke ink Pressable — Button. → `Button variant="dark"`; dead doneBtn/doneText removed. (Also: :168 Sticker radius 20 → RADII.xxl.)
- [x] components/MysteryHatReveal.tsx:168 — `radius={20}` off-scale — RADII.xxl. → already RADII.xxl (fixed with the :336 Button item). (Also this pass: 2× borderRadius 999 → RADII.pill.)
- [x] components/ItemPreviewModal.tsx:222,432,444 — `borderRadius/radius 20` (off-scale) and inlined 18s — RADII tokens. → radius 20→RADII.xxl; closeBtn/previewCard 18→RADII.xl.
- [x] components/ItemPreviewModal.tsx:228,123,203 — `✕` close + `✦` fallbacks as Text — Icon/Glyph. → ✕ → Icon "x" (dead closeText removed); ✦ fallbacks stay — sanctioned typography per 2026-07-13 ruling.
- [x] components/ui/BuyCelebration.tsx:51-62,143 — burst particles are `★ ✦ ♥` Animated.Text — glyph images animate the same way; also :73-77 premium/common branch returns the identical haptic (dead branch) — differentiate or drop. (wontfix: documented in-file as the decorative-confetti exception under the 2026-07-13 ruling — ★/✦ are flourish, the ♥ rides as animated confetti not a static love-count; a lone image glyph among Animated.Text would fracture the burst. The identical-haptic dead ternary is flagged in-file, left — behavior change.)
- [x] components/TruffleButton.tsx:86 — pulse ring `borderRadius: 16` off-scale — RADII.lg/xl. → RADII.lg (matches the button's own radius); btn 14→RADII.lg, badge 999→RADII.pill.
- [x] Shop low-severity group — inlined/matching numerics across shop.tsx (:1383-1411,:1627), truffle sheets (grid `GAP = 10`), PurchaseToast (:135) — SPACE/RADII/TYPE sweep under leave-it-better. → live band styles → TYPE.cardTitle/kickerPill/numeral; truffle sheets verified already migrated; grid GAP stays numeric (width math).

## Account (Me tab) — `components/Account.tsx` + closet/titles

- [x] components/ClosetView.tsx:88-95 — third rarity hex map in the app (`#f4ebe0 #d4e8d4 #c8dde9 … / #7ba868 #5a8bc5 #c99b23`) — and its hexes disagree with shop.tsx's maps for the same rarities; fold both into the RARITY tokens. → already on RARITY_BG_SOLID/RARITY_STRIPE (foundation pass); no local map remains.
- [x] components/ClosetView.tsx:519-520 — spreads STICKER_SHADOW then overrides offset to `{2,2}` — that's SHADOW_SM; use it directly. → `...SHADOW_SM`.
- [x] components/ClosetView.tsx:239,246,368,373 — `✕ + ✦ ✓` as Text (the file's own comment says "Never raw emoji" for thumbnails) — Icon/Glyph. → ✕→Icon "x", ✓→Icon "check", ✦→Glyph "sparkle"; dead slotRemoveText/itemEmoji/checkText removed.
- [x] components/ClosetView.tsx:350,228,309 — item cards / slot chips / title chip have no visual pressed feedback (haptics only) — the primary tap of the closet needs a pressed state. → pressed opacity 0.7 on item card, slot chip, title chip.
- [x] components/ClosetView.tsx:423-430 — hand-rolled centered header (ad-hoc kicker + `fontSize: 30` title) — PageHeader pattern + pageTitle (26). → title → TYPE.pageTitle; the lowercase-accent kicker kept (KICKER_PILL would uppercase + recolor = visible change; full PageHeader swap = layout).
- [x] components/ClosetView.tsx:44-45,525,622,655-656 — `10`-based grid gaps, `borderRadius: 10`, `fontSize: 22/40` glyph sizing — SPACE/RADII tokens; sizes fixed by the Icon swap above. → radii/gaps/pads → RADII.lg/md/sm/xl/pill + SPACE; itemCard inline hard-shadow → ...SHADOW_SM; slotLabel 10→11; grid gap:10 kept — load-bearing (TILE_W math hardcodes 2×10).
- [ ] components/ClosetView.tsx — density: the paper-doll preview alone (8 flank slot-chips + pig window + title chip) exceeds 6 bordered surfaces before the grid begins — consider fading unfilled slot chips to borderless ghosts. (deferred: layout restructuring, out of polish-pass scope)
- [x] components/Account.tsx:2012 — raw hex `#c0504d` entry-error text — WHIMSY.accent (the file's own error color everywhere else). → WHIMSY.accent.
- [x] components/Account.tsx:1638,2029 — fractional `fontSize: 10.5 / 12.5` — TYPE.label / bodySm. → rounded onto the scale (10.5→11, 12.5→13) keeping their whimsy/hand families — the TYPE roles would swap the font family (visible change); fractional sizes retired.
- [x] components/Account.tsx:719-732,656,921,962,1000 — Achievements row, share/copy, downline link, seeMore Pressables all lack pressed feedback — add the same pressed-opacity the SettingRow uses. → pressed opacity 0.7 on Achievements row, copy-my-code, copy referral, Share invite, leaderboard link, "Your sounder + rewards ›".
- [x] components/Account.tsx:1488 — `✓ Rewards earned` as Text while the file uses Icon check at :764,:911,:1442 — Icon. → Icon check + Text row (milestoneBadgeRow).
- [ ] components/Account.tsx — density: default Me scroll = identity + long-story + achievements + Slop Club + referral (itself 5 info blocks) + settings ≈ 6+ stickers; the referral card is a screen inside a card — collapse its internals behind the existing "Your sounder + rewards ›" link. (deferred: layout restructuring, out of polish-pass scope)
- [ ] components/Account.tsx:646 vs 685 — SEASON TICKLES and LIFETIME TICKLES twin 3-col bands two cards apart invite misreading — differentiate the treatments or merge into one band with a toggle. (deferred: design/layout decision, out of polish-pass scope)
- [x] components/Account.tsx:2092 — `borderRadius: 10` copyBtn + `gap/padding: 10` off-scale — 8/12; plus ~40 inlined token-matching values (reps :1572,:1686,:1877,:1991) — sweep. → copyBtn → RADII.md + SPACE pads; 16 exact-match radii → RADII.pill/lg/md; circle/bar geometry (32/20/13/11/4/3) kept.
- [x] components/TitlesSection.tsx:96,118 — title chips (the primary tap) and Unequip have no pressed feedback — add. → pressed opacity 0.7 on both.
- [x] components/TitlesSection.tsx:172,180 — `fontSize: 10` + `marginTop: 10/1` off-scale — label role, SPACE. → margins → SPACE.sm; wrap/gaps/pads/radii swept to SPACE/RADII.lg; chipPlacement 10 kept — it's PatrickHand (label's bodyExtra family = visible swap; bump risks chip growth, noted).
- [x] components/TitlesSection.tsx:79-91 — section header rolled from KICKER_PILL + inline count — SectionHeader with a right slot. (wontfix: SectionHeader renders a whimsy title + rule; this is deliberately a compact pill kicker with an inline `· N` count — the swap would change the visual, not govern it. Already composed from the KICKER_PILL token.)
- [x] components/ReferralCodeEntry.tsx:288 — `fontSize: 24` title off-scale — 22 or 26. → TYPE.sectionTitle.
- [x] components/ReferralCodeEntry.tsx:160 — Continue button lacks pressed feedback while Skip/Apply beneath it have it — add. → pressed opacity 0.7.
- [x] components/ReferralCodeEntry.tsx:275,285,301,346 — `paddingHorizontal: 22`, `marginBottom: 14/10`, `paddingVertical: 13` off-scale — PAGE_PAD/SPACE. → input/btn radii → RADII.md; the geometry-shifting pads (pH 22, mb 14, pV 13, gap 10 — none with an exact token) kept to avoid visible shifts.

`app/(tabs)/account.tsx`: clean.

## Stack screens — achievements / sounder / sounder-progress / race-standings / dig-collection

- [x] app/sounder-progress.tsx:179-183 — bare `<Text>` empty state — EmptyState (its sibling stack screens all use it). → EmptyState (friends glyph); dead `empty` style removed.
- [x] app/sounder-progress.tsx:236-259 — `height: 7`, `borderRadius: 4`, `padding: 10`, `gap: 9/11`, `borderWidth: 2.5` — off-scale sweep. → rung radius→RADII.md, borderWidth 2.5→2, pads→SPACE.lg/md/sm; bar geometry (height 7 / radius 4) kept — load-bearing progress-bar look.
- [x] app/sounder-progress.tsx:198-205 — cardKicker re-implements KICKER_PILL inline — use the token. → ...KICKER_PILL.
- [x] app/achievements.tsx:354 — done `✓` as Text — Icon check like the rest of the app. → Icon check; dead doneTickText removed.
- [x] app/achievements.tsx:181 — filter chips have no pressed feedback (Claim button has it) — add. → pressed opacity 0.7. (Also: :354 done ✓ → Icon check; dead doneTickText removed.)
- [x] app/achievements.tsx:388-389,412,486,544 — `paddingVertical: 7/9`, `fontSize: 10` chip badge/category — SPACE 8/12, label 12. → chip pV→SPACE.sm, 999s→RADII.pill, chipBadgeText/categoryTag 10→11.
- [x] app/sounder.tsx:126,157-198 — `borderRadius: 10`, `gap/pad 10`, `padding: 18` (= PAGE_PAD by value) — tokens. → PAGE_PAD, SPACE.sm/lg, Sticker radii → RADII.sm/xl.
- [x] app/sounder.tsx:159-165 — champ kicker re-implements KICKER_PILL inline — token. → ...TYPE.kickerPill + accent (KICKER_PILL bakes mute; this kicker is accent).
- [x] app/dig-collection.tsx:187-221 — `...TYPE.kicker` spread then `fontSize` overridden on four styles — pick the right role; the override defeats it. → dead spreads removed from name/story/count (every prop was overridden); caption genuinely wears TYPE.kicker, kept.
- [x] app/race-standings.tsx:448 — `fontSize: 9` score caption — micro-copy floor is 11/12; otherwise the cleanest screen in the audit. → 9→11.

`app/race-standings.tsx`, `app/dig-collection.tsx` otherwise clean — both wear PageHeader, LoadingBeat, EmptyState, tokens.

---

## Top-10 worst offenders

1. **components/BarnVisitModal.tsx — the HTML-handoff port that never met the tokens.** 7+ raw hexes (:421,:875,:981,:1046), non-token scrims (:1130,:1160), fractional font sizes (12.5/11.5/9.5), off-scale radii (24/20/16), naked spinner (:473), a dead sheet-style block. One dedicated token pass retires ~a third of all high-severity findings.
2. **components/mudwar/TruffleExchangeSheet.tsx — imports zero tokens.** Rogue backdrop (:188), raw everything (:193-282), hex-alpha concat (:125), bespoke CTAs without pressed feedback. Pre-token-era file; full rewrite onto the system.
3. **The rogue scrim family `rgba(20,16,28,…)`** — TruffleCatalogSheet:126, BuryTruffleSheet:137, BuriedTruffleSheet:231, TruffleExchangeSheet:188, BarnVisitModal:1130/1160. Six cool-purple backdrops vs the warm MODAL_BACKDROP_BG. One find-and-replace.
4. **A third shadow tier `{3,3}` exists in the wild** — Inbox.tsx:886/918, PurchaseToast.tsx:150. The system's whole premise is two tiers; these are the only true shadow violations.
5. **The bless/curse/status green-gold family has no token, so five files hand-mix it** — `#5E7E49`/`#C99B23` (Leaderboard:763, ActiveEffects:201), `#7BA266` (ActiveEffects:165), `#D5E4C9` (WhileAwayModal:213), `#5b8a4a` (shop:507), `#62b048/#e8a82e` (BarnVisitModal:421), `#D9A441` (BarnOverlay:143). Mint `WHIMSY.bless`/`WHIMSY.curseGreen` once.
6. **Three competing rarity color maps** — shop.tsx:224-237 and ClosetView.tsx:88-95 re-roll rarity fills/stripes with *different* hexes despite RARITY_GRADIENT/RARITY_BG_SOLID existing for exactly this drift.
7. **Primary CTAs hand-rolled instead of `Button` at 8+ sites** — BattlePassSaleModal:107, MysteryHatReveal:336, TruffleCatalogSheet:113, BuryTruffleSheet:119, BuriedTruffleSheet:188/206, TruffleExchangeSheet:137-177, WhileAwayModal:169 — most also missing pressed feedback.
8. **Loading/empty states regressing behind the primitives** — naked ActivityIndicator (UserSheet:449, BarnVisitModal:473), bare text (TruffleCatalogSheet:84, HoofprintsSheet:102, sounder-progress:179, RaceSection:207).
9. **Dead code carrying stale patterns** — season.tsx:173-757 (~590 lines of unmounted pass track), BarnVisitModal's sheet block, ActiveEffects:146, Inbox:765, SeasonGuideModal:302. Dead styles are where old idioms get copy-pasted from; delete them.
10. **Pressed-feedback gaps on primary taps** — ClosetView:350, TitlesSection:96, achievements:181, Inbox:566, UserSheet:641, shop:1028, RaceSection:231/477, SounderHomeCard:188, Account:719/921. The standard says the world responds *now*; these taps respond never.

## Systemic recommendations (fix once, in a primitive)

1. **Mint the missing tokens instead of policing the leaks.** Recurring hand-mixes that deserve WHIMSY entries: bless-gold/curse-green pair, the patch-ink `rgba(42,31,21,…)` family (or standardize on mute/muteSoft), a `pill: 999` radius, and rarity stripe/fill folded into the RARITY tokens. Most raw-hex findings above collapse into these four tokens.
2. **`SheetScaffold` primitive** — backdrop (MODAL_BACKDROP_BG), grabber (one geometry — CrewSheet and UserSheet currently disagree), RADII.xxl sheet radius, PAGE_PAD padding, two-phase teardown. The five truffle/exchange/visit sheets each re-rolled all of it, each slightly wrong.
3. **One segmented-control primitive.** Friends tabsRow (:676), UserSheet actionTabs (:544), Leaderboard toggle (:680), shop view toggle (:1028) are four hand-rolled versions of the same control in two tabs. Build `SegmentedTabs` once with pressed feedback baked in.
4. **Bake pressed feedback into the primitives, not the call sites.** Button already has it; add a `PressableSticker`/`ChipPressable` wrapper with the house pressed-opacity so new chips can't ship without it (retires finding class #10 permanently).
5. **Decide the dingbat question once and write it into the taste standard.** `★` kicker prefix: sanctioned (46 files). But `✓ ✕ ✦ ♥` currently render as Icon in some files and Text in others — pick per character (suggested: ✓✕ → Icon always; ♥✦ in body copy → Glyph; `✦` inside a Button label → allowed as typography) and add the ruling to the decision log.
6. **Enforce the TYPE floor mechanically.** Dozens of 8/9/10/10.5/11.5/12.5/13.5px sizes and `...TYPE.x` + `fontSize` overrides. A lint grep (`fontSize:\s*(?!1[1-9]|2[0-9]|3[0-9])` + fractional sizes + override-after-spread) in CI or a pre-commit hook makes the scale self-enforcing.
7. **Delete the legacy `Card` in components/ui/index.tsx** — soft SHADOWS.card + `borderRadius: 20` + `padding: 14`, zero call sites. It's a slop template waiting to be imported; removing it (and the now-unused SHADOWS export from sticker contexts) closes the door.
8. **Countdown copy is consistent, formatters aren't.** Four near-identical formatters (utils/time.formatHM, utils/activeEffects.formatLeft, utils/rooting.formatLeft, Barn.formatCountdown) — consolidate on utils/time so "resets in 3h 12m" can never drift per-surface.
9. **BarnVisitModal + TruffleExchangeSheet deserve dedicated migration passes** (offenders #1/#2) rather than leave-it-better nibbles — they're the two files where the token system never landed at all, and both are high-traffic Connect surfaces.
