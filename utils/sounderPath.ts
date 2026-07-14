// The onboarding-funnel AsyncStorage stamps — the single source of truth for the
// keys the Sounder path (hooks/useSounderPath.ts) DERIVES its step from. Kept in
// one module so the WRITERS (useRooting stamps the first real dig; _layout stamps
// the intro; useRooting stamps the practice/"snout tried" flag) and the READER
// (useSounderPath) can never disagree on a key name.
//
// The step is never stored as its own flag — it's always derived from these
// pieces of real state (+ crew state), so it can't desync from what actually
// happened. These helpers only read/write the underlying evidence.

import AsyncStorage from "@react-native-async-storage/async-storage";

// HOOK → TASTE boundary: the tale cinematic was seen (stamped in app/_layout.tsx
// when the GreatHungerIntroModal is dismissed). Per-user.
export const introSeenKey = (uid: string) => `s2_intro_seen:${uid}`;

// TASTE → VALUE boundary: a practice dig was logged. Reuses the existing
// install-scoped flag useRooting already stamps on the first practice dig (it
// also gates the beginner's-snout claim), so "practiced" and "snout tried" are
// the same event — no second stamp.
export const PRACTICED_KEY = "beginners_snout_tried_v1";

// FIRST_DIG → DONE boundary: at least one REAL (non-practice) dig has been
// submitted. Per-user so a shared device doesn't inherit another player's
// progress. Stamped from useRooting's real-submit path (markFirstRealDig).
export const firstRealDigKey = (uid: string) => `first_real_dig_done:${uid}`;

// Stamp "this player has dug for real at least once." Fail-soft: a storage
// hiccup just means the step machine keeps showing FIRST_DIG until the next
// successful real dig re-stamps — never throws into the submit path.
export async function markFirstRealDig(uid: string | null): Promise<void> {
	if (!uid) return;
	try {
		await AsyncStorage.setItem(firstRealDigKey(uid), "1");
	} catch {
		// no-op — a missed stamp is self-healing on the next real dig.
	}
}
