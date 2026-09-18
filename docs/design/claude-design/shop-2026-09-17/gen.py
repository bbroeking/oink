#!/usr/bin/env python3
"""Generate the 'Storefront, less jumping' canvas: three directions × two screens."""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "project")
os.makedirs(OUT, exist_ok=True)

B = {  # uploaded assets
    "rosie": "/_blob/229ae2b7de6716e49d02c4965fbeebfa",
    "rosie_nohat": "/_blob/ea2efdb49834976d9d9ee1753daec904",
    "coin": "/_blob/12e6e7a9550a13849f16518a138a65b4",
    "gift": "/_blob/fc8973e6b7df79201b8b2f3f36a7da8a",
    "lock": "/_blob/8b0d4cba66e31319c8b9e69733ee96a4",
    "check": "/_blob/4ed4d8fcb9c6a0dec41a5d190d49b4b4",
    "crown": "/_blob/c54d7119088e2ebc09fc28923e51a8fd",
    "door": "/_blob/852b874f16e48f8d3a6e76335fb62186",
    "copper": "/_blob/35eb60054221754e2554f5ed691b87e3",
    "pickles": "/_blob/505782ad6d12152f14df2af4fd8eb83a",
    "bandit": "/_blob/189b53575d5868c4ca116880648100bd",
    "pepper": "/_blob/87c44f2322349c975e5795664e3b523d",
    "biscuit": "/_blob/5bdc44b4182bdb5252db2eabcd3878b3",
    "cowboy": "/_blob/0697d50969f3f64b0b5263a42b5245bd",
    "aviator": "/_blob/bb242a0ef69ae12309106f2ba76f2575",
    "catmask": "/_blob/acefad5e6ce792d6be531adf96e4b9de",
    "acorn": "/_blob/aef8864683f7a51f793a10c909766eb3",
    "bandana": "/_blob/e8a943708b1cf9d7203434a88350efb2",
    "shovel": "/_blob/86782d69d2a9da896d1623e1232b0336",
    "boat": "/_blob/b3984410280fbee227f75896b209641f",
    "sleep": "/_blob/7b817e183207d2078f9b9ec595e4c3f5",
    "goggles": "/_blob/e4dabf0499d530d052c74f4f4d6f2f72",
    "wand": "/_blob/e90917f4e4a1885c66c559c74aacfd5f",
    "wizard": "/_blob/12698403a6afd053dd12910b9fec5f84",
    "tophat": "/_blob/77baf018ee1d990da6bd464cb1101f93",
    "chair": "/_blob/e6351aa7ef92d60c6260eadf24737b6b",
    "star": "/_blob/a6e36b1b971c945541bbc0ab9e7fa21e",
}

INK = "#2a1f15"
CSS = """
    body { margin: 0; background: #fbeee2; color: #2a1f15; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }
    a { color: #a03e2f; } a:hover { color: #2a1f15; }
    img { display: block; } svg { display: block; }
    .pageTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
    .sectionTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 20px; line-height: 24px; }
    .cardTitleSm { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 14px; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .numeralLg { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 24px; line-height: 26px; }
    .numeral { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }
    .hand { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }
    .handSm { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 12px; line-height: 16px; }
    .kicker { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: #a03e2f; white-space: nowrap; }
    .kickerPill { font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: #605449; white-space: nowrap; }
    .kickerPillSm { font-weight: 800; font-size: 10px; line-height: 13px; letter-spacing: 1.4px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .label { font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }
    .mute { color: #605449; }
    .phone { position: relative; width: 390px; height: 1000px; overflow: hidden; background: #fffaf0; display: flex; flex-direction: column; }
    .statusArea { height: 48px; flex: none; }
    .pageHeader { display: flex; align-items: flex-end; justify-content: space-between; padding: 8px 18px 0; flex: none; }
    .crown { display: flex; flex-direction: column; gap: 4px; }
    .rule { height: 2px; width: 64px; background: #2a1f15; opacity: .3; border-radius: 1px; }
    .pocket { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #ffd87a; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(2deg); }
    .pocket img { width: 20px; height: 20px; }
    .ticketBtn { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; }
    .ticketBtn img { width: 20px; height: 20px; }
    .wall { position: relative; flex: 1 1 0; min-height: 0; margin-top: 8px; background: #f6e6d4; background-image: repeating-linear-gradient(180deg, transparent 0 46px, rgba(42, 31, 21, 0.08) 46px 48px); border-top: 2px solid #2a1f15; display: flex; flex-direction: column; overflow: hidden; padding-bottom: 110px; }
    .tag { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 12px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; background: #fffaf0; box-shadow: 2px 2px 0 #2a1f15; white-space: nowrap; }
    .tag.sun { background: #ffd87a; } .tag.sage { background: #c9dec1; } .tag.muted { background: #f6e6d4; color: #6a5c50; } .tag.peach { background: #ffc8a8; }
    .tag img { width: 14px; height: 14px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 2px solid #2a1f15; border-radius: 22px; background: #fffaf0; box-shadow: 4px 4px 0 #2a1f15; font-family: "Nunito", sans-serif; font-weight: 800; font-size: 15px; color: #2a1f15; cursor: pointer; }
    .btn.gold { background: linear-gradient(180deg, #F8D068, #F5C44A); color: #5A3F00; }
    .btn.sm { min-height: 36px; padding: 6px 14px; font-size: 13px; box-shadow: 2px 2px 0 #2a1f15; }
    .btn img { width: 18px; height: 18px; }
    .chalk { background: #3a2c1e; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; color: #fff3e2; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box; }
    .plank { height: 14px; background: linear-gradient(180deg, #8d5a2c, #74441e); border: 2px solid #2a1f15; border-radius: 4px; box-shadow: 2px 3px 0 #2a1f15; box-sizing: border-box; }
    .coaster { width: 74px; height: 74px; border-radius: 999px; border: 2px solid #2a1f15; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: #FAF7F3; position: relative; }
    .coaster img.art { width: 54px; height: 54px; object-fit: contain; }
    .coaster .rdot { position: absolute; left: -2px; bottom: 6px; width: 14px; height: 14px; border-radius: 999px; border: 2px solid #2a1f15; box-sizing: border-box; }
    .coaster .badge { position: absolute; right: -4px; top: -4px; width: 24px; height: 24px; border-radius: 999px; border: 2px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
    .coaster .badge img { width: 12px; height: 12px; }
    .r-common { background: #FAF7F3; } .r-uncommon { background: #E8F5E0; } .r-rare { background: #E0EBFF; } .r-epic { background: #EFE9FF; } .r-legendary { background: #FFF3D6; }
    .d-common { background: #cdbfae; } .d-uncommon { background: #7ba868; } .d-rare { background: #5a8bc5; } .d-epic { background: #a89bff; } .d-legendary { background: #F5C44A; }
    .slot { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 96px; }
    .door { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; min-height: 52px; padding: 6px 4px; }
    .door img, .door svg { width: 20px; height: 20px; }
    .door .lbl { font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; white-space: nowrap; }
    .door.on { background: #ffc8a8; }
    .door .badge { position: absolute; top: -9px; right: -7px; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: #ffd87a; border: 2px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; font-family: "Caprasimo", Georgia, serif; font-size: 12px; line-height: 18px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
    .rope { position: absolute; left: 0; right: 0; top: 0; height: 2px; background: #2a1f15; opacity: .35; }
    .hang:before { content: ""; position: absolute; top: -14px; left: 50%; width: 2px; height: 14px; background: #2a1f15; transform: translateX(-50%); }
    .sticker { background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; box-sizing: border-box; }
    .slotTile { position: relative; width: 40px; height: 40px; border-radius: 10px; border: 2px solid #2a1f15; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: #fffaf0; box-shadow: 2px 2px 0 #2a1f15; }
    .slotTile img { width: 28px; height: 28px; object-fit: contain; }
    .slotTile.empty { border-style: dashed; background: #fffaf0; box-shadow: none; }
    .slotTile .x { position: absolute; right: -7px; top: -7px; width: 16px; height: 16px; border-radius: 999px; background: #fffaf0; border: 1.5px solid #2a1f15; font-size: 10px; line-height: 13px; text-align: center; font-weight: 800; }
    .slotLbl { font-weight: 800; font-size: 8px; line-height: 10px; letter-spacing: 1px; text-transform: uppercase; color: #605449; text-align: center; margin-top: 3px; }
    .avatar { border-radius: 999px; border: 2px solid #2a1f15; background: #fffaf0; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; flex: none; box-sizing: border-box; }
    .avatar img { width: 92%; height: 92%; object-fit: contain; }
    .card { position: relative; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 3px 3px 0 #2a1f15; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; }
    .card .thumb { position: relative; aspect-ratio: 1.1; border-bottom: 2px solid #2a1f15; display: flex; align-items: center; justify-content: center; }
    .card .thumb img.art { width: 66%; height: 66%; object-fit: contain; }
    .card .foot { display: flex; flex-direction: column; gap: 6px; padding: 8px; align-items: flex-start; }
    .chip { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 4px 12px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; background: #fffaf0; box-shadow: 2px 2px 0 #2a1f15; white-space: nowrap; }
    .chip.on { border-width: 2.5px; background: #ffd87a; }
    .tabbar { position: absolute; left: 0; right: 0; bottom: 0; height: 90px; background: linear-gradient(180deg, #8d5a2c, #74441e); border-top: 2px solid #2a1f15; z-index: 20; }
    .tabbar:before { content: ""; position: absolute; left: 0; right: 0; top: 10px; height: 2px; background: #2a1f15; opacity: .35; }
    .sign { position: absolute; top: 20px; width: 64px; height: 58px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 10px; box-shadow: 2px 3px 0 #2a1f15; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-weight: 800; font-size: 11px; box-sizing: border-box; }
    .sign:before { content: ""; position: absolute; top: -18px; left: 50%; width: 2px; height: 18px; background: #2a1f15; transform: translateX(-50%); }
    .sign img { width: 20px; height: 20px; }
    .sign.on { background: #ffc8a8; transform: rotate(-2deg); }
    .tape { position: absolute; width: 64px; height: 16px; background: #EAD59E; border: 1.5px solid #C8AD77; opacity: .95; z-index: 4; }
    .grabber { width: 40px; height: 4px; border-radius: 2px; background: #8c7e71; align-self: center; }
    .stripPig { width: 84px; height: 84px; border-radius: 12px; border: 2px solid #2a1f15; overflow: hidden; background: #c8e3f0; flex: none; }
    .stripPig img { width: 100%; height: 100%; object-fit: cover; }
"""

ICON = {
    "shop": '<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    "hat": '<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14V9a5 5 0 0 1 10 0v5"/><path d="M3 14h18"/><path d="M5 14c0 3 3 4 7 4s7-1 7-4"/></svg>',
    "pig": '<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"/><path d="M5 8 3 4l4 2M19 8l2-4-4 2"/><ellipse cx="12" cy="15" rx="3" ry="2"/><path d="M9.5 11h.01M14.5 11h.01"/></svg>',
    "chev": '<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    "up": '<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    "x": '<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
}


def tabbar():
    xs = [8, 84, 160, 236, 312]
    names = ["Barn", "Friends", "Season", "Shop", "Me"]
    out = '<div class="tabbar">'
    for x, n in zip(xs, names):
        out += f'<div class="sign{" on" if n == "Shop" else ""}" style="left: {x + 3}px;"><img src="{B["crown"] if n == "Season" else B["door"] if n == "Barn" else B["gift"] if n == "Shop" else B["check"] if n == "Friends" else B["star"]}" alt=""><div>{n}</div></div>'
    return out + "</div>"


def header():
    return f'''<div class="statusArea"></div>
  <div class="pageHeader"><div class="crown"><div class="kickerPill">★ the shop</div><div class="pageTitle">Shop</div><div class="rule"></div></div>
    <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 6px;"><div class="ticketBtn"><img src="{B["gift"]}" alt="Gift code"></div><div class="pocket"><img src="{B["coin"]}" alt=""><div class="numeralLg" style="font-size: 20px; line-height: 22px;">339</div></div></div>
  </div>'''


def coaster(art, rarity="common", owned=False, locked=False, lifted=False):
    badge = ""
    if owned:
        badge = f'<div class="badge" style="background: #c9dec1;"><img src="{B["check"]}" alt=""></div>'
    elif locked:
        badge = f'<div class="badge" style="background: #ffd87a;"><img src="{B["lock"]}" alt=""></div>'
    lift = " transform: translateY(-6px); box-shadow: 0 0 0 3px #ffd87a, 3px 3px 0 #2a1f15;" if lifted else ""
    return f'<div class="coaster r-{rarity}" style="{lift}"><img class="art" src="{art}" alt=""><div class="rdot d-{rarity}"></div>{badge}</div>'


def price_tag(cost, afford=True, lean=-3):
    tone = "sun" if afford else "muted"
    return f'<div class="tag {tone}" style="transform: rotate({lean}deg);"><img src="{B["coin"]}" alt="">{cost}</div>'


def wear_tag(active, lean=-3):
    if active:
        return f'<div class="tag sage" style="transform: rotate({lean}deg);"><img src="{B["check"]}" alt="">Wearing</div>'
    return f'<div class="tag sun" style="transform: rotate({lean}deg);">Wear</div>'


def shelf(items, band=False, sign=None):
    """items: list of (art, rarity, tag_html, owned, locked, lifted)"""
    slots = ""
    for i, (art, rar, tag, owned, locked, lifted) in enumerate(items):
        slots += f'<div class="slot">{coaster(art, rar, owned, locked, lifted)}{tag}</div>'
    style = "position: relative; display: flex; flex-direction: column;"
    if band:
        style += " background: #FFE7AD; border-radius: 12px; margin: 0 -8px; padding: 8px 8px 0;"
    signhtml = f'<div style="position: absolute; right: 6px; top: -14px; z-index: 3; background: #F5C44A; border: 2px solid #2a1f15; border-radius: 999px; padding: 2px 10px; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; gap: 4px;"><img src="{B["crown"]}" alt="" style="width: 12px; height: 12px;"><span class="kickerPillSm">Slop Club</span></div>' if sign else ""
    return f'<div style="{style}">{signhtml}<div style="display: flex; justify-content: space-around; align-items: flex-end; padding: 0 4px; margin-bottom: -6px;">{slots}</div><div class="plank" style="margin-top: 2px;"></div></div>'


DROP1 = [(B["wizard"], "epic", price_tag("711", False), False, False, False),
         (B["wand"], "rare", price_tag("533", False, 2), False, False, False),
         (B["sleep"], "common", price_tag("114", True, -2), False, False, False)]
DROP2 = [(B["goggles"], "common", price_tag("120", True, 2), False, False, False),
         (B["acorn"], "common", wear_tag(True, -2), True, False, False),
         (B["tophat"], "uncommon", price_tag("150", True, 3), False, False, False)]
MEMBERS = [(B["crown"], "legendary", price_tag("3,000", False, -2), False, True, False),
           (B["chair"], "epic", price_tag("4,200", False, 2), False, True, False),
           (B["boat"], "rare", price_tag("3,000", False, -3), False, True, False)]

SLOTS = [("HAT", B["cowboy"]), ("BOW", B["acorn"]), ("FACE", B["catmask"]), ("NECK", B["bandana"]),
         ("HELD", B["shovel"]), ("AURA", None), ("BG", None), ("TICKLES", None)]


def slot_tiles(size=40, with_x=True, cols=4):
    out = f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: 10px 8px;">'
    for lbl, art in SLOTS:
        if art:
            tile = f'<div class="slotTile"><img src="{art}" alt="">{"<div class=\"x\">×</div>" if with_x else ""}</div>'
        else:
            tile = '<div class="slotTile empty"></div>'
        out += f'<div style="display: flex; flex-direction: column; align-items: center;">{tile}<div class="slotLbl">{lbl}</div></div>'
    return out + "</div>"


def chalk(small=False):
    if small:
        return '<div class="chalk" style="padding: 6px 10px; flex: 1 1 auto; min-width: 0; box-shadow: 3px 3px 0 #2a1f15;"><div class="kickerPillSm" style="color: #ffd87a; letter-spacing: 1px; overflow: hidden; text-overflow: ellipsis;">★ back at sunrise</div><div class="numeral" style="font-size: 18px; line-height: 20px;">8h 13m</div></div>'
    return '<div class="chalk" style="transform: rotate(-2deg);"><div class="kickerPillSm" style="color: #ffd87a;">★ back at sunrise</div><div class="numeralLg">8h 13m</div></div>'


def counter():
    figs = ""
    for pig, bg, item, note in [("pickles", "#FADFE6", B["sleep"], "sleep mask"), ("bandit", "#DEDDE0", B["wand"], "a wand"), ("biscuit", "#F5E6D6", B["tophat"], "top hat")]:
        figs += f'<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; width: 84px;"><div style="position: relative;"><div class="avatar" style="width: 40px; height: 40px; background: {bg};"><img src="{B[pig]}" alt=""></div><img src="{item}" alt="" style="position: absolute; right: -10px; top: -10px; width: 26px; height: 26px; object-fit: contain;"></div><div class="handSm">{note}</div></div>'
    return f'''<div style="position: relative; margin-top: 10px; height: 118px; flex: none;">
      <img src="{B["pepper"]}" alt="" style="position: absolute; right: 22px; bottom: 58px; width: 64px;">
      <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: linear-gradient(180deg, #8d5a2c, #74441e); border-top: 2px solid #2a1f15;"></div>
      <div style="position: absolute; left: 0; right: 0; bottom: 48px; height: 12px; background: #8d5a2c; border: 2px solid #2a1f15; box-sizing: border-box;"></div>
      <div class="kickerPillSm" style="position: absolute; left: 12px; bottom: 64px; color: #605449;">at the counter today</div>
      <div style="position: absolute; left: 8px; bottom: 4px; display: flex; align-items: flex-end;">{figs}</div>
    </div>'''


def page(title, body, w=390, h=1000):
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <title>{title}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;display=swap">
  <style>{CSS}
  </style>
</helmet>
<div class="phone" style="width: {w}px; height: {h}px;">
{body}
</div>
</x-dc>
<script data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''


# ───────────────────────── A · One aisle ─────────────────────────
def fitting_strip(pig=B["rosie"], note="Wearing 5 of 8 · tap a slot to take it off"):
    return f'''<div class="sticker" style="margin: 10px 18px 0; padding: 10px 12px; display: flex; gap: 12px; align-items: center; flex: none; background: #fffaf0;">
      <div class="stripPig"><img src="{pig}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;"><div class="kickerPill">★ the fitting room</div><a href="#closet" class="tag peach" style="text-decoration: none; color: #2a1f15;">Closet · 13 <span style="display: inline-flex; width: 14px; height: 14px;">{ICON["chev"]}</span></a></div>
        {slot_tiles(size=36, with_x=True, cols=4)}
      </div>
    </div>'''


def board_a1():
    body = header() + f'''
  <div class="wall">
    {fitting_strip()}
    <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 18px 0;">
      {chalk(small=True)}
      <div style="display: flex; gap: 8px; padding-top: 2px;">
        <div class="door" style="width: 64px;">{ICON["pig"]}<div class="lbl">Pen</div></div>
        <div class="door" style="width: 70px;"><img src="{B["door"]}" alt=""><div class="lbl">Furnish</div></div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    <div style="padding: 18px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ further down the aisle</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
  </div>
  ''' + tabbar()
    return page("A · One aisle", body)


def board_a2():
    cards = [(B["boat"], "common", True, False), (B["cowboy"], "uncommon", True, True), (B["wizard"], "epic", False, False),
             (B["catmask"], "rare", True, True), (B["aviator"], "rare", True, True), (B["goggles"], "common", False, False)]
    grid = '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 8px 18px 0;">'
    for art, rar, owned, active in cards:
        foot = wear_tag(active, 0) if owned else f'<div class="tag muted" style="font-size: 11px;">Not owned</div>'
        chk = f'<div style="position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; border-radius: 999px; background: #c9dec1; border: 2px solid #2a1f15; display: flex; align-items: center; justify-content: center;"><img src="{B["check"]}" alt="" style="width: 11px; height: 11px;"></div>' if owned else ""
        grid += f'<div class="card"><div class="thumb r-{rar}"><img class="art" src="{art}" alt="">{chk}</div><div class="foot">{foot}</div></div>'
    grid += "</div>"
    body = header() + f'''
  <div class="wall">
    {fitting_strip(note="")}
    <div style="padding: 12px 18px 0; display: flex; align-items: flex-end; justify-content: space-between;"><div><div class="kicker">★ further down the aisle</div><div class="sectionTitle">Your closet</div></div><div class="label mute">13 owned</div></div>
    <div style="display: flex; gap: 6px; padding: 10px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Owned</div><div class="chip">Hats</div><div class="chip">Face</div><div class="chip">Neck</div><div class="chip">Held</div></div>
    {grid}
    <div style="padding: 14px 18px 0;"><div class="sticker" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;"><div><div class="kickerPill">title</div><div class="cardTitleSm" style="font-size: 16px;">No title — tap to pick</div></div><div style="width: 20px; height: 20px;">{ICON["chev"]}</div></div></div>
  </div>
  ''' + tabbar()
    return page("A · One aisle, scrolled to the closet", body)


# ───────────────────── B · Signs that stay put ─────────────────────
def sign_rail(active="Store"):
    doors = [("Store", ICON["shop"], None), ("Closet", ICON["hat"], "13"), ("Pen", ICON["pig"], None), ("Furnish", f'<img src="{B["door"]}" alt="">', None)]
    out = '<div style="position: relative; padding: 14px 18px 0; flex: none;"><div class="rope"></div><div style="display: flex; gap: 8px;">'
    for name, icon, badge in doors:
        b = f'<div class="badge">{badge}</div>' if badge else ""
        out += f'<div class="door hang{" on" if name == active else ""}" style="flex: 1 1 0; min-height: 56px;">{icon}<div class="lbl">{name}</div>{b}</div>'
    return out + "</div></div>"


def tryon_strip(art, name, cost=None, active=False, owned=False):
    if owned:
        action = f'<button class="btn sm" style="background: #c9dec1;">Take off</button>' if active else '<button class="btn sm gold">Wear</button>'
    else:
        action = f'<button class="btn sm gold"><img src="{B["coin"]}" alt="">Buy · {cost}</button>'
    return f'''<div style="position: relative; margin: 2px 18px 0; padding: 10px 12px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 3px 3px 0 #2a1f15; display: flex; align-items: center; gap: 12px;">
        <div style="position: absolute; left: 50%; top: -9px; width: 14px; height: 14px; background: #fffaf0; border-left: 2px solid #2a1f15; border-top: 2px solid #2a1f15; transform: translateX(-50%) rotate(45deg);"></div>
        <div class="stripPig" style="width: 72px; height: 72px;"><img src="{B["rosie_nohat"]}" alt="Rosie trying it on"></div>
        <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 4px;"><div class="kickerPillSm mute">trying on</div><div class="cardTitleSm" style="font-size: 16px;">{name}</div><div class="handSm mute">Common · sits over her eyes</div></div>
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">{action}<div style="width: 18px; height: 18px; opacity: .6;">{ICON["x"]}</div></div>
      </div>'''


def board_b1():
    drop1 = list(DROP1)
    drop1[2] = (B["sleep"], "common", price_tag("114", True, -2), False, False, True)
    body = header() + f'''
  <div class="wall">
    {sign_rail("Store")}
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 0;">{chalk(small=True)}<div class="handSm mute" style="text-align: right;">tap a coaster to try it on<br>right here on the shelf</div></div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 18px 0;">
      {shelf(drop1)}
    </div>
    {tryon_strip(B["sleep"], "Sleep Mask", cost="114")}
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    {counter()}
  </div>
  ''' + tabbar()
    return page("B · Signs that stay put — the store", body)


def board_b2():
    cards = [(B["boat"], "common", True, False), (B["cowboy"], "uncommon", True, True), (B["wizard"], "epic", False, False),
             (B["catmask"], "rare", True, True), (B["aviator"], "rare", True, True), (B["goggles"], "common", False, False),
             (B["acorn"], "common", True, True), (B["bandana"], "common", True, True), (B["shovel"], "rare", True, True)]
    grid = '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 10px 18px 0;">'
    for art, rar, owned, active in cards:
        foot = wear_tag(active, 0) if owned else f'<div class="tag muted" style="font-size: 11px;">Not owned</div>'
        grid += f'<div class="card"><div class="thumb r-{rar}"><img class="art" src="{art}" alt=""></div><div class="foot">{foot}</div></div>'
    grid += "</div>"
    body = header() + f'''
  <div class="wall">
    {sign_rail("Closet")}
    <div class="sticker" style="margin: 12px 18px 0; padding: 10px 12px; display: flex; gap: 12px; align-items: center; flex: none;">
      <div class="stripPig"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
      <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px;"><div class="kickerPill">★ wearing now</div>{slot_tiles(cols=4)}</div>
    </div>
    <div style="display: flex; gap: 6px; padding: 10px 18px 0; overflow: hidden;"><div class="chip on">All</div><div class="chip">Owned</div><div class="chip">Unowned</div><div class="chip">Member</div></div>
    {grid}
  </div>
  ''' + tabbar()
    return page("B · Signs that stay put — the closet, same rail", body)


# ───────────────────── C · The fitting-room drawer ─────────────────────
def drawer(up=False, tryon=None):
    if not up:
        inner = f'''<div class="grabber"></div>
        <div style="display: flex; align-items: center; gap: 12px; padding-top: 6px;">
          <div class="stripPig" style="width: 64px; height: 64px;"><img src="{B["rosie"] if not tryon else B["rosie_nohat"]}" alt="Rosie"></div>
          <div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;"><div class="kickerPill">★ {"trying on · Sleep Mask" if tryon else "the fitting room"}</div><div style="width: 18px; height: 18px;">{ICON["up"]}</div></div>
            {"<div style=\"display: flex; gap: 8px; align-items: center;\"><button class=\"btn sm gold\"><img src=\"" + B["coin"] + "\" alt=\"\">Buy · 114</button><div class=\"handSm mute\">or keep browsing</div></div>" if tryon else slot_tiles(cols=8, with_x=False)}
          </div>
        </div>'''
        return f'<div style="position: absolute; left: 0; right: 0; bottom: 90px; z-index: 15; background: #fffaf0; border: 2px solid #2a1f15; border-bottom: 0; border-radius: 22px 22px 0 0; padding: 8px 16px 12px; box-shadow: 0 -4px 0 #2a1f15; display: flex; flex-direction: column; gap: 4px;">{inner}</div>'
    cards = [(B["boat"], "common", True, False), (B["cowboy"], "uncommon", True, True), (B["wizard"], "epic", False, False),
             (B["catmask"], "rare", True, True), (B["aviator"], "rare", True, True), (B["goggles"], "common", False, False)]
    grid = '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;">'
    for art, rar, owned, active in cards:
        foot = wear_tag(active, 0) if owned else f'<div class="tag muted" style="font-size: 11px;">Not owned</div>'
        grid += f'<div class="card"><div class="thumb r-{rar}"><img class="art" src="{art}" alt=""></div><div class="foot">{foot}</div></div>'
    grid += "</div>"
    return f'''<div style="position: absolute; left: 0; right: 0; top: 118px; bottom: 90px; z-index: 15; background: #fffaf0; border: 2px solid #2a1f15; border-bottom: 0; border-radius: 22px 22px 0 0; padding: 8px 16px 0; box-shadow: 0 -4px 0 #2a1f15; display: flex; flex-direction: column; gap: 10px; overflow: hidden;">
      <div class="grabber"></div>
      <div style="display: flex; align-items: center; justify-content: space-between;"><div><div class="kickerPill">★ the fitting room</div><div class="sectionTitle">Closet · 13</div></div><div style="display: flex; gap: 8px;"><div class="door" style="width: 58px; min-height: 46px;">{ICON["pig"]}<div class="lbl">Pen</div></div><div class="door" style="width: 64px; min-height: 46px;"><img src="{B["door"]}" alt=""><div class="lbl">Furnish</div></div></div></div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <div class="stripPig" style="width: 132px; height: 132px; border-radius: 16px;"><img src="{B["rosie"]}" alt="Rosie, dressed"></div>
        <div style="flex: 1 1 0; min-width: 0;">{slot_tiles(cols=4)}</div>
      </div>
      <div style="display: flex; gap: 6px; overflow: hidden;"><div class="chip on">All</div><div class="chip">Owned</div><div class="chip">Hats</div><div class="chip">Face</div><div class="chip">Neck</div></div>
      {grid}
    </div>'''


def board_c1():
    drop1 = list(DROP1)
    drop1[2] = (B["sleep"], "common", price_tag("114", True, -2), False, False, True)
    body = header() + f'''
  <div class="wall">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 18px 0;">{chalk()}<div class="handSm mute" style="text-align: right; padding-top: 6px;">the whole tab is shelves;<br>your pig waits in the drawer</div></div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(drop1)}
      {shelf(DROP2)}
      {shelf(MEMBERS, band=True, sign=True)}
    </div>
    {counter()}
  </div>
  {drawer(up=False, tryon="sleep")}
  ''' + tabbar()
    return page("C · The fitting-room drawer — trying on from the shelf", body)


def board_c2():
    body = header() + f'''
  <div class="wall" style="opacity: .45;">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 18px 0;">{chalk()}</div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 18px 0;">
      {shelf(DROP1)}
      {shelf(DROP2)}
    </div>
  </div>
  {drawer(up=True)}
  ''' + tabbar()
    return page("C · The fitting-room drawer — pulled up", body)


if __name__ == "__main__":
    boards = {
        "Main.dc.html": ("A · One aisle", board_a1()),
        "A2_Closet.dc.html": ("A · scrolled to the closet", board_a2()),
        "B1_Store.dc.html": ("B · the store, try-on under the shelf", board_b1()),
        "B2_Closet.dc.html": ("B · the closet, same rail", board_b2()),
        "C1_Store.dc.html": ("C · shelves + the drawer", board_c1()),
        "C2_Drawer.dc.html": ("C · the drawer pulled up", board_c2()),
    }
    for name, (_, html) in boards.items():
        open(os.path.join(OUT, name), "w").write(html)

    W, H, GAP, ROW = 390, 844, 80, 844 + 300
    layout = {}
    rows = [["Main.dc.html", "A2_Closet.dc.html"], ["B1_Store.dc.html", "B2_Closet.dc.html"], ["C1_Store.dc.html", "C2_Drawer.dc.html"]]
    for r, row in enumerate(rows):
        for c, name in enumerate(row):
            layout[name] = {"x": c * (W + GAP), "y": r * ROW, "w": W, "h": H, "title": boards[name][0]}
    notes = {
        "tA": {"x": 0, "y": -250, "text": "A · One aisle — no rooms. The fitting room is pinned; the closet is further down the same scroll.", "kind": "title1", "maxW": 860},
        "tB": {"x": 0, "y": ROW - 250, "text": "B · Signs that stay put — rooms stay, the rail never moves; try-on happens under the shelf.", "kind": "title1", "maxW": 860},
        "tC": {"x": 0, "y": 2 * ROW - 250, "text": "C · The fitting-room drawer — one screen; your pig lives in a drawer over the shelves.", "kind": "title1", "maxW": 860},
        "sA": {"x": 960, "y": 0, "w": 300, "text": "What jumps today: Store → sign → Closet (new page, scroll lost) → back via a Store sign that only exists away from the store; buying and wearing each open a sheet. A removes the rooms: one scroll, the pig pinned at the top, Wear tags on every card, the Closet grid a section further down. Pen and Furnish stay as small doors.", "size": "s"},
        "sB": {"x": 960, "y": ROW, "w": 300, "text": "B keeps the rooms (least code moved) but fixes the two things that read as jumping: the sign rail is identical in every room, and a tapped coaster opens a try-on strip under its own shelf instead of a sheet. Only buying confirms in a sheet. Each room keeps its scroll.", "size": "s"},
        "sC": {"x": 960, "y": 2 * ROW, "w": 300, "text": "C makes the tab one place: shelves fill it; your pig waits in a drawer that peeks above the tab bar. Tap a coaster and the drawer tries it on. Pull the drawer up and it is the Closet, with Pen and Furnish as doors in its head. Nothing navigates.", "size": "s"},
    }
    canvas = {
        "v": 3,
        "createdOnFiles": {"v": 1, "at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
        "title": "Storefront, less jumping",
        "launch": {"view": "canvas"},
        "pages": [],
        "boards": layout,
        "order": list(layout.keys()),
        "notes": notes,
        "designSystems": [],
    }
    json.dump(canvas, open(os.path.join(OUT, "canvas.json"), "w"), indent=1)
    print("wrote", sorted(os.listdir(OUT)))
