#!/usr/bin/env python3
"""Placement Studio — one tool for tuning item placement + pig anatomy anchors.

Replaces the two aging tools (item-anchor.html/anchor-server.py and
item-anchor/serve.py). Auto-discovers EVERY item (no hardcoded list, so all
members cosmetics show up), renders a live on-pig preview using the exact
PigStage.resolveSlot math, and persists with the safe rebuild-all strategy:

  GET  /                  the studio (tools/placement_studio.html)
  GET  /api/data          items (+ RelSpec, side sprite) + REST_ANCHORS +
                          categories + the PigAnimationKey list + every pig's
                          sprite frame counts + the renderer's turn constants
  GET  /api/anchors       parsed PIG_FRAME_ANCHORS (all anims/frames) + REST
  GET  /api/rig-candidate the auto-rig proposal (docs/rig-candidate.json) or {}
  POST /api/save-rel      full HAT_REL_DATA map -> rewrite hat_rel.generated.ts
  POST /api/save-anchors  full PIG_FRAME_ANCHORS -> rewrite the sentinel block
  GET  /img/<path>        serve an asset (assets/ only)

  python3 tools/placement_studio.py   # http://127.0.0.1:8124/
"""
import http.server, json, os, re, socketserver, posixpath, subprocess, time
from urllib.parse import urlparse, unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HATS_TS = os.path.join(ROOT, "constants", "hats.ts")
HAT_REL = os.path.join(ROOT, "constants", "hat_rel.generated.ts")
MEMBERS_REL = os.path.join(ROOT, "constants", "membersRel.generated.ts")
CATALOG = os.path.join(ROOT, "docs", "members-catalog.json")
ANIM_SCALE_FILE = os.path.join(ROOT, "constants", "animScale.generated.ts")
# Persistent art-rejection record (committed, NOT scratch): {id: {reason, ts}}.
# Recorded for future generations — the art pipeline reads this to know which
# items to regenerate and WHY (build_strip_prompts.py surfaces it).
ART_REJECTIONS = os.path.join(ROOT, "docs", "art-rejections.json")
# Candidate rig written by scripts/auto_rig.py — a full PIG_FRAME_ANCHORS-shaped
# proposal the studio compares against the live rig and accepts piecewise.
# Never applied on its own; nothing here writes it.
RIG_CANDIDATE = os.path.join(ROOT, "docs", "rig-candidate.json")
HATS_DIR = os.path.join(ROOT, "assets", "images", "hats")
SPRITES_DIR = os.path.join(ROOT, "assets", "images", "sprites")
TYPES_TS = os.path.join(ROOT, "constants", "hat_overlay_types.ts")
HTML = os.path.join(os.path.dirname(__file__), "placement_studio.html")
PORT = 8124

# Compiled fallback, used only if the union below can't be parsed.
DEFAULT_ANIMS = ["idle", "walk", "jump", "happy", "sad", "tired", "surprise",
                 "wave", "face", "face_sit"]


def parse_anims():
    """The PigAnimationKey union, in source order — the studio's pose list.

    Parsed rather than hardcoded so a new animation family shows up in the pose
    bar, the anchor writer and the anim-scale writer the moment it's declared in
    constants/hat_overlay_types.ts.
    """
    try:
        src = open(TYPES_TS).read()
    except OSError:
        return list(DEFAULT_ANIMS)
    # Stop at the `;` that closes the union — a doc comment inside it may well
    # contain one of its own, so terminate on a quoted member instead.
    m = re.search(r'export type PigAnimationKey\s*=(.*?"\s*;)', src, re.S)
    if not m:
        return list(DEFAULT_ANIMS)
    names = re.findall(r'\|\s*"(\w+)"', m.group(1))
    return names or list(DEFAULT_ANIMS)


ANIMS = parse_anims()

# One item per LINE in hat_rel.generated.ts / membersRel.generated.ts. The
# anchor at `^\t` matters: a per-pose override is written inline on the same
# line, and an unanchored pattern would happily read `face: { pivot: … }` out of
# the nested perAnim block and invent an item called "face".
SPEC_BODY = (
    r'\{\s*pivot:\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)\s*\},'
    r'\s*widthFrac:\s*([\d.]+),\s*anchor:\s*"(\w+)"(?:,\s*behind:\s*(true|false))?'
)
REL_RE = re.compile(r'^\t(\w+):\s*' + SPEC_BODY, re.M)
PERANIM_TAIL_RE = re.compile(r'perAnim:\s*\{(.*)\}\s*\}\s*,?\s*$')
PERANIM_ENTRY_RE = re.compile(r'(\w+):\s*' + SPEC_BODY)
ANCHOR_RE = re.compile(r'(\w+):\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)\s*\}')


def _spec_from(groups):
    px, py, wf, anch, behind = groups
    return {"pivot": {"x": float(px), "y": float(py)}, "widthFrac": float(wf),
            "anchor": anch, "behind": behind == "true"}


def parse_rel(path):
    out = {}
    if not os.path.isfile(path):
        return out
    src = open(path).read()
    for m in REL_RE.finditer(src):
        spec = _spec_from(m.groups()[1:])
        # Everything after the base spec on THIS line — where a perAnim block
        # lives when the studio wrote one.
        eol = src.find("\n", m.end())
        tail = src[m.end():eol if eol != -1 else len(src)]
        tm = PERANIM_TAIL_RE.search(tail)
        if tm:
            per = {}
            for pm in PERANIM_ENTRY_RE.finditer(tm.group(1)):
                per[pm.group(1)] = _spec_from(pm.groups()[1:])
            if per:
                spec["perAnim"] = per
        out[m.group(1)] = spec
    return out


def parse_rest_anchors():
    src = open(HATS_TS).read()
    m = re.search(r"const REST_ANCHORS[^{]*\{(.*?)\n\};", src, re.S)
    out = {}
    if m:
        for a in ANCHOR_RE.finditer(m.group(1)):
            out[a.group(1)] = {"x": float(a.group(2)), "y": float(a.group(3))}
    return out


def parse_frame_anchors():
    """Parse PIG_FRAME_ANCHORS between the editor sentinels -> {anim: [frame{}]}."""
    src = open(HATS_TS).read()
    block = re.search(r"ANCHOR_EDITOR_START(.*?)ANCHOR_EDITOR_END", src, re.S)
    if not block:
        return {}
    body = block.group(1)
    out = {}
    for anim_m in re.finditer(r"(\w+):\s*\[(.*?)\],\n", body, re.S):
        anim = anim_m.group(1)
        frames = []
        for fr in re.finditer(r"\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", anim_m.group(2)):
            frame = {}
            for a in ANCHOR_RE.finditer(fr.group(1)):
                frame[a.group(1)] = {"x": float(a.group(2)), "y": float(a.group(3))}
            if frame:
                frames.append(frame)
        if frames:
            out[anim] = frames
    return out


def parse_rig_candidate():
    """docs/rig-candidate.json, re-read every request (the script regenerates it).

    Missing or unreadable is not an error — the studio degrades to "no
    candidate" and the compare UI simply stays hidden.
    """
    try:
        with open(RIG_CANDIDATE) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def parse_rejections():
    try:
        return json.load(open(ART_REJECTIONS))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_rejections(data):
    tmp = ART_REJECTIONS + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=1, sort_keys=True)
    os.replace(tmp, ART_REJECTIONS)


def parse_anim_scale():
    out = {a: 1.0 for a in ANIMS}
    if os.path.isfile(ANIM_SCALE_FILE):
        for m in re.finditer(r"(\w+):\s*([\d.]+)", open(ANIM_SCALE_FILE).read()):
            if m.group(1) in out:
                out[m.group(1)] = float(m.group(2))
    return out


def write_anim_scale(data):
    # Idle is the normalization baseline used by every other pose and by the
    # runtime guardrail test. Letting the editor scale idle changes the ruler
    # while measurements are being compared, so keep it fixed at 1.
    data = {**data, "idle": 1.0}
    g = lambda v: "%g" % round(float(v), 4)
    lines = [f"\t{a}: {g(data.get(a, 1))}," for a in ANIMS]
    body = (
        "// AUTO-GENERATED by tools/placement_studio — do not hand-edit.\n"
        "// Per-animation render scale applied as the PIG-CARD transform so every\n"
        "// pose reads at ~the same size as idle (sprite + items scale together).\n"
        "// Tune in the Placement Studio (Items mode -> Pose -> Scale).\n"
        "export const ANIM_SCALE: Record<string, number> = {\n"
        + "\n".join(lines) + "\n};\n"
    )
    open(ANIM_SCALE_FILE, "w").write(body)


# Base + Mud War cosmetics live in the DB, not docs/members-catalog.json, so the
# studio used to render them with no category — auras (firefly_aura,
# confetti_aura, …) then fell through to the head-item path and looked wrong.
# Parse their category straight from the catalog migrations so the studio knows
# an aura is an aura. (Mirrors scripts/pig_preview.py:sql_categories.)
SQL_CATALOGS = ["supabase/migrations/20260502030000_shop_catalog.sql",
                "supabase/migrations/20260650000000_mud_war_cosmetics.sql"]


def sql_categories():
    out = {}
    for sql in SQL_CATALOGS:
        p = os.path.join(ROOT, sql)
        if not os.path.isfile(p):
            continue
        for line in open(p):
            m = re.match(r"^\s*\('([^']+)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*\d+,\s*\d+,\s*'([^']+)',", line)
            if m:
                out[m.group(1)] = {"category": m.group(2), "members": False, "name": m.group(1)}
    return out


def catalog_categories():
    out = sql_categories()                       # base + mud-war items (from migrations)
    if os.path.isfile(CATALOG):
        for it in json.load(open(CATALOG)):       # members catalog wins on overlap
            out[it["id"]] = {"category": it["category"], "members": True, "name": it["name"]}
    return out


# Mud War game sprites live in assets/images/hats/ but are NOT placeable
# cosmetics — goblin enemies (run + hit poses) and thrown mud projectiles, used
# in components/mudwar/ + app/mud-war.tsx. Skip them so they never show up as
# items to place on Rosie. (mud_pie / mud_shovel / slop_bucket DO have RelSpecs
# — they're held cosmetics won in Mud War — so they're intentionally kept.)
NON_COSMETIC = frozenset({
    "goblin_grunt", "goblin_scout", "goblin_brute", "goblin_warboss",
    "goblin_grunt_hit", "goblin_scout_hit", "goblin_brute_hit", "goblin_warboss_hit",
    "mud_splat", "mud_splat_gold",
})


def build_items():
    hat_rel = parse_rel(HAT_REL)
    members_rel = parse_rel(MEMBERS_REL)
    cats = catalog_categories()
    items = []
    for fn in sorted(os.listdir(HATS_DIR)):
        if not fn.endswith(".png"):
            continue
        iid = fn[:-4]
        if iid in NON_COSMETIC:
            continue
        meta = cats.get(iid, {})
        eff = hat_rel.get(iid) or members_rel.get(iid)
        side = f"assets/images/hats/side/{iid}.png"
        items.append({
            "id": iid,
            "image": f"assets/images/hats/{iid}.png",
            # The three-quarter sprite the turned families swap in
            # (HAT_SIDE_IMAGES / tools/gen_side_items.py), or null.
            "side": side if os.path.isfile(os.path.join(ROOT, side)) else None,
            "category": meta.get("category"),
            "members": meta.get("members", False),
            "rel": eff,                       # effective current spec (for preview)
            "tuned": iid in hat_rel,          # hand-tuned into hat_rel.generated.ts
            "defaulted": iid in members_rel and iid not in hat_rel,
        })
    return items, hat_rel


SPRITE_RE = re.compile(r"^([a-z_]+)_(\d+)\.png$")


def sprite_pigs():
    """{pig: {anim: frame count}} straight off disk — every renderable pig.

    Anchors are shared by every pig (PIG_FRAME_ANCHORS isn't per pig); this is
    purely so the studio can preview a placement on Copper or Bandit. Dirs
    starting with "_" are sources, not pigs; `lounge/` subdirs are a different
    rig entirely and are ignored (only files directly in the pig's dir count).
    """
    out = {}
    if not os.path.isdir(SPRITES_DIR):
        return out
    for pig in sorted(os.listdir(SPRITES_DIR)):
        if pig.startswith("_") or not os.path.isdir(os.path.join(SPRITES_DIR, pig)):
            continue
        counts = {}
        for fn in os.listdir(os.path.join(SPRITES_DIR, pig)):
            m = SPRITE_RE.match(fn)
            if m and m.group(1) in ANIMS:
                counts[m.group(1)] = max(counts.get(m.group(1), 0), int(m.group(2)))
        if counts:
            out[pig] = counts
    # Rosie is the reference pig — the one every anchor was authored against.
    return {k: out[k] for k in sorted(out, key=lambda p: (p != "rosie", p))}


def parse_turned_eye_shift():
    try:
        m = re.search(r"TURNED_EYE_SHIFT\s*=\s*(-?[\d.]+)", open(HATS_TS).read())
        if m:
            return float(m.group(1))
    except OSError:
        pass
    return 16.0


def parse_wearable_clamp():
    """The [min, max] apparent-scale clamp in hats.ts resolveWearablePose."""
    try:
        src = open(HATS_TS).read()
        m = re.search(r"Math\.max\(([\d.]+),\s*Math\.min\(([\d.]+),", src)
        if m:
            return [float(m.group(1)), float(m.group(2))]
    except OSError:
        pass
    return [0.72, 1.18]


def write_hat_rel(data):
    """Rebuild-all: rewrite hat_rel.generated.ts sorted (safe, deterministic)."""
    g = lambda v, p=4: "%g" % round(float(v), p)  # drop trailing zeros (1.0 -> 1)

    def body(s):
        p = s["pivot"]
        return ('pivot: { x: %s, y: %s }, widthFrac: %s, anchor: "%s", behind: %s'
                % (g(p["x"]), g(p["y"]), g(s["widthFrac"]), s["anchor"],
                   "true" if s.get("behind") else "false"))

    lines = []
    for iid in sorted(data):
        s = data[iid]
        # A per-pose override rides inline on the item's own line, in
        # PigAnimationKey order, complete (the studio copies the effective spec
        # when it creates one) so there's no "which field wins" bookkeeping.
        per = s.get("perAnim") or {}
        tail = ""
        poses = [a for a in ANIMS if a in per]
        if poses:
            tail = ", perAnim: { %s }" % ", ".join(
                "%s: { %s }" % (a, body(per[a])) for a in poses)
        lines.append("\t%s: { %s%s }," % (iid, body(s), tail))
    text = (
        "// AUTO-GENERATED by tools/placement_studio — do not edit by hand.\n"
        "// The studio writes this live as you tune item attach points.\n"
        'import type { RelSpec } from "./hat_overlay_types";\n\n'
        "export const HAT_REL_DATA: Record<string, RelSpec> = {\n"
        + "\n".join(lines) + ("\n" if lines else "") + "};\n"
    )
    open(HAT_REL, "w").write(text)


def write_frame_anchors(data):
    """Rewrite the PIG_FRAME_ANCHORS object body between the sentinels."""
    src = open(HATS_TS).read()
    order = ["head", "eye_l", "eye_r", "snout", "mouth", "neck", "body",
             "hand_l", "hand_r", "leg_l", "leg_r"]
    def fmt_frame(fr):
        parts = [f'{k}: {{ x: {round(fr[k]["x"])}, y: {round(fr[k]["y"])} }}'
                 for k in order if k in fr]
        return "\t\t{ " + ", ".join(parts) + " }"
    lines = ["export const PIG_FRAME_ANCHORS: Record<",
             "\tPigAnimationKey,",
             "\tPartial<Record<AnchorName, Anchor>>[]",
             "> = {"]
    for anim in ANIMS:
        frames = data.get(anim, [])
        lines.append(f"\t{anim}: [")
        lines += [fmt_frame(fr) + "," for fr in frames]
        lines.append("\t],")
    lines.append("};")
    new_block = "\n".join(lines)
    # Replace ONLY the PIG_FRAME_ANCHORS declaration (export … = { … };) — leave
    # the sentinel comments and everything else untouched. Non-greedy to the
    # first "\n};" closes exactly the object literal.
    pat = re.compile(r"export const PIG_FRAME_ANCHORS[^=]*=\s*\{.*?\n\};", re.S)
    if not pat.search(src):
        raise RuntimeError("PIG_FRAME_ANCHORS declaration not found")
    out = pat.sub(lambda _m: new_block, src, count=1)
    # Keep REST_ANCHORS in lockstep with idle frame 0 (the canonical baseline)
    # so editing the pig in the studio can't drift the two apart — the bug the
    # old anchor-editor left open (it wrote the sentinel block but not REST).
    idle0 = (data.get("idle") or [{}])[0]
    if idle0:
        out = sync_rest_anchors(out, idle0)
    open(HATS_TS, "w").write(out)


def sync_rest_anchors(src, idle0):
    order = ["head", "eye_l", "eye_r", "eyes", "snout", "mouth", "neck", "body",
             "hand_l", "hand_r", "leg_l", "leg_r", "feet"]
    cur = {}
    m = re.search(r"const REST_ANCHORS[^{]*\{(.*?)\n\};", src, re.S)
    if m:
        for a in ANCHOR_RE.finditer(m.group(1)):
            cur[a.group(1)] = {"x": float(a.group(2)), "y": float(a.group(3))}
    def pt(name):
        return idle0.get(name) or cur.get(name) or {"x": 0, "y": 0}
    def val(name):
        if name == "eyes":
            l, r = pt("eye_l"), pt("eye_r"); return {"x": (l["x"] + r["x"]) / 2, "y": (l["y"] + r["y"]) / 2}
        if name == "feet":
            l, r = pt("leg_l"), pt("leg_r"); return {"x": (l["x"] + r["x"]) / 2, "y": (l["y"] + r["y"]) / 2}
        return pt(name)
    note = {"eyes": " // midpoint of eye_l/eye_r (virtual)",
            "feet": " // midpoint of leg_l/leg_r (virtual)"}
    lines = ["const REST_ANCHORS: Record<AnchorName, Anchor> = {"]
    for n in order:
        v = val(n)
        lines.append(f"\t{n}: {{ x: {round(v['x'])}, y: {round(v['y'])} }},{note.get(n, '')}")
    lines.append("};")
    new = "\n".join(lines)
    return re.sub(r"const REST_ANCHORS[^=]*=\s*\{.*?\n\};", lambda _m: new, src, count=1, flags=re.S)


def safe_asset(rel):
    rel = posixpath.normpath(unquote(rel)).lstrip("/")
    if not rel.startswith("assets/") or ".." in rel.split("/"):
        return None
    full = os.path.join(ROOT, rel)
    return full if os.path.isfile(full) else None


def unlock_brian_auras():
    """Grant every current aura to the Brian test profile (idempotent)."""
    result = subprocess.run(
        ["node", os.path.join(ROOT, "scripts", "unlock-auras-for-user.mjs"), "Brian"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if result.returncode:
        detail = (result.stderr or result.stdout or "unlock failed").strip().splitlines()[-1]
        raise RuntimeError(detail)
    return json.loads(result.stdout.strip().splitlines()[-1])


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            with open(HTML, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        elif path == "/api/data":
            items, hat_rel = build_items()
            # Send the FULL hat_rel map so the client's save-map preserves every
            # entry — incl. tuned items whose art isn't under hats/ (necklaces:
            # bell_collar, choker, diamond_pendant). Without this a rebuild-all
            # save would silently drop them.
            self._json(200, {"items": items, "rest": parse_rest_anchors(),
                             "hatRel": hat_rel, "animScale": parse_anim_scale(),
                             "rejections": parse_rejections(),
                             "anims": ANIMS, "pigs": sprite_pigs(),
                             "turnedEyeShift": parse_turned_eye_shift(),
                             "wearableClamp": parse_wearable_clamp()})
        elif path == "/api/anchors":
            self._json(200, {"rest": parse_rest_anchors(), "frames": parse_frame_anchors()})
        elif path == "/api/rig-candidate":
            self._json(200, parse_rig_candidate())
        elif path.startswith("/img/"):
            full = safe_asset(path[len("/img/"):])
            if not full:
                self._json(404, {"error": "not found"}); return
            with open(full, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        n = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "bad json"}); return
        try:
            if path == "/api/save-rel":
                write_hat_rel(data)
                self._json(200, {"ok": True, "count": len(data)})
            elif path == "/api/save-anchors":
                write_frame_anchors(data)
                self._json(200, {"ok": True})
            elif path == "/api/save-anim-scale":
                write_anim_scale(data)
                self._json(200, {"ok": True})
            elif path == "/api/reject":
                iid = data.get("id")
                if not iid:
                    self._json(400, {"error": "missing id"}); return
                rej = parse_rejections()
                if data.get("clear"):
                    rej.pop(iid, None)
                else:
                    prev = rej.get(iid, {})
                    rej[iid] = {"reason": data.get("reason", prev.get("reason", "")),
                                "ts": prev.get("ts") or int(time.time())}
                write_rejections(rej)
                self._json(200, {"ok": True, "count": len(rej)})
            elif path == "/api/unlock-brian-auras":
                self._json(200, unlock_brian_auras())
            else:
                self._json(404, {"error": "not found"})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"error": str(exc)})


if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        httpd.RequestHandlerClass = Handler
        print(f"Placement Studio → http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
