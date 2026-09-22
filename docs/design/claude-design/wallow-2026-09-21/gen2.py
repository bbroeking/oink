#!/usr/bin/env python3
"""Prestige gear rethink — page 2 of the Wallow rank canvas.

  python3 docs/design/claude-design/wallow-2026-09-21/gen2.py                        # local review: index2.html
  python3 docs/design/claude-design/wallow-2026-09-21/gen2.py --dc blobs.json canvas.json
      # artboards → project/, and canvas.json (as read from the canvas) patched with the new page

Shares gen.py's CSS (tokens from constants/theme.ts). Grant facts: constants/hats.ts (wearables),
constants/habitat.ts (Barn gifts + keepsakes), components/ui/PrestigeAvatar.tsx (rings),
supabase/migrations/20260779000000_prestige_curve_and_visit_window.sql (rank → wearable).
"""
import base64, io, os, sys, json
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, "..", "..", "..", ".."))
SRC = open(os.path.join(ROOT, "gen.py")).read()
CSS = SRC.split('CSS = """')[1].split('"""')[0]

ART_SRC = {
    "rosie":  ("assets/images/sprites/rosie/face_1.png", 260),
    "rosie_idle": ("assets/images/sprites/rosie/idle_1.png", 320),
    "aura1": ("assets/images/prestige/wallow_aura_w1.png", 260), "aura2": ("assets/images/prestige/wallow_aura_w2.png", 260),
    "aura3": ("assets/images/prestige/wallow_aura_w3.png", 260), "aura4": ("assets/images/prestige/wallow_aura_w4.png", 260),
    "aura5": ("assets/images/prestige/wallow_aura_w5.png", 260),
    "crown": ("assets/images/glyphs/crown.png", 96), "lock": ("assets/images/glyphs/lock.png", 96),
    "cap": ("assets/images/hats/wallow_rookie_cap.png", 160), "specs": ("assets/images/hats/wallow_bronze_specs.png", 160),
    "marsh": ("assets/images/hats/wallow_marsh_crown.png", 160), "bow": ("assets/images/hats/wallow_gilded_bow.png", 160),
    "trowel": ("assets/images/hats/wallow_golden_trowel.png", 160), "sovereign": ("assets/images/hats/wallow_sovereign_crown.png", 160),
    "keep_bronze": ("assets/images/habitat/prestige/wallow_keepsake_bronze.png", 160),
    "keep_silver": ("assets/images/habitat/prestige/wallow_keepsake_silver.png", 160),
    "keep_gold": ("assets/images/habitat/prestige/wallow_keepsake_gold.png", 160),
    "keep_celestial": ("assets/images/habitat/prestige/wallow_keepsake_celestial.png", 160),
    "garland": ("assets/images/habitat/dried_herb_garland.png", 160), "bunting": ("assets/images/habitat/barn_bunting.png", 160),
    "rug": ("assets/images/habitat/muddy_paw_rug.png", 160), "chair": ("assets/images/habitat/reading_chair.png", 160),
    "radio": ("assets/images/habitat/tiny_radio.png", 160), "rafters": ("assets/images/habitat/midnight_rafters.png", 160),
    "shelf": ("assets/images/habitat/shelf_plank.png", 160),
}
DC = "--dc" in sys.argv
BLOBS = json.load(open(sys.argv[sys.argv.index("--dc") + 1])) if DC else {}

def art(path, size):
    im = Image.open(os.path.join(REPO, path)).convert("RGBA"); im.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
def A_(k): return BLOBS[k] if DC else art(*ART_SRC[k])

# rank, tickle, visits, wearable, slot today, art, barn gift (price), gift art, keepsake, keepsake art
GRANTS = [
    (1, "45m", "7h", "Rookie Wallow Cap",      "hat",     "cap",       "Dried Herb Garland", 50,  "garland", "Bronze",    "keep_bronze"),
    (2, "30m", "6h", "Bronze Wallow Specs",    "glasses", "specs",     "Barn Bunting",       100, "bunting", None,        None),
    (3, "27m", "5h", "Marsh Crown",            "hat",     "marsh",     "Muddy Paw Rug",      100, "rug",     "Silver",    "keep_silver"),
    (4, "24m", "4h", "Gilded Wallow Bow",      "bow",     "bow",       "Reading Chair",      100, "chair",   None,        None),
    (5, "21m", "3h", "Golden Wallow Trowel",   "held",    "trowel",    "Tiny Radio",         175, "radio",   None,        None),
    (6, "18m", "3h", "Wallow Sovereign Crown", "hat",     "sovereign", "Midnight Rafters",   175, "rafters", "Gold",      "keep_gold"),
]
# Direction D re-slots the set so all six can be worn at once.
D_SLOT = {1: "hat", 2: "glasses", 3: "neck", 4: "bow", 5: "held", 6: "hat · trades the cap"}
D_NAME = {3: "Marsh Wreath"}

EXTRA_CSS = """
.map{font-size:13px;line-height:18px}
.map table{border-collapse:separate;border-spacing:0;width:100%}
.map th{text-align:left;padding:6px 10px;font-weight:800;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--mute);border-bottom:2px solid var(--ink)}
.map td{padding:6px 10px;border-bottom:1px solid var(--cream2);vertical-align:middle}
.map td.art{white-space:nowrap}
.map td.art img{display:inline-block;vertical-align:middle;width:36px;height:36px;object-fit:contain;margin-right:8px}
.map tr.home td{border-bottom:0;padding-top:10px;color:var(--accent);font-family:"Patrick Hand",cursive;font-size:14px;line-height:18px;vertical-align:top}
.map .rk{font-family:"Caprasimo",Georgia,serif;font-size:16px}
.chipw{display:inline-flex;align-items:center;gap:6px;border:2px solid var(--ink);border-radius:999px;padding:3px 10px;font-weight:800;font-size:12px;background:var(--paper);box-shadow:var(--shadow-sm);white-space:nowrap}
.chipw.on{background:var(--sun)}
.slot{font-family:"Patrick Hand",cursive;font-size:13px;color:var(--mute)}
.dash{border:2px dashed var(--ui-muted);border-radius:var(--r-lg);background:transparent;display:flex;align-items:center;justify-content:center;text-align:center;font-family:"Patrick Hand",cursive;font-size:12px;line-height:14px;color:var(--mute);padding:4px}
.stage{filter:none}.stage.s1{filter:sepia(1) saturate(.5) brightness(.55)}.stage.s2{filter:sepia(.8) saturate(1.2) brightness(.8)}.stage.s3{filter:grayscale(1) brightness(1.15)}.stage.s4{filter:none}.stage.s5{filter:saturate(1.3) brightness(1.08)}.stage.s6{filter:saturate(1.4) brightness(1.12) drop-shadow(0 0 6px #ffd87a)}
.plank{position:relative;height:96px;display:flex;align-items:flex-end;justify-content:space-around;padding:0 10px 14px}
.plank img.board{position:absolute;left:0;right:0;bottom:0;width:100%;height:20px;object-fit:fill}
.plank .it{width:64px;height:64px;display:flex;align-items:flex-end;justify-content:center}
.plank .it img{max-width:64px;max-height:64px;object-fit:contain}
.label2{position:absolute;left:12px;top:-10px}
.worn{position:relative;width:390px;height:520px}
.worn .abs{position:absolute}
.worn .tag2{position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px}
.worn .tag2 img{width:56px;height:56px;object-fit:contain}
.worn svg{position:absolute;inset:0;width:100%;height:100%}
"""

def close_btn():
    return ('<button class="close" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>')
def header(kicker, title, subtitle=None):
    sub = f'<div class="hand mute">{subtitle}</div>' if subtitle else ""
    return (f'<div class="grab"></div><div class="titleRow"><div class="titleCol"><div class="kicker">★ {kicker}</div>'
            f'<div class="sectionTitle">{title}</div>{sub}</div>{close_btn()}</div>')
def portrait(rank, size):
    aura = min(5, rank)
    if aura == 0:
        return f'<div class="portrait bare" style="width:{size}px;height:{size}px"><img class="core" src="{A_("rosie")}" alt="Rosie"></div>'
    return (f'<div class="portrait" style="width:{size}px;height:{size}px"><img class="aura" src="{A_(f"aura{aura}")}" alt="">'
            f'<img class="core" src="{A_("rosie")}" alt="Rosie, Wallow Rank {rank}"></div>')
def decal(key, size, tone="", cls=""):
    return f'<div class="decal {tone}" style="width:{size}px;height:{size}px"><img class="{cls}" src="{A_(key)}" alt=""></div>'
def xp_bar(xp=1240, full=3000):
    return (f'<div class="bar" role="progressbar" aria-valuenow="{xp}" aria-valuemin="0" aria-valuemax="{full}"><i style="width:{round(xp/full*100)}%"></i></div>'
            f'<div class="handSm mute">{xp:,} / {full:,} XP into this pass</div>')
def how_to(compact=True):
    return (f'<div class="sticker flat cream2" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
            f'<div class="kickerPill accent">how to wallow</div><a class="handlink" href="#season">Season tab ›</a></div>{xp_bar()}</div>')
def rail(): return '<div class="rail"><i></i></div>'

# ------------------------------------------------------------------ G · today's grant map (desktop board)
def G():
    rows = ""
    for r, t, v, wn, slot, wa, gn, gp, ga, kn, ka in GRANTS:
        keep = f'<td class="art"><img src="{A_(ka)}" alt="">{kn} keepsake</td>' if kn else '<td class="mute">—</td>'
        rows += (f'<tr><td class="rk">W{r}</td><td>tickle {t} · visits {v}</td>'
                 f'<td class="art"><img src="{A_(f"aura{min(5,r)}")}" alt="">ring {min(5,r)}{" (repeats)" if r==6 else ""}</td>'
                 f'<td class="art"><img src="{A_(wa)}" alt="">{wn} <span class="slot">· {slot}</span></td>'
                 f'<td class="art"><img src="{A_(ga)}" alt="">{gn} <span class="slot">· also sold, {gp} snouts</span></td>{keep}</tr>')
    home = ('<tr class="home"><td></td><td>the Season tab</td><td>every portrait, never the living pig</td>'
            '<td>Closet · Shop tab, ‘prestige’ filter<br>+ the Me row ‘Prestige gear · n earned’</td>'
            '<td>Barn Collection · ‘Wallow gifts’</td><td>Barn Collection · ‘Wallow gifts’</td></tr>')
    return (f'<div style="width:1180px;height:560px;box-sizing:border-box;padding:28px 32px;background:#fffaf0;display:flex;flex-direction:column;gap:14px" class="map">'
            f'<div><div class="kickerPill accent">today · what one Wallow gives, and where each gift lives</div>'
            f'<div class="sectionTitle">Five kinds of gift, four homes, and the rank sheet shows none of them</div></div>'
            f'<table><thead><tr><th>rank</th><th>clock</th><th>ring</th><th>wearable</th><th>barn gift</th><th>keepsake</th></tr></thead>'
            f'<tbody>{rows}{home}</tbody></table>'
            f'<div class="hand mute">Three of six wearables are hats, so a W6 pig can wear four of them at most. The Barn gift is a coupon for a shop item. Keepsakes are the only inscribed marks and skip W2 · W4 · W5. ‘Prestige gear’ names one column of five.</div></div>')

# ------------------------------------------------------------------ D · regalia: one set, one home (the sheet)
def D(now=1):
    def piece(r):
        g = GRANTS[r - 1]; return (D_NAME.get(r, g[3]), D_SLOT[r], g[5], g[9], g[10])
    n, s, a, kn, ka = piece(now)
    cur = (f'<div class="sticker sm l sun" style="display:flex;flex-direction:column;gap:10px"><div class="tape paper">you&#39;re here</div>'
           f'<div style="display:flex;align-items:center;gap:12px">{portrait(now, 64)}<div style="flex:1;min-width:0"><div class="kickerPill">W{now} · now</div>'
           f'<div class="cardTitle">Wallow Rank {now}</div><div class="bodySm mute">tickle every {GRANTS[now-1][1]} · visits every {GRANTS[now-1][2]}</div></div></div>'
           f'<div style="display:flex;align-items:center;gap:10px;border-top:1px dashed var(--ink);padding-top:10px">{decal(a, 48)}<div style="flex:1;min-width:0"><div class="label">{n}</div><div class="slot">{s} · regalia 1 of 6</div></div>'
           f'<button class="chipw on">wearing</button></div>'
           f'<div style="display:flex;align-items:center;gap:10px">{decal(ka, 48)}<div style="flex:1;min-width:0"><div class="label">{kn} Wallow Keepsake</div><div class="slot">on your Barn shelf</div></div><a class="handlink" href="#barn">Barn ›</a></div></div>')
    nn, ns, na, nkn, nka = piece(now + 1)
    keep = decal(nka, 48) if nka else f'<div class="dash" style="width:48px;height:48px">keepsake<br>new art</div>'
    nxt = (f'<div class="sticker sm" style="display:flex;flex-direction:column;gap:10px"><div class="ribbon">next</div>'
           f'<div style="display:flex;align-items:center;gap:12px">{decal(na, 64, "sun")}<div style="flex:1;min-width:0"><div class="kickerPill accent">W{now+1} · one pass away</div>'
           f'<div class="cardTitle">{nn}</div><div class="slot">{ns} · regalia 2 of 6</div></div></div>'
           f'<div class="ledger bodySm"><div><span class="mute">Tickle refill</span><span><span class="strike">{GRANTS[now-1][1]}</span> &nbsp;{GRANTS[now][1]}</span></div>'
           f'<div><span class="mute">Friend visits</span><span><span class="strike">{GRANTS[now-1][2]}</span> &nbsp;{GRANTS[now][2]}</span></div></div>'
           f'<div style="display:flex;align-items:center;gap:10px;border-top:1px dashed var(--ui-muted);padding-top:10px">{keep}<div style="flex:1;min-width:0"><div class="label">a {("Silver" if now+1==3 else "new")} keepsake for the shelf</div><div class="slot">inscribed W{now+1}</div></div></div></div>')
    rows = ""
    for r in range(now + 2, 7):
        pn, ps, pa, _, _ = piece(r)
        rows += (f'<div class="row">{decal(pa, 40, "dim")}<div class="txt"><div class="label">W{r} · {pn}</div><div class="slot">{ps} · tickle every {GRANTS[r-1][1]} · visits every {GRANTS[r-1][2]}</div></div><img class="lock" src="{A_("lock")}" alt="locked"></div>')
    later = f'<div class="group">{rows}</div>'
    return header("your prestige", "Wallow rank", f"W{now} · 1 of 6 regalia · 1 keepsake") + f'<div class="sbody" style="gap:0"><div style="display:flex;flex-direction:column;padding-top:8px">{cur}{rail()}{nxt}{rail()}{later}</div><div style="height:16px"></div>{how_to()}</div>'

def D_worn():
    # Rosie at W6 with the six pieces placed around her and a line to each slot.
    pieces = [("sovereign", "hat", 160, 18), ("specs", "glasses", 300, 120), ("marsh", "neck", 300, 250), ("bow", "bow", 30, 120), ("trowel", "held", 30, 250), ("aura5", "aura", 160, 420)]
    tags = "".join(f'<div class="tag2" style="left:{x}px;top:{y}px"><img src="{A_(k)}" alt=""><div class="slot">{s}</div></div>' for k, s, x, y in pieces)
    lines = ('<line x1="195" y1="90" x2="195" y2="140"/><line x1="300" y1="150" x2="250" y2="200"/><line x1="300" y1="280" x2="250" y2="270"/>'
             '<line x1="90" y1="150" x2="140" y2="210"/><line x1="90" y1="280" x2="140" y2="290"/><line x1="195" y1="420" x2="195" y2="380"/>')
    return (f'<div class="worn" style="background:#fbeee2"><svg viewBox="0 0 390 520" aria-hidden="true" style="stroke:#8c7e71;stroke-width:2;stroke-dasharray:4 4">{lines}</svg>'
            f'<div class="abs" style="left:75px;top:120px">{portrait(6, 240)}</div>'
            f'<div class="abs" style="left:110px;top:150px;width:170px;height:170px;display:flex;align-items:center;justify-content:center"><img src="{A_("rosie_idle")}" alt="Rosie at W6" style="width:150px;height:150px;object-fit:contain"></div>'
            f'{tags}<div class="abs kickerPill accent" style="left:16px;top:16px">the regalia, worn · W6</div></div>')

# ------------------------------------------------------------------ E · one crown that grows
STAGES = ["Mud band", "Bronze band", "Silver band", "Gold band", "Gilded", "Sovereign"]
def E(now=2):
    cur = (f'<div class="sticker sm l sun" style="display:flex;align-items:center;gap:12px"><div class="tape paper">you&#39;re here</div>'
           f'{decal("sovereign", 64, "", f"stage s{now}")}<div style="flex:1;min-width:0"><div class="kickerPill">W{now} · now</div><div class="cardTitle">Wallow Crown · {STAGES[now-1]}</div>'
           f'<div class="bodySm mute">tickle every {GRANTS[now-1][1]} · visits every {GRANTS[now-1][2]}</div></div><button class="chipw on">wearing</button></div>')
    nxt = (f'<div class="sticker sm" style="display:flex;flex-direction:column;gap:8px"><div class="ribbon">next</div>'
           f'<div style="display:flex;align-items:center;gap:12px">{decal("sovereign", 64, "sun", f"stage s{now+1}")}<div style="flex:1;min-width:0"><div class="kickerPill accent">W{now+1} · one pass away</div>'
           f'<div class="cardTitle">{STAGES[now]}</div><div class="slot">the crown grows · the ring matches</div></div></div>'
           f'<div class="ledger bodySm"><div><span class="mute">Tickle refill</span><span><span class="strike">{GRANTS[now-1][1]}</span> &nbsp;{GRANTS[now][1]}</span></div>'
           f'<div><span class="mute">Friend visits</span><span><span class="strike">{GRANTS[now-1][2]}</span> &nbsp;{GRANTS[now][2]}</span></div></div></div>')
    rows = "".join(f'<div class="row">{decal("sovereign", 40, "dim", f"stage s{r}")}<div class="txt"><div class="label">W{r} · {STAGES[r-1]}</div><div class="slot">tickle every {GRANTS[r-1][1]} · visits every {GRANTS[r-1][2]}</div></div><img class="lock" src="{A_("lock")}" alt="locked"></div>' for r in range(now + 2, 7))
    return header("your prestige", "Wallow rank", f"W{now} · {STAGES[now-1]}") + f'<div class="sbody" style="gap:0"><div style="display:flex;flex-direction:column;padding-top:8px">{cur}{rail()}{nxt}{rail()}<div class="group">{rows}</div></div><div style="height:16px"></div>{how_to()}</div>'

# ------------------------------------------------------------------ F · the Barn owns prestige: a Wallow shelf
def F(now=2):
    def shelf(r, locked=False):
        g = GRANTS[r - 1]
        items = [(g[10] or None, "keepsake"), (g[5], "wearable"), (g[8], "barn gift")]
        its = ""
        for k, lab in items:
            if locked or not k:
                its += f'<div class="it"><div class="dash" style="width:56px;height:56px">{"unlocks<br>at W"+str(r) if locked else "keepsake<br>new art"}</div></div>'
            else:
                its += f'<div class="it"><img src="{A_(k)}" alt="{lab}"></div>'
        return (f'<div class="sticker sm{" flat" if locked else ""}" style="padding:16px 6px 0"><div class="label2 tag{" sun" if r<=now else ""}">W{r}{"" if r<=now else " · locked"}</div>'
                f'<div class="plank"><img class="board" src="{A_("shelf")}" alt="">{its}</div>'
                f'<div style="display:flex;justify-content:space-around;padding:4px 0 10px" class="slot"><span>{(g[9]+" keepsake") if (g[9] and not locked) else "keepsake"}</span><span>{g[3] if not locked else "wearable"}</span><span>{g[6] if not locked else "barn gift"}</span></div></div>')
    body = "".join(shelf(r, locked=r > now) for r in (1, 2, 3))
    return (header("barn", "Your Wallow shelf", f"W{now} · {now} shelves filled") +
            f'<div class="sbody" style="gap:18px">{body}<div style="display:flex;justify-content:center"><a class="handlink" href="#ladder">W4 · W5 · W6 ›</a></div></div>')

BOARDS = [
    ("G_map",     "Today · the grant map",      G,      1180, 560,  True),
    ("D_regalia", "D · Regalia, one home",      D,      390,  1070, False),
    ("D_worn",    "D · the regalia, worn",      D_worn, 390,  520,  True),
    ("E_crown",   "E · One crown that grows",   E,      390,  880,  False),
    ("F_shelf",   "F · The Barn's Wallow shelf", F,     390,  760,  False),
]
BRIEFS = {
    "D": "Each rank grants one piece of a six-slot regalia (hat · glasses · neck · bow · held · aura) plus its ring and an inscribed keepsake. Re-slot W3's Marsh Crown as a neck wreath; W6's crown trades the rookie cap. The rank sheet is the one home: earned rungs say ‘wearing / wear it’, the keepsake links to the Barn. Cut the Closet's prestige filter and the Me row. Barn decor gifts leave the ladder and are just sold.",
    "E": "One wearable, the Wallow Crown, that gains a stage per rank and always sits on the head — the rank is legible on the living pig, not only on portraits. The ring becomes the crown's portrait form. Crown stages here are one art tinted; real stages are new art. The five finished wearables become the Prestige Path's Mystery Hat Box pool.",
    "F": "The Barn owns prestige. A Wallow shelf shows keepsake · wearable · gift per rank; visitors see it. The rank sheet's rungs open the shelf; the Closet filter and Me row are cut. Costs a tap to wear anything, and asks the Barn — a Connect surface — to be a trophy case too.",
}
WRONG = ("What's wrong with prestige gear today\n"
         "1. Five kinds of gift (clock · ring · wearable · Barn gift · keepsake) in four homes; no surface says ‘a Wallow gives you this’. The rank sheet, the only one that knows the rank, shows none of it.\n"
         "2. ‘Prestige gear’ names one of the five — the wearables — counted on a Me row and filtered inside the Shop tab. Earned status lives in the shop.\n"
         "3. Three hats in six ranks: a W6 pig wears four of six; the set never reads as a set.\n"
         "4. The Barn gift is also for sale (50–175 snouts) — a coupon, not a mark.\n"
         "5. Keepsakes are the real inscribed marks, and they skip W2 · W4 · W5. Rings stop at 5; W6 repeats W5.\n"
         "6. The ring is the only public mark and never touches the living pig.")
VERDICT = ("Recommendation: D — regalia, one home\n"
           "Keep the six finished wearables, make them one outfit, and let the rank sheet be the only place prestige is explained: ring · regalia piece · keepsake per rung, ‘wear it’ on earned rungs. Cut the Closet prestige filter and the Me ‘Prestige gear’ row (the Wallow row says ‘W2 · 2 of 6 regalia’). Barn decor gifts drop off the ladder and are simply sold; keepsakes fill W2 · W4 · W5 (three new frames). Serves Collect (a set that completes on the pig) and craft (one home, doors elsewhere). Data: re-slot two catalog rows and add three keepsake rows; Barn gifts untouched.")

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;display=swap">'
def phone(inner, h):
    return f'<div class="phone" style="height:{h}px"><div class="scrim"></div><div class="sheet">{inner}</div></div>'
def dc_board(title, inner, w, h):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>{CSS}{EXTRA_CSS}</style>
</helmet>
<div style="width: {w}px; height: {h}px; box-sizing: border-box; overflow: hidden; background: #fbeee2;">
{inner}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

if DC:
    out = os.path.join(ROOT, "project"); os.makedirs(out, exist_ok=True)
    canvas = json.load(open(sys.argv[sys.argv.index("--dc") + 2]))
    PAGE = "gear"
    pages = [p for p in canvas.get("pages", []) if p["id"] not in ("sheet", PAGE)]
    canvas["pages"] = [{"id": "sheet", "name": "1 · The sheet"}, {"id": PAGE, "name": "2 · Prestige gear"}] + pages
    canvas["boards"] = {k: v for k, v in canvas["boards"].items() if v.get("page") != PAGE}
    canvas["order"] = [k for k in canvas["order"] if k in canvas["boards"]]
    canvas["notes"] = {k: v for k, v in canvas.get("notes", {}).items() if v.get("page") != PAGE}
    x = 0
    for stem, title, fn, w, h, raw in BOARDS:
        inner = fn() if raw else phone(fn(), h)
        fname = f"{stem}.dc.html"
        with open(os.path.join(out, fname), "w") as f: f.write(dc_board(title, inner, w, h))
        y = 0 if stem == "G_map" else 700
        if stem != "G_map":
            canvas["boards"][fname] = {"x": x, "y": y, "w": w, "h": h, "title": title, "page": PAGE}
            if stem[0] in BRIEFS and not stem.endswith("worn"):
                canvas["notes"][f"g_{stem}"] = {"x": x, "y": y + h + 40, "w": 390, "text": BRIEFS[stem[0]], "size": "s", "page": PAGE}
            x += 470
        else:
            canvas["boards"][fname] = {"x": 0, "y": 0, "w": w, "h": h, "title": title, "page": PAGE}
        canvas["order"].append(fname)
    canvas["notes"]["g_title"] = {"x": 0, "y": -300, "text": "Prestige gear · rethink · 21 Sep 2026", "kind": "title1", "maxW": 1800, "page": PAGE}
    canvas["notes"]["g_wrong"] = {"x": 1260, "y": 0, "w": 560, "text": WRONG, "size": "s", "page": PAGE}
    canvas["notes"]["g_verdict"] = {"x": 0, "y": 1960, "w": 900, "text": VERDICT, "size": "m", "color": "orange", "page": PAGE}
    json.dump(canvas, open(os.path.join(out, "canvas.json"), "w"), indent=1)
    print("wrote", len(BOARDS), "artboards + patched canvas.json →", out)
else:
    cols = ""
    for stem, title, fn, w, h, raw in BOARDS:
        inner = fn() if raw else phone(fn(), h)
        cap = BRIEFS.get(stem[0], "") if not stem.endswith("worn") and stem[0] in BRIEFS else ""
        cols += f'<div class="board" style="width:{w}px"><div class="cap">{title}</div><div style="width:{w}px;height:{h}px;overflow:hidden;border:2px solid var(--ink);border-radius:24px;box-shadow:var(--shadow);background:#fbeee2">{inner}</div><p class="brief">{cap}</p></div>'
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Prestige gear · rethink</title>{FONTS.replace("&amp;","&")}
<style>{CSS}{EXTRA_CSS}
body{{background:#e9dccb;padding:32px 24px}}
.boards{{display:flex;gap:40px;align-items:flex-start;justify-content:center;flex-wrap:wrap}}
.board{{display:flex;flex-direction:column;gap:10px;align-items:center}}
.board .cap{{font-family:"Patrick Hand",cursive;font-size:16px;color:var(--mute)}}
.brief{{font-size:14px;line-height:20px;color:var(--mute);margin:0}}
.wrong{{max-width:1180px;margin:0 auto 28px;white-space:pre-line;font-size:14px;line-height:21px}}
.verdict{{max-width:1180px;margin:28px auto 0;background:var(--sun);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow);padding:18px 20px;white-space:pre-line}}
</style></head><body>
<div class="wrong"><div class="sectionTitle">Prestige gear · rethink · 21 Sep 2026</div>{WRONG}</div>
<div class="boards">{cols}</div>
<div class="verdict">{VERDICT}</div>
</body></html>"""
    with open(os.path.join(ROOT, "index2.html"), "w") as f: f.write(page)
    print("wrote index2.html")
