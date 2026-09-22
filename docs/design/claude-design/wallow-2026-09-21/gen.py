#!/usr/bin/env python3
"""Wallow rank sheet — three directions as phone artboards.

Run from the repo root:
  python3 docs/design/claude-design/wallow-2026-09-21/gen.py                 # local review page (index.html)
  python3 docs/design/claude-design/wallow-2026-09-21/gen.py --dc blobs.json # Claude Design artboards → project/
Every colour / size below is a token from constants/theme.ts (web/tokens.css).
Rank maths mirror utils/wallow.ts defaults (25/25/5 % regen steps, cap 70 %;
visits 8h − 1h per rank, floor 3h); wearables per rank from constants/hats.ts.
"""
import base64, io, os, sys, json, datetime as dt
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, "..", "..", "..", ".."))

ART_SRC = {
    "rosie":     ("assets/images/sprites/rosie/face_1.png", 260),
    "aura1":     ("assets/images/prestige/wallow_aura_w1.png", 260),
    "aura2":     ("assets/images/prestige/wallow_aura_w2.png", 260),
    "aura3":     ("assets/images/prestige/wallow_aura_w3.png", 260),
    "aura4":     ("assets/images/prestige/wallow_aura_w4.png", 260),
    "aura5":     ("assets/images/prestige/wallow_aura_w5.png", 260),
    "crown":     ("assets/images/glyphs/crown.png", 96),
    "flame":     ("assets/images/glyphs/flame.png", 96),
    "lock":      ("assets/images/glyphs/lock.png", 96),
    "cap":       ("assets/images/hats/wallow_rookie_cap.png", 160),
    "specs":     ("assets/images/hats/wallow_bronze_specs.png", 160),
    "marsh":     ("assets/images/hats/wallow_marsh_crown.png", 160),
    "bow":       ("assets/images/hats/wallow_gilded_bow.png", 160),
    "trowel":    ("assets/images/hats/wallow_golden_trowel.png", 160),
    "sovereign": ("assets/images/hats/wallow_sovereign_crown.png", 160),
}
DC = "--dc" in sys.argv
BLOBS = json.load(open(sys.argv[sys.argv.index("--dc") + 1])) if DC else {}

def art(path, size):
    im = Image.open(os.path.join(REPO, path)).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def A_(k):
    return BLOBS[k] if DC else art(*ART_SRC[k])

# rank, label, tickle interval, visit gap, wearable name, art key
RANKS = [
    (0, "Unwallowed",    "1h",  "8h", None,                     None),
    (1, "Wallow Rank 1", "45m", "7h", "Rookie Wallow Cap",      "cap"),
    (2, "Wallow Rank 2", "30m", "6h", "Bronze Wallow Specs",    "specs"),
    (3, "Wallow Rank 3", "27m", "5h", "Marsh Crown",            "marsh"),
    (4, "Wallow Rank 4", "24m", "4h", "Gilded Wallow Bow",      "bow"),
    (5, "Wallow Rank 5", "21m", "3h", "Golden Wallow Trowel",   "trowel"),
    (6, "Wallow Rank 6", "18m", "3h", "Wallow Sovereign Crown", "sovereign"),
]
# demo state: a fresh pig, 1,240 of the 3,000 XP a pass takes
NOW, XP, XP_FULL = 0, 1240, 3000

CSS = """
:root{--ink:#2a1f15;--paper:#fffaf0;--cream:#fbeee2;--cream2:#f6e6d4;--mute:#605449;--ui-muted:#8c7e71;
--rose:#ffd6dc;--sky:#c8e3f0;--sage:#c9dec1;--sun:#ffd87a;--lilac:#d6c8f0;--peach:#ffc8a8;--slop-gold:#F5C44A;
--accent:#a03e2f;--success-text:#476436;
--r-sm:8px;--r-md:12px;--r-lg:14px;--r-xl:18px;--r-pill:999px;
--s-xxs:2px;--s-xs:4px;--s-sm:8px;--s-md:12px;--s-card:14px;--s-lg:16px;--s-xl:24px;--s-xxl:32px;--page-pad:18px;
--shadow:4px 4px 0 var(--ink);--shadow-sm:2px 2px 0 var(--ink);}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font-family:"Nunito","Trebuchet MS",sans-serif;font-weight:700;font-size:15px;line-height:21px}
img{display:block}
/* type roles */
.sectionTitle{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:22px;line-height:24px;letter-spacing:.2px}
.cardTitle{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:18px;line-height:22px;letter-spacing:.2px}
.cardTitleSm{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:15px;line-height:20px;letter-spacing:.2px}
.numeralLg{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:26px;line-height:28px}
.numeral{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:18px;line-height:22px}
.body{font-size:15px;line-height:21px}.bodySm{font-size:13px;line-height:18px}
.hand{font-family:"Patrick Hand",cursive;font-weight:400;font-size:15px;line-height:20px}
.handSm{font-family:"Patrick Hand",cursive;font-weight:400;font-size:13px;line-height:17px}
.kicker{font-family:"Patrick Hand",cursive;font-weight:400;font-size:13px;line-height:18px;letter-spacing:.4px;color:var(--accent);white-space:nowrap}
.kickerPill{font-weight:800;font-size:11px;line-height:14px;letter-spacing:1.6px;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.label{font-weight:800;font-size:12px;line-height:16px;letter-spacing:.3px}
.mute{color:var(--mute)}.accent{color:var(--accent)}.center{text-align:center}.strike{text-decoration:line-through;color:var(--ui-muted);font-weight:700}
/* phone + sheet chrome (components/ui/Sheet.tsx) */
.phone{position:relative;width:390px;overflow:hidden;background:var(--cream);display:flex;flex-direction:column}
.scrim{flex:none;height:56px;background:rgba(42,31,21,.38)}
.sheet{flex:1;background:var(--paper);border:2px solid var(--ink);border-bottom:0;border-radius:var(--r-xl) var(--r-xl) 0 0;padding:var(--s-md) var(--page-pad) var(--s-xl);display:flex;flex-direction:column}
.grab{width:40px;height:5px;border-radius:999px;background:var(--ui-muted);margin:0 auto var(--s-sm)}
.titleRow{display:flex;align-items:flex-start;gap:var(--s-sm)}
.titleCol{flex:1;min-width:0;padding-top:var(--s-sm);display:flex;flex-direction:column;gap:2px}
.close{flex:none;width:44px;height:44px;border-radius:999px;border:2px solid var(--ink);background:var(--paper);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer}
.sbody{padding-top:var(--s-md);display:flex;flex-direction:column;gap:var(--s-md)}
/* sticker */
.sticker{position:relative;background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow);padding:var(--s-card)}
.sticker.sm{box-shadow:var(--shadow-sm)}.sticker.flat{box-shadow:none}.sticker.l{transform:rotate(-.6deg)}.sticker.r{transform:rotate(.6deg)}
.sun{background:var(--sun)}.cream2{background:var(--cream2)}.rose{background:var(--rose)}.sage{background:var(--sage)}
.tape{position:absolute;top:-10px;left:18px;padding:0 8px;height:20px;line-height:18px;background:var(--sun);border:1px solid var(--ink);border-radius:2px;transform:rotate(-4deg);font-family:"Patrick Hand",cursive;font-size:13px;opacity:.96}
.tape.paper{background:var(--paper)}
.ribbon{position:absolute;top:-10px;right:14px;background:var(--sun);border:2px solid var(--ink);border-radius:var(--r-sm);padding:2px 8px;font-weight:900;font-size:10px;letter-spacing:1.4px;box-shadow:var(--shadow-sm);transform:rotate(2deg)}
.ribbon.paper{background:var(--paper)}
/* portrait: aura ring + pig core at 57 % (PrestigeAvatar) */
.portrait{position:relative;flex:none}
.portrait .aura{position:absolute;inset:0;width:100%;height:100%}
.portrait .core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:57%;height:57%;object-fit:contain}
.portrait.bare .core{width:88%;height:88%}
.portrait .ghost{position:absolute;inset:6%;border:2px dashed var(--ui-muted);border-radius:50%}
/* rank decal */
.decal{flex:none;display:flex;align-items:center;justify-content:center;border:2px solid var(--ink);border-radius:var(--r-lg);background:var(--paper)}
.decal.sun{background:var(--sun)}.decal.dim{border-color:var(--ui-muted);background:var(--cream2)}
.decal img{width:78%;height:78%;object-fit:contain}
/* controls */
.btn{display:flex;align-items:center;justify-content:center;gap:var(--s-sm);min-height:44px;padding:9px 18px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:22px;box-shadow:var(--shadow-sm);font:inherit;font-weight:800;font-size:15px;letter-spacing:.2px;white-space:nowrap;width:100%;cursor:pointer}
.btn.ghost{border-color:var(--ui-muted);box-shadow:none}
.btn.sm{min-height:36px;padding:6px 14px;font-size:13px;width:auto}
.btn.sun{background:var(--sun)}
.handlink{display:inline-flex;align-items:center;min-height:32px;padding:0;background:none;border:0;font-family:"Patrick Hand",cursive;font-size:15px;color:var(--accent);cursor:pointer}
.btn img{width:20px;height:20px}
.tag{display:inline-flex;align-items:center;border:2px solid var(--ink);border-radius:var(--r-sm);padding:1px 8px;font-weight:900;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;background:var(--paper);box-shadow:var(--shadow-sm)}
.tag.sun{background:var(--sun)}
/* rows + ledger */
.group{background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow-sm);overflow:hidden}
.row{display:flex;align-items:center;gap:var(--s-md);min-height:52px;padding:6px var(--s-card);border-top:1px solid var(--cream2)}
.row:first-child{border-top:0}
.row .txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.row .lock{width:18px;height:18px;opacity:.7}
.ledger{display:flex;flex-direction:column;gap:2px}
.ledger>div{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s-sm);min-height:24px}
/* xp bar */
.bar{height:14px;border:2px solid var(--ink);border-radius:999px;background:var(--paper);overflow:hidden}
.bar i{display:block;height:100%;background:var(--sun);border-right:2px solid var(--ink)}
.rail{display:flex;flex-direction:column;align-items:flex-start;padding-left:44px}
.rail i{display:block;width:2px;height:16px;background:var(--ui-muted)}
"""

def close_btn():
    return ('<button class="close" aria-label="Close">'
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>')

def header(kicker, title, subtitle=None):
    sub = f'<div class="hand mute">{subtitle}</div>' if subtitle else ""
    return (f'<div class="grab"></div><div class="titleRow"><div class="titleCol">'
            f'<div class="kicker">★ {kicker}</div><div class="sectionTitle">{title}</div>{sub}</div>{close_btn()}</div>')

def portrait(rank, size, ghost=False):
    aura = min(5, rank)
    if aura == 0:
        g = '<div class="ghost"></div>' if ghost else ""
        return f'<div class="portrait bare" style="width:{size}px;height:{size}px">{g}<img class="core" src="{A_("rosie")}" alt="Rosie"></div>'
    return (f'<div class="portrait" style="width:{size}px;height:{size}px"><img class="aura" src="{A_(f"aura{aura}")}" alt="">'
            f'<img class="core" src="{A_("rosie")}" alt="Rosie, Wallow Rank {rank}"></div>')

def decal(key, size, tone=""):
    return f'<div class="decal {tone}" style="width:{size}px;height:{size}px"><img src="{A_(key)}" alt=""></div>'

def xp_bar():
    pct = round(XP / XP_FULL * 100)
    return (f'<div class="bar" role="progressbar" aria-valuenow="{XP}" aria-valuemin="0" aria-valuemax="{XP_FULL}"><i style="width:{pct}%"></i></div>'
            f'<div class="handSm mute">{XP:,} / {XP_FULL:,} XP into this pass</div>')

def how_to_wallow(compact=False):
    line = "Finish a season pass, then Wallow on the Season tab. Your rank, auras and gear stay for good."
    return (f'<div class="sticker flat cream2" style="display:flex;flex-direction:column;gap:6px">'
            f'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div class="kickerPill accent">how to wallow</div>'
            f'<a class="handlink" href="#season">Season tab ›</a></div>'
            + ("" if compact else f'<div class="hand">{line}</div>')
            + xp_bar() + '</div>')

def gear_door(text):
    return f'<button class="btn ghost"><img src="{A_("crown")}" alt="">{text}</button>'

# ------------------------------------------------------------------ A · the ladder
def A():
    r0, r1 = RANKS[NOW], RANKS[NOW + 1]
    cur = (f'<div class="sticker sm l sun" style="display:flex;align-items:center;gap:12px"><div class="tape paper">you&#39;re here</div>'
           f'{portrait(NOW, 64)}<div style="flex:1;min-width:0"><div class="kickerPill">W{r0[0]} · now</div>'
           f'<div class="cardTitle">{r0[1]}</div><div class="bodySm mute">tickle every {r0[2]} · visits every {r0[3]}</div></div></div>')
    nxt = (f'<div class="sticker sm" style="display:flex;flex-direction:column;gap:8px"><div class="ribbon">next</div>'
           f'<div style="display:flex;align-items:center;gap:12px">{decal(r1[5], 64, "sun")}'
           f'<div style="flex:1;min-width:0"><div class="kickerPill accent">W{r1[0]} · one pass away</div>'
           f'<div class="cardTitle">{r1[4]}</div><div class="handSm mute">yours to wear, plus your first aura</div></div></div>'
           f'<div class="ledger bodySm"><div><span class="mute">Tickle refill</span><span><span class="strike">{r0[2]}</span> &nbsp;{r1[2]}</span></div>'
           f'<div><span class="mute">Friend visits</span><span><span class="strike">{r0[3]}</span> &nbsp;{r1[3]}</span></div></div></div>')
    rows = ""
    for r in RANKS[NOW + 2:]:
        rows += (f'<div class="row">{decal(r[5], 40, "dim")}<div class="txt"><div class="label">W{r[0]} · {r[4]}</div>'
                 f'<div class="handSm mute">tickle every {r[2]} · visits every {r[3]}</div></div><img class="lock" src="{A_("lock")}" alt="locked"></div>')
    later = f'<div class="group">{rows}</div>'
    rail = '<div class="rail"><i></i></div>'
    return header("your prestige", "Wallow rank") + f'<div class="sbody" style="gap:0"><div style="display:flex;flex-direction:column;gap:0;padding-top:8px">{cur}{rail}{nxt}{rail}{later}</div><div style="height:16px"></div>{how_to_wallow()}<div style="height:12px"></div>{gear_door("prestige gear ›")}</div>'

# ------------------------------------------------------------------ B · now & next
def B():
    r0, r1 = RANKS[NOW], RANKS[NOW + 1]
    def stat(v, l, hot=False):
        return f'<div style="display:flex;flex-direction:column;align-items:center"><div class="numeral{" accent" if hot else ""}">{v}</div><div class="handSm mute">{l}</div></div>'
    now = (f'<div class="sticker l" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:18px"><div class="tape paper">now</div>'
           f'{portrait(NOW, 84)}<div class="cardTitle">W{r0[0]}</div><div class="handSm mute" style="margin-top:-4px">{r0[1]}</div>'
           f'<div style="display:flex;gap:18px;padding-top:6px;border-top:1px dashed var(--ui-muted);width:100%;justify-content:center">{stat(r0[2],"per tickle")}{stat(r0[3],"per visit")}</div></div>')
    nxt = (f'<div class="sticker r sun" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:18px"><div class="ribbon paper">next</div>'
           f'<div style="position:relative">{portrait(1, 84)}<div style="position:absolute;left:-16px;top:-8px">{decal(r1[5], 40)}</div></div>'
           f'<div class="cardTitle">W{r1[0]}</div><div class="handSm" style="margin-top:-4px;text-align:center">{r1[4]}</div>'
           f'<div style="display:flex;gap:18px;padding-top:6px;border-top:1px dashed var(--ink);width:100%;justify-content:center">{stat(r1[2],"per tickle",True)}{stat(r1[3],"per visit",True)}</div></div>')
    pair = f'<div style="display:flex;gap:14px;padding-top:6px">{now}{nxt}</div>'
    foot = (f'<div style="display:flex;justify-content:center"><a class="handlink" href="#ladder">see all six ranks ›</a></div>')
    return header("your prestige", "Wallow rank") + f'<div class="sbody">{pair}{how_to_wallow()}{gear_door("prestige gear · 6 wearables ›")}{foot}</div>'

# ------------------------------------------------------------------ C · the portrait
def C():
    r0, r1 = RANKS[NOW], RANKS[NOW + 1]
    hero = (f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:4px">{portrait(NOW, 148, ghost=True)}'
            f'<div style="display:flex;align-items:center;gap:8px"><span class="tag sun">W{r0[0]}</span><span class="sectionTitle">{r0[1]}</span></div>'
            f'<div class="hand mute">a tickle every {r0[2]} · friend visits every {r0[3]}</div></div>')
    nxt = (f'<div class="sticker sm" style="display:flex;flex-direction:column;gap:10px"><div class="ribbon">next · W{r1[0]}</div>'
           f'<div style="display:flex;align-items:center;gap:12px">{decal(r1[5], 72, "sun")}<div style="flex:1;min-width:0">'
           f'<div class="kickerPill accent">reach W{r1[0]}</div><div class="cardTitle">{r1[4]}</div><div class="handSm mute">worn only by pigs who&#39;ve wallowed</div></div></div>'
           f'<div class="ledger bodySm"><div><span class="mute">Tickle refill</span><span><span class="strike">{r0[2]}</span> &nbsp;{r1[2]}</span></div>'
           f'<div><span class="mute">Friend visits</span><span><span class="strike">{r0[3]}</span> &nbsp;{r1[3]}</span></div>'
           f'<div><span class="mute">Aura ring</span><span>your first</span></div></div>'
           f'<div style="border-top:1px dashed var(--ui-muted);padding-top:8px;display:flex;flex-direction:column;gap:4px">{xp_bar()}</div></div>')
    return header("your prestige", "Wallow rank") + f'<div class="sbody" style="gap:16px">{hero}{nxt}{how_to_wallow(compact=True)}{gear_door("prestige gear ›")}</div>'

BOARDS = [
    ("A_ladder",   "A · The ladder",   A, 980),
    ("B_now_next", "B · Now & next",   B, 760),
    ("C_portrait", "C · The portrait", C, 860),
]
BRIEFS = {
    "A": "One rail, top to bottom: where you are, the next rung with its wearable and the two numbers that change, then every rung after it with its prize and a lock. The set is visible — Collect — and the pass is the way up it — Contend.",
    "B": "Two stickers side by side: the pig as she is, the pig as she'll be — aura on, cap on, the two numbers gone hot. Cheapest read of ‘what do I get’. The full ladder is one link away.",
    "C": "Closest to today's shape. Rosie big at the top with a dashed ring where her first aura will sit; one Next sticker carries the wearable, the ledger and the XP bar; the how-to line shrinks to a kicker.",
}
WRONG = ("What's wrong today\n"
         "1. The rank is stated three times — subtitle, decal, CURRENT line.\n"
         "2. The connector drops from W0 into a text block; W1 sits far right. The track doesn't track.\n"
         "3. The Next box is a borderless tint — outside the sticker system.\n"
         "4. A prestige surface with no art: the aura rings and six wearables exist and never appear.\n"
         "5. The reward is a footnote (‘+ exclusive W1 wearable’); the deltas read as a settings table with arrows.\n"
         "6. ‘Reach W1’ never says how. Wallowing happens on the Season tab.\n"
         "7. ‘prestige gear · 0 earned’ advertises zero.")
VERDICT = ("Recommendation: A, with C's ghost ring\n"
           "The ladder is the pass track's cousin and the Collect pillar's ask — you can see the set. Keep C's dashed ‘first aura’ ring on the W0 portrait so a fresh pig sees what the ring is for. "
           "Needs the pass XP on the Me tab (Account doesn't fetch it today) — the ‘how to wallow’ bar is the one new data need. Deltas never use arrows: old value struck, new value beside it.")

def phone(inner, h):
    return f'<div class="phone" style="height:{h}px"><div class="scrim"></div><div class="sheet">{inner}</div></div>'

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;display=swap">'

def dc_board(title, inner, h):
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
<style>{CSS}</style>
</helmet>
<div style="width: 390px; height: {h}px; box-sizing: border-box; overflow: hidden; background: #fbeee2;">
{phone(inner, h)}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

def today_board(h):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Today</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>body{{margin:0}}</style>
</helmet>
<div style="width: 390px; height: {h}px; box-sizing: border-box; overflow: hidden; background: #fbeee2;">
<img src="{BLOBS['today']}" alt="The Wallow rank sheet as shipped in build 194" style="width: 390px; height: {h}px; object-fit: cover; object-position: top;">
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

if DC:
    out = os.path.join(ROOT, "project"); os.makedirs(out, exist_ok=True)
    boards, order, notes = {}, [], {}
    TODAY_H = 465
    x, y = 0, 0
    # today, then the three directions in one row
    boards["Main.dc.html"] = {"x": x, "y": y, "w": 390, "h": TODAY_H, "title": "Today · build 194"}
    with open(os.path.join(out, "Main.dc.html"), "w") as f: f.write(today_board(TODAY_H))
    order.append("Main.dc.html")
    notes["wrong"] = {"x": x, "y": y + TODAY_H + 40, "w": 390, "text": WRONG, "size": "s"}
    x += 470
    for stem, title, fn, h in BOARDS:
        fname = f"{stem}.dc.html"
        with open(os.path.join(out, fname), "w") as f: f.write(dc_board(title, fn(), h))
        boards[fname] = {"x": x, "y": y, "w": 390, "h": h, "title": title}
        order.append(fname)
        notes[f"n_{stem}"] = {"x": x, "y": y + h + 40, "w": 390, "text": BRIEFS[stem[0]], "size": "s"}
        x += 470
    notes["t"] = {"x": 0, "y": -300, "text": "Wallow rank sheet · 21 Sep 2026", "kind": "title1", "maxW": 1800}
    notes["verdict"] = {"x": 0, "y": 1300, "w": 860, "text": VERDICT, "size": "m", "color": "orange"}
    canvas = {"v": 3, "createdOnFiles": {"v": 1, "at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")},
              "title": "Wallow rank sheet", "launch": {"view": "canvas"}, "pages": [], "boards": boards,
              "order": order, "notes": notes, "designSystems": []}
    json.dump(canvas, open(os.path.join(out, "canvas.json"), "w"), indent=1)
    print("wrote", len(order), "artboards + canvas.json →", out)
else:
    cols = ""
    for stem, title, fn, h in BOARDS:
        cols += f'<div class="board"><div class="cap">{title}</div>{phone(fn(), h)}<p class="brief">{BRIEFS[stem[0]]}</p></div>'
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Wallow rank sheet · directions</title>{FONTS.replace("&amp;","&")}
<style>{CSS}
body{{background:#e9dccb;padding:32px 24px}}
.boards{{display:flex;gap:40px;align-items:flex-start;justify-content:center;flex-wrap:wrap}}
.board{{display:flex;flex-direction:column;gap:10px;align-items:center;width:390px}}
.board .cap{{font-family:"Patrick Hand",cursive;font-size:16px;color:var(--mute)}}
.board .phone{{border:2px solid var(--ink);border-radius:36px;box-shadow:var(--shadow)}}
.brief{{font-size:14px;line-height:20px;color:var(--mute);margin:0}}
.wrong{{max-width:1240px;margin:0 auto 28px;white-space:pre-line;font-size:14px;line-height:21px}}
.verdict{{max-width:1240px;margin:28px auto 0;background:var(--sun);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow);padding:18px 20px;white-space:pre-line}}
</style></head><body>
<div class="wrong"><div class="sectionTitle">Wallow rank sheet · 21 Sep 2026</div>{WRONG}</div>
<div class="boards">{cols}</div>
<div class="verdict">{VERDICT}</div>
</body></html>"""
    with open(os.path.join(ROOT, "index.html"), "w") as f: f.write(page)
    print("wrote index.html")
