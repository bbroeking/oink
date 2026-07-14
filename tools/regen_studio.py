#!/usr/bin/env python3
"""Regen Studio — review + regenerate cosmetic art through the Codex ImageGen lane.

Every catalog item in one grid: current sprite + on-pig preview. Per item you can
  * Regen      — regenerate flat/front-facing via `codex exec` image_generation
                 (optional notes are folded into the prompt; the current sprite is
                 attached as a visual reference so the design carries over)
  * Approve    — staged art replaces assets/images/hats/<id>.png (old sprite is
                 backed up to tmp/regen_studio/backup/)
  * Decline    — discard the staged art

The flat-sticker rules baked into every prompt are the house rendering law:
flat 2D front view, paper-cutout silhouette, NO wrap-around bands / back-of-brim /
3/4 perspective — everything must lie directly on Rosie.

Items my 2026-07 depth audit flagged sort first (badge shows the reason).

  python3 tools/regen_studio.py   # http://127.0.0.1:8131/

State survives restarts in tmp/regen_studio/state.json. Jobs run one at a time in
a worker thread (a codex image call takes ~60-120s). Approving does NOT touch
RelSpecs — retune placement in placement_studio (8124) if proportions changed.
"""
import http.server, importlib.util, json, os, queue, shutil, socketserver
import subprocess, threading, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8131
STATE_DIR = os.path.join(ROOT, "tmp/regen_studio")
STATE_PATH = os.path.join(STATE_DIR, "state.json")
STAGE_RAW = os.path.join(STATE_DIR, "staged_raw")
STAGE_PROC = os.path.join(STATE_DIR, "staged")
STAGE_PREV = os.path.join(STATE_DIR, "staged_prev")
BACKUP_DIR = os.path.join(STATE_DIR, "backup")
PREVIEW_DIR = os.path.join(ROOT, "tmp/factory/previews")
for d in (STATE_DIR, STAGE_RAW, STAGE_PROC, STAGE_PREV, BACKUP_DIR, PREVIEW_DIR):
    os.makedirs(d, exist_ok=True)

# Reuse pig_preview's catalog + on-pig renderer (single source of placement truth).
_spec = importlib.util.spec_from_file_location(
    "pig_preview", os.path.join(ROOT, "scripts/pig_preview.py"))
pp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pp)

# 2026-07 depth audit, second pass — contact-sheet sweep + 4 independent
# vision auditors + full-size adjudication of every disputed call. Rule of
# decision: WORN items get the strict flat-front read; held props with depth
# internal to the object (mug, lantern, bow) pass — they never wrap the pig.
# Notable unflags vs pass 1: tophat/crown/venice_mask read flat at full size;
# halo keeps its ellipse (it floats — the "correct" front arc reads worse).
FLAGGED = {
    "wizard": "tilted, full brim ellipse",
    "daisy_flower_crown": "full wreath ring in perspective",
    "candlelit_circlet": "band back rim visible",
    "muddy_cap": "3/4 baseball cap",
    "masquerade_plume_hat": "tilted, visible interior opening",
    "squire_feather_cap": "3/4 tilt with depth",
    "silver_plume_helm": "3/4 helm, interior visible",
    "slop_pail_topper": "open rim shows interior",
    "slop_bucket_hat": "open-top bucket interior",
    "cowboy": "back of brim behind crown",
    "bog_helmet": "3/4 dome with perspective depth",
    "watering_can_hat": "3/4 spout/body depth",
    "release_party_crown": "tilted 3/4, band interior visible",
    "ticket_takers_cap": "3/4, top ellipse + interior rim",
    "aurora_glow_hood": "3/4 bonnet, opening faces sideways",
}

STYLE_RULES = """Style (children's storybook game sprite):
- Flat children's storybook illustration with bold ~3px black outline
- Soft saturated colors; no drop shadows, no glow
- Simple shapes, readable at small size (mobile game cosmetic)
- Pure transparent background, single item centered, small margin
- Square image, 1024x1024

RENDERING RULES (CRITICAL — the item is worn by a 2D front-facing pig):
- Flat 2D FRONT view, as if pressed against the camera - a paper cutout of only
  the visible front silhouette. It must lie flat on the character.
- NO wrap-around bands or rings: bands/brims are a single front-facing arc only.
- NO back-of-brim, NO clasp, NO full ellipse, NO 3/4 or tilted perspective,
  NO interior of the item visible, NO depth.
- No head, no face, no body - just the item."""

CATEGORY_HINT = {
    "hat": "It sits on top of the head; the bottom edge is the front arc that meets the head.",
    "glasses": "Front-facing eyewear; both lenses fully visible, no temples/arms.",
    "mask": "Front-facing face mask, symmetric.",
    "bow": "Front-facing bow, symmetric.",
    "neck": "Neckwear on an invisible bust; strap is a soft front arc only.",
    "held": "A single prop object, front view.",
    "scarf": "Front drape only, no wrap behind the neck.",
}


def load_state():
    if os.path.isfile(STATE_PATH):
        try:
            return json.load(open(STATE_PATH))
        except Exception:
            pass
    return {}


STATE_LOCK = threading.Lock()
STATE = load_state()
# The job queue is in-memory: anything mid-flight when the server died can
# never finish, so surface it as retryable instead of spinning forever.
for _st in STATE.values():
    if _st.get("status") in ("queued", "generating"):
        _st["status"] = "error"
        _st["error"] = "interrupted by a studio restart — hit Redo/Fresh again"


def save_state():
    with STATE_LOCK:
        tmp = STATE_PATH + ".tmp"
        json.dump(STATE, open(tmp, "w"), indent=1, sort_keys=True)
        os.replace(tmp, STATE_PATH)


def set_item(item_id, **kv):
    with STATE_LOCK:
        STATE.setdefault(item_id, {}).update(kv)
    save_state()


ANCHOR_CATEGORY = {"head": "hat", "eyes": "glasses", "hand_r": "held", "hand_l": "held",
                   "neck": "neck", "body": "neck", "snout": "mask", "mouth": "mask"}


def hat_images_ids():
    """Every id registered in constants/hats.ts HAT_IMAGES — the art source of truth."""
    import re
    ids, in_map = [], False
    for line in open(os.path.join(ROOT, "constants/hats.ts")):
        if "HAT_IMAGES" in line and "{" in line:
            in_map = True
            continue
        if in_map and line.strip().startswith("}"):
            break
        if in_map:
            m = re.match(r"\s*(\w+):\s*require\(", line)
            if m:
                ids.append(m.group(1))
    return ids


def catalog():
    """id -> {id, category, name} for every on-pig item with a sprite."""
    by_id = pp.sql_categories()
    # base registry ids missing from the parsed catalogs (early-seed hats like
    # wizard/cowboy): category from their RelSpec anchor, default hat
    for i in hat_images_ids():
        if i not in by_id and not i.startswith("flag_"):
            spec = pp.REL.get(i)
            c = ANCHOR_CATEGORY.get(spec["anchor"], "hat") if spec else "hat"
            by_id[i] = {"id": i, "category": c}
    cat = json.load(open(os.path.join(ROOT, "docs/members-catalog.json")))
    by_id.update({it["id"]: it for it in cat})
    out = {}
    for i, it in sorted(by_id.items()):
        c = it["category"]
        src = ("assets/images/backgrounds/" if c == "background" else "assets/images/hats/") + i + ".png"
        if c == "background" and not os.path.isfile(os.path.join(ROOT, src)):
            src = f"assets/images/backgrounds/{i}_1.png"
        if not os.path.isfile(os.path.join(ROOT, src)):
            continue
        out[i] = {"id": i, "category": c, "src": src,
                  "name": it.get("name") or i.replace("_", " ").title()}
    return out


CATALOG = catalog()


def build_prompt(item, notes, mode="revise", with_pig=False):
    ordinal = "first attached image" if with_pig else "attached image"
    if mode == "fresh":
        # No old-art reference — a completely new take; fresh needs the style
        # anchor since there's no image to carry it.
        lines = [
            "Generate ONE image with the image generation tool and save it in "
            f"this directory as {item['id']}.png.", "", STYLE_RULES, "",
            f"Item: \"{item['name']}\" — a cosmetic {item['category']} for the game.",
            "Design a COMPLETELY NEW take on this item — invent the shapes and "
            "details yourself; do not imitate any previous version.",
        ]
    else:
        # CAMERA-ONLY revise. Both earlier sweeps over-flattened because the
        # prompt itself said "flat illustration / simple shapes" — the model
        # obeyed. The reference image carries the style; the text constrains
        # ONLY the camera and occlusion. Full 3D rendering, zero 3D rotation.
        lines = [
            "Generate ONE image with the image generation tool and save it in "
            f"this directory as {item['id']}.png.", "",
            f"The {ordinal} is the current sprite of \"{item['name']}\", a "
            f"cosmetic {item['category']} from our game. REPAINT IT AS "
            "FAITHFULLY AS POSSIBLE: the same object, same design, same "
            "colors, same materials, same bold outline, same glossy candy "
            "highlights, same soft volumetric shading, same chunky toy-like "
            "volume, same charm. Someone comparing the two should believe it "
            "is the same object.", "",
            "THE ONLY CHANGE IS THE CAMERA — a dead-on FRONT ELEVATION at the "
            "item's own eye level. Zero yaw, zero pitch: no three-quarter "
            "angle, no top-down tilt. Like a photograph of the real item "
            "taken straight-on: you still see all of its rounded volume and "
            "shine, but the near side hides the far side. Therefore NEVER "
            "visible: the far side of any band or ring, a back-of-brim rising "
            "behind the crown, the interior of any opening, or straps that "
            "would pass behind a wearer's head. This is a camera instruction, "
            "NOT a style instruction — keep the full dimensional, glossy, "
            "juicy cartoon rendering of the original completely intact.", "",
            "Technical: single item centered on a fully transparent "
            "background, small margin, square 1024x1024.",
        ]
    if with_pig:
        which = "attached image" if mode == "fresh" else "second attached image"
        lines.append(f"The {which} is Rosie, the pig who WEARS this item. Use "
                     "her ONLY to judge scale, proportions and how the item "
                     "should sit on her — do NOT draw the pig or any part of "
                     "her in the output. Output the item alone on transparency.")
    hint = CATEGORY_HINT.get(item["category"])
    if hint:
        lines.append(hint)
    reason = FLAGGED.get(item["id"])
    if reason and mode != "fresh":
        lines.append(f"Known problem with the current sprite to fix: {reason}.")
    if notes:
        lines.append(f"Art direction from the designer (follow this closely): {notes}")
    return "\n".join(lines)


def process_to_sprite(raw_path, out_path, margin=0.06):
    """Crop to glyph, recenter with margin, downscale to 256 (matches process_cosmetic)."""
    from PIL import Image
    im = Image.open(raw_path).convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError("empty image after generation")
    glyph = im.crop(bbox)
    gw, gh = glyph.size
    side = round(max(gw, gh) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(glyph, ((side - gw) // 2, (side - gh) // 2), glyph)
    canvas.resize((256, 256), Image.LANCZOS).save(out_path)


def render_pig_preview(item_id, sprite_repo_rel, out_path):
    it = CATALOG[item_id]
    img = pp.render(item_id, it["category"], sprite_repo_rel)
    if img is not None:
        img.save(out_path)


JOBS = queue.Queue()


def worker():
    while True:
        item_id, notes, mode, with_pig = JOBS.get()
        item = CATALOG.get(item_id)
        if not item:
            continue
        set_item(item_id, status="generating", error=None)
        raw = os.path.join(STAGE_RAW, item_id + ".png")
        if os.path.isfile(raw):
            os.remove(raw)
        try:
            # NB: -i is variadic — a positional prompt after it gets eaten as an
            # image path, so the prompt goes in via stdin. Fresh mode attaches
            # no old-art reference; with_pig adds Rosie for scale/fit context.
            refs = []
            if mode != "fresh":
                refs.append(os.path.join(ROOT, item["src"]))
            if with_pig:
                refs.append(pp.PIG_SPRITE)
            cmd = ["codex", "exec", "--skip-git-repo-check",
                   "--enable", "image_generation",
                   "--sandbox", "workspace-write", "-C", STAGE_RAW]
            if refs:
                cmd += ["-i"] + refs
            cmd += ["-"]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=480,
                               input=build_prompt(item, notes, mode, with_pig))
            if not os.path.isfile(raw):
                raise RuntimeError((r.stdout or r.stderr or "no image produced")[-400:])
            proc = os.path.join(STAGE_PROC, item_id + ".png")
            process_to_sprite(raw, proc)
            # staged on-pig preview: render from the staging dir via a repo-relative path
            rel = os.path.relpath(proc, ROOT)
            render_pig_preview(item_id, rel, os.path.join(STAGE_PREV, item_id + ".png"))
            set_item(item_id, status="staged", notes=notes, stagedAt=time.time())
        except Exception as e:
            set_item(item_id, status="error", error=str(e)[:400])


# Three parallel generation lanes — Codex imagegen calls are API-bound, so a
# small pool triples batch throughput without stressing the box.
for _ in range(3):
    threading.Thread(target=worker, daemon=True).start()


NO_PLACEMENT = {"aura", "background", "tickle_particle"}
PLACEMENT_API = "http://127.0.0.1:8124"
DEPRECATE_SQL = os.path.join(ROOT, "supabase/migrations",
                             "20260738500000_deprecate_items.sql")


def write_deprecation_migration():
    """Rebuild-all: one migration holding every studio-deprecated item.
    Regenerated on each toggle; deleted when the list empties. Mirrors the
    gas_mask precedent (20260652): a bare DELETE is safe — FK cascades remove
    user_hats ownership, unequip wearers (SET NULL), and close open Troughs.
    Never pushed from here; it rides the normal reviewed 'db push' batch."""
    ids = sorted(i for i, st in STATE.items() if st.get("status") == "deprecated")
    if not ids:
        if os.path.isfile(DEPRECATE_SQL):
            os.remove(DEPRECATE_SQL)
        return
    lines = [
        "-- AUTO-GENERATED by tools/regen_studio (Deprecate action) — rebuild-all,",
        "-- edit via the studio, not by hand. Removes items from the game entirely.",
        "-- Safe as bare DELETEs (gas_mask precedent, 20260652): FK cascades clean",
        "-- user_hats / equipped slots / item_drives / achievement rewards.",
        "--",
        "-- Push-day client cleanup checklist (art can lag the DB harmlessly):",
    ]
    for i in ids:
        reason = (STATE[i].get("deprecateReason") or "").strip()
        lines.append(f"--   [ ] {i}: drop from HAT_IMAGES / members catalog + delete "
                     f"assets/images/hats/{i}.png" + (f"  ({reason})" if reason else ""))
    lines.append("")
    for i in ids:
        lines.append(f"DELETE FROM public.hats WHERE id = '{i}';")
    open(DEPRECATE_SQL, "w").write("\n".join(lines) + "\n")


def effective_spec(item_id):
    s = pp.REL.get(item_id) or pp.CATEGORY_REL.get(CATALOG[item_id]["category"])
    if not s:
        return None
    return {"pivot": {"x": s["pivot"][0], "y": s["pivot"][1]},
            "widthFrac": s["widthFrac"], "anchor": s["anchor"],
            "behind": bool(s.get("behind"))}


def save_placement(item_id, spec):
    """Single-item save routed through placement studio's rebuild-all lane, so
    hat_rel.generated.ts keeps exactly one writer + one format."""
    try:
        with urllib.request.urlopen(PLACEMENT_API + "/api/data", timeout=5) as r:
            hat_rel = json.load(r)["hatRel"]
    except OSError:
        raise RuntimeError("placement studio (8124) isn't running — start "
                           "tools/placement_studio.py first")
    hat_rel[item_id] = spec
    req = urllib.request.Request(PLACEMENT_API + "/api/save-rel",
                                 json.dumps(hat_rel).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        if not json.load(r).get("ok"):
            raise RuntimeError("save-rel refused")
    # keep this process's renderer in sync + drop stale previews
    pp.REL[item_id] = {"pivot": (spec["pivot"]["x"], spec["pivot"]["y"]),
                       "widthFrac": spec["widthFrac"], "anchor": spec["anchor"],
                       "behind": bool(spec.get("behind"))}
    for f in (os.path.join(PREVIEW_DIR, item_id + ".png"),
              os.path.join(STAGE_PREV, item_id + ".png")):
        if os.path.isfile(f):
            os.remove(f)
    staged = os.path.join(STAGE_PROC, item_id + ".png")
    if os.path.isfile(staged):
        render_pig_preview(item_id, os.path.relpath(staged, ROOT),
                           os.path.join(STAGE_PREV, item_id + ".png"))


def item_payload():
    out = []
    for i, it in CATALOG.items():
        st = STATE.get(i, {})
        staged = os.path.isfile(os.path.join(STAGE_PROC, i + ".png"))
        out.append({
            "id": i, "name": it["name"], "category": it["category"],
            "flagged": FLAGGED.get(i),
            "status": st.get("status") or "",
            "error": st.get("error"), "notes": st.get("notes") or "",
            "withPig": bool(st.get("withPig")),
            "curV": int(st.get("approvedAt") or 0),
            "newV": int(st.get("stagedAt") or 0),
            "staged": staged and st.get("status") in ("staged", "generating", "error"),
            "placeable": it["category"] not in NO_PLACEMENT,
            "spec": effective_spec(i) if it["category"] not in NO_PLACEMENT else None,
        })
    # flagged first, then staged/attention, then alpha
    out.sort(key=lambda x: (x["flagged"] is None, x["status"] == "", x["id"]))
    return out


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _png(self, path):
        if os.path.isfile(path):
            self._send(200, open(path, "rb").read(), "image/png")
        else:
            self._send(404, {"err": "missing"})

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/":
            self._send(200, open(os.path.join(ROOT, "tools/regen_studio.html"), "rb").read(),
                       "text/html; charset=utf-8")
        elif p == "/api/items":
            self._send(200, {"items": item_payload(),
                             "queue": JOBS.qsize()})
        elif p == "/api/anchors":
            self._send(200, {"rest": {k: {"x": v[0], "y": v[1]}
                                      for k, v in pp.REST_ANCHORS.items()}})
        elif p == "/img/pig.png":
            self._png(pp.PIG_SPRITE)
        elif p.startswith("/img/current/"):
            i = p.split("/")[-1][:-4]
            it = CATALOG.get(i)
            self._png(os.path.join(ROOT, it["src"]) if it else "")
        elif p.startswith("/img/preview/"):
            i = p.split("/")[-1][:-4]
            out = os.path.join(PREVIEW_DIR, i + ".png")
            if not os.path.isfile(out) and i in CATALOG:
                try:
                    render_pig_preview(i, CATALOG[i]["src"], out)
                except Exception:
                    pass
            self._png(out)
        elif p.startswith("/img/staged_prev/"):
            self._png(os.path.join(STAGE_PREV, p.split("/")[-1]))
        elif p.startswith("/img/staged/"):
            self._png(os.path.join(STAGE_PROC, p.split("/")[-1]))
        else:
            self._send(404, {"err": "nope"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        i = body.get("id")
        if i not in CATALOG:
            return self._send(400, {"err": "unknown id"})
        if self.path == "/api/regen":
            mode = body.get("mode") or "revise"   # revise = old art + prompt; fresh = clean slate
            with_pig = bool(body.get("withPig"))  # attach Rosie for scale/fit context
            set_item(i, status="queued", error=None, notes=body.get("notes") or "",
                     mode=mode, withPig=with_pig)
            JOBS.put((i, body.get("notes") or "", mode, with_pig))
            return self._send(200, {"ok": True})
        if self.path == "/api/ok":
            # OK on staged art = approve the replacement; OK on the current art
            # = mark it reviewed-good (no replacement needed).
            if os.path.isfile(os.path.join(STAGE_PROC, i + ".png")):
                self.path = "/api/approve"
            else:
                set_item(i, status="ok")
                return self._send(200, {"ok": True})
        if self.path == "/api/approve":
            proc = os.path.join(STAGE_PROC, i + ".png")
            if not os.path.isfile(proc):
                return self._send(400, {"err": "nothing staged"})
            dest = os.path.join(ROOT, CATALOG[i]["src"])
            shutil.copy2(dest, os.path.join(BACKUP_DIR, i + ".png"))
            shutil.copy2(proc, dest)
            prev = os.path.join(PREVIEW_DIR, i + ".png")
            if os.path.isfile(prev):
                os.remove(prev)  # re-render lazily from the new sprite
            # approvedAt versions the /img/current URL so browsers can't show
            # the pre-replace bitmap from their in-memory image cache.
            set_item(i, status="approved", approvedAt=time.time())
            return self._send(200, {"ok": True})
        if self.path == "/api/place":
            spec = body.get("spec") or {}
            try:
                if not (isinstance(spec.get("pivot"), dict)
                        and spec.get("anchor") in pp.REST_ANCHORS
                        and 0.05 <= float(spec.get("widthFrac", 0)) <= 2):
                    raise RuntimeError("bad spec")
                save_placement(i, {"pivot": {"x": float(spec["pivot"]["x"]),
                                             "y": float(spec["pivot"]["y"])},
                                   "widthFrac": float(spec["widthFrac"]),
                                   "anchor": spec["anchor"],
                                   "behind": bool(spec.get("behind"))})
            except (RuntimeError, ValueError, KeyError) as e:
                return self._send(400, {"err": str(e)})
            return self._send(200, {"ok": True, "spec": effective_spec(i)})
        if self.path == "/api/deprecate":
            # Toggle: deprecate ⇄ restore. Each change rewrites the single
            # removal migration so the file always mirrors the studio state.
            cur = STATE.get(i, {}).get("status")
            if cur == "deprecated":
                # Restore — and if a staged regen was pending, resurface it.
                back = "staged" if os.path.isfile(
                    os.path.join(STAGE_PROC, i + ".png")) else ""
                set_item(i, status=back, deprecateReason=None)
            else:
                set_item(i, status="deprecated",
                         deprecateReason=body.get("reason") or "")
            write_deprecation_migration()
            return self._send(200, {"ok": True})
        if self.path == "/api/decline":
            # Keep the staged files — decline is a decision, not a deletion, so
            # Undo can bring the candidate back. The next regen overwrites them.
            set_item(i, status="declined")
            return self._send(200, {"ok": True})
        if self.path == "/api/undo":
            cur = STATE.get(i, {}).get("status")
            has_staged = os.path.isfile(os.path.join(STAGE_PROC, i + ".png"))
            if cur == "approved":
                # Put the backed-up old sprite back live; the new art returns
                # to staged so the choice can be remade.
                bak = os.path.join(BACKUP_DIR, i + ".png")
                if not os.path.isfile(bak):
                    return self._send(400, {"err": "no backup to restore"})
                shutil.copy2(bak, os.path.join(ROOT, CATALOG[i]["src"]))
                prev = os.path.join(PREVIEW_DIR, i + ".png")
                if os.path.isfile(prev):
                    os.remove(prev)
                set_item(i, status="staged" if has_staged else "",
                         approvedAt=time.time())  # bump curV → cache refetch
            elif cur in ("ok", "declined"):
                set_item(i, status="staged" if (cur == "declined" and has_staged) else "")
            else:
                return self._send(400, {"err": "nothing to undo"})
            return self._send(200, {"ok": True})
        self._send(404, {"err": "nope"})


if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Regen Studio → http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
