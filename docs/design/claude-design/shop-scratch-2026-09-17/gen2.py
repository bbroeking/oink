#!/usr/bin/env python3
"""Round 2 — A · The Counter, iterated. Founder: titles can be many, so the
fitting room's title chips become a row that opens a Titles picker (a list with
search); plus the All segment, the item sheet, and the Pen as its own screen."""
import json, os, datetime as dt
from gen import *  # tokens, pieces, blobs, round-1 boards

# ── The try-on bar, round 2: the chip says where it goes ─────────────────
def a_bar2():
    return f'''<div class="sticker flat" style="margin:10px 18px 0;padding:8px 10px;display:flex;flex-direction:column;gap:8px;position:relative;z-index:5;background:{PAPER}">
  <div class="row" style="gap:10px">
    <a href="A_FittingRoom.dc.html" class="window" style="width:56px;height:56px" aria-label="Open the fitting room"><img src="{B["rosie_dressed"]}" alt="Rosie"></a>
    <div class="col" style="flex:1;min-width:0;gap:2px"><div class="kicker">wearing 8 of 8</div><div class="hand mute" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Mud Baron Rosie</div></div>
    <a href="A_FittingRoom.dc.html" class="chip" style="min-height:30px;padding:2px 10px"><img src="{B["g_closet"]}" alt="">Fitting room</a>
  </div>
  {peg_row(size=30, gap=4, labels=False)}
</div>'''

def a_top2():
    body = header() + a_bar2()
    body += f'<div style="position:relative;flex:1;min-height:0;margin-top:12px;background:{CREAM2};background-image:repeating-linear-gradient(180deg,transparent 0 46px,rgba(42,31,21,.08) 46px 48px);border-top:2px solid {INK};padding-bottom:90px;overflow:hidden">'
    body += f'''<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px 0">
  {chalk()}
  <div style="display:flex;gap:6px;flex:none">{door("Pen", "g_pen").replace('href="#"', 'href="A_Pen.dc.html"')}{door("Furnish", "g_barn_door")}</div>
</div>'''
    s1 = shelf([shelf_slot("Candy Land", cost=711, afford=False), shelf_slot("Moth Waltz", cost=750, afford=False), shelf_slot("Sleep Mask", cost=114).replace('href="#"', 'href="A_ItemSheet.dc.html"')])
    s2 = shelf([shelf_slot("Sparkle Particle", cost=150), shelf_slot("Magic Wand", cost=533, afford=False), shelf_slot("Pumpkin Patch", cost=650, afford=False)])
    s3 = shelf([shelf_slot("Safety Goggles", cost=120), shelf_slot("Acorn Bow", "wearing"), '<div class="slot"></div>'])
    body += f'<div style="display:flex;flex-direction:column;gap:14px;padding:18px 18px 0">{s1}{s2}{s3}'
    sc = shelf([shelf_slot("Candlelit Circlet", "locked", 3000), shelf_slot("Moonlit Ballroom", "locked", 4200), shelf_slot("Crest Monocle", "locked", 3000)])
    body += f'<div class="band" style="margin-top:6px"><a href="A_Pen.dc.html" class="bsign"><img src="{B["g_crown"]}" alt="">Slop Club</a>{sc}</div></div></div>'
    body += tabbar()
    return page(body)

def a_everything2(segment="owned"):
    body = header() + a_bar2()
    body += f'<div style="position:relative;flex:1;min-height:0;margin-top:12px;padding:14px 18px 90px;display:flex;flex-direction:column;gap:12px;overflow:hidden">'
    if segment == "owned":
        body += section_crown("the whole rack", "Everything", "13 owned")
        body += '<div class="seg"><button class="on">Owned · 13</button><button>All · 127</button><button>Members</button></div>'
        chips = ["Hats", "Bows", "Face", "Neck", "Held", "Aura", "Tickles", "BG"]
        body += '<div style="display:flex;gap:6px;overflow:hidden">' + "".join(f'<a href="#" class="chip" style="min-height:30px;padding:2px 10px{";background:"+PEACH if l=="Hats" else ""}">{l}</a>' for l in chips) + '</div>'
        body += '<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="sectionTitle">Hats</div><div class="kickerPill">4 of 21 ⌄</div></div>'
        body += f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">{tile("Cowboy Hat","wearing")}{tile("Party Hat","owned")}{tile("Beanie","owned")}{tile("Leaf Crown","owned")}</div>'
        body += '<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="sectionTitle">Bows</div><div class="kickerPill">1 of 20 ⌄</div></div>'
        body += f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">{tile("Acorn Bow","wearing")}</div>'
    else:
        body += section_crown("the whole rack", "Everything", "127 designs")
        body += '<div class="seg"><button>Owned · 13</button><button class="on">All · 127</button><button>Members</button></div>'
        chips = ["Hats", "Bows", "Face", "Neck", "Held", "Aura", "Tickles", "BG"]
        body += '<div style="display:flex;gap:6px;overflow:hidden">' + "".join(f'<a href="#" class="chip" style="min-height:30px;padding:2px 10px{";background:"+PEACH if l=="Face" else ""}">{l}</a>' for l in chips) + '</div>'
        body += '<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="sectionTitle">Face</div><div class="kickerPill">2 of 14 · 2 on the shelf ⌄</div></div>'
        # One grammar: sun price = on the shelf today; muted price = not today (the sheet says when); Wear / Wearing = yours; lock = members.
        body += f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">{tile("Cat Mask","wearing")}{tile("Sleep Mask","sale",114)}{tile("Safety Goggles","sale",120)}{tile("Aviators","owned")}{tile("Crest Monocle","locked",3000)}{tile("Frost Monarch","sale",900,afford=False)}</div>'
        body += f'<div class="hand mute" style="text-align:center">a grey price is not on the shelf today · the sheet says when it comes back</div>'
    body += '</div>' + tabbar()
    return page(body)

# ── The fitting room sheet, round 2: the title is a row, not a chip pile ──
def a_sheet2():
    behind = header() + a_bar2()
    behind += f'<div style="flex:1;margin-top:12px;background:{CREAM2};border-top:2px solid {INK}">{a_doorway()}</div>'
    body = f'<div style="position:absolute;inset:0;opacity:.55">{behind}{tabbar()}</div>'
    body += f'<div style="position:absolute;inset:0;background:rgba(42,31,21,.55);z-index:30"></div>'
    slots_l = [("HAT", "cowboy"), ("BOW", "acorn"), ("FACE", "catmask"), ("NECK", "bandana")]
    slots_r = [("HELD", "shovel"), ("TICKLES", "crown_spark"), ("AURA", "fireflies"), ("BG", "bg_beach")]
    def colm(ss): return '<div class="col" style="gap:12px">' + "".join(f'<div style="display:flex;flex-direction:column;align-items:center"><a href="#" class="slotTile" aria-label="{l} slot"><img src="{B[b]}" alt=""><span class="x">×</span></a><div class="slotLbl">{l}</div></div>' for l, b in ss) + '</div>'
    body += f'''<div style="position:absolute;left:0;right:0;bottom:0;z-index:40;background:{CREAM};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;padding:10px 18px 24px;display:flex;flex-direction:column;gap:14px">
  <div class="grabber"></div>
  <div style="display:flex;align-items:center;justify-content:space-between"><div class="col"><div class="kicker">★ the fitting room</div><div class="sectionTitle">Mud Baron Rosie</div></div><span class="kickerPill">wearing 8 of 8</span></div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
    {colm(slots_l)}
    <div class="window" style="width:160px;height:184px;border-radius:16px"><img src="{B["rosie_dressed"]}" alt="Rosie wearing her outfit"></div>
    {colm(slots_r)}
  </div>
  <a href="A_Titles.dc.html" class="sticker flat" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:{PAPER}" aria-label="Title: Mud Baron, before her name. Change title">
    <img src="{B["g_crown"]}" alt="" style="width:22px;height:22px">
    <div class="col" style="flex:1;min-width:0"><div class="kickerPillSm mute">title · before her name</div><div class="cardTitleSm">Mud Baron</div></div>
    <span class="kickerPill">14 earned ›</span>
  </a>
  <button class="btn gold" style="width:100%">Done</button>
</div>'''
    return page(body)

# ── The Titles picker: a list that can hold fifty ────────────────────────
TITLES = [
    ("Mud Baron", "before her name", "Wallow rank 3", True),
    ("Snout Deep", "after her name", "dug to the bottom layer", False),
    ("Trough Hero", "after her name", "filled a friend's Trough", False),
    ("Lucky Pig", "before her name", "hit a lucky number", False),
    ("Early Bird", "before her name", "seven sunrise digs", False),
    ("Truffle Hound", "after her name", "10 Golden Truffles", False),
    ("Herd Elder", "after her name", "a season with one crew", False),
    ("Golden Ticket", "before her name", "redeemed a ticket", False),
    ("Sounder Scout", "after her name", "three recruits", False),
    ("Stinker", "before her name", "cursed a friend", False),
]

def a_titles():
    behind = header() + a_bar2()
    behind += f'<div style="flex:1;margin-top:12px;background:{CREAM2};border-top:2px solid {INK}">{a_doorway()}</div>'
    body = f'<div style="position:absolute;inset:0;opacity:.55">{behind}{tabbar()}</div>'
    body += f'<div style="position:absolute;inset:0;background:rgba(42,31,21,.55);z-index:30"></div>'
    rows = f'''<a href="#" class="rail" style="gap:12px;padding:8px 10px" aria-label="No title"><div class="avatar" style="width:36px;height:36px;border-style:dashed;background:transparent"></div><div class="name col"><div class="cardTitleSm">No title</div><div class="hand mute" style="line-height:16px">just Rosie</div></div></a>'''
    for name, place, how, on in TITLES:
        t = tag("sage", "Wearing", "g_check") if on else ""
        rows += f'''<a href="#" class="rail{" on" if on else ""}" style="gap:12px;padding:8px 10px" aria-label="{name}, {place}, {how}"><div class="avatar" style="width:36px;height:36px;background:{SUN if on else PAPER}"><img src="{B["g_crown"]}" alt="" style="width:20px;height:20px"></div><div class="name col"><div class="cardTitleSm">{name}</div><div class="hand mute" style="line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{place} · {how}</div></div>{t}</a>'''
    body += f'''<div style="position:absolute;left:0;right:0;top:120px;bottom:0;z-index:40;background:{CREAM};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;padding:10px 18px 0;display:flex;flex-direction:column;gap:10px;overflow:hidden">
  <div class="grabber"></div>
  <div style="display:flex;align-items:center;justify-content:space-between"><div class="col"><div class="kicker">★ earned, never sold</div><div class="sectionTitle">Titles</div></div><span class="kickerPill">14 of 41</span></div>
  <div class="sticker flat" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:{PAPER}"><img src="{B["g_search"]}" alt="" style="width:18px;height:18px"><label for="titleSearch" class="hand mute" style="flex:1">Search your titles</label><input id="titleSearch" type="search" aria-label="Search your titles" style="position:absolute;opacity:0;width:1px;height:1px"></div>
  <div class="seg"><button class="on">Earned · 14</button><button>Not yet · 27</button></div>
  <div class="col" style="gap:2px;overflow:hidden">{rows}</div>
</div>'''
    return page(body)

# ── The item sheet from a shelf tap ──────────────────────────────────────
def a_item_sheet():
    behind = header() + a_bar2()
    behind += f'<div style="flex:1;margin-top:12px;background:{CREAM2};border-top:2px solid {INK}">{a_doorway()}</div>'
    body = f'<div style="position:absolute;inset:0;opacity:.55">{behind}{tabbar()}</div>'
    body += f'<div style="position:absolute;inset:0;background:rgba(42,31,21,.55);z-index:30"></div>'
    body += f'''<div style="position:absolute;left:0;right:0;bottom:0;z-index:40;background:{CREAM};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;padding:10px 18px 24px;display:flex;flex-direction:column;gap:14px">
  <div class="grabber"></div>
  <div style="display:flex;gap:14px;align-items:stretch">
    <div style="width:150px;height:150px;border-radius:16px;border:2px solid {INK};background:{RBG["common"]};display:flex;align-items:center;justify-content:center;flex:none;position:relative"><img src="{B["sleep"]}" alt="Sleep Mask" style="width:110px;height:110px;object-fit:contain"><span class="tape" style="left:-6px;top:10px;transform:rotate(-8deg)">new today</span></div>
    <div class="window" style="flex:1;height:150px;border-radius:16px;position:relative"><img src="{B["rosie_dressed"]}" alt="Rosie"><span class="tape" style="right:6px;bottom:8px;transform:rotate(2deg)">on Rosie</span></div>
  </div>
  <div class="col" style="gap:4px">
    <div style="display:flex;align-items:center;gap:8px"><div class="sectionTitle">Sleep Mask</div><span class="tag" style="background:{RBG["common"]};color:#494f56">common</span></div>
    <div class="hand mute">sits over her eyes · face slot, swaps out the Cat Mask</div>
    <div class="hand mute">on the shelf until sunrise · 3h 46m</div>
  </div>
  <a href="#" class="ticket" aria-label="Buy Sleep Mask for 114 snouts"><span class="stub"><img src="{B["coin"]}" alt=""><span class="numeral">114</span></span><span class="face">Buy it · 349 in the pocket</span></a>
  <a href="#" class="btn ghost" style="min-height:36px"><span class="hand" style="color:{ACCENT}">or open a Trough and let the herd chip in ›</span></a>
</div>'''
    return page(body)

# ── The Pen, its own screen ──────────────────────────────────────────────
def a_pen():
    back = f'<a href="Main.dc.html" class="hand" style="color:{ACCENT}">‹ back to the shop</a>'
    body = f'<div class="status"></div><div style="padding:0 18px">{back}</div>'
    body += f'<div class="crown" style="padding-top:8px"><div class="col"><div class="kickerPill">★ rosie’s place</div><div class="pageTitle">The Pen</div><div class="rule"></div></div><div class="pocket"><img src="{B["coin"]}" alt=""><span class="numeral">349</span></div></div>'
    body += f'''<div style="padding:16px 18px 90px;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0;overflow:hidden">
  <div style="position:relative;height:200px;border-radius:16px;border:2px solid {INK};overflow:hidden;background:linear-gradient(180deg,{SKY} 0 62%,{SAGE} 62% 100%);box-shadow:4px 4px 0 {INK}">
    <div style="position:absolute;left:0;right:0;top:118px;height:2px;background:{PAPER};opacity:.9"></div>
    <div style="position:absolute;left:0;right:0;top:140px;height:2px;background:{PAPER};opacity:.9"></div>
    <img src="{B["rosie"]}" alt="Rosie" style="position:absolute;left:36px;bottom:10px;width:130px;height:130px;object-fit:contain">
    <img src="{B["bandit"]}" alt="Bandit" style="position:absolute;right:40px;bottom:14px;width:120px;height:120px;object-fit:contain">
    <span class="tape" style="left:50%;bottom:10px;transform:translateX(-50%) rotate(-1deg)">previewing Bandit</span>
  </div>
  <div class="col" style="gap:4px;align-items:center;text-align:center"><div class="sectionTitle">Rosie has room for a friend.</div><div class="bodySm mute" style="max-width:300px">Slop Club members choose one long-term companion, and pick who greets them at Home.</div></div>
  <div style="display:flex;gap:8px;justify-content:space-between">{"".join(f'<a href="#" class="col" style="align-items:center;gap:4px" aria-label="{n}"><div class="avatar" style="width:56px;height:56px;{"background:"+PEACH+";box-shadow:3px 3px 0 "+INK if n=="Bandit" else ""}"><img src="{B[b]}" alt=""></div><span class="label">{n}</span></a>' for n,b in [("Copper","copper"),("Pepper","pepper"),("Bandit","bandit"),("Pickles","rosie"),("Biscuit","rosie")])}</div>
  <a href="#" class="ticket" aria-label="Join the Slop Club"><span class="stub"><img src="{B["g_crown"]}" alt=""><span class="label">Slop Club</span></span><span class="face">Join and bring Bandit home</span></a>
  <div class="hand mute" style="text-align:center">one companion, for keeps · the members’ shelf opens with it</div>
</div>'''
    body += tabbar()
    return page(body)

# ── Emit round 2 ────────────────────────────────────────────────────────
r2 = {
    "Main.dc.html": ("A · the store — pig pinned, shelves first", a_top2(), 0, 0),
    "A_Everything.dc.html": ("A · Everything · Owned (your closet)", a_everything2("owned"), 470, 0),
    "A_All.dc.html": ("A · Everything · All — one grammar", a_everything2("all"), 940, 0),
    "A_Pen.dc.html": ("A · the Pen — its own screen, a back link", a_pen(), 1410, 0),
    "A_FittingRoom.dc.html": ("A · fitting room sheet — title as a row", a_sheet2(), 0, 1200),
    "A_Titles.dc.html": ("A · Titles picker — a list, search, two tabs", a_titles(), 470, 1200),
    "A_ItemSheet.dc.html": ("A · item sheet from a shelf tap", a_item_sheet(), 940, 1200),
}
for name, (title, html, x, y) in r2.items():
    with open(os.path.join(OUT, name), "w") as f: f.write(html)

READ_COPY = "/private/tmp/claude-501/-Users-bbroeking-projects-oink/1aa6870a-8576-4afe-8881-e2c929fc6ae4/scratchpad/artifact-files/b837d878-58e1-4cb9-9ecf-7ce23213094b/project/canvas.json"
with open(READ_COPY if os.path.exists(READ_COPY) else os.path.join(OUT, "canvas.json")) as f: index = json.load(f)
for name, (title, _, x, y) in r2.items():
    index["boards"][name] = {"x": x, "y": y, "w": 390, "h": 844, "title": title, "page": "r2"}
# round-1 B and C move to their own page, same relative layout
for name, (x, y) in {"B_Today.dc.html": (0, 0), "B_Mine.dc.html": (470, 0), "C_Racks.dc.html": (0, 1200), "C_Face.dc.html": (470, 1200)}.items():
    index["boards"][name].update({"x": x, "y": y, "page": "r1"})
index["order"] = list(r2.keys()) + ["B_Today.dc.html", "B_Mine.dc.html", "C_Racks.dc.html", "C_Face.dc.html"]
index["pages"] = [{"id": "r2", "name": "Round 2 · The Counter"}, {"id": "r1", "name": "Round 1 · B and C"}]
index["launch"] = {"view": "canvas", "page": "r2"}
index["notes"] = {
    "t_page": {"x": 0, "y": -300, "text": "A · The Counter — the page", "kind": "title1", "maxW": 1800, "page": "r2"},
    "t_sheets": {"x": 0, "y": 900, "text": "A · The Counter — the sheets", "kind": "title1", "maxW": 1330, "page": "r2"},
    "n_page": {"x": 1880, "y": 0, "w": 300, "page": "r2", "text": "One scroll. The try-on bar is a sticky header with real height; her window and the Fitting room chip both open the sheet. Pen and Furnish are the only signs and both leave the page (the Pen is its own screen with a back link). Under the shelves: one catalog, one card grammar — sun price = on the shelf today, grey price = not today, Wear / Wearing = yours, gold lock = members."},
    "n_sheets": {"x": 1410, "y": 1200, "w": 300, "page": "r2", "text": "Titles can run to dozens, so the fitting room shows ONE row (current title · placement · count) and the row opens a picker: a list with search, Earned / Not yet tabs, one line each for how it was earned. The item sheet leads with the thing and her wearing it; the commit is a ticket; the Trough is the quiet second line."},
    "t_b": {"x": 0, "y": -300, "text": "B · The Mirror (round 1, set aside)", "kind": "title1", "maxW": 860, "page": "r1"},
    "t_c": {"x": 0, "y": 900, "text": "C · The Rack (round 1, set aside)", "kind": "title1", "maxW": 860, "page": "r1"},
}
with open(os.path.join(OUT, "canvas.json"), "w") as f: json.dump(index, f, indent=1)
print("wrote", len(r2), "boards; pages", [p["id"] for p in index["pages"]])
