const DAY_MS = 24 * 60 * 60 * 1000;

function localCalendarDayIndex(date) {
	return Math.round(Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	) / DAY_MS);
}

export function formatAdventureReturnPromise(
	readyAt,
	{ now = Date.now(), locale } = {},
) {
	if (!Number.isFinite(readyAt) || !Number.isFinite(now) || readyAt <= now) {
		return null;
	}

	const returnDate = new Date(readyAt);
	const currentDate = new Date(now);
	if (
		Number.isNaN(returnDate.getTime()) ||
		Number.isNaN(currentDate.getTime())
	) return null;

	const time = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
	}).format(returnDate);
	const dayDifference =
		localCalendarDayIndex(returnDate) - localCalendarDayIndex(currentDate);

	if (dayDifference === 0) {
		return {
			display: `Around ${time}`,
			ariaLabel: `Rosie is expected Home around ${time}`,
		};
	}

	if (dayDifference === 1) {
		return {
			display: `Tomorrow · ${time}`,
			ariaLabel: `Rosie is expected Home tomorrow around ${time}`,
		};
	}

	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(returnDate);
	const spokenWeekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(returnDate);
	return {
		display: `${weekday} · ${time}`,
		ariaLabel: `Rosie is expected Home ${spokenWeekday} around ${time}`,
	};
}
