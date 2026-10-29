#!/usr/bin/env python3
# Generates project/canvas.json + 9 artboards for "TTP Halloween onboarding — 2026-10-29".
# Two directions, one row each. Asset urls are this canvas's uploads.
import json, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(ROOT, "project")
os.makedirs(P, exist_ok=True)

A = {
 "moonpuff": "/_blob/afac543a06100dc22acb500d377eac94",
 "count-snout": "/_blob/97ace234f8f6be8406adef52547a0a50",
 "hollow-jack": "/_blob/b850b8d03bc6e53bca73dcf1dbe8c174",
 "little-reaper": "/_blob/aceb120107b2005f4a258449fd641dc3",
 "bat-nap": "/_blob/1a7e0ef0ea193f5e5bc6f0bcc89cc664",
 "rosie": "/_blob/172edb8a5eb1aa7dd89abb6940dc61f4",
 "bg_graveyard": "/_blob/6fd89ed6ac8b42ae549e84d7e13e6667",
 "bg_porch": "/_blob/367e67ffadcbefd4712ca7a069eb2e13",
 "witch_hat": "/_blob/cef3f69c95fdd23a7520411a164e037f",
 "treat_pail": "/_blob/9d8eb895f118c77e981192d4afd18a63",
 "wolf_ears": "/_blob/3cc7018734af2e6258696e615c8f5d4d",
 "crossbones_bow": "/_blob/a4d09714707b1ba7813e0470ba1a63ec",
 "ghost_hood": "/_blob/72c057499344869dc53db6d3e8438dea",
 "crystal_ball": "/_blob/50faea5a617a4c76a35178b9985d31ef",
 "sparkle": "/_blob/01a931969d1101dce5dfd0a284fbe688",
 "ghost": "/_blob/d272944f87e8301ba2dfbde4d71e6cab",
 "closet": "/_blob/1832afad46f1aee46b1add8f2783bb7a",
 "dress": "/_blob/00b86ff3426d894d89dfde05d4a20889",
 "store": "/_blob/32b7f2b8311a6d0b29f4218cac6fad59",
 "pigface": "/_blob/80ff673f5750693ffdfedeacb462f869",
 "friends": "/_blob/be829f3552c229b8b9f1f2d0c9820b93",
 "lock": "/_blob/ce19853ae6981dae9cf91283b1993704",
 "check": "/_blob/047abc4f583952c2d2a22dca88045bc3",
 "star": "/_blob/34691dfdc26f8469956e57d9b41d0847",
 "scene": "/_blob/3da01e2b5584e1654a7c49b7115d81d6",
 "gift": "/_blob/1fba835f8556b706a5d67cb225085bc9",
}
DAYS = 6

CSS = """
body { margin: 0; background: #fbeee2; color: #2a1f15; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }
a { color: #a03e2f; text-decoration: none; } a:hover { color: #2a1f15; }
img { display: block; } button { font: inherit; color: inherit; cursor: pointer; }
.pageTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
.sectionTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 22px; line-height: 24px; letter-spacing: .2px; }
.cardTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 18px; line-height: 22px; letter-spacing: .2px; }
.cardTitleSm { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 15px; line-height: 22px; }
.numeral { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }
.numeralLg { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
.hand { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }
.handLg { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 17px; line-height: 24px; }
.handDisplay { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 21px; line-height: 28px; }
.kicker { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: #a03e2f; white-space: nowrap; }
.kickerPill { font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: #605449; white-space: nowrap; }
.label { font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }
.body { font-weight: 700; font-size: 15px; line-height: 21px; }
.bodySm { font-weight: 700; font-size: 13px; line-height: 18px; }
.mute { color: #605449; } .accent { color: #a03e2f; } .ink { color: #2a1f15; } .center { text-align: center; }
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
.sticker.cream { background: #fbeee2; } .sticker.cream2 { background: #f6e6d4; } .sticker.sun { background: #ffd87a; } .sticker.sage { background: #c9dec1; } .sticker.rose { background: #ffd6dc; } .sticker.lilac { background: #d6c8f0; } .sticker.sky { background: #c8e3f0; }
.tag { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 12px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; box-sizing: border-box; background: #fffaf0; white-space: nowrap; }
.tag.sun { background: #ffd87a; } .tag.sage { background: #c9dec1; } .tag.muted { background: #f6e6d4; color: #6a5c50; } .tag.lilac { background: #d6c8f0; } .tag.rose { background: #ffd6dc; } .tag.bark { background: #3a2c1e; color: #fff3e2; } .tag.epic { background: #EFE9FF; color: #4a3a8f; }
.tag img { width: 14px; height: 14px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 2px solid #2a1f15; border-radius: 22px; background: #fffaf0; box-shadow: 4px 4px 0 #2a1f15; font-weight: 800; font-size: 15px; line-height: 20px; box-sizing: border-box; color: #2a1f15; }
.btn.primary { background: #ffd87a; } .btn.lilac { background: #d6c8f0; } .btn.ghost { box-shadow: none; background: transparent; border-color: #8c7e71; border-width: 1.5px; } .btn.wide { flex: 1 1 0; }
.btn.sm { min-height: 36px; padding: 6px 14px; font-size: 13px; box-shadow: 2px 2px 0 #2a1f15; }
.btn.xs { min-height: 32px; padding: 4px 12px; font-size: 12px; box-shadow: 2px 2px 0 #2a1f15; }
.seg { display: flex; gap: 2px; padding: 2px; background: #fbeee2; border: 2px solid #2a1f15; border-radius: 999px; box-sizing: border-box; }
.seg span { flex: 1 1 0; min-height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 800; font-size: 13px; color: #605449; }
.seg span.on { background: #ffd87a; color: #2a1f15; border: 2px solid #2a1f15; }
.crownRow { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.tile { position: relative; display: flex; flex-direction: column; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; overflow: hidden; }
.tile .art { height: 92px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 2px solid #2a1f15; position: relative; }
.tile .art img { height: 84px; width: auto; }
.tile .art img.piece { height: 64px; margin-bottom: 12px; }
.tile .corner { position: absolute; top: 6px; left: 6px; min-height: 18px; padding: 0 8px; font-size: 9px; }
.tile .foot { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px 8px; }
.tile .name { font-weight: 800; font-size: 12px; line-height: 15px; letter-spacing: .3px; min-height: 30px; }
.tile .ftag { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 26px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; background: #ffd87a; }
.tile .ftag.sage { background: #c9dec1; } .tile .ftag img { width: 14px; height: 14px; }
.tile .leave { position: absolute; top: 6px; right: 6px; min-height: 18px; padding: 0 7px; font-size: 9px; background: #d6c8f0; }
.epicFill { background: #EFE9FF; } .rareFill { background: #E0EBFF; } .commonFill { background: #FAF7F3; }
.tabbar { flex: none; height: 78px; display: flex; align-items: flex-start; justify-content: space-around; padding-top: 10px; background: linear-gradient(180deg, #8d5a2c, #74441e); border-top: 2px solid #2a1f15; }
.tabbar .t { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 58px; height: 44px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 10px; box-shadow: 2px 2px 0 #2a1f15; font-weight: 800; font-size: 9px; letter-spacing: .5px; text-transform: uppercase; }
.tabbar .t.on { background: #ffd87a; } .tabbar .t img { width: 18px; height: 18px; }
.scrim { position: absolute; inset: 0; background: rgba(42,31,21,.55); display: flex; align-items: center; justify-content: center; padding: 18px; box-sizing: border-box; }
.dialog { position: relative; width: 100%; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 18px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(-0.8deg); padding: 16px 14px 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
.dialog .x { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border-radius: 999px; background: #fffaf0; border: 2px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; justify-content: center; }
.dialog .x img { width: 14px; height: 14px; }
.shot { position: relative; height: 210px; border: 2px solid #2a1f15; border-radius: 12px; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; background: #EFE9FF; }
.shot .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.shot .pig { position: relative; height: 170px; width: auto; margin-bottom: 8px; }
.shot .cap { position: absolute; left: 12px; top: 10px; color: #fff3e2; }
.dots { display: flex; justify-content: center; gap: 8px; }
.dots span { width: 10px; height: 10px; border-radius: 999px; border: 2px solid #2a1f15; background: #fffaf0; box-sizing: border-box; }
.dots span.on { background: #2a1f15; }
.stage { position: relative; height: 236px; border-top: 2px solid #2a1f15; border-bottom: 2px solid #2a1f15; overflow: hidden; background: #d6c8f0; display: flex; align-items: flex-end; justify-content: center; flex: none; }
.stage .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.stage .cap { position: absolute; left: 12px; top: 10px; color: #fff3e2; }
.pigwrap { position: relative; display: inline-block; }
.pigwrap .hat { position: absolute; }
.track { height: 10px; border: 2px solid #2a1f15; border-radius: 999px; background: #fffaf0; overflow: hidden; }
.track .fill { height: 100%; background: #c9dec1; border-right: 2px solid #2a1f15; }
.coach { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #ffd87a; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; transform: rotate(-0.6deg); }
.coach img.g { width: 32px; height: 32px; flex: none; }
.coach .txt { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tape { position: absolute; width: 54px; height: 16px; background: rgba(255,216,122,.85); border: 1.5px solid #2a1f15; border-radius: 2px; transform: rotate(-8deg); }
.tape.paper { background: rgba(255,250,240,.9); }
.row { display: flex; align-items: center; gap: 10px; }
.door { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; }
.door img.g { width: 40px; height: 40px; flex: none; }
.door .txt { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.stallcard { position: relative; display: block; overflow: hidden; padding: 0; transform: rotate(-.6deg); background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; box-sizing: border-box; }
.stallcard .top { position: relative; display: block; height: 128px; border-bottom: 2px solid #2a1f15; overflow: hidden; }
.stallcard .top .bg { width: 100%; height: 100%; object-fit: cover; }
.stallcard .foot { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; gap: 8px; }
.toast { position: absolute; left: 18px; right: 18px; bottom: 96px; background: #3a2c1e; color: #fff3e2; border: 2px solid #2a1f15; border-radius: 999px; box-shadow: 4px 4px 0 #2a1f15; padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
.toast img { width: 24px; height: 24px; }
.facts { display: flex; flex-direction: column; gap: 8px; }
.fact { display: flex; align-items: flex-start; gap: 10px; }
.fact img { width: 24px; height: 24px; flex: none; margin-top: 2px; }
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800&amp;family=Patrick+Hand&amp;display=swap">
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

def tabbar(on="shop"):
    tabs = [("barn","pigface","Barn"),("friends","friends","Herd"),("closet","closet","Closet"),("shop","store","Shop")]
    out = '<div class="tabbar">'
    for k, g, l in tabs:
        out += f'<a href="#" class="t{" on" if k==on else ""}"><img src="{A[g]}" alt=""><span>{l}</span></a>'
    return out + '</div>'

def crown(kicker, title, right=None):
    r = f'<span class="tag muted">{right}</span>' if right else ""
    k = f'<span class="kicker">★ {kicker}</span>' if kicker else ""
    return f'<div class="crownRow"><div class="crown">{k}<span class="sectionTitle">{title}</span></div>{r}</div>'

def pig_hatted(h=104, hat="witch_hat", pail=False):
    """Rosie with the Moonbrew Witch Hat (eyeballed, not the renderer's RelSpec)."""
    hw = int(h * 0.62)
    out = f'<span class="pigwrap" style="height:{h}px"><img src="{A["rosie"]}" alt="Rosie" style="height:{h}px;width:auto">'
    out += f'<img class="hat" src="{A[hat]}" alt="" style="width:{hw}px;left:{int(h*0.1)}px;top:{-int(h*0.2)}px;transform:rotate(-6deg)">'
    if pail:
        out += f'<img class="hat" src="{A["treat_pail"]}" alt="" style="width:{int(h*0.36)}px;right:{-int(h*0.1)}px;bottom:{int(h*0.02)}px;transform:rotate(8deg)">'
    return out + '</span>'

def stall_card(href="#", new_here=False):
    tag = f'<span class="tag sun" style="position:absolute;left:10px;top:10px;transform:rotate(-4deg)">new here? ★</span>' if new_here else ""
    return (f'<a href="{href}" class="stallcard" aria-label="Spooky Snouts stall, 40 pieces, leaving in {DAYS} days">'
            f'<span class="top"><img class="bg" src="{A["bg_graveyard"]}" alt="">'
            f'<span style="position:absolute;left:16px;bottom:-6px">{pig_hatted(108, pail=True)}</span>'
            f'<span class="tag lilac" style="position:absolute;right:10px;top:10px">leaving in {DAYS} days</span>{tag}</span>'
            f'<span class="foot"><span style="display:flex;flex-direction:column"><span class="kicker">pop-up stall · 29 pieces · 11 costumes</span><span class="sectionTitle">Spooky Snouts</span></span><span class="tag bark">Step in ›</span></span></a>')

def tile(slug, name, foot, fill="epicFill", piece=False, corner=None, leave=True, footcls=""):
    art = f'<img class="{"piece" if piece else ""}" src="{A[slug]}" alt="{name}">'
    c = f'<span class="corner tag {corner[1]}">{corner[0]}</span>' if corner else ""
    lv = f'<span class="leave tag">{DAYS}d left</span>' if leave else ""
    ft = f'<span class="ftag {footcls}">' + ('' if footcls else f'<img src="{A["sparkle"]}" alt="">') + f'{foot}</span>'
    return f'<div class="tile"><div class="art {fill}">{c}{lv}{art}</div><div class="foot"><span class="name">{name}</span>{ft}</div></div>'

def drop_section(weekend=False):
    if weekend:
        head = crown("halloween weekend · Oct 30 to Nov 2", "Halloween shelf", "4 days")
        hint = '<span class="hand mute">rides the daily drop for four days, then it is gone</span>'
    else:
        head = crown("sold today only", "Today's drop", "resets in 9h 12m")
        hint = ""
    tiles = tile("ghost_hood", "Silly Sheet Ghost Hood", "600", "commonFill", piece=True, leave=False) \
          + tile("crystal_ball", "Crystal Ball", "900", "rareFill", piece=True, leave=False) \
          + tile("crossbones_bow", "Crossbones Bow", "450", "commonFill", piece=True, leave=False)
    return head + hint + f'<div class="grid3">{tiles}</div>'

def shop_landing(new_here=False, weekend=False, href="#"):
    body = header("THE SHOP", "Shop") + '<div class="scroll">'
    body += stall_card(href, new_here)
    body += drop_section(weekend)
    body += '</div>' + tabbar("shop")
    return body

def haul(owned=2, total=40):
    return (f'<div style="display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between"><span class="kickerPill">your haul</span><span class="hand mute">{owned} of {total}</span></div>'
            f'<div class="track"><div class="fill" style="width:{int(owned/total*100)}%"></div></div></div>')

def seg(on=0):
    labels = ["New · 40", "Back · 4", "Yours · 2"]
    return '<div class="seg" role="tablist">' + "".join(f'<span class="{"on" if i==on else ""}" role="tab" aria-selected="{"true" if i==on else "false"}">{l}</span>' for i, l in enumerate(labels)) + '</div>'

def coach(text, glyph="star"):
    return (f'<div class="coach"><span class="tape paper" style="top:-9px;left:24px"></span><img class="g" src="{A[glyph]}" alt="">'
            f'<div class="txt"><span class="hand ink" style="font-size:15px;line-height:20px">{text}</span></div>'
            f'<a href="#" class="btn xs" aria-label="Got it, hide this tip">Got it</a></div>')

def stall_page(tab=0, coach_html="", hero_pig="rosie", cap="tap a piece to see it on Rosie", tiles=None, back="#"):
    body = header("POP-UP STALL", "Spooky Snouts", back=("Shop", back))
    body += '<div class="scroll" style="padding:0 0 0;gap:12px">'
    if hero_pig == "rosie":
        pig = pig_hatted(184)
    else:
        pig = f'<img src="{A[hero_pig]}" alt="Rosie in costume" style="height:184px;width:auto;position:relative">'
    body += f'<div class="stage"><img class="bg" src="{A["bg_graveyard"]}" alt=""><span class="hand cap">{cap}</span><span style="position:relative;margin-bottom:-4px">{pig}</span><span class="tag lilac" style="position:absolute;right:10px;top:10px">leaving in {DAYS} days</span></div>'
    body += '<div style="padding:0 18px;display:flex;flex-direction:column;gap:12px">' + haul() + seg(tab) + coach_html
    body += f'<div class="grid2">{tiles}</div></div></div>' + tabbar("shop")
    return body

NEW_TILES = (tile("count-snout", "Count Snout", "1,200", corner=("full costume","lilac"))
           + tile("moonpuff", "Moonpuff", "1,200", corner=("full costume","lilac"))
           + tile("witch_hat", "Moonbrew Witch Hat", "900", "rareFill", piece=True)
           + tile("wolf_ears", "Moonpuff Wolf Ears", "600", "commonFill", piece=True))
BACK_TILES = (tile("ghost_hood", "Silly Sheet Ghost Hood", "600", "commonFill", piece=True)
            + tile("crystal_ball", "Crystal Ball", "900", "rareFill", piece=True)
            + tile("crossbones_bow", "Crossbones Bow", "450", "commonFill", piece=True)
            + tile("treat_pail", "Pumpkin Treat Pail", "450", "commonFill", piece=True))
YOURS_TILES = (tile("hollow-jack", "Hollow Jack", "Wearing", corner=("full costume","lilac"), footcls="sage", leave=False)
             + tile("treat_pail", "Pumpkin Treat Pail", "Wear", "commonFill", piece=True, footcls="sage", leave=False))

# ───────────────────────── Direction A · Three cards, then the stall ─────────────────────────
def card(step, kicker, title, hero, body_html, primary, secondary, primary_href="#", secondary_href="#", primary_cls="primary"):
    dots = '<div class="dots">' + "".join(f'<span class="{"on" if i==step else ""}"></span>' for i in range(3)) + '</div>'
    return (f'<div class="scrim"><div class="dialog" role="dialog" aria-label="{title}">'
            f'<span class="kicker center">★ {kicker}</span><span class="pageTitle center">{title}</span>'
            f'{hero}{body_html}{dots}'
            f'<div style="display:flex;gap:10px;margin-top:2px"><a href="{primary_href}" class="btn {primary_cls} wide">{primary}</a><a href="{secondary_href}" class="btn ghost wide">{secondary}</a></div>'
            f'</div></div>')

A1_hero = (f'<div class="shot" style="background:#fbeee2;align-items:center;padding:0 12px"><span style="width:100%;display:block;transform:scale(.92)">{stall_card()}</span></div>')
A1_body = ('<span class="body center">Spooky Snouts is pitched at the top of the Shop wall: 29 pieces and 11 full costumes, here for a short while.</span>'
           '<span class="hand mute center">Every piece says how long it stays. When the window shuts the stall boards up, and what you bought is your haul. Yours for keeps.</span>')
A1 = shop_landing() + card(0, "new in the shop · 1 of 3", "A stall popped up", A1_hero, A1_body, "Next", "Skip", "A2_Costumes.dc.html", "#")

A2_hero = (f'<div class="shot"><img class="bg" src="{A["bg_porch"]}" alt=""><span class="hand cap">Rosie, then Rosie in Moonpuff</span>'
           f'<div style="position:relative;display:flex;align-items:flex-end;gap:4px;margin-bottom:6px"><img src="{A["rosie"]}" alt="Rosie" style="height:150px;width:auto"><span class="numeralLg" style="color:#fff3e2;margin-bottom:60px">›</span><img src="{A["moonpuff"]}" alt="Rosie in Moonpuff" style="height:150px;width:auto"></div></div>')
A2_body = ('<span class="body center">A full costume turns Rosie into someone else, head to hoof, front and side.</span>'
           '<span class="hand mute center">Her hat, bow and the rest tuck away underneath and come back the moment it comes off. Rosie only: a companion pig swaps to her first. Try one on before you buy. Friends see "in Moonpuff" when they visit.</span>')
A2 = shop_landing() + card(1, "new this year · 2 of 3", "Full costumes", A2_hero, A2_body, "Next", "Skip", "A3_Where.dc.html", "#")

def door(glyph, title, hand):
    return f'<div class="door"><img class="g" src="{A[glyph]}" alt=""><div class="txt"><span class="cardTitle">{title}</span><span class="hand mute">{hand}</span></div></div>'
A3_hero = ('<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">'
           + door("store", "Shop", "The stall card at the top of the wall. New · Back · Yours.")
           + door("closet", "Closet", "The lilac Costume chip. Wear it, swap it, take it off.")
           + door("gift", "Daily drop", "A Halloween shelf, Oct 30 to Nov 2. Then it rides off.")
           + '</div>')
A3_body = '<span class="hand mute center">That is the whole map. Step in and the stall shows you the rest.</span>'
A3 = shop_landing() + card(2, "three doors · 3 of 3", "Where to look", A3_hero, A3_body, "Step in", "Later", "A4_StepIn.dc.html", "#")

A4 = stall_page(0, "", tiles=NEW_TILES, cap="tap a piece to see it on Rosie")

# ───────────────────────── Direction B · The stall teaches itself ─────────────────────────
B1 = shop_landing(new_here=True, weekend=True, href="B2_New.dc.html")
B2 = stall_page(0, coach("This year's pieces. Each one says how long it stays. Tap one to see it on Rosie.", "star"), tiles=NEW_TILES, back="B1_Shop.dc.html")
B3 = stall_page(1, coach("Old favorites, back for the window. They keep their daily-drop life after it.", "ghost"), tiles=BACK_TILES, back="B1_Shop.dc.html", cap="returning pieces")
B4 = stall_page(2, coach("What you have bought. When the stall boards up, this is your haul. It all lives in your Closet.", "check"), tiles=YOURS_TILES, back="B1_Shop.dc.html", hero_pig="hollow-jack", cap="your haul so far")

def fact(glyph, text):
    return f'<div class="fact"><img src="{A[glyph]}" alt=""><span class="hand ink" style="font-size:15px;line-height:20px">{text}</span></div>'
B5_card = (f'<div class="scrim"><div class="dialog" role="dialog" aria-label="Count Snout is a full costume">'
           f'<span class="kicker center">★ a full costume · shows once</span><span class="pageTitle center">Count Snout is a whole look</span>'
           f'<div class="shot"><img class="bg" src="{A["bg_graveyard"]}" alt=""><div style="position:relative;display:flex;align-items:flex-end;gap:4px;margin-bottom:6px"><img src="{A["rosie"]}" alt="Rosie" style="height:150px;width:auto"><span class="numeralLg" style="color:#fff3e2;margin-bottom:60px">›</span><img src="{A["count-snout"]}" alt="Rosie in Count Snout" style="height:150px;width:auto"></div></div>'
           f'<div class="facts">'
           + fact("dress", "Head to hoof, front and side. Her hat, bow and the rest tuck away underneath and come back when it comes off.")
           + fact("pigface", "Rosie only. A companion pig swaps to Rosie first.")
           + fact("closet", "Lives in the Closet under the lilac Costume chip. Try it on here first; friends see “in Count Snout” on a visit.")
           + f'</div><div style="display:flex;gap:10px;margin-top:2px"><a href="#" class="btn lilac wide">Try it on</a><a href="B2_New.dc.html" class="btn ghost wide">Not now</a></div></div></div>')
B5 = stall_page(0, "", tiles=NEW_TILES, back="B1_Shop.dc.html") + B5_card

# ───────────────────────── Write ─────────────────────────
BOARDS = [
 ("A", [("Main.dc.html", "A1 · Card 1 of 3: the stall", A1), ("A2_Costumes.dc.html", "A2 · Card 2 of 3: full costumes", A2), ("A3_Where.dc.html", "A3 · Card 3 of 3: where to look", A3), ("A4_StepIn.dc.html", "A4 · Step in: the stall, New tab", A4)]),
 ("B", [("B1_Shop.dc.html", "B1 · Shop: new-here tag + weekend shelf", B1), ("B2_New.dc.html", "B2 · Stall, New: coach strip", B2), ("B3_Back.dc.html", "B3 · Stall, Back: coach strip", B3), ("B4_Yours.dc.html", "B4 · Stall, Yours: coach strip", B4), ("B5_Costume.dc.html", "B5 · First costume preview: the explainer", B5)]),
]
ROW_Y = {"A": 0, "B": 1320}
boards, order = {}, []
for row, items in BOARDS:
    for i, (path, title, html) in enumerate(items):
        with open(os.path.join(P, path), "w") as f:
            f.write(page(title, html))
        boards[path] = {"x": i * 470, "y": ROW_Y[row], "w": 390, "h": 844, "title": title, "is_interactive": True}
        order.append(path)

STICKY_A = """A · Three cards, then the stall

What: a 3-card intro sheet (AdaptiveModalScaffold card, like GreatHungerIntro): the stall, full costumes, where to look. "Step in" lands on the stall's New tab.

Pillar: Collect (the set and the haul) with one Connect beat (friends see the costume on a visit).

Trigger: the Shop tab mounts while a stall is open and `stall_intro_seen:<set_key>:<user>` is unset. Joins PopupQueue through usePopupSlot at priority 60, behind What's New, so it never stacks on another modal. The seen-key is written on present, not on finish: Skip, Later, the hardware back and Step in all end it for good. Once per set key, so a winter set gets its own single showing.

Build: ~45 min for one Opus engineer. One new file, components/StallIntroModal.tsx (3 static cards, pager state, dots, Button, Glyph), plus ~10 lines in the Shop tab (usePopupSlot + AsyncStorage + router.push to the stall). Heroes are static Image sprites, not PigStage; animating them is what pushes it past 45.

Next set (winter): the sheet reads title, kicker and counts from the seasonal_shelves row; the job is a new row and two hero images. Card 3's daily-drop door hides when the set has no shelf."""

STICKY_B = """B · The stall teaches itself

What: no modal. The stall card wears a "new here?" tag, each stall tab opens with a one-time coach strip (New · Back · Yours), and the first time any full costume is previewed a one-time explainer sits in front of the try-on. The weekend shelf is taught in place by its own section kicker.

Pillar: Collect, taught at the moment of need. The Barn and Home stay untouched.

Trigger: the tag shows until the first stall visit (`stall_visited:<set_key>`). A coach strip shows once per tab (`stall_coach:<tab>`), dismissed by Got it or by leaving the tab, then never. The explainer fires once ever (`costume_explainer_seen`), and "Try it on" continues into the normal preview. Nothing re-arms.

Build: ~45 min, but across four files: the tag on the stall card (5), one CoachStrip primitive + 3 keys in the stall page (15), the explainer dialog in the costume preview sheet (15), the weekend-shelf kicker (5), QA (5). More touch points than A; a missed one fails silently.

Next set: coach copy is keyed by tab, not by set, so winter inherits it unchanged. Only the tag re-arms per set key."""

STICKY_REC = """Recommendation: build A this week, and fold in B1's "new here?" tag (5 min).

A answers the founder's question in one sitting and in the order asked: the stall, costumes, where to find them. One component, one seen-key, routed through PopupQueue like every other intro, reusable for winter by reading the shelf row.

B is the better long-run teacher (it teaches where the player is standing) and is the natural follow-up once the stall has a second tenant: by then the coach strips can be written from what players actually got stuck on.

Not drawn: a replay entry in Settings (the Season tab's ctaLabel pattern makes it cheap) and the Closet chip's own first-time hint; both are post-launch polish."""

notes = {
 "titleA": {"x": 0, "y": -300, "text": "A · Three cards, then the stall (fires once, then Step in)", "kind": "title1", "maxW": 1840},
 "titleB": {"x": 0, "y": 1020, "text": "B · The stall teaches itself (tag, coach strips, one explainer)", "kind": "title1", "maxW": 2310},
 "stickyA": {"x": 1880, "y": 0, "w": 440, "text": STICKY_A, "fill": "purple"},
 "stickyRec": {"x": 1880, "y": 1320, "w": 440, "text": STICKY_REC, "fill": "green"},
 "stickyB": {"x": 2350, "y": 1320, "w": 440, "text": STICKY_B, "fill": "orange"},
}

canvas = {
 "v": 3,
 "createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
 "title": "TTP Halloween onboarding — 2026-10-29",
 "launch": {"view": "canvas"},
 "pages": [],
 "boards": boards,
 "order": order,
 "notes": notes,
 "designSystems": [{"title": "Tickle the Pig", "namespace": "tickle-the-pig", "artifact": "https://claude.ai/artifact/A3L11psUnnGUQ36714vrCz", "version": "1793291966-be33", "copiedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}],
}
with open(os.path.join(P, "canvas.json"), "w") as f:
    json.dump(canvas, f, indent=1, ensure_ascii=False)
print("wrote", len(order), "boards")
