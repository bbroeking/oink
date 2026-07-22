// Slop Club Rosie — CLIENT-ONLY PROTOTYPE member pig skin (exploratory).
//
// A gentle gold/rose WASH over the base pig frames so a member's Rosie reads as
// the gilded "club" variant wherever she renders (Barn, Closet). This is NOT
// final art and NOT server-backed: the flag lives only in AsyncStorage and the
// wash is a low-opacity `tintColor` copy of each frame, kept tasteful (a wash,
// not a repaint). The real version would ship bespoke gold Rosie sprite frames
// and gate on the durable is_vip flip, not a local flag.
//
// A tiny module-level store (subscribable via `usePigSkinTint`) so the single
// pig render path (SpritePig) can read the skin without every caller threading
// a prop. Only a member can toggle it on (the Closet gates the control on
// is_vip); when off the store returns null and SpritePig's default render is
// byte-identical.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WHIMSY } from "@/constants/theme";

export const PIG_SKIN_KEY = "pig_skin_v0";

// The wash hue — Slop Club gold (theme token, on-brand). Applied as a
// tintColor copy of the frame at PIG_SKIN_WASH opacity so Rosie's shading
// still reads underneath the gilding.
export const PIG_SKIN_TINT = WHIMSY.slopGold;
export const PIG_SKIN_WASH = 0.34;

let current: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
	listeners.forEach((l) => l());
}

// Read the persisted flag once (lazily, on first subscribe or explicit call).
export async function loadPigSkin(): Promise<void> {
	try {
		const v = await AsyncStorage.getItem(PIG_SKIN_KEY);
		current = v === "1" ? PIG_SKIN_TINT : null;
	} catch {
		current = null;
	}
	loaded = true;
	emit();
}

// Toggle the skin. Optimistic in-memory flip + emit, then persist.
export async function setPigSkin(on: boolean): Promise<void> {
	current = on ? PIG_SKIN_TINT : null;
	emit();
	try {
		await AsyncStorage.setItem(PIG_SKIN_KEY, on ? "1" : "0");
	} catch {
		// Prototype: a failed write just means the skin won't survive reload.
	}
}

export function getPigSkinTint(): string | null {
	return current;
}

function subscribe(cb: () => void): () => void {
	listeners.add(cb);
	if (!loaded) {
		loaded = true;
		void loadPigSkin();
	}
	return () => {
		listeners.delete(cb);
	};
}

// Hook — the current wash tint, or null when the skin is off (default). Drives
// both SpritePig's render and the Closet toggle's on/off state.
export function usePigSkinTint(): string | null {
	return useSyncExternalStore(subscribe, getPigSkinTint, () => null);
}
