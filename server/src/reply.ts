// What a request handler answers. The hub turns it into an `ack` (when the
// frame carried a rid) or an `error` frame (when it did not and it failed).

import type { ProtocolErrorCode, ServerMessage } from "../../multiplayer/protocol";

export type HandlerResult = { ok: true; data?: unknown } | { ok: false; error: ProtocolErrorCode; message?: string };

export function ok(data?: unknown): HandlerResult {
	return data === undefined ? { ok: true } : { ok: true, data };
}

export function fail(error: ProtocolErrorCode, message?: string): HandlerResult {
	return message ? { ok: false, error, message } : { ok: false, error };
}

/** How the server reaches a pig: one live socket per pig, keyed by user. */
export interface Presence {
	isOnline(userId: string): boolean;
	send(userId: string, msg: ServerMessage): void;
}
