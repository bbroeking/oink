# Generates the boards + canvas.json for "TTP Market: the counter, the noticeboard, onboarding · 2026-10-30"
# (round 4). Starts from ../market-ui-2026-10-29/gen.py (round 2): the same tokens (constants/theme.ts
# verbatim), CSS, fonts, helpers, em-dash guard and canvas conventions. Rules: docs/design/market-2026-10-29/
# round-4-two-part.md (one price per find; Part 1 the Counter, Part 2 the Noticeboard; onboarding) on top of
# round-3.md (sets: 4 of a common, 3 of anything else; usual prices 12 / 24 / 60).
# Art: every image is already uploaded to THIS canvas; the /_blob urls are read verbatim from blobs.json.
# New this round: bullion_counter (THE picture of Part 1) and corkboard (THE picture of Part 2).
import json, os, datetime, random, math, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "project")
os.makedirs(ROOT, exist_ok=True)
with open(os.path.join(HERE, "blobs.json")) as f:
    A = {k: v for k, v in json.load(f).items() if str(v).startswith("/_blob/")}

NAMES = dict(river_pebble="river pebble", blue_feather="blue feather", clover="four-leaf clover", snail_shell="snail shell",
             brass_button="brass button", wool_tuft="tuft of wool", red_berries="red berries", pinecone="pinecone",
             old_key="old key", honeycomb="honeycomb chip", marble="glass marble", tin_whistle="tin whistle")
PL = dict(river_pebble="river pebbles", blue_feather="blue feathers", clover="clovers", snail_shell="snail shells",
          brass_button="brass buttons", wool_tuft="tufts of wool", red_berries="red berries", pinecone="pinecones",
          old_key="old keys", honeycomb="honeycomb chips", marble="glass marbles", tin_whistle="tin whistles")
SHORT = dict(river_pebble="pebble", blue_feather="feather", clover="clover", snail_shell="snail shell", brass_button="button",
             wool_tuft="wool", red_berries="berries", pinecone="pinecone", old_key="old key", honeycomb="honeycomb",
             marble="marble", tin_whistle="whistle")
COMMONS = ["river_pebble", "blue_feather", "clover", "snail_shell", "brass_button", "wool_tuft", "red_berries", "pinecone"]
UNCOMMONS = ["old_key", "honeycomb", "marble"]
FINDS = COMMONS + UNCOMMONS + ["tin_whistle"]


def nset(fid):
    """Round 3: four of a common, three of anything else."""
    return 4 if fid in COMMONS else 3


def usual(fid):
    """The usual price of a set = the Ghost Sheep's price for one find x set size (3x4, 8x3, 20x3)."""
    return 12 if fid in COMMONS else (24 if fid in UNCOMMONS else 60)


def bsell(p, u):
    """Bullion sells a set at 1.2x the price, rounded up, never below the usual price + 1."""
    return max(u + 1, math.ceil(round(1.2 * p, 6)))


def bbuy(p, u):
    """Bullion buys a set at 0.8x the price, rounded down, never above the usual price."""
    return min(u, math.floor(round(0.8 * p, 6)))


def fp(p):
    """The price prints whole when it is whole, else to one place (12, 12.4)."""
    r = round(p, 1)
    return str(int(round(r))) if abs(r - round(r)) < 1e-9 else f"{r:.1f}"


# ── tokens (constants/theme.ts) ──────────────────────────────────────────────
INK = "#2a1f15"; PAPER = "#fffaf0"; CREAM = "#fbeee2"; CREAM2 = "#f6e6d4"; ROSE = "#ffd6dc"; ROSEDEEP = "#f8a8b3"
SAGE = "#c9dec1"; SAGEINK = "#7A9B63"; SUN = "#ffd87a"; LILAC = "#d6c8f0"; SKY = "#c8e3f0"; ACCENT = "#a03e2f"; GOLDINK = "#5A3F00"
SCRIM = "rgba(42,31,21,0.55)"
MUTE = "#605449"      # WHIMSY.mute, text-safe on every core pastel
MUTESOFT = "#8c7e71"  # WHIMSY.muteSoft, rules and boundaries only (never a word)
BARK = "#3a2c1e"; BARKTEXT = "#fff3e2"; BARKMUTE = "#e8d9c6"   # WHIMSY.bark trio: chalk on slate
DIRT = "#8d5a2c"; DIRTDEEP = "#74441e"; CORK = "#d9b27f"       # WHIMSY dirt pair (= WOOD rail), the Pen's cork
TAPE = "#EAD59E"; TAPEEDGE = "#C8AD77"                          # WHIMSY.tape pair
SUCCESS = "#476436"                                              # UI_COLORS.successText
TINT = dict(maya="#E3E2E5", biscuit="#F5E6D6", you="#FDE4E8", pig=CREAM)  # PIG_ACCENT tints


def rgba(hx, a):
    h = hx.lstrip("#")
    return f"rgba({int(h[0:2], 16)},{int(h[2:4], 16)},{int(h[4:6], 16)},{a})"


FONTLINK = '<link href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Fredoka:wght@600;700&amp;family=Nunito:wght@600;700;800;900&amp;family=Patrick+Hand&amp;display=swap" rel="stylesheet">'

CSS = f"""
body{{margin:0}}
a{{color:{ACCENT};text-decoration:none}}a:hover{{color:{INK}}}
.root{{width:390px;height:844px;box-sizing:border-box;position:relative;overflow:hidden;background:{PAPER};color:{INK};font-family:'Nunito',sans-serif;font-weight:700}}
.whimsy{{font-family:'Caprasimo',serif;font-weight:400}}
.hand{{font-family:'Patrick Hand',cursive;font-weight:400}}
.pageTitle{{font-family:'Caprasimo',serif;font-weight:400;font-size:26px;line-height:28px}}
.sectionTitle{{font-family:'Caprasimo',serif;font-weight:400;font-size:22px;line-height:24px;letter-spacing:.2px}}
.cardTitle{{font-family:'Caprasimo',serif;font-weight:400;font-size:18px;line-height:22px;letter-spacing:.2px}}
.cardTitleSm{{font-family:'Caprasimo',serif;font-weight:400;font-size:15px;line-height:20px;letter-spacing:.2px}}
.displayLg{{font-family:'Caprasimo',serif;font-weight:400;font-size:36px;line-height:38px}}
.numeralLg{{font-family:'Caprasimo',serif;font-weight:400;font-size:26px;line-height:28px}}
.numeral{{font-family:'Caprasimo',serif;font-weight:400;font-size:16px;line-height:20px}}
.numIn{{font-family:'Caprasimo',serif;font-weight:400;font-size:1.06em;letter-spacing:.2px}}
.body{{font-size:15px;line-height:21px}}
.bodySm{{font-size:13px;line-height:18px}}
.label{{font-weight:800;font-size:12px;line-height:16px;letter-spacing:.3px}}
.kicker{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:13px;line-height:18px;letter-spacing:.4px}}
.handT{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:14px;line-height:19px}}
.handLg{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:17px;line-height:23px}}
.kickerPill{{font-weight:800;font-size:11px;line-height:14px;letter-spacing:1.6px;text-transform:uppercase}}
.kickerPillSm{{font-weight:800;font-size:10px;line-height:13px;letter-spacing:1.4px;text-transform:uppercase}}
.mute{{color:{MUTE}}}
.acc{{color:{ACCENT}}}
.sticker{{border:2px solid {INK};box-shadow:4px 4px 0 {INK};box-sizing:border-box}}
.stickerSm{{border:2px solid {INK};box-shadow:2px 2px 0 {INK};box-sizing:border-box}}
.flat{{border:2px solid {INK};box-sizing:border-box}}
.dashed{{border:2px dashed {INK};box-sizing:border-box}}
.btn{{font:inherit;color:{INK};margin:0;cursor:pointer;-webkit-appearance:none;appearance:none;text-align:left}}
.clip{{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.chalk{{font-family:'Patrick Hand',cursive;font-weight:400;color:{BARKTEXT}}}
.chalkNum{{font-family:'Caprasimo',serif;font-weight:400;color:{BARKTEXT}}}
.cork{{background-color:{CORK};background-image:radial-gradient({rgba(DIRT, .38)} 1px,transparent 1.7px),radial-gradient({rgba(DIRTDEEP, .26)} 1.3px,transparent 2px),radial-gradient({rgba(PAPER, .42)} 1px,transparent 1.6px);background-size:11px 13px,17px 19px,23px 21px;background-position:0 0,6px 8px,12px 4px}}
.tape{{position:absolute;left:0;right:0;height:34px;background:{CREAM};border-top:2px solid {INK};border-bottom:2px solid {INK};overflow:hidden;display:flex;align-items:center;box-sizing:border-box}}
.track{{display:flex;align-items:center;white-space:nowrap;flex:none}}
.run{{animation:tape 46s linear infinite}}
@keyframes tape{{from{{transform:translateX(0)}}to{{transform:translateX(-50%)}}}}
.tk{{font-weight:800;font-size:11px;line-height:14px;letter-spacing:1.2px;text-transform:uppercase;padding:0 10px;display:inline-flex;align-items:center;gap:5px;height:30px;box-sizing:border-box}}
.tkHi{{background:{SUN};border-left:2px solid {INK};border-right:2px solid {INK};animation:flash 1.4s ease-in-out infinite}}
.tkTag{{font-weight:800;font-size:9px;line-height:12px;letter-spacing:1px;border:1.5px solid {INK};border-radius:999px;padding:0 6px}}
@keyframes flash{{0%,100%{{background:{SUN}}}50%{{background:{PAPER}}}}}
.sep{{font-size:12px;color:{MUTE}}}
@keyframes ding{{0%,100%{{transform:rotate(14deg)}}25%{{transform:rotate(30deg)}}75%{{transform:rotate(-2deg)}}}}
.ding{{animation:ding .9s ease-in-out infinite;transform-origin:50% 10%}}
@keyframes tick{{0%,100%{{opacity:1}}50%{{opacity:.35}}}}
.blink{{animation:tick 1.6s ease-in-out infinite}}
@media (prefers-reduced-motion:reduce){{.run,.tkHi,.ding,.blink{{animation:none}}}}
"""


def page(title, body, w=390, h=844):
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
{FONTLINK}
<style>{CSS}</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


# ── marks (round 2, verbatim) ────────────────────────────────────────────────
def coin_mark(size=16):
    """The market's currency: a tiny TickleCoin (paper face, heavy rim, dashed minted ring, rose chip)."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none">'
            f'<g transform="rotate(4 12 12)"><circle cx="12.6" cy="13" r="9.3" fill="{PAPER}" stroke="{INK}" stroke-width="2.4"/>'
            f'<circle cx="12.6" cy="13" r="5.5" fill="none" stroke="{INK}" stroke-width="1.2" stroke-dasharray="2.2 1.8" opacity=".45"/></g>'
            f'<circle cx="5.2" cy="5.4" r="3.7" fill="{ROSE}" stroke="{INK}" stroke-width="1.4"/></svg>')


def xmark():
    return f'<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="{INK}" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'


def swap_mark(size=34, color=INK):
    """Straight up: two hand-drawn arrows passing each other."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 32 32" aria-hidden="true" style="flex:none" fill="none" stroke="{color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M5 11 H25 M20 6 L25.5 11 L20 16"/><path d="M27 21 H7 M12 16 L6.5 21 L12 26"/></svg>')


def nm(n):
    """A price inside a sentence still wears the numeral face."""
    return f'<span class="numIn">{n}</span>'


def price(n, cls="numeral", mark=15, gap=3, style=""):
    return f'<span style="display:inline-flex;align-items:center;gap:{gap}px;white-space:nowrap;{style}"><span class="{cls}">{n}</span>{coin_mark(mark)}</span>'


def arrow_txt():
    return '<span aria-hidden="true">&rarr;</span>'


def move(a, b, cls="numIn"):
    """'12 -> 12.4': a price move, always in numerals."""
    return f'<span class="{cls}">{a}</span> <span aria-hidden="true">&rarr;</span> <span class="{cls}">{b}</span>'


# ── pieces (round 2) ─────────────────────────────────────────────────────────
def sticker(inner, color=PAPER, radius=14, rot=0, shadow="sticker", style="", pad="12px 14px"):
    cls = {"sticker": "sticker", "sm": "stickerSm", "flat": "flat", "dashed": "dashed", "none": ""}[shadow]
    return (f'<div class="{cls}" style="background:{color};border-radius:{radius}px;padding:{pad};'
            f'transform:rotate({rot}deg);{style}">{inner}</div>')


def crown(kicker, title, sub=None, kcls="acc"):
    s = f'<div class="handT mute" style="margin-top:4px">{sub}</div>' if sub else ""
    return (f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0">'
            f'<div class="kickerPill {kcls}">&#9733; {kicker}</div><div class="pageTitle">{title}</div>'
            f'<div style="height:2px;width:72px;background:{INK};border-radius:2px;margin-top:6px"></div>{s}</div>')


def coin(n, cap="of 25", size=72, label="tickles ready"):
    """TickleCoin drawn small: paper face, heavy rim, sticker shadow, 4deg lean, dashed ring, rose chip."""
    chip_ = max(20, round(size * .3))
    fs = round(size * .4)
    capfs = 13 if size < 90 else 15
    spoken = f"{n} {'tickles banked' if cap == 'banked' else cap + ' tickles ready'}"
    lab = f'<div class="handT" style="text-align:center;white-space:nowrap">{label}</div>' if label else ""
    return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:none">'
            f'<button type="button" class="btn" aria-label="{spoken}" style="position:relative;width:{size}px;height:{size}px;border-radius:999px;border:3px solid {INK};background:{PAPER};box-shadow:4px 4px 0 {INK};transform:rotate(4deg);display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:0;text-align:center">'
            f'<span aria-hidden="true" style="position:absolute;inset:{4 if size < 80 else 6}px;border-radius:999px;border:2px dashed {INK};opacity:.3"></span>'
            f'<span aria-hidden="true" style="position:absolute;top:-8px;left:-8px;width:{chip_}px;height:{chip_}px;border-radius:999px;border:2px solid {INK};background:{ROSE};box-shadow:2px 2px 0 {INK};transform:rotate(-8deg);display:flex;align-items:center;justify-content:center;box-sizing:border-box">'
            f'<img src="{A["g_star"]}" alt="" style="width:{round(chip_ * .62)}px;height:{round(chip_ * .62)}px;object-fit:contain"></span>'
            f'<span class="whimsy" style="font-size:{fs}px;line-height:{fs + 2}px;margin-top:-2px">{n}</span>'
            f'<span class="hand mute" style="font-size:{capfs}px;line-height:{capfs + 2}px;margin-top:-2px">{cap}</span></button>{lab}</div>')


def corner_coin(n, cap="of 25", size=56, top=8, label=""):
    return f'<div style="position:absolute;right:16px;top:{top}px;z-index:3">{coin(n, cap, size, label)}</div>'


def back_link(text, href, top=14, left=16):
    return (f'<a href="{href}" class="flat" style="position:absolute;left:{left}px;top:{top}px;display:inline-flex;align-items:center;gap:6px;'
            f'background:{CREAM};border-radius:999px;padding:0 14px 0 12px;min-height:44px;color:{INK};z-index:3"><span class="cardTitleSm" style="font-size:18px">&#8249;</span><span class="label">{text}</span></a>')


def section_header(t, sub=None, style="", cls="sectionTitle", sub_cls="handT mute"):
    s = f'<div class="{sub_cls}" style="white-space:nowrap">{sub}</div>' if sub else ""
    return f'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;{style}"><div class="{cls}">{t}</div>{s}</div>'


def hand_line(text, cls="handT mute", align="center", style=""):
    return f'<div class="{cls}" style="text-align:{align};{style}">{text}</div>'


def bull_say(img, inner, color=PAPER, size=84, rot=-1.2, alt="Bullion the bull", shadow="sm", pad="8px 12px"):
    return (f'<div style="display:flex;align-items:center;gap:6px"><img src="{img}" alt="{alt}" style="width:{size}px;height:{size}px;object-fit:contain;flex:none">'
            f'{sticker(inner, color=color, radius=18, rot=rot, shadow=shadow, style="flex:1;min-width:0", pad=pad)}</div>')


def face(who, size=24, ring=1.5):
    """A pig's face. Friends carry their pig (Maya's Pepper); a pig we don't know is the plain pig face."""
    if who in ("maya", "you"):
        img, bg, fx, fy = (A["pepper"], TINT["maya"], .6, .38) if who == "maya" else (A["rosie"], TINT["you"], .55, .36)
        z = size * 1.9
        return (f'<span aria-hidden="true" class="flat" style="position:relative;display:inline-block;width:{size}px;height:{size}px;border-radius:999px;background:{bg};overflow:hidden;flex:none;border-width:{ring}px">'
                f'<img src="{img}" alt="" style="position:absolute;width:{z:.1f}px;height:{z:.1f}px;left:{size / 2 - fx * z - ring:.1f}px;top:{size / 2 - fy * z - ring:.1f}px;max-width:none"></span>')
    bg = TINT["biscuit"] if who == "biscuit" else CREAM
    p = max(2, round(size * .12))
    return f'<img src="{A["g_pigface"]}" alt="" aria-hidden="true" class="flat" style="width:{size}px;height:{size}px;border-radius:999px;background:{bg};object-fit:contain;padding:{p}px;flex:none;border-width:{ring}px;box-sizing:border-box">'


def glyph(fid, size=34, style="", alt=""):
    a = f'alt="{alt}"' if alt else 'alt="" aria-hidden="true"'
    return f'<img src="{A[fid]}" {a} style="width:{size}px;height:{size}px;object-fit:contain;flex:none;{style}">'


def gimg(key, size=60, style=""):
    return f'<img src="{A[key]}" alt="" aria-hidden="true" style="width:{size}px;height:{size}px;object-fit:contain;flex:none;{style}">'


def cluster(fid, size=24, n=None, overlap=0.45):
    """A set in a line of text: four of a common, three of anything else, overlapped."""
    n = n or nset(fid)
    rots = (-6, 5, -2, 7)
    gl = "".join(glyph(fid, size, f"margin-left:{0 if i == 0 else -round(size * overlap)}px;transform:rotate({rots[i % 4]}deg)") for i in range(n))
    return f'<span style="display:inline-flex;align-items:center;flex:none">{gl}</span>'


def ticket(stub, cap, label, href=None, tone="golden", aria=None, style="", h=64):
    """TicketButton: the commit reads as a sentence and the price tears off the right end."""
    face_c, stub_c = {"golden": (SUN, ROSE), "paper": (PAPER, CREAM), "season": (ROSE, LILAC)}[tone]
    ink = GOLDINK if tone == "golden" else INK
    stub_el = (f'<div style="width:64px;flex:none;background:{stub_c};border-left:2px dashed {INK};display:flex;flex-direction:column;align-items:center;justify-content:center">'
               f'<div class="numeralLg" style="font-size:24px;line-height:26px">{stub}</div><div class="kickerPillSm mute" style="letter-spacing:1px">{cap}</div></div>')
    face_el = (f'<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 8px;text-align:center;min-width:0">'
               f'<div class="label" style="font-size:15px;line-height:19px;color:{ink};white-space:nowrap">{label}</div></div>')
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    ar = f' aria-label="{aria}"' if aria else ""
    return (f'<{tag}{attr}{ar} class="sticker btn" style="display:flex;height:{h}px;border-radius:14px;overflow:hidden;background:{face_c};color:{INK};padding:0;box-sizing:border-box;{style}">{face_el}{stub_el}</{tag}>')


def pill_btn(text, href=None, fill=CREAM, shadow="flat", style="", aria=None, fs=13):
    cls = {"flat": "flat", "sm": "stickerSm", "sticker": "sticker"}[shadow]
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    ar = f' aria-label="{aria}"' if aria else ""
    return (f'<{tag}{attr}{ar} class="{cls} btn" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:{fill};border-radius:999px;'
            f'padding:0 14px;min-height:44px;color:{INK};box-sizing:border-box;{style}"><span class="label" style="font-size:{fs}px;white-space:nowrap">{text}</span></{tag}>')


def segmented(options, chosen, fs=13):
    segs = ""
    for o in options:
        on = o == chosen
        segs += (f'<button type="button" class="btn" aria-pressed="{"true" if on else "false"}" style="flex:1;min-height:44px;border-radius:999px;'
                 f'border:1.5px solid {INK if on else "transparent"};background:{SUN if on else "transparent"};display:flex;align-items:center;justify-content:center;padding:0 6px">'
                 f'<span class="label" style="font-size:{fs}px;color:{INK if on else MUTE};white-space:nowrap">{o}</span></button>')
    return f'<div class="flat" style="display:flex;gap:4px;padding:4px;border-radius:999px;background:{PAPER}">{segs}</div>'


def sheet(kicker, title, body, footer, top, scene, close_href):
    h = scene + f'<div style="position:absolute;inset:0;background:{SCRIM};z-index:4"></div>'
    h += (f'<div role="dialog" aria-label="{title}" style="position:absolute;left:0;right:0;top:{top}px;bottom:0;background:{PAPER};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;box-sizing:border-box;display:flex;flex-direction:column;z-index:5">'
          f'<div style="align-self:center;width:44px;height:4px;border-radius:2px;background:{CREAM2};margin-top:10px"></div>'
          f'<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:8px 16px 0 16px">{crown(kicker, title)}'
          f'<a href="{close_href}" aria-label="Close" class="flat" style="width:44px;height:44px;border-radius:999px;background:{CREAM};display:flex;align-items:center;justify-content:center;flex:none">{xmark()}</a></div>'
          f'<div style="flex:1;min-height:0;overflow:hidden;padding:12px 16px 0 16px;display:flex;flex-direction:column;gap:10px">{body}</div>'
          f'<div style="padding:10px 16px 26px 16px;border-top:2px solid {CREAM2}">{footer}</div></div>')
    return h


def ab(x, y, inner, w=None, h=None, style=""):
    """An absolutely placed block."""
    ws = f"width:{w}px;" if w is not None else ""
    hs = f"height:{h}px;" if h is not None else ""
    return f'<div style="position:absolute;left:{x}px;top:{y}px;{ws}{hs}{style}">{inner}</div>'


def basket(fid, size, n=None, alt=None, style=""):
    """THE picture of a set: the gingham basket with the set nestled in it. A second copy of the basket,
    clipped to its front half, sits over the finds so their feet sink below the rim."""
    n = n or nset(fid)
    g = size * (0.42 if n == 1 else (0.31 if n == 4 else 0.34))
    spots = {1: [(0.5, 0.52, -4)],
             3: [(0.33, 0.505, -10), (0.67, 0.505, 9), (0.5, 0.545, -3)],
             4: [(0.3, 0.5, -11), (0.7, 0.5, 10), (0.42, 0.55, -4), (0.6, 0.555, 6)]}[n]
    label = alt or (f"a basket of {n} {PL[fid]}" if n > 1 else f"a {NAMES[fid]}, alone in a basket")
    h = f'<div role="img" aria-label="{label}" style="position:relative;width:{size}px;height:{size}px;flex:none;{style}">'
    h += f'<img src="{A["basket"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%">'
    for cx, bot, rot in spots:
        h += (f'<img src="{A[fid]}" alt="" style="position:absolute;left:{cx * size - g / 2:.1f}px;top:{bot * size - g:.1f}px;'
              f'width:{g:.1f}px;height:{g:.1f}px;object-fit:contain;transform:rotate({rot}deg)">')
    h += f'<img src="{A["basket"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;clip-path:inset(49.5% 0 0 0)">'
    return h + "</div>"


def ribbon(text, w=250, h=46, fill=SUN, rot=-2, sub=None):
    """A notched prize ribbon: a first-time moment."""
    n = 14
    pts = f"2,2 {w - 2},2 {w - 2 - n},{h / 2} {w - 2},{h - 2} 2,{h - 2} {n + 2},{h / 2}"
    shadow_pts = " ".join(f"{float(p.split(',')[0]) + 3},{float(p.split(',')[1]) + 3}" for p in pts.split())
    sub_el = f'<div class="kicker" style="margin-top:-2px">{sub}</div>' if sub else ""
    return (f'<div role="img" aria-label="{re.sub("<[^>]+>", "", text)}" style="position:relative;width:{w}px;height:{h}px;transform:rotate({rot}deg);flex:none">'
            f'<svg width="{w + 4}" height="{h + 4}" viewBox="0 0 {w + 4} {h + 4}" aria-hidden="true" style="position:absolute;left:0;top:0">'
            f'<polygon points="{shadow_pts}" fill="{INK}"/>'
            f'<polygon points="{pts}" fill="{fill}" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/></svg>'
            f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 {n + 8}px;text-align:center">'
            f'<div class="cardTitleSm" style="white-space:nowrap">{text}</div>{sub_el}</div></div>')


def outlet_line(img, text, color=PAPER, cls="flat", img_size=30, style=""):
    return (f'<div class="{cls}" style="display:flex;align-items:center;gap:8px;background:{color};border-radius:12px;padding:4px 10px 4px 6px;{style}">'
            f'<img src="{img}" alt="" aria-hidden="true" style="width:{img_size}px;height:{img_size}px;object-fit:contain;flex:none">'
            f'<div class="handT" style="min-width:0;line-height:18px">{text}</div></div>')


def chip(text, color=CREAM, cls="flat", style=""):
    return f'<span class="{cls}" style="display:inline-flex;align-items:center;gap:5px;background:{color};border-radius:999px;padding:2px 10px;border-width:1.5px;white-space:nowrap;{style}">{text}</span>'


# ── new pieces (round 4) ─────────────────────────────────────────────────────
def slate(inner, w, h, pad="8px 12px", cls="stickerSm", style=""):
    """A panel cut from the Big Board's own painted slate (the art as a cropped background), so the chalk
    reads as written on the same board. The crop stays inside the painted slate (art x 160..600, y 150..510)."""
    k = max(w / 440, h / 360, 0.9)
    bs = 768 * k
    return (f'<div class="{cls}" style="position:relative;width:{w}px;height:{h}px;border-radius:14px;overflow:hidden;box-sizing:border-box;padding:{pad};'
            f'background:{BARK} url({A["bigboard"]}) {-160 * k:.1f}px {-150 * k:.1f}px/{bs:.1f}px {bs:.1f}px no-repeat;{style}">{inner}</div>')


def pushpin(color=ROSEDEEP, size=18):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 20 20" aria-hidden="true" style="display:block">'
            f'<circle cx="11.6" cy="11.6" r="6.6" fill="{INK}"/>'
            f'<circle cx="9.4" cy="9.4" r="6.6" fill="{color}" stroke="{INK}" stroke-width="2"/>'
            f'<circle cx="7.3" cy="7.1" r="2" fill="{PAPER}" opacity=".85"/></svg>')


def tape_strip(w=56, rot=-4, style=""):
    return (f'<span aria-hidden="true" style="position:absolute;width:{w}px;height:18px;background:{TAPE};border:1.5px solid {TAPEEDGE};'
            f'box-sizing:border-box;opacity:.95;transform:rotate({rot}deg);{style}"></span>')


def pin_card(inner, w, rot=0.0, pin="rose", color=PAPER, href=None, aria=None, pad="12px 10px 8px 10px", style="", h=None):
    """A listing card pinned to the cork: paper, a hard small shadow, a slight tilt, a pushpin or tape."""
    if pin == "tape":
        top = tape_strip(56, -rot * 2 - 3, "top:-9px;left:50%;margin-left:-28px")
    elif pin:
        top = f'<span aria-hidden="true" style="position:absolute;top:-9px;left:50%;margin-left:-9px">{pushpin(ROSEDEEP if pin == "rose" else SUN)}</span>'
    else:
        top = ""
    tag = "a" if href else "div"
    attr = f' href="{href}"' if href else ""
    ar = f' aria-label="{aria}"' if aria else ""
    hs = f"height:{h}px;" if h else ""
    return (f'<{tag}{attr}{ar} class="stickerSm" style="position:relative;display:block;width:{w}px;{hs}background:{color};border-radius:6px;padding:{pad};'
            f'transform:rotate({rot}deg);color:{INK};box-sizing:border-box;border-width:1.5px;{style}">{top}{inner}</{tag}>')


def tagchip(text, bg=CREAM, style=""):
    """The price-tag chip: a paper tag with its string hole, the comparison written on it."""
    hole = f'<span aria-hidden="true" style="width:6px;height:6px;border-radius:999px;border:1.5px solid {INK};background:{PAPER};flex:none"></span>'
    return (f'<span class="flat" style="display:inline-flex;align-items:center;gap:5px;background:{bg};border-radius:4px 999px 999px 4px;'
            f'padding:0 9px 0 6px;border-width:1.5px;white-space:nowrap;{style}">{hole}<span class="kicker" style="line-height:18px">{text}</span></span>')


def vs(listing, p, unit="the price", style=""):
    """A listing against the price: '3 under the price', '2 over', 'at the price'."""
    d = round(listing - p)
    if d == 0:
        return tagchip(f"at {unit}", CREAM, style)
    if d < 0:
        return tagchip(f"{-d} under {unit}", SAGE, style)
    return tagchip(f"{d} over {unit}", SUN, style)


def gap_bar(lo, mid, hi, w=330, pad=3, pins=(), thumb=None, mid_lab="the price", lo_lab="Bullion buys", hi_lab="Bullion sells",
            gap_lab="where pigs trade", mid_note=""):
    """The yardstick, flat: Bullion's buying price, the price, Bullion's selling price, and the shaded gap
    between his two prices where pig-to-pig deals land. Pins mark listings or what pigs paid."""
    s0, s1 = lo - pad, hi + pad

    def X(v):
        return (v - s0) / (s1 - s0) * w
    ty = 34
    right = [v for v, _ in pins] + ([thumb] if thumb is not None else [])
    just = "flex-start" if right and min(right) > mid else "center"
    aria = f"{lo_lab} {lo}, {mid_lab} {fp(mid)}, {hi_lab} {hi}; the gap between is {gap_lab}"
    h = f'<div role="img" aria-label="{aria}" style="position:relative;width:{w}px;height:72px;flex:none">'
    h += f'<div aria-hidden="true" style="position:absolute;left:0;right:0;top:{ty - 1.5}px;height:3px;background:{INK};border-radius:2px"></div>'
    h += (f'<div aria-hidden="true" class="flat" style="position:absolute;left:{X(lo):.1f}px;width:{X(hi) - X(lo):.1f}px;top:{ty - 10}px;height:20px;background:{SAGE};border-radius:6px;border-width:1.5px;'
          f'display:flex;align-items:center;justify-content:{just};padding:0 7px;background-image:repeating-linear-gradient(-45deg,{rgba(SAGEINK, .22)} 0 3px,transparent 3px 8px)"><span class="kickerPillSm" style="font-size:9px;letter-spacing:1px;white-space:nowrap">{gap_lab}</span></div>')
    for v in (lo, hi):
        h += f'<div aria-hidden="true" style="position:absolute;left:{X(v) - 1.5:.1f}px;top:{ty - 14}px;width:3px;height:28px;background:{INK};border-radius:2px"></div>'
    # the price, above
    h += (f'<div aria-hidden="true" style="position:absolute;left:{X(mid):.1f}px;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center">'
          f'<span style="display:inline-flex;align-items:baseline;gap:4px;white-space:nowrap"><span class="kicker">{mid_lab}</span><span class="numeral">{fp(mid)}</span>{mid_note}</span>'
          f'<svg width="12" height="7" viewBox="0 0 12 7" style="margin-top:-1px"><path d="M1 1 L6 6 L11 1" fill="{INK}"/></svg></div>')
    # Bullion's two prices, below, anchored outward so the middle stays free for pins
    h += (f'<div aria-hidden="true" style="position:absolute;right:{w - X(lo) - 8:.1f}px;top:{ty + 12}px;white-space:nowrap;text-align:right">'
          f'<span class="kicker">{lo_lab}</span> <span class="numeral">{lo}</span></div>')
    h += (f'<div aria-hidden="true" style="position:absolute;left:{X(hi) - 8:.1f}px;top:{ty + 12}px;white-space:nowrap">'
          f'<span class="kicker">{hi_lab}</span> <span class="numeral">{hi}</span></div>')
    for v, lab in pins:
        h += f'<div aria-hidden="true" style="position:absolute;left:{X(v) - 8:.1f}px;top:{ty - 11}px">{pushpin(ROSEDEEP, 16)}</div>'
        if lab:
            h += f'<div aria-hidden="true" class="kicker" style="position:absolute;left:{X(v):.1f}px;top:{ty + 12}px;transform:translateX(-50%);white-space:nowrap">{lab}</div>'
    if thumb is not None:
        h += (f'<div aria-hidden="true" class="sticker" style="position:absolute;left:{X(thumb) - 19:.1f}px;top:{ty - 19}px;width:38px;height:38px;border-radius:999px;background:{SUN};'
              f'display:flex;align-items:center;justify-content:center;border-width:2.5px"><span class="numeral" style="font-size:17px">{fp(thumb)}</span></div>')
    return h + "</div>"


# ── the price, drawn: a seeded simulation of the spec's rules ─────────────────
def sim(n, start, events, seed, u=12.0, end=None, settle=8):
    """Every 30 minutes: a set bought at the counter pushes the price up 3% of the usual price, a set sold
    pulls it down 3%, a pig-to-pig sale moves it a third of the way to what was paid; a quiet tick wiggles
    it up to 1% of the usual price and drifts it 5% of the way home. Band 0.85 to 1.15 of usual."""
    rnd = random.Random(seed)
    p, out = start, [start]
    for t in range(1, n):
        e = events.get(t)
        if e in ("buy", "you"):
            p += 0.03 * u
        elif e in ("sell", "yous"):
            p -= 0.03 * u
        elif isinstance(e, tuple):
            p += (e[1] - p) / 3
        else:
            p += rnd.uniform(-0.01, 0.01) * u
            p += 0.05 * (u - p)
        p = min(1.15 * u, max(0.85 * u, p))
        out.append(p)
    if end is not None:  # land the quiet tail on the number the screen prints
        d = end - out[-1]
        for j in range(settle):
            i = n - settle + j
            if not events.get(i):
                out[i] += d * (j + 1) / settle
        out[-1] = end
    return out


DOT = {"buy": (SUN, "counter buy"), "sell": (ROSE, "counter sell"), "pig": (None, "pig sale")}


def pchart(series, w, h, events=None, u=12.0, lo=None, hi=None, band=False, xlabels=(), ext=None, quiet=None,
           notes=(), end_label=True, usual_label=True, label="The price of a set", target=None):
    """The price on slate, in chalk: the line, the usual price dashed, every trade a dot (counter buys sun,
    counter sells rose, pig sales a ring, yours big and labelled), quiet stretches bracketed."""
    events = events or {}
    n = len(series) + (1 if ext else 0)
    padL, padR, padT, padB = 8, 40, 20, (18 if xlabels else 6)
    vals = list(series) + ([ext[0]] if ext else []) + [u] + ([target[0]] if target else [])
    if band:
        vals += [u * 1.15, u * .85]
    lo = lo if lo is not None else min(vals) - .3
    hi = hi if hi is not None else max(vals) + .3

    def X(i):
        return padL + i * (w - padL - padR) / (n - 1)

    def Y(v):
        return padT + (hi - v) / (hi - lo) * (h - padT - padB)
    words = [f"{label}: from {fp(series[0])} to {fp(ext[0] if ext else series[-1])}"]
    s = f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="ARIA" style="display:block;overflow:visible">'
    if band:
        for v, t in ((u * 1.15, "top"), (u * .85, "floor")):
            s += f'<line x1="{padL}" y1="{Y(v):.1f}" x2="{w - padR + 6}" y2="{Y(v):.1f}" stroke="{BARKMUTE}" stroke-width="1.2" stroke-dasharray="1 4" stroke-linecap="round" opacity=".7"/>'
            s += f'<text x="{w - padR + 8}" y="{Y(v) + 4:.1f}" font-family="Patrick Hand, cursive" font-size="12" fill="{BARKMUTE}">{t} {fp(v)}</text>'
    s += f'<line x1="{padL}" y1="{Y(u):.1f}" x2="{w - padR + 6}" y2="{Y(u):.1f}" stroke="{BARKMUTE}" stroke-width="1.6" stroke-dasharray="6 5" opacity=".75"/>'
    if usual_label:  # on whichever side of the dashed line the price is not, at the left
        head = series[:max(2, len(series) // 6)]
        ly = Y(u) - 6 if sum(head) / len(head) < u else Y(u) + 14
        s += f'<text x="{padL + 2}" y="{ly:.1f}" font-family="Patrick Hand, cursive" font-size="13" fill="{BARKMUTE}">usual {fp(u)}</text>'
    if target:
        tv, tl = target
        s += f'<line x1="{padL}" y1="{Y(tv):.1f}" x2="{w - padR + 6}" y2="{Y(tv):.1f}" stroke="{SUN}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".9"/>'
        s += f'<text x="{padL + 2}" y="{Y(tv) - 5:.1f}" font-family="Patrick Hand, cursive" font-size="13" fill="{SUN}">{tl}</text>'
    if quiet:
        i0, i1, qt = quiet
        top = min(Y(v) for v in series[i0:i1 + 1]) - 10
        s += (f'<path d="M{X(i0):.1f} {top + 6:.1f} V{top:.1f} H{X(i1):.1f} V{top + 6:.1f}" fill="none" stroke="{BARKMUTE}" stroke-width="1.4" stroke-linecap="round"/>'
              f'<text x="{(X(i0) + X(i1)) / 2:.1f}" y="{top - 5:.1f}" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="13" fill="{BARKTEXT}">{qt}</text>')
    pts = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(series))
    s += f'<polyline points="{pts}" fill="none" stroke="{BARKTEXT}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>'
    for i, k in sorted(events.items()):
        if i >= len(series):
            continue
        x, y = X(i), Y(series[i])
        if k in ("you", "yous"):
            s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="{SUN if k == "you" else ROSE}" stroke="{INK}" stroke-width="2"/>'
            s += f'<text x="{x:.1f}" y="{y - 12:.1f}" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="14" fill="{SUN if k == "you" else ROSE}">you</text>'
        elif isinstance(k, tuple):
            s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.6" fill="{BARK}" stroke="{BARKTEXT}" stroke-width="2"/>'
        else:
            s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.4" fill="{DOT[k][0]}" stroke="{BARK}" stroke-width="1.2"/>'
    if ext:
        ev, et = ext
        x0, y0, x1, y1 = X(len(series) - 1), Y(series[-1]), X(n - 1), Y(ev)
        s += f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{SUN}" stroke-width="2.6" stroke-dasharray="4 4" stroke-linecap="round"/>'
        s += f'<circle cx="{x1:.1f}" cy="{y1:.1f}" r="7" fill="{BARK}" stroke="{SUN}" stroke-width="2.4" class="blink"/>'
        s += f'<text x="{x1 + 10:.1f}" y="{y1 + 5:.1f}" font-family="Caprasimo, serif" font-size="15" fill="{SUN}">{fp(ev)}</text>'
        if et:
            s += f'<text x="{x1 - 4:.1f}" y="{y1 - 13:.1f}" text-anchor="end" font-family="Patrick Hand, cursive" font-size="13" fill="{SUN}">{et}</text>'
    elif end_label:
        s += f'<text x="{X(len(series) - 1) + 9:.1f}" y="{Y(series[-1]) + 5:.1f}" font-family="Caprasimo, serif" font-size="15" fill="{SUN}">{fp(series[-1])}</text>'
    for i, dy, t, anchor in notes:
        v = series[min(int(i), len(series) - 1)]
        s += f'<text x="{X(i):.1f}" y="{Y(v) + dy:.1f}" text-anchor="{anchor}" font-family="Patrick Hand, cursive" font-size="13" fill="{BARKTEXT}">{t}</text>'
    for i, t in xlabels:
        anc = "start" if i == 0 else ("end" if i >= n - 1 else "middle")
        s += f'<text x="{X(i):.1f}" y="{h - 2}" text-anchor="{anc}" font-family="Patrick Hand, cursive" font-size="12" fill="{BARKMUTE}">{t}</text>'
    nb = sum(1 for k in events.values() if k == "buy")
    ns = sum(1 for k in events.values() if k == "sell")
    npg = sum(1 for k in events.values() if isinstance(k, tuple))
    if nb or ns or npg:
        words.append(f"{nb} sets bought at the counter, {ns} sold to it, {npg} pig-to-pig sales")
    return s.replace("ARIA", "; ".join(words), 1) + "</svg>"


def legend(kinds=("buy", "sell", "pig"), you=None):
    items = ""
    for k in kinds:
        c, t = DOT[k]
        dot = (f'<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="{3.6 if c else 3.4}" '
               f'fill="{c or BARK}" stroke="{BARKTEXT if not c else BARK}" stroke-width="{1.6 if not c else 1}"/></svg>')
        items += f'<span style="display:inline-flex;align-items:center;gap:3px;white-space:nowrap">{dot}<span class="chalk" style="font-size:11.5px;line-height:14px;color:{BARKMUTE}">{t}</span></span>'
    return f'<span style="display:inline-flex;gap:8px;flex-wrap:nowrap">{items}</span>'


def chart_panel(series, title, w=358, h=152, events=None, kinds=("buy", "sell", "pig"), **kw):
    head = (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;height:18px;overflow:hidden;white-space:nowrap;margin-bottom:2px">'
            f'<span class="chalk" style="font-size:13.5px;line-height:16px;color:{SUN}">{title}</span>{legend(kinds) if kinds else ""}</div>')
    return slate(head + pchart(series, w - 24, h - 38, events, **kw), w, h, pad="6px 10px")


# ── the tape: one tape for everything ────────────────────────────────────────
KIND = {"counter": ("counter", SUN), "pig": ("pig to pig", ROSE), "town": ("town", CREAM2), "swap": ("swap", LILAC)}


def tk(text, p=None, kind="counter"):
    lab, bg = KIND[kind]
    pr = f' &middot; {nm(p)}' if p is not None else ""
    return f'{text}{pr} <span class="tkTag" style="background:{bg}">{lab}</span>'


def ticker(items, hi=None, run=False, top=0, inline=False, w=390):
    seg = ""
    for i, t in enumerate(items):
        seg += f'<span class="tk{" tkHi" if i == hi else ""}">{t}</span><span class="sep" aria-hidden="true">&#10022;</span>'
    track = f'<div class="track{" run" if run else ""}">{seg}{seg if run else ""}</div>'
    pos = f"position:relative;left:auto;right:auto;width:{w}px;" if inline else f"top:{top}px;"
    return f'<div class="tape" role="marquee" aria-label="The tape: the latest trades" style="{pos}z-index:2">{track}</div>'


# ── scenery ──────────────────────────────────────────────────────────────────
def cork_area(x, y, w, h, frame=True, radius=0, cls=""):
    """The noticeboard itself: cork with its speckle, a wooden rail along the top."""
    fr = (f'<div aria-hidden="true" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:12px;background:{DIRT};border-top:2px solid {INK};border-bottom:2px solid {INK};box-sizing:border-box;z-index:1">'
          f'<div style="position:absolute;left:0;right:0;top:3px;height:2px;background:{DIRTDEEP};opacity:.6"></div></div>' if frame else "")
    return (f'<div aria-hidden="true" class="cork {cls}" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px;box-sizing:border-box"></div>' + fr)


def door(href, img, title, sub, bg, on, compact=False):
    cur = ' aria-current="page"' if on else ""
    cls = "sticker" if on else "stickerSm"
    bw = "border-width:3px;" if on else ""
    if compact:
        return (f'<a href="{href}"{cur} class="{cls}" style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;height:46px;border-radius:999px;background:{bg};padding:0 12px 0 6px;color:{INK};box-sizing:border-box;{bw}">'
                f'<img src="{img}" alt="" aria-hidden="true" style="width:36px;height:36px;object-fit:contain;flex:none">'
                f'<span class="cardTitleSm" style="white-space:nowrap">{title}</span></a>')
    return (f'<a href="{href}"{cur} class="{cls}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;height:112px;border-radius:18px;background:{bg};padding:2px 8px 6px 8px;color:{INK};box-sizing:border-box;{bw}">'
            f'<img src="{img}" alt="" aria-hidden="true" style="width:66px;height:66px;object-fit:contain;flex:none">'
            f'<span class="cardTitle" style="font-size:17px;line-height:20px;white-space:nowrap">{title}</span><span class="kicker" style="line-height:16px;white-space:nowrap">{sub}</span></a>')


def doors(active="counter", compact=False):
    c = door("C1.dc.html", A["bullion_counter"], "The Counter" if not compact else "Counter", "buy or sell right now",
             SUN if active == "counter" else PAPER, active == "counter", compact)
    nb = door("N1.dc.html", A["corkboard"], "The Noticeboard" if not compact else "Noticeboard", "trade with pigs &middot; 1 for you",
              SUN if active == "board" else PAPER, active == "board", compact)
    return f'<nav aria-label="The two halves of the market" style="display:flex;gap:12px;width:358px">{c}{nb}</nav>'


def toast(kicker, title, sub, color=SUN, rot=-1.2, img=None, big=""):
    im = (f'<img src="{img}" alt="" aria-hidden="true" style="width:58px;height:58px;object-fit:contain;flex:none;margin:-6px -2px -6px -6px">' if img else "")
    inner = (f'<div style="display:flex;align-items:center;gap:8px">{im}<div style="min-width:0">'
             f'<div class="kickerPillSm acc">&#9733; {kicker}</div><div class="cardTitle" style="line-height:21px">{title}</div>'
             + (f'<div class="numeralLg" style="line-height:30px">{big}</div>' if big else "") +
             f'<div class="handT" style="line-height:18px">{sub}</div></div></div>')
    return f'<div role="status">{sticker(inner, color, 18, rot, "sticker", pad="8px 12px")}</div>'


# ═════════════════════════════════════════════════════════════════════════════
# THE NUMBERS (one market day per row, consistent inside a row)
# Pinecones: a set of 4, usual 12. Price 12 now: Bullion sells 15, buys 9. One set bought: 12 -> 12.4.
# ═════════════════════════════════════════════════════════════════════════════
U = 12.0
# C2's last 24 hours (48 ticks of 30 minutes): two sets sold to the counter in the evening, a pig sale at
# 13 overnight, two bought in the morning, a pig sale at 13 at noon, one sold, then a quiet run home to 12.
EV_DAY = {5: "sell", 6: "sell", 14: ("pig", 13), 22: "buy", 23: "buy", 31: ("pig", 13), 37: "sell"}
DAY = sim(48, 11.6, EV_DAY, seed=4, end=12.0, settle=9)
XL_DAY = [(0, "4 pm"), (16, "midnight"), (32, "8 am"), (47, "now")]
# C4: your buy prints on the same chart
YOU_BUY = DAY + [DAY[-1] + 0.36]
EV_YOU = {**EV_DAY, 48: "you"}
# C5: two more sets bought after yours, then three quiet hours drifting home
AFT = sim(9, YOU_BUY[-1], {1: "buy", 2: "buy"}, seed=11, end=12.8, settle=6)
LATER = YOU_BUY + AFT[1:]
EV_LATER = {**EV_YOU, 49: "buy", 50: "buy"}
# O6 / O7: the newcomer sells their 4 to Bullion, then the price wanders home
O_SELL = DAY[-16:] + [DAY[-1] - 0.36]
EV_OSELL = {i - 32: k for i, k in EV_DAY.items() if i >= 32}
EV_OSELL[16] = "yous"
O_QUIET = O_SELL + sim(9, O_SELL[-1], {}, seed=80, end=11.8, settle=3)[1:]
# O3: a lesson in one picture: a push up, a pull down, a drift home
LESSON = sim(24, 12.0, {4: "buy", 5: "buy", 6: "buy", 9: "sell", 10: "sell"}, seed=8, end=12.15, settle=10)
EV_LESSON = {4: "buy", 5: "buy", 6: "buy", 9: "sell", 10: "sell"}

PRICE_NOW = 12.0
BS, BB = bsell(PRICE_NOW, 12), bbuy(PRICE_NOW, 12)      # 15, 9
assert (BS, BB) == (15, 9)
assert fp(YOU_BUY[-1]) == "12.4" and (bsell(12.36, 12), bbuy(12.36, 12)) == (15, 9)
assert (bsell(12.8, 12), bbuy(12.8, 12)) == (16, 10)
assert fp(O_SELL[-1]) == "11.6" and (bsell(11.64, 12), bbuy(11.64, 12)) == (14, 9)
assert (bsell(11.8, 12), bbuy(11.8, 12)) == (15, 9)
assert (bsell(25, 24), bbuy(25, 24)) == (30, 20)

# Today's board: price now, price yesterday (per set)
BOARD = [("river_pebble", 11.4, 11.8), ("blue_feather", 12.6, 12.2), ("clover", 13.1, 12.4), ("snail_shell", 11.8, 11.8),
         ("brass_button", 12.2, 12.5), ("wool_tuft", 10.9, 11.3), ("red_berries", 12.8, 12.1), ("pinecone", 12.0, 11.6),
         ("old_key", 25.0, 24.3), ("honeycomb", 23.1, 23.6), ("marble", 26.4, 25.2), ("tin_whistle", 63.0, 61.2)]
PX = {f: now for f, now, _ in BOARD}
for f, now, _y in BOARD:
    assert 0.85 * usual(f) <= now <= 1.15 * usual(f), f


def spark(fid, now, yest, w=62, h=18):
    if fid == "pinecone":
        pts = DAY[::4] + [DAY[-1]]
    else:
        rnd = random.Random(sum(map(ord, fid)))
        pts = [yest + (now - yest) * i / 11 + (rnd.uniform(-.012, .012) * usual(fid) if 0 < i < 11 else 0) for i in range(12)]
    lo, hi = min(pts), max(pts)
    rng = max(hi - lo, usual(fid) * .02)
    xy = [(2 + i * (w - 6) / (len(pts) - 1), 2 + (hi - v) / rng * (h - 4)) for i, v in enumerate(pts)]
    poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in xy)
    up = now >= yest
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true" style="display:block;overflow:visible">'
            f'<polyline points="{poly}" fill="none" stroke="{BARKTEXT}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>'
            f'<circle cx="{xy[-1][0]:.1f}" cy="{xy[-1][1]:.1f}" r="2.6" fill="{SUN if up else ROSE}"/></svg>')


def each_of(p, fid):
    return fp(p / nset(fid))


# ═════════════════════════════════════════════════════════════════════════════
# ROW 0 · One price, two ways to trade (one wide board)
# ═════════════════════════════════════════════════════════════════════════════
MW, MH = 1400, 760


def bullet(text, cls="handT", lh=19):
    return (f'<div style="display:flex;gap:7px;align-items:baseline"><span aria-hidden="true" style="width:6px;height:6px;border-radius:999px;background:{INK};flex:none;transform:translateY(-2px)"></span>'
            f'<span class="{cls}" style="line-height:{lh}px">{text}</span></div>')


def part_card(kicker, title, img, alt, strip, strip_bg, sub, bullets, rot, x):
    if strip_bg == "slate":
        st = slate(f'<div class="chalkNum" style="font-size:20px;line-height:26px;text-align:center">{strip}</div>', 284, 40, pad="6px 10px", cls="flat")
    else:
        st = (f'<div class="flat cork" style="height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;width:284px;box-sizing:border-box">'
              f'<span class="label" style="font-size:13px;background:{PAPER};border:1.5px solid {INK};border-radius:6px;padding:2px 10px;transform:rotate(-1deg)">{strip}</span></div>')
    inner = (f'<div class="kickerPill acc">&#9733; {kicker}</div><div class="sectionTitle" style="margin-top:2px">{title}</div>'
             f'<img src="{img}" alt="{alt}" style="display:block;width:196px;height:196px;object-fit:contain;margin:0 auto -2px auto">'
             f'{st}<div class="handLg" style="text-align:center;margin-top:4px">{sub}</div>'
             f'<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">{"".join(bullet(b) for b in bullets)}</div>')
    return ab(x, 150, sticker(inner, PAPER, 22, rot, "sticker", pad="12px 16px", style="height:404px"), w=320)


def arrow(x0, y0, x1, y1, dashed=False, cross=False, color=INK):
    da = ' stroke-dasharray="7 6"' if dashed else ""
    d = 1 if x1 > x0 else -1
    head = f'<path d="M{x1 - 12 * d} {y1 - 8} L{x1} {y1} L{x1 - 12 * d} {y1 + 8}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    cr = ""
    if cross:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        cr = f'<path d="M{cx - 9} {cy - 9} L{cx + 9} {cy + 9} M{cx + 9} {cy - 9} L{cx - 9} {cy + 9}" stroke="{ACCENT}" stroke-width="3.2" stroke-linecap="round"/>'
    return (f'<path d="M{x0} {y0} C {x0 + (x1 - x0) * .4} {y0 - 10}, {x0 + (x1 - x0) * .6} {y1 - 10}, {x1} {y1}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round"{da}/>'
            + ("" if dashed and cross else head) + cr)


def main_board():
    h = ab(32, 22, (f'<div class="kickerPill acc">&#9733; Round 4 &middot; how the two parts fit</div>'
                    f'<div class="displayLg" style="margin-top:2px">One price, two ways to trade</div>'
                    f'<div style="height:2px;width:96px;background:{INK};border-radius:2px;margin-top:8px"></div>'
                    f'<div class="handLg" style="margin-top:8px;max-width:820px">Every find has one price. Trade at it instantly at Bullion&#8217;s counter, where he takes a small cut, '
                    f'or directly with another pig: no cut, but you need a partner.</div>'), w=860)
    h += ab(924, 18, bull_say(A["bull_a"], f'<div class="handLg" style="line-height:21px">One price for every find. Trade with me right now, or with a pig for a better deal. '
                                           f'Either way, it moves the price!</div>', size=96, rot=1), w=444)
    # Part 1 and Part 2
    h += part_card("Part 1 &middot; instant", "The Counter", A["bullion_counter"], "Bullion behind his wooden counter, a bell and a basket",
                   f'sells {BS} &middot; buys {BB}', "slate", "instant &middot; his cut",
                   ["Bullion, always: buy or sell any set right now",
                    "sells a little over the price, buys a little under it",
                    "best for a quick sale, or a set you need now"], -0.6, 32)
    h += part_card("Part 2 &middot; direct", "The Noticeboard", A["corkboard"], "A cork noticeboard with cards pinned to it",
                   "pig to pig &middot; no cut &middot; needs a partner", "cork", "for sale &middot; wanted &middot; swaps &middot; to a friend",
                   ["every card wears a chip against the price",
                    "best for selling high and buying cheap",
                    "straight-up swaps, and offers to one friend"], 0.6, 1048)
    # the price, in the middle
    ch = chart_panel(DAY, "pinecones, a set of 4 &middot; last 24 hours", 456, 184, EV_DAY, band=True, xlabels=XL_DAY,
                     quiet=(38, 47, "quiet: wiggles, wanders home"))
    mid = (f'<div class="kickerPill acc" style="text-align:center">&#9733; The yardstick</div>'
           f'<div style="display:flex;align-items:baseline;justify-content:center;gap:10px;margin-top:2px"><span class="sectionTitle">One price per find</span>'
           f'<span class="handLg">pinecones</span>{price(12, "displayLg", 24, 4)}</div>'
           f'<div style="margin-top:8px">{ch}</div>'
           f'<div style="margin-top:12px;display:flex;justify-content:center">{gap_bar(9, 12, 15, 440, pins=((13, "13"), (14, "14")))}</div>'
           f'<div class="handT" style="text-align:center;line-height:18px;margin-top:2px">Listings settle in the gap: at {nm(9)} or under, Bullion buys at once; at {nm(15)} or over, it just sits.</div>')
    h += ab(472, 150, mid, w=456)
    tape = [tk("YOU BOUGHT 4 PINECONES", 15, "counter"), tk("MAYA PAID A PIG", 14, "pig"), tk("THE MILLER &middot; 4 PINECONES", 12, "town"),
            tk("A PIG SOLD 4 PINECONES", 9, "counter"), tk("4 PINECONES FOR 1 OLD KEY", None, "swap")]
    h += ab(472, 528, f'<div class="flat" style="border-radius:10px;overflow:hidden;width:456px">{ticker(tape, inline=True, w=452)}</div>'
                      f'<div class="kicker mute" style="text-align:center;margin-top:2px">one tape, one chart: counter trades, pig sales and the townsfolk print together</div>', w=456)
    # arrows: what moves the price
    svg = f'<svg width="{MW}" height="{MH}" viewBox="0 0 {MW} {MH}" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:2">'
    svg += arrow(358, 268, 470, 268) + arrow(358, 348, 470, 348)
    svg += arrow(1044, 268, 932, 268) + arrow(1044, 360, 932, 360, dashed=True, cross=True)
    svg += "</svg>"
    h += svg

    def lab(x, y, text, w=112, rot=0, color=PAPER):
        return ab(x, y, f'<div class="stickerSm" style="background:{color};border-radius:10px;padding:3px 7px;transform:rotate({rot}deg);border-width:1.5px">'
                        f'<div class="handT" style="line-height:16px;font-size:13px">{text}</div></div>', w=w, style="z-index:3")
    h += lab(358, 206, f'each set bought here: <b>up</b> 3% of usual', 112, -2, SUN)
    h += lab(358, 290, f'each set sold here: <b>down</b> 3%', 112, 1.5, ROSE)
    h += lab(932, 200, f'a pig sale: a third of the way to what was paid', 114, 2, PAPER)
    h += lab(932, 378, "swaps don&#8217;t move it", 112, -1.5, CREAM)
    # bottom band
    tog = (f'<div class="kickerPill acc">&#9733; How they work together</div>'
           f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin-top:6px">'
           + "".join(f'<div style="display:flex;gap:8px;align-items:flex-start"><span class="numeral" style="flex:none;width:16px">{i}</span><span class="handT" style="line-height:18px">{t}</span></div>'
                     for i, t in enumerate([
                         "The price is the yardstick: every card wears a chip against it, every swap shows both sides at it.",
                         "The counter is the safety net; the noticeboard is the better deal. Inside Bullion&#8217;s gap, both pigs beat his counter.",
                         "The counter keeps the board honest: listings settle inside the gap on their own.",
                         "One tape and one chart: every kind of trade prints on both."], 1))
           + '</div>')
    h += ab(32, 596, sticker(tog, CREAM, 20, -0.3, "sm", pad="10px 16px", style="height:146px"), w=652)
    why = (f'<div class="kickerPill acc">&#9733; Why prices differ between pigs: the outlets</div>'
           f'<div style="display:flex;gap:14px;margin-top:6px">'
           f'<div style="flex:1;display:flex;gap:6px;align-items:center">{gimg("ghost_sheep", 50)}<span class="handT" style="line-height:18px">Maya&#8217;s Ghost Sheep fancies pinecones today: {nm(24)} for 4.</span></div>'
           f'<div style="flex:1;display:flex;gap:6px;align-items:center"><span style="display:inline-flex;align-items:center">{gimg("g_gift", 40)}{face("biscuit", 30)}</span><span class="handT" style="line-height:18px">Biscuit hopes for a pinecone: hand one over and you both get {nm(3)}.</span></div></div>'
           f'<div class="handT" style="line-height:18px;margin-top:6px">So Maya pays you {nm(14)} while Bullion pays {nm(9)}. You&#8217;re up {nm(5)} on the counter; she&#8217;s up {nm(10)} on her Sheep. '
           f'<span class="mute">Later: Bullion&#8217;s orders and the Stamp Book.</span></div>')
    h += ab(716, 596, sticker(why, PAPER, 20, 0.3, "sm", pad="10px 16px", style="height:146px"), w=652)
    return page("0 One price, two ways to trade", f'<div class="root" style="width:{MW}px;height:{MH}px">{h}</div>', MW, MH)


# ═════════════════════════════════════════════════════════════════════════════
# ROW 1 · Part 1, the Counter
# Story: pinecones sit at 12 (Bullion sells 15, buys 9); your Ghost Sheep fancies pinecones today (24 for
# 4), so you buy a set at the counter: the price goes 12 -> 12.4. Two more sets go after yours; three
# quiet hours later the price has wandered back to 12.8.
# ═════════════════════════════════════════════════════════════════════════════
def board_rows():
    cols = "grid-template-columns:104px 46px 34px 58px 1fr"
    hdr = "".join(f'<span class="chalk" style="font-size:13px;line-height:16px;color:{SUN}{";text-align:right" if 0 < i < 4 else ""}">{t}</span>'
                  for i, t in enumerate(["find", "a set", "each", "since yday", "the last day"]))
    r = f'<div style="display:grid;{cols};gap:0 6px;align-items:end;padding:0 4px 4px 4px;border-bottom:1.5px dashed {rgba(BARKTEXT, .4)}">{hdr}</div>'
    for fid, now, yest in BOARD:
        d = round(now - yest, 1)
        mv, mvc = (("same", BARKMUTE) if abs(d) < .05 else ((f"up {fp(d)}", SUN) if d > 0 else (f"down {fp(-d)}", ROSE)))
        cells = (f'<span style="display:flex;align-items:center;gap:4px;min-width:0">{glyph(fid, 20)}<span class="chalk clip" style="font-size:15px">{SHORT[fid]}</span></span>'
                 f'<span class="chalkNum" style="font-size:15px;text-align:right">{fp(now)}</span>'
                 f'<span class="chalk" style="font-size:13px;text-align:right;color:{BARKMUTE}">{each_of(now, fid)}</span>'
                 f'<span class="chalk" style="font-size:14px;text-align:right;color:{mvc}">{mv}</span>'
                 f'<span style="display:flex;justify-content:flex-end">{spark(fid, now, yest)}</span>')
        st = f"display:grid;{cols};gap:0 6px;align-items:center;height:30px;padding:0 4px;color:{BARKTEXT}"
        if fid == "pinecone":
            r += (f'<a href="C2.dc.html" aria-label="Pinecones: {fp(now)} a set of 4, 3 each, up 0.4 since yesterday" style="position:relative;{st}">{cells}'
                  f'<span aria-hidden="true" style="position:absolute;left:-4px;right:-4px;top:1px;bottom:1px;border:2px solid {SUN};border-radius:999px;transform:rotate(-.8deg)"></span></a>')
        else:
            r += f'<div style="{st}">{cells}</div>'
    return r


def c1_scene():
    h = ab(16, 12, crown("BULLION&#8217;S MARKET", "The Market"))
    h += corner_coin(18, size=56, top=8)
    h += ab(16, 80, doors("counter"))
    h += ab(2, 198, f'<img src="{A["bullion_counter"]}" alt="Bullion behind his counter, the bell on one side and a basket on the other" style="width:160px;height:160px;object-fit:contain">')
    h += ab(164, 206, sticker(f'<div class="handT" style="line-height:18px">Buy or sell any set, any time. Pinecones are up a touch today!</div>', PAPER, 16, -1.5, "sm", pad="6px 10px"), w=208)
    h += ab(170, 282, slate(f'<div class="chalk" style="font-size:14px;line-height:17px">I sell a little over the price,<br>I buy a little under it.</div>', 200, 54, pad="7px 12px", cls="flat"))
    board = (f'<div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 4px 4px 4px">'
             f'<span class="chalkNum" style="font-size:18px;line-height:22px">Today&#8217;s prices</span><span class="chalk" style="font-size:13px;color:{BARKMUTE}">per set &middot; tap one</span></div>'
             + board_rows()
             + f'<div class="chalk" style="font-size:13px;line-height:16px;color:{BARKMUTE};padding:4px 4px 0 4px">a set is 4 of a common, 3 of anything else</div>')
    h += ab(14, 362, slate(board, 362, 470, pad="8px 10px"))
    return h


def c1():
    return page("C1 The market home", f'<div class="root">{c1_scene()}</div>')


def find_head(p, sub, subc=SUCCESS):
    return (f'<div style="display:flex;align-items:center;gap:10px;width:358px">{basket("pinecone", 86, style="margin:-6px 0 -6px -6px")}'
            f'<div style="min-width:0"><div class="kickerPill acc">&#9733; A SET OF 4</div><div class="pageTitle">Pinecones</div>'
            f'<div style="display:flex;align-items:baseline;gap:6px"><span class="handT">the price</span>{price(fp(p), "displayLg", 20, 4)}<span class="kicker mute">{fp(p / 4)} each</span></div>'
            f'<div class="label" style="color:{subc}">{sub}</div></div></div>')


def bull_prices(bs, bb, p, w=358, note="", pins=(), rot=-0.4):
    top = (f'<div style="display:flex;align-items:center;gap:6px">'
           f'<img src="{A["bull_a"]}" alt="Bullion" style="width:50px;height:50px;object-fit:contain;flex:none;margin:-6px 0 -6px -6px">'
           f'<div style="flex:1;min-width:0"><div class="handT" style="line-height:16px">I&#8217;ll sell you 4 for</div>{price(bs, "numeralLg", 18)}</div>'
           f'<div aria-hidden="true" style="align-self:stretch;border-left:2px dashed {CREAM2}"></div>'
           f'<div style="flex:1;min-width:0;padding-left:4px"><div class="handT" style="line-height:16px">I&#8217;ll buy 4 for</div>{price(bb, "numeralLg", 18)}</div></div>')
    bar = f'<div style="margin-top:4px">{gap_bar(bb, p, bs, w=w - 28, pins=pins)}</div>'
    return sticker(top + bar + note, PAPER, 18, rot, "sm", pad="8px 12px", style=f"width:{w}px")


TAPE_C2 = [tk("A PIG BOUGHT 4 PINECONES", 15, "counter"), tk("OLD MRS HEDGE &middot; 4 PINECONES", 12, "town"),
           tk("BISCUIT BOUGHT 4 PINECONES", 13, "pig"), tk("A PIG SOLD 4 PINECONES", 9, "counter"), tk("THE TINKER &middot; 4 PINECONES", 12, "town")]


def c2_scene():
    h = back_link("The Market", "C1.dc.html")
    h += corner_coin(18, size=56, top=8)
    h += ab(16, 66, find_head(PRICE_NOW, "usual 12 &middot; up 0.4 since yesterday"))
    h += ab(16, 166, chart_panel(DAY, "last 24 hours", 358, 152, EV_DAY, xlabels=XL_DAY))
    h += ab(16, 328, bull_prices(BS, BB, PRICE_NOW))
    hold = (f'<div class="flat" style="display:flex;align-items:center;gap:8px;background:{CREAM};border-radius:12px;padding:3px 10px 3px 6px;border-width:1.5px">'
            f'{cluster("pinecone", 20)}<span class="handT" style="flex:1">You hold 4 pinecones: one set</span><span class="kicker mute">18 tickles ready</span></div>')
    h += ab(16, 480, hold, w=358)
    h += ab(16, 522, outlet_line(A["ghost_sheep"], f"Your Ghost Sheep fancies pinecones today: he pays {nm(6)} each, {nm(24)} for 4.", PAPER, "flat", 30, "border-width:1.5px"), w=358)
    nudge = (f'<a href="N1.dc.html" class="stickerSm cork" style="display:flex;align-items:center;gap:8px;border-radius:12px;padding:5px 8px;color:{INK};border-width:1.5px">'
             f'<span class="stickerSm" style="display:flex;align-items:center;gap:6px;background:{PAPER};border-radius:6px;padding:3px 8px;transform:rotate(-1.5deg);border-width:1.5px;flex:1;min-width:0">'
             f'{face("maya", 22)}<span class="handT clip">Cheaper on the noticeboard: Maya&#8217;s 4 for {nm(13)}</span></span>'
             f'<span class="label" style="flex:none">Look &rsaquo;</span></a>')
    h += ab(16, 570, nudge, w=358)
    h += ticker(TAPE_C2, run=True, top=628)
    h += ab(16, 676, f'<div style="display:flex;gap:10px;width:358px">'
                     + ticket(str(BS), "tickles", "Buy 4 for", "C3.dc.html", "golden", aria=f"Buy 4 pinecones for {BS} tickles", style="flex:1;min-width:0", h=60)
                     + ticket(str(BB), "tickles", "Sell 4 for", "T2.dc.html", "paper", aria=f"Sell 4 pinecones for {BB} tickles", style="flex:1;min-width:0", h=60)
                     + '</div>')
    h += ab(16, 750, hand_line("Bullion&#8217;s cut: he sells a little over the price and buys a little under it. Buying pushes the price up; selling pulls it down.", "kicker mute"), w=358)
    return h


def c2():
    return page("C2 Pinecones at the counter", f'<div class="root">{c2_scene()}</div>')


def c3():
    tail = DAY[-14:]
    ev = {i - 34: k for i, k in EV_DAY.items() if i >= 34}
    body = (f'<div style="display:flex;align-items:center;gap:12px">{basket("pinecone", 80, style="margin:-6px 0 -8px -6px")}'
            f'<div style="min-width:0"><div class="cardTitle">4 pinecones, from Bullion&#8217;s counter</div>'
            f'<div class="handT mute">right now &middot; you&#8217;ll hold 8: two sets</div></div></div>'
            + sticker(f'<div class="cardTitle" style="line-height:23px">Buy for {nm(BS)}.<br>The price goes {move(12, "12.4")}.</div>'
                      f'<div class="handT" style="line-height:18px">Every set bought from Bullion pushes the price up a little.</div>', SUN, 14, -0.5, "sm", pad="8px 12px")
            + chart_panel(tail, "the last 7 hours", 358, 132, ev, kinds=("buy", "sell", "pig"),
                          ext=(tail[-1] + .36, "your buy"), xlabels=[(0, "9 am"), (13, "now")])
            + f'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
              f'<div style="display:flex;align-items:center;gap:10px">{coin(18, size=54, label="now")}<span class="handLg mute" aria-hidden="true">&rarr;</span>{coin(3, size=54, label="after")}</div>'
              f'<div class="handT" style="line-height:18px;text-align:right;max-width:150px">after this, Bullion still sells at {nm(15)} and buys at {nm(9)}</div></div>')
    return page("C3 Confirm: buy 4 pinecones", '<div class="root">' + sheet("PINECONES · A SET OF 4", "Buy 4 pinecones for 15", body,
                ticket(str(BS), "tickles", "Confirm: buy for", "C4.dc.html", aria=f"Confirm: buy 4 pinecones for {BS} tickles"),
                top=128, scene=c2_scene(), close_href="C2.dc.html") + '</div>')


def c4():
    h = back_link("The Market", "C1.dc.html")
    h += corner_coin(3, size=56, top=8)
    h += ab(-6, 60, f'<img src="{A["bull_cheer"]}" alt="Bullion cheering, hooves up" style="width:170px;height:170px;object-fit:contain">')
    h += ab(140, 64, f'<img class="ding" src="{A["g_bell"]}" alt="" aria-hidden="true" style="width:48px;height:48px;object-fit:contain">')
    h += ab(184, 76, sticker('<div class="whimsy" style="font-size:46px;line-height:50px;text-align:center">Bought!</div>', SUN, 20, -4, "sticker", pad="2px 12px"), w=180)
    h += ab(176, 152, sticker('<div class="handLg" style="line-height:20px">Ding! Four fine pinecones for a fine pig.</div>', PAPER, 16, 1.5, "sm", pad="6px 10px"), w=196)
    card = (f'<div style="display:flex;align-items:center;gap:10px">{basket("pinecone", 78, style="margin:-6px 0 -8px -6px")}'
            f'<div style="flex:1;min-width:0"><div class="cardTitle">You bought 4 pinecones.</div>'
            f'<div class="handT">from Bullion&#8217;s counter, for {nm(15)}</div></div></div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:2px dashed {INK}">'
            f'<span class="kicker">tickles ready</span><span style="display:inline-flex;align-items:center;gap:6px"><span class="numeral">18</span><span class="handT" aria-hidden="true">&rarr;</span><span class="numeral">3</span>{coin_mark(16)}</span>'
            f'<span class="kicker">you hold 8: two sets</span></div>')
    h += ab(14, 240, sticker(card, PAPER, 20, -0.5, "sticker", pad="10px 14px"), w=362)
    h += ab(14, 380, toast("first time", "You moved the price!", "Every set bought from Bullion pushes it up a little. It wanders home when it&#8217;s quiet.", ROSE, 1, A["bull_a"], move(12, "12.4", "numeralLg")), w=362)
    h += ab(16, 512, chart_panel(YOU_BUY[-20:], "with your dot", 358, 140, {i - 29: k for i, k in EV_YOU.items() if i >= 29}, xlabels=[(0, "7 am"), (19, "now")]))
    h += ab(16, 664, outlet_line(A["ghost_sheep"], f"Your Ghost Sheep is at the hedge till 6 pm. He pays {nm(24)} for these 4: you&#8217;re up {nm(9)}.", CREAM, "flat", 30, "border-width:1.5px"), w=358)
    h += ab(16, 770, f'<div style="display:flex;gap:10px;width:358px">{pill_btn("Back to the market", "C1.dc.html", CREAM, "sm", "flex:1")}{pill_btn("Pinecones, 3 hours on", "C5.dc.html", PAPER, "sm", "flex:1")}</div>')
    return page("C4 Bought: you moved the price", f'<div class="root">{h}</div>')


TAPE_C5 = [tk("THE MILLER BOUGHT 4 PINECONES", 13, "town"), tk("OLD MRS HEDGE SOLD 4 PINECONES", 12.8, "town"),
           tk("FARMER BRAMBLE BOUGHT 4 PINECONES", 12.9, "town"), tk("THE POSTMISTRESS SOLD 4 PINECONES", 12.8, "town")]


def c5():
    h = back_link("The Market", "C1.dc.html")
    h += corner_coin(6, size=56, top=8)
    h += ab(16, 66, find_head(12.8, "usual 12 &middot; drifting home", MUTE))
    q = (f'<div style="display:flex;align-items:center;gap:8px"><img src="{A["bull_shrug"]}" alt="" aria-hidden="true" style="width:44px;height:44px;object-fit:contain;flex:none;margin:-6px 0 -6px -4px">'
         f'<div class="handT" style="line-height:18px">No one&#8217;s traded pinecones for 3 hours: drifting back toward {nm(12)}.</div></div>')
    h += ab(16, 166, sticker(q, CREAM, 14, -0.6, "flat", pad="4px 10px", style="border-width:1.5px"), w=358)
    win = LATER[-20:]
    ev = {i - (len(LATER) - 20): k for i, k in EV_LATER.items() if i >= len(LATER) - 20}
    h += ab(16, 222, chart_panel(win, "this afternoon", 358, 178, ev, xlabels=[(0, "11 am"), (8, "1 pm"), (19, "4 pm")],
                                 quiet=(13, 19, "quiet 3 hours")))
    h += ab(16, 412, bull_prices(16, 10, 12.8, note=f'<div class="handT" style="line-height:17px;margin-top:2px">My prices follow the price: {nm(16)} and {nm(10)} while it&#8217;s high.</div>'))
    h += ticker(TAPE_C5, run=True, top=586)
    h += ab(16, 626, hand_line("only the townsfolk today: their small trades are the wiggle", "kicker mute"), w=358)
    hold = (f'<div class="flat" style="display:flex;align-items:center;gap:8px;background:{CREAM};border-radius:12px;padding:3px 10px 3px 6px;border-width:1.5px">'
            f'{cluster("pinecone", 20)}<span class="handT" style="flex:1">You hold 8 pinecones: two sets</span><span class="kicker mute">6 tickles ready</span></div>')
    h += ab(16, 656, hold, w=358)
    h += ab(16, 704, f'<div style="display:flex;gap:10px;width:358px">'
                     + ticket("16", "tickles", "Buy 4 for", None, "golden", aria="Buy 4 pinecones for 16 tickles", style="flex:1;min-width:0", h=60)
                     + ticket("10", "tickles", "Sell 4 for", None, "paper", aria="Sell 4 pinecones for 10 tickles", style="flex:1;min-width:0", h=60)
                     + '</div>')
    h += ab(16, 778, hand_line("a rush of buyers settles back over a day or two", "kicker mute"), w=358)
    return page("C5 A quiet afternoon", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# ROW 2 · Part 2, the Noticeboard
# Story: pinecones at 12 (Bullion buys 9, sells 15). You pin your 4 pinecones at 14; Maya, whose Ghost
# Sheep fancies pinecones (24 for 4), takes them: +5 on Bullion's 9, and the price nudges a third of the
# way toward 14 (12 -> 12.7). Old keys sit at 25 (Bullion 30 / 20): Maya offers you 3 for 22.
# ═════════════════════════════════════════════════════════════════════════════
def who_row(who, name, right=""):
    return (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
            f'<span style="display:inline-flex;align-items:center;gap:4px;min-width:0">{face(who, 20, 1.2)}<span class="kickerPillSm clip">{name}</span></span>{right}</div>')


def listing(who, name, fid, n, pr, p, verb=None, w=170, rot=0.0, pin="rose", href=None, color=PAPER, extra=""):
    right = price(pr, "numeral", 14, style="font-size:18px")
    if verb:
        right = f'<span style="display:inline-flex;align-items:baseline;gap:3px"><span class="kicker">{verb}</span>{price(pr, "numeral", 14, style="font-size:18px")}</span>'
    inner = (who_row(who, name, right)
             + f'<div style="display:flex;align-items:center;gap:6px;margin-top:2px;height:30px">{cluster(fid, 22, n)}<span class="handT clip" style="line-height:16px">{n} {PL[fid]}</span></div>'
             + f'<div style="margin-top:3px;display:flex;align-items:center;gap:4px">{vs(pr, p)}{extra}</div>')
    aria = f"{name}: {n} {PL[fid]} for {pr}"
    return pin_card(inner, w, rot, pin, color, href, aria if href else None, pad="10px 8px 7px 8px", style="height:100px")


def swap_listing(who, name, gfid, gn, wfid, wn, gv, wv, w=170, rot=0.0, pin="rose", href=None, words=True):
    inner = (who_row(who, name, f'<span class="kickerPillSm acc">swap</span>')
             + f'<div style="display:flex;align-items:center;gap:4px;margin-top:2px;height:30px">{cluster(gfid, 20, gn)}{swap_mark(18)}{cluster(wfid, 22, wn)}'
               + (f'<span class="handT clip" style="line-height:15px;font-size:13px">{gn} for {wn}</span>' if words else "") + '</div>'
             + f'<div style="margin-top:3px">{tagchip(f"&#8776; {gv} &middot; &#8776; {wv}", CREAM)}</div>')
    aria = f"{name}: {gn} {PL[gfid]} for {wn} {NAMES[wfid] if wn == 1 else PL[wfid]}"
    return pin_card(inner, w, rot, pin, PAPER, href, aria if href else None, pad="10px 8px 7px 8px", style="height:100px")


def board_label(t, hint=""):
    return (f'<div style="display:flex;align-items:center;justify-content:space-between;width:358px">'
            f'<span style="position:relative;display:inline-block;background:{TAPE};border:1.5px solid {TAPEEDGE};padding:1px 12px;transform:rotate(-1.5deg)">'
            f'<span class="cardTitleSm">{t}</span></span>'
            f'<span class="kicker" style="background:{rgba(PAPER, .75)};border-radius:6px;padding:0 6px">{hint}</span></div>')


def n1_scene():
    h = ab(16, 12, crown("BULLION&#8217;S MARKET", "The Noticeboard"))
    h += corner_coin(18, size=52, top=8)
    h += ab(16, 76, doors("board", compact=True))
    h += cork_area(0, 132, 390, 712)
    secs = [
        ("For sale", "chips: against the price",
         listing("biscuit", "Biscuit", "red_berries", 4, 12, PX["red_berries"], rot=-1.5)
         + listing("pig", "a pig", "old_key", 3, 23, PX["old_key"], rot=1.2, pin="tape")),
        ("Wanted", "paid when a pig fills it",
         listing("pig", "a pig", "marble", 3, 25, PX["marble"], verb="pays", rot=1, pin="sun")
         + listing("biscuit", "Biscuit", "clover", 4, 14, PX["clover"], verb="pays", rot=-1.2)),
        ("Swaps", "straight up, no tickles",
         swap_listing("pig", "a pig", "pinecone", 4, "old_key", 1, 12, 8, rot=-1, href="N3.dc.html")
         + swap_listing("biscuit", "Biscuit", "honeycomb", 3, "tin_whistle", 1, 23, 21, rot=1.4, pin="tape")),
        ("For you", "just for you &middot; yours",
         listing("maya", "Maya", "old_key", 3, 22, PX["old_key"], rot=1.2, href="N4.dc.html", color=ROSE)
         + listing("you", "yours &middot; 23h", "river_pebble", 4, 11, PX["river_pebble"], rot=-1, pin="sun", color=CREAM)),
    ]
    y = 150
    for t, hint, cards in secs:
        h += ab(16, y, board_label(t, hint))
        h += ab(16, y + 34, f'<div style="display:flex;justify-content:space-between;width:358px">{cards}</div>')
        y += 146
    h += ab(16, 740, pill_btn("Post a listing", "N2.dc.html", SUN, "sticker", "width:100%;min-height:52px", fs=15), w=358)
    h += ab(16, 800, f'<div class="kicker" style="text-align:center;background:{rgba(PAPER, .8)};border-radius:8px;padding:1px 6px">4 up at a time &middot; 24 hours each &middot; friends named, other pigs are &#8220;a pig&#8221;</div>', w=358)
    return h


def n1():
    return page("N1 The noticeboard", f'<div class="root">{n1_scene()}</div>')


def bag_set(fid, sub, on):
    return (f'<button type="button" class="{"sticker" if on else "stickerSm"} btn" aria-pressed="{"true" if on else "false"}" '
            f'style="flex:1;min-width:0;border-radius:14px;background:{SUN if on else PAPER};{"border-width:3px;" if on else ""}display:flex;flex-direction:column;align-items:center;padding:0 0 4px 0">'
            f'{basket(fid, 60)}<span class="kicker" style="margin-top:-6px;white-space:nowrap">{sub}</span></button>')


SUG = '<span class="kicker mute">&middot; suggested</span>'


def n2():
    warn = (f'<div class="dashed" style="border-radius:12px;padding:6px 10px;background:{CREAM};border-width:1.5px">'
            f'<div class="kickerPillSm mute">drag to 9 or under and you&#8217;ll see</div>'
            f'<div style="display:flex;align-items:center;gap:8px;margin-top:2px"><img src="{A["bull_shrug"]}" alt="" aria-hidden="true" style="width:40px;height:40px;object-fit:contain;flex:none">'
            f'<div class="handT" style="flex:1;line-height:17px">Bullion pays {nm(9)} right now: sell to him instead?</div>'
            f'{pill_btn("Sell to him", None, PAPER, "flat", fs=12, style="padding:0 10px")}</div></div>')
    body = (segmented(["For sale", "Wanted", "Swap"], "For sale")
            + f'<div style="display:flex;gap:8px">{bag_set("pinecone", "4 pinecones", True)}{bag_set("river_pebble", "4 pebbles", False)}{bag_set("old_key", "3 old keys", False)}</div>'
            + f'<div style="display:flex;align-items:center;gap:8px"><span class="cardTitleSm" style="flex:none">Who sees it</span>{segmented(["Every pig", "Just Maya"], "Every pig", 12)}</div>'
            + f'<div style="display:flex;align-items:center;justify-content:space-between"><span class="cardTitleSm">Your price</span>'
              f'<span style="display:inline-flex;align-items:center;gap:6px">{price(14, "numeralLg", 20)}{vs(14, 12)}</span></div>'
            + f'<div style="padding-top:4px">{gap_bar(9, 12, 15, 358, thumb=14, mid_note=SUG)}</div>'
            + hand_line(f"pigs will see it {nm(1)} under Bullion&#8217;s price, {nm(2)} over the price", "handT", style="margin-top:-6px")
            + warn)
    return page("N2 Post a listing", '<div class="root">' + sheet("THE NOTICEBOARD", "Post a listing", body,
                ticket("14", "tickles", "Pin it for", "N5.dc.html", aria="Pin 4 pinecones to the noticeboard for 14 tickles"),
                top=96, scene=n1_scene(), close_href="N1.dc.html") + '</div>')


def n3():
    h = cork_area(0, 70, 390, 774)
    h += back_link("The Noticeboard", "N1.dc.html")
    h += corner_coin(18, size=52, top=8)
    vis = (f'<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:4px 0 0 0">{basket("pinecone", 112)}{swap_mark(44)}'
           f'<div class="stickerSm" style="width:86px;height:86px;border-radius:16px;background:{CREAM};display:flex;align-items:center;justify-content:center;transform:rotate(3deg)">{glyph("old_key", 64)}</div></div>')
    card = (f'<div style="display:flex;align-items:center;justify-content:space-between"><span class="kickerPill acc">&#9733; swap &middot; straight up</span>'
            f'<span style="display:inline-flex;align-items:center;gap:5px">{face("pig", 22)}<span class="kicker">a pig &middot; pinned 2h ago</span></span></div>'
            + vis
            + f'<div class="sectionTitle" style="text-align:center;margin-top:2px">4 pinecones for 1 old key</div>'
            + f'<div style="display:flex;justify-content:center;gap:8px;margin-top:8px">{tagchip(f"4 pinecones &#8776; {nm(12)}", CREAM)}{tagchip(f"1 old key &#8776; {nm(8)}", CREAM)}</div>'
            + f'<div class="kicker mute" style="text-align:center;margin-top:4px">both sides at today&#8217;s price: pinecones {nm(12)} a set, old keys {nm(25)} a set</div>')
    h += ab(22, 98, pin_card(card, 346, -1.2, "rose", PAPER, pad="16px 14px 12px 14px"))
    side = (f'<div class="cardTitle">If you take it</div>'
            f'<div style="display:grid;grid-template-columns:70px 1fr auto;align-items:center;gap:4px 8px;margin-top:6px">'
            f'<span class="kicker">you give</span><span style="display:inline-flex;align-items:center;gap:6px">{glyph("old_key", 24)}<span class="handT">1 old key</span></span><span class="numeral">&#8776; 8</span>'
            f'<span class="kicker">you get</span><span style="display:inline-flex;align-items:center;gap:6px">{cluster("pinecone", 20)}<span class="handT">4 pinecones</span></span><span class="numeral">&#8776; 12</span></div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:2px dashed {CREAM2}">'
            f'<span class="label" style="color:{SUCCESS};font-size:14px">you&#8217;d get 4 more than you give</span><span class="kicker mute">you hold 1 old key</span></div>')
    h += ab(14, 410, sticker(side, PAPER, 18, 0.4, "sticker", pad="10px 14px"), w=362)
    h += ab(14, 574, outlet_line(A["ghost_sheep"], f"Why would a pig? Their Ghost Sheep fancies old keys today: {nm(16)} for one. Worth more to them than to you.", PAPER, "stickerSm", 32), w=362)
    h += ab(14, 642, hand_line("Swaps don&#8217;t move the price. Both sides move at once; nothing is made.", "kicker", style=f"background:{rgba(PAPER, .8)};border-radius:8px;padding:1px 6px"), w=362)
    h += ab(14, 736, f'<div style="display:flex;gap:10px;width:362px">{pill_btn("Take it", "N1.dc.html", SUN, "sticker", "flex:1.3;min-height:56px", fs=15)}'
                     f'{pill_btn("Counter-offer", "N2.dc.html", CREAM, "sm", "flex:1;min-height:56px", fs=14)}</div>')
    return page("N3 A swap, up close", f'<div class="root">{h}</div>')


def inbox_row(lead, title, sub, color=PAPER, cls="flat", href=None):
    tag = "a" if href else "div"
    attr = f' href="{href}"' if href else ""
    return (f'<{tag}{attr} class="{cls}" style="display:flex;align-items:center;gap:10px;background:{color};border-radius:14px;padding:6px 10px;color:{INK};min-height:56px;box-sizing:border-box">'
            f'{lead}<div style="min-width:0;flex:1"><div class="cardTitleSm" style="line-height:19px">{title}</div><div class="kicker mute clip">{sub}</div></div></{tag}>')


def n4():
    h = ab(16, 12, crown("YOUR INBOX", "Inbox"))
    h += corner_coin(18, size=52, top=8)
    rows = (inbox_row(face("maya", 38), f"Maya offers you 3 old keys for {nm(22)}", "3 under the price &middot; just for you &middot; 23h left", SUN, "sticker")
            + inbox_row(face("biscuit", 38), "Biscuit tickled Rosie 3 times", "this morning", PAPER)
            + inbox_row(gimg("g_bell", 36), "Your 4 river pebbles are pinned", "the noticeboard &middot; 23h left", PAPER))
    h += ab(14, 82, f'<div style="display:flex;flex-direction:column;gap:8px;width:362px">{rows}</div>')
    h += cork_area(14, 292, 362, 268, frame=False, radius=16, cls="stickerSm")
    card = (f'<div style="display:flex;align-items:center;justify-content:space-between">'
            f'<span style="display:inline-flex;align-items:center;gap:6px">{face("maya", 28)}<span class="cardTitleSm">Maya</span></span>'
            f'{chip("<span class=kickerPillSm>just for you</span>", LILAC, "flat")}</div>'
            f'<div style="display:flex;align-items:center;gap:10px;margin-top:4px">{basket("old_key", 84, style="margin:-6px 0 -8px -6px")}'
            f'<div style="min-width:0"><div class="cardTitle">3 old keys</div>{price(22, "numeralLg", 20)}<div style="margin-top:2px">{vs(22, 25)}</div></div></div>'
            f'<div class="handT" style="line-height:18px;margin-top:4px;padding-top:4px;border-top:2px dashed {CREAM2}">Bullion sells 3 for {nm(30)}: you&#8217;d save {nm(8)}.</div>')
    h += ab(34, 314, pin_card(card, 322, -1, "rose", PAPER, pad="14px 14px 10px 14px"))
    h += ab(14, 574, sticker(f'<div style="display:flex;align-items:center;gap:10px">{face("maya", 34)}<div class="handT" style="line-height:18px">'
                             f'Maya&#8217;s side: Bullion would pay her {nm(20)}. You pay {nm(22)}. You both beat his counter.</div></div>', CREAM, 14, 0, "flat", pad="6px 10px"), w=362)
    visit = (f'<div style="display:flex;align-items:center;gap:8px">'
             f'<div style="position:relative;width:96px;height:62px;flex:none;border-radius:10px;overflow:hidden;background:{SAGE};border:1.5px solid {INK};box-sizing:border-box">'
             f'<img src="{A["pepper"]}" alt="" aria-hidden="true" style="position:absolute;left:-2px;top:2px;width:62px;height:62px;object-fit:contain">'
             f'<div style="position:absolute;right:6px;top:10px;width:30px;height:34px;background:{ROSE};border:1.5px solid {INK};border-radius:3px;transform:rotate(4deg);box-sizing:border-box"></div>'
             f'<div style="position:absolute;right:16px;top:5px">{pushpin(ROSEDEEP, 12)}</div></div>'
             f'<div class="handT" style="line-height:18px">Visit Maya&#8217;s Barn and the same card is pinned by her door.</div></div>')
    h += ab(14, 646, sticker(visit, PAPER, 14, -0.4, "flat", pad="6px 10px", style="border-width:1.5px"), w=362)
    h += ab(14, 740, f'<div style="display:flex;gap:10px;width:362px">'
                     + ticket("22", "tickles", "Accept for", "N1.dc.html", aria="Accept Maya's 3 old keys for 22 tickles", style="flex:1.4;min-width:0", h=60)
                     + pill_btn("Not now", "N1.dc.html", CREAM, "sm", "flex:1;min-height:60px", fs=14) + '</div>')
    return page("N4 An offer, just for you", f'<div class="root">{h}</div>')


def n5():
    h = back_link("The Noticeboard", "N1.dc.html")
    h += corner_coin(32, "banked", 56, 8)
    h += ab(-8, 58, f'<img src="{A["bull_cheer"]}" alt="Bullion cheering, hooves up" style="width:164px;height:164px;object-fit:contain">')
    h += ab(166, 62, sticker('<div class="whimsy" style="font-size:33px;line-height:42px;text-align:center;white-space:nowrap">Sold high!</div>', SUN, 20, -4, "sticker", pad="2px 10px"), w=206)
    h += ab(150, 128, sticker(f'<div class="kickerPillSm acc">&#9733; first time</div><div class="handLg" style="line-height:20px">Maya paid {nm(5)} more than I would have. Nice selling.</div>',
                              PAPER, 16, 1.5, "sm", pad="6px 10px"), w=224)
    cells = "".join(f'<div class="flat" style="flex:1;background:{bg};border-radius:12px;padding:5px 4px;text-align:center;border-width:1.5px">'
                    f'<div class="kicker" style="line-height:15px">{k}</div><div class="numeralLg" style="font-size:28px;line-height:32px;{st}">{v}</div></div>'
                    for k, v, bg, st in [("Maya paid", "14", PAPER, ""), ("Bullion would have paid", "9", PAPER, ""), ("for listing it", "+5", SAGE, f"color:{SUCCESS}")])
    card = (f'<div style="display:flex;align-items:center;gap:8px">{face("maya", 32)}<div class="cardTitle" style="flex:1">Maya paid {nm(14)} for your 4 pinecones</div></div>'
            f'<div style="display:flex;gap:8px;margin-top:8px">{cells}</div>'
            f'<div style="display:flex;align-items:center;gap:6px;margin-top:8px"><span class="kicker">tickles ready</span><span class="numeral">18</span>'
            f'<span class="handT" aria-hidden="true">&rarr;</span><span class="numeral">32</span>{coin_mark(16)}<span class="kicker mute">past 25 is fine</span></div>')
    h += ab(14, 246, sticker(card, SUN, 20, -0.6, "sticker", pad="10px 14px"), w=362)
    tail = DAY[-12:]
    nudged = tail + [tail[-1] + (14 - tail[-1]) / 3]
    ev = {11 + 1: ("pig", 14)}
    h += ab(16, 440, chart_panel(nudged, "nudged by your sale", 358, 164, ev, kinds=("pig",), target=(14, "Maya paid 14"),
                                 notes=[(11, -26, "a third of the way: 12 to 12.7", "end")], xlabels=[(0, "10 am"), (12, "now")]))
    h += ab(14, 618, sticker(f'<div style="display:flex;align-items:center;gap:10px">{face("maya", 34)}<div class="handT" style="line-height:18px">'
                             f'Maya&#8217;s side: her Ghost Sheep fancies pinecones, {nm(24)} for 4. She paid {nm(14)}: she&#8217;s up {nm(10)}.</div></div>', CREAM, 14, 0, "flat", pad="6px 10px"), w=362)
    h += ab(14, 690, hand_line("the push says it too: &#8220;Maya paid 14 for your 4 pinecones&#8221;", "kicker mute"), w=362)
    h += ab(14, 770, f'<div style="display:flex;gap:10px;width:362px">{pill_btn("Back to the noticeboard", "N1.dc.html", CREAM, "sm", "flex:1.2")}{pill_btn("Post another", "N2.dc.html", PAPER, "sm", "flex:1")}</div>')
    return page("N5 Sold high", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# ROW 3 · Together: one find, two paths (row 1's market day: Maya has pinecones up at 13)
# ═════════════════════════════════════════════════════════════════════════════
def path_card(lead, title, sub, action, color=PAPER, cls="stickerSm", rot=0.0, flag=None, style=""):
    fl = (f'<div style="position:absolute;right:12px;top:-12px;transform:rotate(3deg)">{chip(f"<span class=kickerPillSm>{flag}</span>", PAPER, "stickerSm")}</div>' if flag else "")
    return (f'<div class="{cls}" style="position:relative;display:flex;align-items:center;gap:10px;background:{color};border-radius:18px;padding:10px 12px 10px 8px;transform:rotate({rot}deg);{style}">'
            f'{fl}{lead}<div style="flex:1;min-width:0"><div class="cardTitleSm" style="line-height:19px">{title}</div><div class="kicker" style="line-height:16px">{sub}</div></div>{action}</div>')


def cork_tile(inner, size=62):
    return (f'<div class="flat cork" style="width:{size}px;height:{size}px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;border-width:1.5px">'
            f'<div style="position:relative;background:{PAPER};border:1.5px solid {INK};border-radius:4px;padding:6px 4px 3px 4px;transform:rotate(-4deg)">'
            f'<span style="position:absolute;top:-7px;left:50%;margin-left:-6px">{pushpin(ROSEDEEP, 12)}</span>{inner}</div></div>')


def counter_tile(size=62):
    return (f'<div class="flat" style="width:{size}px;height:{size}px;border-radius:12px;flex:none;background:{CREAM};display:flex;align-items:center;justify-content:center;border-width:1.5px;overflow:hidden">'
            f'<img src="{A["bullion_counter"]}" alt="" aria-hidden="true" style="width:{size + 6}px;height:{size + 6}px;object-fit:contain"></div>')


def t1():
    h = back_link("The Market", "C1.dc.html")
    h += corner_coin(18, size=56, top=8)
    h += ab(16, 66, find_head(PRICE_NOW, "usual 12 &middot; up 0.4 since yesterday"))
    h += ab(16, 168, gap_bar(9, 12, 15, 358, pins=((13, "Maya 13"),)))
    h += ab(16, 248, section_header("Get 4 pinecones", "three ways, cheapest in sun", cls="cardTitle"), w=358)
    p1 = path_card(counter_tile(), "Buy now from Bullion", "instant &middot; always there &middot; his cut",
                   pill_btn(f"Buy for {nm(15)}", "C3.dc.html", PAPER, "sm", aria="Buy 4 pinecones from Bullion for 15 tickles"))
    p2 = path_card(cork_tile(face("maya", 24)), "From Maya on the noticeboard", f"{nm(2)} under Bullion &middot; pinned till 9 pm",
                   pill_btn(f"Buy for {nm(13)}", "N1.dc.html", PAPER, "sticker", aria="Buy Maya's 4 pinecones for 13 tickles"), SUN, "sticker", -0.6, "best price now",
                   "border-width:3px")
    p3 = path_card(cork_tile(f'<span class="kickerPillSm" style="font-size:8px;letter-spacing:.8px">WANTED</span>', 62), "Post a wanted card at your price",
                   f"say {nm(11)}: a pig with pinecones might take it; it can wait",
                   pill_btn("Post", "N2.dc.html", PAPER, "flat", aria="Post a wanted card for pinecones"), CREAM, "dashed", 0.4)
    h += ab(14, 282, f'<div style="display:flex;flex-direction:column;gap:14px;width:362px">{p1}{p2}{p3}</div>')
    h += ab(10, 600, bull_say(A["bull_a"], f'<div class="handLg" style="line-height:21px">Maya&#8217;s {nm(13)} beats my {nm(15)}. Buy from her! I&#8217;m right here if she&#8217;s gone.</div>', size=84, rot=1), w=366)
    h += ab(16, 712, sticker(f'<div class="handT" style="line-height:18px">Either way the price moves: a set from Bullion pushes it up {nm(0.4)}; Maya&#8217;s sale nudges it a third of the way to {nm(13)}.</div>',
                             PAPER, 12, 0, "flat", pad="6px 10px", style="border-width:1.5px"), w=358)
    h += ab(16, 788, hand_line("the chip on every card compares it to the price, 12", "kicker mute"), w=358)
    return page("T1 Buying: both paths", f'<div class="root">{h}</div>')


def t2():
    h = back_link("The Market", "C1.dc.html")
    h += corner_coin(18, size=56, top=8)
    h += ab(16, 66, find_head(PRICE_NOW, "you hold 4 pinecones: one set", INK))
    h += ab(16, 168, gap_bar(9, 12, 15, 358, pins=((13, "13"), (14, "14"))))
    h += ab(16, 248, section_header("Sell 4 pinecones", "pins: what pigs paid lately", cls="cardTitle"), w=358)
    p1 = path_card(counter_tile(), "Sell now to Bullion", "instant &middot; on the spot &middot; his cut",
                   pill_btn(f"Sell for {nm(9)}", None, PAPER, "sm", aria="Sell 4 pinecones to Bullion for 9 tickles"))
    sold = "".join(f'<div style="display:flex;align-items:center;gap:5px">{face(w_, 18, 1)}<span class="kicker">{n_} paid {nm(p_)} &middot; {d_}</span></div>'
                   for w_, n_, p_, d_ in [("maya", "Maya", 14, "Tue"), ("pig", "a pig", 13, "Mon"), ("biscuit", "Biscuit", 13, "Sun")])
    p2 = (f'<div class="sticker" style="position:relative;background:{SUN};border-radius:18px;padding:10px 12px 10px 8px;transform:rotate(-0.6deg);border-width:3px">'
          f'<div style="position:absolute;right:12px;top:-12px;transform:rotate(3deg)">{chip("<span class=kickerPillSm>sell high</span>", PAPER, "stickerSm")}</div>'
          f'<div style="display:flex;align-items:center;gap:10px">{cork_tile(cluster("pinecone", 12), 62)}'
          f'<div style="flex:1;min-width:0"><div class="cardTitleSm" style="line-height:19px">List it on the noticeboard</div>'
          f'<div class="kicker" style="line-height:16px">pigs pay up to {nm(14)} here lately &middot; may take a day</div></div>'
          f'{pill_btn("List it", "N2.dc.html", PAPER, "sticker", aria="List 4 pinecones on the noticeboard")}</div>'
          f'<div style="display:flex;flex-direction:column;gap:1px;margin:6px 0 0 72px">{sold}</div></div>')
    h += ab(14, 282, f'<div style="display:flex;flex-direction:column;gap:14px;width:362px">{p1}{p2}</div>')
    h += ab(14, 548, sticker(f'<div class="kickerPillSm acc">&#9733; the counter keeps the board honest</div>'
                             f'<div class="handT" style="line-height:18px">List at {nm(9)} or under and it sells to Bullion at once, at his better price. List at {nm(15)} or over and it just sits.</div>',
                             CREAM, 14, 0.3, "flat", pad="6px 10px", style="border-width:1.5px"), w=362)
    h += ab(10, 636, bull_say(A["bull_a"], f'<div class="handLg" style="line-height:21px">Need tickles now? I pay {nm(9)} on the spot. Can wait a day? List at {nm(13)} and a pig will likely beat me by {nm(4)}.</div>',
                              size=84, rot=1), w=366)
    h += ab(16, 762, hand_line("either way the price moves: a set sold to Bullion pulls it down 0.4; a pig sale nudges it toward what was paid", "kicker mute"), w=358)
    return page("T2 Selling: both paths", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# ROW 4 · Onboarding: the "new here?" tag, three cards in Bullion's voice, the guided first trade,
# then two of the one-time moments in context (the newcomer sold their 4 pinecones to Bullion for 9).
# ═════════════════════════════════════════════════════════════════════════════
def home_yard():
    h = f'<div style="position:absolute;inset:0;background:{SKY}"></div>'
    h += f'<div style="position:absolute;left:0;right:0;top:470px;bottom:0;background:{SAGE};border-top:2px solid {INK}"></div>'
    for i, (x, w) in enumerate([(-10, 80), (60, 70), (120, 86), (196, 72), (258, 84), (330, 80)]):
        h += (f'<div aria-hidden="true" style="position:absolute;left:{x}px;top:{438 - (i % 2) * 8}px;width:{w}px;height:{w // 2 + 20}px;background:{SAGEINK};'
              f'border:2px solid {INK};border-radius:{w}px {w}px 10px 10px;box-shadow:2px 2px 0 {INK}"></div>')
    h += f'<img src="{A["rosie"]}" alt="Rosie, your pig, in the yard" style="position:absolute;left:10px;top:330px;width:200px;height:200px;object-fit:contain">'
    h += corner_coin(18, size=56, top=14, label="tickles ready")
    return h


def fan(rows):
    items = ""
    for g, t, s, hi, href, tag in rows:
        tg = (f'<span class="stickerSm kickerPillSm" style="position:absolute;left:-14px;top:-12px;background:{SUN};border-radius:999px;padding:3px 9px;transform:rotate(-7deg);white-space:nowrap">new here? &#9733;</span>' if tag else "")
        el = "a" if href else "div"
        at = f' href="{href}"' if href else ""
        items += (f'<{el}{at} class="{"sticker" if hi else "stickerSm"}" style="position:relative;display:flex;align-items:center;gap:10px;background:{ROSE if hi else PAPER};border-radius:14px;padding:8px 12px 8px 8px;min-height:56px;width:262px;color:{INK};box-sizing:border-box;{"border-width:3px;" if hi else ""}">'
                  f'{tg}<img src="{g}" alt="" aria-hidden="true" style="width:38px;height:38px;object-fit:contain;flex:none">'
                  f'<div style="display:flex;flex-direction:column;min-width:0"><div class="cardTitleSm">{t}</div><div class="handT mute clip">{s}</div></div></{el}>')
    h = f'<div style="position:absolute;inset:0;background:{rgba(INK, .18)}"></div>'
    h += f'<div style="position:absolute;right:16px;bottom:116px;display:flex;flex-direction:column;align-items:flex-end;gap:10px">{items}</div>'
    h += (f'<button type="button" aria-label="Close the Barn menu" class="sticker" style="position:absolute;right:16px;bottom:36px;width:68px;height:68px;border-radius:999px;background:{SUN};display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer">'
          f'<img src="{A["g_barn"]}" alt="" aria-hidden="true" style="width:44px;height:44px;object-fit:contain"></button>')
    return h


def o1():
    h = home_yard()
    h += fan([(A["g_barn"], "Enter Barn", "Rosie is home", False, None, False),
              (A["g_bag"], "Satchel", "9 finds &middot; 4 pinecones: a set", False, None, False),
              (A["g_trader"], "Trader", "the Ghost Sheep &middot; 4h left", False, None, False),
              (A["g_bullion"], "Market", "Bullion&#8217;s counter, the noticeboard", True, "O2.dc.html", True)])
    return page("O1 The fan: new here?", f'<div class="root">{h}</div>')


def dots(step, n=3):
    return (f'<div role="img" aria-label="card {step + 1} of {n}" style="display:flex;gap:6px;justify-content:center">'
            + "".join(f'<span style="width:{22 if i == step else 10}px;height:10px;border-radius:999px;border:2px solid {INK};background:{SUN if i == step else PAPER};box-sizing:border-box"></span>' for i in range(n))
            + '</div>')


def ob_card(step, kicker, title, hero, body, primary, primary_href, secondary="Skip", secondary_href="C1.dc.html", top=76):
    inner = (f'<div class="kickerPill acc" style="text-align:center">&#9733; {kicker}</div>'
             f'<div class="pageTitle" style="text-align:center;margin-top:2px">{title}</div>'
             f'<div style="margin-top:10px">{hero}</div>'
             f'<div style="margin-top:10px">{body}</div>'
             f'<div style="margin-top:12px">{dots(step)}</div>'
             f'<div style="display:flex;gap:10px;margin-top:12px">{pill_btn(primary, primary_href, SUN, "sticker", "flex:1.5;min-height:52px", fs=15)}'
             f'{pill_btn(secondary, secondary_href, CREAM, "flat", "flex:1;min-height:52px", fs=14)}</div>')
    h = c1_scene() + f'<div style="position:absolute;inset:0;background:{SCRIM};z-index:4"></div>'
    h += (f'<div role="dialog" aria-label="{re.sub("<[^>]+>", "", title)}" style="position:absolute;left:16px;right:16px;top:{top}px;z-index:5">'
          + sticker(inner, PAPER, 24, 0, "sticker", pad="16px 16px 16px 16px") + '</div>')
    return h


def o2():
    hero = (f'<div class="flat" style="position:relative;height:236px;border-radius:16px;background:{CREAM};overflow:hidden;border-width:1.5px">'
            f'<img src="{A["bullion_counter"]}" alt="Bullion behind his counter" style="position:absolute;left:50%;margin-left:-112px;top:2px;width:224px;height:224px;object-fit:contain">'
            f'<div style="position:absolute;left:8px;bottom:8px">{chip(cluster("pinecone", 18) + "<span class=kicker>4 of a common</span>", PAPER, "stickerSm")}</div>'
            f'<div style="position:absolute;right:8px;bottom:8px">{chip(cluster("old_key", 18) + "<span class=kicker>3 of anything else</span>", PAPER, "stickerSm")}</div></div>')
    body = (f'<div class="handLg" style="text-align:center;line-height:22px">&#8220;Hand me a set and I&#8217;ll pay you on the spot. Need a set? I&#8217;ve always got one. '
            f'Four of a common, three of anything else.&#8221;</div>')
    h = ob_card(0, "Bullion&#8217;s Market &middot; 1 of 3", "Buy or sell any set, any time.", hero, body, "Next", "O3.dc.html")
    return page("O2 Card 1: buy or sell any set", f'<div class="root">{h}</div>')


def o3():
    ch = chart_panel(LESSON, "one afternoon", 326, 150, EV_LESSON, kinds=("buy", "sell"),
                     notes=[(4, -8, "bought: up", "end"), (10.4, 20, "sold: down", "start"), (18, -14, "quiet: home", "middle")],
                     end_label=False)
    hero = (ch + f'<div style="margin-top:6px;display:flex;justify-content:center">{gap_bar(9, 12, 15, 326, lo_lab="I buy", hi_lab="I sell", gap_lab="my cut")}</div>')
    body = bull_say(A["bull_a"], f'<div class="handT" style="line-height:18px">Every set you buy from me pushes the price up. Every set you sell pulls it down. '
                                 f'When it&#8217;s quiet the price wiggles, then wanders back home. I buy a little under the price and sell a little over: that&#8217;s my cut.</div>',
                    size=58, rot=0.8, pad="6px 10px")
    h = ob_card(1, "Bullion&#8217;s Market &middot; 2 of 3", "Prices move.", hero, body, "Next", "O4.dc.html", top=56)
    return page("O3 Card 2: prices move", f'<div class="root">{h}</div>')


def o4():
    cards = (f'<div style="display:flex;justify-content:center;gap:12px;padding-top:12px">'
             + listing("maya", "Maya", "pinecone", 4, 13, 12, rot=-2, w=148)
             + swap_listing("pig", "a pig", "pinecone", 4, "old_key", 1, 12, 8, rot=1.6, w=148, pin="tape", words=False)
             + '</div>')
    hero = (f'<div class="flat cork" style="position:relative;border-radius:16px;padding:6px 6px 8px 6px;border-width:1.5px">{cards}'
            f'<div style="margin-top:10px;background:{rgba(PAPER, .9)};border-radius:12px;padding:4px 6px 0 6px;display:flex;justify-content:center">{gap_bar(9, 12, 15, 300, lo_lab="I buy", hi_lab="I sell", gap_lab="price it in here")}</div></div>')
    body = bull_say(A["bull_a"], f'<div class="handT" style="line-height:18px">Post your set on the noticeboard at your own price, or swap it straight up. '
                                 f'Price it between my two prices and you&#8217;ll both beat my counter. That&#8217;s how you sell high.</div>',
                    size=58, rot=-0.8, pad="6px 10px")
    h = ob_card(2, "Bullion&#8217;s Market &middot; 3 of 3", "Or trade with a pig.", hero, body, "Step up to the counter", "O5.dc.html", "Later", top=56)
    return page("O4 Card 3: or trade with a pig", f'<div class="root">{h}</div>')


def o5():
    h = c1_scene() + f'<div style="position:absolute;inset:0;background:{SCRIM};z-index:4"></div>'
    spot = (f'<div style="position:relative;width:374px;height:186px;border-radius:24px;background:{PAPER};border:3px dashed {SUN};box-sizing:border-box;box-shadow:0 0 0 3px {INK}">'
            f'<img src="{A["bullion_counter"]}" alt="Bullion at his counter" style="position:absolute;left:4px;top:6px;width:170px;height:170px;object-fit:contain">'
            f'<div style="position:absolute;left:184px;top:22px;display:flex;flex-direction:column;align-items:center">'
            f'{chip("<span class=kickerPillSm>yours</span>", SUN, "stickerSm", "transform:rotate(-4deg);margin-bottom:-4px;z-index:1")}{basket("pinecone", 128)}'
            f'<span class="handT" style="margin-top:-12px">4 pinecones: one set</span></div></div>')
    h += ab(8, 186, spot, style="z-index:5")
    arrow_svg = (f'<svg width="80" height="70" viewBox="0 0 80 70" aria-hidden="true" style="position:absolute;left:236px;top:368px;z-index:6;overflow:visible">'
                 f'<path d="M14 64 C 20 34, 34 18, 58 8" fill="none" stroke="{SUN}" stroke-width="4" stroke-linecap="round"/>'
                 f'<path d="M46 4 L59 7 L52 19" fill="none" stroke="{SUN}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
    h += arrow_svg
    coach = (f'<div class="kickerPill acc">&#9733; your first trade</div>'
             f'<div style="display:flex;align-items:flex-start;gap:8px;margin-top:4px">{gimg("bull_a", 64, "margin:-4px 0 0 -6px")}'
             f'<div class="handLg" style="line-height:22px">You&#8217;ve got 4 pinecones. Sell them to me for {nm(9)}, or put them on the board for more?</div></div>'
             f'<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">'
             + ticket("9", "tickles", "Sell them to Bullion for", "O6.dc.html", aria="Sell 4 pinecones to Bullion for 9 tickles", h=58)
             + pill_btn("Put them on the board for more", "N2.dc.html", PAPER, "sm", "width:100%;min-height:52px", fs=14)
             + f'</div><div class="kicker mute" style="text-align:center;margin-top:6px">either one finishes the tour</div>')
    h += ab(16, 436, sticker(coach, PAPER, 22, -0.6, "sticker", pad="12px 14px"), w=358, style="z-index:6")
    return page("O5 The guided first trade", f'<div class="root">{h}</div>')


def o_find(p, chart, toast_html, bs, bb, coin_n, hold, tape, hi=None, sub="usual 12", toast_top=596):
    h = back_link("The Market", "C1.dc.html")
    h += corner_coin(coin_n, size=56, top=8)
    h += ab(16, 66, find_head(p, sub, MUTE))
    h += ab(16, 172, chart)
    h += ab(16, 346, bull_prices(bs, bb, p))
    h += ab(16, 500, hold, w=358)
    h += ticker(tape, hi=hi, run=hi is None, top=552)
    h += ab(16, 744, f'<div style="display:flex;gap:10px;width:358px">'
                     + ticket(str(bs), "tickles", "Buy 4 for", None, "golden", aria=f"Buy 4 pinecones for {bs} tickles", style="flex:1;min-width:0", h=60)
                     + ticket(str(bb), "tickles", "Sell 4 for", None, "paper", aria=f"Sell 4 pinecones for {bb} tickles", style="flex:1;min-width:0", h=60)
                     + '</div>')
    h += ab(14, toast_top, toast_html, w=362, style="z-index:7")
    return h


def o6():
    ev = dict(EV_OSELL)
    ch = chart_panel(O_SELL, "with your sale", 358, 160, ev, xlabels=[(0, "8 am"), (16, "now")])
    hold = (f'<div class="flat" style="display:flex;align-items:center;gap:8px;background:{CREAM};border-radius:12px;padding:6px 10px;border-width:1.5px">'
            f'<span class="handT" style="flex:1">You sold 4 pinecones to Bullion for {nm(9)}</span>'
            f'<span style="display:inline-flex;align-items:center;gap:4px"><span class="numeral">18</span><span class="handT" aria-hidden="true">&rarr;</span><span class="numeral">27</span>{coin_mark(14)}</span></div>')
    tape = [tk("YOU SOLD 4 PINECONES", 9, "counter"), tk("THE BAKER&#8217;S BOY &middot; 4 PINECONES", 11.7, "town"), tk("BISCUIT BOUGHT 4 PINECONES", 13, "pig")]
    t = toast("first time", "You moved the price!", "Every set you sell me pulls it down a little. Every set bought pushes it up.", SUN, -1.2, A["bull_cheer"], move(12, "11.6", "numeralLg"))
    h = o_find(11.64, ch, t, 14, 9, "27", hold, tape, hi=0, sub="usual 12 &middot; down 0.4 just now")
    return page("O6 Moment: you moved the price", f'<div class="root">{h}</div>')


def o7():
    n0 = len(O_SELL) - 1
    ev = dict(EV_OSELL)
    ch = chart_panel(O_QUIET, "since your sale", 358, 160, ev, xlabels=[(0, "8 am"), (n0, "noon"), (len(O_QUIET) - 1, "4 pm")],
                     quiet=(n0 + 1, len(O_QUIET) - 1, "quiet: wandering home"))
    hold = (f'<div class="flat" style="display:flex;align-items:center;gap:8px;background:{CREAM};border-radius:12px;padding:6px 10px;border-width:1.5px">'
            f'<span class="handT" style="flex:1">Nobody has traded pinecones since your sale</span><span class="kicker mute">4 hours</span></div>')
    tape = [tk("THE MILLER &middot; 4 PINECONES", 11.7, "town"), tk("OLD MRS HEDGE &middot; 4 PINECONES", 11.8, "town"), tk("THE TINKER &middot; 4 PINECONES", 11.8, "town")]
    t = toast("first time", "The price is wandering home", f"Nobody&#8217;s traded pinecones for a while: the price is wandering home, back toward {nm(12)}.", CREAM, 1, A["bull_shrug"])
    h = o_find(11.8, ch, t, 15, 9, "31", hold, tape, sub="usual 12 &middot; drifting home")
    return page("O7 Moment: wandering home", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# write boards
# ═════════════════════════════════════════════════════════════════════════════
BOARDS = {
    "Main.dc.html": ("0 · One price, two ways to trade", main_board(), MW, MH),
    "C1.dc.html": ("C1 · The market home: two doors, Bullion, the chalk board", c1(), 390, 844),
    "C2.dc.html": ("C2 · Pinecones at the counter: the chart, his two prices", c2(), 390, 844),
    "C3.dc.html": ("C3 · Confirm: the price move before you tap", c3(), 390, 844),
    "C4.dc.html": ("C4 · Bought: you moved the price", c4(), 390, 844),
    "C5.dc.html": ("C5 · A quiet afternoon: wandering home", c5(), 390, 844),
    "N1.dc.html": ("N1 · The noticeboard: for sale, wanted, swaps, for you", n1(), 390, 844),
    "N2.dc.html": ("N2 · Post a listing: the price slider", n2(), 390, 844),
    "N3.dc.html": ("N3 · A swap, up close", n3(), 390, 844),
    "N4.dc.html": ("N4 · For you: an offer from Maya", n4(), 390, 844),
    "N5.dc.html": ("N5 · Sold high: +5 for listing it", n5(), 390, 844),
    "T1.dc.html": ("T1 · Buying: both paths side by side", t1(), 390, 844),
    "T2.dc.html": ("T2 · Selling: both paths side by side", t2(), 390, 844),
    "O1.dc.html": ("O1 · The fan: Market, new here?", o1(), 390, 844),
    "O2.dc.html": ("O2 · Card 1 of 3: buy or sell any set", o2(), 390, 844),
    "O3.dc.html": ("O3 · Card 2 of 3: prices move", o3(), 390, 844),
    "O4.dc.html": ("O4 · Card 3 of 3: or trade with a pig", o4(), 390, 844),
    "O5.dc.html": ("O5 · The guided first trade", o5(), 390, 844),
    "O6.dc.html": ("O6 · Moment: you moved the price", o6(), 390, 844),
    "O7.dc.html": ("O7 · Moment: the price wanders home", o7(), 390, 844),
}
for path, (_, html, _w, _h) in BOARDS.items():
    with open(os.path.join(ROOT, path), "w") as f:
        f.write(html)

# ── canvas.json ──────────────────────────────────────────────────────────────
W, H, GX, ROW_H = 390, 844, 80, 1204
rows = [("0", ["Main.dc.html"]),
        ("C", ["C1.dc.html", "C2.dc.html", "C3.dc.html", "C4.dc.html", "C5.dc.html"]),
        ("N", ["N1.dc.html", "N2.dc.html", "N3.dc.html", "N4.dc.html", "N5.dc.html"]),
        ("T", ["T1.dc.html", "T2.dc.html"]),
        ("O", ["O1.dc.html", "O2.dc.html", "O3.dc.html", "O4.dc.html", "O5.dc.html", "O6.dc.html", "O7.dc.html"])]
boards, row_w = {}, {}
for r, (key, files) in enumerate(rows):
    y, x = r * ROW_H, 0
    for p in files:
        title, _, bw, bh = BOARDS[p]
        b = {"x": x, "y": y, "w": bw, "h": bh, "title": title}
        if (bw, bh) == (W, H):
            b["is_interactive"] = True
        boards[p] = b
        x += bw + GX
    row_w[key] = x - GX
order = [p for _, files in rows for p in files]

TITLES = {
    "0": "0 · One price, two ways to trade",
    "C": "Part 1 · The Counter: buy and sell any time",
    "N": "Part 2 · The Noticeboard: trade with pigs",
    "T": "Together: one find, two paths",
    "O": "Onboarding",
}
STICKY = {
    "0": ("0 · One price, two ways to trade\n\n"
          "WHAT IT SHOWS: the whole system on one page. The price of a find in the middle (pinecones, usual 12, moving inside 10.2 to 13.8). Bullion's counter on the left (sells 15, buys 9, instant, his cut). The noticeboard on the right (pig to pig, no cut, needs a partner).\n\n"
          "WHAT MOVES THE PRICE: each set bought at the counter, up 3% of usual; each set sold, down 3%; a pig-to-pig sale, a third of the way to what was paid; quiet hours, a wiggle of up to 1% and a 5% drift home every 30 minutes; swaps, nothing.\n\n"
          "THE GAP: Bullion's two prices bracket a shaded gap, 'where pigs trade'. A listing at 9 or under sells to Bullion at once; at 15 or over it just sits. So listings settle inside the gap, and inside the gap both pigs beat the counter.\n\n"
          "WHY PRICES DIFFER BETWEEN PIGS: the outlets. Maya's Ghost Sheep fancies pinecones (24 for 4), so she pays you 14 when Bullion pays 9: you're up 5, she's up 10.\n\n"
          "PILLARS: Connect (the better deal always has a pig on the other side) and Collect (every set has a home: the counter, a pig, the Sheep)."),
    "C": ("Part 1 · The Counter: buy and sell any time\n\n"
          "WHAT THE ROW SHOWS: the market home (two doors: the Counter and the Noticeboard; Bullion at his counter; the chalk board of all twelve finds with price per set, per find, the move since yesterday, a sparkline). Pinecones at the counter: the last day in chalk with every trade a dot, Bullion's two prices in his voice, the Ghost Sheep line, a nudge to the cheaper card on the noticeboard. The confirm draws the price move before you tap: 'Buy for 15. The price goes 12 to 12.4.' Bought: the first-time moment. Three quiet hours later: the price wandering home, only the townsfolk on the tape.\n\n"
          "THE RULE IT DEMONSTRATES: Bullion sells at max(usual + 1, 1.2 x price rounded up) and buys at min(usual, 0.8 x price rounded down). One set bought: 12 to 12.4, his prices stay 15 and 9. Pushed to 12.8, they follow: 16 and 10. A round trip at the counter always loses (the 20% cut is wider than the 15% swing).\n\n"
          "STORY: your Ghost Sheep fancies pinecones today (24 for 4), so a set at 15 is worth buying. Market > Pinecones > Confirm > Bought > three hours on.\n\n"
          "OPEN: the price prints to one decimal (12.4) while every tickle amount is whole; is that clear, or should the board round? No daily caps by default (the cut and the coin are the limits); caps stay as a tuning valve."),
    "N": ("Part 2 · The Noticeboard: trade with pigs\n\n"
          "WHAT THE ROW SHOWS: the noticeboard full screen in cork, pinned cards in four sections (For sale · Wanted · Swaps · For you), each card with a pig face (friends named, others 'a pig'), the set, the price and a price-tag chip against the price. Post a listing: pick a set from your bag, For sale / Wanted / Swap, Every pig or Just Maya, a slider marked Bullion buys 9 · the price 12 (suggested) · Bullion sells 15, and the crossing warning if you drag to 9 or under. A swap up close with both sides at today's price. An offer to one friend, in your Inbox and pinned by her door when you visit. Sold high: the receipt against the counter, Bullion's line, and the price nudged a third of the way.\n\n"
          "THE RULE IT DEMONSTRATES: the price is the yardstick for every card; a listing at or under Bullion's buying price sells to him at once; a pig sale moves the price a third of the way toward what was paid (12 to 12.7 on a sale at 14); swaps don't move it. 4 listings up at a time, 24 hours each.\n\n"
          "STORY: you pin 4 pinecones at 14 (2 over the price, 1 under Bullion's 15); Maya, whose Sheep fancies pinecones, takes them: 'Maya paid 14 · Bullion would have paid 9 · +5 for listing it'. Board > Post > Sold high; the swap and Maya's old keys (22, 3 under the price) branch off the board.\n\n"
          "OPEN: offers to one friend are new on the server (market_offers.target_user_id + an Inbox row). The counter-offer flow is a button here, not designed. N3 is shown from the taker's side: 'a pig' gives 4 pinecones (about 12) for 1 old key (about 8), so the taker gets 4 more than they give; the why is the pig's Ghost Sheep fancying old keys."),
    "T": ("Together: one find, two paths\n\n"
          "WHAT THE ROW SHOWS: the find page with both ways to trade side by side, so the decision is made for you. Buying: Buy now from Bullion 15 · From Maya on the noticeboard 13 (in sun, 'best price now') · Post a wanted card at your price. Selling: Sell now to Bullion 9 · List it, pigs pay up to 14 here lately (with who paid what).\n\n"
          "THE RULE IT DEMONSTRATES: the counter is the safety net, the noticeboard the better deal. Bullion even says so ('Maya's 13 beats my 15. Buy from her!'). The gap bar puts every option on one line.\n\n"
          "OPEN: is this the find page (replacing C2), or a panel under C2? Does the cheapest path always take the sun fill, or does the counter stay first?"),
    "O": ("Onboarding\n\n"
          "WHAT THE ROW SHOWS: the Barn fan's Market row wears a 'new here?' tag until the first visit. Then three cards in Bullion's voice (the spec's words): 'Buy or sell any set, any time.' · 'Prices move.' (a small chart: a push up, a pull down, a drift home; his cut on the gap bar) · 'Or trade with a pig.' (two pinned cards, the gap between his prices highlighted). It ends on 'Step up to the counter'. A coach mark then points at a set you hold: 'You've got 4 pinecones. Sell them to me for 9, or put them on the board for more?' Either choice finishes the tour.\n\n"
          "MOMENTS (once each, in context): 'You moved the price!' (here on a sale: 12 to 11.6; C4 shows the buy, 12 to 12.4) · 'Nobody's traded pinecones for a while: the price is wandering home' · and the sold-high line on N5.\n\n"
          "SAME PATTERN AS the Pop-up Stall's onboarding (2026-10-29): a tag, three cards, one guided action.\n\n"
          "OPEN: does Skip still show the coach mark? Does the tag stay until the first trade or only the first visit? Copy: is 'that's my cut' the right word for the spread?"),
}
FILL = {"0": "orange", "C": "green", "N": "yellow", "T": "blue", "O": "pink"}

notes = {
    "brief": {"x": 0, "y": -1180, "w": MW, "fill": "gray", "text":
              "TTP Market: the counter, the noticeboard, onboarding · round 4 · 2026-10-30\n\n"
              "THE FOUNDER'S ASK (his words): 'How do we make this work as a two-part system? 1. Instant buying and selling, with trades moving the price over time and slight price jitter when there's no trading activity. 2. Trading directly with other users, possibly through simple straight-up swaps. How should those two mechanisms work together?' Plus designs for both parts and the feature's onboarding.\n\n"
              "THE ANSWER IN ONE BREATH: every find has one price. You can trade at it two ways: instantly at Bullion's counter, where he takes a small cut, or directly with another pig, where there's no cut but you need a partner.\n\n"
              "THE NUMBERS ON EVERY BOARD: a set is 4 of a common, 3 of anything else. Usual prices: pinecones 12, old keys 24, tin whistles 60. Pinecones at 12: Bullion sells 15, buys 9. One set bought: 12 to 12.4. The price stays inside 0.85 to 1.15 of usual. A pig sale moves it a third of the way to what was paid. Quiet: a wiggle of up to 1%, a 5% drift home every 30 minutes.\n\n"
              "WHAT TO REACT TO: (1) Does the split feel right: the counter for now, the noticeboard for the better deal, one price under both? (2) Are the sizes right: the counter's cut (20% each side) and the price's swing (15% each side)? The cut must stay wider than the swing or a round trip at the counter could pay. (3) The onboarding copy: three cards in Bullion's voice, the guided first trade, three one-time moments.\n\n"
              "ROWS: 0 the system on one page · Part 1 the Counter (5 phones) · Part 2 the Noticeboard (5) · Together, one find two paths (2) · Onboarding (7). Every phone links in Play: Market home > Pinecones > Confirm > Bought > later; the board > Post > Sold high; the fan > three cards > first trade > moments.\n\n"
              "Art: Bullion at his counter and the cork noticeboard (new this round), the chalk board, the basket, Bullion idle / cheer / shrug, the twelve finds, Rosie, Maya's Pepper, the Ghost Sheep."},
}
for r, (key, _) in enumerate(rows):
    y = r * ROW_H
    notes[f"t{key}"] = {"x": 0, "y": y - 250, "text": TITLES[key], "kind": "title1", "maxW": row_w[key]}
    notes[f"s{key}"] = {"x": row_w[key] + GX, "y": y, "w": 560, "text": STICKY[key], "fill": FILL[key]}

now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
canvas = {
    "v": 3,
    "createdOnFiles": {"v": 1, "at": now},
    "title": "TTP Market: the counter, the noticeboard, onboarding · 2026-10-30",
    "launch": {"view": "canvas"},
    "pages": [],
    "boards": boards,
    "order": order,
    "notes": notes,
    "designSystems": [{"title": "Tickle the Pig", "namespace": "tickle-the-pig",
                       "artifact": "https://claude.ai/artifact/A3L11psUnnGUQ36714vrCz",
                       "version": "1793291966-be33", "copiedAt": now}],
}
with open(os.path.join(ROOT, "canvas.json"), "w") as f:
    json.dump(canvas, f, indent=1, ensure_ascii=False)

# ── guards: no em dash in anything a player reads; every link lands on a board; art is all uploaded ──
bad = [p for p, (_, html, _w, _h) in BOARDS.items() if "—" in html or "&mdash;" in html or "&#8212;" in html]
assert not bad, f"em dash in {bad}"
assert not any("—" in n.get("text", "") for n in notes.values()), "em dash in a note"
for p, (_, html, _w, _h) in BOARDS.items():
    for href in re.findall(r'href="([^"#]+\.dc\.html)"', html):
        assert href in BOARDS, f"{p} links to missing {href}"
    for src in re.findall(r'(?:src="|url\()(/_blob/[0-9a-f]+)', html):
        assert src in A.values(), f"{p} uses an unknown blob {src}"
    assert "lorem" not in html.lower(), p
print("wrote", len(BOARDS), "boards + canvas.json")
