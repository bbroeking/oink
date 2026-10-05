// JSON-lines logging for Render's log stream: one object per line, so the
// dashboard search (and any log drain) can filter on fields instead of
// grepping prose. Credentials never reach a line: callers log ids, never
// tokens, and `redact` blanks any field whose name looks like a secret as a
// second fence (a push token, a room seed, an Authorization header).

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type LogFields = Record<string, unknown>;

export interface Logger {
	debug(msg: string, fields?: LogFields): void;
	info(msg: string, fields?: LogFields): void;
	warn(msg: string, fields?: LogFields): void;
	error(msg: string, fields?: LogFields): void;
	child(fields: LogFields): Logger;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SECRET_FIELD = /token|secret|password|authorization|apikey|api_key|jwt|seed|cookie/i;

export interface LoggerOptions {
	level?: LogLevel;
	/** Where lines go. Defaults to stdout (info, debug) and stderr (warn, error). */
	sink?: (line: string, level: Exclude<LogLevel, "silent">) => void;
	base?: LogFields;
}

function defaultSink(line: string, level: Exclude<LogLevel, "silent">): void {
	(level === "warn" || level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

function serialise(value: unknown, depth = 0): unknown {
	if (value instanceof Error) {
		return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 6).join("\n") };
	}
	if (depth > 4 || value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.slice(0, 50).map((v) => serialise(v, depth + 1));
	const out: LogFields = {};
	for (const [key, v] of Object.entries(value as LogFields)) {
		out[key] = SECRET_FIELD.test(key) ? "[redacted]" : serialise(v, depth + 1);
	}
	return out;
}

export function createLogger(opts: LoggerOptions = {}): Logger {
	const threshold = ORDER[opts.level ?? "info"];
	const sink = opts.sink ?? defaultSink;
	const base = opts.base ?? {};
	const write = (level: Exclude<LogLevel, "silent">, msg: string, fields?: LogFields) => {
		if (ORDER[level] < threshold) return;
		const body = serialise({ ...base, ...fields }) as LogFields;
		sink(JSON.stringify({ t: new Date().toISOString(), level, msg, ...body }), level);
	};
	return {
		debug: (msg, fields) => write("debug", msg, fields),
		info: (msg, fields) => write("info", msg, fields),
		warn: (msg, fields) => write("warn", msg, fields),
		error: (msg, fields) => write("error", msg, fields),
		child: (fields) => createLogger({ level: opts.level, sink, base: { ...base, ...fields } }),
	};
}

/** A logger that drops everything: the default inside tests. */
export const silentLogger: Logger = createLogger({ level: "silent" });

/** The last few characters of a device or push token: enough to correlate
 *  two log lines, never enough to address the device. */
export function tail(value: string | null | undefined, keep = 6): string {
	if (!value) return "";
	return value.length <= keep ? "…" : `…${value.slice(-keep - 1, -1)}`;
}
