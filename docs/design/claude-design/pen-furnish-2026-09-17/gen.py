#!/usr/bin/env python3
"""The Pen and Furnish — proposed redesigns (2026-09-17). Two pages of phone
boards plus a states sheet each. Tokens are constants/theme.ts (WHIMSY, TYPE,
RADII, SPACE, BORDER, STICKER_SHADOW / SHADOW_SM, PIG_ACCENT, RARITY_*); art is
the shipped art, downsampled into ./img and inlined by the canvas seeder.
Regenerate with `python3 gen.py`, then re-seed and republish."""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))

# ── Tokens (constants/theme.ts) ──────────────────────────────────────────
INK = "#2a1f15"; PAPER = "#fffaf0"; CREAM = "#fbeee2"; CREAM2 = "#f6e6d4"
SUN = "#ffd87a"; SAGE = "#c9dec1"; PEACH = "#ffc8a8"; LILAC = "#d6c8f0"; ROSE = "#ffd6dc"; SKY = "#c8e3f0"
ACCENT = "#a03e2f"; MUTE = "#605449"; MUTEDIM = "#6a5c50"; BARK = "#3a2c1e"; BARKTEXT = "#fff3e2"
SLOPGOLD = "#F5C44A"; GOLDINK = "#5A3F00"
GRASS = "#cfe3bd"; GRASS2 = "#b9d4a3"; FENCE = "#fff3e2"
RBG = {"common": "#FAF7F3", "uncommon": "#E8F5E0", "rare": "#E0EBFF", "epic": "#EFE9FF", "legendary": "#FFF3D0"}
RDOT = {"common": "#cdbfae", "uncommon": "#7ba868", "rare": "#5a8bc5", "epic": "#a89bff", "legendary": "#d4a437"}
PIG_ACCENT = {
    "rosie": ("#F8A8B3", "#FDE4E8"), "copper": ("#C97350", "#F3DED5"), "pepper": ("#8A879B", "#E3E2E5"),
    "bandit": ("#94877C", "#DEDDE0"), "pickles": ("#E88FA3", "#FADFE6"), "biscuit": ("#D8A36E", "#F5E6D6"),
}
PIGS = [  # id, name, coat, motif glyph, one hand line (DRAFT copy — utils/pigs.ts has no line yet)
    ("copper", "Copper", "Rusty red", "g_sun", "first to the trough, last to leave it"),
    ("pepper", "Pepper", "Black with white points", "g_sparkle", "quick feet, quicker snout"),
    ("bandit", "Bandit", "Black with a cream blaze", "g_mask", "keeps whatever he finds"),
    ("pickles", "Pickles", "Pink with black spots", "g_pigface", "naps in the sun, wakes for bells"),
    ("biscuit", "Biscuit", "Sandy with black spots", "g_sun", "the gentle one; Rosie's favourite"),
]

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
    .cardTitle {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 18px; line-height: 22px; letter-spacing: .2px; }}
    .cardTitleSm {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 15px; line-height: 20px; letter-spacing: .2px; }}
    .numeralLg {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }}
    .numeral {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }}
    .hand {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }}
    .handLg {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 17px; line-height: 24px; }}
    .handDisplay {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 20px; line-height: 24px; }}
    .kicker {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: {ACCENT}; white-space: nowrap; }}
    .kickerPill {{ font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: {MUTE}; white-space: nowrap; }}
    .kickerPillSm {{ font-weight: 800; font-size: 10px; line-height: 13px; letter-spacing: 1.4px; text-transform: uppercase; white-space: nowrap; }}
    .label {{ font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }}
    .body {{ font-weight: 700; font-size: 15px; line-height: 21px; }}
    .bodySm {{ font-weight: 700; font-size: 13px; line-height: 18px; }}
    .mute {{ color: {MUTE}; }}
    .crown {{ display: flex; align-items: flex-end; justify-content: space-between; padding: 0 18px; flex: none; gap: 12px; }}
    .crown .rule {{ height: 2px; width: 64px; background: {INK}; opacity: .3; border-radius: 1px; margin-top: 4px; }}
    .back {{ padding: 4px 18px 6px; }}
    .tile, .med, .homeCell, .peg, .chip, .btn, .room, .seg {{ color: {INK}; }}
    .pocket {{ display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: {SUN}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 4px 4px 0 {INK}; transform: rotate(2deg); }}
    .pocket img {{ width: 20px; height: 20px; }}
    .tag {{ display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 10px; border: 1.5px solid {INK}; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; white-space: nowrap; box-sizing: border-box; }}
    .tag.sun {{ background: {SUN}; }} .tag.sage {{ background: {SAGE}; }} .tag.muted {{ background: {CREAM2}; color: {MUTEDIM}; box-shadow: none; }} .tag.lilac {{ background: {LILAC}; }} .tag.gold {{ background: {SLOPGOLD}; }} .tag.peach {{ background: {PEACH}; }}
    .tag img {{ width: 13px; height: 13px; }}
    .tag.hand {{ font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; letter-spacing: 0; }}
    .tag.big {{ min-height: 32px; padding: 4px 14px; font-size: 13px; }}
    .chip {{ display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 4px 12px; border: 1.5px solid {INK}; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; white-space: nowrap; box-sizing: border-box; }}
    .chip.on {{ border-width: 2px; background: {SUN}; }}
    .chip img {{ width: 16px; height: 16px; }}
    .seg {{ display: flex; border: 2px solid {INK}; border-radius: 999px; background: {PAPER}; box-shadow: 3px 3px 0 {INK}; padding: 3px; gap: 2px; }}
    .seg button {{ flex: 1 1 0; min-height: 34px; border: 0; border-radius: 999px; background: transparent; font-weight: 800; font-size: 13px; padding: 0 8px; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }}
    .seg button.on {{ background: {SUN}; box-shadow: inset 0 0 0 2px {INK}; }}
    .seg .n {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 13px; color: {MUTE}; }}
    .seg button.on .n {{ color: {INK}; }}
    .btn {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 2px solid {INK}; border-radius: 22px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; font-weight: 800; font-size: 15px; color: {INK}; box-sizing: border-box; }}
    .btn.gold {{ background: linear-gradient(180deg, #F8D068, #F5C44A); color: {GOLDINK}; }}
    .btn.lilac {{ background: {LILAC}; box-shadow: none; }}
    .btn.ghost {{ background: transparent; box-shadow: none; border-color: transparent; }}
    .btn.sm {{ min-height: 36px; padding: 6px 14px; font-size: 13px; border-radius: 18px; }}
    .btn.destructive {{ background: {ROSE}; }}
    .btn.busy {{ background: {CREAM2}; color: {MUTEDIM}; box-shadow: none; }}
    .btn.pressed {{ box-shadow: none; transform: translate(2px, 2px); }}
    .field {{ display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 14px; border: 2px solid {INK}; border-radius: 12px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; color: {MUTE}; }}
    .field img {{ width: 18px; height: 18px; }}
    .sticker {{ background: {PAPER}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 4px 4px 0 {INK}; box-sizing: border-box; }}
    .sticker.flat {{ box-shadow: 2px 2px 0 {INK}; }}
    .sticker.none {{ box-shadow: none; }}
    .tape {{ position: absolute; height: 18px; padding: 0 10px; background: #EAD59E; border: 1.5px solid #C8AD77; opacity: .96; z-index: 4; font-family: "Patrick Hand", cursive; font-size: 12px; line-height: 15px; color: {INK}; white-space: nowrap; transform: rotate(-8deg); }}
    .row {{ display: flex; align-items: center; gap: 10px; }}
    .col {{ display: flex; flex-direction: column; }}
    .divider {{ height: 2px; background: {INK}; opacity: .18; border-radius: 1px; }}
    .track {{ height: 10px; border: 1.5px solid {INK}; border-radius: 999px; background: {PAPER}; overflow: hidden; box-sizing: border-box; flex: 1; }}
    .track .fill {{ height: 100%; background: {SUN}; }}
    .grabber {{ width: 40px; height: 4px; border-radius: 2px; background: #8c7e71; align-self: center; }}

    /* ── The Pen ── */
    .paddock {{ position: relative; height: 236px; border: 2px solid {INK}; border-radius: 14px; overflow: hidden; background: {SKY}; box-shadow: 4px 4px 0 {INK}; box-sizing: border-box; flex: none; }}
    .paddock .grass {{ position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: linear-gradient(180deg, {GRASS}, {GRASS2}); border-top: 2px solid {INK}; }}
    .paddock .rail {{ position: absolute; left: -4px; right: -4px; height: 8px; background: {FENCE}; border: 2px solid {INK}; border-radius: 4px; box-sizing: border-box; }}
    .paddock .post {{ position: absolute; width: 12px; height: 72px; background: {FENCE}; border: 2px solid {INK}; border-radius: 4px; box-sizing: border-box; }}
    .paddock .pig {{ position: absolute; bottom: 14px; width: 150px; height: 150px; }}
    .paddock .pig img {{ width: 100%; height: 100%; object-fit: contain; }}
    .paddock .note {{ position: absolute; left: 50%; transform: translateX(-50%) rotate(-1.5deg); top: 12px; padding: 3px 12px; background: {PAPER}; border: 1.5px solid {INK}; border-radius: 8px; box-shadow: 2px 2px 0 {INK}; white-space: nowrap; }}
    .fenceRow {{ display: flex; justify-content: space-between; gap: 6px; padding: 0 2px; }}
    .med {{ display: flex; flex-direction: column; align-items: center; gap: 5px; width: 62px; }}
    .med .face {{ position: relative; width: 56px; height: 56px; border-radius: 999px; border: 2px solid {INK}; box-sizing: border-box; overflow: visible; display: flex; align-items: flex-end; justify-content: center; box-shadow: 2px 2px 0 {INK}; background: {PAPER}; }}
    .med .face img.pig {{ width: 88%; height: 88%; object-fit: contain; border-radius: 999px; }}
    .med .face .badge {{ position: absolute; right: -5px; top: -5px; width: 20px; height: 20px; border-radius: 999px; border: 2px solid {INK}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0 {INK}; background: {SAGE}; }}
    .med .face .badge img {{ width: 10px; height: 10px; }}
    .med.on .face {{ background: {CREAM}; box-shadow: 4px 4px 0 {INK}; transform: rotate(-1deg); border-width: 2.5px; }}
    .med.pressed .face {{ box-shadow: none; transform: translate(2px, 2px); }}
    .med.locked .face {{ box-shadow: none; background: {CREAM2}; border-style: dashed; }}
    .med .nm {{ font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: .3px; text-align: center; white-space: nowrap; }}
    .med.locked .nm {{ color: {MUTEDIM}; }}
    .motif {{ width: 28px; height: 28px; border-radius: 999px; border: 1.5px solid {INK}; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; display: flex; align-items: center; justify-content: center; flex: none; }}
    .motif img {{ width: 16px; height: 16px; }}
    .plate {{ display: inline-flex; align-items: center; min-height: 32px; padding: 2px 14px; border: 2px solid {INK}; border-radius: 10px; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; }}
    .home2 {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }}
    .homeCell {{ display: flex; flex-direction: column; gap: 2px; min-height: 52px; padding: 8px 12px; border: 2px solid {INK}; border-radius: 12px; background: {CREAM}; box-sizing: border-box; justify-content: center; }}
    .homeCell.on {{ background: {SAGE}; border-width: 3px; box-shadow: 2px 2px 0 {INK}; }}
    .scrim {{ position: absolute; inset: 0; background: rgba(42, 31, 21, .42); z-index: 30; display: flex; align-items: center; justify-content: center; padding: 24px; }}
    .dialog {{ background: {PAPER}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 4px 4px 0 {INK}; padding: 18px; transform: rotate(-.8deg); display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box; }}
    .beat {{ display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px; }}
    .beat .dots {{ display: flex; gap: 6px; }}
    .beat .dots i {{ width: 8px; height: 8px; border-radius: 999px; background: {INK}; opacity: .35; display: block; }}
    .beat .dots i:nth-child(2) {{ opacity: .7; }} .beat .dots i:nth-child(3) {{ opacity: 1; }}
    .empty {{ display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 16px; text-align: center; }}
    .empty img {{ width: 40px; height: 40px; }}
    .empty.error {{ background: {ROSE}; }}

    /* ── Furnish ── */
    .spots {{ display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: {PAPER}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; }}
    .spots .room {{ position: relative; width: 64px; height: 50px; border: 2px solid {INK}; border-radius: 10px; overflow: hidden; flex: none; box-sizing: border-box; }}
    .spots .room img {{ width: 100%; height: 100%; object-fit: cover; }}
    .spots .room .go {{ position: absolute; left: 0; right: 0; bottom: 0; padding: 1px 0; background: rgba(42, 31, 21, .72); color: {BARKTEXT}; font-family: "Patrick Hand", cursive; font-size: 11px; line-height: 13px; text-align: center; }}
    .pegs {{ display: flex; gap: 4px; flex: 1; justify-content: space-between; }}
    .peg {{ display: flex; flex-direction: column; align-items: center; gap: 3px; width: 38px; }}
    .peg .box {{ position: relative; width: 32px; height: 32px; border-radius: 9px; border: 2px solid {INK}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; }}
    .peg .box img {{ width: 26px; height: 26px; object-fit: contain; }}
    .peg.bare .box {{ border-style: dashed; box-shadow: none; background: transparent; }}
    .peg.on .box {{ background: {PEACH}; box-shadow: 3px 3px 0 {INK}; transform: rotate(-2deg); }}
    .peg.new .box:after {{ content: ""; position: absolute; right: -5px; top: -5px; width: 12px; height: 12px; border-radius: 999px; background: {SUN}; border: 1.5px solid {INK}; box-sizing: border-box; }}
    .peg .lbl {{ font-weight: 800; font-size: 7px; line-height: 10px; letter-spacing: .5px; text-transform: uppercase; color: {MUTE}; text-align: center; white-space: nowrap; }}
    .peg.on .lbl {{ color: {INK}; }}
    .grid2 {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }}
    .tile {{ position: relative; background: {PAPER}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 3px 3px 0 {INK}; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; }}
    .tile .thumb {{ position: relative; height: 112px; border-bottom: 2px solid {INK}; display: flex; align-items: center; justify-content: center; }}
    .tile .thumb img.art {{ width: 84px; height: 84px; object-fit: contain; }}
    .tile .thumb .rdot {{ position: absolute; left: 8px; top: 8px; width: 12px; height: 12px; border-radius: 999px; border: 2px solid {INK}; box-sizing: border-box; }}
    .tile .thumb .badge {{ position: absolute; right: 8px; top: 8px; width: 24px; height: 24px; border-radius: 999px; border: 2px solid {INK}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: {SAGE}; box-shadow: 2px 2px 0 {INK}; }}
    .tile .thumb .badge img {{ width: 12px; height: 12px; }}
    .tile .thumb .ribbon {{ position: absolute; right: -22px; top: 10px; width: 90px; transform: rotate(35deg); background: {SUN}; border-top: 1.5px solid {INK}; border-bottom: 1.5px solid {INK}; text-align: center; font-weight: 800; font-size: 10px; line-height: 16px; letter-spacing: 1.2px; text-transform: uppercase; }}
    .tile .foot {{ display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px; }}
    .tile .foot .nm {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 15px; line-height: 19px; letter-spacing: .2px; min-height: 38px; }}
    .tile.pressed {{ box-shadow: none; transform: translate(2px, 2px); }}
    .pips {{ display: flex; gap: 6px; }}
    .pip {{ position: relative; width: 30px; height: 30px; border-radius: 999px; border: 2px dashed {INK}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: transparent; }}
    .pip img {{ width: 20px; height: 20px; object-fit: contain; opacity: .55; }}
    .pip.got {{ border-style: solid; background: {SAGE}; box-shadow: 2px 2px 0 {INK}; }} .pip.got img {{ opacity: 1; }}
    .pip .n {{ position: absolute; left: 50%; bottom: -14px; transform: translateX(-50%); font-weight: 800; font-size: 9px; line-height: 12px; color: {MUTE}; white-space: nowrap; }}
"""

# ── Pieces ──────────────────────────────────────────────────────────────
def back(label="back to the shop"):
    return f'<div class="back"><a href="#" class="hand">‹ {label}</a></div>'

def crown(kicker, title, right=""):
    return f'<div class="crown"><div class="col"><div class="kickerPill">★ {kicker}</div><div class="pageTitle">{title}</div><div class="rule"></div></div>{right}</div>'

def pocket(n):
    return f'<div class="pocket"><img src="coin.png" alt=""><span class="numeral">{n}</span></div>'

def tag(kind, text="", icon=None, big=False):
    ic = f'<img src="{icon}.png" alt="">' if icon else ""
    return f'<span class="tag {kind}{" big" if big else ""}">{ic}{text}</span>'

def section_crown(title, right, kicker=None):
    k = f'<div class="kicker">{kicker}</div>' if kicker else ""
    return f'<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px"><div class="col">{k}<div class="sectionTitle">{title}</div><div style="height:2px;width:56px;background:{INK};opacity:.3;border-radius:1px;margin-top:4px"></div></div><div class="hand mute" style="padding-bottom:4px;white-space:nowrap">{right}</div></div>'

def page(body, w=390, h=844, bg=CREAM):
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
<div class="phone" style="width: {w}px; height: {h}px; background: {bg};">
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

# ── The Pen ──────────────────────────────────────────────────────────────
def paddock(friend, note, rosie_only=False):
    """The sky sticker: Rosie left, the friend right, both PigStage idle loops in the build."""
    posts = "".join(f'<div class="post" style="left:{x}px;bottom:26px"></div>' for x in (34, 130, 226, 322))
    fr = "" if rosie_only else f'<div class="pig" style="right:22px"><img src="{friend}.png" alt=""></div>'
    return f'''<div class="paddock">
<div class="grass"></div>
<div class="rail" style="bottom:78px"></div><div class="rail" style="bottom:48px"></div>{posts}
<div class="pig" style="left:24px"><img src="rosie.png" alt="Rosie"></div>{fr}
<div class="note hand">{note}</div>
</div>'''

def medallion(pid, name, state="off"):
    """state: off | on | recruited | locked | pressed"""
    cls = {"off": "med", "on": "med on", "recruited": "med", "locked": "med locked", "pressed": "med pressed"}[state]
    badge = '<span class="badge"><img src="g_check.png" alt=""></span>' if state == "recruited" else ""
    tint = PIG_ACCENT[pid][1]
    bgc = tint if state not in ("locked",) else CREAM2
    return f'<a href="#" class="{cls}" aria-label="{name}"><span class="face" style="background:{bgc}"><img class="pig" src="{pid}.png" alt="">{badge}</span><span class="nm">{name}</span></a>'

def fence_row(selected="bandit", recruited=None):
    out = '<div class="fenceRow">'
    for pid, name, *_ in PIGS:
        if recruited and pid == recruited: st = "recruited"
        elif recruited and pid != recruited: st = "locked" if pid != selected else "on"
        elif pid == selected: st = "on"
        else: st = "off"
        out += medallion(pid, name, st)
    return out + "</div>"

def pig_card(pid, action, note=None, tape="visiting"):
    pid_, name, coat, motif, line = next(p for p in PIGS if p[0] == pid)
    solid = PIG_ACCENT[pid][0]
    n = f'<div class="hand mute" style="text-align:center">{note}</div>' if note else ""
    return f'''<div class="sticker" style="position:relative;padding:18px 16px 16px;transform:rotate(-.6deg);display:flex;flex-direction:column;gap:12px">
<span class="tape" style="top:-9px;left:50%;margin-left:-40px">{tape}</span>
<div class="row" style="gap:12px">
  <span class="plate" style="background:{solid}"><span class="handDisplay">{name}</span></span>
  <div class="col" style="flex:1;min-width:0"><span class="label">{coat}</span><span class="hand mute">{line}</span></div>
  <span class="motif"><img src="{motif}.png" alt=""></span>
</div>
{action}
{n}
</div>'''

def pen_page(fence, card, note, friend="bandit", rosie_only=False, overlay="", beat=""):
    return f'''{back()}
{crown("rosie’s place", "The Pen")}
<div style="display:flex;flex-direction:column;gap:14px;padding:14px 18px 24px">
{paddock(friend, note, rosie_only)}
{fence}
{beat}
{card}
</div>
{overlay}'''

# P1 — non-member (Main)
P1 = page("".join([
    '<div class="status"></div>',
    pen_page(
        fence_row("bandit"),
        pig_card("bandit",
                 '<a href="#" class="btn gold" style="width:100%">Join Slop Club — Bandit moves in</a>',
                 note="members choose one companion · one long-term choice"),
        "Bandit, visiting"),
]))

# P2 — member, choosing
P2 = page("".join([
    '<div class="status"></div>',
    pen_page(
        fence_row("pickles"),
        pig_card("pickles",
                 '<a href="#" class="btn lilac" style="width:100%">Recruit Pickles</a>',
                 note="your membership’s one companion · choose carefully"),
        "Pickles, visiting", friend="pickles"),
]))

# P3 — the confirm
dialog = f'''<div class="scrim"><div class="dialog">
<div class="sectionTitle">Choose Pickles as Rosie’s friend?</div>
<div class="body mute">This is your one long-term companion choice. You can’t change it right now.</div>
<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
<a href="#" class="btn gold" style="width:100%">Choose Pickles</a>
<a href="#" class="btn lilac" style="width:100%">Keep looking</a>
</div></div></div>'''
P3 = page("".join([
    '<div class="status"></div>',
    pen_page(
        fence_row("pickles"),
        pig_card("pickles", '<a href="#" class="btn lilac" style="width:100%">Recruit Pickles</a>',
                 note="your membership’s one companion · choose carefully"),
        "Pickles, visiting", friend="pickles", overlay=dialog),
]))

# P4 — recruited: the home toggle
home = f'''<div class="col" style="gap:8px">
<div class="kickerPill">who greets you at home</div>
<div class="home2">
<div class="homeCell on"><span class="cardTitle">Rosie</span><span class="hand mute">At home</span></div>
<a href="#" class="homeCell"><span class="cardTitle">Bandit</span><span class="hand mute">Put at home</span></a>
</div></div>'''
P4 = page("".join([
    '<div class="status"></div>',
    pen_page(
        fence_row("bandit", recruited="bandit"),
        pig_card("bandit", home, tape="lives here"),
        "Bandit lives here with Rosie"),
]))

# P5 — recruited, looking at another pig (no action; a state line)
P5 = page("".join([
    '<div class="status"></div>',
    pen_page(
        fence_row("copper", recruited="bandit"),
        pig_card("copper", f'<div class="hand mute" style="text-align:center;padding:6px 0">Copper lives in the field. Bandit is Rosie’s friend.</div>', tape="in the field"),
        "Bandit lives here with Rosie"),
]))

# P6 — states sheet (wide)
def cell(title, inner, w=None):
    ws = f"width:{w}px;" if w else ""
    return f'<div class="col" style="gap:8px;{ws}"><div class="kickerPill" style="white-space:normal">{title}</div>{inner}</div>'

beat = '<div class="beat"><div class="dots"><i></i><i></i><i></i></div><div class="hand mute">gathering the pigs</div></div>'
err = f'''<div class="sticker empty error" style="transform:rotate(-.6deg)"><img src="g_dizzy.png" alt=""><div class="cardTitle">Couldn’t round up your pigs</div><div class="bodySm mute">They’re out in the field somewhere. Give it another go.</div><a href="#" class="btn ghost sm">Try again</a></div>'''
P6 = page(f'''
<div style="padding:24px 28px;display:flex;flex-direction:column;gap:26px">
<div class="col" style="gap:4px"><div class="kicker">the Pen · states</div><div class="sectionTitle">Every state the Pen can be in</div></div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("medallion · default", medallion("copper","Copper","off"))}
{cell("selected (cream · 4,4 · −1°)", medallion("copper","Copper","on"))}
{cell("pressed (shadow collapses)", medallion("copper","Copper","pressed"))}
{cell("recruited (sage check)", medallion("bandit","Bandit","recruited"))}
{cell("locked (choice made)", medallion("pepper","Pepper","locked"))}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("action · not a member", '<a href="#" class="btn gold" style="width:300px">Join Slop Club — Bandit moves in</a>')}
{cell("action · member, choosing", '<a href="#" class="btn lilac" style="width:300px">Recruit Bandit</a>')}
{cell("action · busy (label, never a spinner)", '<span class="btn busy" style="width:300px">Recruiting Bandit…</span>')}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("action · recruited (home toggle)", '<div style="width:300px">' + home + '</div>')}
{cell("action · another pig, after the choice", '<div class="sticker none" style="width:300px;padding:10px 12px;text-align:center"><span class="hand mute">Copper lives in the field. Bandit is Rosie’s friend.</span></div>')}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("page · loading", '<div style="width:354px;display:flex;flex-direction:column;gap:12px">' + paddock("bandit", "Rosie, waiting", rosie_only=True) + beat + '</div>')}
{cell("page · roster read failed (never guess a permanent choice)", '<div style="width:354px;display:flex;flex-direction:column;gap:12px">' + paddock("bandit", "Rosie, waiting", rosie_only=True) + err + '</div>')}
</div>
<div class="hand mute" style="max-width:760px">Reduce Motion: both pigs hold their rest frame; the medallion switch is a cut, not a landing spring. Otherwise the two pigs run PigStage idle loops (the Closet rule — a living surface breathes) and the newly picked friend lands with the one <b>tap</b> spring.</div>
</div>''', w=1160, h=1010)

# ── Furnish ─────────────────────────────────────────────────────────────
SPOTS = [("Wall", "clover"), ("Rafters", "bunting"), ("Centre", None), ("Left", "chair"), ("Right", None), ("Shelf", "crock")]

def peg(lbl, art, state="off"):
    cls = "peg" + (" bare" if not art else "") + (" on" if state == "on" else "") + (" new" if state == "new" else "")
    im = f'<img src="{art}.png" alt="">' if art else ""
    return f'<a href="#" class="{cls}" aria-label="{lbl}"><span class="box">{im}</span><span class="lbl">{lbl}</span></a>'

def spots_bar(on=None, new=None):
    pegs = "".join(peg(l, a, "on" if l == on else ("new" if l == new else "off")) for l, a in SPOTS)
    return f'<div class="spots"><a href="#" class="room" aria-label="Open your Barn"><img src="room.jpg" alt=""><span class="go">your Barn ›</span></a><div class="pegs">{pegs}</div></div>'

def field():
    return '<div class="field"><img src="g_search.png" alt=""><span class="body">Search 123 designs</span></div>'

def segment(on="all", mine=5, wishes=2):
    def b(k, lbl, n=None):
        nn = f'<span class="n">{n}</span>' if n is not None else ""
        return f'<button class="{"on" if on == k else ""}">{lbl}{nn}</button>'
    return f'<div class="seg">{b("all","Everything")}{b("mine","Mine",mine)}{b("wishes","Wishes",wishes)}</div>'

def jump_rail(on=None):
    names = ["Orchard Morning", "Hearthside Supper", "Meadow Picnic", "Starter & classics", "Wallow gifts"]
    return '<div style="display:flex;gap:8px;overflow:hidden;margin:0 -18px;padding:0 18px 4px">' + "".join(
        f'<a href="#" class="chip{" on" if n == on else ""}">{n}</a>' for n in names) + "</div>"

def price(n, afford=True):
    return tag("sun" if afford else "muted", f"{n}", "coin")

def tile(name, art, rarity, state="sale", cost=50, afford=True, new=False, pressed=False):
    """state: sale | owned | placed | gift | reward"""
    badge = ""
    if state in ("owned", "placed"): badge = '<span class="badge"><img src="g_check.png" alt=""></span>'
    elif new: badge = '<span class="ribbon">New</span>'
    if state == "sale": cap = price(cost, afford)
    elif state == "owned": cap = tag("sage", "Place")
    elif state == "placed": cap = tag("sage", "In room", "g_check")
    elif state == "gift": cap = tag("muted", cost, "g_gift")
    else: cap = tag("muted", cost, "g_lock")
    return f'''<a href="#" class="tile{" pressed" if pressed else ""}" aria-label="{name}"><div class="thumb" style="background:{RBG[rarity]}"><span class="rdot" style="background:{RDOT[rarity]}"></span>{badge}<img class="art" src="{art}.png" alt=""></div><div class="foot"><div class="nm">{name}</div><div>{cap}</div></div></a>'''

def progress(owned, total, pips):
    """pips: list of (art, threshold, got)"""
    pct = round(owned / total * 100)
    ps = "".join(f'<span class="pip{" got" if g else ""}"><img src="{a}.png" alt=""><span class="n">{t}</span></span>' for a, t, g in pips)
    return f'<div class="row" style="gap:12px;padding-bottom:12px"><div class="track"><div class="fill" style="width:{pct}%"></div></div><div class="pips">{ps}</div></div>'

ORCHARD = [
    ("Apple Crate Stool", "stool", "common", "sale", 50, True, True),
    ("Pearwood Rocker", "rocker", "rare", "sale", 175, False, True),
    ("Cider Jug Lamp", "jug", "uncommon", "owned", 0, True, False),
    ("Blossom Branch Print", "print", "uncommon", "sale", 100, True, False),
    ("Bluebird Sugar Bowl", "sugar", "common", "reward", "6 of 14", True, False),
    ("Blossom Bough Mobile", "mobile", "epic", "reward", "14 of 14", True, False),
]
CLASSICS = [
    ("Pressed Clover Frame", "clover", "common", "placed", 0, True, False),
    ("Barn Bunting", "bunting", "common", "placed", 0, True, False),
    ("Reading Chair", "chair", "uncommon", "placed", 0, True, False),
    ("Hay Bale", "hay", "common", "sale", 50, True, False),
    ("Dried Herb Garland", "garland", "common", "gift", "Rank 1 gift", True, False),
    ("Sunflower Crock", "crock", "common", "placed", 0, True, False),
    ("Milk Can Lamp", "milk", "uncommon", "sale", 100, True, False),
    ("Rosie’s Pencil Sketch", "sketch", "rare", "owned", 0, True, False),
]

def tiles(rows):
    return '<div class="grid2">' + "".join(tile(n, a, r, s, c, af, nw) for n, a, r, s, c, af, nw in rows) + "</div>"

def orchard_section(rows=ORCHARD, owned=3):
    return "".join([
        section_crown("Orchard Morning", f"{owned} of 14 owned", kicker="featured · in Monday’s Barn Draw"),
        progress(owned, 14, [("sugar", 6, False), ("mobile", 14, False)]),
        tiles(rows),
    ])

def classics_section(rows=CLASSICS, owned=5):
    return "".join([section_crown("Starter & classics", f"{owned} of 22 owned"), tiles(rows)])

def furnish_top(on="all", spot=None, new=None):
    return "".join([
        '<div class="status"></div>', back(),
        crown("rosie’s barn", "Furnish", pocket(272)),
        '<div style="padding:12px 18px 0;display:flex;flex-direction:column;gap:12px">',
        spots_bar(spot, new), field(), segment(on), jump_rail(),
        '</div>',
    ])

# F1 — the top of the page (Main)
F1 = page(furnish_top(new="Rafters") + '<div style="padding:16px 18px 24px;display:flex;flex-direction:column;gap:12px">' + orchard_section() + "</div>")

# F1b — scrolled: the spots bar is a real sticky header
F1b = page("".join([
    '<div class="status"></div>',
    '<div style="padding:0 18px 10px">' + spots_bar(new="Rafters") + '</div>',
    '<div style="padding:4px 18px 24px;display:flex;flex-direction:column;gap:12px">',
    tiles(ORCHARD[2:]),
    '<div style="height:6px"></div>',
    classics_section(CLASSICS[:4]),
    '</div>',
]))

# F2 — a spot picked: the catalog is what fits the back wall
WALL = [
    ("Pressed Clover Frame", "clover", "common", "placed", 0, True, False),
    ("Blossom Branch Print", "print", "uncommon", "sale", 100, True, False),
    ("Rosie’s Pencil Sketch", "sketch", "rare", "owned", 0, True, False),
    ("Dried Herb Garland", "garland", "common", "gift", "Rank 1 gift", True, False),
]
F2 = page("".join([
    '<div class="status"></div>', back(),
    crown("rosie’s barn", "Furnish", pocket(272)),
    '<div style="padding:12px 18px 0;display:flex;flex-direction:column;gap:12px">',
    spots_bar(on="Wall"),
    f'<div class="row" style="justify-content:space-between"><span class="hand">14 designs fit the <b>back wall</b> · Pressed Clover Frame hangs there now</span><a href="#" class="tag hand">clear ×</a></div>',
    segment("all"),
    '</div>',
    '<div style="padding:16px 18px 24px;display:flex;flex-direction:column;gap:12px">',
    tiles(WALL),
    '</div>',
]))

# F3 — Mine
MINE = [r for r in CLASSICS + ORCHARD if r[3] in ("owned", "placed")]
F3 = page(furnish_top(on="mine") + '<div style="padding:16px 18px 24px;display:flex;flex-direction:column;gap:12px">' + section_crown("Mine", "6 of 123 · 4 in the room") + tiles(MINE) + "</div>")

# F4 — Wallow gifts as a section (the sky card retires)
WALLOW = [
    ("Dried Herb Garland", "garland", "common", "gift", "Rank 1", True, False),
    ("Braided Straw Rug", "rug", "uncommon", "gift", "Rank 2", True, False),
    ("Workshop Cabinet", "cabinet", "rare", "gift", "Rank 4", True, False),
    ("Wallow Keepsake", "keepsake", "epic", "gift", "Rank 6", True, False),
]
F4 = page("".join([
    '<div class="status"></div>',
    '<div style="padding:0 18px 10px">' + spots_bar() + '</div>',
    '<div style="padding:4px 18px 24px;display:flex;flex-direction:column;gap:12px">',
    section_crown("Wallow gifts", "0 of 10 · Wallow Rank 0", kicker="earned, never bought"),
    '<div class="hand mute" style="margin-top:-4px">next: Rank 1 · Dried Herb Garland</div>',
    tiles(WALLOW),
    '</div>',
]))

# F5 — states sheet
def spots_bar_skeleton():
    pegs = "".join(peg(l, None) for l, _ in SPOTS)
    return f'<div class="spots"><span class="room" style="background:{CREAM2};border-style:dashed"></span><div class="pegs">{pegs}</div></div>'
beatF = '<div class="beat"><div class="dots"><i></i><i></i><i></i></div><div class="hand mute">opening the collection</div></div>'
def empty(glyph, title, sub, error=False, action=None):
    a = f'<a href="#" class="btn ghost sm">{action}</a>' if action else ""
    return f'<div class="sticker empty{" error" if error else ""}" style="transform:rotate(-.6deg)"><img src="{glyph}.png" alt=""><div class="cardTitle">{title}</div><div class="bodySm mute">{sub}</div>{a}</div>'

F5 = page(f'''
<div style="padding:24px 28px;display:flex;flex-direction:column;gap:26px">
<div class="col" style="gap:4px"><div class="kicker">Furnish · states</div><div class="sectionTitle">One tile grammar, every state</div></div>
<div style="display:grid;grid-template-columns:repeat(7, minmax(0, 1fr));gap:16px">
{cell("for sale · can afford", tile("Hay Bale","hay","common","sale",50,True))}
{cell("for sale · not yet (grey, no 2nd line)", tile("Pearwood Rocker","rocker","rare","sale",175,False))}
{cell("new this week", tile("Apple Crate Stool","stool","common","sale",50,True,new=True))}
{cell("owned · Place", tile("Cider Jug Lamp","jug","uncommon","owned"))}
{cell("placed · In room", tile("Barn Bunting","bunting","common","placed"))}
{cell("a rank gift (not for sale)", tile("Workshop Cabinet","cabinet","rare","gift","Rank 4 gift"))}
{cell("a collection reward", tile("Bluebird Sugar Bowl","sugar","common","reward","6 of 14"))}
</div>
<div class="hand mute" style="max-width:900px">Tapping the tile opens the design in your room (a temporary preview, the saved room untouched). Tapping the capsule does the thing it says: a sun price opens the buy confirmation, <b>Place</b> hands the design to the Barn draft, <b>In room</b> jumps to it in the room. A grey price and a gift capsule are readouts, not controls — the sheet says how many more Snouts, or which rank.</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("peg · empty spot", peg("Centre", None))}
{cell("peg · placed", peg("Wall", "clover"))}
{cell("peg · selected (peach, −2°)", peg("Wall", "clover", "on"))}
{cell("peg · something new fits here", peg("Rafters", "bunting", "new"))}
{cell("tile · pressed", tile("Hay Bale","hay","common","sale",50,True,pressed=True), w=150)}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("page · loading", '<div style="width:354px;display:flex;flex-direction:column;gap:12px">' + spots_bar_skeleton() + beatF + '</div>')}
{cell("Mine · empty", '<div style="width:354px">' + empty("g_gift", "Nothing in your collection yet.", "Buy a design or earn a gift and it lands here.") + '</div>')}
{cell("Wishes · empty", '<div style="width:354px">' + empty("g_heart", "No wishes yet.", "Open a design and tap Wishlist to keep it here.") + '</div>')}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("page · could not reconnect (a pending buy is safe)", '<div style="width:354px">' + empty("g_dizzy", "The collection wandered off.", "An interrupted purchase will not charge you twice.", error=True, action="Try again") + '</div>')}
{cell("a spot with nothing that fits your filter", '<div style="width:354px">' + empty("g_barn", "Nothing for the rafters in Wishes.", "Clear the spot, or wish for something that hangs.") + '</div>')}
</div>
</div>''', w=1160, h=1130)


# ── Write ────────────────────────────────────────────────────────────────
BOARDS = {
    "Main.dc.html": P1,
    "Pen_Member_Choosing.dc.html": P2,
    "Pen_Confirm.dc.html": P3,
    "Pen_Lives_Here.dc.html": P4,
    "Pen_In_The_Field.dc.html": P5,
    "Pen_States.dc.html": P6,
    "Furnish.dc.html": F1,
    "Furnish_Scrolled.dc.html": F1b,
    "Furnish_Spot.dc.html": F2,
    "Furnish_Mine.dc.html": F3,
    "Furnish_Wallow.dc.html": F4,
    "Furnish_States.dc.html": F5,
}
for name, html in BOARDS.items():
    with open(os.path.join(ROOT, name), "w") as f:
        f.write(html)

PH = 844
canvas = {
    "pages": [{"id": "pen", "name": "The Pen"}, {"id": "furnish", "name": "Furnish"}],
    "artboards": [
        {"file": "Main.dc.html", "title": "Pen · not a member", "x": 0, "y": 0, "w": 390, "h": PH, "page": "pen"},
        {"file": "Pen_Member_Choosing.dc.html", "title": "Pen · member, choosing", "x": 480, "y": 0, "w": 390, "h": PH, "page": "pen"},
        {"file": "Pen_Confirm.dc.html", "title": "Pen · the one confirm", "x": 960, "y": 0, "w": 390, "h": PH, "page": "pen"},
        {"file": "Pen_Lives_Here.dc.html", "title": "Pen · Bandit lives here", "x": 1440, "y": 0, "w": 390, "h": PH, "page": "pen"},
        {"file": "Pen_In_The_Field.dc.html", "title": "Pen · looking at another pig", "x": 1920, "y": 0, "w": 390, "h": PH, "page": "pen"},
        {"file": "Pen_States.dc.html", "title": "Pen · states", "x": 0, "y": 1000, "w": 1160, "h": 1010, "page": "pen"},
        {"file": "Furnish.dc.html", "title": "Furnish · the top", "x": 0, "y": 0, "w": 390, "h": PH, "page": "furnish"},
        {"file": "Furnish_Scrolled.dc.html", "title": "Furnish · scrolled (bar sticks)", "x": 480, "y": 0, "w": 390, "h": PH, "page": "furnish"},
        {"file": "Furnish_Spot.dc.html", "title": "Furnish · a spot picked", "x": 960, "y": 0, "w": 390, "h": PH, "page": "furnish"},
        {"file": "Furnish_Mine.dc.html", "title": "Furnish · Mine", "x": 1440, "y": 0, "w": 390, "h": PH, "page": "furnish"},
        {"file": "Furnish_Wallow.dc.html", "title": "Furnish · Wallow gifts section", "x": 1920, "y": 0, "w": 390, "h": PH, "page": "furnish"},
        {"file": "Furnish_States.dc.html", "title": "Furnish · states", "x": 0, "y": 1000, "w": 1160, "h": 1130, "page": "furnish"},
    ],
    "annotations": [
        {"id": "pen-idea", "page": "pen", "x": 2400, "y": 0, "w": 320, "text": "THE PADDOCK IS THE PICKER.\n\nOne living scene (Rosie + the friend you are looking at, both breathing on PigStage), five medallions hung on the fence under it, and ONE card that speaks for the pig you picked. The five-card grid, its orphan fifth card, the three repeats of \"this cannot be changed\" and the four \"Tap to preview\" lines go away.\n\nThe card carries the one action the roster allows: Join (gold) · Recruit (lilac, then the one confirm) · the home toggle (once recruited) · a state line (for the others, after). Nothing else on the page."},
        {"id": "pen-why", "page": "pen", "x": 2400, "y": 330, "w": 320, "text": "WHY · Collect: companions are the membership's hook (2026-07-25) — the pig should be the biggest thing on the page, not a 2-col card. Connect: the paddock IS what a visiting friend sees at your Barn.\n\nTradeoff: coat + motif are only shown for the picked pig, one at a time. If flipping through five to compare coats matters, the medallion could grow a second line.\n\nDraft copy: each pig's hand line (\"keeps whatever he finds\") is new — utils/pigs.ts has no such line yet."},
        {"id": "fur-idea", "page": "furnish", "x": 2400, "y": 0, "w": 320, "text": "THE ROOM ABOVE THE RACKS.\n\nThe Shop's rule was \"the pig you dress is pinned above the shelf\". Furnish gets its twin: a sticky SPOTS BAR — your Barn (a window, tap to decorate) and the six spots as pegs showing what hangs there now. Tap a peg → the catalog is what fits that spot. It replaces the sky Wallow card, the 4-way segment and half the chips, and puts furniture above the fold.\n\nUnder it: search · Everything / Mine / Wishes · a jump rail of collections (a chip stays on the page — it scrolls, never filters). Sections carry the progress track + reward pips; the Wallow ladder is a section like any other, last, \"earned, never bought\"."},
        {"id": "fur-grammar", "page": "furnish", "x": 2400, "y": 360, "w": 320, "text": "ONE TILE GRAMMAR — the Shop's (2026-09-17 ruling: one catalog, one grammar). The capsule is the action's face: sun price = buy, grey price = not yet, Place = yours, In room = placed, gift/lock = a readout. No per-card Button, no state Tag + Button pair, so a tile is ~40pt shorter and three rows fit a screen instead of two.\n\nNew is a ribbon on the tile and a sun dot on the peg it fits — never a filter. \"New\" as a segment left the page.\n\nTradeoff: the crown's kicker \"always available\" and the wallet sentence become the sun pocket the Shop already wears."},
    ],
    "launch": {"view": "canvas", "page": "pen"},
}
with open(os.path.join(ROOT, "canvas.json"), "w") as f:
    json.dump(canvas, f, indent=1)
print("wrote", len(BOARDS), "boards")
