#!/usr/bin/env python3
# Generates project/canvas.json + 12 artboards for "TTP Costumes — 2026-10-29".
import json, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(ROOT, "project")
os.makedirs(P, exist_ok=True)

A = {
 "hollow-jack": "/_blob/93540d96bcceafbb418d484133fd0dac",
 "count-snout": "/_blob/55d6386c8fdd13378f42737846d0ad9d",
 "moonpuff": "/_blob/fe9569ac0cb02eee41198395d1f99925",
 "little-reaper": "/_blob/286f59f2b610a993983b05231d0c1a5f",
 "patchwork-pal": "/_blob/deb167a140df35464e1dfcd81102f249",
 "candy-corn": "/_blob/f66db89886222da47a1a9054b89defbb",
 "linen-lurker": "/_blob/0f5512d70841743f1a732501afaa61c5",
 "starspell": "/_blob/cd8f8198127f4936792ba227bd0131e1",
 "bat-nap": "/_blob/eb61de34d186460a41f962665d79709e",
 "little-imp": "/_blob/71a66b5e56f3f041662c27ed50fc4b5a",
 "marshmallow-boo": "/_blob/d456d39e6e143eee60ab00a8f2a66e9e",
 "rosie": "/_blob/3b20effb363e1a4f240f32c51b52a3b6",
 "bg_graveyard": "/_blob/da44cd94b31239d3f186969db456dc61",
 "bg_porch": "/_blob/dd5aa13fe4f89bb3947e3c88abd1ce83",
 "closet": "/_blob/66c5da6ccaa872f4abcdf82fedd91576",
 "dress": "/_blob/bf5bd5e79ea0757976c5cc051a8b78f7",
 "ghost": "/_blob/3e85c0e6bad174d2db938e93676494b7",
 "check": "/_blob/ae17a6a14da3e88e448c7e3bacd4387f",
 "close": "/_blob/26b6c9ea02b8c910e83c4ee828f5d5c8",
 "sparkle": "/_blob/360db02978ad2a1c7be128cc28388528",
 "friends": "/_blob/dd4f6e31478409dce90310460d5f699b",
 "pigface": "/_blob/f9391b187314f1c1457a8103ec215370",
 "mask": "/_blob/72a28bac886172a260044b2283675930",
 "bow": "/_blob/a103fefdaf16e7d7a6207d4c4f9ae364",
 "glasses": "/_blob/bc3b293a4b5c1a17869f2b6afabd30cb",
 "scene": "/_blob/dcf2a33774eb6a0b143f0a5ac212975b",
}
NAMES = {
 "hollow-jack": "Hollow Jack", "count-snout": "Count Snout", "moonpuff": "Moonpuff",
 "little-reaper": "Little Reaper", "patchwork-pal": "Patchwork Pal", "candy-corn": "Candy Corn",
 "linen-lurker": "Linen Lurker", "starspell": "Starspell", "bat-nap": "Bat Nap",
 "little-imp": "Little Imp", "marshmallow-boo": "Marshmallow Boo",
}
COSTUMES = list(NAMES.keys())

CSS = """
body { margin: 0; background: #fbeee2; color: #2a1f15; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }
a { color: #a03e2f; text-decoration: none; } a:hover { color: #2a1f15; }
img { display: block; } button { font: inherit; color: inherit; cursor: pointer; }
.pageTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
.sectionTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 22px; line-height: 24px; letter-spacing: .2px; }
.cardTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 18px; line-height: 22px; letter-spacing: .2px; }
.cardTitleSm { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 15px; line-height: 22px; letter-spacing: .2px; }
.numeral { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }
.hand { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }
.handLg { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 17px; line-height: 24px; }
.handDisplay { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 21px; line-height: 28px; }
.kicker { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: #a03e2f; white-space: nowrap; }
.kickerPill { font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: #605449; white-space: nowrap; }
.label { font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }
.body { font-weight: 700; font-size: 15px; line-height: 21px; }
.bodySm { font-weight: 700; font-size: 13px; line-height: 18px; }
.mute { color: #605449; } .dim { color: #6a5c50; } .accent { color: #a03e2f; } .ink { color: #2a1f15; }
.phone { position: relative; width: 390px; height: 844px; overflow: hidden; background: #fffaf0; display: flex; flex-direction: column; box-sizing: border-box; }
.statusArea { height: 54px; flex: none; }
.pageHeader { display: flex; align-items: flex-end; justify-content: space-between; padding: 0 18px; flex: none; gap: 12px; }
.crown { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rule { height: 2px; width: 64px; background: #2a1f15; opacity: .3; border-radius: 2px; }
.pocket { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #ffd87a; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(2deg); flex: none; }
.edge { height: 2px; background: #2a1f15; opacity: .12; margin-top: 10px; flex: none; }
.scroll { flex: 1 1 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; padding: 14px 18px 0; gap: 12px; }
.sticker { background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; box-sizing: border-box; padding: 14px; }
.sticker.sm { box-shadow: 2px 2px 0 #2a1f15; }
.sticker.cream { background: #fbeee2; } .sticker.cream2 { background: #f6e6d4; } .sticker.sun { background: #ffd87a; } .sticker.sage { background: #c9dec1; } .sticker.rose { background: #ffd6dc; } .sticker.lilac { background: #d6c8f0; } .sticker.sky { background: #c8e3f0; } .sticker.bark { background: #3a2c1e; color: #fff3e2; }
.tag { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 12px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; box-sizing: border-box; background: #fffaf0; white-space: nowrap; }
.tag.sun { background: #ffd87a; } .tag.sage { background: #c9dec1; } .tag.muted { background: #f6e6d4; color: #6a5c50; } .tag.lilac { background: #d6c8f0; } .tag.rose { background: #ffd6dc; } .tag.bark { background: #3a2c1e; color: #fff3e2; } .tag.epic { background: #EFE9FF; color: #4a3a8f; } .tag.rare { background: #E0EBFF; color: #2c4f7a; }
.tag img { width: 14px; height: 14px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 2px solid #2a1f15; border-radius: 22px; background: #fffaf0; box-shadow: 4px 4px 0 #2a1f15; font-weight: 800; font-size: 15px; line-height: 20px; box-sizing: border-box; color: #2a1f15; }
.btn.primary { background: #ffd87a; } .btn.lilac { background: #d6c8f0; } .btn.success { background: #c9dec1; } .btn.ghost { box-shadow: none; background: transparent; border-color: #8c7e71; border-width: 1.5px; } .btn.wide { flex: 1 1 0; }
.btn.sm { min-height: 36px; padding: 6px 14px; font-size: 13px; box-shadow: 2px 2px 0 #2a1f15; }
.btn img { width: 18px; height: 18px; }
.fitting { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 10px 8px; }
.col { display: flex; flex-direction: column; gap: 8px; flex: none; }
.chip { position: relative; width: 56px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 2px 5px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; }
.chip .thumb { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #2a1f15; box-sizing: border-box; overflow: hidden; }
.chip .thumb img { width: 28px; height: 28px; object-fit: contain; }
.chip .thumb img.suit { width: 34px; height: 34px; }
.chip .lbl { font-weight: 800; font-size: 10px; line-height: 12px; letter-spacing: .3px; }
.chip.asleep { background: #f6e6d4; color: #6a5c50; box-shadow: none; } .chip.asleep .thumb { background: #f6e6d4 !important; border-color: #8c7e71; } .chip.asleep .thumb img { opacity: .45; }
.chip .x { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 999px; background: #ffd6dc; border: 1.5px solid #2a1f15; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; line-height: 1; }
.chip .under { position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%) rotate(-4deg); padding: 0 6px; background: #d6c8f0; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 9px; line-height: 13px; white-space: nowrap; }
.stage { position: relative; width: 150px; height: 150px; border: 2px solid #2a1f15; border-radius: 12px; overflow: hidden; background: #c8e3f0; flex: none; display: flex; align-items: flex-end; justify-content: center; }
.stage .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.stage .pig { position: relative; height: 118px; width: auto; margin-bottom: 6px; }
.seg { display: flex; gap: 2px; padding: 2px; background: #fbeee2; border: 2px solid #2a1f15; border-radius: 999px; box-sizing: border-box; }
.seg span { flex: 1 1 0; min-height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 800; font-size: 13px; color: #605449; }
.seg span.on { background: #ffd87a; color: #2a1f15; border: 2px solid #2a1f15; }
.crownRow { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.tile { display: flex; flex-direction: column; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; overflow: hidden; }
.tile .art { height: 92px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 2px solid #2a1f15; position: relative; }
.tile .art img { height: 84px; width: auto; }
.tile .art img.glyph { height: 48px; margin-bottom: 18px; }
.tile .art .corner { position: absolute; top: 6px; left: 6px; }
.tile .foot { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px 8px; }
.tile .name { font-weight: 800; font-size: 12px; line-height: 15px; letter-spacing: .3px; min-height: 30px; }
.tile .ftag { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 26px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; background: #fffaf0; }
.tile .ftag.sun { background: #ffd87a; } .tile .ftag.sage { background: #c9dec1; } .tile .ftag img { width: 14px; height: 14px; }
.epicFill { background: #EFE9FF; } .rareFill { background: #E0EBFF; } .commonFill { background: #FAF7F3; }
.tabbar { flex: none; height: 78px; display: flex; align-items: flex-start; justify-content: space-around; padding-top: 10px; background: linear-gradient(180deg, #8d5a2c, #74441e); border-top: 2px solid #2a1f15; }
.tabbar .t { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 58px; height: 44px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 10px; box-shadow: 2px 2px 0 #2a1f15; font-weight: 800; font-size: 9px; letter-spacing: .5px; text-transform: uppercase; }
.tabbar .t.on { background: #ffd87a; } .tabbar .t img { width: 18px; height: 18px; }
.scrim { position: absolute; inset: 0; background: rgba(42,31,21,.55); display: flex; align-items: center; justify-content: center; padding: 18px; box-sizing: border-box; }
.dialog { width: 100%; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 18px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(-0.8deg); padding: 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
.shot { position: relative; height: 250px; border: 2px solid #2a1f15; border-radius: 12px; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; background: #EFE9FF; }
.shot .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.shot .pig { position: relative; height: 214px; width: auto; margin-bottom: 8px; }
.toast { position: absolute; left: 18px; right: 18px; bottom: 96px; background: #3a2c1e; color: #fff3e2; border: 2px solid #2a1f15; border-radius: 999px; box-shadow: 4px 4px 0 #2a1f15; padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
.toast img { width: 24px; height: 24px; }
.tape { position: absolute; width: 54px; height: 16px; background: rgba(255,216,122,.85); border: 1.5px solid #2a1f15; border-radius: 2px; transform: rotate(-8deg); }
.hook { position: relative; }
.rail { height: 12px; background: linear-gradient(180deg, #8d5a2c, #74441e); border: 2px solid #2a1f15; border-radius: 4px; box-shadow: 2px 3px 0 #2a1f15; box-sizing: border-box; }
.hangers { display: flex; justify-content: space-between; align-items: flex-start; padding: 0 2px; margin-top: -4px; }
.hanger { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 70px; }
.hanger .wire { width: 2px; height: 12px; background: #2a1f15; opacity: .6; }
.hanger .card { position: relative; width: 70px; height: 78px; display: flex; align-items: flex-end; justify-content: center; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 10px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; overflow: hidden; }
.hanger .card img { height: 66px; width: auto; margin-bottom: 2px; }
.hanger .card .on { position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; }
.hanger .nm { font-weight: 800; font-size: 10px; line-height: 12px; text-align: center; letter-spacing: .3px; }
.strip { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #f6e6d4; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; }
.strip .thumbs { display: flex; gap: -4px; }
.strip .thumbs img { width: 26px; height: 26px; border-radius: 999px; border: 1.5px solid #2a1f15; background: #fffaf0; opacity: .6; margin-right: -6px; }
.wide { display: flex; align-items: stretch; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; box-sizing: border-box; overflow: hidden; }
.wide .art { width: 128px; flex: none; display: flex; align-items: flex-end; justify-content: center; border-right: 2px solid #2a1f15; background: #EFE9FF; }
.wide .art img { height: 112px; width: auto; margin-bottom: 4px; }
.wide .info { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; }
.room { position: relative; flex: 1 1 0; min-height: 0; border-top: 2px solid #2a1f15; border-bottom: 2px solid #2a1f15; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; }
.room .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.room .pig { position: relative; height: 230px; width: auto; margin-bottom: 76px; }
.plate { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%) rotate(-1deg); display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 14px; background: #F8A8B3; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; white-space: nowrap; }
.bubble { position: absolute; left: 44px; top: 56px; padding: 8px 14px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 16px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(-3deg); }
.bubble::after { content: ""; position: absolute; left: 70%; bottom: -12px; width: 16px; height: 16px; background: #fffaf0; border-right: 2px solid #2a1f15; border-bottom: 2px solid #2a1f15; transform: rotate(45deg); }
.actions { flex: none; display: flex; gap: 10px; padding: 12px 18px 0; }
"""

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Fredoka:wght@700&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;display=swap">
<style>""" + CSS + """</style>
</helmet>
"""
TAIL = """
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
"""

def page(title, body):
    return HEAD.replace("{title}", title) + '<div class="phone">\n' + body + '\n</div>' + TAIL

def header(kicker, title, back=None, pocket="1,840"):
    b = f'<a href="{back[1]}" class="hand accent" style="margin-bottom:2px">‹ {back[0]}</a>' if back else ""
    return (f'<div class="statusArea"></div><div class="pageHeader"><div class="crown">{b}'
            f'<span class="kickerPill">★ {kicker}</span><span class="pageTitle">{title}</span><span class="rule"></span></div>'
            f'<div class="pocket" aria-label="{pocket} snouts"><img src="{A["sparkle"]}" alt="" style="width:20px;height:20px"><span class="numeral">{pocket}</span></div></div><div class="edge"></div>')

def tabbar(on="closet"):
    tabs = [("barn","pigface","Barn"),("friends","friends","Herd"),("closet","closet","Closet"),("shop","dress","Shop")]
    out = '<div class="tabbar">'
    for k, g, l in tabs:
        out += f'<a href="#" class="t{" on" if k==on else ""}"><img src="{A[g]}" alt=""><span>{l}</span></a>'
    return out + '</div>'

def chip(label, glyph=None, tint="#f6e6d4", asleep=False, x=False, under=False, suit=None, plus=False):
    cls = "chip" + (" asleep" if asleep else "")
    inner = ""
    if suit: inner = f'<img class="suit" src="{A[suit]}" alt="">'
    elif glyph: inner = f'<img src="{A[glyph]}" alt="">'
    elif plus: inner = '<span class="label">+</span>'
    xo = '<span class="x" aria-hidden="true">✕</span>' if x else ""
    un = '<span class="under">under</span>' if under else ""
    return f'<div class="{cls}"><div class="thumb" style="background:{tint}">{inner}</div><span class="lbl">{label}</span>{xo}{un}</div>'

def stage(pig, bg="bg_graveyard"):
    return f'<div class="stage"><img class="bg" src="{A[bg]}" alt=""><img class="pig" src="{A[pig]}" alt="Rosie"></div>'

def tile(slug, name, foot, fill="epicFill", footcls="", glyph=None, price=False, corner=None):
    art = (f'<img class="glyph" src="{A[glyph]}" alt="">' if glyph else f'<img src="{A[slug]}" alt="{name}">')
    c = f'<span class="corner tag {corner[1]}" style="min-height:18px;padding:0 8px;font-size:9px">{corner[0]}</span>' if corner else ""
    ft = f'<span class="ftag {footcls}">' + (f'<img src="{A["sparkle"]}" alt="">' if price else "") + f'{foot}</span>'
    return f'<div class="tile"><div class="art {fill}">{c}{art}</div><div class="foot"><span class="name">{name}</span>{ft}</div></div>'

def crown(kicker, title, right=None):
    r = f'<span class="tag muted">{right}</span>' if right else ""
    return f'<div class="crownRow"><div class="crown"><span class="kicker">★ {kicker}</span><span class="sectionTitle">{title}</span></div>{r}</div>'

def seg(on=0):
    labels = ["Owned · 14", "Members", "All · 212"]
    return '<div class="seg">' + "".join(f'<span class="{"on" if i==on else ""}">{l}</span>' for i, l in enumerate(labels)) + '</div>'

def toast(text, glyph="check"):
    return f'<div class="toast"><img src="{A[glyph]}" alt=""><span class="body">{text}</span></div>'

# ───────────────────────── Direction A: a Costume slot ─────────────────────────
def fittingA(pig, worn=None):
    """Paper-doll tray with a new Costume chip at the head of the left column."""
    asleep = worn is not None
    left = (chip("Costume", suit=worn, tint="#d6c8f0", x=bool(worn)) if worn else chip("Costume", glyph="dress", tint="#d6c8f0")) \
        + chip("Hat", plus=True, tint="#ffd87a", asleep=asleep, under=asleep).replace('<span class="label">+</span>', '<span class="label">on</span>') \
        + chip("Bow", glyph="bow", tint="#ffd6dc", asleep=asleep, under=asleep) \
        + chip("Face", glyph="glasses", tint="#c8e3f0", asleep=asleep, under=asleep) \
        + chip("Neck", plus=True, tint="#c9dec1", asleep=asleep)
    right = chip("Held", plus=True, tint="#ffc8a8", asleep=asleep) + chip("Tickle", glyph="sparkle", tint="#ffd87a") \
        + chip("Aura", plus=True, tint="#d6c8f0", asleep=asleep) + chip("Scene", glyph="scene", tint="#c9dec1")
    return f'<div class="sticker fitting"><div class="col">{left}</div>{stage(pig)}<div class="col">{right}</div></div>'

def closetA(pig, worn=None, hand=None, segon=0):
    body = header("THE CLOSET", "Your Closet")
    body += '<div class="scroll">'
    body += fittingA(pig, worn)
    if hand:
        body += f'<div class="hand mute" style="text-align:center;margin-top:-4px">{hand}</div>'
    body += seg(segon)
    body += crown("new this season", "Costumes", "3 of 11")
    tiles = tile("hollow-jack", "Hollow Jack", "Wearing" if worn == "hollow-jack" else "Wear", footcls="sage" if worn == "hollow-jack" else "sun", corner=("costume","lilac"))
    tiles += tile("count-snout", "Count Snout", "Wear", footcls="sun", corner=("costume","lilac"))
    tiles += tile("moonpuff", "Moonpuff", "Wear", footcls="sun", corner=("costume","lilac"))
    body += f'<div class="grid3">{tiles}</div>'
    body += crown("", "Hats", "4 of 21").replace('<span class="kicker">★ </span>', '')
    body += '</div>' + tabbar("closet")
    return body

A1 = closetA("rosie")
A3 = closetA("hollow-jack", worn="hollow-jack", hand="Hollow Jack is on. Hat, Bow and Face wait underneath.")
A4 = closetA("rosie") + toast("Hollow Jack is off. Your hat and bow are back.")

# A2: the item preview modal over the closet
A2 = closetA("rosie") + f'''<div class="scrim"><div class="dialog">
<div style="display:flex;justify-content:space-between;align-items:center"><span class="kicker">★ trying on</span><a href="Main.dc.html" class="btn sm ghost" aria-label="Close">Close</a></div>
<div class="shot"><img class="bg" src="{A['bg_graveyard']}" alt=""><img class="pig" src="{A['hollow-jack']}" alt="Rosie in Hollow Jack"></div>
<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag epic">epic</span><span class="tag lilac">full costume</span><span class="tag">leaving in 6 days</span></div>
<span class="cardTitle">Hollow Jack</span>
<span class="hand mute">Covers everything but her face and hooves. Your hat, bow and glasses stay put underneath.</span>
<div style="display:flex;gap:10px;margin-top:4px"><a href="A3_Wearing.dc.html" class="btn primary wide">Wear</a><a href="Main.dc.html" class="btn wide">Not today</a></div>
</div></div>'''

# A5: the stall grid with a costume tile among the pieces
def stallA():
    body = header("POP-UP STALL", "Spooky Snouts", back=("Shop", "#"))
    body += '<div class="scroll" style="padding-top:0">'
    body += f'<div style="position:relative;height:150px;margin:0 -18px;border-bottom:2px solid #2a1f15;overflow:hidden;background:#d6c8f0;display:flex;align-items:flex-end;justify-content:center"><img src="{A["bg_graveyard"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><img src="{A["count-snout"]}" alt="Rosie in Count Snout" style="position:relative;height:132px;width:auto;margin-bottom:-2px"><span class="tag lilac" style="position:absolute;top:8px;right:8px">leaving in 6 days</span><span class="hand" style="position:absolute;left:12px;top:10px;color:#fff3e2">11 costumes · 9 pieces</span></div>'
    body += seg(0).replace("Owned · 14", "New · 20").replace("Members", "Back · 4").replace("All · 212", "Yours · 2")
    body += crown("one window, then gone", "Full costumes", "11")
    body += '<div class="grid2">' + tile("hollow-jack", "Hollow Jack", "1,200", footcls="sun", price=True, corner=("full costume","lilac")) + tile("count-snout", "Count Snout", "1,200", footcls="sun", price=True, corner=("full costume","lilac")) + tile("moonpuff", "Moonpuff", "Yours · Wear", footcls="sage", corner=("full costume","lilac")) + tile("little-reaper", "Little Reaper", "1,200", footcls="sun", price=True, corner=("full costume","lilac")) + '</div>'
    body += crown("pieces", "Hats and masks", "9")
    body += '</div>' + tabbar("shop")
    return body
A5 = stallA()

def visit(pig, name, bg, tag, bubble=None, plate_sub=None):
    body = header("VISITING", f"{name}'s barn", back=("Herd", "#"), pocket="1,840")
    body += f'<div class="room"><img class="bg" src="{A[bg]}" alt="">'
    if bubble: body += f'<div class="bubble handDisplay">{bubble}</div>'
    body += f'<img class="pig" src="{A[pig]}" alt="Rosie">'
    body += f'<div class="plate"><span class="cardTitle">Rosie</span><span class="tag lilac">{tag}</span></div></div>'
    body += '<div class="actions"><a href="#" class="btn primary wide">Tickle Rosie</a><a href="#" class="btn wide">Leave a wish</a></div>'
    body += '<div style="height:12px;flex:none"></div>' + tabbar("friends")
    return body
A6 = visit("moonpuff", "Maya", "bg_porch", "in Moonpuff")

# ───────────────────────── Direction B: the Wardrobe Hook ─────────────────────────
def fittingB(pig, folded=None):
    if folded:
        left = chip("Tickle", glyph="sparkle", tint="#ffd87a") + chip("Scene", glyph="scene", tint="#c9dec1")
        right = chip("Costume", suit=folded, tint="#d6c8f0", x=True) + chip("Aura", plus=True, tint="#d6c8f0")
        tray = f'<div class="sticker fitting"><div class="col">{left}</div>{stage(pig)}<div class="col">{right}</div></div>'
        strip = (f'<div class="strip"><div class="thumbs"><img src="{A["bow"]}" alt="Bow"><img src="{A["glasses"]}" alt="Glasses"><img src="{A["mask"]}" alt="Hat"></div>'
                 f'<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column"><span class="label">Hat, Bow and Face</span><span class="hand mute">tucked under {NAMES[folded]}</span></div>'
                 f'<a href="B4_TakeOff.dc.html" class="btn sm">Take it off</a></div>')
        return tray + strip
    left = chip("Hat", plus=True, tint="#ffd87a").replace('<span class="label">+</span>', '<span class="label">on</span>') + chip("Bow", glyph="bow", tint="#ffd6dc") + chip("Face", glyph="glasses", tint="#c8e3f0") + chip("Neck", plus=True, tint="#c9dec1")
    right = chip("Held", plus=True, tint="#ffc8a8") + chip("Tickle", glyph="sparkle", tint="#ffd87a") + chip("Aura", plus=True, tint="#d6c8f0") + chip("Scene", glyph="scene", tint="#c9dec1")
    return f'<div class="sticker fitting"><div class="col">{left}</div>{stage(pig)}<div class="col">{right}</div></div>'

def hookB(on=None, link="B2_TryOn.dc.html"):
    hs = ""
    for s in ["hollow-jack", "count-snout", "moonpuff", "little-reaper"]:
        mark = f'<img class="on" src="{A["check"]}" alt="on">' if s == on else ""
        hs += f'<a href="{link}" class="hanger"><span class="wire"></span><span class="card">{mark}<img src="{A[s]}" alt="{NAMES[s]}"></span><span class="nm">{NAMES[s]}</span></a>'
    hs += f'<div class="hanger"><span class="wire"></span><span class="card" style="background:#f6e6d4;align-items:center"><span class="numeral">+7</span></span><span class="nm mute">more</span></div>'
    return (f'<div class="sticker lilac hook" style="padding:10px 12px 12px"><span class="tape" style="top:-8px;left:40%"></span>'
            f'<div class="crownRow" style="margin-bottom:8px"><div class="crown"><span class="kicker ink">★ dress-up</span><span class="cardTitle">Costumes</span></div><span class="tag">3 of 11</span></div>'
            f'<div class="rail"></div><div class="hangers">{hs}</div></div>')

def closetB(pig, folded=None, on=None):
    body = header("THE CLOSET", "Your Closet") + '<div class="scroll">'
    body += fittingB(pig, folded) + hookB(on)
    body += seg(0)
    body += crown("", "Hats", "4 of 21").replace('<span class="kicker">★ </span>', '')
    body += '</div>' + tabbar("closet")
    return body

B1 = closetB("rosie")
B3 = closetB("count-snout", folded="count-snout", on="count-snout")
B4 = closetB("rosie") + toast("Count Snout is back on the hook. Your hat and bow are back on.")

# B2: the fitting-room sheet (full-bleed stage, bottom sticker)
B2 = (header("THE CLOSET", "Fitting room", back=("Closet", "B1_Closet.dc.html"))
      + f'<div class="room" style="border-bottom:0"><img class="bg" src="{A["bg_graveyard"]}" alt=""><span class="hand" style="position:absolute;left:14px;top:12px;color:#fff3e2">Rosie is trying on Count Snout</span><img class="pig" src="{A["count-snout"]}" alt="Rosie in Count Snout" style="margin-bottom:20px"></div>'
      + f'<div class="sticker" style="margin:-18px 18px 0;position:relative;display:flex;flex-direction:column;gap:8px;border-radius:18px;transform:rotate(-0.8deg)"><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag epic">epic</span><span class="tag lilac">full costume</span><span class="tag">leaving in 6 days</span></div><span class="cardTitle">Count Snout</span><span class="hand mute">Goes on over her whole outfit. Nothing comes off; it all waits on the hook until she changes back.</span><div style="display:flex;gap:10px;margin-top:4px"><a href="B3_Wearing.dc.html" class="btn primary wide">Wear it</a><a href="B1_Closet.dc.html" class="btn wide">Not today</a></div></div>'
      + '<div style="height:14px;flex:none"></div>' + tabbar("closet"))

# B5: the stall with its own costume band
def stallB():
    body = header("POP-UP STALL", "Spooky Snouts", back=("Shop", "#")) + '<div class="scroll" style="padding-top:0">'
    body += f'<div style="position:relative;height:150px;margin:0 -18px;border-bottom:2px solid #2a1f15;overflow:hidden;background:#d6c8f0;display:flex;align-items:flex-end;justify-content:center"><img src="{A["bg_graveyard"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><img src="{A["little-reaper"]}" alt="Rosie in Little Reaper" style="position:relative;height:132px;width:auto;margin-bottom:-2px"><span class="tag lilac" style="position:absolute;top:8px;right:8px">leaving in 6 days</span></div>'
    body += crown("the dress-up rack", "Full costumes", "11")
    body += f'<div style="display:flex;gap:12px;overflow:hidden;margin-right:-18px">'
    for s, pr in [("little-reaper", "1,200"), ("count-snout", "1,200")]:
        body += (f'<div class="wide" style="flex:none;width:300px"><div class="art"><img src="{A[s]}" alt="{NAMES[s]}"></div><div class="info"><span class="tag lilac" style="align-self:flex-start">full costume</span><span class="cardTitle">{NAMES[s]}</span>'
                 f'<span class="hand mute">hood and romper, one piece</span><div style="display:flex;gap:8px;align-items:center;margin-top:auto"><a href="#" class="btn sm primary"><img src="{A["sparkle"]}" alt="">{pr}</a><a href="B2_TryOn.dc.html" class="btn sm ghost">Try on</a></div></div></div>')
    body += '</div>'
    body += crown("pieces", "Hats and masks", "9")
    body += '<div class="grid2">' + tile("mask", "Skull Mask", "480", fill="rareFill", footcls="sun", price=True, glyph="mask") + tile("bow", "Cobweb Bow", "320", fill="commonFill", footcls="sun", price=True, glyph="bow") + '</div>'
    body += '</div>' + tabbar("shop")
    return body
B5 = stallB()
B6 = visit("little-reaper", "Maya", "bg_porch", "dressed as Little Reaper", bubble="Boo!")

boards = [
 ("Main.dc.html", "A1 · Closet: a Costume slot", A1),
 ("A2_TryOn.dc.html", "A2 · Try on (preview modal)", A2),
 ("A3_Wearing.dc.html", "A3 · Wearing: slots asleep", A3),
 ("A4_TakeOff.dc.html", "A4 · Take off", A4),
 ("A5_Stall.dc.html", "A5 · Stall grid", A5),
 ("A6_Visit.dc.html", "A6 · A friend visits", A6),
 ("B1_Closet.dc.html", "B1 · Closet: the Wardrobe Hook", B1),
 ("B2_TryOn.dc.html", "B2 · Fitting room sheet", B2),
 ("B3_Wearing.dc.html", "B3 · Wearing: outfit tucked", B3),
 ("B4_TakeOff.dc.html", "B4 · Take off", B4),
 ("B5_Stall.dc.html", "B5 · Stall costume band", B5),
 ("B6_Visit.dc.html", "B6 · A friend visits (Boo)", B6),
]
index = {"v": 3, "createdOnFiles": {"v": 1, "at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")},
         "title": "TTP Costumes — 2026-10-29", "launch": {"view": "canvas"}, "pages": [], "boards": {}, "order": [], "notes": {},
         "designSystems": [{"title": "Tickle the Pig", "namespace": "tickle-the-pig", "artifact": "https://claude.ai/artifact/A3L11psUnnGUQ36714vrCz", "version": "1793291966-be33", "copiedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}]}
for i, (f, t, html) in enumerate(boards):
    row = 0 if i < 6 else 1
    index["boards"][f] = {"x": (i % 6) * 470, "y": row * 1320, "w": 390, "h": 844, "title": t, "is_interactive": True}
    index["order"].append(f)
    with open(os.path.join(P, f), "w") as fh:
        fh.write(page(t, html))

STICKY_A = ("DIRECTION A · A Costume slot\n\n"
 "What it is: 'costume' is one more category. A ninth slot chip (lilac, at the head of the tray) and a Costumes section at the top of the rack. Wearing one puts the covered chips to sleep (cream2, 'under' tag) and a hand line under Rosie says what waits. The preview modal, the stall tile and the visit nameplate all reuse today's parts.\n\n"
 "Pillar: Collect (a showpiece that sits beside everything else you own). Connect lightly (the nameplate tag on a visit).\n\n"
 "Changes vs today: constants/slots.ts (+costume slot, label, tint); ClosetView CAT_ORDER/CAT_LABEL (+Costumes first) and an asleep style on chips when a costume is on; ItemPreviewModal routes category costume to the stage; StallPig.stallSlot +case; a Tag on the visit nameplate.\n\n"
 "Build: ~1.25 h UI. slots+labels 15m · asleep chips+hand line 25m · preview routing+cover line 15m · stall tile tag 15m · visit tag 10m · buffer 15m.\n\n"
 "Copy: slot 'Costume'; tile corner 'costume' / stall 'full costume'; hand line 'Hollow Jack is on. Hat, Bow and Face wait underneath.'; toast 'Hollow Jack is off. Your hat and bow are back.'; preview 'Covers everything but her face and hooves. Your hat, bow and glasses stay put underneath.' No em dashes; prices are numerals.")
STICKY_B = ("DIRECTION B · The Wardrobe Hook\n\n"
 "What it is: costumes live on their own hook, a lilac rail between the fitting room and the rack, with the suits hanging by name. Wearing one folds the covered chips into a 'tucked under' strip with 'Take it off'; the hook marks the one that's on. Trying on is a full-bleed fitting-room sheet (the B3 try-on the stall cut). The stall gets a costume band of wide cards; a friend visiting a costumed pig gets a 'Boo!' bubble (the provisional Spook).\n\n"
 "Pillar: Collect (the hook makes 11 suits a set to fill) and Connect (Boo is the visit reaction the 2026-10-14 entry promised).\n\n"
 "Changes vs today: new CostumeHook component in the Closet; a folded-strip state replacing four chips; a fitting-room sheet route; a stall band with a wide card; the visit bubble.\n\n"
 "Build: ~2 h UI as drawn. hook rail 35m · folded strip 30m · fitting sheet 30m · stall band 20m · Boo bubble 15m. To land in 1.5 h: drop the Boo bubble and use the existing preview modal instead of the sheet (1.4 h).\n\n"
 "Copy: kicker '★ dress-up'; strip 'Hat, Bow and Face / tucked under Count Snout'; button 'Take it off'; sheet 'Goes on over her whole outfit. Nothing comes off; it all waits on the hook until she changes back.'; toast 'Count Snout is back on the hook. Your hat and bow are back on.'")
index["notes"] = {
 "titleA": {"x": 0, "y": -300, "text": "Direction A · a Costume slot (costume is a category; the covered chips fall asleep)", "kind": "title1", "maxW": 2740},
 "titleB": {"x": 0, "y": 1020, "text": "Direction B · the Wardrobe Hook (costumes hang on their own rail; the outfit folds into a strip)", "kind": "title1", "maxW": 2740},
 "stickyA": {"x": 2820, "y": 0, "w": 420, "text": STICKY_A, "fill": "purple"},
 "stickyB": {"x": 2820, "y": 1320, "w": 420, "text": STICKY_B, "fill": "teal"},
 "stickyRec": {"x": 3300, "y": 0, "w": 380, "text": ("RECOMMENDATION\n\nShip A for the 1.5 h window. It keeps the Closet's one rule (owned dresses Rosie, unowned previews), adds no new component, and the data layer already lands costume as a category. 'Asleep' chips with an 'under' tag teach the hide-but-keep rule in place, without a dialog.\n\nB is the better home once a second season of suits exists: the hook makes the 11 read as a collection, and the strip is a cleaner answer than nine chips. Keep B's copy ('tucked under', 'Take it off') even if A ships.\n\nBoth: Rosie-only in v1 (the art is fitted to her); other pigs see the tile greyed with 'fits Rosie'. The cover rule is render-side: a worn costume hides head, bow, face, neck, held; tickle, aura and scene still show."), "fill": "orange"},
}
with open(os.path.join(P, "canvas.json"), "w") as fh:
    json.dump(index, fh, indent=1, ensure_ascii=False)
print("wrote", len(boards), "boards")
