// Randomness the server owns: room seeds, room ids, invite codes, seat order.
// Injected so a test can pin seat order; production is node:crypto.

import { randomInt, randomUUID } from "node:crypto";

export interface Entropy {
	/** Uniform integer in [0, maxExclusive). */
	int(maxExclusive: number): number;
	/** A v4 UUID (room ids are uuid primary keys in play_matches). */
	uuid(): string;
}

export const cryptoEntropy: Entropy = {
	int: (maxExclusive) => randomInt(maxExclusive),
	uuid: () => randomUUID(),
};
