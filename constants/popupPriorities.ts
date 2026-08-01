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
//	 40 – 55      HOUSEKEEPING & FLOURISHES  one achievement digest, then
//	                                 mystery-hat and Lucky Pig rewards.
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
	// app/_layout.tsx — one-time Slop Club companion launch reveal. CEREMONY.
	pigFriendsLaunch: 28,
	rituals: 30, // app/_layout.tsx — ritual reveals.

	// ── housekeeping & flourishes ──
	// app/_layout.tsx — achievement digest. Housekeeping: held for
	// next login when a ceremony fired this session (ceremonyGate).
	achievements: 40,
	mysteryHat: 48, // components/MysteryHatReveal.tsx — mystery hat reveal.
	luckyPig: 55, // Barn.tsx — lucky-pig burst modal.
} as const;

export type PopupSlotId = keyof typeof POPUP_PRIORITIES;

// No priority collisions are currently intentional. Keep this explicit list so
// the registry test catches any accidental tie added later.
export const KNOWN_PRIORITY_COLLISIONS: readonly (readonly PopupSlotId[])[] = [];

// ── CEREMONY SLOTS (ceremonyGate stampers) ──────────────────────────────────
// The flip-day CEREMONIES. When one PRESENTS it stamps utils/ceremonyGate.ts
// (markCeremonyShown), which suppresses the achievement digest for the rest of
// the session — SKILL.md decision log
// 2026-07-11, "season-flip login liturgy". The stamping itself lives at each
// slot's `if (slot.visible) markCeremonyShown()` effect (app/_layout.tsx for
// hungerIntro, app/(tabs)/season.tsx for seasonEnd); this set records WHICH
// slots carry that responsibility so the invariant is discoverable here, in one
// place, next to the numbers. Keep in sync with those stamping effects.
export const CEREMONY_SLOT_IDS: ReadonlySet<string> = new Set<PopupSlotId>([
	"seasonEnd",
	"hungerIntro",
	"pigFriendsLaunch",
]);
