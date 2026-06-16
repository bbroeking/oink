#!/usr/bin/env python3
"""Dev server for the item-anchor placement tool.

Serves the repo statically (like `python3 -m http.server`) AND accepts
POST /save-rel to write a placement straight back into
constants/hat_rel.generated.ts — so the tool propagates locations to source
instead of you copy-pasting each RelSpec line.

  python3 tools/anchor-server.py    # then open http://localhost:8765/tools/item-anchor.html
"""
import http.server
import json
import os
import re

PORT = 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL_FILE = os.path.join(ROOT, "constants", "hat_rel.generated.ts")


def _num(v, p):
    return "%g" % round(float(v), p)


def _fmt_line(d):
    pv = d["pivot"]
    return '\t%s: { pivot: { x: %s, y: %s }, widthFrac: %s, anchor: "%s", behind: %s },' % (
        d["id"],
        _num(pv["x"], 4),
        _num(pv["y"], 4),
        _num(d["widthFrac"], 3),
        d["anchor"],
        "true" if d.get("behind") else "false",
    )


def upsert_rel(d):
    """Insert/replace the RelSpec line for d['id'], keeping the block sorted."""
    src = open(REL_FILE, "r").read()
    line = _fmt_line(d)
    pat = re.compile(r"^\t" + re.escape(d["id"]) + r":\s.*$", re.M)
    if pat.search(src):
        src = pat.sub(lambda _m: line, src, count=1)
        action = "updated"
    else:
        lines = src.split("\n")
        start = next(i for i, l in enumerate(lines) if "HAT_REL_DATA" in l and "{" in l)
        end = next(i for i in range(start + 1, len(lines)) if lines[i].strip() == "};")
        entries = [l for l in lines[start + 1:end] if l.strip()]
        entries.append(line)
        entries.sort(key=lambda l: (re.match(r"\t(\w+):", l) or [None, l])[1])
        lines = lines[: start + 1] + entries + lines[end:]
        src = "\n".join(lines)
        action = "inserted"
    open(REL_FILE, "w").write(src)
    return action, src.count("pivot:")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        if self.path != "/save-rel":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            d = json.loads(self.rfile.read(n))
            action, total = upsert_rel(d)
            print(f"  → {action} {d['id']} in hat_rel.generated.ts ({total} entries)")
            self._json(200, {"ok": True, "id": d["id"], "action": action, "total": total})
        except Exception as e:  # surface the reason to the tool
            self._json(500, {"ok": False, "error": str(e)})

    def _json(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())


if __name__ == "__main__":
    os.chdir(ROOT)
    print(f"anchor-server on http://localhost:{PORT}  (writes -> {os.path.relpath(REL_FILE, ROOT)})")
    # Threaded so a browser keep-alive connection can't block the POST endpoint.
    http.server.ThreadingHTTPServer(("", PORT), Handler).serve_forever()
