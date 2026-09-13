#!/usr/bin/env node
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const port = Number(process.env.MOTE_RIVE_HARNESS_PORT ?? 4178);
const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".riv": "application/octet-stream", ".json": "application/json" };
createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^\/+/, "");
  let file = join(root, relative || "artifacts/mote-wagering-2026-09-06/v4/harness/index.html");
  try { if (statSync(file).isDirectory()) file = join(file, "index.html"); statSync(file); }
  catch { res.writeHead(404).end("Not found"); return; }
  res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
  res.setHeader("cache-control", "no-store"); createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Mote Machine V4 harness: http://127.0.0.1:${port}/artifacts/mote-wagering-2026-09-06/v4/harness/`));
