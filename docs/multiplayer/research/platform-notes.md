# Multiplayer platform notes (Render, Supabase, Expo push, universal links, RN WebSocket)

Researched 2026-10-04 against primary sources, for the authoritative Node 24 WebSocket game server on Render. Each claim carries a source tag:

- **(doc)**: stated in the linked primary doc
- **(src)**: read in source code at the pinned version (RN 0.86.2, expo-router 57.0.12, GoTrue `master`)
- **(live)**: observed by probing the real endpoint on 2026-10-04
- **(inferred)** or **UNVERIFIED**: my reading, not confirmed. The full list is in [section 8](#8-could-not-verify).

Headline findings:

1. **The Supabase project still signs tokens with the legacy HS256 secret.** The JWKS endpoint returns `{"keys":[]}` (live). So JWKS verification isn't possible today. See [section 2.1](#21-verifying-a-user-access-token).
2. **A Render `rootDir` hides the rest of the repo at build time *and* at runtime** (doc). Sharing `../multiplayer/` therefore means no `rootDir`: use a repo-root build with `buildFilter` and `cd server && …`.
3. **The repo-root `.nvmrc` says `22`.** On a repo-root Render build it beats `engines`, so Node 24 needs `NODE_VERSION` set as an env var.
4. **Every deploy splits live rooms.** Render sends the old instance `SIGTERM` 60 s after traffic moves, and `SIGKILL` at most `maxShutdownDelaySeconds` (max 300) after that. All new connections, every reconnect included, go to the new instance, and there are no sticky sessions.

---

## 1. Render

### 1.1 WebSockets: timeouts, keepalive, duration

| Question | Answer | Source |
|---|---|---|
| Max connection duration | None. "Render does not enforce a maximum duration for WebSocket connections." A connection stays open until its instance shuts down. | (doc) [Render: WebSockets, Maintaining connections and FAQ](https://render.com/docs/websocket#maintaining-connections) |
| Idle timeout | **Render documents none.** It still says client and server "should periodically send each other keepalive messages", with no interval given. Render's own samples ping every **30 s** and drop the connection after **10 s** without a pong. | (doc) [Render: WebSockets](https://render.com/docs/websocket#maintaining-connections) |
| Path in front of Render | All inbound traffic passes through Cloudflare. Cloudflare "will close a WebSocket connection when no data is transmitted in either direction for a period of time" (duration not published). It also restarts servers on code releases, which "terminates WebSockets connections". | (doc) [Render: DDoS article](https://render.com/articles/how-render-handles-ddos-attacks), [Cloudflare: WebSockets](https://developers.cloudflare.com/network/websockets/) |
| Interruptions to expect | Instance shutdowns, network issues and platform maintenance. Clients must reconnect with exponential backoff. | (doc) [Render: WebSockets, Client-side reconnects](https://render.com/docs/websocket#client-side-reconnects) |
| `ws://` vs `wss://` | Always use `wss://` publicly. A plain `ws://` handshake gets a **301** redirect to TLS, and most clients fail on it. | (doc) [Render: WebSockets](https://render.com/docs/websocket#connecting-from-clients) |
| Port | All public traffic, WebSockets included, goes to one port (`PORT`, default `10000`). Bind to `0.0.0.0`. TLS is terminated at Render's load balancer, so the app speaks plain HTTP and WS. | (doc) [Render: Web services, Port binding](https://render.com/docs/web-services#port-binding), [Render: WebSockets FAQ](https://render.com/docs/websocket#faq) |
| Connection count limit | None. You're bounded by CPU and RAM. | (doc) [Render: WebSockets FAQ](https://render.com/docs/websocket#faq) |
| Bandwidth | Outbound WS messages count toward outbound bandwidth: 5 GB included on Hobby, 25 GB on Pro, then $0.15/GB. Inbound messages don't count. | (doc) [Render: WebSockets FAQ](https://render.com/docs/websocket#faq), [Render pricing](https://render.com/pricing) |
| Real client IP | Read `CF-Connecting-IP`. Cloudflare overwrites it on every request. `X-Forwarded-For` is *appended to* and can be spoofed. | (doc) [Render: PocketBase article](https://render.com/articles/host-pocketbase-on-render) |

### 1.2 Deploys, shutdown signal and grace period

The zero-downtime sequence for web services, all (doc) from [Render: Deploys, Zero-downtime deploys](https://render.com/docs/deploys#zero-downtime-deploys):

1. The build runs. If it fails, the old instance keeps running untouched.
2. A new instance starts. **The old instance keeps receiving all incoming traffic** while the new one spins up.
3. Once the new instance is healthy, Render switches all *incoming* traffic to it. All new instances must pass health checks within 15 min, or the deploy is cancelled ([Health checks](https://render.com/docs/health-checks)).
4. **"After 60 seconds, Render sends a `SIGTERM` signal to your app's process on the original instance."**
5. If the process hasn't exited within its **shutdown delay** (default **30 s**), Render sends `SIGKILL`.
6. With multiple instances, steps 2–5 run **one instance at a time**. If any new instance fails, the whole deploy is reverted.

- **Shutdown delay setting:** `maxShutdownDelaySeconds`, an integer from **1 to 300** with a default of 30. Set it in `render.yaml` or through the API's Update service call. The docs list no dashboard control for it. For more than 300 s, contact support. (doc) [Deploys, Setting a shutdown delay](https://render.com/docs/deploys#setting-a-shutdown-delay), [Blueprint spec: maxShutdownDelaySeconds](https://render.com/docs/blueprint-spec#maxshutdowndelayseconds)
- **Same signal flow during platform maintenance.** Render swaps instances for maintenance with `SIGTERM` too. Paid services get advance notice of any *downtime* windows. (doc) [Render: WebSockets, Handling instance shutdown](https://render.com/docs/websocket#handling-instance-shutdown), [Platform maintenance](https://render.com/docs/platform-maintenance)
- **A persistent disk disables zero-downtime deploys and scaling.** Don't attach one. (doc) [Deploys](https://render.com/docs/deploys#zero-downtime-deploys)
- **(inferred, UNVERIFIED)** Sockets already established on the old instance probably stay up through the 60 s window and the shutdown delay. In that case the old process lives for at most 60 + 300 s after cutover. Any *re*connect during that time reaches the new instance, which has none of the old instance's in-memory rooms. Confirm with one test deploy.

### 1.3 `render.yaml` (Blueprint) for a Node web service

All (doc) from the [Blueprint YAML reference](https://render.com/docs/blueprint-spec).

| Field | Current spec |
|---|---|
| `type` | `web`. Other values: `pserv`, `worker`, `cron`, `keyvalue` (with `redis` as a deprecated alias), `workflow`. It can't be changed after creation. |
| `runtime` | `node`. **"This field replaces the deprecated `env` field."** |
| `plan` | New compute-plan IDs, renamed on 2026-08-26. **Legacy names still work everywhere, at the same specs and price.** See the plan table below. |
| `region` | `oregon` (the default), `ohio`, `virginia`, `frankfurt`, `singapore`. **It can't be changed after creation.** |
| `buildCommand` / `startCommand` | Required for native runtimes. Both run relative to `rootDir`, or the repo root when `rootDir` is unset. |
| `healthCheckPath` | Web services only. Must start with `/`. A check passes on a 2xx/3xx answer **within 5 s**. Failing for 15 s takes the instance out of rotation, and failing for 60 s restarts it ([Health checks](https://render.com/docs/health-checks)). |
| `envVars` | Supports `value`, `generateValue: true` (a random base64 256-bit value), `sync: false` (prompts in the dashboard), `fromService`, `fromDatabase` and `fromGroup`. **`sync: false` is prompted only during the *initial* Blueprint creation.** Later additions are ignored, so set them by hand. Blueprints don't support variable interpolation. ([Prompting for secret values](https://render.com/docs/blueprint-spec#prompting-for-secret-values)) |
| `autoDeployTrigger` | `commit` (the default), `checksPass` or `off`. It **replaces the deprecated `autoDeploy`**, and wins when both are set. Quote `'off'`, as Render's own example does. |
| `buildFilter` | `paths` and `ignoredPaths`, in glob syntax. **Paths are always relative to the repo root, even when `rootDir` is set.** Ignored paths win over included paths. A sync *replaces* the whole filter. Changes to `render.yaml` are always processed. ([Monorepo support](https://render.com/docs/monorepo-support#setting-build-filters)) |
| `rootDir` | **"Files outside your service's root directory are not available to the service at build time or at runtime."** ([Monorepo support](https://render.com/docs/monorepo-support#setting-a-root-directory)) |
| `numInstances` / `scaling` | Manual scaling is available on every workspace. Autoscaling (`minInstances`, `maxInstances`, `targetCPUPercent`, `targetMemoryPercent`) needs a **Pro** workspace or higher ([Scaling](https://render.com/docs/scaling)). |
| `domains` | Custom domains. A root domain gets an automatic `www` redirect. A plain subdomain such as `play.` doesn't. |
| `renderSubdomainPolicy` | `enabled` (the default) or `disabled`. Disabling needs a custom domain. |
| `previews` | Omit it, and pull-request previews stay off. |

**Compute plans (web services).** Specs come from [Compute plans](https://render.com/docs/compute-plans) and the [plan rename notice](https://render.com/docs/compute-plans-update). Prices come from [Render pricing](https://render.com/pricing).

| Plan ID | Legacy name | CPU / RAM | Price |
|---|---|---|---|
| `free` | (none) | 0.1 / 512 MB | $0, **spins down** |
| `0.5c-512mb` | `starter` | 0.5 / 512 MB | $7/mo |
| `1c-2g` | `standard` | 1 / 2 GB | $25/mo |
| `2c-4g` | `pro` | 2 / 4 GB | $85/mo |
| `4c-8g` | `pro_plus` | 4 / 8 GB | $175/mo |

Compute is billed per second, separately from the workspace tier: Hobby is $0, Pro $25/mo and Scale $499/mo, each plus compute ([pricing](https://render.com/pricing)). If the plan field is omitted, a new web service gets `0.5c-512mb`.

**Region:** both `virginia` and `ohio` are US-East. **This Supabase project is in AWS `us-east-2` (Ohio).** The evidence is the local CLI cache file `supabase/.temp/pooler-url`, which points at `aws-0-us-east-2.pooler.supabase.com`. That makes **`ohio`** the region co-located with the database and Auth. Render doesn't document the physical facility behind each region (UNVERIFIED).

**Monorepo verdict.** A `rootDir: server` setup can't read `../multiplayer/`, so use **no `rootDir`**. Give the build commands a `cd server && …` prefix, which is Render's own documented no-root-dir pattern, and scope auto-deploys with `buildFilter.paths` ([Monorepo support, Root-relative settings](https://render.com/docs/monorepo-support#root-relative-settings)). Two consequences:

- **Node version.** Render resolves it from, in order of precedence: the `NODE_VERSION` env var, then repo-root `.node-version`, then repo-root `.nvmrc`, then `engines` ([Node version](https://render.com/docs/node-version)). This repo's root `.nvmrc` is `22`, so set `NODE_VERSION`. The current default for new services is `24.21.0`.
- **Bundling.** Node 24 strips types natively, and that support is stable since v24.12. But it **requires explicit file extensions in imports** and ignores `tsconfig` ([Node 24: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html)). The shared `multiplayer/*.ts` files use extensionless imports such as `./types`, and they're dependency-free (src: repo). Bundle the server with esbuild or a similar tool at build time. Keep `multiplayer/` free of npm imports, because the repo-root `node_modules` is never installed on Render.

Illustrative skeleton (not committed):

```yaml
services:
  - type: web
    name: ttp-play
    runtime: node
    plan: 0.5c-512mb            # legacy "starter"; bump to 1c-2g if CPU-bound
    region: ohio                # immutable
    branch: main
    buildCommand: cd server && npm ci && npm run build   # esbuild pulls in ../multiplayer
    startCommand: cd server && node dist/index.js
    healthCheckPath: /healthz
    maxShutdownDelaySeconds: 300
    autoDeployTrigger: 'off'
    buildFilter:
      paths: [server/**, multiplayer/**]
    numInstances: 1
    domains: [play.ticklethepig.com]
    envVars:
      - { key: NODE_VERSION, value: "24" }
      - { key: SUPABASE_URL, value: https://wbcnhvvakptoinwkulmn.supabase.co }
      - { key: SUPABASE_SECRET_KEY, sync: false }
      - { key: SUPABASE_PUBLISHABLE_KEY, sync: false }   # apikey header for the /auth/v1/user path
      - { key: EXPO_ACCESS_TOKEN, sync: false }          # only if push security gets enabled
```

The repo is **public** (`gh repo view`), so nothing secret ever goes in `render.yaml`.

### 1.4 Spin-down, scaling, sticky sessions, shared state

- **Free web services spin down** after 15 min without inbound traffic, counting both HTTP and WS messages. Waking takes about a minute, and Render "might restart a Free web service at any time" (doc) [Free](https://render.com/docs/free#spinning-down-on-idle). **Paid compute plans remove those limits.** But **"Upgrading your workspace plan does *not* remove limitations on Free instances"**: the *service itself* needs a paid plan (doc) [Free](https://render.com/docs/free#upgrading-to-a-paid-instance).
- **There are no sticky sessions.** "Render's load balancer assigns each incoming WebSocket connection to a random instance of your service, regardless of past connection history." (doc) [Render: WebSockets](https://render.com/docs/websocket#client-side-reconnects)
- **Render's recommended pattern** is to save session state to **Render Key Value** with a TTL, so whichever instance a client reconnects to can resume (doc) [Render: WebSockets, Saving session state](https://render.com/docs/websocket#saving-session-state).
  - Key Value runs Valkey 8, is Redis-compatible and uses `redis://` URLs. The internal URL works only from the same region and workspace (doc) [Key Value](https://render.com/docs/key-value). Paid plans start at `256mb` for $10/mo ([pricing](https://render.com/pricing)).
  - Valkey supports pub/sub ([Valkey: Pub/Sub](https://valkey.io/topics/pubsub/)). Using it to relay room traffic between instances is my design inference, not a Render recommendation.
- **Instance addressing for custom routing.** Each instance knows its `RENDER_INSTANCE_ID`, and `RENDER_DISCOVERY_SERVICE` resolves to every instance IP on the private network (doc) [Default env vars](https://render.com/docs/environment-variables), [Private network](https://render.com/docs/private-network). Together they let a room live on one instance while another instance forwards traffic to it.
- **Limits:** paid plans up to `8c-32g` can scale to 100 instances (doc) [Scaling](https://render.com/docs/scaling).

### 1.5 Custom domain and TLS for `wss://`

- Every web service gets `https://<name>.onrender.com`. The exact hostname is exposed as `RENDER_EXTERNAL_HOSTNAME` and kept after a custom domain is added (doc) [Web services](https://render.com/docs/web-services#connecting-from-the-public-internet), [Default env vars](https://render.com/docs/environment-variables).
- **Custom domain:** add it in the dashboard or with `domains:`. For a subdomain, create a **`CNAME` → `<name>.onrender.com`** and remove any `AAAA` records. Then **Verify** in the dashboard, and Render issues and renews TLS automatically through Let's Encrypt or Google Trust Services (doc) [Custom domains](https://render.com/docs/custom-domains), [Configuring DNS](https://render.com/docs/configure-other-dns), [TLS](https://render.com/docs/tls). Custom domains included: 2 on Hobby, 15 on Pro, then $0.25/mo each.
- `ticklethepig.com` DNS is at GoDaddy: `NS ns55/ns56.domaincontrol.com`. `play.ticklethepig.com` doesn't exist yet (live, `dig`).

### 1.6 API, CLI, MCP: who can create what

- **No public API or CLI call creates a *Blueprint*.** The OpenAPI spec exposes only list, `POST /blueprints/validate`, retrieve, `PATCH` (name, `autoSync`, path), disconnect and list syncs (src) [OpenAPI spec](https://api-docs.render.com/openapi/render-public-api-1.json). Blueprint creation is a dashboard step: **New > Blueprint**, Connect the repo, name and branch, an optional Blueprint Path, review, fill in the `sync: false` values, **Deploy Blueprint** (doc) [Blueprints](https://render.com/docs/infrastructure-as-code#setup).
- **With an API key**, auth is `Authorization: Bearer <key>` ([API](https://render.com/docs/api)). An agent can then:
  - create a plain (non-Blueprint) web service with `POST /services`. The fields `rootDir`, `buildFilter`, `autoDeployTrigger`, `serviceDetails.{runtime,plan,region,healthCheckPath,maxShutdownDelaySeconds,envSpecificDetails.{buildCommand,startCommand}}` are all present (src, OpenAPI).
  - do the same through the CLI's `render services create` (non-interactive, with `RENDER_API_KEY`), or the Render MCP server, which creates web services and Key Value but doesn't change scaling (doc) [CLI](https://render.com/docs/cli), [CLI reference](https://render.com/docs/cli-reference), [MCP server](https://render.com/docs/mcp-server).
  - validate the Blueprint with `render blueprints validate render.yaml` (CLI v2.7.0 or later).
- **Auto-deploys need a connected Git provider.** Services built from a public repo URL alone must be deployed manually (doc) [Deploys](https://render.com/docs/deploys#automatic-deploys). So the user connects GitHub to Render once in the dashboard either way.

---

## 2. Supabase

### 2.1 Verifying a user access token

**Two signing systems** (doc) [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys):

- **Legacy JWT secret (HS256):** "No longer recommended."
- **Signing keys:** asymmetric `ES256` (recommended) or `RS256`, or a shared-secret `HS256` key. Asymmetric public keys are published at `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`, which is edge-cached for 10 min.
- **The JWKS is empty without asymmetric keys:** "Be aware that this endpoint does not return any keys if you are not using asymmetric JWT signing keys." Standby asymmetric keys are published too. (doc) [JWTs](https://supabase.com/docs/guides/auth/jwts#verifying-a-jwt-from-supabase)

**This project (live, 2026-10-04):**

- `GET https://wbcnhvvakptoinwkulmn.supabase.co/auth/v1/.well-known/jwks.json` returns `200` with body **`{"keys":[]}`**. **No asymmetric key exists, not even a standby one, so user tokens are HS256-signed with the legacy secret.**
- The app ships a legacy `anon` JWT whose header is `{"alg":"HS256"}` (src: `utils/supabase.ts`).
- The OIDC discovery document gives the issuer as **`https://wbcnhvvakptoinwkulmn.supabase.co/auth/v1`**.

**Supabase's guidance for each case** (doc) [JWTs](https://supabase.com/docs/guides/auth/jwts#verifying-a-jwt-from-supabase):

- **Asymmetric keys:** `jose`, with `createRemoteJWKSet(new URL(jwksUrl))` and `jwtVerify`. Don't cache keys longer than Supabase does: they're edge-cached for 10 min, and the client libraries cache another 10.
- **HS256:** "we recommend always verifying a user access token directly with the Auth server". Send `GET /auth/v1/user` with an `apikey` header (publishable key) and `Authorization: Bearer <JWT>`. A 200 means the token is valid. Call it from the project's region, because Auth isn't globally distributed. Verifying locally with the shared secret is possible, but Supabase "strongly recommend[s] against" it.
- **`supabase.auth.getClaims(jwt)` does both:** it verifies locally against the cached JWKS for asymmetric keys, and for HS256 "always sends a request to the Auth server … similar to `getUser()`" (doc) [getClaims reference](https://supabase.com/docs/reference/javascript/auth-getclaims).

**Rate-limit caveat on the `/auth/v1/user` path.** The rate-limits table puts `/auth/v1/user` in the **30 requests / 5 min per IP** bucket (doc) [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). GoTrue's router wraps only **`PUT /user`** in the limiter; `GET /user` isn't wrapped (src) [supabase/auth `internal/api/api.go`](https://github.com/supabase/auth/blob/master/internal/api/api.go). Whether the hosted platform limits GET some other way is **UNVERIFIED**. If it does, verifying every player from one Render egress IP would hit that cap at once. That's another reason to migrate.

**Migrating to ES256** (doc) [Signing keys, Getting started](https://supabase.com/docs/guides/auth/signing-keys#getting-started):

1. Dashboard: JWT Keys, **Migrate JWT secret**. This imports the legacy secret and creates a *standby* ES256 key.
2. **Rotate keys.** New tokens are signed ES256, and unexpired HS256 tokens stay valid until they expire. Hosted expiry is probably 1 h: local `config.toml` has `jwt_expiry = 3600`, but the hosted value is unchecked.
3. **Do *not* revoke the legacy secret.** Revoking it requires disabling the `anon` and `service_role` keys, and the shipped app authenticates with that `anon` key.

Supabase products (PostgREST, Realtime, Storage, Auth) accept the new keys immediately. Both Edge Functions here run without JWT verification (`admob-reward-callback` has `verify_jwt = false`, and `revenuecat-webhook` deploys with `--no-verify-jwt`), so the warning that rotation breaks "Verify JWT" functions doesn't bite (src: repo). State changes are throttled about 5 min apart.

**Claims to check.** All required claims are always present (doc) [JWT claims reference](https://supabase.com/docs/guides/auth/jwt-fields):

- `iss` equals the issuer above.
- `aud` is `authenticated`.
- `role` is `authenticated`.
- `sub` is the user UUID.
- `exp` is in the future. `jose` checks `exp` and `nbf` itself.
- `is_anonymous` isn't `true`. Anonymous sign-ins are off in `config.toml`, so this is defense in depth.
- Pin `algorithms: ['ES256','RS256']` on the JWKS path.

`createRemoteJWKSet` defaults: a 10 min cache, a 30 s cooldown before refetching on an unknown `kid`, and a 5 s timeout (doc) [jose RemoteJWKSetOptions](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md), [jose JWTVerifyOptions](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md). Current versions: `jose` 6.2.12, `ws` 8.22.0, `@supabase/supabase-js` 2.117.2 (Node ≥22), `expo-server-sdk` 7.2.0 (Node ≥22.12) (live, `npm view`).

Verifier shape that works before *and* after the migration:

```ts
const ISS = "https://wbcnhvvakptoinwkulmn.supabase.co/auth/v1";
const JWKS = createRemoteJWKSet(new URL(`${ISS}/.well-known/jwks.json`));
async function verifyUser(token: string): Promise<string /* sub */> {
  const { alg } = decodeProtectedHeader(token);
  if (alg === "ES256" || alg === "RS256") {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISS, audience: "authenticated", algorithms: ["ES256", "RS256"], requiredClaims: ["sub"] });
    if (payload.role !== "authenticated" || payload.is_anonymous === true) throw new Error("bad role");
    return payload.sub!;
  }
  // legacy HS256: ask Auth (same region as Render ohio)
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("invalid token");
  return (await r.json()).id;
}
```

### 2.2 Service-role access from the server

- **Key types** (doc) [API keys](https://supabase.com/docs/guides/api/api-keys):
  - **Secret key `sb_secret_…`:** elevated access that bypasses RLS through the `service_role` role. Use it only in backends. Supabase returns 401 when the `User-Agent` looks like a browser.
  - **Legacy `service_role`:** a long-lived JWT, `eyJ…`.
  - **Publishable `sb_publishable_…` and legacy `anon`:** the low-privilege pair for shipped clients.
  - New keys aren't JWTs. They travel in the `apikey` header, which supabase-js handles.
- **Legacy keys are going away.** "Supabase is deprecating the `anon` and `service_role` keys by the end of 2026." Supabase's discussion says legacy keys will be deleted in "Late 2026 (TBC)" (doc) [API keys](https://supabase.com/docs/guides/api/api-keys), [discussion #29260](https://github.com/orgs/supabase/discussions/29260). Creating new keys doesn't revoke the legacy ones; both work side by side.
- **supabase-js v2:** pass the key as the second argument, with `createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })` (doc) [Admin API reference](https://supabase.com/docs/reference/javascript/admin-api), [API keys, backend code](https://supabase.com/docs/guides/api/api-keys#use-a-secret-key-in-backend-code). Use one secret key per backend component, never log it, and keep it out of URLs.
- **UNVERIFIED:** whether this project already has `sb_secret_`/`sb_publishable_` keys. `supabase projects api-keys` returned 403 for the CLI's token. Check **Settings > API Keys**.

---

## 3. Expo push from Node

All (doc) from [Send notifications with the Expo Push Service](https://docs.expo.dev/push-notifications/sending-notifications/) unless noted.

| Topic | Fact |
|---|---|
| Endpoints | `POST https://exp.host/--/api/v2/push/send` for messages, `POST …/push/getReceipts` for receipts. The Node SDK `expo-server-sdk` gzips, throttles and retries, with at most 6 concurrent connections. |
| Batch size | Up to **100** messages per request (above that: `PUSH_TOO_MANY_NOTIFICATIONS`). Up to **1000** receipt IDs per request. |
| Rate limit | **600 notifications/s per project** (`TOO_MANY_REQUESTS`). Back off exponentially on 429 and 5xx responses. |
| Receipts | A ticket `ok` only means Expo received the message. Fetch receipts **about 15 min later**; they're deleted after **24 h**. On `DeviceNotRegistered`, stop sending to that token. Payloads max out at **4096 bytes** (`MessageTooBig`). |
| `ttl` / `expiration` | `ttl` is "the number of seconds for which the message may be kept around for redelivery". `expiration` is a Unix timestamp with the same effect, and **`ttl` wins** if both are set. The default is the provider's 4 weeks. On iOS this becomes `apns-expiration`, and **APNs "uses best efforts to honor the expiry date without any guarantee … may deliver after the specified timestamp"** ([Apple: Sending notification requests to APNs](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)). An already-*displayed* notification also stays on screen past expiry. |
| `priority` | `default`, `normal` or `high`. The iOS default is `high` (APNs priority 10). `normal` (APNs priority 5) may be batched or throttled. |
| `channelId` | **Android only.** No effect on iOS. |
| `categoryId` | Maps to the iOS notification category. Buttons appear only if the device has registered that category. See below. |
| `mutableContent` | iOS only, default `false`. It lets a Notification Service Extension rewrite the content. Not needed for invites. |
| `threadId` | iOS visual grouping (`aps.thread-id`). Nothing is replaced. |
| `collapseId` | On iOS it coalesces messages in transit **and replaces an already-displayed notification** (`apns-collapse-id`). That allows a follow-up push such as "invite expired" or "match started" to replace the invite. Apple caps it at **64 bytes** ([APNs headers](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)). |
| Access token | **Not required by default.** The HTTP API "currently does not require any authentication". The opt-in "enhanced push security" is turned on in the EAS dashboard. Once on, every sender must add `Authorization: Bearer <token>`, or pass `new Expo({ accessToken })` to the SDK, or get `UNAUTHORIZED`. The repo's existing sender `public.send_push_to_user` (pg_net) sends no `Authorization` header (src: `supabase/migrations/20260741000000_fix_push_http_post.sql`), so the setting is currently **off** (inferred). Turning it on means updating that SQL function too. |

**Interactive "Play" / "Not now" buttons in SDK 57.** Yes: register at launch with `Notifications.setNotificationCategoryAsync(identifier, actions, options)` (doc) [expo-notifications (SDK 57)](https://docs.expo.dev/versions/latest/sdk/notifications/#setnotificationcategoryasyncidentifier-actions-options).

- Each action is `{ identifier, buttonTitle, options: { opensAppToForeground, isDestructive, isAuthenticationRequired } }`, plus an optional `textInput`.
- **"Don't use the characters : or - in your category identifier."** So use `match_invite`.
- The tapped action arrives as `actionIdentifier` through `addNotificationResponseReceivedListener` or `useLastNotificationResponse`. A plain tap gives `DEFAULT_ACTION_IDENTIFIER`.
- Apple requires categories to be declared at launch, and shows buttons only when the payload carries a matching category ([Apple: Declaring actionable notification types](https://developer.apple.com/documentation/usernotifications/declaring-your-actionable-notification-types)). Old builds without the category just show a plain notification.
- **Caveat:** an action with `opensAppToForeground: false` is handled in the background. Expo documents that a registered background task runs on a notification *action tap* while backgrounded or terminated **only on Android** ([registerTaskAsync](https://docs.expo.dev/versions/latest/sdk/notifications/#registertaskasynctaskname)). So don't count on "Not now" reaching the server on iOS: treat it as a dismissal and let the invite lapse.

Example message for an invite:

```json
{ "to": "ExponentPushToken[…]", "title": "Rosie wants a round", "body": "Tap to join",
  "ttl": 120, "priority": "high", "sound": "default", "categoryId": "match_invite",
  "collapseId": "invite_9f3a…", "threadId": "invites",
  "data": { "url": "ticklethepig://play/ABCD1234", "inviteId": "…", "expiresAt": 1791124000 } }
```

---

## 4. iOS universal links: adding `/play/*`

- **Caching.** Since iOS 14, devices fetch the AASA from **Apple's CDN**, not from the site. "Apple's content delivery network requests the `apple-app-site-association` file for your domain **within 24 hours**. Devices check for updates **approximately once per week** after app installation." (doc) [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- **No forced refresh.** "To download a newer version of the AASA file, reinstall the app. There is no direct CDN invalidation option." (doc) [Apple TN3155: Debugging universal links](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)
- **Existing installs.** They pick up `/play/*` **without an app update**, but only on their roughly weekly check. Expo's guide is more conservative: iOS refetches "when your app is first installed or when updates are installed from the App Store … you will need to issue a full update" to get all users onto new paths (doc) [Expo: iOS Universal Links](https://docs.expo.dev/linking/ios-universal-links/). The `/play/[code]` route needs a new binary anyway, so publish the AASA change **at least 24 h before** that build is released.
- **Live state.** Apple's CDN (`https://app-site-association.cdn-apple.com/a/v1/ticklethepig.com`) serves the current file with `paths: ["/i/*","/r/*","/redeem/*"]` and `Cache-Control: max-age=21600`, which is 6 h and undocumented (live). Vercel serves the origin copy as `application/json` with no redirect. Re-check the CDN URL after deploying to confirm `/play/*` has landed.
- **Testing in developer mode:**
  1. Add `applinks:ticklethepig.com?mode=developer` to a **development-signed** build only. "Only apps that you sign with a development profile can use developer mode" (doc) [Associated Domains entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.associated-domains).
  2. On the device, turn on Developer Mode, then **Settings > Developer > Associated Domains Development**. This bypasses the CDN.
  3. Use **Settings > Developer > Diagnostics** on a URL, or paste the link into Notes and long-press. On a Mac, run `sudo swcutil verify -d ticklethepig.com -j aasa.json -u https://ticklethepig.com/play/X` (doc) [TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links).
- **Same-domain rule.** A universal link to the same domain the browser is already on stays in the browser. So the web fallback page's "Open in app" button must use `ticklethepig://play/<code>` (doc) [TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links). The fallback also needs a Vercel rewrite for `/play/:code` and a page, like the existing `/i/:code*` (src: `landing/vercel.json`).
- **Keep invite links on the apex.** Only `applinks:ticklethepig.com` is in the entitlement (src: `app.json`). `play.ticklethepig.com` would need its own AASA and an entitlement change, which means a new binary. So invite links stay on `https://ticklethepig.com/play/<code>`, and `play.` is just the WS host.

## 5. Expo Router (SDK 57): `/play/<code>` routing

- **No config needed.** "Deep linking is automatically enabled for all of your app's screens", and universal links need no extra configuration (doc) [Expo: Linking overview](https://docs.expo.dev/linking/overview/), [Expo Router: Customizing links](https://docs.expo.dev/router/advanced/native-intent/).
- **Both URL forms map to `app/play/[code].tsx`** with `code=ABCD1234` (src) [expo-router 57 `extractPathFromURL`](https://github.com/expo/expo/blob/sdk-57/packages/expo-router/src/fork/extractPathFromURL.ts):
  - For `https://ticklethepig.com/play/ABCD1234` the origin is stripped, leaving `play/ABCD1234`.
  - For `ticklethepig://play/ABCD1234` the URL's **host plus pathname** gives `play/ABCD1234`.
- **Existing handlers don't collide.** The root `_layout.tsx` Linking handlers match only `/i/`, `/r/` and `/redeem/` (src: `utils/referrals.ts`, `app/_layout.tsx`).
- **Older builds** without the route fall through to `app/+not-found.tsx`.
- **`+native-intent.tsx`** is optional and lives at **`app/+native-intent.tsx`**, the top of the router root. It exports `redirectSystemPath({ path, initial })` and returns the rewritten path, a promise of one, or a fallback route. "While the parameter is called `path` there is no guarantee that this is a path or a valid URL", and it must never throw. It runs on cold start (`initial: true`) and for later URLs. It can't see auth or app state (doc) [Customizing links](https://docs.expo.dev/router/advanced/native-intent/), (src) [expo-router 57 `getLinkingConfig`](https://github.com/expo/expo/blob/sdk-57/packages/expo-router/src/getLinkingConfig.ts). `/play/` doesn't need it.

## 6. React Native 0.86 WebSocket on iOS

- **Handshake headers work.** The constructor is `new WebSocket(url, protocols?, { headers })`. The JS side forwards `{headers}` to native, and iOS adds each one with `addValue:forHTTPHeaderField:` on the SocketRocket `NSURLRequest`. Cookies from the shared cookie store are attached too. The TypeScript types declare the option. (src) [RN 0.86.2 `WebSocket.js`](https://github.com/facebook/react-native/blob/v0.86.2/packages/react-native/Libraries/WebSocket/WebSocket.js), [RN 0.86.2 `RCTWebSocketModule.mm`](https://github.com/facebook/react-native/blob/v0.86.2/packages/react-native/React/CoreModules/RCTWebSocketModule.mm). RN's docs don't mention the option ([RN: Networking](https://reactnative.dev/docs/network#websocket-support)).
- **Pings:**
  - RN exposes a non-standard **`ws.ping()`**, which sends a ping frame, but **no pong event reaches JS**. The native module forwards only open, message, close and failed events. **JS can't measure liveness with protocol pings.**
  - **Server pings *are* answered:** SocketRocket replies to every ping with a pong in native code (src) [SocketRocket `_handlePingWithData`](https://github.com/facebookincubator/SocketRocket/blob/master/SocketRocket/SRWebSocket.m). A server-side `ws.ping()`/`terminate()` heartbeat therefore detects dead or suspended clients.
  - To detect a dead server, the client needs an app-level ping frame and reply.
- **Failure events (src):** a native failure dispatches `error` **and then** `close` with code 1006. Reconnect only from `close` to avoid double-reconnecting.
- **Backgrounding:**
  - `applicationDidEnterBackground` "has five seconds … Shortly after that method returns, the system puts your app into the suspended state" (doc) [Apple: Extending background execution time](https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time).
  - While the app is suspended, a socket's kernel resources "might get reclaimed … after which all networking operations on the socket will fail. The only thing you can do with the socket at this point is to close it". The error is often `EBADF` (doc) [Apple TN2277](https://developer.apple.com/library/archive/technotes/tn2277/_index.html).
  - RN itself closes sockets only on bridge invalidation (src). A suspended app sends no pongs and runs no JS, so the server sees a dead peer within one or two heartbeats.
- **Reconnect on foreground:**
  - Use [AppState](https://reactnative.dev/docs/appstate). React to `background` and `active`, and ignore iOS `inactive`, which fires for Notification Center, incoming calls and similar.
  - On `active`, if `readyState !== OPEN` or no server frame has arrived recently, close the socket and reconnect with **exponential backoff** (doc) [Render: Client-side reconnects](https://render.com/docs/websocket#client-side-reconnects).
  - Fetch a fresh access token with `supabase.auth.getSession()` before re-sending `auth`.
  - Expect to land on a *different* instance when more than one is running.
- **Auth choice:** headers are supported, but keep **first-frame auth** (`{t:"auth", token}`, as in `multiplayer/protocol.ts`). It works with any client (`websocat`, Node tests, a future web client) and keeps the token out of URLs. Never put tokens in the query string. Supabase's handling rules list URLs and query params as places that "are often logged" ([API keys](https://supabase.com/docs/guides/api/api-keys#handling-secret-keys-safely)).

---

## 7. Noticed in passing

- **Legacy-key deprecation affects the whole app, not just multiplayer.** The shipped binary hardcodes the legacy `anon` JWT (`utils/supabase.ts`), and Supabase plans to delete legacy keys in "Late 2026 (TBC)" ([discussion #29260](https://github.com/orgs/supabase/discussions/29260)). A build that uses `sb_publishable_…` should ship well before then, so old binaries have time to age out.
- **Health checks during deploys.** A deploy is gated on *all* new instances passing health checks together, with a 15 min cap ([Health checks](https://render.com/docs/health-checks)). Keep `/healthz` cheap. An event loop blocked for more than 5 s fails the check and pulls the instance from rotation after 15 s.

## 8. Could not verify

1. Exact idle timeout on the Cloudflare and Render path for WebSockets. Neither publishes one; only Render's 30 s sample interval is documented.
2. Whether established sockets on the old instance survive the 60 s post-cutover window, rather than being cut at the network switch. Test with one deploy.
3. Whether hosted Supabase rate-limits `GET /auth/v1/user`. The docs list `/auth/v1/user` at 30/5 min/IP, while the GoTrue source limits only `PUT`.
4. Whether `sb_secret_` and `sb_publishable_` keys already exist (the CLI got a 403), and the hosted JWT expiry (local config says 3600 s).
5. Which physical facility Render's `ohio` region uses. It's assumed close to AWS `us-east-2`.
6. Whether iOS background actions (`opensAppToForeground: false`) reach JS when the app is suspended in memory. Docs guarantee background task handling only on Android.
7. Apple CDN cache lifetime. The docs say "within 24 hours"; the 6 h `max-age` was observed but isn't documented.
8. Whether "enhanced push security" is enabled. It's inferred off.
9. The iOS `interruptionLevel: "time-sensitive"` entitlement requirements. Not researched.

---

## 9. Decisions this implies

1. **Plan:** run the server on a **paid compute plan**: start with `0.5c-512mb` (legacy "starter", $7/mo) and move to `1c-2g` ($25/mo) if CPU-bound. A paid workspace alone doesn't stop Free-plan spin-down.
2. **Region:** **`ohio`**, co-located with Supabase `us-east-2`. It can't be changed later.
3. **Build:** **no `rootDir`**. Use `buildFilter.paths: [server/**, multiplayer/**]`, `buildCommand: cd server && npm ci && npm run build` and `startCommand: cd server && node dist/index.js`. **Bundle with esbuild**, because Node 24 type stripping can't resolve the extensionless imports in `multiplayer/`. Keep `multiplayer/` dependency-free.
4. **Node version:** set the **`NODE_VERSION=24`** env var in `render.yaml`. The root `.nvmrc` pins 22.
5. **Health and shutdown:** `healthCheckPath: /healthz` (answers within 5 s) and **`maxShutdownDelaySeconds: 300`**. On `SIGTERM`: stop matchmaking, tell clients the server is draining, finish or persist rooms, close with a reconnect code, exit 0.
6. **Rooms and deploys:** reconnects during a deploy land on the new instance, so rooms must be **resumable from persisted state** (Key Value or Supabase) or must end cleanly. For v1, use **`autoDeployTrigger: 'off'`** and deploy deliberately (`render deploys create`) when no rooms are live.
7. **Instances:** **`numInstances: 1`**. There are no sticky sessions. Scaling out later needs a room directory keyed by `RENDER_INSTANCE_ID` in Key Value, plus cross-instance forwarding (Key Value pub/sub or the private-network discovery hostname).
8. **Heartbeats:** the server sends a protocol `ping()` **every 25 s** and terminates a socket that misses a pong; iOS answers pings natively. The client sends an **app-level ping every 25 s** while foregrounded and reconnects on silence. Reconnect with exponential backoff plus jitter.
9. **Foreground:** reconnect and resume on AppState `active`, and ignore `inactive`. The server holds a disconnected seat for a grace window before forfeiting it.
10. **Auth:** keep **first-frame auth** with the 5 s deadline. Never put the token in the URL. Use `wss://` only.
11. **Verifier:** the JWKS is empty, so **today's tokens are HS256**. Verify through **`GET /auth/v1/user`** now. **Migrate the project to ES256 signing keys before launch** (Migrate, then Rotate, and never revoke the legacy secret while the app ships the `anon` key). After that, verify locally with **`jose` JWKS + ES256**, checking `iss`, `aud=authenticated`, `role=authenticated`, `sub` and `exp`. Write the verifier to branch on the token's `alg` so it handles both.
12. **DB key:** the server uses an **`sb_secret_…`** key in `SUPABASE_SECRET_KEY` (`sync: false`) with `persistSession: false` and `autoRefreshToken: false`, not the legacy `service_role` JWT. Declare every `sync: false` var in the *first* Blueprint version.
13. **Invite push:** the game server sends it directly through `expo-server-sdk` with:
    - **`ttl` equal to the seconds left on the invite.** Delivery is best-effort, so the app re-checks the invite on tap.
    - `priority: high`, `categoryId: match_invite`, `collapseId: invite_<id>` (64 bytes max), `threadId: invites`.
    - `data.url: ticklethepig://play/<code>`.
    - Batches of 100 or fewer, at most 600/s, receipt checks after about 15 min, and `DeviceNotRegistered` tokens dropped.
14. **Invite actions:** "Play" uses `opensAppToForeground: true`. "Not now" is dismiss-only, with no server call relied on, on iOS.
15. **Universal links:** add **`/play/*`** to the AASA **at least 24 h before** the build with `app/play/[code].tsx` ships, then confirm it on Apple's CDN URL. Test with `?mode=developer` on a dev-signed build. Keep invite links on the **apex** (`ticklethepig.com/play/<code>`). The web fallback's "Open in app" button uses `ticklethepig://`, and it needs a Vercel rewrite.
16. **Routing:** **no `+native-intent.tsx`** is needed; Expo Router maps both URL forms to `app/play/[code].tsx`.
17. **Domain:** add a **`play.ticklethepig.com` CNAME → `<service>.onrender.com`** at GoDaddy, then Verify in Render. TLS is automatic.
18. **Runbook split:** the user connects GitHub to Render and creates the Blueprint (New > Blueprint), which no API can do. An agent with a Render API key can validate `render.yaml`, trigger deploys, and create or update a plain service.
19. **Rate limiting:** key per-IP limits on **`CF-Connecting-IP`**, not `X-Forwarded-For`.
