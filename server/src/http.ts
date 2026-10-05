// Plain HTTP beside the socket: the health check Render polls (it must answer
// within 5 s, so it touches nothing slow), the public invite preview the web
// landing page reads for ticklethepig.com/play/<CODE>, and a hello.

import type { IncomingMessage, ServerResponse } from "node:http";
import { isInviteCode } from "../../multiplayer/protocol";
import type { Clock } from "./clock";
import type { InviteManager } from "./invites";
import type { Logger } from "./log";
import { KeyedLimiter } from "./ratelimit";

export interface HttpDeps {
	clock: Clock;
	log: Logger;
	invites: InviteManager;
	version: string;
	startedAt: number;
	connections: () => number;
	rooms: () => number;
}

/** The caller's address. Render sits behind Cloudflare, which overwrites
 *  CF-Connecting-IP on every request; X-Forwarded-For is appended to and
 *  can be forged, so it is not trusted. */
export function clientIp(req: IncomingMessage): string {
	const cf = req.headers["cf-connecting-ip"];
	const value = Array.isArray(cf) ? cf[0] : cf;
	return value?.trim() || req.socket.remoteAddress || "unknown";
}

export function createHttpHandler(deps: HttpDeps): (req: IncomingMessage, res: ServerResponse) => void {
	// A landing page loads one preview per visit; 20 in a burst, then one
	// every three seconds, is generous for people and useless for guessing.
	const previews = new KeyedLimiter(20, 1 / 3, () => deps.clock.now());

	const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
		const text = typeof body === "string" ? body : JSON.stringify(body);
		res.writeHead(status, {
			"Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json",
			"Cache-Control": "no-store",
			...headers,
		});
		res.end(text);
	};

	return (req, res) => {
		const url = new URL(req.url ?? "/", "http://play.local");
		const path = url.pathname;
		const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

		if (req.method === "OPTIONS" && path.startsWith("/v1/invites/")) {
			res.writeHead(204, { ...cors, "Access-Control-Max-Age": "86400" });
			res.end();
			return;
		}
		if (req.method !== "GET" && req.method !== "HEAD") {
			send(res, 405, "Method not allowed\n", { Allow: "GET" });
			return;
		}
		if (path === "/healthz") {
			send(res, 200, {
				ok: true,
				uptime: Math.round((deps.clock.now() - deps.startedAt) / 1000),
				connections: deps.connections(),
				rooms: deps.rooms(),
				version: deps.version,
			});
			return;
		}
		const invite = /^\/v1\/invites\/([^/]+)\/?$/.exec(path);
		if (invite) {
			if (!previews.take(clientIp(req))) {
				send(res, 429, { error: "rate_limited" }, { ...cors, "Retry-After": "3" });
				return;
			}
			const code = decodeURIComponent(invite[1]).toUpperCase();
			if (!isInviteCode(code)) {
				send(res, 404, { error: "not_found" }, cors);
				return;
			}
			deps.invites
				.publicPreview(code)
				.then((preview) => (preview ? send(res, 200, preview, cors) : send(res, 404, { error: "not_found" }, cors)))
				.catch((err: unknown) => {
					deps.log.error("public invite preview failed", { err });
					send(res, 500, { error: "internal" }, cors);
				});
			return;
		}
		if (path === "/") {
			send(res, 200, "Tickle the Pig play server. Pigs connect at /ws.\n");
			return;
		}
		send(res, 404, "Not found\n");
	};
}
