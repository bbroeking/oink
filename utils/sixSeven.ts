/**
 * The 6–7 celebration is an exact tickle-total landing, repeated every 1,000.
 *
 * Examples: 67, 1,067, 2,067. A total that jumps across one of those values
 * does not qualify; callers must pass the actual landed total.
 */
export function isSixSevenTickleMilestone(tickles: number): boolean {
	return (
		Number.isSafeInteger(tickles) &&
		tickles >= 67 &&
		(tickles - 67) % 1_000 === 0
	);
}
