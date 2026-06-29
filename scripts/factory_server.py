#!/usr/bin/env python3
"""Image-generation factory — local review server.

Serves a gallery of generated items (image + prompt) with per-item
Approve / Reject + feedback. Verdicts persist to a JSON file the generation
loop reads, so the flow is: Claude generates -> you review in the browser ->
Claude regenerates the rejects with your feedback -> repeat until all approved.

Data (generic, reusable across batches):
  tmp/factory/manifest.json   source of truth — list of items {id,name,group,tags,prompt,image,kind}
  tmp/factory/verdicts.json   {id: {status: approved|rejected|"", feedback, ts}}

Usage:
  python3 scripts/factory_server.py [port]      # default 8099

Routes:
  GET  /                 the gallery (scripts/factory_gallery.html)
  GET  /api/manifest     manifest items + live image mtime (for cache-busting)
  GET  /api/verdicts     current verdicts
  POST /api/verdict      {id,status,feedback} -> merge + persist
  GET  /img/<path>       serve an image file (only under assets/ or tmp/factory/)
"""
import json, os, sys, threading, time, posixpath
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTORY = os.path.join(ROOT, "tmp", "factory")
MANIFEST = os.path.join(FACTORY, "manifest.json")
VERDICTS = os.path.join(FACTORY, "verdicts.json")
GALLERY = os.path.join(ROOT, "scripts", "factory_gallery.html")
ALLOWED_PREFIXES = ("assets/", "tmp/factory/")
_lock = threading.Lock()


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def safe_path(rel):
    rel = posixpath.normpath(unquote(rel)).lstrip("/")
    if not rel.startswith(ALLOWED_PREFIXES) or ".." in rel.split("/"):
        return None
    full = os.path.join(ROOT, rel)
    return full if os.path.isfile(full) else None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/" or path == "/index.html":
            try:
                with open(GALLERY, "rb") as f:
                    self._send(200, f.read().decode(), "text/html; charset=utf-8")
            except FileNotFoundError:
                self._send(500, {"error": "gallery html missing"})
        elif path == "/api/manifest":
            man = load_json(MANIFEST, {"title": "(empty)", "items": []})
            for it in man.get("items", []):
                full = os.path.join(ROOT, it.get("image", ""))
                it["mtime"] = int(os.path.getmtime(full)) if os.path.isfile(full) else 0
                it["exists"] = os.path.isfile(full)
                pv = it.get("preview")
                if pv:
                    pfull = os.path.join(ROOT, pv)
                    it["preview_mtime"] = int(os.path.getmtime(pfull)) if os.path.isfile(pfull) else 0
                    it["preview_exists"] = os.path.isfile(pfull)
            self._send(200, man)
        elif path == "/api/verdicts":
            self._send(200, load_json(VERDICTS, {}))
        elif path.startswith("/img/"):
            full = safe_path(path[len("/img/"):])
            if not full:
                self._send(404, {"error": "not found"})
                return
            ext = os.path.splitext(full)[1].lower()
            ctype = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                     ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "application/octet-stream")
            with open(full, "rb") as f:
                self._send(200, f.read(), ctype)
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/verdict":
            self._send(404, {"error": "not found"})
            return
        n = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            self._send(400, {"error": "bad json"})
            return
        item_id = data.get("id")
        if not item_id:
            self._send(400, {"error": "missing id"})
            return
        with _lock:
            verdicts = load_json(VERDICTS, {})
            entry = verdicts.get(item_id, {})
            if "status" in data:
                entry["status"] = data["status"]
            if "feedback" in data:
                entry["feedback"] = data["feedback"]
            entry["ts"] = int(time.time())
            verdicts[item_id] = entry
            tmp = VERDICTS + ".tmp"
            with open(tmp, "w") as f:
                json.dump(verdicts, f, indent=1)
            os.replace(tmp, VERDICTS)
        self._send(200, {"ok": True, "verdict": verdicts[item_id]})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    os.makedirs(FACTORY, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"factory review server -> http://127.0.0.1:{port}")
    print(f"  manifest: {MANIFEST}")
    print(f"  verdicts: {VERDICTS}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
