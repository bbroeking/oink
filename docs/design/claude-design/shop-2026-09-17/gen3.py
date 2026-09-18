#!/usr/bin/env python3
"""Round 3: A2 (the hero fitting room) as three layouts, each with its scrolled state."""
import json, os
import gen as g
from gen import B, ICON, header, tabbar, shelf, chalk, counter, slot_tiles, page, DROP1, DROP2, MEMBERS, SLOTS, price_tag


def closet_cards(cards, cols=3, pad="10px 18px 0"):
    from gen import wear_tag
    grid = f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: 10px; padding: {pad};">'
    for art, rar, owned, active in cards:
        foot = wear_tag(active, 0) if owned else '<div class="tag muted" style="font-size: 11px;">Not owned</div>'
        chk = f'<div style="position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; border-radius: 999px; background: #c9dec1; border: 2px solid #2a1f15; display: flex; align-items: center; justify-content: center;"><img src="{B["check"]}" alt="" style="width: 11px; height: 11px;"></div>' if owned else ""
        grid += f'<div class="card"><div class="thumb r-{rar}"><img class="art" src="{art}" alt="">{chk}</div><div class="foot">{foot}</div></div>'
    return grid + "</div>"


CARDS = [(B["boat"], "common", True, False), (B["cowboy"], "uncommon", True, True), (B["wizard"], "epic", False, False),
         (B["catmask"], "rare", True, True), (B["aviator"], "rare", True, True), (B["goggles"], "common", False, False)]


def small_doors(compact=False):
    if compact:
        return f'''<div class="door" style="width: 60px; min-height: 49px; padding: 5px 2px;">{ICON["pig"]}<div class="lbl" style="font-size: 11px; line-height: 14px;">Pen</div></div>
        <div class="door" style="width: 60px; min-height: 49px; padding: 5px 2px;"><img src="{B["door"]}" alt=""><div class="lbl" style="font-size: 11px; line-height: 14px;">Furnish</div></div>'''
    return f'''<div style="display: flex; gap: 8px;">
        <div class="door" style="width: 62px; min-height: 48px;">{ICON["pig"]}<div class="lbl">Pen</div></div>
        <div class="door" style="width: 68px; min-height: 48px;"><img src="{B["door"]}" alt=""><div class="lbl">Furnish</div></div>
      </div>'''

OUT = g.OUT


def slot_col(items, size=46):
    out = ""
    for lbl, art in items:
        if art:
            out += f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile" style="width: {size}px; height: {size}px;"><img src="{art}" alt="" style="width: {size - 14}px; height: {size - 14}px;"><div class="x">×</div></div><div class="slotLbl">{lbl}</div></div>'
        else:
            out += f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile empty" style="width: {size}px; height: {size}px;"></div><div class="slotLbl">{lbl}</div></div>'
    return out


def peg_row(size=38, labels=True):
    """All eight slots in one row — a peg rail."""
    pegs = ""
    for lbl, art in SLOTS:
        tile = (f'<div class="slotTile" style="width: {size}px; height: {size}px;"><img src="{art}" alt="" style="width: {size - 12}px; height: {size - 12}px;"><div class="x">×</div></div>'
                if art else f'<div class="slotTile empty" style="width: {size}px; height: {size}px;"></div>')
        pegs += f'<div style="display: flex; flex-direction: column; align-items: center; flex: 1 1 0; min-width: 0;">{tile}{"<div class=\"slotLbl\">" + lbl + "</div>" if labels else ""}</div>'
    return f'<div style="display: flex; gap: 3px; justify-content: space-between;">{pegs}</div>'


def signs_on_rope():
    """Closet · Pen · Furnish as hanging signs — the store's own grammar."""
    signs = ""
    for name, icon, badge in [("Closet", ICON["hat"], "13"), ("Pen", ICON["pig"], None), ("Furnish", f'<img src="{B["door"]}" alt="">', None)]:
        b = f'<div class="badge">{badge}</div>' if badge else ""
        signs += f'<div class="door hang" style="width: 64px; min-height: 52px; padding: 5px 2px;">{icon}<div class="lbl" style="font-size: 11px;">{name}</div>{b}</div>'
    return f'<div style="display: flex; gap: 6px; align-items: flex-start; padding-top: 14px; position: relative; flex: none;"><div class="rope" style="top: 0;"></div>{signs}</div>'


# ───────── V1 · Flanked (refined) ─────────
def v1_top():
    hero = f'''<div class="sticker" style="margin: 10px 18px 0; padding: 10px 10px 8px; display: flex; gap: 8px; align-items: center; justify-content: space-between; flex: none;">
      <div style="display: flex; flex-direction: column; gap: 6px;">{slot_col(SLOTS[:4])}</div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><div class="stripPig" style="width: 168px; height: 168px; border-radius: 16px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div><div class="kickerPill" style="font-size: 10px;">★ wearing 5 of 8</div></div>
      <div style="display: flex; flex-direction: column; gap: 6px;">{slot_col(SLOTS[4:])}</div>
    </div>
    <div style="margin: 8px 18px 0; padding: 8px 12px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 3px 3px 0 #2a1f15; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex: none;">
      <div style="min-width: 0;"><div class="kickerPill" style="font-size: 10px;">title</div><div class="cardTitleSm" style="font-size: 15px;">No title — tap to pick</div></div>
      <div style="display: flex; align-items: center; gap: 8px; flex: none;"><div class="handSm mute">earned, not sold</div><div style="width: 18px; height: 18px;">{ICON["chev"]}</div></div>
    </div>'''
    body = header() + f'''
  <div class="wall">
    {hero}
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 14px 18px 0;">{chalk(small=True)}<div style="display: flex; gap: 6px; flex: none;"><a href="#closet" class="door" style="width: 60px; min-height: 49px; padding: 5px 2px; text-decoration: none; color: #2a1f15; position: relative;">{ICON["hat"]}<div class="lbl" style="font-size: 11px; line-height: 14px;">Closet</div><div class="badge" style="top: -8px; right: -6px;">13</div></a>{small_doors(compact=True)}</div></div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    <div style="padding: 16px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ after the shelves</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
  </div>
  ''' + tabbar()
    return page("A2 · V1 flanked", body)


def v1_scrolled():
    drop = list(DROP2)
    body = header() + f'''
  <div class="wall">
    <div class="sticker" style="margin: 10px 18px 0; padding: 8px 12px; display: flex; gap: 10px; align-items: center; flex: none;">
      <div class="stripPig" style="width: 56px; height: 56px; border-radius: 10px;"><img src="{B["rosie_nohat"]}" alt="Rosie trying on"></div>
      <div style="flex: 1 1 0; min-width: 0;"><div class="kickerPill" style="font-size: 10px;">★ trying on · Sleep Mask</div><div class="handSm mute">tap another coaster to swap</div></div>
      <button class="btn sm gold"><img src="{B["coin"]}" alt="">Buy · 114</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 18px 0;">
      {shelf([(B["wizard"], "epic", price_tag("711", False), False, False, False), (B["wand"], "rare", price_tag("533", False, 2), False, False, False), (B["sleep"], "common", price_tag("114", True, -2), False, False, True)])}
      {shelf(drop)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    <div style="padding: 16px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ after the shelves</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    {closet_cards(CARDS[:3])}
  </div>
  ''' + tabbar()
    return page("A2 · V1 scrolled — the hero folds to a try-on line", body)


# ───────── V2 · Wide hero, peg rail, signs on a rope ─────────
def v2_top():
    hero = f'''<div class="sticker" style="margin: 10px 18px 0; padding: 0; overflow: hidden; display: flex; flex: none; background: #c8e3f0;">
      <div style="width: 200px; height: 190px; flex: none;"><img src="{B["rosie"]}" alt="Rosie, dressed" style="width: 100%; height: 100%; object-fit: cover;"></div>
      <div style="flex: 1 1 0; min-width: 0; background: #fffaf0; border-left: 2px solid #2a1f15; padding: 12px 12px 10px; display: flex; flex-direction: column; justify-content: space-between;">
        <div><div class="kicker">★ the fitting room</div><div class="sectionTitle" style="font-size: 22px; line-height: 26px;">Wearing<br>5 of 8</div></div>
        <div class="handSm mute">tap a peg below to take it off; tap a coaster to try one on</div>
        <a href="#closet" class="tag peach" style="align-self: flex-start; text-decoration: none; color: #2a1f15;">Closet · 13</a>
      </div>
    </div>
    <div style="margin: 0 18px; padding: 8px 8px 6px; background: #fffaf0; border: 2px solid #2a1f15; border-top: 0; border-radius: 0 0 14px 14px; box-shadow: 4px 4px 0 #2a1f15; flex: none;">{peg_row()}</div>'''
    body = header() + f'''
  <div class="wall">
    {hero}
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 6px 18px 0;"><div class="chalk" style="padding: 6px 9px; transform: rotate(-1.5deg); flex: none;"><div class="kickerPillSm" style="color: #ffd87a; font-size: 9px;">★ back at sunrise</div><div class="numeral" style="font-size: 17px; line-height: 19px;">8h 13m</div></div>{signs_on_rope()}</div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
  </div>
  ''' + tabbar()
    return page("A2 · V2 wide hero + peg rail", body)


def v2_scrolled():
    body = header() + f'''
  <div class="wall">
    <div style="margin: 10px 18px 0; padding: 8px 8px 6px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; flex: none; display: flex; align-items: center; gap: 8px;">
      <div class="stripPig" style="width: 40px; height: 40px; border-radius: 10px; flex: none;"><img src="{B["rosie"]}" alt="Rosie"></div>
      <div style="flex: 1 1 0; min-width: 0; overflow: hidden;">{peg_row(size=30, labels=False)}</div>
    </div>
    <div style="padding: 12px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ after the shelves</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    <div style="display: flex; gap: 6px; padding: 8px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Hats</div><div class="chip">Face</div><div class="chip">Neck</div><div class="chip">Held</div></div>
    {closet_cards(CARDS)}
    {counter()}
  </div>
  ''' + tabbar()
    return page("A2 · V2 scrolled — the hero folds to the peg rail", body)


# ───────── V3 · In the store: she stands on the floor, pegs on the wall ─────────
def v3_top():
    pegboard = f'''<div style="position: relative; width: 150px; padding: 10px 8px 8px; background: linear-gradient(180deg, #8d5a2c, #74441e); border: 2px solid #2a1f15; border-radius: 10px; box-shadow: 3px 3px 0 #2a1f15; display: flex; flex-direction: column; gap: 8px;">
        <div class="tape" style="left: 40px; top: -9px; width: 70px; font-family: 'Patrick Hand', cursive; font-weight: 400; font-size: 11px; line-height: 14px; text-align: center; color: #2a1f15; transform: rotate(-4deg);">wearing 5 of 8</div>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 4px;">{"".join((f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile" style="width: 30px; height: 30px; border-radius: 8px;"><img src="{art}" alt="" style="width: 22px; height: 22px;"></div><div class="slotLbl" style="color: #fff3e2; font-size: 7px;">{lbl}</div></div>' if art else f'<div style="display: flex; flex-direction: column; align-items: center;"><div class="slotTile empty" style="width: 30px; height: 30px; border-radius: 8px; background: rgba(255,250,240,.35);"></div><div class="slotLbl" style="color: #fff3e2; font-size: 7px;">{lbl}</div></div>') for lbl, art in SLOTS)}</div>
      </div>'''
    scene = f'''<div style="position: relative; height: 236px; flex: none; margin-top: 8px;">
      <div style="position: absolute; left: 18px; top: 0; display: flex; gap: 8px; align-items: flex-start;">{chalk(small=True)}</div>
      <div style="position: absolute; right: 18px; top: 2px;">{pegboard}</div>
      <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 34px; background: linear-gradient(180deg, #8d5a2c, #74441e); border-top: 2px solid #2a1f15;"></div>
      <img src="{B["rosie"]}" alt="Rosie, dressed" style="position: absolute; left: 34px; bottom: 14px; width: 150px; height: 150px; object-fit: cover; border-radius: 12px; border: 2px solid #2a1f15;">
      <img src="{B["pepper"]}" alt="" style="position: absolute; right: 30px; bottom: 26px; width: 54px;">
      <div class="handSm" style="position: absolute; right: 92px; bottom: 44px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 10px; padding: 2px 8px; white-space: nowrap;">looking sharp today</div>
    </div>'''
    body = header() + f'''
  <div class="wall">
    <div style="display: flex; align-items: flex-start; justify-content: flex-end; padding: 0 18px;">{signs_on_rope()}</div>
    {scene}
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 14px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
  </div>
  ''' + tabbar()
    return page("A2 · V3 in the store — she stands on the floor", body)


def v3_scrolled():
    body = header() + f'''
  <div class="wall">
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 18px 0; flex: none;">
      <div style="display: flex; align-items: center; gap: 8px;"><div class="stripPig" style="width: 44px; height: 44px; border-radius: 10px;"><img src="{B["rosie_nohat"]}" alt="Rosie"></div><div><div class="kickerPill" style="font-size: 10px;">★ trying on · Sleep Mask</div><div class="handSm mute">she follows you down the aisle</div></div></div>
      <button class="btn sm gold"><img src="{B["coin"]}" alt="">Buy · 114</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 18px 0;">
      {shelf([(B["wizard"], "epic", price_tag("711", False), False, False, False), (B["wand"], "rare", price_tag("533", False, 2), False, False, False), (B["sleep"], "common", price_tag("114", True, -2), False, False, True)])}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    <div style="padding: 16px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ after the shelves</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    {closet_cards(CARDS[:3])}
  </div>
  ''' + tabbar()
    return page("A2 · V3 scrolled — she follows on the line", body)


R3 = {
    "V1_Flanked.dc.html": ("A2·V1 flanked (refined)", v1_top()),
    "V1_Flanked_Scrolled.dc.html": ("A2·V1 scrolled, trying on", v1_scrolled()),
    "V2_Wide.dc.html": ("A2·V2 wide hero + peg rail", v2_top()),
    "V2_Wide_Scrolled.dc.html": ("A2·V2 scrolled, peg rail pinned", v2_scrolled()),
    "V3_Floor.dc.html": ("A2·V3 in the store", v3_top()),
    "V3_Floor_Scrolled.dc.html": ("A2·V3 scrolled, she follows", v3_scrolled()),
}
for name, (_, html) in R3.items():
    open(os.path.join(OUT, name), "w").write(html)

W, H, GAP = 390, 1000, 60
layout = {}
names = list(R3.keys())
for i, name in enumerate(names):
    pair = i // 2
    x = pair * (2 * W + GAP + 100) + (i % 2) * (W + GAP)
    layout[name] = {"x": x, "y": 0, "w": W, "h": H, "title": R3[name][0], "page": "r3"}
notes = {
    "t3": {"x": 0, "y": -250, "text": "A2 · the hero fitting room — three layouts: flanked (V1), wide hero + peg rail (V2), in the store (V3)", "kind": "title1", "maxW": 2900, "page": "r3"},
    "s3": {"x": 0, "y": 1120, "w": 2900, "maxH": 220, "text": "V1 keeps the pig centred with four slots a side; doors (Closet 13 · Pen · Furnish) sit beside the chalkboard; scrolling folds the hero to one line that becomes the try-on line. V2 gives the pig a wide card with the words beside her and all eight slots as one peg rail under it; Closet · Pen · Furnish hang on a rope like the store's signs; the peg rail is what stays pinned. V3 puts her IN the store: on the floor by the counter, the shopkeep behind, her slots on a peg board on the wall; the signs hang on the rope at the top; scrolling, she follows on the line and tries things on there.", "size": "s", "page": "r3"},
}
json.dump({"layout": layout, "notes": notes}, open(os.path.join(OUT, "_r3.json"), "w"))
print("wrote", names)
