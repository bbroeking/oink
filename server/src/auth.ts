// Who is on the other end of a socket. The app sends its Supabase access
// token as the first frame; this module turns it into a user id.
//
// Supabase mode branches on the token's `alg` header, so the same code works
// before and after the project migrates to asymmetric signing keys
// (docs/multiplayer/research/platform-notes.md §2.1):
//   ES256 / RS256 → verify locally against the project's JWKS;
//   HS256 + SUPABASE_JWT_SECRET → verify locally with the legacy secret.
//     This is the primary production path today: the project still signs
//     with the legacy secret (its JWKS is empty) and it needs no network;
//   anything else → ask Auth (GET /auth/v1/user). Fallback only: that route
//     may be rate limited per IP, and Render egresses from one IP.
//     VERIFY: whether hosted Supabase limits GET /auth/v1/user (documented at
//     30 per 5 min per IP; GoTrue's source only wraps PUT). Verdicts are
//     cached until the token expires either way.
// Every path checks iss, aud, role, sub and exp, and verified tokens are
// cached (by hash) until they expire, so a reconnect costs nothing.
//
// Dev mode accepts `dev:<userId>[:<name>]` and is refused in production.

import { createHash } from "node:crypto";
import { createRemoteJWKSet, decodeJwt, decodeProtectedHeader, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { Clock } from "./clock";
import { systemClock } from "./clock";
import type { Logger } from "./log";
import { silentLogger } from "./log";

export interface VerifiedUser {
	userId: string;
	/** Dev tokens may carry a display name for pigs the store has never seen. */
	name?: string;
	/** Epoch ms the token stops being valid (null: never, dev tokens). */
	expiresAt: number | null;
}

/** The token is not acceptable: close 4003. */
export class AuthError extends Error {}
/** Auth could not be checked right now (Auth down, rate limited): close
 *  with a retry code rather than telling the app its session is bad. */
export class AuthUnavailableError extends Error {}

export interface TokenVerifier {
	verify(token: string): Promise<VerifiedUser>;
}

const DEV_TOKEN_RE = /^dev:([A-Za-z0-9_-]{1,64})(?::(.{1,64}))?$/;
const SUB_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK_TOLERANCE_S = 30;
const CACHE_LIMIT = 10_000;

export function devVerifier(): TokenVerifier {
	return {
		async verify(token) {
			const match = DEV_TOKEN_RE.exec(token);
			if (!match) throw new AuthError("dev tokens look like dev:<userId>[:<name>]");
			let name: string | undefined;
			if (match[2]) {
				try {
					name = decodeURIComponent(match[2]).slice(0, 24);
				} catch {
					name = match[2].slice(0, 24);
				}
			}
			return { userId: match[1], name, expiresAt: null };
		},
	};
}

export interface SupabaseVerifierOptions {
	supabaseUrl: string;
	/** Legacy HS256 secret (SUPABASE_JWT_SECRET). */
	jwtSecret?: string | null;
	/** apikey header for GET /auth/v1/user. */
	apiKey?: string | null;
	fetch?: typeof fetch;
	clock?: Clock;
	log?: Logger;
	/** Override the JWKS key source (defaults to the project's remote JWKS). */
	jwks?: JWTVerifyGetKey;
}

export function supabaseVerifier(opts: SupabaseVerifierOptions): TokenVerifier {
	const base = opts.supabaseUrl.replace(/\/+$/, "");
	const issuer = `${base}/auth/v1`;
	const clock = opts.clock ?? systemClock;
	const log = opts.log ?? silentLogger;
	const fetchImpl = opts.fetch ?? fetch;
	const secret = opts.jwtSecret ? new TextEncoder().encode(opts.jwtSecret) : null;
	let jwks: JWTVerifyGetKey | null = opts.jwks ?? null;
	const cache = new Map<string, VerifiedUser>();

	const keyOf = (token: string) => createHash("sha256").update(token).digest("hex");

	function remember(key: string, user: VerifiedUser): VerifiedUser {
		if (cache.size >= CACHE_LIMIT) {
			const now = clock.now();
			for (const [k, v] of cache) if (v.expiresAt !== null && v.expiresAt <= now) cache.delete(k);
			if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
		}
		cache.set(key, user);
		return user;
	}

	function fromClaims(payload: JWTPayload): VerifiedUser {
		const claims = payload as JWTPayload & { role?: unknown; is_anonymous?: unknown };
		if (claims.role !== "authenticated") throw new AuthError("token role is not authenticated");
		if (claims.is_anonymous === true) throw new AuthError("anonymous sessions cannot play");
		if (typeof claims.sub !== "string" || !SUB_RE.test(claims.sub)) throw new AuthError("token sub is not a user id");
		if (typeof claims.exp !== "number") throw new AuthError("token has no expiry");
		return { userId: claims.sub, expiresAt: claims.exp * 1000 };
	}

	async function verifyLocally(token: string, key: Uint8Array | JWTVerifyGetKey, algorithms: string[]): Promise<VerifiedUser> {
		try {
			const options = {
				issuer,
				audience: "authenticated",
				algorithms,
				requiredClaims: ["sub", "exp"],
				clockTolerance: CLOCK_TOLERANCE_S,
				currentDate: new Date(clock.now()),
			};
			const { payload } =
				key instanceof Uint8Array ? await jwtVerify(token, key, options) : await jwtVerify(token, key, options);
			return fromClaims(payload);
		} catch (err) {
			if (err instanceof AuthError) throw err;
			const code = (err as { code?: unknown }).code;
			// Not a jose verdict (a network failure fetching the JWKS), or a
			// JWKS that timed out or answered badly: Auth is unreachable, the
			// token may be fine.
			if (typeof code !== "string" || !code.startsWith("ERR_")) throw new AuthUnavailableError((err as Error).message);
			if (code === "ERR_JWKS_TIMEOUT" || code === "ERR_JOSE_GENERIC") throw new AuthUnavailableError(code);
			throw new AuthError(code);
		}
	}

	async function verifyWithAuthServer(token: string): Promise<VerifiedUser> {
		const apiKey = opts.apiKey;
		if (!apiKey) throw new AuthUnavailableError("no apikey for /auth/v1/user");
		let res: Response;
		try {
			res = await fetchImpl(`${issuer}/user`, {
				headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
			});
		} catch (err) {
			throw new AuthUnavailableError((err as Error).message);
		}
		if (res.status === 401 || res.status === 403) throw new AuthError(`auth server said ${res.status}`);
		if (!res.ok) throw new AuthUnavailableError(`auth server said ${res.status}`);
		const user = (await res.json()) as { id?: unknown; aud?: unknown; role?: unknown; is_anonymous?: unknown };
		if (user.aud !== "authenticated" || (user.role !== undefined && user.role !== "authenticated")) {
			throw new AuthError("user is not an authenticated pig");
		}
		if (user.is_anonymous === true) throw new AuthError("anonymous sessions cannot play");
		if (typeof user.id !== "string" || !SUB_RE.test(user.id)) throw new AuthError("auth server returned no user id");
		// Auth vouched for the token; its own exp says how long to trust that.
		let expiresAt = clock.now() + 5 * 60_000;
		try {
			const exp = decodeJwt(token).exp;
			if (typeof exp === "number") expiresAt = exp * 1000;
		} catch {
			// An opaque token Auth accepted: keep the short default.
		}
		return { userId: user.id, expiresAt };
	}

	return {
		async verify(token) {
			const key = keyOf(token);
			const cached = cache.get(key);
			if (cached && (cached.expiresAt === null || cached.expiresAt > clock.now())) return cached;
			if (cached) cache.delete(key);

			let alg: string | undefined;
			try {
				alg = decodeProtectedHeader(token).alg;
			} catch {
				throw new AuthError("token is not a JWT");
			}
			let user: VerifiedUser;
			if (alg === "ES256" || alg === "RS256") {
				jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
				user = await verifyLocally(token, jwks, ["ES256", "RS256"]);
			} else if (alg === "HS256" && secret) {
				user = await verifyLocally(token, secret, ["HS256"]);
			} else {
				log.debug("verifying a token with the auth server", { alg });
				user = await verifyWithAuthServer(token);
			}
			return remember(key, user);
		},
	};
}
