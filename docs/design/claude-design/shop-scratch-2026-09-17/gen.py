#!/usr/bin/env python3
"""Shop From Scratch — three directions for the Shop tab, seven phone boards.
Tokens are constants/theme.ts (WHIMSY, TYPE, RADII, SPACE); art is the shipped art, uploaded."""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "project")
os.makedirs(OUT, exist_ok=True)

B = {
    "rosie_dressed": "/_blob/eb85f2649fde22f604572cfe7e91fff1",
    "rosie": "/_blob/aeadbac0f0e33c6f49adb2a7e2a6d5bb",
    "pepper": "/_blob/ac9ee4810cbfb82a1e8680357770ad0d",
    "bandit": "/_blob/7745925179377cf4b7b1b3a8dd25c2f0",
    "copper": "/_blob/9c3de40f786e2530373d9a7bf89eaca7",
    "moth": "/_blob/cca15db816be8ef34fbda6d2664b4928",
    "sleep": "/_blob/c1aa0e977ac2d9a252119ac28add9c61",
    "sparkle": "/_blob/cde83c1ba43d7afccf7d6cfdfd7dd004",
    "wand": "/_blob/63699377595ccfd61ecc50521c42be64",
    "bg_pumpkin": "/_blob/6089f9a4a8aed88f2c698bf7cdfb9475",
    "goggles": "/_blob/d47556a569d31c24f663ec00b4be7b86",
    "acorn": "/_blob/aa6831b19d4deb68e7448676596076cf",
    "bg_candy": "/_blob/2f08070656732aad32c240653dd46ea9",
    "circlet": "/_blob/7e012e10bd78efdb7f4f8defea3a435c",
    "bg_ballroom": "/_blob/b7c0f53c567ccd30a18fdd878c332c37",
    "monocle": "/_blob/784aabd386170a2d02085e978602d06a",
    "party": "/_blob/02253f397abfc98ed86b2a010e7c0c07",
    "cowboy": "/_blob/240020be47dfb7ad6b3a43be96bc0895",
    "wizard": "/_blob/75a7275787d29df42609d4d35bc83f8b",
    "tophat": "/_blob/3721b62ecf9cd891b645dd967873280d",
    "crown": "/_blob/3ad1742714d16ad71aa2d5810a261f10",
    "mushroom": "/_blob/4bbe15fdd68b628d2460bbc8cd0e5f8d",
    "hibiscus": "/_blob/c308f3552dd2e219eaac313477c0b414",
    "pineapple": "/_blob/f661950c1730558bfd2d580d1b967333",
    "frost": "/_blob/54be2c4e895cdb2385b0d196e24b9ce0",
    "leaf": "/_blob/c5a199f0b22c0398e93c7abf352aea97",
    "stardust": "/_blob/f3a79741b90ee8181b146f63c62bd11f",
    "catmask": "/_blob/bf01b45462018bcd5963b8807d666258",
    "aviator": "/_blob/10b816e9cc6a779a59541a8d73862af0",
    "bandana": "/_blob/08d307e77192a237bc0bd9f75adb31cb",
    "shovel": "/_blob/8238d7466af34b96a8f929be79cb5b9d",
    "crown_spark": "/_blob/29aa88c84423617595f79a0681aef6b9",
    "fireflies": "/_blob/67a862fc016a7357cbab96d3ce6e2831",
    "bg_beach": "/_blob/390877264f2bb86ba76f0f199274faae",
    "halo": "/_blob/d37bbf7157a6654d68d69c4e7aeeb044",
    "scarf": "/_blob/3251190b71618638c48d02caef4b4157",
    "beanie": "/_blob/e4e16e8f0bf2c6948f161e9aa527ea48",
    "g_check": "/_blob/94c9f4aa24dfaf8a8b130fa64bd8529f",
    "g_lock": "/_blob/28bb00076dca5f577c3c8afbdf6f18c1",
    "g_crown": "/_blob/f45de07801cb927d430b3d5011789b98",
    "g_pigface": "/_blob/93d7b7387be17fa4a1e3293fc09970d4",
    "g_barn_door": "/_blob/71e62b418aff36c23b26811a40d76f29",
    "g_store": "/_blob/5d54596504823dab9f09452962f9eaff",
    "g_closet": "/_blob/28f3952312f5aa0bd95a50b936aa4a82",
    "g_pen": "/_blob/48bf67f820225bf5bfe60e97137d8c1a",
    "g_zzz": "/_blob/ff4e3eb919b85503a5d0fba243d4882e",
    "g_search": "/_blob/645d90fc1413ce04ac195f5ea201af4a",
    "coin": "/_blob/f0b2c39654ce874cb0ba22e5807b0fc3",
    "tab_barn": "/_blob/5ce49510ab96f1c61c95b18fb288a8bc",
    "tab_friends": "/_blob/82ea7cf4e968cf759d211d5159999747",
    "tab_season": "/_blob/c65b13877a6ffab163a6b344845b625d",
    "tab_shop": "/_blob/61a624353c5e789830f2b3ec94aa7d13",
    "tab_me": "/_blob/510751759403d649f69e29bf94655575",
}

# ── Tokens (constants/theme.ts) ──────────────────────────────────────────
INK = "#2a1f15"; PAPER = "#fffaf0"; CREAM = "#fbeee2"; CREAM2 = "#f6e6d4"
SUN = "#ffd87a"; SAGE = "#c9dec1"; PEACH = "#ffc8a8"; LILAC = "#d6c8f0"; ROSE = "#ffd6dc"; SKY = "#c8e3f0"
ACCENT = "#a03e2f"; MUTE = "#605449"; MUTEDIM = "#6a5c50"; BARK = "#3a2c1e"; BARKTEXT = "#fff3e2"
SLOPGOLD = "#F5C44A"; SLOPBAND = "#FFE7AD"; GOLDINK = "#5A3F00"
WOODTOP = "#8d5a2c"; WOODBOT = "#74441e"
RBG = {"common": "#FAF7F3", "uncommon": "#E8F5E0", "rare": "#E0EBFF", "epic": "#EFE9FF", "legendary": "#FFF3D0"}
RDOT = {"common": "#cdbfae", "uncommon": "#7ba868", "rare": "#5a8bc5", "epic": "#a89bff", "legendary": "#d4a437"}

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@700;800;900&family=Patrick+Hand&display=swap">'

CSS = f"""
    body {{ margin: 0; background: {CREAM}; color: {INK}; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }}
    a {{ color: {ACCENT}; text-decoration: none; }} a:hover {{ color: {INK}; }}
    img {{ display: block; }} svg {{ display: block; }}
    button {{ font: inherit; color: inherit; cursor: pointer; }}
    .phone {{ position: relative; overflow: hidden; background: {CREAM}; display: flex; flex-direction: column; box-sizing: border-box; }}
    .status {{ height: 48px; flex: none; }}
    .pageTitle {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }}
    .sectionTitle {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 22px; line-height: 24px; letter-spacing: .2px; }}
    .cardTitleSm {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 15px; line-height: 20px; letter-spacing: .2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .numeralLg {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }}
    .numeral {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }}
    .hand {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }}
    .handLg {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 17px; line-height: 24px; }}
    .kicker {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: {ACCENT}; white-space: nowrap; }}
    .kickerPill {{ font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: {MUTE}; white-space: nowrap; }}
    .kickerPillSm {{ font-weight: 800; font-size: 10px; line-height: 13px; letter-spacing: 1.4px; text-transform: uppercase; white-space: nowrap; }}
    .label {{ font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }}
    .bodySm {{ font-weight: 700; font-size: 13px; line-height: 18px; }}
    .mute {{ color: {MUTE}; }}
    .crown {{ display: flex; align-items: flex-end; justify-content: space-between; padding: 6px 18px 0; flex: none; }}
    .crown .rule {{ height: 2px; width: 64px; background: {INK}; opacity: .3; border-radius: 1px; margin-top: 4px; }}
    .pocket {{ display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: {SUN}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 4px 4px 0 {INK}; transform: rotate(2deg); }}
    .pocket img {{ width: 20px; height: 20px; }}
    .tag {{ display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 10px; border: 1.5px solid {INK}; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; white-space: nowrap; box-sizing: border-box; }}
    .tag.sun {{ background: {SUN}; }} .tag.sage {{ background: {SAGE}; }} .tag.muted {{ background: {CREAM2}; color: {MUTEDIM}; box-shadow: none; }} .tag.lilac {{ background: {LILAC}; }} .tag.gold {{ background: {SLOPGOLD}; }}
    .tag img {{ width: 13px; height: 13px; }}
    .tag.hand {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; letter-spacing: 0; }}
    .chip {{ display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 4px 12px; border: 1.5px solid {INK}; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; white-space: nowrap; box-sizing: border-box; }}
    .chip.on {{ border-width: 2px; background: {SUN}; }}
    .chip img {{ width: 16px; height: 16px; }}
    .seg {{ display: flex; border: 2px solid {INK}; border-radius: 999px; background: {PAPER}; box-shadow: 3px 3px 0 {INK}; padding: 3px; gap: 2px; }}
    .seg button {{ flex: 1 1 0; min-height: 34px; border: 0; border-radius: 999px; background: transparent; font-weight: 800; font-size: 13px; padding: 0 8px; white-space: nowrap; }}
    .seg button.on {{ background: {SUN}; box-shadow: inset 0 0 0 2px {INK}; }}
    .btn {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 2px solid {INK}; border-radius: 22px; background: {PAPER}; box-shadow: 4px 4px 0 {INK}; font-weight: 800; font-size: 15px; color: {INK}; box-sizing: border-box; }}
    .btn.gold {{ background: linear-gradient(180deg, #F8D068, #F5C44A); color: {GOLDINK}; }}
    .btn.ghost {{ background: transparent; box-shadow: none; border-color: transparent; }}
    .ticket {{ display: flex; align-items: stretch; border: 2px solid {INK}; border-radius: 14px; background: linear-gradient(180deg, #F8D068, #F5C44A); box-shadow: 4px 4px 0 {INK}; overflow: hidden; color: {GOLDINK}; min-height: 44px; }}
    .ticket .stub {{ display: flex; align-items: center; gap: 4px; padding: 0 10px; border-right: 2px dashed {INK}; background: {PAPER}; color: {INK}; }}
    .ticket .stub img {{ width: 16px; height: 16px; }}
    .ticket .face {{ flex: 1; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; padding: 0 12px; }}
    .chalk {{ background: {BARK}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 4px 4px 0 {INK}; color: {BARKTEXT}; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box; transform: rotate(-1.5deg); }}
    .chalk .k {{ color: {SUN}; }}
    .plank {{ height: 14px; background: linear-gradient(180deg, {WOODTOP}, {WOODBOT}); border: 2px solid {INK}; border-radius: 3px; box-shadow: 2px 3px 0 {INK}; box-sizing: border-box; }}
    .coaster {{ position: relative; width: 66px; height: 66px; border-radius: 999px; border: 2px solid {INK}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; flex: none; }}
    .coaster img.art {{ width: 50px; height: 50px; object-fit: contain; }}
    .coaster .rdot {{ position: absolute; left: -2px; bottom: 4px; width: 14px; height: 14px; border-radius: 999px; border: 2px solid {INK}; box-sizing: border-box; box-shadow: 1px 1px 0 {INK}; }}
    .coaster .badge {{ position: absolute; right: -4px; top: -4px; width: 24px; height: 24px; border-radius: 999px; border: 2px solid {INK}; box-shadow: 2px 2px 0 {INK}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }}
    .coaster .badge img {{ width: 12px; height: 12px; }}
    .coaster.sm {{ width: 48px; height: 48px; }} .coaster.sm img.art {{ width: 36px; height: 36px; }} .coaster.sm .rdot {{ width: 11px; height: 11px; bottom: 2px; }}
    .slot {{ display: flex; flex-direction: column; align-items: center; gap: 4px; width: 104px; }}
    .slot .tagWrap {{ margin-top: -8px; }}
    .peg {{ position: relative; width: 30px; height: 30px; border-radius: 8px; border: 2px solid {INK}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; flex: none; }}
    .peg img {{ width: 22px; height: 22px; object-fit: contain; }}
    .peg.empty {{ border-style: dashed; box-shadow: none; background: transparent; }}
    .peg.on {{ background: {PEACH}; }}
    .peg .x {{ position: absolute; right: -7px; top: -7px; width: 14px; height: 14px; border-radius: 999px; background: {PAPER}; border: 1.5px solid {INK}; font-size: 9px; line-height: 11px; text-align: center; font-weight: 800; }}
    .pegLbl {{ font-weight: 800; font-size: 8px; line-height: 10px; letter-spacing: 1px; text-transform: uppercase; color: {MUTE}; text-align: center; margin-top: 3px; }}
    .slotTile {{ position: relative; width: 44px; height: 44px; border-radius: 10px; border: 2px solid {INK}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; }}
    .slotTile img {{ width: 30px; height: 30px; object-fit: contain; }}
    .slotTile.empty {{ border-style: dashed; box-shadow: none; }}
    .slotTile .x {{ position: absolute; right: -8px; top: -8px; width: 18px; height: 18px; border-radius: 999px; background: {PAPER}; border: 1.5px solid {INK}; font-size: 11px; line-height: 15px; text-align: center; font-weight: 800; }}
    .slotLbl {{ font-weight: 800; font-size: 8px; line-height: 10px; letter-spacing: 1px; text-transform: uppercase; color: {MUTE}; text-align: center; margin-top: 3px; }}
    .sticker {{ background: {PAPER}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 4px 4px 0 {INK}; box-sizing: border-box; }}
    .sticker.flat {{ box-shadow: 2px 2px 0 {INK}; }}
    .door {{ position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: {PAPER}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; min-height: 50px; width: 60px; padding: 6px 4px; }}
    .door img {{ width: 22px; height: 22px; }}
    .door .lbl {{ font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: .3px; white-space: nowrap; }}
    .hang {{ position: relative; padding-top: 14px; }}
    .hang:before {{ content: ""; position: absolute; top: 0; left: 50%; width: 2px; height: 14px; background: {INK}; transform: translateX(-50%); }}
    .tile {{ position: relative; background: {PAPER}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 3px 3px 0 {INK}; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; }}
    .tile .thumb {{ position: relative; height: 84px; border-bottom: 2px solid {INK}; display: flex; align-items: center; justify-content: center; }}
    .tile .thumb img.art {{ width: 58px; height: 58px; object-fit: contain; }}
    .tile .thumb .rdot {{ position: absolute; left: 6px; top: 6px; width: 12px; height: 12px; border-radius: 999px; border: 2px solid {INK}; box-sizing: border-box; }}
    .tile .thumb .badge {{ position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; border-radius: 999px; border: 2px solid {INK}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }}
    .tile .thumb .badge img {{ width: 11px; height: 11px; }}
    .tile .foot {{ display: flex; flex-direction: column; gap: 5px; padding: 6px 8px 8px; }}
    .tile.wearing {{ background: {LILAC}; }}
    .tabbar {{ position: absolute; left: 0; right: 0; bottom: 0; height: 90px; background: linear-gradient(180deg, {WOODTOP}, {WOODBOT}); border-top: 2px solid {INK}; z-index: 20; }}
    .tabbar:before {{ content: ""; position: absolute; left: 0; right: 0; top: 10px; height: 2px; background: {INK}; opacity: .35; }}
    .sign {{ position: absolute; top: 22px; width: 64px; height: 56px; background: {PAPER}; border: 2px solid {INK}; border-radius: 10px; box-shadow: 2px 3px 0 {INK}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-weight: 800; font-size: 11px; box-sizing: border-box; }}
    .sign:before {{ content: ""; position: absolute; top: -20px; left: 50%; width: 2px; height: 20px; background: {INK}; transform: translateX(-50%); }}
    .sign img {{ width: 24px; height: 24px; }}
    .sign.on {{ background: {PEACH}; transform: rotate(-2deg); }}
    .tape {{ position: absolute; height: 18px; padding: 0 10px; background: #EAD59E; border: 1.5px solid #C8AD77; opacity: .96; z-index: 4; font-family: "Patrick Hand", cursive; font-size: 12px; line-height: 15px; color: {INK}; white-space: nowrap; }}
    .window {{ border-radius: 12px; border: 2px solid {INK}; overflow: hidden; background: {SKY}; flex: none; }}
    .window img {{ width: 100%; height: 100%; object-fit: cover; }}
    .avatar {{ border-radius: 999px; border: 2px solid {INK}; background: {PAPER}; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; flex: none; box-sizing: border-box; }}
    .avatar img {{ width: 92%; height: 92%; object-fit: contain; }}
    .grabber {{ width: 40px; height: 4px; border-radius: 2px; background: #8c7e71; align-self: center; }}
    .row {{ display: flex; align-items: center; gap: 10px; }}
    .col {{ display: flex; flex-direction: column; }}
    .band {{ background: {SLOPBAND}; border-radius: 12px; padding: 12px 8px 8px; position: relative; }}
    .band .bsign {{ position: absolute; top: -12px; right: 10px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; background: {SLOPGOLD}; border: 2px solid {INK}; border-radius: 999px; box-shadow: 2px 2px 0 {INK}; transform: rotate(-2deg); font-weight: 800; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; }}
    .band .bsign img {{ width: 12px; height: 12px; }}
    .rail {{ display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; }}
    .rail.on {{ background: {SUN}; border: 2px solid {INK}; box-shadow: 3px 3px 0 {INK}; }}
    .rail .name {{ flex: 1; min-width: 0; }}
    .mirror {{ position: relative; border: 4px solid {WOODTOP}; outline: 2px solid {INK}; border-radius: 70px 70px 14px 14px; overflow: hidden; background: {SKY}; box-shadow: 4px 4px 0 {INK}; }}
    .mirror img {{ width: 100%; height: 100%; object-fit: cover; }}
    .divider {{ height: 2px; background: {INK}; opacity: .18; border-radius: 1px; }}
"""

ITEMS = {
    # name: (blob, rarity)
    "Candy Land": ("bg_candy", "rare"), "Moth Waltz": ("moth", "rare"), "Sleep Mask": ("sleep", "common"),
    "Sparkle Particle": ("sparkle", "common"), "Magic Wand": ("wand", "rare"), "Pumpkin Patch": ("bg_pumpkin", "rare"),
    "Safety Goggles": ("goggles", "common"), "Acorn Bow": ("acorn", "common"),
    "Candlelit Circlet": ("circlet", "rare"), "Moonlit Ballroom": ("bg_ballroom", "epic"), "Crest Monocle": ("monocle", "rare"),
    "Party Hat": ("party", "common"), "Cowboy Hat": ("cowboy", "uncommon"), "Wizard Hat": ("wizard", "epic"),
    "Top Hat": ("tophat", "rare"), "Crown": ("crown", "legendary"), "Mushroom Cap": ("mushroom", "uncommon"),
    "Hibiscus Crown": ("hibiscus", "rare"), "Pineapple Tiki": ("pineapple", "rare"), "Frost Monarch": ("frost", "epic"),
    "Leaf Crown": ("leaf", "common"), "Stardust Bow": ("stardust", "epic"), "Cat Mask": ("catmask", "uncommon"),
    "Aviators": ("aviator", "common"), "Red Bandana": ("bandana", "common"), "Mud Shovel": ("shovel", "uncommon"),
    "Crown Sparks": ("crown_spark", "rare"), "Fireflies": ("fireflies", "rare"), "Beach Island": ("bg_beach", "rare"),
    "Halo": ("halo", "rare"), "Knit Scarf": ("scarf", "common"), "Beanie": ("beanie", "common"),
}

def art(name): return B[ITEMS[name][0]]
def rar(name): return ITEMS[name][1]

# ── Pieces ──────────────────────────────────────────────────────────────
def header(right=None, kicker="★ the shop", title="Shop"):
    right = right if right is not None else f'<div class="pocket"><img src="{B["coin"]}" alt=""><span class="numeral">349</span></div>'
    return f'''<div class="status"></div>
<div class="crown"><div class="col"><div class="kickerPill">{kicker}</div><div class="pageTitle">{title}</div><div class="rule"></div></div>{right}</div>'''

def tabbar():
    tabs = [("Barn", "tab_barn", 18), ("Friends", "tab_friends", 92), ("Season", "tab_season", 166), ("Shop", "tab_shop", 240), ("Me", "tab_me", 314)]
    out = '<div class="tabbar">'
    for lbl, g, x in tabs:
        on = " on" if lbl == "Shop" else ""
        out += f'<div class="sign{on}" style="left: {x}px;"><img src="{B[g]}" alt=""><span>{lbl}</span></div>'
    return out + "</div>"

def tag(kind, text="", icon=None):
    ic = f'<img src="{B[icon]}" alt="">' if icon else ""
    return f'<span class="tag {kind}">{ic}{text}</span>'

def price(n, afford=True, lock=False):
    cls = "sun" if afford and not lock else "muted"
    return f'<span class="tag {cls}"><img src="{B["coin"]}" alt="">{n:,}</span>'

def coaster(name, state="sale", cost=0, afford=True, size=""):
    """state: sale | owned | wearing | locked | nottoday | today"""
    r = rar(name); badge = ""
    if state == "wearing": badge = f'<span class="badge" style="background:{SAGE}"><img src="{B["g_check"]}" alt=""></span>'
    elif state == "owned": badge = f'<span class="badge" style="background:{SAGE}"><img src="{B["g_check"]}" alt=""></span>'
    elif state == "locked": badge = f'<span class="badge" style="background:{SLOPGOLD}"><img src="{B["g_lock"]}" alt=""></span>'
    return f'<div class="coaster {size}" style="background:{RBG[r]}"><img class="art" src="{art(name)}" alt="{name}"><span class="rdot" style="background:{RDOT[r]}"></span>{badge}</div>'

def shelf_slot(name, state="sale", cost=0, afford=True):
    if state == "wearing": t = tag("sage", "Wearing", "g_check")
    elif state == "owned": t = tag("sun", "Wear")
    elif state == "locked": t = price(cost, lock=True)
    elif state == "nottoday": t = tag("muted hand", "not today")
    else: t = price(cost, afford)
    return f'<div class="slot"><a href="#" aria-label="{name}">{coaster(name, state)}</a><div class="tagWrap">{t}</div></div>'

def shelf(slots):
    return f'<div style="position:relative"><div style="display:flex;justify-content:space-around;align-items:flex-end;padding:0 4px;position:relative;z-index:1">{"".join(slots)}</div><div class="plank" style="margin-top:-6px"></div></div>'

def chalk(w="flex:1 1 0; min-width:0"):
    return f'<div class="chalk" style="{w}"><div class="kickerPillSm k">★ back at sunrise</div><div class="numeralLg">3h 46m</div></div>'

def door(lbl, glyph, count=None):
    c = f'<span style="position:absolute;top:-9px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:{SUN};border:2px solid {INK};box-shadow:2px 2px 0 {INK};font-family:Caprasimo,Georgia,serif;font-size:12px;line-height:18px;display:flex;align-items:center;justify-content:center;box-sizing:border-box">{count}</span>' if count else ""
    return f'<div class="hang"><a href="#" class="door" aria-label="{lbl}"><img src="{B[glyph]}" alt=""><span class="lbl">{lbl}</span>{c}</a></div>'

PEGS = [("HAT", "cowboy"), ("BOW", "acorn"), ("FACE", "catmask"), ("NECK", "bandana"), ("HELD", "shovel"), ("TICKLES", "crown_spark"), ("AURA", "fireflies"), ("BG", "bg_beach")]

def peg_row(on=None, size=30, gap=6, labels=True, x=True):
    out = f'<div style="display:flex;gap:{gap}px;justify-content:space-between">'
    for lbl, blob in PEGS:
        cls = "peg on" if on == lbl else "peg"
        xm = '<span class="x">×</span>' if x else ""
        out += f'<div style="display:flex;flex-direction:column;align-items:center"><a href="#" class="{cls}" style="width:{size}px;height:{size}px" aria-label="{lbl} slot"><img src="{B[blob]}" alt="">{xm}</a>{"<div class=pegLbl>"+lbl+"</div>" if labels else ""}</div>'
    return out + "</div>"

def section_crown(kicker, title, right):
    k = f'<div class="kicker">{kicker}</div>' if kicker else ""
    return f'<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px"><div class="col">{k}<div class="sectionTitle">{title}</div><div style="height:2px;width:56px;background:{INK};opacity:.3;border-radius:1px;margin-top:4px"></div></div><div class="kickerPill" style="padding-bottom:6px">{right}</div></div>'

def tile(name, state="owned", cost=0, afford=True, w=104):
    r = rar(name); badge = ""; cls = "tile"
    if state == "wearing": badge = f'<span class="badge" style="background:{LILAC}"><img src="{B["g_check"]}" alt=""></span>'; cls += " wearing"
    elif state == "owned": badge = f'<span class="badge" style="background:{SAGE}"><img src="{B["g_check"]}" alt=""></span>'
    elif state == "locked": badge = f'<span class="badge" style="background:{SLOPGOLD}"><img src="{B["g_lock"]}" alt=""></span>'
    if state == "wearing": t = tag("sage", "Wearing", "g_check")
    elif state == "owned": t = tag("sun", "Wear")
    elif state == "locked": t = price(cost, lock=True)
    elif state == "nottoday": t = tag("muted hand", "not today")
    else: t = price(cost, afford)
    return f'<a href="#" class="{cls}" style="width:{w}px" aria-label="{name}"><div class="thumb" style="background:{RBG[r]}"><span class="rdot" style="background:{RDOT[r]}"></span>{badge}<img class="art" src="{art(name)}" alt=""></div><div class="foot"><div class="cardTitleSm">{name}</div>{t}</div></a>'

def page(body, w=390, h=844):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>{CSS}</style>
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

# ── Direction A · The Counter ───────────────────────────────────────────
def a_bar(trying=None):
    mid = (f'<div class="kicker">trying on · {trying}</div><div class="hand mute" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">tap another to swap · ✕ to take off</div>'
           if trying else
           '<div class="kicker">wearing 8 of 8</div><div class="hand mute" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">title · Mud Baron</div>')
    return f'''<div class="sticker flat" style="margin:10px 18px 0;padding:8px 10px;display:flex;flex-direction:column;gap:8px;position:relative;z-index:5;background:{PAPER}">
  <div class="row" style="gap:10px">
    <a href="#" class="window" style="width:56px;height:56px" aria-label="Open the fitting room"><img src="{B["rosie_dressed"]}" alt="Rosie"></a>
    <div class="col" style="flex:1;min-width:0;gap:2px">{mid}</div>
    <a href="#" class="chip" style="min-height:30px;padding:2px 10px"><img src="{B["g_closet"]}" alt="">Fit</a>
  </div>
  {peg_row(size=30, gap=4, labels=False)}
</div>'''

def a_doorway():
    return f'''<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px 0">
  {chalk()}
  <div style="display:flex;gap:6px;flex:none">{door("Pen", "g_pen")}{door("Furnish", "g_barn_door")}</div>
</div>'''

def a_top():
    body = header() + a_bar()
    body += f'<div style="position:relative;flex:1;min-height:0;margin-top:12px;background:{CREAM2};background-image:repeating-linear-gradient(180deg,transparent 0 46px,rgba(42,31,21,.08) 46px 48px);border-top:2px solid {INK};padding-bottom:90px;overflow:hidden">'
    body += a_doorway()
    s1 = shelf([shelf_slot("Candy Land", cost=711, afford=False), shelf_slot("Moth Waltz", cost=750, afford=False), shelf_slot("Sleep Mask", cost=114)])
    s2 = shelf([shelf_slot("Sparkle Particle", cost=150), shelf_slot("Magic Wand", cost=533, afford=False), shelf_slot("Pumpkin Patch", cost=650, afford=False)])
    s3 = shelf([shelf_slot("Safety Goggles", cost=120), shelf_slot("Acorn Bow", "wearing"), '<div class="slot"></div>'])
    body += f'<div style="display:flex;flex-direction:column;gap:14px;padding:18px 18px 0">{s1}{s2}{s3}'
    sc = shelf([shelf_slot("Candlelit Circlet", "locked", 3000), shelf_slot("Moonlit Ballroom", "locked", 4200), shelf_slot("Crest Monocle", "locked", 3000)])
    body += f'<div class="band" style="margin-top:6px"><a href="#" class="bsign"><img src="{B["g_crown"]}" alt="">Slop Club</a>{sc}</div></div></div>'
    body += tabbar()
    return page(body)

def a_scrolled():
    body = header() + a_bar()
    body += f'<div style="position:relative;flex:1;min-height:0;margin-top:12px;padding:14px 18px 90px;display:flex;flex-direction:column;gap:12px;overflow:hidden">'
    body += section_crown("the whole rack", "Everything", "13 owned")
    body += '<div class="seg"><button class="on">Owned · 13</button><button>All · 127</button><button>Members</button></div>'
    body += f'<div style="display:flex;gap:6px;overflow:hidden">' + "".join(f'<a href="#" class="chip" style="min-height:30px;padding:2px 10px{";background:"+PEACH if l=="Hats" else ""}">{l}</a>' for l in ["Hats", "Bows", "Face", "Neck", "Held", "Aura", "Tickles", "BG"]) + '</div>'
    body += f'<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="sectionTitle">Hats</div><div class="kickerPill">4 of 21 ⌄</div></div>'
    body += f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">{tile("Cowboy Hat","wearing")}{tile("Party Hat","owned")}{tile("Beanie","owned")}{tile("Leaf Crown","owned")}</div>'
    body += f'<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="sectionTitle">Bows</div><div class="kickerPill">1 of 20 ⌄</div></div>'
    body += f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">{tile("Acorn Bow","wearing")}</div>'
    body += '</div>' + tabbar()
    return page(body)

def a_sheet():
    behind = header() + a_bar()
    behind += f'<div style="flex:1;margin-top:12px;background:{CREAM2};border-top:2px solid {INK}">{a_doorway()}</div>'
    body = f'<div style="position:absolute;inset:0;opacity:.55">{behind}{tabbar()}</div>'
    body += f'<div style="position:absolute;inset:0;background:rgba(42,31,21,.55);z-index:30"></div>'
    slots_l = [("HAT", "cowboy"), ("BOW", "acorn"), ("FACE", "catmask"), ("NECK", "bandana")]
    slots_r = [("HELD", "shovel"), ("TICKLES", "crown_spark"), ("AURA", "fireflies"), ("BG", "bg_beach")]
    def colm(ss): return '<div class="col" style="gap:12px">' + "".join(f'<div style="display:flex;flex-direction:column;align-items:center"><a href="#" class="slotTile" aria-label="{l} slot"><img src="{B[b]}" alt=""><span class="x">×</span></a><div class="slotLbl">{l}</div></div>' for l, b in ss) + '</div>'
    body += f'''<div style="position:absolute;left:0;right:0;bottom:0;z-index:40;background:{CREAM};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;padding:10px 18px 24px;display:flex;flex-direction:column;gap:14px">
  <div class="grabber"></div>
  <div style="display:flex;align-items:center;justify-content:space-between"><div class="col"><div class="kicker">★ the fitting room</div><div class="sectionTitle">Rosie</div></div><span class="kickerPill">wearing 8 of 8</span></div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
    {colm(slots_l)}
    <div class="window" style="width:160px;height:184px;border-radius:16px"><img src="{B["rosie_dressed"]}" alt="Rosie wearing her outfit"></div>
    {colm(slots_r)}
  </div>
  <div class="col" style="gap:8px">
    <div class="kickerPill">title · earned, never sold</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><a href="#" class="chip">None</a><a href="#" class="chip on"><img src="{B["g_crown"]}" alt="">Mud Baron</a><a href="#" class="chip">Snout Deep</a><a href="#" class="chip">Trough Hero</a></div>
  </div>
  <button class="btn gold" style="width:100%">Done</button>
</div>'''
    return page(body)

# ── Direction B · The Mirror ────────────────────────────────────────────
def b_left(trying=None):
    tape = f'trying on · {trying}' if trying else 'wearing 8 of 8'
    ticket = (f'<a href="#" class="ticket" aria-label="Buy Sleep Mask for 114 snouts"><span class="stub"><img src="{B["coin"]}" alt=""><span class="numeral">114</span></span><span class="face">Buy it</span></a>'
              if trying else f'<a href="#" class="btn ghost" style="min-height:36px;padding:4px 8px;justify-content:flex-start"><span class="hand" style="color:{ACCENT}">titles · Mud Baron ›</span></a>')
    return f'''<div class="col" style="width:150px;flex:none;gap:12px">
  <div style="position:relative">
    <div class="mirror" style="width:150px;height:176px"><img src="{B["rosie_dressed"]}" alt="Rosie"></div>
    <span class="tape" style="left:8px;bottom:-8px;transform:rotate(-2deg)">{tape}</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:6px;padding-top:6px">{"".join(f'<div style="display:flex;flex-direction:column;align-items:center"><a href="#" class="peg" style="width:30px;height:30px" aria-label="{l} slot"><img src="{B[b]}" alt=""><span class="x">×</span></a><div class="pegLbl">{l}</div></div>' for l,b in PEGS)}</div>
  {ticket}
  <div style="display:flex;gap:6px;justify-content:center;margin-top:auto;padding-bottom:6px">{door("Pen","g_pen")}{door("Furnish","g_barn_door")}</div>
</div>'''

def rail_row(name, state="sale", cost=0, afford=True, on=False, sub=None):
    if state == "wearing": t = tag("sage", "Wearing", "g_check")
    elif state == "owned": t = tag("sun", "Wear")
    elif state == "locked": t = price(cost, lock=True)
    else: t = price(cost, afford)
    s = f'<div class="hand mute" style="line-height:16px">{sub}</div>' if sub else ""
    return f'<a href="#" class="rail{" on" if on else ""}" aria-label="{name}">{coaster(name, state, size="sm")}<div class="name col"><div class="cardTitleSm">{name}</div>{s}</div>{t}</a>'

def b_board(mine=False):
    body = header()
    if not mine:
        seg = '<div class="seg"><button class="on">Today</button><button>Mine</button><button>All</button></div>'
        rows = (f'<div class="chalk" style="transform:none;flex-direction:row;align-items:center;justify-content:space-between;padding:6px 12px"><span class="kickerPillSm k">★ back at sunrise</span><span class="numeral">3h 46m</span></div>'
                + rail_row("Candy Land", cost=711, afford=False) + rail_row("Moth Waltz", cost=750, afford=False)
                + rail_row("Sleep Mask", cost=114, on=True, sub="on her now · tap Buy") + rail_row("Sparkle Particle", cost=150)
                + rail_row("Magic Wand", cost=533, afford=False) + rail_row("Pumpkin Patch", cost=650, afford=False)
                + rail_row("Safety Goggles", cost=120) + rail_row("Acorn Bow", "wearing")
                + f'<div class="row" style="gap:8px;padding-top:4px"><div class="divider" style="flex:1"></div><span class="tag gold"><img src="{B["g_crown"]}" alt="">Slop Club</span><div class="divider" style="flex:1"></div></div>'
                + rail_row("Candlelit Circlet", "locked", 3000) + rail_row("Moonlit Ballroom", "locked", 4200))
        left = b_left(trying="Sleep Mask")
    else:
        seg = '<div class="seg"><button>Today</button><button class="on">Mine · 13</button><button>All</button></div>'
        def h(t, n): return f'<div style="display:flex;align-items:baseline;justify-content:space-between;padding:6px 8px 0"><span class="sectionTitle" style="font-size:18px">{t}</span><span class="kickerPill">{n}</span></div>'
        rows = (h("Hats", "4 of 21") + rail_row("Cowboy Hat", "wearing") + rail_row("Party Hat", "owned") + rail_row("Beanie", "owned") + rail_row("Leaf Crown", "owned")
                + h("Bows", "1 of 20") + rail_row("Acorn Bow", "wearing")
                + h("Face", "2 of 14") + rail_row("Cat Mask", "wearing") + rail_row("Aviators", "owned")
                + h("Neck", "1 of 9") + rail_row("Red Bandana", "wearing"))
        left = b_left()
    body += f'<div style="display:flex;gap:12px;padding:12px 18px 90px;flex:1;min-height:0;overflow:hidden">{left}<div class="col" style="flex:1;min-width:0;gap:8px">{seg}{rows}</div></div>'
    body += tabbar()
    return page(body)

# ── Direction C · The Rack ──────────────────────────────────────────────
def c_pegrail(on="HAT"):
    return f'<div style="margin:10px 18px 0;padding:10px 10px 8px;background:{PAPER};border:2px solid {INK};border-radius:14px;box-shadow:3px 3px 0 {INK};position:relative;z-index:5">{peg_row(on=on, size=32, gap=4, labels=True, x=False)}</div>'

def c_today():
    return f'''<div style="display:flex;gap:10px;align-items:stretch;padding:14px 18px 0">
  {chalk("flex:none;width:150px")}
  <div class="sticker flat" style="flex:1;min-width:0;padding:6px 10px;display:flex;flex-direction:column;gap:4px;justify-content:center">
    <div class="kickerPillSm mute">at the counter today</div>
    <div class="row" style="gap:6px"><div class="avatar" style="width:32px;height:32px"><img src="{B["pepper"]}" alt=""></div><div class="hand" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Pepper · Top Hat</div></div>
    <div class="row" style="gap:6px"><div class="avatar" style="width:32px;height:32px"><img src="{B["bandit"]}" alt=""></div><div class="hand" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Bandit · Sleep Mask</div></div>
  </div>
</div>
<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px 0"><span class="hand mute">also in the shop</span><div style="display:flex;gap:6px">{door("Pen","g_pen")}{door("Furnish","g_barn_door")}</div></div>'''

def rack(title, right, slots, today_idx=()):
    out = f'<div class="col" style="gap:8px"><div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 18px"><span class="sectionTitle">{title}</span><span class="kickerPill">{right}</span></div>'
    out += '<div style="position:relative;padding:0 0 0 18px"><div style="display:flex;gap:8px;align-items:flex-end;position:relative;z-index:1;width:max-content">'
    for i, s in enumerate(slots):
        tp = f'<span class="tape" style="left:14px;top:-6px;transform:rotate(-6deg)">new today</span>' if i in today_idx else ""
        out += f'<div style="position:relative">{tp}{s}</div>'
    out += f'</div><div class="plank" style="margin-top:-6px;margin-right:0"></div></div></div>'
    return out

def c_top():
    body = header() + c_pegrail("HAT") + c_today()
    body += f'<div style="flex:1;min-height:0;overflow:hidden;padding:16px 0 90px;display:flex;flex-direction:column;gap:16px">'
    body += rack("Hats", "4 of 21 · none new", [shelf_slot("Cowboy Hat", "wearing"), shelf_slot("Party Hat", "owned"), shelf_slot("Beanie", "owned"), shelf_slot("Wizard Hat", "nottoday"), shelf_slot("Top Hat", "nottoday")])
    body += rack("Bows", "1 of 20 · 1 new", [shelf_slot("Acorn Bow", "wearing"), shelf_slot("Stardust Bow", "nottoday"), shelf_slot("Sleep Mask", "nottoday")], today_idx=(0,))
    body += '</div>' + tabbar()
    return page(body)

def c_scrolled():
    body = header() + c_pegrail("FACE")
    body += f'<div style="flex:1;min-height:0;overflow:hidden;padding:16px 0 90px;display:flex;flex-direction:column;gap:16px">'
    body += rack("Face", "2 of 14 · 2 new", [shelf_slot("Cat Mask", "wearing"), shelf_slot("Sleep Mask", cost=114), shelf_slot("Safety Goggles", cost=120), shelf_slot("Aviators", "owned"), shelf_slot("Crest Monocle", "locked", 3000)], today_idx=(1, 2))
    body += rack("Neck", "1 of 9 · none new", [shelf_slot("Red Bandana", "wearing"), shelf_slot("Knit Scarf", "nottoday"), shelf_slot("Halo", "nottoday")])
    body += rack("Held", "1 of 6 · 1 new", [shelf_slot("Mud Shovel", "wearing"), shelf_slot("Magic Wand", cost=533, afford=False), shelf_slot("Halo", "nottoday")], today_idx=(1,))
    body += '</div>' + tabbar()
    return page(body)

# ── Emit ────────────────────────────────────────────────────────────────
boards = {
    "Main.dc.html": ("A · The Counter — store first, pig pinned", a_top(), 0, 0),
    "A_Everything.dc.html": ("A · scrolled — Everything, Owned on", a_scrolled(), 470, 0),
    "A_FittingRoom.dc.html": ("A · the fitting room sheet", a_sheet(), 940, 0),
    "B_Today.dc.html": ("B · The Mirror — trying on from the rail", b_board(False), 0, 1200),
    "B_Mine.dc.html": ("B · The Mirror — Mine", b_board(True), 470, 1200),
    "C_Racks.dc.html": ("C · The Rack — pegs are the nav", c_top(), 0, 2400),
    "C_Face.dc.html": ("C · scrolled — FACE peg selected", c_scrolled(), 470, 2400),
}
for name, (title, html, x, y) in boards.items():
    with open(os.path.join(OUT, name), "w") as f: f.write(html)

now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
index = {
    "v": 3, "createdOnFiles": {"v": 1, "at": now}, "title": "Shop From Scratch", "launch": {"view": "canvas"}, "pages": [],
    "boards": {n: {"x": x, "y": y, "w": 390, "h": 844, "title": t} for n, (t, _, x, y) in boards.items()},
    "order": list(boards.keys()),
    "notes": {
        "t_a": {"x": 0, "y": -300, "text": "A · The Counter", "kind": "title1", "maxW": 1330},
        "n_a": {"x": 1410, "y": 0, "w": 300, "text": "One scroll, store first. The pig is a pinned try-on bar with her eight pegs (a real sticky header, never an overlay). Pen and Furnish are the only signs; both leave the page. Everything below the shelves is ONE catalog with a segment: Owned (the closet) · All · Members. The paper doll and Titles live in a sheet off the bar."},
        "t_b": {"x": 0, "y": 900, "text": "B · The Mirror", "kind": "title1", "maxW": 860},
        "n_b": {"x": 940, "y": 1200, "w": 300, "text": "Split pane. Rosie stands in a mirror on the left with her pegboard under it; the right is one rail: Today · Mine · All. Tap any row and she wears it in the mirror at once; an unowned item puts a ticket under the mirror. No sheet for trying on, no scene, no fold. Doors under the pegboard."},
        "t_c": {"x": 0, "y": 2100, "text": "C · The Rack", "kind": "title1", "maxW": 860},
        "n_c": {"x": 940, "y": 2400, "w": 300, "text": "Category first. The eight pegs ARE the navigation: each is a slot, its thumb is what she wears, tapping one scrolls to that rack. Every rack is one sideways plank: worn · new today (taped) · owned · the rest ('not today'). Today's drop and the counter are a compact band at the top; no separate closet at all."},
    },
    "designSystems": [],
}
with open(os.path.join(OUT, "canvas.json"), "w") as f: json.dump(index, f, indent=1)
print("wrote", len(boards), "boards")
