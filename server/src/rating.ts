// The hidden rating (play_ratings): Elo from 1000 with K 24, competitive
// two-seat tables only. Nobody ever sees it; it only nudges the matchmaker
// toward a closer partner when several pigs are waiting.

export const RATING_START = 1000;
export const RATING_K = 24;

/** New ratings for a and b after a table. `scoreA` is 1 (a won), 0.5 (draw)
 *  or 0 (b won). Rounded, because the column is an int. */
export function eloPair(a: number, b: number, scoreA: number, k = RATING_K): [number, number] {
	const expectedA = 1 / (1 + 10 ** ((b - a) / 400));
	const nextA = Math.round(a + k * (scoreA - expectedA));
	const nextB = Math.round(b + k * (1 - scoreA - (1 - expectedA)));
	return [nextA, nextB];
}
