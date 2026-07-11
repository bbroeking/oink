// utils/sound.ts — tiny cozy SFX layer for the dig minigame.
//
// A thin imperative wrapper over expo-audio's `createAudioPlayer` (not the
// `useAudioPlayer` hook, so play-by-key works from anywhere, not just render).
// Players are created lazily on first play and cached, so importing this module
// costs nothing and never touches the native layer under jest.
//
// Design contract:
//   • preload(keys) warms the players up-front (call on game mount).
//   • play(key) fires a one-shot at a cozy default volume.
//   • startAmbience()/stopAmbience() run a looping bed with a JS volume fade.
//   • Respects the iOS silent switch by default (playsInSilentMode:false) —
//     the OS mute switch silences the game, which is the OS default and what a
//     cozy dig wants (unlike Barn's laughs, which opt into silent playback).
//   • A global mute (setMuted) is honored by every play; there is no existing
//     app-wide sound toggle to bind to yet (checked Account/settings — none),
//     so this is the seam a future settings switch wires into.
//
// Every native call is wrapped so a missing/omitted native module (tests, web)
// degrades to a silent no-op rather than throwing.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

export type SoundKey =
	| "scrape"
	| "creak"
	| "truffle_pop"
	| "shimmer"
	| "pouch_clink"
	| "ambience";

// Static requires — Metro resolves these at bundle time, so they must be
// literal. NOTE: these ship as SILENT PLACEHOLDERS until the ElevenLabs key is
// granted the `sound_generation` scope and `scripts/gen_deeproot_sfx.py` is
// re-run to overwrite them with the real cozy set. No code change needed then.
const SOURCES: Record<SoundKey, number> = {
	scrape: require("../assets/sounds/deeproot/scrape.mp3"),
	creak: require("../assets/sounds/deeproot/creak.mp3"),
	truffle_pop: require("../assets/sounds/deeproot/truffle_pop.mp3"),
	shimmer: require("../assets/sounds/deeproot/shimmer.mp3"),
	pouch_clink: require("../assets/sounds/deeproot/pouch_clink.mp3"),
	ambience: require("../assets/sounds/deeproot/ambience.mp3"),
};

// Cozy per-cue volumes — soft by default; the ambience bed sits well under the
// one-shots so it never competes with the payoff cues.
const VOLUME: Record<SoundKey, number> = {
	scrape: 0.45,
	creak: 0.5,
	truffle_pop: 0.7,
	shimmer: 0.6,
	pouch_clink: 0.55,
	ambience: 0.34,
};

const players = new Map<SoundKey, AudioPlayer>();
let muted = false;
let audioModeSet = false;

/** Global mute for the game SFX layer. Honored by every play + the ambience bed. */
export function setMuted(next: boolean): void {
	muted = next;
	if (muted) {
		const bed = players.get("ambience");
		try {
			bed?.pause();
		} catch {}
	}
}

export function isMuted(): boolean {
	return muted;
}

function ensureAudioMode(): void {
	if (audioModeSet) return;
	audioModeSet = true;
	// Respect the hardware silent switch (OS default) — a cozy dig should go
	// quiet when the phone is on silent.
	try {
		void setAudioModeAsync({ playsInSilentMode: false });
	} catch {}
}

function getPlayer(key: SoundKey): AudioPlayer | null {
	let p = players.get(key);
	if (p) return p;
	try {
		p = createAudioPlayer(SOURCES[key]);
		if (key === "ambience") p.loop = true;
		p.volume = VOLUME[key];
		players.set(key, p);
		return p;
	} catch {
		return null;
	}
}

/** Warm the players so the first crank doesn't hitch. Safe to call repeatedly. */
export function preload(keys: SoundKey[] = Object.keys(SOURCES) as SoundKey[]): void {
	ensureAudioMode();
	for (const key of keys) getPlayer(key);
}

/** Fire a one-shot cue. No-ops when muted or when audio is unavailable. */
export function play(key: SoundKey, opts?: { volume?: number }): void {
	if (muted) return;
	ensureAudioMode();
	const p = getPlayer(key);
	if (!p) return;
	try {
		p.volume = opts?.volume ?? VOLUME[key];
		void p.seekTo(0);
		p.play();
	} catch {}
}

let fadeTimer: ReturnType<typeof setInterval> | null = null;

function clearFade(): void {
	if (fadeTimer) {
		clearInterval(fadeTimer);
		fadeTimer = null;
	}
}

/** Ramp the ambience bed's volume to `target` over `ms` (JS fade — expo-audio
 *  has no native fade). Stops the loop when it reaches zero. */
function fadeAmbience(target: number, ms: number, stopAtEnd = false): void {
	const p = getPlayer("ambience");
	if (!p) return;
	clearFade();
	const steps = Math.max(1, Math.round(ms / 60));
	let start = 0;
	try {
		start = p.volume ?? 0;
	} catch {}
	let step = 0;
	fadeTimer = setInterval(() => {
		step += 1;
		const t = step / steps;
		const v = start + (target - start) * t;
		try {
			p.volume = Math.max(0, Math.min(1, v));
		} catch {}
		if (step >= steps) {
			clearFade();
			if (stopAtEnd) {
				try {
					p.pause();
				} catch {}
			}
		}
	}, 60);
}

/** Start the bog ambience loop, fading up from silence. */
export function startAmbience(fadeMs = 900): void {
	if (muted) return;
	ensureAudioMode();
	const p = getPlayer("ambience");
	if (!p) return;
	try {
		p.volume = 0;
		void p.seekTo(0);
		p.play();
	} catch {}
	fadeAmbience(VOLUME.ambience, fadeMs);
}

/** Fade the ambience out and pause it. */
export function stopAmbience(fadeMs = 700): void {
	fadeAmbience(0, fadeMs, true);
}

/** Release every player (call when the game unmounts for good). */
export function teardown(): void {
	clearFade();
	for (const p of players.values()) {
		try {
			p.remove();
		} catch {}
	}
	players.clear();
}
