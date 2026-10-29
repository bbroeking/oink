#!/usr/bin/env python3
"""Generates the TTP seasonal-shelf canvas: three directions x six screens.
Tokens are read by hand from constants/theme.ts (the Tickle the Pig design
system artifact was still empty at build time)."""
import json, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(ROOT, "project")
os.makedirs(P, exist_ok=True)

U = {
    "rosie": "/_blob/f079201697bd191bd2a52f99fd18355a",
    "coin": "/_blob/ee43e4886ddcebfd97ab1d9c789683d1",
    "check": "/_blob/4a00d4f2fc98c2f7eb5931e71a9c73c8",
    "lock": "/_blob/887db96318d449463d4d40432bee29be",
    "sparkle": "/_blob/2702b4d29e22466cc634dd1532fd0939",
    "pigface": "/_blob/8c7123d42d42de64016fa55db076eb36",
    "crown": "/_blob/fbf5ca3b12b1fd29c85d5e80f3e5a332",
    "bg_graveyard": "/_blob/abfeecd3decccb2bc12be6b07fce9999",
    "bg_porch": "/_blob/196ae335b436d72c6512130a32894544",
    "witch_hat": "/_blob/c31171f6f63ffffc5a4946daef8087b4",
    "ghost_hood": "/_blob/f64989d81ca71c98712068de2a9d4189",
    "treat_pail": "/_blob/fa62f2ce30caf4a930eb1e0ef258db32",
    "wolf_ears": "/_blob/5031c8ee487a6527e8bc8cfe9e5d50f6",
    "crossbones_bow": "/_blob/97585eb0a9b8aca7c25328632472fd08",
    "spark_goggles": "/_blob/4a3270db0345c8b3910ac6b18d2330da",
    "cobweb_crown": "/_blob/631f754ba5b98c9477fa94dcbfeae7a0",
    "crystal_ball": "/_blob/6855b6a30f6a23054fab9fe04c6e7e07",
    "moon_charm": "/_blob/ff9ab0bc3da34adaa759a1b004902189",
    "pip_candle": "/_blob/6baccbf74e3b6ab41533436fc816a1fa",
    "graveyard_bg": "/_blob/c9576686ae823b8057e03d0a7e6dccbc",
    "porch_bg": "/_blob/f2443721a171e547def10b3d85575e47",
    "skull_mask": "/_blob/82d709ee0ebd217c5ab9a38c00f6bfa9",
    "firefly_lantern": "/_blob/fe1bed2ebe645996e5f9412d05b00ced",
    "pumpkin_patch": "/_blob/e5c79b8232516c23dc71c28e9f79268b",
    "candyland": "/_blob/40181b28bdb57a6ba187835e3cf0d4bf",
    "beanie": "/_blob/1228adf6b67da9798923c3e1a3276684",
    "cowboy": "/_blob/7efb2a034df52969e360359a73e3f512",
    "leaf_crown": "/_blob/7aed1a3230bd7507c955a0fc12f4d97e",
    "halo": "/_blob/f08cadc3bc3089a3816abd50421de629",
    "acorn_bow": "/_blob/940d3b5ce9a3164b580086c3a7c632da",
    "knit_scarf": "/_blob/7710f35003dd95159941aae14110d72b",
    "barn": "/_blob/77b56ea0989736727f8b75893c5c4c96",
    "bow": "/_blob/ec9c5a51ef8c004fcae0bee93c8c19c2",
    "tophat": "/_blob/13013e9e872ea1bdf3d3318ddc33bdae",
    "star": "/_blob/79d3fcb4e177234f80576923b5c111bf",
}

# ── Catalog sample (prices inside the rarity bands) ─────────────────────────
def it(key, name, cat, rar, cost, lane="new", owned=False, wearing=False):
    return dict(key=key, name=name, cat=cat, rar=rar, cost=cost, lane=lane, owned=owned, wearing=wearing)

NEW = [
    it("witch_hat", "Moonbrew Witch Hat", "hat", "epic", 1200),
    it("ghost_hood", "Silly Sheet Ghost Hood", "hat", "legendary", 2400),
    it("treat_pail", "Pumpkin Treat Pail", "held", "uncommon", 320, owned=True),
    it("wolf_ears", "Moonpuff Wolf Ears", "hat", "rare", 640),
    it("crossbones_bow", "Crossbones Bow", "bow", "rare", 560),
    it("spark_goggles", "Spark Goggles", "glasses", "epic", 980),
    it("cobweb_crown", "Cobweb Crown", "hat", "epic", 1100),
    it("crystal_ball", "Pocket Crystal Ball", "held", "legendary", 3200),
    it("moon_charm", "Moon Charm", "necklace", "epic", 900),
    it("pip_candle", "Pip Candle", "held", "rare", 480),
    it("graveyard_bg", "Moonlit Graveyard", "background", "legendary", 2800),
    it("porch_bg", "Lantern Porch", "background", "rare", 700),
]
BACK = [
    it("skull_mask", "Skull Mask", "mask", "epic", 818, lane="returning", owned=True, wearing=True),
    it("pumpkin_patch", "Pumpkin Patch", "background", "rare", 650, lane="returning"),
    it("firefly_lantern", "Firefly Lantern", "held", "rare", 600, lane="returning"),
    it("candyland", "Candy Land", "background", "rare", 711, lane="returning"),
]
DROP = [
    it("beanie", "Cozy Beanie", "hat", "common", 140),
    it("cowboy", "Cowboy Hat", "hat", "uncommon", 260),
    it("leaf_crown", "Leaf Crown", "hat", "rare", 520),
]
MEMBERS = [
    it("halo", "Halo", "hat", "epic", 900),
    it("acorn_bow", "Acorn Bow", "bow", "rare", 420),
    it("knit_scarf", "Knit Scarf", "scarf", "rare", 480),
]
BY = {x["key"]: x for x in NEW + BACK + DROP + MEMBERS}
BALANCE = 1840
DAYS_LEFT = 6

# ── Tokens (constants/theme.ts) ─────────────────────────────────────────────
CSS = """
body { margin: 0; background: #fbeee2; color: #2a1f15; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }
a { color: #a03e2f; text-decoration: none; } a:hover { color: #2a1f15; }
img { display: block; } button { font: inherit; color: inherit; cursor: pointer; }
.pageTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
.sectionTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 20px; line-height: 24px; }
.cardTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }
.cardTitleSm { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 14px; line-height: 18px; }
.numeralLg { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 24px; line-height: 26px; }
.numeral { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }
.hero { font-family: "Fredoka", "Nunito", sans-serif; font-weight: 700; font-size: 30px; line-height: 34px; }
.hand { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 15px; line-height: 20px; }
.handSm { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 16px; }
.kicker { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: #a03e2f; white-space: nowrap; }
.kickerPill { font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: #605449; white-space: nowrap; }
.kickerPillSm { font-weight: 800; font-size: 10px; line-height: 13px; letter-spacing: 1.4px; text-transform: uppercase; white-space: nowrap; }
.label { font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }
.body { font-weight: 700; font-size: 15px; line-height: 21px; }
.bodySm { font-weight: 700; font-size: 13px; line-height: 18px; }
.mute { color: #605449; } .dim { color: #6a5c50; } .accent { color: #a03e2f; }
.phone { position: relative; width: 390px; height: 844px; overflow: hidden; background: #fffaf0; display: flex; flex-direction: column; box-sizing: border-box; }
.statusArea { height: 54px; flex: none; }
.pageHeader { display: flex; align-items: flex-end; justify-content: space-between; padding: 0 18px; flex: none; gap: 12px; }
.crown { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rule { height: 2px; width: 64px; background: #2a1f15; opacity: .3; border-radius: 1px; }
.pocket { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #ffd87a; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(2deg); flex: none; }
.pocket img { width: 20px; height: 20px; }
.edge { height: 2px; background: #2a1f15; opacity: .12; margin-top: 10px; flex: none; }
.scroll { flex: 1 1 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.wall { position: relative; background: #f6e6d4; background-image: repeating-linear-gradient(180deg, transparent 0 46px, rgba(42,31,21,.08) 46px 48px); border-top: 2px solid #2a1f15; border-bottom: 2px solid #2a1f15; padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
.sticker { background: #fffaf0; border: 2px solid #2a1f15; border-radius: 18px; box-shadow: 4px 4px 0 #2a1f15; box-sizing: border-box; }
.sticker.sm { box-shadow: 2px 2px 0 #2a1f15; border-radius: 12px; }
.sticker.cream2 { background: #f6e6d4; } .sticker.sun { background: #ffd87a; } .sticker.sage { background: #c9dec1; } .sticker.rose { background: #ffd6dc; } .sticker.lilac { background: #d6c8f0; } .sticker.sky { background: #c8e3f0; }
.tag { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 12px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; box-sizing: border-box; background: #fffaf0; white-space: nowrap; }
.tag.sun { background: #ffd87a; } .tag.sage { background: #c9dec1; } .tag.muted { background: #f6e6d4; color: #6a5c50; } .tag.lilac { background: #d6c8f0; } .tag.rose { background: #ffd6dc; } .tag.bark { background: #3a2c1e; color: #fff3e2; border-color: #2a1f15; } .tag.gold { background: #F5C44A; color: #5A3F00; }
.tag img { width: 14px; height: 14px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border: 2px solid #2a1f15; border-radius: 22px; background: #fffaf0; box-shadow: 4px 4px 0 #2a1f15; font-weight: 800; font-size: 15px; line-height: 20px; box-sizing: border-box; color: #2a1f15; }
.btn.primary { background: #ffd87a; } .btn.success { background: #c9dec1; } .btn.ghost { box-shadow: none; background: transparent; } .btn.gold { background: linear-gradient(180deg, #F8D068, #F5C44A); color: #5A3F00; } .btn.locked { background: #f6e6d4; color: #6a5c50; box-shadow: 2px 2px 0 #2a1f15; }
.btn.lg { min-height: 54px; padding: 14px 22px; border-radius: 999px; font-size: 17px; } .btn.sm { min-height: 36px; padding: 6px 14px; font-size: 13px; box-shadow: 2px 2px 0 #2a1f15; } .btn.wide { width: 100%; }
.btn img { width: 18px; height: 18px; }
.chalk { background: #3a2c1e; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; color: #fff3e2; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box; flex: 1 1 0; min-width: 0; }
.chalk .k { font-family: "Patrick Hand", cursive; font-size: 13px; line-height: 16px; color: #ffd87a; letter-spacing: .4px; }
.chalk .v { font-family: "Caprasimo", Georgia, serif; font-size: 18px; line-height: 22px; }
.chalk .m { font-size: 12px; line-height: 16px; color: #e8d9c6; }
.sign { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 64px; height: 56px; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; flex: none; }
.sign img { width: 22px; height: 22px; } .sign .lbl { font-weight: 800; font-size: 11px; line-height: 14px; }
.sign::before { content: ""; position: absolute; top: -10px; left: 50%; width: 2px; height: 10px; background: #2a1f15; opacity: .5; }
.plank { height: 14px; background: linear-gradient(180deg, #8d5a2c, #74441e); border: 2px solid #2a1f15; border-radius: 4px; box-shadow: 2px 3px 0 #2a1f15; box-sizing: border-box; }
.shelfRow { display: flex; justify-content: space-around; align-items: flex-end; padding: 0 4px; }
.slot { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px; }
.coaster { width: 74px; height: 74px; border-radius: 999px; border: 2px solid #2a1f15; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: #FAF7F3; position: relative; box-shadow: 2px 2px 0 #2a1f15; }
.coaster img.art { width: 54px; height: 54px; object-fit: contain; }
.coaster .rdot { position: absolute; left: -2px; bottom: 6px; width: 14px; height: 14px; border-radius: 999px; border: 2px solid #2a1f15; box-sizing: border-box; }
.coaster .badge { position: absolute; right: -6px; top: -6px; width: 24px; height: 24px; border-radius: 999px; border: 2px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; justify-content: center; background: #c9dec1; box-sizing: border-box; }
.coaster .badge.gold { background: #F5C44A; } .coaster .badge img { width: 12px; height: 12px; }
.coaster.big { width: 100px; height: 100px; } .coaster.big img.art { width: 74px; height: 74px; }
.r-common { background: #FAF7F3; } .r-uncommon { background: #E8F5E0; } .r-rare { background: #E0EBFF; } .r-epic { background: #EFE9FF; } .r-legendary { background: #FFF3D0; }
.d-common { background: #cdbfae; } .d-uncommon { background: #7ba868; } .d-rare { background: #5a8bc5; } .d-epic { background: #a89bff; } .d-legendary { background: #d4a437; }
.rb-common { background: #FAF7F3; color: #494f56; } .rb-uncommon { background: #E8F5E0; color: #2e6640; } .rb-rare { background: #E0EBFF; color: #2c4f7a; } .rb-epic { background: #EFE9FF; color: #4a3a8f; } .rb-legendary { background: #FFF3D0; color: #6b4a00; }
.sectionHeader { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.card { background: #fffaf0; border: 2px solid #2a1f15; border-radius: 18px; box-shadow: 4px 4px 0 #2a1f15; box-sizing: border-box; display: flex; flex-direction: column; overflow: visible; }
.card .thumb { position: relative; aspect-ratio: 1.18; border-bottom: 2px solid #2a1f15; border-radius: 14px 14px 0 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.card .thumb img.art { width: 72%; height: 72%; object-fit: contain; }
.card .thumb img.scene { width: 100%; height: 100%; object-fit: cover; }
.card .rdot { position: absolute; top: 8px; left: 8px; width: 14px; height: 14px; border-radius: 999px; border: 2px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; }
.card .owned { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 999px; border: 2px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; background: #c9dec1; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.card .owned img { width: 14px; height: 14px; }
.card .foot { display: flex; flex-direction: column; gap: 8px; padding: 12px; flex: 1; justify-content: space-between; }
.card .foot .tag { align-self: stretch; }
.card.t-l { transform: rotate(-.5deg); } .card.t-r { transform: rotate(.5deg); }
.scrim { position: absolute; inset: 0; background: rgba(42,31,21,.55); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; background: #fffaf0; border: 2px solid #2a1f15; border-bottom: 0; border-radius: 22px 22px 0 0; padding: 12px 18px 28px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; }
.grab { width: 44px; height: 5px; border-radius: 999px; background: #2a1f15; opacity: .3; align-self: center; }
.closeRow { display: flex; justify-content: flex-end; }
.iconBtn { width: 44px; height: 44px; border-radius: 12px; border: 2px solid #2a1f15; background: #fffaf0; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; justify-content: center; }
.stage { position: relative; width: 100%; height: 220px; border: 2px solid #2a1f15; border-radius: 14px; overflow: hidden; background: #c8e3f0; display: flex; align-items: flex-end; justify-content: center; box-sizing: border-box; }
.stage img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.stage .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 26%; background: #c9dec1; border-top: 2px solid #2a1f15; }
.pig { position: relative; width: 170px; height: 176px; }
.pig img.rosie { position: absolute; left: 0; top: 0; width: 170px; height: 176px; object-fit: contain; }
.pig img.ov { position: absolute; object-fit: contain; }
.toast { position: absolute; left: 18px; right: 18px; top: 62px; display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #c9dec1; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(-.6deg); }
.toast img { width: 28px; height: 28px; }
.dialog { position: absolute; left: 24px; right: 24px; top: 50%; transform: translateY(-50%) rotate(-.8deg); background: #fffaf0; border: 2px solid #2a1f15; border-radius: 18px; box-shadow: 4px 4px 0 #2a1f15; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; }
.row { display: flex; align-items: center; gap: 8px; }
.seg { display: flex; border: 2px solid #2a1f15; border-radius: 999px; background: #fffaf0; overflow: hidden; box-shadow: 2px 2px 0 #2a1f15; }
.seg button { flex: 1; min-height: 40px; border: 0; background: transparent; font-weight: 800; font-size: 13px; }
.seg button.on { background: #ffd87a; }
.track { height: 14px; border: 2px solid #2a1f15; border-radius: 999px; background: #f6e6d4; overflow: hidden; box-shadow: 2px 2px 0 #2a1f15; }
.track .fill { height: 100%; background: #d6c8f0; border-right: 2px solid #2a1f15; }
.bunting { display: flex; justify-content: space-between; padding: 0 6px; height: 16px; }
.bunting span { width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 14px solid #d6c8f0; }
.bunting span:nth-child(2n) { border-top-color: #ffd87a; } .bunting span:nth-child(3n) { border-top-color: #ffd6dc; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px; text-align: center; }
.empty img { width: 56px; height: 56px; }
.peg { width: 36px; height: 36px; border-radius: 999px; border: 2px dashed #8c7e71; display: flex; align-items: center; justify-content: center; background: #fffaf0; box-sizing: border-box; }
.peg.on { border-style: solid; border-color: #2a1f15; box-shadow: 2px 2px 0 #2a1f15; background: #ffd87a; }
.peg img { width: 22px; height: 22px; object-fit: contain; }
.tape { position: absolute; top: -10px; left: 50%; transform: translateX(-50%) rotate(-8deg); width: 72px; height: 18px; background: rgba(255,216,122,.85); border: 1.5px solid #2a1f15; }
.priceHang { position: absolute; padding: 2px 8px; background: #ffd87a; border: 2px solid #2a1f15; border-radius: 8px; box-shadow: 2px 2px 0 #2a1f15; font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 4px; }
.priceHang img { width: 12px; height: 12px; }
.tabbar { flex: none; height: 64px; border-top: 2px solid #2a1f15; background: #fffaf0; display: flex; justify-content: space-around; align-items: center; padding: 0 12px; }
.tabbar .t { display: flex; flex-direction: column; align-items: center; gap: 2px; font-weight: 800; font-size: 10px; letter-spacing: .6px; text-transform: uppercase; color: #605449; }
.tabbar .t.on { color: #2a1f15; } .tabbar .t img { width: 22px; height: 22px; }
.tabbar .t .ico { width: 22px; height: 22px; border-radius: 6px; border: 2px solid currentColor; box-sizing: border-box; }
"""

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%s</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Fredoka:wght@700&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;display=swap">
<style>%s</style>
</helmet>
"""
TAIL = """</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
"""

def page(title, inner):
    return HEAD % (title, CSS) + '<div class="phone">' + inner + "</div>\n" + TAIL

def fmt(n):
    return f"{n:,}"

# ── Pieces ───────────────────────────────────────────────────────────────────
def crown(kicker, title, right=None, back=None):
    pocket = f'<div class="pocket" aria-label="{fmt(BALANCE)} snouts"><img src="{U["coin"]}" alt=""><span class="numeral">{fmt(BALANCE)}</span></div>'
    if right is not None:
        pocket = right
    bk = f'<a href="{back}" class="handSm accent" style="margin-bottom:2px">‹ Shop</a>' if back else ""
    return f'''<div class="statusArea"></div>
<div class="pageHeader"><div class="crown">{bk}<span class="kicker">{kicker}</span><span class="pageTitle">{title}</span><span class="rule"></span></div>{pocket}</div>
<div class="edge"></div>'''

def tabbar(on="Shop"):
    tabs = ["Home", "Season", "Shop", "Friends", "Me"]
    out = '<nav class="tabbar" aria-label="Tabs">'
    for t in tabs:
        ico = f'<img src="{U["pigface"]}" alt="">' if t == "Home" else (f'<img src="{U["tophat"]}" alt="">' if t == "Shop" else '<span class="ico"></span>')
        out += f'<a href="#top" class="t{" on" if t == on else ""}">{ico}<span>{t}</span></a>'
    return out + "</nav>"

def fitting_room(worn=("skull_mask",), compact=True):
    """The store's hero fitting room (2026-09-17), compact."""
    return f'''<div style="display:flex; align-items:center; justify-content:center; gap:12px; padding: 10px 18px 6px;">
  <div style="display:flex; flex-direction:column; gap:8px">{pegs(["witch_hat" if "witch_hat" in worn else None, "skull_mask" if "skull_mask" in worn else None, None, None])}</div>
  {pig(worn, size=118)}
  <div style="display:flex; flex-direction:column; gap:8px">{pegs([None, None, None, None])}</div>
</div>'''

def pegs(keys):
    out = ""
    for k in keys:
        if k:
            out += f'<span class="peg on"><img src="{U[k]}" alt="{BY[k]["name"]}"></span>'
        else:
            out += '<span class="peg"></span>'
    return out

OVER = {
    "witch_hat": "left:14%; top:-22%; width:78%;",
    "ghost_hood": "left:6%; top:-18%; width:92%;",
    "wolf_ears": "left:16%; top:-14%; width:70%;",
    "cobweb_crown": "left:18%; top:-16%; width:66%;",
    "crossbones_bow": "left:58%; top:6%; width:38%;",
    "spark_goggles": "left:22%; top:24%; width:58%;",
    "skull_mask": "left:22%; top:22%; width:56%;",
    "treat_pail": "left:-8%; top:50%; width:46%;",
    "crystal_ball": "left:-6%; top:48%; width:44%;",
    "pip_candle": "left:-4%; top:46%; width:40%;",
    "firefly_lantern": "left:-10%; top:40%; width:42%;",
    "moon_charm": "left:36%; top:52%; width:30%;",
}

def pig(worn=(), size=170, tags=None):
    s = size
    inner = f'<img class="rosie" src="{U["rosie"]}" alt="Rosie" style="width:{s}px;height:{int(s*1.035)}px">'
    for k in worn:
        if k in OVER:
            inner += f'<img class="ov" src="{U[k]}" alt="{BY[k]["name"]}" style="{OVER[k]}">'
    if tags:
        for k, pos in tags:
            inner += f'<span class="priceHang" style="{pos}"><img src="{U["coin"]}" alt="">{fmt(BY[k]["cost"])}</span>'
    return f'<div class="pig" style="width:{s}px;height:{int(s*1.035)}px">{inner}</div>'

def tag_for(x, in_window=True, locked=False):
    if x["wearing"]:
        return f'<span class="tag sage"><img src="{U["check"]}" alt="">Wearing</span>'
    if x["owned"]:
        return '<span class="tag sun">Wear</span>'
    if locked:
        return f'<span class="tag gold"><img src="{U["lock"]}" alt="">Members</span>'
    tone = "sun" if (in_window and BALANCE >= x["cost"]) else "muted"
    return f'<span class="tag {tone}"><img src="{U["coin"]}" alt="">{fmt(x["cost"])}</span>'

def coaster(x, in_window=True, locked=False, big=False):
    badge = ""
    if x["owned"]:
        badge = f'<span class="badge"><img src="{U["check"]}" alt="owned"></span>'
    elif locked:
        badge = f'<span class="badge gold"><img src="{U["lock"]}" alt="members only"></span>'
    scene = x["cat"] == "background"
    art = f'<img class="art" src="{U[x["key"]]}" alt="" style="{"width:100%;height:100%;border-radius:999px;object-fit:cover" if scene else ""}">'
    return f'''<div class="slot"><button class="coaster r-{x["rar"]}{" big" if big else ""}" aria-label="{x["name"]}, {x["rar"]}, {fmt(x["cost"])} snouts" style="padding:0;overflow:visible">{art}<span class="rdot d-{x["rar"]}"></span>{badge}</button><span class="cardTitleSm" style="text-align:center;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{x["name"]}</span>{tag_for(x, in_window, locked)}</div>'''

def shelf(items, in_window=True, locked=False):
    return f'<div><div class="shelfRow">{"".join(coaster(x, in_window, locked) for x in items)}</div><div class="plank"></div></div>'

def section(kicker, title, right=""):
    r = f'<span class="handSm accent">{right}</span>' if right else ""
    return f'<div class="sectionHeader"><div class="crown"><span class="kicker">{kicker}</span><span class="sectionTitle">{title}</span><span class="rule"></span></div>{r}</div>'

def doorway(countdown="9h 12m"):
    return f'''<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-top:10px">
  <div class="chalk"><span class="k">fresh drop in</span><span class="v">{countdown}</span><span class="m">8 on the shelf today</span></div>
  <div style="display:flex; gap:6px; flex:none; padding-top:10px">
    <a href="#top" class="sign" aria-label="Pen"><img src="{U["pigface"]}" alt=""><span class="lbl">Pen</span></a>
    <a href="#top" class="sign" aria-label="Furnish"><img src="{U["barn"]}" alt=""><span class="lbl">Furnish</span></a>
  </div>
</div>'''

def card(x, i, in_window=True, kicker=None):
    scene = x["cat"] == "background"
    art = f'<img class="scene" src="{U[x["key"]]}" alt="">' if scene else f'<img class="art" src="{U[x["key"]]}" alt="">'
    owned = f'<span class="owned"><img src="{U["check"]}" alt="owned"></span>' if x["owned"] else ""
    k = f'<span class="kickerPillSm mute">{kicker}</span>' if kicker else ""
    return f'''<button class="card t-{"l" if i % 2 == 0 else "r"}" aria-label="{x["name"]}, {x["rar"]}, {fmt(x["cost"])} snouts" style="padding:0;text-align:left">
  <span class="thumb r-{x["rar"]}">{art}<span class="rdot d-{x["rar"]}"></span>{owned}</span>
  <span class="foot">{k}<span class="cardTitleSm">{x["name"]}</span>{tag_for(x, in_window)}</span>
</button>'''

def grid(items, in_window=True, kicker_fn=None):
    return '<div class="grid">' + "".join(card(x, i, in_window, kicker_fn(x) if kicker_fn else None) for i, x in enumerate(items)) + "</div>"

def toast(title, text, cost=None):
    c = f'<span class="tag sun" style="margin-left:auto"><img src="{U["coin"]}" alt="">-{fmt(cost)}</span>' if cost else ""
    return f'<div class="toast" role="status"><img src="{U["sparkle"]}" alt=""><div style="display:flex;flex-direction:column;min-width:0"><span class="cardTitle">{title}</span><span class="bodySm mute">{text}</span></div>{c}</div>'

def leaving_tag(days=DAYS_LEFT, tone="lilac"):
    return f'<span class="tag {tone}">leaving in {days} days</span>'

def rarity_tag(x):
    return f'<span class="tag rb-{x["rar"]}">{x["rar"]}</span>'

def preview_sheet(x, worn_extra=(), state="buy", days=DAYS_LEFT, note=None, lane_line=True):
    """ItemPreviewModal as shipped: close row, frozen pig at rest wearing the item, name, rarity, price, CTA."""
    worn = tuple(worn_extra) + ((x["key"],) if x["key"] in OVER else ())
    bg = f'<img class="bg" src="{U["bg_" + x["key"].replace("_bg", "")]}" alt="">' if x["cat"] == "background" else '<span class="ground"></span>'
    if state == "buy":
        afford = BALANCE >= x["cost"]
        cta = (f'<button class="btn primary lg wide" aria-label="Buy {x["name"]} for {fmt(x["cost"])} snouts">Buy now · <img src="{U["coin"]}" alt="">{fmt(x["cost"])}</button>' if afford
               else f'<button class="btn locked lg wide" aria-label="Not enough snouts, {fmt(x["cost"])} needed">Need {fmt(x["cost"] - BALANCE)} more snouts</button>')
    elif state == "busy":
        cta = '<button class="btn locked lg wide" aria-label="Buying">Buying…</button>'
    elif state == "wear":
        cta = f'<button class="btn primary lg wide" aria-label="Wear {x["name"]}">Wear</button>'
    elif state == "wearing":
        cta = f'<button class="btn lg wide" aria-label="Take off {x["name"]}">Take off</button>'
    else:
        cta = f'<button class="btn locked lg wide">Not on the shelf</button>'
    lane = ""
    if lane_line:
        lane = leaving_tag(days) if days is not None else '<span class="tag muted">shelf closed</span>'
    n = f'<span class="hand mute" style="text-align:center">{note}</span>' if note else ""
    return f'''<div class="scrim"></div>
<div class="sheet" role="dialog" aria-label="{x["name"]}">
  <span class="grab"></span>
  <div class="closeRow"><button class="iconBtn" aria-label="Close"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#2a1f15" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15"/></svg></button></div>
  <div class="stage">{bg}{pig(worn, 170)}</div>
  <div style="display:flex; flex-direction:column; gap:6px; align-items:center; text-align:center">
    <span class="pageTitle">{x["name"]}</span>
    <div class="row" style="justify-content:center">{rarity_tag(x)}{lane}</div>
    <span class="hand mute">{COPY.get(x["key"], "")}</span>
  </div>
  <div style="display:flex; align-items:center; justify-content:center; gap:6px"><img src="{U["coin"]}" alt="" style="width:20px;height:20px"><span class="sectionTitle">{fmt(x["cost"])}</span><span class="hand mute">snouts · you have {fmt(BALANCE)}</span></div>
  {cta}{n}
</div>'''

COPY = {
    "witch_hat": "A moon-curled hat for stirring up cozy trouble.",
    "ghost_hood": "Boo. Politely.",
    "treat_pail": "Holds exactly one night of candy.",
    "skull_mask": "Grin and bear it.",
    "graveyard_bg": "Quiet neighbours, lovely moon.",
    "crystal_ball": "It sees snacks in your future.",
}

# ── Direction A · The Third Plank ───────────────────────────────────────────
def a_seasonal_plank(items, days=DAYS_LEFT, see_all="A2_Set.dc.html"):
    return f'''<div style="position:relative; display:flex; flex-direction:column; gap:10px; padding-top:8px">
  <div class="bunting" aria-hidden="true">{"<span></span>" * 9}</div>
  <div class="sectionHeader">
    <div class="crown"><span class="kicker">seasonal shelf · leaving in {days} days</span><span class="sectionTitle">Spooky Snouts</span><span class="rule"></span></div>
    <a href="{see_all}" class="tag bark" aria-label="See all 16 pieces">all 16 ›</a>
  </div>
  {shelf(items)}
</div>'''

def A1():
    body = crown("three you can buy today · one shelf leaving soon", "Shop")
    body += '<div class="scroll">' + fitting_room(("skull_mask",))
    body += '<div class="wall">' + doorway()
    body += a_seasonal_plank([BY["witch_hat"], BY["ghost_hood"], BY["treat_pail"]])
    body += section("sold today only", "Today's drop", "resets in 9h 12m") + shelf(DROP)
    body += section("members only", "Slop Club", "join in the Pen") + shelf(MEMBERS, locked=True)
    body += "</div></div>" + tabbar()
    return page("A1 · Shop with the seasonal plank", body)

def A2():
    body = crown("leaving in 6 days · you own 2 of 16", "Spooky Snouts", back="Main.dc.html")
    body += '<div class="scroll"><div style="padding:12px 18px 0; display:flex; flex-direction:column; gap:12px">'
    body += '<div class="seg" role="tablist"><button class="on" role="tab" aria-selected="true">New this year · 12</button><button role="tab" aria-selected="false">Back for the weekend · 4</button></div>'
    body += '<div class="row" style="justify-content:space-between"><span class="hand mute">sun price = on the shelf till Nov 9</span><span class="handSm accent">how it works ›</span></div>'
    body += grid(NEW[:6])
    body += '</div></div>' + tabbar()
    return page("A2 · The set sheet", body)

def A3():
    body = crown("three you can buy today · one shelf leaving soon", "Shop")
    body += '<div class="scroll">' + fitting_room(("skull_mask",))
    body += '<div class="wall">' + doorway() + a_seasonal_plank([BY["witch_hat"], BY["ghost_hood"], BY["treat_pail"]]) + "</div></div>"
    body += preview_sheet(BY["witch_hat"], worn_extra=("skull_mask",), state="buy")
    return page("A3 · Preview on Rosie, frozen at rest", body)

def A4():
    body = crown("three you can buy today · one shelf leaving soon", "Shop")
    body += '<div class="scroll">' + fitting_room(("skull_mask",))
    body += '<div class="wall">' + doorway() + a_seasonal_plank([BY["witch_hat"], BY["ghost_hood"], BY["treat_pail"]]) + "</div></div>"
    body += preview_sheet(BY["witch_hat"], worn_extra=("skull_mask",), state="busy", note="One tap buys. No second dialog: the sheet is the confirm (today's rule).")
    return page("A4 · Buy: the press, then the toast", body)

def A5():
    w = dict(BY["witch_hat"], owned=True, wearing=True)
    items = [w, BY["ghost_hood"], BY["treat_pail"]]
    body = crown("two you can buy today · one shelf leaving soon", "Shop", right=f'<div class="pocket" aria-label="{fmt(BALANCE-1200)} snouts"><img src="{U["coin"]}" alt=""><span class="numeral">{fmt(BALANCE-1200)}</span></div>')
    body += '<div class="scroll">' + fitting_room(("skull_mask", "witch_hat"))
    body += '<div class="wall">' + doorway() + a_seasonal_plank(items)
    body += section("sold today only", "Today's drop", "resets in 9h 12m") + shelf(DROP)
    body += "</div></div>" + tabbar()
    body += toast("Moonbrew Witch Hat · Bought", "Added to your closet. Tap the coaster to wear.", 1200)
    return page("A5 · Owned: one tap wears it", body)

def A6():
    body = crown("three you can buy today", "Shop")
    body += '<div class="scroll">' + fitting_room(("skull_mask", "witch_hat"))
    body += '<div class="wall">' + doorway()
    body += f'''<div style="position:relative; display:flex; flex-direction:column; gap:10px; padding-top:8px">
  <div class="sectionHeader"><div class="crown"><span class="kicker">seasonal shelf · closed Nov 9</span><span class="sectionTitle">Spooky Snouts</span><span class="rule"></span></div><span class="tag muted">back next year</span></div>
  <div><div class="shelfRow" style="min-height:118px; align-items:center"><div class="empty" style="padding:6px"><img src="{U["sparkle"]}" alt=""><span class="hand mute">The shelf is bare. You took home 3 pieces; find them in your closet.</span></div></div><div class="plank"></div></div>
</div>'''
    body += section("sold today only", "Today's drop", "resets in 9h 12m") + shelf(DROP)
    body += "</div></div>" + tabbar()
    return page("A6 · After the window: a bare plank for 3 days, then gone", body)

# ── Direction B · The Pop-up Stall ──────────────────────────────────────────
def stall_card(days=DAYS_LEFT, href="B2_Stall.dc.html", closed=False):
    if closed:
        return f'''<a href="B6_Closed.dc.html" class="sticker cream2" style="display:flex; align-items:center; gap:12px; padding:12px 14px; transform: rotate(-.6deg)" aria-label="The stall has packed up">
  <span class="coaster r-common" style="flex:none"><img class="art" src="{U["lock"]}" alt="" style="width:28px;height:28px"></span>
  <span style="display:flex; flex-direction:column; min-width:0"><span class="kicker" style="color:#605449">seasonal stall · closed Nov 9</span><span class="sectionTitle">Spooky Snouts</span><span class="handSm mute">packed up till next October · what you bought stays</span></span>
</a>'''
    return f'''<a href="{href}" class="sticker" style="position:relative; display:block; overflow:hidden; transform: rotate(-.6deg); padding:0" aria-label="Spooky Snouts stall, 16 pieces, leaving in {days} days">
  <span style="position:relative; display:block; height:128px; border-bottom:2px solid #2a1f15; overflow:hidden"><img src="{U["bg_graveyard"]}" alt="" style="width:100%; height:100%; object-fit:cover">
    <span style="position:absolute; left:14px; bottom:-6px">{pig(("witch_hat",), 104)}</span>
    <span class="tag lilac" style="position:absolute; right:10px; top:10px">leaving in {days} days</span>
  </span>
  <span style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; gap:8px"><span style="display:flex; flex-direction:column"><span class="kicker">seasonal stall · 16 pieces</span><span class="sectionTitle">Spooky Snouts</span></span><span class="tag bark">Step in ›</span></span>
</a>'''

def B1():
    body = crown("a stall is open · three you can buy today", "Shop")
    body += '<div class="scroll">' + fitting_room(("skull_mask",))
    body += '<div class="wall">' + stall_card() + doorway()
    body += section("sold today only", "Today's drop", "resets in 9h 12m") + shelf(DROP)
    body += "</div></div>" + tabbar()
    return page("B1 · Shop with the stall card", body)

def b_hero(worn=("skull_mask",), tags=None, caption="tap a piece to see it on her"):
    return f'''<div class="stage" style="height:236px; border-radius:0; border-left:0; border-right:0"><img class="bg" src="{U["bg_graveyard"]}" alt="">{pig(worn, 184, tags)}<span class="handSm" style="position:absolute; left:12px; top:10px; color:#fff3e2">{caption}</span></div>'''

def b_meter(owned=2, total=16):
    return f'<div style="display:flex; flex-direction:column; gap:6px; padding:0 18px"><div class="row" style="justify-content:space-between"><span class="kickerPill">your haul</span><span class="hand mute">{owned} of {total}</span></div><div class="track"><div class="fill" style="width:{int(owned/total*100)}%"></div></div></div>'

def B2():
    body = crown("leaving in 6 days", "Spooky Snouts", back="B1_Shop.dc.html")
    body += '<div class="scroll" style="gap:12px">' + b_hero() + b_meter()
    body += '<div style="padding:0 18px; display:flex; flex-direction:column; gap:12px"><div class="seg" role="tablist"><button class="on" role="tab" aria-selected="true">New · 12</button><button role="tab" aria-selected="false">Back · 4</button><button role="tab" aria-selected="false">Yours · 2</button></div>'
    body += grid(NEW[:4]) + "</div></div>" + tabbar()
    return page("B2 · The stall page: hero, haul meter, grid", body)

def B3():
    body = crown("leaving in 6 days", "Spooky Snouts", back="B1_Shop.dc.html")
    body += '<div class="scroll" style="gap:12px">' + b_hero(("skull_mask", "witch_hat"), tags=[("witch_hat", "right:14px; top:14px; transform: rotate(6deg)")], caption="Rosie is trying on the Moonbrew Witch Hat")
    body += f'''<div style="padding:0 18px; display:flex; flex-direction:column; gap:10px">
  <div class="sticker sm" style="display:flex; align-items:center; gap:12px; padding:10px 12px">
    <span class="coaster r-epic" style="flex:none"><img class="art" src="{U["witch_hat"]}" alt=""><span class="rdot d-epic"></span></span>
    <span style="display:flex; flex-direction:column; gap:4px; min-width:0; flex:1"><span class="cardTitle">Moonbrew Witch Hat</span><span class="row">{rarity_tag(BY["witch_hat"])}{leaving_tag()}</span></span>
    <button class="btn primary" aria-label="Buy Moonbrew Witch Hat for 1,200 snouts">Buy · <img src="{U["coin"]}" alt="">1,200</button>
  </div>
  <span class="handSm mute" style="text-align:center">try-on is free and stays until you leave the stall · long press for the sheet</span>
</div>'''
    body += '<div style="padding:0 18px; display:flex; flex-direction:column; gap:12px">' + grid(NEW[:2]) + "</div></div>" + tabbar()
    return page("B3 · Try-on in place: the hero wears what you tap", body)

def B4():
    body = crown("leaving in 6 days", "Spooky Snouts", back="B1_Shop.dc.html")
    body += '<div class="scroll" style="gap:12px">' + b_hero(("skull_mask", "witch_hat")) + b_meter() + '<div style="padding:0 18px">' + grid(NEW[:2]) + "</div></div>"
    body += f'''<div class="scrim"></div>
<div class="dialog" role="dialog" aria-label="Buy Moonbrew Witch Hat?">
  <span class="kicker">1,200 snouts · leaves in 6 days</span>
  <span class="pageTitle">Buy the Moonbrew Witch Hat?</span>
  <span class="body mute">It goes in your closet for keeps. You will have {fmt(BALANCE-1200)} snouts left.</span>
  <div style="display:flex; gap:10px; justify-content:flex-end; padding-top:4px"><button class="btn ghost" aria-label="Not now">Not now</button><button class="btn primary" aria-label="Buy for 1,200 snouts">Buy · <img src="{U["coin"]}" alt="">1,200</button></div>
</div>'''
    return page("B4 · Buy confirm: a ConfirmDialog with the window on it", body)

def B5():
    w = dict(BY["witch_hat"], owned=True, wearing=True)
    body = crown("leaving in 6 days", "Spooky Snouts", back="B1_Shop.dc.html", right=f'<div class="pocket"><img src="{U["coin"]}" alt=""><span class="numeral">{fmt(BALANCE-1200)}</span></div>')
    body += '<div class="scroll" style="gap:12px">' + b_hero(("skull_mask", "witch_hat"), caption="wearing it home") + b_meter(3)
    body += '<div style="padding:0 18px">' + grid([w, NEW[1]]) + "</div></div>" + tabbar()
    body += toast("Moonbrew Witch Hat · Bought", "She is wearing it. 3 of 16 in your haul.", 1200)
    return page("B5 · Owned: worn on the hero, haul ticks up", body)

def B6():
    body = crown("closed Nov 9 · back next October", "Spooky Snouts", back="B1_Shop.dc.html")
    body += f'''<div class="scroll" style="gap:12px">
<div class="stage" style="height:200px; border-radius:0; border-left:0; border-right:0; background:#f6e6d4"><span class="ground"></span>{pig(("skull_mask", "witch_hat"), 160)}</div>
<div class="empty"><img src="{U["lock"]}" alt=""><span class="sectionTitle">The stall has packed up</span><span class="hand mute">Three pieces came home with you. The rest ride the cart till next October.</span></div>
<div style="padding:0 18px; display:flex; flex-direction:column; gap:12px">{section("what you took home", "Your haul", "3 of 16")}{grid([dict(BY["witch_hat"], owned=True, wearing=True), BY["treat_pail"]], in_window=False)}</div>
</div>''' + tabbar()
    return page("B6 · After the window: packed up, your haul stays", body)

# ── Direction C · Dress for the Night ───────────────────────────────────────
def c_look_card(days=DAYS_LEFT, href="C2_Fitting.dc.html"):
    return f'''<a href="{href}" class="sticker" style="position:relative; display:block; overflow:hidden; transform: rotate(.5deg); padding:0" aria-label="Dress Rosie for the night, leaving in {days} days">
  <span style="position:relative; display:block; height:168px; border-bottom:2px solid #2a1f15; overflow:hidden"><img src="{U["bg_graveyard"]}" alt="" style="width:100%; height:100%; object-fit:cover">
    <span style="position:absolute; left:50%; bottom:-8px; transform:translateX(-50%)">{pig(("witch_hat", "crossbones_bow", "treat_pail"), 140)}</span>
    <span class="tag lilac" style="position:absolute; right:10px; top:10px">leaving in {days} days</span>
    <span class="tape"></span>
  </span>
  <span style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; gap:8px"><span style="display:flex; flex-direction:column"><span class="kicker">the night's look · 16 pieces</span><span class="sectionTitle">Dress her for the night</span></span><span class="tag bark">Dress up ›</span></span>
</a>'''

def C1():
    body = crown("a look to try · three you can buy today", "Shop")
    body += '<div class="scroll">' + fitting_room(("skull_mask",))
    body += '<div class="wall">' + c_look_card() + doorway()
    body += section("sold today only", "Today's drop", "resets in 9h 12m") + shelf(DROP)
    body += "</div></div>" + tabbar()
    return page("C1 · Shop with the look card", body)

SLOTS = [("hat", "witch_hat"), ("bow", "crossbones_bow"), ("held", "treat_pail"), ("mask", "skull_mask"), ("glasses", "spark_goggles"), ("charm", "moon_charm"), ("aura", None), ("scene", "graveyard_bg")]

def c_rail(active="hat", worn=()):
    out = '<div style="display:flex; gap:8px; padding:0 18px; overflow:hidden">'
    for s, k in SLOTS:
        on = s == active
        has = k in worn if k else False
        ico = f'<img src="{U[k]}" alt="" style="width:26px;height:26px;object-fit:contain;{"border-radius:999px" if s == "scene" else ""}">' if (k and has) else '<span class="ico" style="width:22px;height:22px;border-radius:999px;border:2px dashed #8c7e71;display:block"></span>'
        out += f'<button class="sticker sm{" sun" if on else ""}" style="display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 4px; width:62px; flex:none" aria-label="{s} slot" aria-pressed="{"true" if on else "false"}">{ico}<span class="kickerPillSm">{s}</span></button>'
    return out + "</div>"

def c_picker(items, worn=()):
    out = '<div style="display:flex; gap:10px; padding:0 18px; overflow:hidden; align-items:flex-start">'
    for x in items:
        on = x["key"] in worn
        out += f'''<div class="slot" style="width:84px"><button class="coaster r-{x["rar"]}" style="padding:0; {"outline:3px solid #a03e2f; outline-offset:2px" if on else ""}" aria-label="{x["name"]}" aria-pressed="{"true" if on else "false"}"><img class="art" src="{U[x["key"]]}" alt=""><span class="rdot d-{x["rar"]}"></span>{f'<span class="badge"><img src="{U["check"]}" alt="owned"></span>' if x["owned"] else ""}</button><span class="handSm" style="text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:84px">{x["name"]}</span></div>'''
    return out + "</div>"

def c_basket(items, label="Buy the look"):
    total = sum(BY[k]["cost"] for k in items if not BY[k]["owned"])
    n = len([k for k in items if not BY[k]["owned"]])
    return f'''<div style="position:absolute; left:0; right:0; bottom:64px; padding:10px 18px 12px; background:#fffaf0; border-top:2px solid #2a1f15; display:flex; align-items:center; gap:12px">
  <div style="display:flex; flex-direction:column; min-width:0; flex:1"><span class="kickerPill">{n} pieces she's wearing</span><span class="row"><img src="{U["coin"]}" alt="" style="width:18px;height:18px"><span class="numeralLg">{fmt(total)}</span><span class="handSm mute">of your {fmt(BALANCE)}</span></span></div>
  <button class="btn primary lg" aria-label="{label}, {fmt(total)} snouts">{label}</button>
</div>'''

def c_stage(worn, tags=None, h=300):
    return f'''<div class="stage" style="height:{h}px; border-radius:0; border-left:0; border-right:0"><img class="bg" src="{U["bg_graveyard"]}" alt="">{pig(worn, 210, tags)}<span class="tag lilac" style="position:absolute; right:12px; top:12px">leaving in 6 days</span></div>'''

def C2():
    worn = ("skull_mask", "witch_hat", "crossbones_bow", "treat_pail")
    body = crown("leaving in 6 days · the fitting room", "Dress for the night", back="C1_Shop.dc.html")
    body += '<div class="scroll" style="gap:12px">' + c_stage(worn, tags=[("witch_hat", "left:20px; top:70px; transform:rotate(-6deg)"), ("crossbones_bow", "right:22px; top:96px; transform:rotate(5deg)")])
    body += '<span class="handSm mute" style="text-align:center; padding:0 18px">tap a slot, pick a piece: she wears it right away · owned pieces have no tag</span>'
    body += c_rail("hat", worn) + c_picker([BY["witch_hat"], BY["ghost_hood"], BY["wolf_ears"], BY["cobweb_crown"]], worn) + "</div>"
    body += c_basket(["witch_hat", "crossbones_bow", "treat_pail"]) + tabbar()
    return page("C2 · The fitting room: slots, pickers, a basket", body)

def C3():
    worn = ("skull_mask", "ghost_hood", "crossbones_bow", "treat_pail")
    body = crown("leaving in 6 days · the fitting room", "Dress for the night", back="C1_Shop.dc.html")
    body += '<div class="scroll" style="gap:12px">' + c_stage(worn, tags=[("ghost_hood", "left:20px; top:70px; transform:rotate(-6deg)"), ("crossbones_bow", "right:22px; top:96px; transform:rotate(5deg)")])
    body += '<span class="handSm mute" style="text-align:center; padding:0 18px">swapped the hat: the Silly Sheet Ghost Hood replaces the witch hat in the look</span>'
    body += c_rail("hat", worn) + c_picker([BY["witch_hat"], BY["ghost_hood"], BY["wolf_ears"], BY["cobweb_crown"]], worn) + "</div>"
    body += c_basket(["ghost_hood", "crossbones_bow", "treat_pail"]) + tabbar()
    return page("C3 · Preview: swapping a piece is the preview", body)

def C4():
    worn = ("skull_mask", "witch_hat", "crossbones_bow", "treat_pail")
    body = crown("leaving in 6 days · the fitting room", "Dress for the night", back="C1_Shop.dc.html")
    body += '<div class="scroll" style="gap:12px">' + c_stage(worn) + c_rail("hat", worn) + "</div>"
    rows = "".join(f'<div class="row" style="justify-content:space-between"><span class="row"><span class="coaster r-{BY[k]["rar"]}" style="width:36px;height:36px;box-shadow:none"><img class="art" src="{U[k]}" alt="" style="width:26px;height:26px"></span><span class="bodySm">{BY[k]["name"]}</span></span><span class="row"><img src="{U["coin"]}" alt="" style="width:14px;height:14px"><span class="numeral">{fmt(BY[k]["cost"])}</span></span></div>' for k in ["witch_hat", "crossbones_bow"])
    body += f'''<div class="scrim"></div>
<div class="dialog" role="dialog" aria-label="Buy the look?">
  <span class="kicker">2 pieces · leaves in 6 days</span>
  <span class="pageTitle">Buy the look?</span>
  {rows}
  <div class="row" style="justify-content:space-between; border-top:2px solid #2a1f15; padding-top:8px"><span class="label">Total</span><span class="row"><img src="{U["coin"]}" alt="" style="width:16px;height:16px"><span class="numeralLg">1,760</span></span></div>
  <span class="handSm mute">The treat pail is already yours. You will have 80 snouts left.</span>
  <div style="display:flex; gap:10px; justify-content:flex-end; padding-top:4px"><button class="btn ghost">Not now</button><button class="btn primary">Buy 2 · <img src="{U["coin"]}" alt="">1,760</button></div>
</div>'''
    return page("C4 · Buy confirm: the basket, itemised", body)

def C5():
    worn = ("skull_mask", "witch_hat", "crossbones_bow", "treat_pail")
    body = crown("leaving in 6 days · the fitting room", "Dress for the night", back="C1_Shop.dc.html", right=f'<div class="pocket"><img src="{U["coin"]}" alt=""><span class="numeral">80</span></div>')
    body += '<div class="scroll" style="gap:12px">' + c_stage(worn)
    body += f'''<div style="padding:0 18px; display:flex; flex-direction:column; gap:10px">
  <div class="sticker sage" style="display:flex; align-items:center; gap:12px; padding:12px 14px; transform:rotate(-.6deg)"><img src="{U["check"]}" alt="" style="width:28px;height:28px"><span style="display:flex; flex-direction:column"><span class="cardTitle">The look is hers</span><span class="bodySm">3 pieces worn, all in the closet. Wearing is the default; take any off in the Closet.</span></span></div>
  <button class="btn gold lg wide" aria-label="Share the look with your sounder">Share the look with your sounder</button>
  <span class="handSm mute" style="text-align:center">a share card: Rosie in the look on the graveyard, your name, the set's name</span>
</div>''' + c_rail("hat", worn) + "</div>" + tabbar()
    return page("C5 · Owned: worn by default, share the look", body)

def C6():
    worn = ("skull_mask", "witch_hat", "crossbones_bow", "treat_pail")
    body = crown("closed Nov 9", "Dress for the night", back="C1_Shop.dc.html")
    body += f'''<div class="scroll" style="gap:12px">
<div class="stage" style="height:260px; border-radius:0; border-left:0; border-right:0; background:#f6e6d4"><span class="ground"></span>{pig(worn, 200)}<span class="tag muted" style="position:absolute; right:12px; top:12px">the night's over</span></div>
<div class="empty"><img src="{U["sparkle"]}" alt=""><span class="sectionTitle">The night's over</span><span class="hand mute">You kept 3 pieces. The pickers are closed; what she wears is yours to keep wearing.</span></div>
{c_rail("hat", worn)}
<div style="padding:0 18px"><button class="btn wide" aria-label="Open the Closet">Open the Closet</button></div>
</div>''' + tabbar()
    return page("C6 · After the window: the pickers close, the look stays", body)

# ── Write files + canvas.json ───────────────────────────────────────────────
BOARDS = [
    ("A", [("Main.dc.html", "A1 · Shop landing", A1), ("A2_Set.dc.html", "A2 · Set sheet", A2), ("A3_Preview.dc.html", "A3 · Preview on Rosie", A3), ("A4_Buy.dc.html", "A4 · Buy", A4), ("A5_Owned.dc.html", "A5 · Owned and worn", A5), ("A6_Closed.dc.html", "A6 · Window closed", A6)]),
    ("B", [("B1_Shop.dc.html", "B1 · Shop landing", B1), ("B2_Stall.dc.html", "B2 · Stall page", B2), ("B3_TryOn.dc.html", "B3 · Try on in place", B3), ("B4_Confirm.dc.html", "B4 · Buy confirm", B4), ("B5_Owned.dc.html", "B5 · Owned", B5), ("B6_Closed.dc.html", "B6 · Window closed", B6)]),
    ("C", [("C1_Shop.dc.html", "C1 · Shop landing", C1), ("C2_Fitting.dc.html", "C2 · Fitting room", C2), ("C3_Preview.dc.html", "C3 · Swap a piece", C3), ("C4_Confirm.dc.html", "C4 · Buy the look", C4), ("C5_Owned.dc.html", "C5 · Owned + share", C5), ("C6_Closed.dc.html", "C6 · Window closed", C6)]),
]
W, H, GX, ROW = 390, 844, 80, 1320
boards, order = {}, []
for r, (letter, row) in enumerate(BOARDS):
    for i, (fn, title, f) in enumerate(row):
        with open(os.path.join(P, fn), "w") as fh:
            fh.write(f())
        boards[fn] = {"x": i * (W + GX), "y": r * ROW, "w": W, "h": H, "title": title}
        order.append(fn)

ROW_W = 6 * W + 5 * GX
STICKY_X = ROW_W + 80
notes = {
    "intro": {"x": -520, "y": 0, "w": 420, "fill": "orange", "text": "TTP Shop · seasonal shelf · 2026-10-29\n\nThree directions for a dated shelf whose first tenant is Halloween 2026 (Spooky Snouts) and whose next is a winter set. Each row is one direction, left to right: shop landing · the set · preview/try-on · buy · owned/equip · after the window.\n\nShared facts on every board: the window is a row (key, title, opens_at, closes_at); 'leaving in N days' is computed from closes_at; new pieces are sold only inside the window; the four returning pieces (Skull Mask, Pumpkin Patch, Firefly Lantern, Candy Land) keep their daily-drop life after it. Prices sit in the rarity bands. Balance 1,840 snouts. Costumes are out of scope (no body slot yet).\n\nArt: the Halloween shop art folders were empty at build time, so every Halloween piece on these boards is the trading-card art from assets/images/trading-cards/halloween-2026 as a stand-in; existing items use their shipped sprites. Rosie is sprites/rosie/idle_1 at rest (the shop preview rule). Overlay placement is eyeballed, not the renderer's RelSpec.\n\nTokens are copied by hand from constants/theme.ts: the 'Tickle the Pig' design system artifact existed but was still empty when this was built."},
    "titleA": {"x": 0, "y": -300, "kind": "title1", "maxW": ROW_W, "text": "A · The Third Plank: a dated shelf in today's wall"},
    "titleB": {"x": 0, "y": ROW - 300, "kind": "title1", "maxW": ROW_W, "text": "B · The Pop-up Stall: a card on the wall, a page of its own"},
    "titleC": {"x": 0, "y": 2 * ROW - 300, "kind": "title1", "maxW": ROW_W, "text": "C · Dress for the Night: try the look, buy the look"},
    "stickyA": {"x": STICKY_X, "y": 0, "w": 440, "fill": "green", "text": "A · The Third Plank  (≈ 2.5 h, fits)\n\nWhat it is: a third plank in the store's wall, above Today's drop, with bunting and a 'leaving in N days' kicker. Three coasters a day from the set (same daily hash as the drop, seeded by shelf key) and an 'all 16 ›' tag that opens the set as a sheet: segment New · Back for the weekend, the shipped 2-col ShopCard grid. Preview is today's ItemPreviewModal plus one lilac tag (leaving in N days). Buy is today's one-tap Buy now (the sheet is the confirm). Owned coasters say Wear / Wearing and dress her in one tap (the 2026-09-17 rule, unchanged). After closes_at the plank stays bare for 3 days with 'back next year', then unmounts.\n\nPillar fit: Collect (a shelf you can miss is a reason to come back this week); Connect only via the counter (a crewmate's seasonal buy shows there like any buy). Nothing new to learn: one grammar, sun price = on the shelf now.\n\nVs today: + SeasonalShelf (plank + sign + 3 ShelfItems), + SeasonalSetSheet (Sheet + SegmentedControl + ShopCard grid), + leaving tag in the preview, + shelf ids in buyableIds, + 'leaving in' copy. No route, no new card grammar.\n\nServer: seasonal_shelves(key pk, title, kicker, opens_at, closes_at) + hats.shelf_key, hats.shelf_lane ('new'|'returning'); seasonal_shelf() RPC returns the open shelf + its hats; daily_shop() excludes lane='new' rows; buy_hat() refuses lane='new' outside the window (reason not_in_window). Seed: 1 shelf row, 12 new hats (art paths), 4 returning hats tagged. Winter = one shelf row + its hats, no code.\n\nHours: migration + seed 0.75 · hook/util + buyable gate 0.5 · plank 0.5 · set sheet 0.5 · preview tag + closed state + tests 0.25 ≈ 2.5. First cut if late: the set sheet ('all 16 ›' scrolls the catalog filtered to the shelf instead)."},
    "stickyB": {"x": STICKY_X, "y": ROW, "w": 440, "fill": "blue", "text": "B · The Pop-up Stall  (≈ 3.5 h, over by an hour; a 2.5 h cut exists)\n\nWhat it is: a painted stall card at the top of the wall (the set's hero background, Rosie in a piece, the countdown) that opens its own route /shop/shelf/[key]. The page is a small store: hero stage that tries on whatever you tap (free, ephemeral), a haul meter (3 of 16), a segment New · Back · Yours, the 2-col grid, Buy on a strip under the hero. Buy confirms with a ConfirmDialog that names the price and the window. After closes_at the card is a boarded sign and the page is an EmptyState with 'Your haul' under it.\n\nPillar fit: Collect (the set is a place with a meter, so completing it is legible); Connect via the share-ready hero (not drawn: a later step). Contend: none.\n\nVs today: + stall card, + a pushed route with PageHeader back, + in-place try-on on a stage (PigStage frozen at rest, equip state local to the page), + ProgressTrack haul, + ConfirmDialog on buy (today has none), + segment with Yours. Two preview grammars in the app (sheet elsewhere, stage here): the honest cost of this direction.\n\nServer: same as A plus seasonal_shelves.backdrop_hat_id + theme (title colour, bunting), and seasonal_shelf() returns owned_count. buy_hat() window check identical. Winter = one shelf row.\n\nHours: migration + seed 0.75 · route + hero try-on 1.25 · grid + segment + meter 0.5 · confirm + closed + card 0.5 · tests 0.5 ≈ 3.5. The 2.5 h cut: drop the in-place try-on (tap opens today's sheet) and the haul meter; keep the card, the route, the grid, the dialog."},
    "stickyC": {"x": STICKY_X, "y": 2 * ROW, "w": 440, "fill": "purple", "text": "C · Dress for the Night  (≈ 5 to 6 h, two sessions; not today)\n\nWhat it is: the seasonal shelf is a fitting room, not a shelf. A look card on the wall opens a full-screen stage: Rosie on the set's background, a slot rail (hat · bow · held · mask · glasses · charm · aura · scene), a picker per slot; every tap dresses her at once, price tags hang off the unowned pieces, and one basket bar buys everything she is wearing (itemised ConfirmDialog, one atomic RPC). Bought pieces stay worn; a gold Share-the-look CTA posts a card to the sounder. After closes_at the pickers close and the look she kept stays.\n\nPillar fit: Collect at its strongest (you assemble, then you buy the assembly) and Connect for real (the share card is the set's marketing, from players). Risk: it is a second store grammar beside the shelf, and it tempts a 3,000-snout basket on a 1,840 balance.\n\nVs today: + a stage with multi-slot ephemeral equip (PigStage already resolves every slot; the state model is new), + slot rail and pickers, + basket math and partial-afford handling, + itemised dialog, + batch buy toast/celebration, + share card renderer. The set is also browsable only through slots (no grid), so a 16-piece set needs every slot drawn.\n\nServer: A's tables plus buy_hats(hat_ids uuid[]) atomic (all-or-nothing, one balance check, one window check, returns remaining) and a share-card endpoint or on-device render. Winter = one shelf row, but every new slot category needs rail art.\n\nHours: migration + batch RPC 1.25 · stage + rail + pickers 2 · basket + dialog + celebration 1 · share card 1 · closed + tests 0.5 ≈ 5.75. Ship A or B now; C is what the shelf grows into once a set has a full look per pig."},
    "rec": {"x": -520, "y": ROW, "w": 420, "fill": "pink", "text": "Recommendation\n\nBuild A today. It fits the 2.5 h with the honest cut named, changes no grammar a player has learned since 2026-09-17, and its server shape (a seasonal_shelves row + shelf_key on hats) is the same one B and C stand on, so nothing is thrown away.\n\nFold in from B, if the clock allows: the stall card's countdown language ('leaving in 6 days') on the plank's kicker, and 'Yours · N' as the set sheet's third segment.\n\nSave for the winter set: B's route with the in-place try-on, then C's basket once a set carries a whole look per pig.\n\nTwo rules to log in SKILL.md if A ships: (1) a seasonal piece is sold inside its window and nowhere else; a returning piece keeps its daily-drop life after the window. (2) the shelf is data: a winter set is a row and its hats, never a build."},
}

canvas = {
    "v": 3,
    "createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
    "title": "TTP Shop — seasonal shelf — 2026-10-29",
    "launch": {"view": "canvas"},
    "pages": [],
    "boards": boards,
    "order": order,
    "notes": notes,
    "designSystems": [],
}
with open(os.path.join(P, "canvas.json"), "w") as fh:
    json.dump(canvas, fh, indent=1)
print("wrote", len(order), "boards")
