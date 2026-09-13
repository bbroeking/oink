const COMPACT_UNITS = [
	{ value: 1_000_000_000_000, suffix: "T" },
	{ value: 1_000_000_000, suffix: "B" },
	{ value: 1_000_000, suffix: "M" },
] as const;

/**
 * The Barn tickets are intentionally compact. Preserve the exact localized
 * total through six digits, then use a deterministic abbreviation from 1M.
 * The Me surfaces continue to render the unabridged lifetime value.
 */
export function formatBarnTickleTotal(
	total: number,
	locale?: Intl.LocalesArgument,
): string {
	const wholeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
	if (wholeTotal < 1_000_000) return wholeTotal.toLocaleString(locale);

	const unit =
		COMPACT_UNITS.find(({ value }) => wholeTotal >= value) ??
		COMPACT_UNITS[COMPACT_UNITS.length - 1];
	const scaled = wholeTotal / unit.value;
	const precision = scaled < 10 ? 1 : 0;
	const compact = scaled.toLocaleString(locale, {
		minimumFractionDigits: 0,
		maximumFractionDigits: precision,
	});
	return `${compact}${unit.suffix}`;
}

/**
 * Keep the ticket deterministic on Android as well as iOS; the repository's
 * layout contract deliberately forbids platform-only shrink-to-fit text.
 */
export function barnTickleTicketFontSize(formattedTotal: string): number {
	if (formattedTotal.length >= 7) return 20;
	if (formattedTotal.length === 6) return 24;
	return 30;
}
