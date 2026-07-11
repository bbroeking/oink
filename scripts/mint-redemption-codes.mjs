// DEV admin tool — mint a batch of Golden-Ticket redemption codes.
//
// Run with Node's --env-file so the service-role key is read from .env.local
// (never committed):
//   node --env-file=.env --env-file=.env.local scripts/mint-redemption-codes.mjs \
//     --grant hat:mushroom_cap --count 25 --label "PAX booth 2026"
//
// Flags:
//   --grant   REQUIRED  hat:<hat_id> | truffles:<amount> | snouts:<amount>
//   --label   REQUIRED  admin-facing batch label (every batch is auditable)
//   --count   default 1 number of codes to mint
//   --max-uses default 1 uses per code (1 = single-use print, N = event poster)
//   --expires optional  ISO date (YYYY-MM-DD); omitted = never expires
//   --out     default ./codes-out  directory for the PNGs + manifest.csv
//
// Codes: PIG-XXXX-XXXX, Crockford base32 (no I/L/O/U/0/1). Stored NORMALIZED
// (PIGXXXXXXXX); printed/QR'd with dashes. The QR encodes the universal link
// https://ticklethepig.com/redeem/PIG-XXXX-XXXX so the iOS Camera app opens the
// app directly (associatedDomains already covers ticklethepig.com).
//
// The service-role key bypasses RLS (the redemption_codes table has ZERO client
// policies). It is read from the environment, never hard-coded.
import { serviceClient } from "./serviceClient.mjs";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

// ── CLI parse ────────────────────────────────────────────────────────────────
function flag(name, def = undefined) {
	const i = process.argv.indexOf(`--${name}`);
	return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

const USAGE =
	'Usage: node --env-file=.env --env-file=.env.local scripts/mint-redemption-codes.mjs \\\n' +
	'  --grant hat:mushroom_cap|truffles:50|snouts:100 --label "PAX booth" \\\n' +
	"  [--count 25] [--max-uses 1] [--expires 2026-09-01] [--out ./codes-out]";

const grantArg = flag("grant");
const label = flag("label");
const count = parseInt(flag("count", "1"), 10);
const maxUses = parseInt(flag("max-uses", "1"), 10);
const expiresArg = flag("expires");
const outDir = flag("out", "./codes-out");

function die(msg) {
	console.error(msg);
	console.error(USAGE);
	process.exit(1);
}

if (!grantArg) die("Missing --grant.");
if (!label) die("Missing --label (every batch must be auditable).");
if (!Number.isInteger(count) || count < 1) die("--count must be a positive integer.");
if (!Number.isInteger(maxUses) || maxUses < 1) die("--max-uses must be a positive integer.");

// grant → jsonb
const [gKind, gRest] = grantArg.split(":");
let grant;
if (gKind === "hat") {
	if (!gRest) die("--grant hat:<hat_id> requires a hat id.");
	grant = { kind: "hat", id: gRest };
} else if (gKind === "truffles" || gKind === "snouts") {
	const amount = parseInt(gRest, 10);
	if (!Number.isInteger(amount) || amount < 1)
		die(`--grant ${gKind}:<amount> requires a positive integer amount.`);
	grant = { kind: gKind, amount };
} else {
	die(`Unknown grant kind '${gKind}'. Use hat | truffles | snouts.`);
}

let expiresAt = null;
if (expiresArg) {
	const d = new Date(expiresArg);
	if (Number.isNaN(d.getTime())) die(`--expires '${expiresArg}' is not a valid date.`);
	expiresAt = d.toISOString();
}

// ── Supabase (service role) ──────────────────────────────────────────────────
const db = serviceClient(die);

// If minting a hat grant, validate the id against the hats table BEFORE any insert.
if (grant.kind === "hat") {
	const { data: hat, error } = await db
		.from("hats")
		.select("id, name")
		.eq("id", grant.id)
		.maybeSingle();
	if (error) die(`hats lookup failed: ${error.message}`);
	if (!hat) die(`No hat with id '${grant.id}' in the hats table.`);
	console.log(`Grant: hat '${grant.id}' (${hat.name}).`);
} else {
	console.log(`Grant: ${grant.amount} ${grant.kind}.`);
}

// ── Crockford base32 code generation ─────────────────────────────────────────
// No I/L/O/U (ambiguous) and no 0/1 (look like O/I). 8 random chars ≈ 39 bits
// (30^8) — unguessable at giveaway scale, short enough to type off a poster.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0 1 I L O U (30 symbols)

function randomCode() {
	// 8 symbols from ALPHABET via rejection sampling for a uniform draw.
	const out = [];
	while (out.length < 8) {
		const buf = randomBytes(16);
		for (const b of buf) {
			if (out.length >= 8) break;
			if (b < 256 - (256 % ALPHABET.length)) out.push(ALPHABET[b % ALPHABET.length]);
		}
	}
	const s = out.join("");
	return {
		normalized: `PIG${s}`, // stored form (no dashes)
		display: `PIG-${s.slice(0, 4)}-${s.slice(4, 8)}`, // printed/QR form
	};
}

// Generate `count` unique codes.
const codes = [];
const seen = new Set();
while (codes.length < count) {
	const c = randomCode();
	if (seen.has(c.normalized)) continue;
	seen.add(c.normalized);
	codes.push(c);
}

// ── Insert rows (normalized) ─────────────────────────────────────────────────
const rows = codes.map((c) => ({
	code: c.normalized,
	label,
	grant,
	max_uses: maxUses,
	expires_at: expiresAt,
}));

const { error: insErr } = await db.from("redemption_codes").insert(rows);
if (insErr) die(`redemption_codes insert failed: ${insErr.message}`);
console.log(`Inserted ${rows.length} code(s) under label "${label}".`);

// ── Write PNGs + manifest.csv ────────────────────────────────────────────────
await mkdir(outDir, { recursive: true });

const HOST = "https://ticklethepig.com";
const manifest = ["code,url,label,grant"];
for (const c of codes) {
	const redeemUrl = `${HOST}/redeem/${c.display}`;
	const pngPath = path.join(outDir, `${c.display}.png`);
	// EC level Q so laminated/scuffed prints still scan.
	await QRCode.toFile(pngPath, redeemUrl, {
		errorCorrectionLevel: "Q",
		scale: 12,
		margin: 2,
	});
	const grantStr =
		grant.kind === "hat" ? `hat:${grant.id}` : `${grant.kind}:${grant.amount}`;
	manifest.push(`${c.display},${redeemUrl},"${label}",${grantStr}`);
}
await writeFile(path.join(outDir, "manifest.csv"), manifest.join("\n") + "\n");

console.log(`Wrote ${codes.length} QR PNG(s) + manifest.csv to ${outDir}/`);
console.log("Done. These codes are LIVE in the redemption_codes table.");
