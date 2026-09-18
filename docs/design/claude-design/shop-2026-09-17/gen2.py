#!/usr/bin/env python3
"""Round 2: A and B each as two distinct layouts. Round 1 moves to its own page."""
import json, os, datetime as dt
import gen as g
from gen import B, ICON, header, tabbar, shelf, chalk, counter, coaster, wear_tag, price_tag, slot_tiles, page, DROP1, DROP2, MEMBERS, SLOTS

OUT = g.OUT


def closet_cards(cards, cols=3, pad="10px 18px 0"):
    grid = f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: 10px; padding: {pad};">'
    for art, rar, owned, active in cards:
        foot = wear_tag(active, 0) if owned else '<div class="tag muted" style="font-size: 11px;">Not owned</div>'
        chk = f'<div style="position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; border-radius: 999px; background: #c9dec1; border: 2px solid #2a1f15; display: flex; align-items: center; justify-content: center;"><img src="{B["check"]}" alt="" style="width: 11px; height: 11px;"></div>' if owned else ""
        grid += f'<div class="card"><div class="thumb r-{rar}"><img class="art" src="{art}" alt="">{chk}</div><div class="foot">{foot}</div></div>'
    return grid + "</div>"


CARDS = [(B["boat"], "common", True, False), (B["cowboy"], "uncommon", True, True), (B["wizard"], "epic", False, False),
         (B["catmask"], "rare", True, True), (B["aviator"], "rare", True, True), (B["goggles"], "common", False, False)]


def small_doors():
    return f'''<div style="display: flex; gap: 8px;">
        <div class="door" style="width: 62px; min-height: 48px;">{ICON["pig"]}<div class="lbl">Pen</div></div>
        <div class="door" style="width: 68px; min-height: 48px;"><img src="{B["door"]}" alt=""><div class="lbl">Furnish</div></div>
      </div>'''


# ───────── A1 · One aisle, the strip (refined) ─────────
def board_a_strip():
    strip = f'''<div class="sticker" style="margin: 10px 18px 0; padding: 10px 12px; display: flex; gap: 12px; align-items: center; flex: none;">
      <div class="stripPig" style="width: 80px; height: 80px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;"><div class="kickerPill" style="font-size: 10px;">★ wearing 5 of 8</div><a href="#closet" class="tag peach" style="text-decoration: none; color: #2a1f15; padding: 2px 9px;">Closet · 13</a></div>
        {slot_tiles(cols=4)}
      </div>
    </div>'''
    body = header() + f'''
  <div class="wall">
    {strip}
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 0;">{chalk(small=True)}{small_doors()}</div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    <div style="padding: 16px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ further down the aisle</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    <div style="display: flex; gap: 6px; padding: 8px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Hats</div><div class="chip">Face</div><div class="chip">Neck</div><div class="chip">Held</div></div>
    {closet_cards(CARDS[:3])}
  </div>
  ''' + tabbar()
    return page("A1 · One aisle — the strip", body)


# ───────── A2 · One aisle, the hero fitting room ─────────
def board_a_hero():
    left = "".join(
        f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile" style="width: 46px; height: 46px;"><img src="{art}" alt="" style="width: 32px; height: 32px;"><div class="x">×</div></div><div class="slotLbl">{lbl}</div></div>'
        for lbl, art in SLOTS[:4])
    right = "".join(
        (f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile" style="width: 46px; height: 46px;"><img src="{art}" alt="" style="width: 32px; height: 32px;"><div class="x">×</div></div><div class="slotLbl">{lbl}</div></div>'
         if art else f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile empty" style="width: 46px; height: 46px;"></div><div class="slotLbl">{lbl}</div></div>')
        for lbl, art in SLOTS[4:])
    hero = f'''<div class="sticker" style="margin: 10px 18px 0; padding: 12px; display: flex; gap: 10px; align-items: center; justify-content: space-between; flex: none;">
      <div style="display: flex; flex-direction: column; gap: 8px;">{left}</div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><div class="stripPig" style="width: 168px; height: 168px; border-radius: 16px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div><div class="handSm mute">tap a slot to take it off</div></div>
      <div style="display: flex; flex-direction: column; gap: 8px;">{right}</div>
    </div>'''
    body = header() + f'''
  <div class="wall">
    {hero}
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 18px 0;"><div class="kicker">★ the shelves, then your closet</div><a href="#closet" class="tag peach" style="text-decoration: none; color: #2a1f15;">Closet · 13</a></div>
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 18px 0;">{chalk(small=True)}{small_doors()}</div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
  </div>
  ''' + tabbar()
    return page("A2 · One aisle — the hero fitting room", body)


# ───────── B1 · Rooms, a rail of hanging signs (refined) ─────────
def sign_rail(active="Store", four=True):
    doors = [("Store", ICON["shop"], None), ("Closet", ICON["hat"], "13"), ("Pen", ICON["pig"], None)]
    if four:
        doors.append(("Furnish", f'<img src="{B["door"]}" alt="">', None))
    out = '<div style="position: relative; padding: 14px 18px 0; flex: none;"><div class="rope"></div><div style="display: flex; gap: 8px;">'
    for name, icon, badge in doors:
        b = f'<div class="badge">{badge}</div>' if badge else ""
        out += f'<div class="door hang{" on" if name == active else ""}" style="flex: 1 1 0; min-height: 56px;">{icon}<div class="lbl">{name}</div>{b}</div>'
    return out + "</div></div>"


def tryon(name, cost=None, owned=False, active=False, arrow=True, pig=None):
    if owned:
        action = '<button class="btn sm" style="background: #c9dec1;">Take off</button>' if active else '<button class="btn sm gold">Wear</button>'
    else:
        action = f'<button class="btn sm gold"><img src="{B["coin"]}" alt="">Buy · {cost}</button>'
    arrowhtml = '<div style="position: absolute; left: 50%; top: -9px; width: 14px; height: 14px; background: #fffaf0; border-left: 2px solid #2a1f15; border-top: 2px solid #2a1f15; transform: translateX(-50%) rotate(45deg);"></div>' if arrow else ""
    return f'''<div style="position: relative; margin: 2px 18px 0; padding: 10px 12px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 3px 3px 0 #2a1f15; display: flex; align-items: center; gap: 12px;">
        {arrowhtml}
        <div class="stripPig" style="width: 72px; height: 72px;"><img src="{pig or B["rosie_nohat"]}" alt="Rosie trying it on"></div>
        <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 4px;"><div class="kickerPillSm mute">trying on</div><div class="cardTitleSm" style="font-size: 16px;">{name}</div><div class="handSm mute">Common · sits over her eyes</div></div>
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">{action}<div style="width: 18px; height: 18px; opacity: .6;">{ICON["x"]}</div></div>
      </div>'''


def board_b_rail():
    drop1 = list(DROP1)
    drop1[2] = (B["sleep"], "common", price_tag("114", True, -2), False, False, True)
    body = header() + f'''
  <div class="wall">
    {sign_rail("Store")}
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 0;">{chalk(small=True)}<div class="handSm mute" style="text-align: right;">tap a coaster · it tries on<br>right under its shelf</div></div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 18px 0;">{shelf(drop1)}</div>
    {tryon("Sleep Mask", cost="114")}
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    {counter()}
  </div>
  ''' + tabbar()
    return page("B1 · Rooms — a rail of signs, try-on under the shelf", body)


# ───────── B2 · Rooms, folder tabs on the wall + one fixed try-on bar ─────────
def folder_tabs(active="Store"):
    tabs = ""
    for name, badge in [("Store", None), ("Closet", "13"), ("Pen", None)]:
        on = name == active
        b = f'<span class="tag sun" style="min-height: 18px; padding: 0 7px; font-size: 10px; margin-left: 6px;">{badge}</span>' if badge else ""
        tabs += f'<div style="position: relative; display: flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; background: {"#ffc8a8" if on else "#fffaf0"}; border: 2px solid #2a1f15; border-bottom: {"2px solid #ffc8a8" if on else "2px solid #2a1f15"}; border-radius: 12px 12px 0 0; margin-bottom: -2px; font-weight: 800; font-size: 13px; white-space: nowrap; {"" if on else "opacity: .85;"}">{name}{b}</div>'
    return f'<div style="display: flex; gap: 6px; align-items: flex-end; padding: 12px 18px 0; flex: none;">{tabs}<div style="flex: 1 1 0;"></div><div class="door" style="width: 64px; min-height: 40px; padding: 4px; margin-bottom: 4px;"><img src="{B["door"]}" alt=""><div class="lbl">Furnish</div></div></div>'


def board_b_tabs():
    drop1 = list(DROP1)
    drop1[2] = (B["sleep"], "common", price_tag("114", True, -2), False, False, True)
    fixedbar = f'''<div style="margin: 0 18px; padding: 8px 12px; background: #ffc8a8; border: 2px solid #2a1f15; border-radius: 0 0 14px 14px; box-shadow: 3px 3px 0 #2a1f15; display: flex; align-items: center; gap: 10px; flex: none;">
      <div class="stripPig" style="width: 56px; height: 56px; border-radius: 10px;"><img src="{B["rosie_nohat"]}" alt="Rosie trying it on"></div>
      <div style="flex: 1 1 0; min-width: 0;"><div class="kickerPillSm">trying on · Sleep Mask</div><div class="handSm" style="margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">tap any coaster to swap</div></div>
      <button class="btn sm gold"><img src="{B["coin"]}" alt="">Buy · 114</button>
    </div>'''
    body = header() + f'''
  <div class="wall">
    {folder_tabs("Store")}
    {fixedbar}
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 0;">{chalk(small=True)}<div class="handSm mute" style="text-align: right;">today's drop</div></div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 18px 0;">
      {shelf(drop1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    {counter()}
  </div>
  ''' + tabbar()
    return page("B2 · Rooms — folder tabs, one fixed try-on bar", body)


def board_b_tabs_closet():
    body = header() + f'''
  <div class="wall">
    {folder_tabs("Closet")}
    <div style="margin: 0 18px; padding: 10px 12px; background: #ffc8a8; border: 2px solid #2a1f15; border-radius: 0 0 14px 14px; box-shadow: 3px 3px 0 #2a1f15; display: flex; align-items: center; gap: 12px; flex: none;">
      <div class="stripPig" style="width: 84px; height: 84px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px;"><div class="kickerPillSm">wearing 5 of 8</div>{slot_tiles(cols=4)}</div>
    </div>
    <div style="display: flex; gap: 6px; padding: 12px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Owned</div><div class="chip">Unowned</div><div class="chip">Member</div></div>
    {closet_cards(CARDS)}
  </div>
  ''' + tabbar()
    return page("B2 · the Closet tab — same tabs, same bar", body)


def board_b_rail_closet():
    body = header() + f'''
  <div class="wall">
    {sign_rail("Closet")}
    <div class="sticker" style="margin: 12px 18px 0; padding: 10px 12px; display: flex; gap: 12px; align-items: center; flex: none;">
      <div class="stripPig"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px;"><div class="kickerPill">★ wearing 5 of 8</div>{slot_tiles(cols=4)}</div>
    </div>
    <div style="display: flex; gap: 6px; padding: 10px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Owned</div><div class="chip">Unowned</div><div class="chip">Member</div></div>
    {closet_cards(CARDS)}
  </div>
  ''' + tabbar()
    return page("B1 · the Closet room — same rail", body)


def board_a_strip_closet():
    body = header() + f'''
  <div class="wall">
    <div class="sticker" style="margin: 10px 18px 0; padding: 10px 12px; display: flex; gap: 12px; align-items: center; flex: none;">
      <div class="stripPig" style="width: 92px; height: 92px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;"><div class="kickerPill">★ wearing 5 of 8</div><a href="#top" class="tag" style="text-decoration: none; color: #2a1f15;">Shelves</a></div>
        {slot_tiles(cols=4)}
      </div>
    </div>
    <div style="padding: 12px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ further down the aisle</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    <div style="display: flex; gap: 6px; padding: 8px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Hats</div><div class="chip">Face</div><div class="chip">Neck</div><div class="chip">Held</div></div>
    {closet_cards(CARDS)}
    <div style="padding: 12px 18px 0;"><div class="sticker" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;"><div><div class="kickerPill">title</div><div class="cardTitleSm" style="font-size: 16px;">No title — tap to pick</div></div><div style="width: 20px; height: 20px;">{ICON["chev"]}</div></div></div>
  </div>
  ''' + tabbar()
    return page("A1 · scrolled to the closet, strip still pinned", body)


def board_a_hero_closet():
    body = header() + f'''
  <div class="wall">
    <div class="sticker" style="margin: 10px 18px 0; padding: 8px 12px; display: flex; gap: 10px; align-items: center; flex: none;">
      <div class="stripPig" style="width: 56px; height: 56px; border-radius: 10px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0;"><div class="kickerPill">★ wearing 5 of 8</div><div class="handSm mute">the hero folds to this line as you scroll</div></div>
      <div style="width: 20px; height: 20px;">{ICON["up"]}</div>
    </div>
    <div style="padding: 12px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ after the shelves</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    <div style="display: flex; gap: 6px; padding: 8px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Hats</div><div class="chip">Face</div><div class="chip">Neck</div><div class="chip">Held</div></div>
    {closet_cards(CARDS)}
    {counter()}
  </div>
  ''' + tabbar()
    return page("A2 · scrolled — the hero folds to a line", body)


R2 = {
    "Main.dc.html": ("A1 · the strip", board_a_strip()),
    "A1_Closet.dc.html": ("A1 · scrolled to the closet", board_a_strip_closet()),
    "A2_Hero.dc.html": ("A2 · the hero fitting room", board_a_hero()),
    "A2_Hero_Closet.dc.html": ("A2 · scrolled, hero folded", board_a_hero_closet()),
    "B1_Rail.dc.html": ("B1 · rail of signs, try-on under the shelf", board_b_rail()),
    "B1_Rail_Closet.dc.html": ("B1 · the Closet room", board_b_rail_closet()),
    "B2_Tabs.dc.html": ("B2 · folder tabs, fixed try-on bar", board_b_tabs()),
    "B2_Tabs_Closet.dc.html": ("B2 · the Closet tab", board_b_tabs_closet()),
}
for name, (_, html) in R2.items():
    open(os.path.join(OUT, name), "w").write(html)

W, H, GAP, ROW = 390, 1000, 60, 1000 + 300
rows = [["Main.dc.html", "A1_Closet.dc.html", "A2_Hero.dc.html", "A2_Hero_Closet.dc.html"],
        ["B1_Rail.dc.html", "B1_Rail_Closet.dc.html", "B2_Tabs.dc.html", "B2_Tabs_Closet.dc.html"]]
boards = {}
for r, row in enumerate(rows):
    for c, name in enumerate(row):
        x = c * (W + GAP) + (80 if c >= 2 else 0)
        boards[name] = {"x": x, "y": r * ROW, "w": W, "h": H, "title": R2[name][0]}

# round 1 boards keep their files, on their own page
prev = json.load(open(os.path.join(OUT, "canvas.json")))
r1_names = ["A2_Closet.dc.html", "B1_Store.dc.html", "B2_Closet.dc.html", "C1_Store.dc.html", "C2_Drawer.dc.html"]
# round 1's Main.dc.html is overwritten by round 2's; keep its content as R1_Main
r1_layout = {}
for i, name in enumerate(["R1_Main.dc.html"] + r1_names):
    r1_layout[name] = {"x": (i % 3) * (W + GAP), "y": (i // 3) * ROW, "w": W, "h": H, "page": "r1",
                       "title": {"R1_Main.dc.html": "A · One aisle (r1)"}.get(name, prev["boards"].get(name, {}).get("title", name))}
os.replace(os.path.join(OUT, "Main.dc.html.r1"), os.path.join(OUT, "R1_Main.dc.html")) if os.path.exists(os.path.join(OUT, "Main.dc.html.r1")) else None

notes = {
    "tA": {"x": 0, "y": -250, "text": "A · One aisle — two layouts: the pinned strip (A1) or the hero fitting room that folds as you scroll (A2)", "kind": "title1", "maxW": 1880},
    "tB": {"x": 0, "y": ROW - 250, "text": "B · Rooms that stay put — two layouts: a rail of hanging signs with try-on under the shelf (B1) or folder tabs with one fixed try-on bar (B2)", "kind": "title1", "maxW": 1880},
    "sA": {"x": 1960, "y": 0, "w": 300, "text": "A1 keeps the store first and your pig as a compact strip that never leaves the top. A2 leads with the pig the way the Closet does today, then folds it to one line so the shelves get the screen back. Both: Wear on every card, Closet as a section, no rooms.", "size": "s"},
    "sB": {"x": 1960, "y": ROW, "w": 300, "text": "B1 tries on under the shelf you tapped (the pig comes to the item). B2 tries on in one bar under the tabs (the item comes to the pig) — steadier, and the bar becomes the wearing-now strip on the Closet tab. Furnish leaves the tab set in B2 because it navigates away.", "size": "s"},
}
canvas = {
    "v": 3,
    "createdOnFiles": prev.get("createdOnFiles", {"v": 1, "at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}),
    "title": "Storefront, less jumping",
    "launch": {"view": "canvas"},
    "pages": [{"id": "r2", "name": "Round 2 · A and B"}, {"id": "r1", "name": "Round 1"}],
    "boards": {**boards, **r1_layout},
    "order": list(boards.keys()) + list(r1_layout.keys()),
    "notes": {**notes, **{k: {**v, "page": "r1"} for k, v in prev.get("notes", {}).items()}},
    "designSystems": [],
}
json.dump(canvas, open(os.path.join(OUT, "canvas.json"), "w"), indent=1)
print("wrote", sorted(os.listdir(OUT)))
