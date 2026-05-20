#!/usr/bin/env node
// Tiny dev server for the anchor editor. Two responsibilities:
//   1. Serves the editor's static files (HTML/CSS/JS/images) so the
//      editor runs over http:// instead of file:// — sidesteps Chrome's
//      stricter file:// rules for fetch + image loads.
//   2. Exposes POST /save which writes PIG_FRAME_ANCHORS back into
//      constants/hats.ts between the ANCHOR_EDITOR_START / _END
//      sentinels. No other part of the file is touched.
//
// Run: `node tools/anchor-editor/server.mjs` (or `bun run anchor-editor`)
// Then open: http://localhost:4321

import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const EDITOR_DIR = __dirname;
const ASSETS_DIR = resolve(ROOT, "assets");
const HATS_FILE = resolve(ROOT, "constants/hats.ts");
const PORT = Number(process.env.PORT) || 4321;

const START_SENTINEL = "// ANCHOR_EDITOR_START";
const END_SENTINEL = "// ANCHOR_EDITOR_END";

const MIME = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
};

async function tryServeStatic(filePath, res) {
	try {
		const s = await stat(filePath);
		if (!s.isFile()) return false;
		const buf = await readFile(filePath);
		res.writeHead(200, {
			"Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
			"Cache-Control": "no-store",
		});
		res.end(buf);
		return true;
	} catch {
		return false;
	}
}

async function handleSave(req, res) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	let body;
	try {
		body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		res.writeHead(400, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: false, error: "invalid json" }));
		return;
	}
	const literal = body.literal;
	if (typeof literal !== "string" || !literal.includes("PIG_FRAME_ANCHORS")) {
		res.writeHead(400, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: false, error: "missing PIG_FRAME_ANCHORS literal" }));
		return;
	}

	const src = await readFile(HATS_FILE, "utf8");
	const startIdx = src.indexOf(START_SENTINEL);
	const endIdx = src.indexOf(END_SENTINEL);
	if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				ok: false,
				error: "sentinels missing in constants/hats.ts",
			})
		);
		return;
	}
	const beforeBlock = src.slice(0, startIdx);
	const afterBlock = src.slice(endIdx + END_SENTINEL.length);
	// Preserve the start sentinel's leading comment block (everything
	// from START_SENTINEL up to the first newline after the comment).
	const startBlockEnd = src.indexOf("export const PIG_FRAME_ANCHORS", startIdx);
	const startHeader = src.slice(startIdx, startBlockEnd);

	const next =
		beforeBlock +
		startHeader +
		literal.trim() +
		"\n" +
		END_SENTINEL +
		afterBlock;

	await writeFile(HATS_FILE, next, "utf8");
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ ok: true, bytes: next.length }));
	console.log(
		`[${new Date().toISOString()}] saved PIG_FRAME_ANCHORS (${literal.length} chars)`
	);
}

const server = createServer(async (req, res) => {
	if (req.method === "POST" && req.url === "/save") {
		try {
			await handleSave(req, res);
		} catch (e) {
			console.error("save error:", e);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
		}
		return;
	}

	if (req.method !== "GET") {
		res.writeHead(405);
		res.end();
		return;
	}

	// Default route: /  → editor index.html
	let path = req.url === "/" ? "/index.html" : req.url;
	// Block traversal
	if (path.includes("..")) {
		// Allow relative ../../assets paths from the editor since the
		// HTML uses them — but only if they resolve inside the project.
		const candidate = resolve(EDITOR_DIR, "." + path);
		if (!candidate.startsWith(ROOT)) {
			res.writeHead(403);
			res.end();
			return;
		}
		if (await tryServeStatic(candidate, res)) return;
	} else {
		const candidate = resolve(EDITOR_DIR, "." + path);
		if (await tryServeStatic(candidate, res)) return;
	}

	// Also try ROOT-relative (e.g., /assets/images/...)
	if (path.startsWith("/assets/")) {
		const candidate = resolve(ROOT, "." + path);
		if (await tryServeStatic(candidate, res)) return;
	}

	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("Not found: " + path);
});

server.listen(PORT, () => {
	console.log(`\nAnchor editor server\n`);
	console.log(`  → http://localhost:${PORT}\n`);
	console.log(`Save endpoint:  POST http://localhost:${PORT}/save`);
	console.log(`Writes to:      ${HATS_FILE}\n`);
});
