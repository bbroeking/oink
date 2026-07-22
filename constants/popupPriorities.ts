// Popup precedence registry — the ONE place the global popup ordering lives.
//
// The PopupQueue state machine (components/ui/PopupQueue.tsx) decides WHICH of
// the currently-wanting popups may present: lowest priority NUMBER wins, ties
// keep arrival order (a stable sort — see pickWinner + the collision note
// below). The machine is deep and well-tested; it owns the HOW. This file owns
// the WHAT — the numbers that define precedence — so that ordering knowledge is
// discoverable in one table instead of scattered as magic literals across the
// ~6 files that declare slots via usePopupSlot(id, want, priority).
//
// Every usePopupSlot call site MUST pass its priority from POPUP_PRIORITIES
// below — never a bare literal. Numbers here are the source of truth; changing
// one reorders the queue globally.
//
// ── PRECEDENCE BANDS (derived from the actual numbers, low = shows first) ──
//
//	  5           USER-INITIATED     a sheet the player tapped open jumps the
//	                                 line ahead of every passive/auto popup.
//	 10 – 30      EVENTS & CEREMONIES  the "real dialogs": schism, finale,
//	                                 rituals, plus the two flip-day CEREMONIES
//	                                 (seasonEnd 25, hungerIntro 27) which sit
//	                                 between finale and rituals. Ceremonies
//	                                 additionally stamp the ceremonyGate (see
//	                                 CEREMONY_SLOT_IDS) to suppress housekeeping
//	                                 for the rest of the session.
//	 40 – 60      HOUSEKEEPING & FLOURISHES  achievements carousel + release
//	                                 notes (the housekeeping the ceremonyGate
//	                                 holds), then the cosmetic flourishes
//	                                 (mystery hat, field guide, lucky title /
//	                                 pig, the six-seven egg).
//	 90 – 95      QUIET-FILL NUDGES   the fallback onboarding nudges. LOW enough
//	                                 that any real dialog beats them, and their
//	                                 own presentation is excluded from the
//	                                 "did anything present this session?" signal
//	                                 (see QUIET_FILL_SLOT_IDS) so they only fill
//	                                 a genuinely quiet login.
//
// Ordered ascending by priority. Keep it that way — the order in this literal
// is the human-readable precedence list.
export const POPUP_PRIORITIES = {
	// ── user-initiated ──
	// Barn.tsx — the buried-truffle sheet is opened by a player tap, so it
	// preempts whatever passive popup is up (the queue drains it, then shows
	// the sheet). Highest precedence in the app.
	truffleSheet: 5,

	// ── events & ceremonies ──
	schism: 10, // app/_layout.tsx — herd schism verdict.
	finale: 20, // app/_layout.tsx — season finale verdict.
	// app/(tabs)/season.tsx — season-end recap. CEREMONY (stamps ceremonyGate).
	// Sits just after the finale verdict (20) so the chain is verdict → recap.
	seasonEnd: 25,
	// app/_layout.tsx — Great Hunger intro. CEREMONY (stamps ceremonyGate).
	// Slotted just ABOVE the recap (25) so on the season-flip login it can
	// never co-present over the recap: recap → intro.
	hungerIntro: 27,
	rituals: 30, // app/_layout.tsx — ritual reveals.

	// ── housekeeping & flourishes ──
	// app/_layout.tsx — achievement-unlock carousel. Housekeeping: held for
	// next login when a ceremony fired this session (ceremonyGate).
	achievements: 40,
	// Barn.tsx — release notes. Housekeeping: also held by the ceremonyGate.
	releaseNotes: 45,
	mysteryHat: 48, // components/MysteryHatReveal.tsx — mystery hat reveal.
	// components/FieldGuideReveal.tsx — field guide page reveal.
	// COLLISION: shares priority 50 with luckyTitle (see the 50/50 note below).
	fieldGuide: 50,
	// Barn.tsx — lucky-pig title unlock.
	// COLLISION: shares priority 50 with fieldGuide (see the 50/50 note below).
	luckyTitle: 50,
	luckyPig: 55, // Barn.tsx — lucky-pig burst modal.
	sixSeven: 60, // Barn.tsx — the "six-seven" counter easter egg.

	// ── quiet-fill nudges ──
	sounderLaunch: 90, // app/_layout.tsx — join-a-Sounder onboarding nudge.
	feedbackNudge: 95, // app/_layout.tsx — feedback nudge (lowest of all).
} as const;

export type PopupSlotId = keyof typeof POPUP_PRIORITIES;

// ── THE 50/50 COLLISION: fieldGuide vs luckyTitle ──────────────────────────
// Both declare priority 50. This is INTENTIONAL and preserved as-is; the block
// exists so a future accidental collision is caught (see
// __tests__/popupPriorities.test.ts) while this known pair stays allowed.
//
// What the queue does on a tie: pickWinner() does a STABLE sort by priority, so
// equal-priority slots keep ARRIVAL ORDER — whichever slot's want was recorded
// into the wanting set (via request()) first presents first; the other stays
// queued and presents after the winner drains (one full handoff gap later).
// Nothing is dropped. The two live in different component trees (FieldGuide-
// Reveal vs Barn) driven by unrelated triggers (a guide page opening vs a
// lucky-pig title unlock), so a genuine same-commit tie is vanishingly rare;
// if it happens, first-arrived wins and the loser follows, serialized. Do NOT
// "fix" the collision by nudging a number without re-deriving the bands above.
export const KNOWN_PRIORITY_COLLISIONS: readonly (readonly PopupSlotId[])[] = [
	["fieldGuide", "luckyTitle"],
] as const;

// ── QUIET-FILL EXCLUSION SET (session-presented signal) ─────────────────────
// The fallback onboarding nudges. Their defining rule: they only fire on a
// genuinely quiet login (nothing else wanted the screen). To keep that true,
// their OWN presentation must NOT count as "another popup presented this
// session" — otherwise the nudge would retroactively suppress itself (and the
// feedback nudge, a sibling of the Sounder nudge, would suppress it or itself).
//
// The arbiter (PopupQueue.write) consults this set on every presenting edge and
// skips markPopupPresented() for these ids; utils/popupSession.ts holds the
// actual latch. Kept here, beside the priorities, so the "which slots are quiet
// fill" policy lives in the same table as their (deliberately lowest) numbers.
// Typed as ReadonlySet<string> (not <PopupSlotId>) so the arbiter can test any
// live queue id — which is a bare string — while `new Set<PopupSlotId>` still
// compile-checks that the members below are real slot ids.
export const QUIET_FILL_SLOT_IDS: ReadonlySet<string> = new Set<PopupSlotId>([
	"sounderLaunch",
	"feedbackNudge",
]);

// ── CEREMONY SLOTS (ceremonyGate stampers) ──────────────────────────────────
// The flip-day CEREMONIES. When one PRESENTS it stamps utils/ceremonyGate.ts
// (markCeremonyShown), which suppresses the housekeeping popups (achievements
// 40, releaseNotes 45) for the rest of the session — SKILL.md decision log
// 2026-07-11, "season-flip login liturgy". The stamping itself lives at each
// slot's `if (slot.visible) markCeremonyShown()` effect (app/_layout.tsx for
// hungerIntro, app/(tabs)/season.tsx for seasonEnd); this set records WHICH
// slots carry that responsibility so the invariant is discoverable here, in one
// place, next to the numbers. Keep in sync with those stamping effects.
export const CEREMONY_SLOT_IDS: ReadonlySet<string> = new Set<PopupSlotId>([
	"seasonEnd",
	"hungerIntro",
]);
