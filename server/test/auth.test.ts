// Token verification: dev tokens, the HS256 legacy-secret path (primary in
// production today), the JWKS path (after the ES256 migration) against a
// local JWKS server, and the GET /auth/v1/user fallback with a mocked fetch.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { AuthError, AuthUnavailableError, devVerifier, supabaseVerifier } from "../src/auth";
import { ManualClock } from "../src/clock";
import { localConfig } from "../src/config";
import { silentLogger } from "../src/log";
import { verifierFor } from "../src/server";

const USER = "6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const NOW = 1_800_000_000_000;

async function hs256(claims: Record<string, unknown>, opts: { secret?: string; iss: string; expSec?: number }): Promise<string> {
	return new SignJWT({ role: "authenticated", ...claims })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setSubject(USER)
		.setAudience("authenticated")
		.setIssuer(opts.iss)
		.setIssuedAt(Math.floor(NOW / 1000))
		.setExpirationTime(Math.floor(NOW / 1000) + (opts.expSec ?? 3_600))
		.sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

describe("dev tokens", () => {
	it("accepts dev:<id>[:<name>] and refuses anything else", async () => {
		const v = devVerifier();
		assert.deepEqual(await v.verify("dev:pig-1"), { userId: "pig-1", name: undefined, expiresAt: null });
		assert.equal((await v.verify("dev:pig-2:Rosie%20Pig")).name, "Rosie Pig");
		await assert.rejects(v.verify("pig-1"), AuthError);
		await assert.rejects(v.verify("dev:"), AuthError);
		await assert.rejects(v.verify("dev:has spaces"), AuthError);
	});
});

describe("HS256 with the legacy secret", () => {
	const url = "https://project.supabase.co";
	const iss = `${url}/auth/v1`;
	const clock = new ManualClock(NOW);
	const verifier = supabaseVerifier({ supabaseUrl: url, jwtSecret: SECRET, clock, fetch: () => Promise.reject(new Error("no network")) });

	it("verifies locally, with no network", async () => {
		const user = await verifier.verify(await hs256({}, { iss }));
		assert.equal(user.userId, USER);
		assert.equal(user.expiresAt, NOW + 3_600_000);
	});

	it("refuses a wrong secret, issuer, audience, role, an expired or anonymous token", async () => {
		await assert.rejects(verifier.verify(await hs256({}, { iss, secret: "x".repeat(40) })), AuthError);
		await assert.rejects(verifier.verify(await hs256({}, { iss: "https://elsewhere.supabase.co/auth/v1" })), AuthError);
		await assert.rejects(verifier.verify(await hs256({ role: "anon" }, { iss })), AuthError);
		await assert.rejects(verifier.verify(await hs256({ is_anonymous: true }, { iss })), AuthError);
		await assert.rejects(verifier.verify(await hs256({}, { iss, expSec: -120 })), AuthError);
		const wrongAud = await new SignJWT({ role: "authenticated" })
			.setProtectedHeader({ alg: "HS256" })
			.setSubject(USER)
			.setAudience("anon")
			.setIssuer(iss)
			.setExpirationTime(Math.floor(NOW / 1000) + 600)
			.sign(new TextEncoder().encode(SECRET));
		await assert.rejects(verifier.verify(wrongAud), AuthError);
		await assert.rejects(verifier.verify("not-a-jwt"), AuthError);
	});
});

describe("JWKS (ES256 signing keys)", () => {
	let server: Server;
	let url: string;
	let privateKey: CryptoKey;
	let stranger: CryptoKey;
	let jwksHits = 0;

	before(async () => {
		const pair = await generateKeyPair("ES256", { extractable: true });
		privateKey = pair.privateKey;
		stranger = (await generateKeyPair("ES256")).privateKey;
		const jwk = { ...(await exportJWK(pair.publicKey)), kid: "key-1", alg: "ES256", use: "sig" };
		server = createServer((req, res) => {
			if (req.url === "/auth/v1/.well-known/jwks.json") {
				jwksHits++;
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ keys: [jwk] }));
				return;
			}
			res.writeHead(404);
			res.end();
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});
	after(() => new Promise<void>((resolve) => server.close(() => resolve())));

	const es256 = (key: CryptoKey, iss: string, claims: Record<string, unknown> = {}) =>
		new SignJWT({ role: "authenticated", ...claims })
			.setProtectedHeader({ alg: "ES256", kid: "key-1" })
			.setSubject(USER)
			.setAudience("authenticated")
			.setIssuer(iss)
			.setExpirationTime("1h")
			.sign(key);

	it("verifies against the project's published keys and caches the verdict", async () => {
		const verifier = supabaseVerifier({ supabaseUrl: url });
		const token = await es256(privateKey, `${url}/auth/v1`);
		assert.equal((await verifier.verify(token)).userId, USER);
		const hits = jwksHits;
		assert.equal((await verifier.verify(token)).userId, USER);
		assert.equal(jwksHits, hits, "a cached token costs no JWKS fetch");
	});

	it("refuses a token signed by a key the project never published", async () => {
		const verifier = supabaseVerifier({ supabaseUrl: url });
		await assert.rejects(verifier.verify(await es256(stranger, `${url}/auth/v1`)), AuthError);
		await assert.rejects(verifier.verify(await es256(privateKey, `${url}/auth/v1`, { role: "service_role" })), AuthError);
	});

	it("reports an unreachable JWKS as unavailable, not as a bad token", async () => {
		const verifier = supabaseVerifier({ supabaseUrl: "http://127.0.0.1:1" });
		await assert.rejects(verifier.verify(await es256(privateKey, "http://127.0.0.1:1/auth/v1")), AuthUnavailableError);
	});
});

describe("GET /auth/v1/user fallback", () => {
	const url = "https://project.supabase.co";
	const iss = `${url}/auth/v1`;

	it("asks Auth when there is no local way to verify, once per token", async () => {
		const calls: { url: string; headers: Record<string, string> }[] = [];
		const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(input), headers: init?.headers as Record<string, string> });
			return new Response(JSON.stringify({ id: USER, aud: "authenticated", role: "authenticated" }), { status: 200 });
		}) as typeof fetch;
		const verifier = supabaseVerifier({ supabaseUrl: url, apiKey: "sb_publishable_test", fetch: fetchMock, clock: new ManualClock(NOW) });
		const token = await hs256({}, { iss });
		assert.equal((await verifier.verify(token)).userId, USER);
		assert.equal((await verifier.verify(token)).userId, USER);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, `${iss}/user`);
		assert.equal(calls[0].headers.apikey, "sb_publishable_test");
		assert.equal(calls[0].headers.Authorization, `Bearer ${token}`);
	});

	it("maps 401 to a bad token and 5xx to unavailable", async () => {
		const status = (code: number) =>
			supabaseVerifier({
				supabaseUrl: url,
				apiKey: "k",
				fetch: (async () => new Response("{}", { status: code })) as typeof fetch,
				clock: new ManualClock(NOW),
			});
		const token = await hs256({}, { iss });
		await assert.rejects(status(401).verify(token), AuthError);
		await assert.rejects(status(503).verify(token), AuthUnavailableError);
		const anon = supabaseVerifier({
			supabaseUrl: url,
			apiKey: "k",
			fetch: (async () => new Response(JSON.stringify({ id: USER, aud: "authenticated", is_anonymous: true }))) as typeof fetch,
			clock: new ManualClock(NOW),
		});
		await assert.rejects(anon.verify(token), AuthError);
	});
});

describe("choosing a verifier", () => {
	const url = "https://project.supabase.co";
	const iss = `${url}/auth/v1`;

	it("takes dev and real tokens side by side in dev mode with Supabase configured", async () => {
		const clock = new ManualClock(NOW);
		const config = localConfig({ authMode: "dev", supabaseUrl: url, supabaseJwtSecret: SECRET });
		const verifier = verifierFor(config, clock, silentLogger);
		assert.equal((await verifier.verify("dev:bot-1:BotPig1")).userId, "bot-1");
		assert.equal((await verifier.verify(await hs256({}, { iss }))).userId, USER);
	});

	it("never takes a dev token in supabase mode", async () => {
		const config = localConfig({ authMode: "supabase", supabaseUrl: url, supabaseJwtSecret: SECRET });
		const verifier = verifierFor(config, new ManualClock(NOW), silentLogger);
		await assert.rejects(verifier.verify("dev:bot-1"), AuthError);
	});
});
