// Tiny logger that no-ops outside dev. Swap call sites from
// `console.error(...)` / `console.log(...)` to `log.error(...)` / `log.info(...)`
// over time. Keeps prod bundles quiet AND auto-routes errors to Sentry once
// the DSN is configured.
//
// In a production build, Metro replaces `__DEV__` with `false`, so info/warn
// calls optimize to no-ops.

import * as Sentry from "@sentry/react-native";

export const log = {
	info: (...args: unknown[]) => {
		if (__DEV__) console.log(...args);
	},
	warn: (...args: unknown[]) => {
		if (__DEV__) console.warn(...args);
		Sentry.addBreadcrumb({
			level: "warning",
			message: args.map((a) => String(a)).join(" "),
		});
	},
	error: (...args: unknown[]) => {
		// Always log errors — you want to see them in TestFlight too.
		console.error(...args);
		// Forward to Sentry — first arg if Error instance, otherwise message
		const first = args[0];
		if (first instanceof Error) {
			Sentry.captureException(first);
		} else {
			Sentry.captureMessage(args.map((a) => String(a)).join(" "), "error");
		}
	},
};
