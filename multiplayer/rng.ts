// Seeded randomness for matchmade games. Deterministic across Hermes, V8 and
// Node: integer-only hashing (Math.imul + unsigned shifts) and a sfc32
// generator, so a seed replays the same dice on the server, in tests and in
// Practice. Never use Math.random inside a game module.

import type { Rng } from "./types";

/** cyrb128: hashes a string into four 32-bit seeds. */
function cyrb128(input: string): [number, number, number, number] {
	let h1 = 1779033703;
	let h2 = 3144134277;
	let h3 = 1013904242;
	let h4 = 2773480762;
	for (let i = 0; i < input.length; i++) {
		const k = input.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	h1 ^= h2 ^ h3 ^ h4;
	h2 ^= h1;
	h3 ^= h1;
	h4 ^= h1;
	return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32: small fast counter generator, 128-bit state, passes PractRand. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
	return () => {
		a >>>= 0;
		b >>>= 0;
		c >>>= 0;
		d >>>= 0;
		let t = (a + b) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		d = (d + 1) | 0;
		t = (t + d) | 0;
		c = (c + t) | 0;
		return (t >>> 0) / 4294967296;
	};
}

/** A deterministic Rng for `seed`. Equal seeds give equal sequences. */
export function createRng(seed: string): Rng {
	const [a, b, c, d] = cyrb128(seed);
	const next = sfc32(a, b, c, d);
	// Discard the first outputs: sfc32 mixes its state over a few rounds.
	for (let i = 0; i < 12; i++) next();

	const int = (maxExclusive: number): number => {
		if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
			throw new RangeError(`rng.int needs a positive integer, got ${maxExclusive}`);
		}
		return Math.floor(next() * maxExclusive);
	};

	return {
		next,
		int,
		range: (min, max) => min + int(max - min + 1),
		pick: (items) => {
			if (items.length === 0) throw new RangeError("rng.pick on an empty list");
			return items[int(items.length)];
		},
		shuffle: (items) => {
			const out = items.slice();
			for (let i = out.length - 1; i > 0; i--) {
				const j = int(i + 1);
				const tmp = out[i];
				out[i] = out[j];
				out[j] = tmp;
			}
			return out;
		},
		chance: (p) => next() < p,
	};
}

/** The Rng a room hands a game for one step: derived from the room's secret
 *  seed and the revision being produced, so replays are exact and no rng
 *  state lives inside game state. */
export function stepRng(seed: string, rev: number, salt = ""): Rng {
	return createRng(`${seed}:${rev}:${salt}`);
}

const SEED_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A fresh room seed from a caller-supplied entropy source (the server passes
 *  crypto.randomInt; tests pass a seeded Rng). 24 chars ≈ 124 bits. */
export function makeSeed(randomInt: (maxExclusive: number) => number, length = 24): string {
	let out = "";
	for (let i = 0; i < length; i++) out += SEED_ALPHABET[randomInt(SEED_ALPHABET.length)];
	return out;
}
