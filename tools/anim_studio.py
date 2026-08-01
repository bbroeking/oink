#!/usr/bin/env python3
"""Animation Studio — a local page that plays EVERY pig animation exactly the way
the app renders it (SpritePig contain-fits each frame into a 300 box, then
SwipeElement applies the ANIM_SCALE card transform) and lines them all up on one
baseline so a wrong per-animation scale is obvious at a glance.

Drag a scale slider and it autosaves to constants/animScale.generated.ts (Metro
hot-reloads the app). Frame timing + loop come straight from SpritePig's
ANIMATIONS table, so playback matches the real thing.

Run:  python3 tools/anim_studio.py   ->  http://127.0.0.1:8130/
"""
import http.server, json, os, re, socketserver, posixpath
from urllib.parse import urlparse, unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPRITE_TS = os.path.join(ROOT, "components", "ui", "SpritePig.tsx")
SCALE_TS = os.path.join(ROOT, "constants", "animScale.generated.ts")
HTML = os.path.join(os.path.dirname(__file__), "anim_studio.html")
PORT = 8130

# The 8 primary animations, in a sensible display order.
ORDER = ["idle", "walk", "jump", "happy", "sad", "tired", "surprise", "wave"]


def parse_animations():
    src = open(SPRITE_TS).read()
    m = re.search(r"ANIMATIONS[^=]*=\s*\{(.*?)\n\};", src, re.S)
    block = m.group(1) if m else ""
    anims = {}
    for name, frames_str, fps, loop in re.findall(
        r"(\w+):\s*\{\s*frames:\s*\[([^\]]*)\],\s*fps:\s*([\d.]+),\s*loop:\s*(true|false)",
        block, re.S):
        anims[name] = {
            "frames": re.findall(r'"([^"]+)"', frames_str),
            "fps": float(fps),
            "loop": loop == "true",
        }
    return {k: anims[k] for k in ORDER if k in anims}


def parse_scale():
    src = open(SCALE_TS).read()
    return {k: float(v) for k, v in re.findall(r"(\w+):\s*([\d.]+)", src)}


def write_scale(scale):
    # Idle is the pose-normalization baseline; other animations are measured
    # relative to it, so the studio must never persist an idle override.
    scale = {**scale, "idle": 1.0}
    body = "\n".join(f"\t{k}: {round(scale.get(k, 1), 3)}," for k in ORDER)
    new_obj = "export const ANIM_SCALE: Record<string, number> = {\n" + body + "\n};"
    src = open(SCALE_TS).read()
    src = re.sub(r"export const ANIM_SCALE[^=]*=\s*\{.*?\n\};", new_obj, src, flags=re.S)
    open(SCALE_TS, "w").write(src)


def autofit_scales():
    """The 'correct' per-animation scale = idle's solid pig-body height / this
    animation's (measured on its most-upright frame, ignoring the AA feather).
    Same math the sizing pass used — a one-click 'make every pose read like idle'."""
    from PIL import Image
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "pf", os.path.join(ROOT, "scripts/process_pig_frame.py"))
    pf = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pf)

    def solid_render(frame):
        im = Image.open(os.path.join(ROOT, f"assets/images/sprites/rosie/{frame}.png")).convert("RGBA")
        w, h = im.size
        s = min(300 / w, 300 / h)
        t, b, _, _ = pf.pig_body_metrics(im, thr=140)  # solid body, no AA feather
        return (b - t) * s

    anims = parse_animations()
    upright = {n: max(solid_render(f) for f in anims[n]["frames"]) for n in anims}
    idle = upright.get("idle", 1)
    return {n: round(idle / upright[n], 3) for n in anims}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = urlparse(self.path).path
        if p in ("/", "/index.html"):
            return self._send(200, open(HTML, "rb").read(), "text/html; charset=utf-8")
        if p == "/api/data":
            return self._send(200, {
                "order": ORDER,
                "animations": parse_animations(),
                "scale": parse_scale(),
            })
        if p.startswith("/img/"):
            rel = unquote(p[len("/img/"):])
            fp = os.path.normpath(os.path.join(ROOT, rel))
            if fp.startswith(ROOT) and os.path.isfile(fp):
                ext = os.path.splitext(fp)[1].lower()
                ct = {".png": "image/png", ".jpg": "image/jpeg"}.get(ext, "application/octet-stream")
                return self._send(200, open(fp, "rb").read(), ct)
            return self._send(404, {"error": "no file"})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        p = urlparse(self.path).path
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n) or b"{}")
        if p == "/api/scale":
            scale = parse_scale()
            scale[data["name"]] = float(data["value"])
            write_scale(scale)
            return self._send(200, {"ok": True, "scale": scale})
        if p == "/api/autofit":
            try:
                fitted = autofit_scales()
            except Exception as e:
                return self._send(500, {"error": str(e)})
            scale = parse_scale()
            scale.update(fitted)
            write_scale(scale)
            return self._send(200, {"ok": True, "scale": scale})
        return self._send(404, {"error": "not found"})


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as srv:
        print(f"Animation Studio → http://127.0.0.1:{PORT}/")
        srv.serve_forever()
