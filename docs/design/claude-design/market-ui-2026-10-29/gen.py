# Generates the boards + canvas.json for "TTP Market UI: make it a market · 2026-10-29" (round 2).
# Starts from ../market-2026-10-29/gen.py (round 1): the same tokens (constants/theme.ts verbatim),
# CSS, fonts, helpers, em-dash guard and canvas conventions. Rules: docs/design/market-2026-10-29/
# round-2.md (sets of three, straight up, the outlets) on top of spec.md (pig to pig, Bullion hosts).
# Art: every image is already uploaded to the canvas; the /_blob urls are read verbatim from
# blobs.json. The painted scenery (stall, bigboard, ring, basket, bullion_gavel) lives in art/ and its
# overlay coordinates below are measured off those 768px PNGs.
import json, os, datetime, random

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

# ── tokens (constants/theme.ts) ──────────────────────────────────────────────
INK = "#2a1f15"; PAPER = "#fffaf0"; CREAM = "#fbeee2"; CREAM2 = "#f6e6d4"; ROSE = "#ffd6dc"; ROSEDEEP = "#f8a8b3"
SAGE = "#c9dec1"; SUN = "#ffd87a"; LILAC = "#d6c8f0"; SKY = "#c8e3f0"; ACCENT = "#a03e2f"; GOLDINK = "#5A3F00"
SCRIM = "rgba(42,31,21,0.55)"
MUTE = "#605449"      # WHIMSY.mute, text-safe on every core pastel
MUTESOFT = "#8c7e71"  # WHIMSY.muteSoft, rules and boundaries only (never a word)
BARK = "#3a2c1e"; BARKTEXT = "#fff3e2"; BARKMUTE = "#e8d9c6"   # WHIMSY.bark trio: chalk on slate
DIRT = "#8d5a2c"; DIRTDEEP = "#74441e"; CORK = "#d9b27f"       # WHIMSY dirt pair (= WOOD rail), the Pen's cork
TAPE = "#EAD59E"; TAPEEDGE = "#C8AD77"                          # WHIMSY.tape pair (sawdust, masking tape)
SUCCESS = "#476436"                                              # UI_COLORS.successText
TINT = dict(maya="#E3E2E5", biscuit="#F5E6D6", you="#FDE4E8", pig=CREAM)  # PIG_ACCENT tints (pepper, biscuit, rosie)

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
.tape{{position:absolute;left:0;right:0;height:34px;background:{CREAM};border-top:2px solid {INK};border-bottom:2px solid {INK};overflow:hidden;display:flex;align-items:center;box-sizing:border-box}}
.track{{display:flex;align-items:center;white-space:nowrap;flex:none}}
.run{{animation:tape 46s linear infinite}}
@keyframes tape{{from{{transform:translateX(0)}}to{{transform:translateX(-50%)}}}}
.tk{{font-weight:800;font-size:11px;line-height:14px;letter-spacing:1.2px;text-transform:uppercase;padding:0 10px;display:inline-flex;align-items:center;gap:5px;height:30px;box-sizing:border-box}}
.tkHi{{background:{SUN};border-left:2px solid {INK};border-right:2px solid {INK};animation:flash 1.4s ease-in-out infinite}}
@keyframes flash{{0%,100%{{background:{SUN}}}50%{{background:{PAPER}}}}}
.sep{{font-size:12px;color:{MUTE}}}
@keyframes ding{{0%,100%{{transform:rotate(14deg)}}25%{{transform:rotate(30deg)}}75%{{transform:rotate(-2deg)}}}}
.ding{{animation:ding .9s ease-in-out infinite;transform-origin:50% 10%}}
@media (prefers-reduced-motion:reduce){{.run,.tkHi,.ding{{animation:none}}}}
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


# ── marks ────────────────────────────────────────────────────────────────────
def coin_mark(size=16):
    """The market's currency: a tiny TickleCoin (paper face, heavy rim, dashed minted ring, the rose
    chip on its shoulder). Reads as 'tickles ready', never as the pink snout (the tickled count)."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none">'
            f'<g transform="rotate(4 12 12)"><circle cx="12.6" cy="13" r="9.3" fill="{PAPER}" stroke="{INK}" stroke-width="2.4"/>'
            f'<circle cx="12.6" cy="13" r="5.5" fill="none" stroke="{INK}" stroke-width="1.2" stroke-dasharray="2.2 1.8" opacity=".45"/></g>'
            f'<circle cx="5.2" cy="5.4" r="3.7" fill="{ROSE}" stroke="{INK}" stroke-width="1.4"/></svg>')


def xmark():
    return f'<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="{INK}" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'


def pm_svg(plus):
    v = '<path d="M12 5 V19" stroke-linecap="round"/>' if plus else ""
    return (f'<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" stroke="{INK}" stroke-width="3.2" fill="none">'
            f'<path d="M5 12 H19" stroke-linecap="round"/>{v}</svg>')


def swap_mark(size=34, color=INK):
    """Straight up: two hand-drawn arrows passing each other."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 32 32" aria-hidden="true" style="flex:none" fill="none" stroke="{color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M5 11 H25 M20 6 L25.5 11 L20 16"/><path d="M27 21 H7 M12 16 L6.5 21 L12 26"/></svg>')


def nm(n):
    """A price inside a sentence still wears the numeral face."""
    return f'<span class="numIn">{n}</span>'


def price(n, cls="numeral", mark=15, gap=3, style=""):
    return f'<span style="display:inline-flex;align-items:center;gap:{gap}px;white-space:nowrap;{style}"><span class="{cls}">{n}</span>{coin_mark(mark)}</span>'


def each(total, n=3):
    """The price per find, printed beside every set price."""
    if n == 1:
        return "goes alone"
    return f"{total // n} each" if total % n == 0 else f"about {round(total / n)} each"


def set_price(total, cls="numeral", mark=15, n=3, sub_cls="kicker mute", stack=False):
    sub = f'<span class="{sub_cls}" style="white-space:nowrap">{each(total, n)}</span>'
    d = "column" if stack else "row"
    al = "flex-end" if stack else "baseline"
    return (f'<span style="display:inline-flex;flex-direction:{d};align-items:{al};gap:{0 if stack else 6}px">'
            f'{price(total, cls, mark)}{sub}</span>')


# ── pieces (round 1) ─────────────────────────────────────────────────────────
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
    """TickleCoin (components/TickleCoin.tsx) drawn small: paper face, heavy rim, sticker shadow, 4deg
    lean, dashed minted ring, rose chip, Caprasimo count, hand cap. Past 25 the cap reads 'banked'."""
    chip = max(20, round(size * .3))
    fs = round(size * .4)
    capfs = 13 if size < 90 else 15
    spoken = f"{n} {'tickles banked' if cap == 'banked' else cap + ' tickles ready'}"
    lab = f'<div class="handT" style="text-align:center;white-space:nowrap">{label}</div>' if label else ""
    return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:none">'
            f'<button type="button" class="btn" aria-label="{spoken}" style="position:relative;width:{size}px;height:{size}px;border-radius:999px;border:3px solid {INK};background:{PAPER};box-shadow:4px 4px 0 {INK};transform:rotate(4deg);display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:0;text-align:center">'
            f'<span aria-hidden="true" style="position:absolute;inset:{4 if size < 80 else 6}px;border-radius:999px;border:2px dashed {INK};opacity:.3"></span>'
            f'<span aria-hidden="true" style="position:absolute;top:-8px;left:-8px;width:{chip}px;height:{chip}px;border-radius:999px;border:2px solid {INK};background:{ROSE};box-shadow:2px 2px 0 {INK};transform:rotate(-8deg);display:flex;align-items:center;justify-content:center;box-sizing:border-box">'
            f'<img src="{A["g_star"]}" alt="" style="width:{round(chip * .62)}px;height:{round(chip * .62)}px;object-fit:contain"></span>'
            f'<span class="whimsy" style="font-size:{fs}px;line-height:{fs + 2}px;margin-top:-2px">{n}</span>'
            f'<span class="hand mute" style="font-size:{capfs}px;line-height:{capfs + 2}px;margin-top:-2px">{cap}</span></button>{lab}</div>')


def corner_coin(n, cap="of 25", size=60, top=10, label=""):
    return f'<div style="position:absolute;right:16px;top:{top}px">{coin(n, cap, size, label)}</div>'


def back_link(text, href, top=14, left=16):
    return (f'<a href="{href}" class="flat" style="position:absolute;left:{left}px;top:{top}px;display:inline-flex;align-items:center;gap:6px;'
            f'background:{CREAM};border-radius:999px;padding:0 14px 0 12px;min-height:44px;color:{INK};z-index:3"><span class="cardTitleSm" style="font-size:18px">&#8249;</span><span class="label">{text}</span></a>')


def section_header(t, sub=None, style="", cls="sectionTitle"):
    s = f'<div class="handT mute" style="white-space:nowrap">{sub}</div>' if sub else ""
    return f'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;{style}"><div class="{cls}">{t}</div>{s}</div>'


def hand_line(text, cls="handT mute", align="center", style=""):
    return f'<div class="{cls}" style="text-align:{align};{style}">{text}</div>'


def bull_say(img, inner, color=PAPER, size=84, rot=-1.2, alt="Bullion the bull", shadow="sm"):
    return (f'<div style="display:flex;align-items:center;gap:6px"><img src="{img}" alt="{alt}" style="width:{size}px;height:{size}px;object-fit:contain;flex:none">'
            f'{sticker(inner, color=color, radius=18, rot=rot, shadow=shadow, style="flex:1;min-width:0", pad="8px 12px")}</div>')


def face(who, size=24, ring=1.5):
    """A pig's face. Friends carry their pig (Maya's Pepper); a pig we don't know is the plain pig face."""
    if who in ("maya", "you"):
        # the pig paintings are whole bodies; zoom the circle onto the face (upper middle-right)
        img, bg, fx, fy = (A["pepper"], TINT["maya"], .6, .38) if who == "maya" else (A["rosie"], TINT["you"], .55, .36)
        z = size * 1.9
        return (f'<span aria-hidden="true" class="flat" style="position:relative;display:inline-block;width:{size}px;height:{size}px;border-radius:999px;background:{bg};overflow:hidden;flex:none;border-width:{ring}px">'
                f'<img src="{img}" alt="" style="position:absolute;width:{z:.1f}px;height:{z:.1f}px;left:{size / 2 - fx * z - ring:.1f}px;top:{size / 2 - fy * z - ring:.1f}px;max-width:none"></span>')
    bg = TINT["biscuit"] if who == "biscuit" else CREAM
    p = max(2, round(size * .12))
    return f'<img src="{A["g_pigface"]}" alt="" aria-hidden="true" class="flat" style="width:{size}px;height:{size}px;border-radius:999px;background:{bg};object-fit:contain;padding:{p}px;flex:none;border-width:{ring}px">'


def glyph(fid, size=34, style="", alt=""):
    a = f'alt="{alt}"' if alt else 'alt="" aria-hidden="true"'
    return f'<img src="{A[fid]}" {a} style="width:{size}px;height:{size}px;object-fit:contain;flex:none;{style}">'


def trio(fid, size=26, overlap=0.42):
    """Three of one find, overlapped: the set in a line of text."""
    n = 1 if fid == "tin_whistle" else 3
    gl = "".join(glyph(fid, size, f"margin-left:{0 if i == 0 else -round(size * overlap)}px;transform:rotate({(-6, 5, -2)[i]}deg)") for i in range(n))
    return f'<span style="display:inline-flex;align-items:center;flex:none">{gl}</span>'


def ticket(stub, cap, label, href=None, tone="golden", stub_right=True, aria=None, style="", h=64):
    """TicketButton. The market's commits read as a sentence, so the stub (the price) tears off the
    RIGHT end: 'Buy for | 12 tickles'. Price stated once, on the stub."""
    face_c, stub_c = {"golden": (SUN, ROSE), "paper": (PAPER, CREAM), "season": (ROSE, LILAC)}[tone]
    ink = GOLDINK if tone == "golden" else INK
    side = "left" if stub_right else "right"
    stub_el = (f'<div style="width:64px;flex:none;background:{stub_c};border-{side}:2px dashed {INK};display:flex;flex-direction:column;align-items:center;justify-content:center">'
               f'<div class="numeralLg" style="font-size:24px;line-height:26px">{stub}</div><div class="kickerPillSm mute" style="letter-spacing:1px">{cap}</div></div>')
    face_el = (f'<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 8px;text-align:center;min-width:0">'
               f'<div class="label" style="font-size:15px;line-height:19px;color:{ink};white-space:nowrap">{label}</div></div>')
    inner = face_el + stub_el if stub_right else stub_el + face_el
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    ar = f' aria-label="{aria}"' if aria else ""
    return (f'<{tag}{attr}{ar} class="sticker btn" style="display:flex;height:{h}px;border-radius:14px;overflow:hidden;background:{face_c};color:{INK};padding:0;box-sizing:border-box;{style}">{inner}</{tag}>')


def pill_btn(text, href=None, fill=CREAM, shadow="flat", style="", aria=None):
    cls = {"flat": "flat", "sm": "stickerSm", "sticker": "sticker"}[shadow]
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    ar = f' aria-label="{aria}"' if aria else ""
    return (f'<{tag}{attr}{ar} class="{cls} btn" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:{fill};border-radius:999px;'
            f'padding:0 14px;min-height:44px;color:{INK};box-sizing:border-box;{style}"><span class="label" style="font-size:13px;white-space:nowrap">{text}</span></{tag}>')


def segmented(options, chosen):
    segs = ""
    for o in options:
        on = o == chosen
        segs += (f'<button type="button" class="btn" aria-pressed="{"true" if on else "false"}" style="flex:1;min-height:44px;border-radius:999px;'
                 f'border:1.5px solid {INK if on else "transparent"};background:{SUN if on else "transparent"};display:flex;align-items:center;justify-content:center;padding:0 6px">'
                 f'<span class="label" style="font-size:13px;color:{INK if on else MUTE};white-space:nowrap">{o}</span></button>')
    return f'<div class="flat" style="display:flex;gap:4px;padding:4px;border-radius:999px;background:{PAPER}">{segs}</div>'


def stepper(n, band, big=52):
    rb = f'border-radius:999px;background:{CREAM};width:52px;height:52px;display:flex;align-items:center;justify-content:center;padding:0;flex:none'
    return (f'<div style="display:flex;align-items:center;justify-content:center;gap:22px">'
            f'<button type="button" class="stickerSm btn" aria-label="One less" style="{rb}">{pm_svg(False)}</button>'
            f'<div style="display:flex;align-items:center;gap:6px;min-width:96px;justify-content:center"><span class="whimsy" style="font-size:{big}px;line-height:{big + 2}px">{n}</span>{coin_mark(26)}</div>'
            f'<button type="button" class="stickerSm btn" aria-label="One more" style="{rb}">{pm_svg(True)}</button></div>'
            f'<div class="handT mute" style="text-align:center;margin-top:2px">{band}</div>')


def sheet(kicker, title, body, footer, top, scene, close_href):
    h = scene + f'<div style="position:absolute;inset:0;background:{SCRIM};z-index:4"></div>'
    h += (f'<div style="position:absolute;left:0;right:0;top:{top}px;bottom:0;background:{PAPER};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;box-sizing:border-box;display:flex;flex-direction:column;z-index:5">'
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


# ── new pieces (round 2) ─────────────────────────────────────────────────────
def basket(fid, size, n=None, alt=None, style=""):
    """THE picture of a set: the gingham basket with three of one find nestled in it. A second copy
    of the basket, clipped to its front half, sits over the finds so their feet sink below the rim."""
    n = n or (1 if fid == "tin_whistle" else 3)
    g = size * (0.42 if n == 1 else 0.34)
    spots = [(0.5, 0.52, -4)] if n == 1 else [(0.33, 0.505, -10), (0.67, 0.505, 9), (0.5, 0.545, -3)]
    label = alt or (f"a basket of {n} {PL[fid]}" if n > 1 else f"a {NAMES[fid]}, alone in a basket")
    h = f'<div role="img" aria-label="{label}" style="position:relative;width:{size}px;height:{size}px;flex:none;{style}">'
    h += f'<img src="{A["basket"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%">'
    for cx, bot, rot in spots:
        h += (f'<img src="{A[fid]}" alt="" style="position:absolute;left:{cx * size - g / 2:.1f}px;top:{bot * size - g:.1f}px;'
              f'width:{g:.1f}px;height:{g:.1f}px;object-fit:contain;transform:rotate({rot}deg)">')
    h += f'<img src="{A["basket"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;clip-path:inset(49.5% 0 0 0)">'
    return h + "</div>"


def status_tag(kind):
    """live / new / later, the outlet's state."""
    bg, cls, txt = {"live": (SAGE, "flat", "live"), "new": (SUN, "stickerSm", "new"), "later": (CREAM, "dashed", "later")}[kind]
    return (f'<span class="{cls} kickerPillSm" style="display:inline-flex;align-items:center;background:{bg};border-radius:999px;padding:3px 10px;'
            f'{"border-width:1.5px;" if kind != "new" else ""}color:{INK if kind != "later" else MUTE}">{txt}</span>')


def ribbon(text, w=250, h=46, fill=SUN, rot=-2, sub=None):
    """A notched prize ribbon: a good sale is a moment."""
    n = 14
    pts = f"2,2 {w - 2},2 {w - 2 - n},{h / 2} {w - 2},{h - 2} 2,{h - 2} {n + 2},{h / 2}"
    sub_el = f'<div class="kicker" style="margin-top:-2px">{sub}</div>' if sub else ""
    return (f'<div role="img" aria-label="{text}" style="position:relative;width:{w}px;height:{h}px;transform:rotate({rot}deg);flex:none">'
            f'<svg width="{w + 4}" height="{h + 4}" viewBox="0 0 {w + 4} {h + 4}" aria-hidden="true" style="position:absolute;left:0;top:0">'
            f'<polygon points="{" ".join(f"{float(p.split(",")[0]) + 3},{float(p.split(",")[1]) + 3}" for p in pts.split())}" fill="{INK}"/>'
            f'<polygon points="{pts}" fill="{fill}" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/></svg>'
            f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 {n + 8}px;text-align:center">'
            f'<div class="cardTitleSm" style="white-space:nowrap">{text}</div>{sub_el}</div></div>')


def stamp(fid, size=74, rot=-4, color=ROSE, caption=None, missing=False):
    """A Stamp Book stamp: a paper margin, a dashed perforation line, the find painted inside."""
    cap = SHORT[fid] if caption is None else caption
    inner_bg = CREAM2 if missing else color
    art = (f'<span class="kickerPillSm mute">missing</span>' if missing else glyph(fid, round(size * .5)))
    cap_el = f'<span class="kickerPillSm" style="font-size:8px;letter-spacing:.6px">{cap}</span>' if cap else ""
    return (f'<div class="stickerSm" style="width:{size}px;background:{PAPER};border-radius:4px;padding:4px;transform:rotate({rot}deg);flex:none;box-sizing:border-box">'
            f'<div style="border:1.5px dashed {INK};border-radius:2px;background:{inner_bg};height:{round(size * .72)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;box-sizing:border-box">'
            f'{art}{cap_el}</div></div>')


def order_slip(who, fid, pay, sub, w=150, rot=-1.5, pin=True, action=None, gl=18):
    """One of Bullion's Orders: a paper slip pinned to the board."""
    pin_el = (f'<span aria-hidden="true" style="position:absolute;top:-7px;left:50%;margin-left:-7px;width:14px;height:14px;border-radius:999px;'
              f'background:{ROSEDEEP};border:2px solid {INK};box-sizing:border-box"></span>' if pin else "")
    act = f'<div style="margin-top:6px">{action}</div>' if action else ""
    return (f'<div class="stickerSm" style="position:relative;width:{w}px;background:{PAPER};border-radius:6px;padding:8px 8px 6px 8px;transform:rotate({rot}deg);box-sizing:border-box">'
            + (f'{pin_el}<div class="kickerPillSm acc">{who}</div>'
               f'<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:1px">{trio(fid, gl)}{price(pay, "numeral", 14, style="font-size:18px")}</div>'
               if w < 130 else
               f'{pin_el}<div style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
               f'<span class="kickerPillSm acc clip">{who}</span>{price(pay, "numeral", 14, style="font-size:18px")}</div>'
               f'<div style="display:flex;align-items:center;gap:4px;margin-top:1px">{trio(fid, gl)}<span class="handT clip" style="line-height:16px">3 {PL[fid]}</span></div>')
            + f'<div class="kicker mute" style="line-height:15px;margin-top:2px">{sub}</div>{act}</div>')


def ticker(items, hi=None, run=False, top=0):
    """Ticker tape: real deals, newest first. items are HTML strings."""
    seg = ""
    for i, t in enumerate(items):
        seg += f'<span class="tk{" tkHi" if i == hi else ""}">{t}</span><span class="sep" aria-hidden="true">&#10022;</span>'
    track = f'<div class="track{" run" if run else ""}">{seg}{seg if run else ""}</div>'
    return f'<div class="tape" role="marquee" aria-label="Latest deals" style="top:{top}px;z-index:2">{track}</div>'


def deal(who_verb, fid, p, move=None):
    mv = f' &middot; {move}' if move else ""
    n = "a" if fid == "tin_whistle" else "3"
    what = NAMES[fid] if fid == "tin_whistle" else PL[fid]
    return f'{who_verb} {n} {what} &middot; {nm(p)}{mv}'


def slate_panel(inner, h, k=0.9, ox=162, oy=158, style="", pad="8px 12px", cls="stickerSm"):
    """A panel cut from the Big Board's own painted slate (the art as a cropped background), so the
    chalk reads as written on the same board."""
    bs = 768 * k
    return (f'<div class="{cls}" style="position:relative;height:{h}px;border-radius:14px;overflow:hidden;box-sizing:border-box;padding:{pad};'
            f'background:{BARK} url({A["bigboard"]}) {-ox * k:.1f}px {-oy * k:.1f}px/{bs:.1f}px {bs:.1f}px no-repeat;{style}">{inner}</div>')


def chalk_chart(days, prices, w=330, h=86, label=None):
    n = len(prices)
    x0, x1 = 16, w - 16
    step = (x1 - x0) / (n - 1)
    lo, hi = min(prices) - 0.6, max(prices) + 0.6
    top, bot = 20, h - 20

    def y(p):
        return top + (hi - p) / (hi - lo) * (bot - top)
    pts = [(x0 + i * step, y(p)) for i, p in enumerate(prices)]
    poly = " ".join(f"{x:.1f},{yy:.1f}" for x, yy in pts)
    s = (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{label or "Last set sold each day"}: '
         + ", ".join(f"{d} {p}" for d, p in zip(days, prices)) + '" style="display:block">')
    s += f'<polyline points="{poly}" fill="none" stroke="{BARKTEXT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>'
    for i, ((x, yy), p, d) in enumerate(zip(pts, prices, days)):
        last = i == n - 1
        s += f'<circle cx="{x:.1f}" cy="{yy:.1f}" r="{6 if last else 3.6}" fill="{SUN if last else BARKTEXT}"/>'
        s += f'<text x="{x:.1f}" y="{yy - (10 if last else 8):.1f}" text-anchor="middle" font-family="Caprasimo, serif" font-size="{15 if last else 12}" fill="{SUN if last else BARKTEXT}">{p}</text>'
        s += f'<text x="{x:.1f}" y="{h - 3}" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="13" fill="{BARKMUTE}">{d}</text>'
    return s + "</svg>"


def outlet_line(img, text, color=PAPER, cls="flat", img_size=30, style=""):
    """One outlet, printed under a set with the buyer's gain spelled out."""
    return (f'<div class="{cls}" style="display:flex;align-items:center;gap:8px;background:{color};border-radius:12px;padding:4px 10px 4px 6px;{style}">'
            f'<img src="{img}" alt="" aria-hidden="true" style="width:{img_size}px;height:{img_size}px;object-fit:contain;flex:none">'
            f'<div class="handT" style="min-width:0;line-height:18px">{text}</div></div>')


def chip(text, color=CREAM, cls="flat", style=""):
    return f'<span class="{cls}" style="display:inline-flex;align-items:center;gap:5px;background:{color};border-radius:999px;padding:2px 10px;border-width:1.5px;white-space:nowrap;{style}">{text}</span>'


def sold_high(n, sub="over the Sheep", style=""):
    return chip(f'<span class="kicker">sold high today</span><span class="numeral" style="color:{SUCCESS}">+{n}</span><span class="kicker mute">{sub}</span>',
                PAPER, "stickerSm", style)


# ── scenery: the square ──────────────────────────────────────────────────────
def cobbles(top, bottom=844, w=390, seed=7):
    rnd = random.Random(seed)
    hh = bottom - top
    s = f'<svg width="{w}" height="{hh}" viewBox="0 0 {w} {hh}" aria-hidden="true" style="position:absolute;left:0;top:{top}px">'
    s += f'<rect width="{w}" height="{hh}" fill="{CREAM2}"/>'
    y, row = 4, 0
    while y < hh + 30:
        rh = 13 + row * 1.5
        rw = rh * 2.1
        x = -rw / 2 if row % 2 else -rw * 0.1
        while x < w + rw:
            s += (f'<ellipse cx="{x + rw / 2 + rnd.uniform(-2, 2):.1f}" cy="{y + rh / 2 + rnd.uniform(-1.2, 1.2):.1f}" rx="{rw / 2 - 3:.1f}" ry="{rh / 2 - 2.6:.1f}" '
                  f'fill="{CREAM}" stroke="{MUTESOFT}" stroke-width="1.4" opacity=".9"/>')
            x += rw
        y += rh
        row += 1
    s += f'<line x1="0" y1="1" x2="{w}" y2="1" stroke="{INK}" stroke-width="2"/></svg>'
    return s


def bunting(y, w=390, sag=16, flags=None, x0=-12, x1=None):
    x1 = w + 12 if x1 is None else x1
    flags = flags or [ROSE, PAPER, SUN, ROSEDEEP, CREAM]
    s = f'<svg width="{w}" height="{y + sag + 40}" viewBox="0 0 {w} {y + sag + 40}" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none">'
    s += f'<path d="M{x0} {y} Q {(x0 + x1) / 2} {y + sag * 2} {x1} {y}" fill="none" stroke="{INK}" stroke-width="2"/>'
    n = int((x1 - x0) / 32)
    for i in range(n):
        t = (i + 0.5) / n
        px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * (x0 + x1) / 2 + t ** 2 * x1
        py = (1 - t) ** 2 * y + 2 * (1 - t) * t * (y + sag * 2) + t ** 2 * y
        s += (f'<polygon points="{px - 11:.1f},{py:.1f} {px + 11:.1f},{py:.1f} {px:.1f},{py + 24:.1f}" fill="{flags[i % len(flags)]}" '
              f'stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/>')
    return s + "</svg>"


def crate(w=92, h=38):
    planks = "".join(f'<div style="height:{(h - 4) / 2 - 1:.0f}px;border-bottom:{"2px solid " + DIRTDEEP if i == 0 else "0"}"></div>' for i in range(2))
    return (f'<div aria-hidden="true" class="stickerSm" style="width:{w}px;height:{h}px;background:{DIRT};border-radius:6px;overflow:hidden">{planks}</div>')


# Stall art (768px): the chalk sign, the two baskets on the counter, the counter's front plank.
STALL_SIGN = (122, 386, 218, 497)
STALL_BASKET = {"L": dict(cx=376, rim=446, x0=262, x1=490, y1=532, gw=88),
                "R": dict(cx=598, rim=456, x0=494, x1=706, y1=532, gw=80)}
STALL_PLANK = (112, 590, 656, 714)


def stall(w, sign="", left=None, right=None, ltag=None, rtag=None, plank="", alt="A market stall", href=None, tag_fs=13):
    s = w / 768
    tagn = "a" if href else "div"
    attr = f' href="{href}" aria-label="{alt}"' if href else f' role="img" aria-label="{alt}"'
    h = f'<{tagn}{attr} style="position:relative;display:block;width:{w}px;height:{w}px;flex:none;color:{INK}">'
    h += f'<img src="{A["stall"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%">'
    if sign:
        x0, y0, x1, y1 = STALL_SIGN
        h += (f'<div style="position:absolute;left:{x0 * s:.1f}px;top:{y0 * s:.1f}px;width:{(x1 - x0) * s:.1f}px;height:{(y1 - y0) * s:.1f}px;'
              f'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;transform:rotate(-1deg)">{sign}</div>')
    for side, fid, tg in (("L", left, ltag), ("R", right, rtag)):
        if not fid:
            continue
        b = STALL_BASKET[side]
        g = b["gw"] * s
        spots = [(0, 2, -4)] if fid == "tin_whistle" else [(-0.52, 0, -9), (0.52, 0, 8), (0, 7, -2)]
        for dx, dy, rot in spots:
            cx = b["cx"] * s + dx * g
            bottom = (b["rim"] + dy) * s
            h += (f'<img src="{A[fid]}" alt="" style="position:absolute;left:{cx - g / 2:.1f}px;top:{bottom - g:.1f}px;width:{g:.1f}px;height:{g:.1f}px;'
                  f'object-fit:contain;transform:rotate({rot}deg)">')
        h += (f'<img src="{A["stall"]}" alt="" style="position:absolute;inset:0;width:100%;height:100%;'
              f'clip-path:inset({(b["rim"] - 8) / 7.68:.2f}% {(768 - b["x1"]) / 7.68:.2f}% {(768 - b["y1"]) / 7.68:.2f}% {b["x0"] / 7.68:.2f}%)">')
        if tg:
            h += (f'<div style="position:absolute;left:{b["cx"] * s:.1f}px;top:{(b["rim"] + 22) * s:.1f}px;transform:translateX(-50%) rotate({-4 if side == "L" else 3}deg)">'
                  f'<div class="stickerSm" style="background:{PAPER};border-radius:6px;padding:0 6px;display:flex;align-items:center;gap:2px;white-space:nowrap;border-width:1.5px">'
                  f'<span class="whimsy" style="font-size:{tag_fs}px;line-height:{tag_fs + 5}px">{tg}</span>{coin_mark(round(tag_fs * .85))}</div></div>')
    if plank:
        x0, y0, x1, y1 = STALL_PLANK
        h += (f'<div style="position:absolute;left:{x0 * s:.1f}px;top:{y0 * s:.1f}px;width:{(x1 - x0) * s:.1f}px;height:{(y1 - y0) * s:.1f}px;'
              f'display:flex;align-items:center;justify-content:center">{plank}</div>')
    return h + f'</{tagn}>'


def plank_label(who, name, fs=13, fsize=22):
    return (f'<div class="stickerSm" style="display:flex;align-items:center;gap:5px;background:{PAPER};border-radius:999px;padding:1px 9px 1px 2px;transform:rotate(-1.5deg);border-width:1.5px;white-space:nowrap">'
            f'{face(who, fsize, 1.2)}<span class="whimsy" style="font-size:{fs}px;line-height:{fs + 6}px">{name}</span></div>')


def chalk_sign(top, mid_fid=None, bottom=None, gs=16, fs=12):
    m = glyph(mid_fid, gs) if mid_fid else ""
    t = f'<div class="chalk" style="font-size:{fs - 2}px;line-height:{fs}px;letter-spacing:.6px;color:{SUN}">{top}</div>' if top else ""
    b = f'<div class="chalkNum" style="font-size:{fs + 2}px;line-height:{fs + 4}px">{bottom}</div>' if bottom else ""
    return t + m + b


# ═════════════════════════════════════════════════════════════════════════════
# ROW 0 · The rules and the outlets (one wide board)
# ═════════════════════════════════════════════════════════════════════════════
RW, RH = 1240, 820


def rule_card(kicker, title, body, w, color=PAPER, rot=0.0, shadow="sticker"):
    return sticker(f'<div class="kickerPill acc">&#9733; {kicker}</div><div class="sectionTitle" style="margin-top:2px">{title}</div>{body}',
                   color=color, radius=22, rot=rot, shadow=shadow, pad="14px 18px", style=f"width:{w}px;height:300px;display:flex;flex-direction:column")


def bullet(text):
    return (f'<div style="display:flex;gap:8px;align-items:baseline"><span aria-hidden="true" style="width:7px;height:7px;border-radius:999px;background:{INK};flex:none;transform:translateY(-2px)"></span>'
            f'<span class="handLg" style="line-height:21px">{text}</span></div>')


SET_CARD = rule_card("A SET", "A set is three", (
    f'<div style="display:flex;align-items:center;gap:14px;flex:1;min-height:0">'
    + basket("pinecone", 168)
    + f'<div style="display:flex;flex-direction:column;gap:7px;min-width:0">'
    f'<div style="display:flex;align-items:baseline;gap:8px">{price(12, "displayLg", 24, 4)}<span class="handLg mute">4 each</span></div>'
    + bullet("three of one find, for every find")
    + bullet("the price per find sits beside every set price, so every pinecone compares")
    + f'<div style="display:flex;align-items:center;gap:8px;margin-top:2px">{basket("tin_whistle", 62)}'
    f'<div style="display:flex;flex-direction:column"><span class="cardTitleSm">The tin whistle goes alone</span>'
    f'<span class="handT mute">one rare find is its own lot</span></div></div>'
    + '</div></div>'), 432, SUN, -0.7)

SWAP_CARD = rule_card("STRAIGHT UP", "Swap, no tickles", (
    f'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px">'
    + basket("pinecone", 112) + swap_mark(40)
    + f'<div class="stickerSm" style="width:90px;height:90px;border-radius:18px;background:{CREAM};display:flex;align-items:center;justify-content:center;transform:rotate(3deg)">{glyph("old_key", 68)}</div></div>'
    f'<div class="cardTitle" style="text-align:center;margin-top:2px">3 pinecones for 1 old key</div>'
    f'<div style="display:flex;flex-direction:column;gap:3px;margin-top:6px">'
    + bullet("give one set, ask for 1 to 3 of one other find")
    + bullet("both sides move at once; nothing minted")
    + bullet("it shows under both finds")
    + '</div>'), 380, PAPER, 0.5)

MONEY_CARD = rule_card("THE MONEY", "The coin", (
    f'<div style="display:flex;align-items:center;gap:12px;margin-top:8px">{coin(18, size=74, label="before")}'
    f'<div class="handLg mute" aria-hidden="true">&rarr;</div>{coin(32, "banked", 74, "after a sale")}</div>'
    f'<div style="display:flex;flex-direction:column;gap:3px;margin-top:10px">'
    + bullet("tickles ready: the same coin you tickle Rosie with")
    + bullet("buying spends it; selling high piles it up, and past 25 is fine")
    + bullet("the tickled total and the Board never move")
    + '</div>'), 340, CREAM, -0.4)


def outlet_card(kind, art, name, wants, gain, rot):
    later = kind == "later"
    bg = CREAM2 if later else PAPER
    cls = "dashed" if later else ("sticker" if kind == "new" else "stickerSm")
    return (f'<div class="{cls}" style="width:186px;height:296px;background:{bg};border-radius:18px;padding:12px 12px 10px 12px;display:flex;flex-direction:column;gap:6px;transform:rotate({rot}deg);box-sizing:border-box">'
            f'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px"><div style="height:64px;display:flex;align-items:center">{art}</div>{status_tag(kind)}</div>'
            f'<div class="cardTitle" style="line-height:21px">{name}</div>'
            f'<div class="handT" style="line-height:18px;{"color:" + MUTE if later else ""}">{wants}</div>'
            f'<div style="flex:1"></div>'
            f'<div class="flat" style="background:{CREAM if not later else PAPER};border-radius:12px;padding:6px 8px;border-width:1.5px">'
            f'<div class="kickerPillSm acc" style="margin-bottom:2px">your gain</div><div class="handT" style="line-height:18px">{gain}</div></div></div>')


def gimg(key, size=60, style=""):
    return f'<img src="{A[key]}" alt="" aria-hidden="true" style="width:{size}px;height:{size}px;object-fit:contain;flex:none;{style}">'


STAMPS = (f'<div style="display:flex;gap:4px;align-items:center">{stamp("pinecone", 48, -6, caption="")}'
          f'{stamp("clover", 48, 4, SAGE, caption="")}</div>')
SLIP = (f'<div class="stickerSm" style="width:84px;background:{PAPER};border-radius:6px;padding:5px 6px;transform:rotate(-4deg);box-sizing:border-box">'
        f'<div class="kickerPillSm acc" style="font-size:8px;letter-spacing:1px">THE MILLER</div>'
        f'<div style="display:flex;align-items:center;justify-content:space-between">{trio("red_berries", 18)}{price(14, "numeral", 12)}</div></div>')
BENCH = (f'<div style="display:flex;align-items:center;gap:2px">{trio("pinecone", 22, .5)}<span class="cardTitleSm">+</span>{trio("red_berries", 22, .5)}</div>')

OUTLETS = "".join([
    outlet_card("live", gimg("ghost_sheep", 64), "The Ghost Sheep",
                f"Singles, once a day: {nm(3)} for a common, {nm(6)} when he fancies it. Pairs pay half again; three alike trade up.",
                f"Your Sheep fancies clovers today. Pay {nm(12)} for three, he pays {nm(18)}: up {nm(6)}.", -0.8),
    outlet_card("live", f'<div style="display:flex;align-items:center">{gimg("g_gift", 54)}{face("biscuit", 34)}</div>', "A friend&#8217;s wish",
                "One find a friend&#8217;s pig is hoping for. Hand it over and you both get 3.",
                f"Biscuit hopes for a pinecone. Swap 3 river pebbles for 1 straight up, hand it over: {nm(3)} each.", 0.6),
    outlet_card("new", STAMPS, "The Stamp Book",
                "Hand Bullion a set, get that find&#8217;s stamp. Every four stamps unlock a cosmetic. Mints nothing.",
                f"Missing the pinecone stamp? Pay {nm(12)} for a set and fill the page.", -0.5),
    outlet_card("new", SLIP, "Bullion&#8217;s Orders",
                "Your own menu of town orders. Accept one, a week to fill it, two a week. Pays above the Sheep.",
                f"Pay {nm(11)} for these three, fill your miller&#8217;s order for {nm(14)}: up {nm(3)}.", 0.7),
    outlet_card("later", BENCH, "The workbench",
                "Sets in a recipe: 3 pinecones and 3 red berries make a table decoration.",
                "Holding the berries? The pinecones finish the recipe.", -0.4),
    outlet_card("later", f'<div style="display:flex;align-items:center;gap:2px">{gimg("g_friends", 56)}{gimg("g_barn", 44)}</div>', "The herd&#8217;s Larder",
                "Sets stocked for The Feast, all together. A keepsake for chipping in.",
                "Your herd fills the Larder; you keep the keepsake.", 0.5),
])

R0 = page("0 The rules and the outlets", (
    f'<div class="root" style="width:{RW}px;height:{RH}px;padding:24px 32px">'
    f'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px">'
    f'{crown("ROUND 2 · THE SAME ON EVERY ROW", "The rules and the outlets", "Only the look changes below, plus the Sale Ring&#8217;s auctions.")}'
    f'<div style="width:560px">'
    + bull_say(A["bull_a"], f'<div class="handLg">Every outlet a find has is printed on its page, with what you&#8217;d gain. Sell high to a pig who needs it. Up, up, up!</div>', size=96, rot=1)
    + '</div></div>'
    f'<div style="display:flex;gap:28px;margin-top:14px;align-items:flex-start">{SET_CARD}{SWAP_CARD}{MONEY_CARD}</div>'
    + section_header("Who pays for a find: the outlets", "printed on every find, with the buyer&#8217;s gain spelled out", "margin-top:20px")
    + f'<div style="display:flex;gap:12px;margin-top:12px">{OUTLETS}</div>'
    + '</div>'), RW, RH)

# ═════════════════════════════════════════════════════════════════════════════
# ROW A · The Market Square (a farmers' market)
# Story: your Sheep fancies clovers today and your miller wants red berries; Maya's Sheep fancies
# pinecones, so she wants yours. Every pig's fancy differs, which is why they trade.
# ═════════════════════════════════════════════════════════════════════════════
def a1():
    h = f'<div style="position:absolute;inset:0;background:{SKY}"></div>'
    h += cobbles(292)
    h += bunting(116, sag=12)
    h += ab(16, 14, crown("BULLION&#8217;S MARKET", "The Square"))
    h += corner_coin(18, size=58, top=10, label="tickles ready")
    h += ab(16, 84, sold_high(5))
    # Bullion on his crate, ringing the bell; a speech sticker; the noticeboard
    h += ab(12, 158, sticker(f'<div class="handT">Ding! Maya wants pinecones. Who&#8217;s got three?</div>', PAPER, 16, -2, "sm", pad="6px 10px"), w=124)
    h += ab(130, 152, f'<img src="{A["bull_a"]}" alt="Bullion on his crate in the middle of the square" style="width:116px;height:116px;object-fit:contain">')
    h += ab(142, 256, crate(92, 36))
    h += ab(218, 166, f'<img class="ding" src="{A["g_bell"]}" alt="" aria-hidden="true" style="width:36px;height:36px;object-fit:contain">')
    board = (f'<div class="kickerPillSm" style="margin-bottom:6px">&#9733; Today&#8217;s orders</div>'
             + f'<a href="A2.dc.html" aria-label="Your miller wants 3 red berries for 14: Maya has a set" style="display:block;color:{INK}">'
             + order_slip("THE MILLER", "red_berries", 14, "3 red berries &middot; yours, 5 days", w=112, rot=-2, gl=16) + '</a>')
    h += ab(250, 142, f'<div class="sticker" style="width:128px;height:126px;background:{CORK};border-radius:12px;padding:8px 8px;box-sizing:border-box;transform:rotate(1.2deg)">{board}</div>')
    # the stall row, friends first
    h += ab(14, 298, f'<div class="kickerPill" style="background:{PAPER};border:1.5px solid {INK};border-radius:999px;padding:3px 10px">stalls today &middot; friends first</div>')
    h += ab(316, 298, f'<span class="handT mute">swipe &rsaquo;</span>')
    row = (stall(172, chalk_sign("WANTS", "pinecone", "13", gs=13, fs=10), "clover", "red_berries", "12", "11",
                 plank_label("maya", "Maya&#8217;s", 12, 18), alt="Maya's stall: 3 clovers for 12, 3 red berries for 11; wants pinecones at 13", href="A2.dc.html", tag_fs=12)
           + stall(172, chalk_sign("", "old_key", "29", gs=13, fs=10), "old_key", "honeycomb", "29", "26",
                   plank_label("biscuit", "Biscuit&#8217;s", 12, 18), alt="Biscuit's stall: 3 old keys for 29, 3 honeycomb chips for 26", tag_fs=12)
           + stall(172, chalk_sign("", "snail_shell", "10", gs=13, fs=10), "snail_shell", "river_pebble", "10", "9",
                   plank_label("pig", "a pig&#8217;s", 12, 18), alt="a pig's stall: 3 snail shells for 10, 3 river pebbles for 9", tag_fs=12))
    h += ab(4, 318, f'<div style="display:flex;gap:6px;width:600px">{row}</div>')
    # demand, visible
    wants = (f'<div style="display:flex;align-items:center;gap:8px">'
             f'<span class="kickerPillSm acc" style="flex:none">&#9733; wanted</span>'
             f'<span style="display:inline-flex;align-items:center;gap:4px">{trio("pinecone", 20)}<span class="handT">Maya pays {nm(13)}</span></span>'
             f'<span class="handT mute">&middot;</span>'
             f'<span style="display:inline-flex;align-items:center;gap:4px">{trio("old_key", 20)}<span class="handT">a pig, {nm(27)}</span></span></div>')
    h += ab(12, 500, sticker(wants, PAPER, 14, -0.6, "sm", pad="6px 10px"))
    # your stall, at the front
    h += ab(64, 552, stall(262, chalk_sign("YOURS", None, None, fs=12), plank=(
        f'<a href="A3.dc.html" class="sticker btn" style="display:inline-flex;align-items:center;gap:6px;background:{SUN};border-radius:999px;padding:0 14px;min-height:44px;color:{GOLDINK}">'
        f'<span class="label" style="font-size:14px;white-space:nowrap">Set out your stall</span><span class="cardTitleSm" style="font-size:18px">&rsaquo;</span></a>'),
        alt="Your stall, empty"))
    h += ab(262, 566, sticker(f'<div class="handT" style="line-height:16px">you have 3 pinecones: a set!</div>', ROSE, 10, 3, "sm", pad="3px 8px"), w=118)
    return page("A1 The square", f'<div class="root">{h}</div>')


def a_set_card(fid, total, outlet_img, outlet_text, btn, color=PAPER, rot=0.0, title=None, sub=None, href=None):
    title = title or f"3 {PL[fid]}"
    sub = sub or f'{price(total, "numeral", 14)}<span class="kicker mute" style="margin-left:4px">{each(total)}</span>'
    return sticker(
        f'<div style="display:flex;align-items:center;gap:10px">{trio(fid, 30)}'
        f'<div style="flex:1;min-width:0;display:flex;flex-direction:column"><div class="cardTitleSm clip">{title}</div><div style="display:flex;align-items:center">{sub}</div></div>'
        f'{btn}</div>'
        + outlet_line(outlet_img, outlet_text, CREAM, "flat", 28, "margin-top:6px;border-width:1.5px"),
        color, 16, rot, "sm", pad="8px 10px")


def a2():
    h = back_link("The square", "Main.dc.html")
    h += corner_coin(18, size=56, top=8)
    h += ab(30, 50, stall(330, chalk_sign("WANTED", "pinecone", "13", gs=20, fs=13), "clover", "red_berries", "12", "11",
                          plank_label("maya", "Maya&#8217;s stall", 17, 34), alt="Maya's stall up close", tag_fs=16))
    cards = (
        a_set_card("clover", 12, A["ghost_sheep"],
                   f"Your Ghost Sheep fancies clovers today: these three pay {nm(18)}. Pay {nm(12)}, you&#8217;re up {nm(6)}.",
                   pill_btn("Buy for " + nm(12), "A4.dc.html", SUN, "sm", aria="Buy 3 clovers for 12 tickles"), rot=-0.5)
        + a_set_card("red_berries", 11, A["g_bell"],
                     f"Your miller&#8217;s order wants 3 red berries: {nm(14)}. Pay {nm(11)}, fill it, up {nm(3)}.",
                     pill_btn("Buy for " + nm(11), None, CREAM, "sm", aria="Buy 3 red berries for 11 tickles"), rot=0.4)
        + a_set_card("blue_feather", 0, A["g_scales"],
                     "Your Stamp Book is missing the blue feather stamp. You have 1 old key.",
                     pill_btn("Swap", None, CREAM, "sm", aria="Swap 1 old key for 3 blue feathers"), CREAM, -0.3,
                     title="3 blue feathers",
                     sub=f'<span class="kicker">for 1 old key &middot; straight up, no tickles</span>')
    )
    h += ab(14, 382, f'<div style="display:flex;flex-direction:column;gap:8px;width:362px">{cards}</div>')
    want = (f'<div style="display:flex;align-items:center;gap:8px">{face("maya", 34)}'
            f'<div style="flex:1;min-width:0"><div class="cardTitleSm">Maya wants 3 pinecones</div><div class="kicker">paying {nm(13)} &middot; you have 3</div></div>'
            f'{pill_btn("Set out your stall", "A3.dc.html", SUN, "sm")}</div>')
    h += ab(14, 748, sticker(want, ROSE, 16, 0.6, "sticker", pad="8px 10px"), w=362)
    return page("A2 Maya's stall", f'<div class="root">{h}</div>')


def satchel_tile(fid, n, sel=False):
    ready = n >= 3 or fid == "tin_whistle"
    sub = ("goes alone" if fid == "tin_whistle" else (f"{n}: a set" if n == 3 else f"{n}: a set + {n - 3}")) if ready else f"{n} of 3"
    bg = SUN if sel else (PAPER if ready else CREAM2)
    cls = "sticker" if sel else ("stickerSm" if ready else "dashed")
    return (f'<button type="button" class="{cls} btn" aria-pressed="{"true" if sel else "false"}" aria-label="{PL[fid]}: {sub}" '
            f'style="width:82px;height:62px;border-radius:12px;background:{bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:2px;{"border-width:3px;" if sel else ""}{"border-width:1.5px;" if not ready else ""}">'
            f'{trio(fid, 22) if ready and fid != "tin_whistle" else glyph(fid, 26)}'
            f'<span class="kicker{"" if ready else " mute"}" style="line-height:14px;white-space:nowrap">{sub}</span></button>')


SATCHEL = [("pinecone", 3), ("river_pebble", 4), ("snail_shell", 3), ("tin_whistle", 1),
           ("red_berries", 2), ("blue_feather", 2), ("old_key", 1), ("clover", 1)]


def satchel_grid(sel="pinecone"):
    return f'<div style="display:grid;grid-template-columns:repeat(4,82px);gap:8px;justify-content:space-between">{"".join(satchel_tile(f, n, f == sel) for f, n in SATCHEL)}</div>'


def a3():
    h = back_link("Maya&#8217;s stall", "A2.dc.html")
    h += corner_coin(18, size=56, top=8, label="tickles ready")
    h += ab(16, 70, crown("YOUR STALL", "Set out your stall"))
    body = (section_header("From your Satchel", "a set is three", cls="cardTitle")
            + satchel_grid()
            + segmented(["Sell for tickles", "Straight up"], "Sell for tickles")
            + stepper(14, f"{each(14)} &middot; pigs paid {nm(11)} to {nm(14)} this week")
            + outlet_line(A["ghost_sheep"], f"Your Sheep pays {nm(9)} for these (not his fancy). Maya wants them at {nm(13)}.", CREAM, "flat", 28)
            + f'<div class="dashed" style="display:flex;align-items:center;gap:8px;border-radius:12px;padding:4px 10px;border-width:1.5px">'
              f'<span class="kickerPillSm mute" style="flex:none">or straight up</span>{trio("pinecone", 20)}{swap_mark(20, MUTE)}{glyph("old_key", 22)}'
              f'<span class="handT mute">ask 1 to 3 of one find</span></div>')
    h += ab(16, 136, f'<div style="display:flex;flex-direction:column;gap:8px;width:358px">{body}</div>')
    prev = stall(184, chalk_sign("", "pinecone", "14", gs=14, fs=10), "pinecone", None, "14", None, plank_label("you", "Your stall", 11, 16), alt="Preview: your stall with 3 pinecones for 14", tag_fs=12)
    h += ab(8, 572, prev)
    h += ab(198, 600, f'<div style="display:flex;flex-direction:column;gap:4px;width:180px">'
                      f'<div class="kickerPillSm acc">&#9733; how it looks</div><div class="cardTitleSm">3 pinecones, {nm(14)}</div>'
                      f'<div class="handT mute" style="line-height:17px">friends see your stall first &middot; it stays out 24 hours &middot; take it down any time</div></div>')
    h += ab(16, 768, ticket("14", "tickles", "Set it out for", "A4.dc.html", aria="Set out 3 pinecones for 14 tickles", style="width:358px"))
    return page("A3 Set out your stall", f'<div class="root">{h}</div>')


def a4():
    h = f'<div style="position:absolute;left:0;right:0;top:0;height:300px;background:{SKY}"></div>'
    h += cobbles(300, seed=3)
    h += bunting(66, sag=10, flags=[SUN, ROSE, PAPER, ROSEDEEP])
    h += back_link("The square", "Main.dc.html")
    h += corner_coin(32, "banked", 56, 8)
    h += ab(-6, 96, f'<img src="{A["bull_cheer"]}" alt="Bullion cheering, hooves up" style="width:176px;height:176px;object-fit:contain">')
    h += ab(136, 92, f'<img class="ding" src="{A["g_bell"]}" alt="" aria-hidden="true" style="width:58px;height:58px;object-fit:contain">')
    h += ab(186, 110, sticker('<div class="whimsy" style="font-size:58px;line-height:60px;text-align:center">Sold!</div>', SUN, 20, -4, "sticker", pad="4px 14px"), w=176)
    h += ab(178, 206, sticker('<div class="handLg" style="line-height:20px">Ding, ding! A fine deal between fine pigs!</div>', PAPER, 16, 1.5, "sm", pad="6px 10px"), w=196)
    card = (f'<div style="display:flex;align-items:center;gap:10px">{basket("pinecone", 84)}'
            f'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px">{face("maya", 26)}<span class="kickerPillSm acc">from maya</span></div>'
            f'<div class="cardTitle" style="margin-top:2px">Maya bought your 3 pinecones for {nm(14)}</div></div></div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:2px dashed {CREAM2}">'
            f'<div><div class="kicker mute">you dug them up</div><div class="numeralLg" style="color:{SUCCESS}">+14</div></div>'
            f'<div style="text-align:right"><div class="kicker mute">tickles ready &middot; past 25 is fine</div><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><span class="numeralLg">18</span><span class="handLg mute">&rarr;</span><span class="numeralLg">32</span>{coin_mark(20)}</div></div></div>')
    h += ab(14, 312, sticker(card, PAPER, 20, -0.6, "sticker", pad="10px 14px"), w=362)
    h += ab(40, 512, ribbon("best pinecone sale today", 300, 48, SUN, -2))
    h += ab(14, 580, f'<div style="display:flex;justify-content:center;width:362px">{sold_high(10, "your Sheep pays 9")}</div>')
    side = (f'<div style="display:flex;align-items:center;gap:10px">{face("maya", 40)}<div style="min-width:0">'
            f'<div class="kickerPillSm acc">maya&#8217;s side</div><div class="handT" style="line-height:18px">Her Ghost Sheep fancies pinecones: he pays {nm(18)} for them today. She&#8217;s up {nm(4)} too.</div></div></div>')
    h += ab(14, 628, sticker(side, CREAM, 16, 0.5, "flat", pad="8px 12px"), w=362)
    h += ab(14, 712, hand_line("the push says it too: &#8220;Maya bought your 3 pinecones for 14&#8221;", "kicker mute"), w=362)
    h += ab(14, 760, f'<div style="display:flex;gap:10px;width:362px">{pill_btn("Back to the square", "Main.dc.html", CREAM, "sm", "flex:1")}{pill_btn("Set out another", "A3.dc.html", PAPER, "sm", "flex:1")}</div>')
    return page("A4 Sold", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# ROW B · The Big Board (a stock exchange)
# Story: pinecones sell from 12, are wanted at 11; you post yours at 14, the 12 and 13 go first,
# Maya takes yours. You'd bought these three for 9, so the P&L reads up 5.
# ═════════════════════════════════════════════════════════════════════════════
BOARD_ROWS = [  # find, set (best selling), last, move, sets selling, sets wanted
    ("pinecone", 12, 12, "up 1", 3, 3),
    ("clover", 12, 12, "up 2", 1, 2),
    ("red_berries", 11, 11, "same", 2, 3),
    ("blue_feather", 10, 10, "down 1", 4, 1),
    ("old_key", 29, 29, "down 1", 2, 1),
    ("tin_whistle", 34, 32, "up 2", 1, 1),
]
BB = dict(left=-75, top=112, w=540)   # bigboard placement on B1
TICKS_B1 = [deal("MAYA BOUGHT", "red_berries", 11, "same"), deal("A PIG SOLD", "pinecone", 12, "up 1"),
            deal("BISCUIT BOUGHT", "old_key", 29, "down 1"), deal("A PIG BOUGHT", "clover", 12, "up 2"),
            f'A PIG SWAPPED 3 BLUE FEATHERS FOR 1 OLD KEY',
            deal("A PIG SOLD", "tin_whistle", 32, "up 2")]


def bx(u):  # bigboard art x (768 units) -> B1 px
    return BB["left"] + u * BB["w"] / 768


def by(u):
    return BB["top"] + u * BB["w"] / 768


def board_rows_html():
    cols = "grid-template-columns:84px 62px 30px 48px 38px 38px"
    hdr = "".join(f'<span class="chalk" style="font-size:13px;line-height:16px;color:{SUN}{";text-align:right" if i else ""}">{t}</span>'
                  for i, t in enumerate(["find", "set of 3", "last", "up/down", "selling", "wanted"]))
    r = f'<div style="display:grid;{cols};align-items:end;height:{by(229) - by(196):.0f}px;padding-bottom:4px;box-sizing:border-box">{hdr}</div>'
    bands = [229, 302, 376, 444]
    ys = []
    for i in range(3):
        a, b = by(bands[i]), by(bands[i + 1])
        ys += [(a, (a + b) / 2), ((a + b) / 2, b)]
    for (fid, st, last, mv, sell, want), (y0, y1) in zip(BOARD_ROWS, ys):
        up = mv.startswith("up")
        mvc = SUN if up else BARKMUTE
        n = 1 if fid == "tin_whistle" else 3
        setc = (f'<span style="display:flex;align-items:baseline;justify-content:flex-end;gap:3px;white-space:nowrap"><span class="chalkNum" style="font-size:15px;line-height:18px">{st}</span>'
                f'<span class="chalk" style="font-size:12px;color:{BARKMUTE}">{"alone" if n == 1 else each(st).replace("about ", "~").replace(" each", "ea")}</span></span>')
        cells = (f'<span style="display:flex;align-items:center;gap:3px;min-width:0">{glyph(fid, 19)}<span class="chalk clip" style="font-size:15px">{SHORT[fid]}</span></span>'
                 + setc
                 + f'<span class="chalkNum" style="font-size:14px;text-align:right">{last}</span>'
                 + f'<span class="chalk" style="font-size:14px;text-align:right;color:{mvc}">{mv}</span>'
                 + f'<span class="chalk" style="font-size:16px;text-align:right">{sell}</span>'
                 + f'<span class="chalk" style="font-size:16px;text-align:right">{want}</span>')
        style = f"display:grid;{cols};align-items:center;height:{y1 - y0:.1f}px;color:{BARKTEXT}"
        if fid == "pinecone":
            r += (f'<a href="B2.dc.html" aria-label="Pinecones: a set of 3 from 12, last 12, up 1, 3 selling, 3 wanted" style="position:relative;{style}">{cells}'
                  f'<span aria-hidden="true" style="position:absolute;left:-8px;right:-6px;top:1px;bottom:1px;border:2px solid {SUN};border-radius:999px;transform:rotate(-1deg);opacity:.9"></span></a>')
        else:
            r += f'<div style="{style}">{cells}</div>'
    return r


def b1():
    h = ab(16, 12, crown("BULLION&#8217;S MARKET", "The Big Board"))
    h += ab(226, 22, sold_high(5, ""))
    h += ticker(TICKS_B1, run=True, top=84)
    h += f'<img src="{A["bigboard"]}" alt="Bullion&#8217;s big chalk price board" style="position:absolute;left:{BB["left"]}px;top:{BB["top"]}px;width:{BB["w"]}px;height:{BB["w"]}px">'
    h += ab(round(bx(150)), round(by(86)), f'<div class="whimsy" style="font-size:17px;line-height:22px;text-align:center;color:{INK}">Today&#8217;s sets</div>', w=round(bx(610) - bx(150)))
    h += ab(round(bx(170)), round(by(196)), board_rows_html(), w=round(bx(600) - bx(170)))
    h += ab(round(bx(170)), round(by(452)), f'<div class="chalk" style="font-size:13px;line-height:16px;color:{BARKMUTE}">a set is three &middot; the whistle goes alone<br>tap a find for its page</div>', w=round(bx(520) - bx(170)))
    h += ab(4, 516, f'<img src="{A["bull_a"]}" alt="Bullion beside his board, chalk in hoof" style="width:118px;height:118px;object-fit:contain">')
    h += ab(116, 540, sticker(f'<div class="handT" style="line-height:18px">Pinecones up {nm(1)}! Three pigs want a set.</div>', PAPER, 16, -1.5, "sm", pad="6px 10px"), w=150)
    h += ab(296, 520, coin(18, size=62))
    orders = (section_header("Town orders", "yours, two a week", cls="cardTitle")
              + f'<div style="display:flex;gap:12px;margin-top:10px;justify-content:space-between">'
              + order_slip("THE MILLER", "red_berries", 14, f"accepted &middot; 5 days left &middot; you have 2 of 3", w=166, rot=-1.2)
              + order_slip("THE CHANDLER", "snail_shell", 13, "a week to fill it", w=166, rot=1.2,
                           action=pill_btn("Take it", None, SUN, "sm", "width:100%;min-height:44px"))
              + '</div>')
    h += ab(14, 650, sticker(orders, CORK, 18, 0, "sticker", pad="8px 12px 12px 12px"), w=362)
    return page("B1 The Big Board", f'<div class="root">{h}</div>')


def ladder_col(title, rows, mine_price=None):
    r = f'<div class="chalk" style="font-size:14px;line-height:18px;color:{SUN};margin-bottom:2px">{title}</div>'
    for i, (p, who, kind) in enumerate(rows):
        bt = f"border-top:1.5px dashed rgba(255,243,226,.35);" if i else ""
        mine = p == mine_price
        hl = f"border:2px dashed {SUN};border-radius:10px;" if mine else ""
        whohtml = (f'<span style="display:inline-flex;align-items:center;gap:4px">{face(kind, 20, 1)}<span class="chalk" style="font-size:15px">{who}</span></span>'
                   if kind in ("maya", "biscuit", "you") else f'<span class="chalk" style="font-size:15px;color:{BARKMUTE}">{who}</span>')
        r += (f'<div style="display:flex;align-items:center;justify-content:space-between;min-height:26px;padding:0 4px;{bt}{hl}">'
              f'<span style="display:inline-flex;align-items:baseline;gap:4px"><span class="chalkNum" style="font-size:{18 if i == 0 else 15}px">{p}</span>'
              f'<span class="chalk" style="font-size:11px;color:{BARKMUTE}">{each(p).replace("about ", "~").replace(" each", " ea")}</span></span>{whohtml}</div>')
    return f'<div style="flex:1;min-width:0">{r}</div>'


SELLING_B = [(12, "a pig", "pig"), (13, "a pig", "pig"), (15, "2 pigs", "pig")]
WANTED_B = [(11, "Maya", "maya"), (10, "Biscuit", "biscuit"), (9, "a pig", "pig")]


def who_row(img, title, text, tag=None):
    t = f'<span style="margin-left:6px">{status_tag(tag)}</span>' if tag else ""
    return (f'<div style="display:flex;align-items:center;gap:8px;min-height:36px">'
            f'<img src="{img}" alt="" aria-hidden="true" style="width:30px;height:30px;object-fit:contain;flex:none">'
            f'<div style="min-width:0"><div style="display:flex;align-items:center"><span class="cardTitleSm" style="font-size:14px;line-height:17px">{title}</span>{t}</div>'
            f'<div class="kicker" style="line-height:16px">{text}</div></div></div>')


def b2_scene():
    h = back_link("The Big Board", "B1.dc.html")
    h += corner_coin(18, size=56, top=8)
    h += ab(16, 64, f'<div style="display:flex;align-items:center;gap:10px;width:300px">{basket("pinecone", 86, style="margin:-6px 0 -6px -6px")}'
                    f'<div style="min-width:0"><div class="kickerPill acc">&#9733; A SET OF 3</div><div class="pageTitle">Pinecones</div>'
                    f'<div style="display:flex;align-items:baseline;gap:6px"><span class="handT">last set</span>{price(12, "displayLg", 20, 4)}<span class="kicker mute">4 each</span></div>'
                    f'<div class="label" style="color:{SUCCESS}">up 1 since yesterday</div></div></div>')
    chart = slate_panel(f'<div class="chalk" style="font-size:13px;line-height:14px;color:{SUN}">last set sold, each day</div>'
                        + chalk_chart(["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"], [9, 10, 10, 11, 11, 11, 12], 334, 74),
                        100, pad="6px 10px")
    lad = slate_panel(f'<div style="display:flex;gap:14px">{ladder_col("sets selling", SELLING_B)}'
                      f'<div aria-hidden="true" style="width:0;border-left:2px solid rgba(255,243,226,.5)"></div>{ladder_col("sets wanted", WANTED_B)}</div>',
                      118, oy=250, pad="6px 10px")
    swap = (f'<div class="flat" style="display:flex;align-items:center;gap:8px;background:{CREAM};border-radius:12px;padding:3px 6px 3px 10px">'
            f'{trio("river_pebble", 20)}{swap_mark(18)}{glyph("pinecone", 22)}'
            f'<span class="handT" style="flex:1;min-width:0;line-height:16px"><span class="acc">straight up:</span> a pig gives 3 pebbles for 1 pinecone</span>{pill_btn("Swap", None, PAPER, "flat")}</div>')
    who = (f'<div class="stickerSm" style="background:{PAPER};border-radius:14px;padding:6px 10px">'
           f'<div class="cardTitleSm">Who pays for pinecones</div>'
           + who_row(A["ghost_sheep"], "The Ghost Sheep", f"yours pays {nm(9)} a set; {nm(18)} on a day he fancies them")
           + who_row(A["g_gift"], "A friend&#8217;s wish", f"Biscuit hopes for one: hand it over, you both get {nm(3)}")
           + who_row(A["g_bell"], "Bullion&#8217;s Orders", f"3 pigs hold the baker&#8217;s order: {nm(14)} a set", "new")
           + who_row(A["g_scales"], "The Stamp Book", "your pinecone stamp is in: no need", "new")
           + f'<div class="kicker mute" style="margin-top:2px">later: the workbench (pinecones + berries), the herd&#8217;s Larder</div>'
           + '</div>')
    h += ab(16, 164, f'<div style="display:flex;flex-direction:column;gap:8px;width:358px">{chart}{lad}{swap}{who}</div>')
    h += ab(16, 708, f'<div style="display:flex;flex-direction:column;gap:8px;width:358px">'
                     f'<div style="display:flex;gap:10px">'
                     + ticket("12", "tickles", "Buy a set for", None, "golden", aria="Buy a set of 3 pinecones for 12 tickles", style="flex:1;min-width:0", h=58)
                     + ticket("11", "tickles", "Sell a set for", None, "paper", aria="Sell a set of 3 pinecones for 11 tickles", style="flex:1;min-width:0", h=58)
                     + '</div>'
                     + pill_btn("Name your price", "B3.dc.html", CREAM, "sm", "width:100%;min-height:48px") + '</div>')
    return h


def b2():
    return page("B2 The pinecone ticker", f'<div class="root">{b2_scene()}</div>')


def b3():
    body = (segmented(["Sell", "Buy", "Swap"], "Sell")
            + f'<div style="display:flex;align-items:center;gap:12px">{basket("pinecone", 100, style="margin:-8px 0 -10px -6px")}'
              f'<div style="min-width:0"><div class="cardTitle">3 pinecones</div><div class="handT mute">from your Satchel &middot; you have 3</div>'
              f'<div class="kicker">you paid {nm(9)} for these on Monday</div></div></div>'
            + stepper(14, f"{each(14)} &middot; selling from {nm(12)} &middot; wanted at {nm(11)}")
            + slate_panel(f'<div class="chalk" style="font-size:13px;line-height:16px;color:{SUN}">where it lands &middot; sets selling, cheapest first</div>'
                          f'<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:nowrap">'
                          + "".join(f'<span style="display:inline-flex;flex-direction:column;align-items:center;padding:2px 8px;border-radius:10px;{"border:2px dashed " + SUN if m else "border:1.5px solid rgba(255,243,226,.45)"}">'
                                    f'<span class="chalkNum" style="font-size:17px;line-height:20px;{"color:" + SUN if m else ""}">{p}</span><span class="chalk" style="font-size:12px;line-height:13px;color:{SUN if m else BARKMUTE}">{w}</span></span>'
                                    for p, w, m in [(12, "a pig", False), (13, "a pig", False), (14, "yours", True), (15, "2 pigs", False)])
                          + f'</div><div class="chalk" style="font-size:14px;line-height:17px;margin-top:6px">third in line: the {nm(12)} and the {nm(13)} go first</div>',
                          112, oy=260, pad="8px 10px")
            + bull_say(A["bull_a"], '<div class="handT">Ask high and you might wait. Ask low and it goes quick.</div>', size=60, rot=1))
    return page("B3 Post an order", '<div class="root">' + sheet("PINECONES · A SET OF 3", "Post an order", body,
                ticket("14", "tickles", "Post it for", "B4.dc.html", aria="Post 3 pinecones for 14 tickles"),
                top=120, scene=b2_scene(), close_href="B2.dc.html") + '</div>')


def b4():
    h = back_link("The Big Board", "B1.dc.html")
    h += corner_coin(32, "banked", 56, 8, "past 25 is fine")
    ticks = [deal("YOU SOLD", "pinecone", 14, "up 2"), deal("A PIG BOUGHT", "pinecone", 13, "up 1"),
             deal("BISCUIT BOUGHT", "pinecone", 12, "same"), deal("MAYA BOUGHT", "red_berries", 11, "same")]
    h += ticker(ticks, hi=0, top=96)
    row = (f'<div style="display:flex;align-items:center;gap:8px">{glyph("pinecone", 26)}<span class="chalk" style="font-size:18px">pinecone</span>'
           f'<span class="chalk" style="font-size:13px;color:{BARKMUTE}">last set</span>'
           f'<span class="chalkNum" style="font-size:24px;color:{SUN}">14</span><span class="chalk" style="font-size:16px;color:{SUN}">up 2</span></div>'
           f'<div class="chalk" style="font-size:13px;line-height:16px;color:{BARKMUTE}">Bullion chalked it the moment it sold</div>')
    h += ab(16, 142, slate_panel(row, 64, oy=300, pad="6px 12px"), w=250)
    h += ab(232, 118, f'<img src="{A["bull_cheer"]}" alt="Bullion cheering" style="width:150px;height:150px;object-fit:contain">')
    h += ab(16, 216, sticker('<div class="handLg" style="line-height:21px">Up, up, up! Best pinecone price on the board today!</div>', PAPER, 16, -1.5, "sm", pad="6px 10px"), w=230)
    pl = (f'<div style="display:flex;align-items:center;gap:8px">{face("maya", 30)}<div class="cardTitle" style="flex:1">Maya bought your 3 pinecones for {nm(14)}</div></div>'
          f'<div style="display:flex;gap:8px;margin-top:10px">'
          + "".join(f'<div class="flat" style="flex:1;background:{bg};border-radius:12px;padding:6px 4px;text-align:center;border-width:1.5px">'
                    f'<div class="kickerPillSm mute">{k}</div><div class="numeralLg" style="font-size:30px;line-height:34px;{st}">{v}</div></div>'
                    for k, v, bg, st in [("paid", "9", PAPER, ""), ("sold for", "14", PAPER, ""), ("up", "5", SAGE, f"color:{SUCCESS}")])
          + f'</div><div style="display:flex;align-items:center;gap:6px;margin-top:8px"><span class="kicker">tickles ready</span><span class="numeral">18</span>'
            f'<span class="handT mute">&rarr;</span><span class="numeral">32</span>{coin_mark(16)}<span class="kicker mute">past 25 is fine</span></div>')
    h += ab(14, 290, sticker(pl, SUN, 20, -0.6, "sticker", pad="10px 14px"), w=362)
    h += ab(14, 470, sticker(f'<div class="kickerPillSm acc">&#9733; how it went</div>'
                             f'<div class="handT" style="line-height:18px">You asked {nm(14)} when sets sold from {nm(12)}. The {nm(12)} and the {nm(13)} went first; yours sold 40 minutes later.</div>',
                             PAPER, 16, 0.6, "sm", pad="8px 12px"), w=362)
    h += ab(46, 566, ribbon("best pinecone price today", 296, 46, ROSE, 1.5))
    h += ab(14, 630, sticker(f'<div style="display:flex;align-items:center;gap:10px">{face("maya", 36)}<div class="handT" style="line-height:18px">'
                             f'Maya&#8217;s side: her Sheep fancies pinecones and pays {nm(18)} for three. She&#8217;s up {nm(4)}.</div></div>', CREAM, 14, 0, "flat", pad="6px 10px"), w=362)
    h += ab(14, 704, f'<div class="flat" style="display:flex;justify-content:space-between;align-items:center;background:{PAPER};border-radius:12px;padding:6px 12px;width:362px;box-sizing:border-box">'
                     f'<span class="kicker">your ledger this week</span><span class="kicker">spent {nm(9)} &middot; took in {nm(14)} &middot; up {nm(5)}</span></div>')
    h += ab(14, 770, f'<div style="display:flex;gap:10px;width:362px">{pill_btn("Back to the board", "B1.dc.html", CREAM, "sm", "flex:1")}{pill_btn("Sell another set", "B3.dc.html", PAPER, "sm", "flex:1")}</div>')
    return page("B4 The deal", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# ROW C · The Sale Ring (a livestock sale): sets sell at timed auctions
# Story: Lot 7 (Maya's pinecones) is in the ring with Biscuit high at 13. It goes to a pig at 16, so
# Biscuit comes for your lot: the bidding takes it from 10 to 17.
# ═════════════════════════════════════════════════════════════════════════════
RING = dict(left=-10, top=92, w=410)


def ring_scene(lot_fid="pinecone", lot_tag="LOT 7", sold=False, gavel_size=150, extra="", ring=None):
    R = ring or RING

    def rx(u):
        return R["left"] + u * R["w"] / 768

    def ry(u):
        return R["top"] + u * R["w"] / 768
    h = f'<img src="{A["ring"]}" alt="The sale ring: a round wooden ring of sawdust, hay bales and bunting" style="position:absolute;left:{R["left"]}px;top:{R["top"]}px;width:{R["w"]}px;height:{R["w"]}px">'
    gs = gavel_size
    # Bullion's podium sits on the ring's podium (art x 290-470, bottom y 335)
    h += ab(round(rx(380) - gs * 0.53), round(ry(342) - gs * 0.94), f'<img src="{A["bullion_gavel"]}" alt="Bullion at the podium, gavel up" style="width:{gs}px;height:{gs}px;object-fit:contain">')
    bs = 112
    h += ab(round(rx(384) - bs / 2), round(ry(470) - bs * 0.66), basket(lot_fid, bs, alt=f"{lot_tag}: a basket of 3 {PL[lot_fid]} in the ring"))
    tag = (f'<div class="stickerSm" style="background:{PAPER};border-radius:6px;padding:1px 8px;transform:rotate(-6deg)"><span class="kickerPillSm">{lot_tag}</span></div>')
    h += ab(round(rx(384) + 30), round(ry(470) - 4), tag)
    if sold:
        h += ab(round(rx(384) - 74), round(ry(430)), f'<div class="whimsy" style="font-size:34px;line-height:38px;color:{ACCENT};border:3px solid {ACCENT};border-radius:10px;padding:0 10px;background:{PAPER};transform:rotate(-12deg);box-shadow:3px 3px 0 {INK}">SOLD</div>')
    return h + extra


def lot_card(num, who, whoname, fid, line, sub, right, color=PAPER, rot=0.0, swap=None, w=170, href=None):
    tagn = "a" if href else "div"
    attr = f' href="{href}"' if href else ""
    sw = (f'<div class="kicker acc" style="line-height:15px">{swap}</div>') if swap else ""
    return (f'<{tagn}{attr} class="stickerSm" style="display:flex;flex-direction:column;gap:2px;width:{w}px;height:112px;flex:none;background:{color};border-radius:14px;padding:6px 8px;transform:rotate({rot}deg);color:{INK};box-sizing:border-box">'
            f'<div style="display:flex;align-items:center;justify-content:space-between"><span class="kickerPillSm acc">lot {num}</span>{right}</div>'
            f'<div style="display:flex;align-items:center;gap:6px">{trio(fid, 22)}<div style="display:flex;align-items:center;gap:4px;min-width:0">{face(who, 18, 1)}<span class="kicker clip">{whoname}</span></div></div>'
            f'<div class="cardTitleSm" style="font-size:14px;line-height:18px">{line}</div><div class="kicker mute" style="line-height:15px">{sub}</div>{sw}</{tagn}>')


def c1():
    h = f'<div style="position:absolute;left:0;right:0;top:0;height:420px;background:{CREAM}"></div>'
    h += ab(16, 12, crown("BULLION&#8217;S MARKET", "The Sale Ring"))
    h += corner_coin(18, size=56, top=8, label="tickles ready")
    h += ring_scene()
    h += ab(260, 100, f'<div class="stickerSm" style="background:{PAPER};border-radius:999px;padding:2px 10px;transform:rotate(3deg);display:flex;align-items:center;gap:4px">'
                      f'<img src="{A["g_bell"]}" alt="" aria-hidden="true" style="width:20px;height:20px;object-fit:contain"><span class="kicker">closes in 42m</span></div>')
    now = (f'<div style="display:flex;align-items:center;justify-content:space-between"><span class="kickerPill acc">&#9733; in the ring now &middot; lot 7</span>'
           f'<span class="kicker">2 pigs bidding</span></div>'
           f'<div style="display:flex;align-items:center;gap:8px;margin-top:2px">{face("maya", 26)}<div class="cardTitle">Maya&#8217;s 3 pinecones</div></div>'
           f'<div style="display:flex;align-items:center;gap:10px;margin-top:6px">'
           f'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px"><span class="handT">high bid</span>{price(13, "numeralLg", 16, style="font-size:22px")}</div>'
           f'<div style="display:flex;align-items:center;gap:5px">{face("biscuit", 18, 1)}<span class="kicker">Biscuit &middot; {each(13)}</span></div></div>'
           + ticket("14", "next", "Bid", "C2.dc.html", aria="Bid 14 tickles on Lot 7", style="width:150px;flex:none", h=52) + '</div>')
    h += ab(14, 438, sticker(now, SUN, 18, -0.5, "sticker", pad="8px 12px"), w=362)
    h += ab(16, 568, section_header("Coming up", "into the ring next", cls="cardTitle"), w=358)
    lots = (lot_card(8, "biscuit", "Biscuit&#8217;s", "old_key", f"opens at {nm(24)}", "in 1h &middot; for 8 hours", "", PAPER, -0.8)
            + lot_card(9, "maya", "Maya&#8217;s", "blue_feather", "a swap lot", "Maya will take an old key for these", status_tag("new").replace(">new<", ">swap<"), CREAM, 0.6)
            + lot_card(10, "pig", "a pig&#8217;s", "tin_whistle", f"opens at {nm(30)}", "goes alone &middot; in 3h", "", PAPER, -0.4))
    h += ab(14, 596, f'<div style="display:flex;gap:10px;width:560px;align-items:stretch">{lots}</div>')
    pad_ = (f'<div style="display:flex;align-items:center;gap:8px"><span class="kickerPill acc" style="flex:none">&#9733; your paddle</span>'
            f'{trio("red_berries", 20)}<span class="handT" style="flex:1;min-width:0;line-height:17px">lot 6, red berries: you&#8217;re top at {nm(11)} &middot; 1h 10m</span></div>'
            f'<div style="display:flex;gap:8px;margin-top:6px">{pill_btn("Put a lot in the ring", "C3.dc.html", CREAM, "sm", "flex:1")}</div>')
    h += ab(14, 722, sticker(pad_, PAPER, 16, 0.4, "sm", pad="8px 10px"), w=362)
    return page("C1 The Sale Ring", f'<div class="root">{h}</div>')


def c2():
    h = back_link("The ring", "Main.dc.html".replace("Main", "C1"))
    h += corner_coin(18, size=56, top=8)
    head = (f'<div style="display:flex;align-items:center;gap:12px">'
            f'<div class="sticker" style="width:132px;height:132px;border-radius:20px;background:{TAPE};display:flex;align-items:center;justify-content:center;transform:rotate(-2deg);flex:none;overflow:hidden">'
            f'{basket("pinecone", 128, style="margin-top:6px")}</div>'
            f'<div style="min-width:0"><div class="kickerPill acc">&#9733; LOT 7 &middot; IN THE RING</div><div class="pageTitle">Maya&#8217;s 3 pinecones</div>'
            f'<div style="display:flex;align-items:center;gap:6px;margin-top:4px">{face("maya", 22)}<span class="kicker">opened at {nm(10)} &middot; buy it now {nm(18)}</span></div>'
            f'<div class="stickerSm" style="display:inline-flex;align-items:center;gap:4px;background:{PAPER};border-radius:999px;padding:1px 10px;margin-top:6px">'
            f'<img src="{A["g_bell"]}" alt="" aria-hidden="true" style="width:18px;height:18px;object-fit:contain"><span class="kicker">closes in 42m</span></div></div></div>')
    h += ab(16, 66, head, w=358)
    bids = [("13", "Biscuit", "biscuit", "4m ago", True), ("12", "a pig", "pig", "11m ago", False), ("11", "Biscuit", "biscuit", "20m ago", False), ("10", "opening bid", None, "1h ago", False)]
    hist = f'<div class="cardTitleSm" style="margin-bottom:2px">The bidding</div>'
    for p, who, k, t, top in bids:
        hist += (f'<div style="display:flex;align-items:center;gap:8px;min-height:26px;{"" if top else "border-top:1.5px dashed " + CREAM2}">'
                 f'<span class="{"numeralLg" if top else "numeral"}" style="{"font-size:20px;line-height:22px;" if top else ""}width:30px">{p}</span>'
                 f'{face(k, 20, 1) if k else ""}<span class="handT" style="flex:1">{who}{" &middot; high bid" if top else ""}</span><span class="kicker mute">{t}</span></div>')
    h += ab(14, 216, sticker(hist, PAPER, 16, 0.4, "sm", pad="8px 12px"), w=362)
    worth = (f'<div class="cardTitleSm">What these are worth to you</div>'
             + who_row(A["ghost_sheep"], "Your Ghost Sheep", f"pays {nm(9)} for three today: not his fancy")
             + who_row(A["g_scales"], "Your Stamp Book", "your pinecone stamp is in already", "new")
             + who_row(A["g_bell"], "Your Orders", "none want pinecones this week", "new")
             + f'<div class="handT acc" style="line-height:18px;margin-top:2px">You hold 3 pinecones and they&#8217;re worth more to Biscuit than to you. Put them in the ring next.</div>')
    h += ab(14, 380, sticker(worth, CREAM, 16, -0.4, "flat", pad="8px 12px"), w=362)
    h += ab(16, 594, stepper(14, f"next bid &middot; {each(14)} &middot; you&#8217;d be top", big=46), w=358)
    h += ab(16, 700, f'<div style="display:flex;flex-direction:column;gap:8px;width:358px">'
                     + ticket("14", "tickles", "Bid", None, "golden", aria="Bid 14 tickles", h=58)
                     + f'<div style="display:flex;gap:8px">{pill_btn("Buy it now for " + nm(18), None, PAPER, "sm", "flex:1")}{pill_btn("Put yours in", "C3.dc.html", CREAM, "sm", "flex:1")}</div></div>')
    return page("C2 Lot 7", f'<div class="root">{h}</div>')


def c3():
    sets = "".join([
        f'<button type="button" class="sticker btn" aria-pressed="true" style="width:106px;border-radius:14px;background:{SUN};border-width:3px;display:flex;flex-direction:column;align-items:center;padding:0 0 4px 0">{basket("pinecone", 76)}<span class="kicker" style="margin-top:-8px">3 pinecones</span></button>',
        f'<button type="button" class="stickerSm btn" aria-pressed="false" style="width:106px;border-radius:14px;background:{PAPER};display:flex;flex-direction:column;align-items:center;padding:0 0 4px 0">{basket("river_pebble", 76)}<span class="kicker" style="margin-top:-8px">3 of 4 pebbles</span></button>',
        f'<button type="button" class="stickerSm btn" aria-pressed="false" style="width:106px;border-radius:14px;background:{PAPER};display:flex;flex-direction:column;align-items:center;padding:0 0 4px 0">{basket("tin_whistle", 76)}<span class="kicker" style="margin-top:-8px">whistle, alone</span></button>'])
    body = (f'<div style="display:flex;gap:10px;justify-content:space-between">{sets}</div>'
            + f'<div class="cardTitleSm">Opening bid</div>'
            + stepper(10, f"low opens draw a crowd &middot; pinecones fetched {nm(11)} to {nm(16)} this week", big=44)
            + f'<div style="display:flex;align-items:center;gap:10px"><span class="cardTitleSm" style="flex:none">How long</span>{segmented(["1 hour", "8 hours"], "1 hour")}</div>'
            + f'<div class="flat" style="display:flex;align-items:center;gap:8px;background:{CREAM};border-radius:12px;padding:4px 6px 4px 10px;border-width:1.5px">'
              f'<span class="handT" style="flex:1">Buy it now (optional)</span><span class="kicker mute">off</span>{pill_btn("Set one", None, PAPER, "flat")}</div>'
            + f'<div class="dashed" style="display:flex;align-items:center;gap:8px;border-radius:12px;padding:4px 10px;border-width:1.5px">'
              f'<span class="kickerPillSm mute" style="flex:none">or a swap lot</span>{trio("pinecone", 18)}{swap_mark(18, MUTE)}{glyph("old_key", 20)}<span class="handT mute">best offer of finds</span></div>'
            + bull_say(A["bull_a"], '<div class="handT">Open low and let them bid you up. The ring finds your price!</div>', size=60, rot=1))
    return page("C3 Put a lot in the ring", '<div class="root">' + sheet("YOUR LOT · LOT 11", "Into the ring", body,
                ticket("10", "opens", "Into the ring at", "C4.dc.html", aria="Put 3 pinecones in the ring, opening at 10"),
                top=150, scene=c1_scene_only(), close_href="C1.dc.html") + '</div>')


def c1_scene_only():
    h = f'<div style="position:absolute;left:0;right:0;top:0;height:420px;background:{CREAM}"></div>'
    h += ab(16, 12, crown("BULLION&#8217;S MARKET", "The Sale Ring"))
    h += ring_scene()
    return h


def c4():
    h = f'<div style="position:absolute;left:0;right:0;top:0;height:470px;background:{CREAM}"></div>'
    h += back_link("The ring", "C1.dc.html")
    h += corner_coin(35, "banked", 56, 8)
    h += ring_scene("pinecone", "LOT 11", sold=True, gavel_size=180, ring=dict(left=-10, top=58, w=410))
    h += ab(14, 70, sticker('<div class="handLg" style="line-height:21px">Going once, going twice: sold to Biscuit for 17!</div>', PAPER, 16, -2, "sm", pad="6px 10px"), w=150)
    ladder = [(10, None, "opened"), (11, "maya", "Maya"), (13, "biscuit", "Biscuit"), (15, "maya", "Maya"), (16, "biscuit", "Biscuit"), (17, "biscuit", "Biscuit")]
    steps = ""
    for i, (p, k, nmz) in enumerate(ladder):
        last = i == len(ladder) - 1
        steps += (f'<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">'
                  f'<div style="height:{12 + i * 6}px;width:100%;max-width:34px;background:{SUN if last else CREAM};border:2px solid {INK};border-bottom:0;border-radius:6px 6px 0 0;box-sizing:border-box"></div>'
                  f'<span class="{"numeral" if last else "kicker"}" style="{"font-size:18px" if last else ""}">{p}</span>'
                  f'{face(k, 18, 1) if k else "<span class=" + chr(34) + "kicker mute" + chr(34) + " style=" + chr(34) + "font-size:11px" + chr(34) + ">open</span>"}</div>')
    card = (f'<div style="display:flex;align-items:center;gap:8px">{face("biscuit", 30)}<div class="cardTitle" style="flex:1">Biscuit bought your 3 pinecones for {nm(17)}</div></div>'
            f'<div class="handT" style="margin-top:2px">the bidding took it from {nm(10)} to {nm(17)}</div>'
            f'<div style="display:flex;align-items:flex-end;gap:4px;margin-top:6px;border-bottom:2px solid {INK}">{steps}</div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">'
            f'<div><div class="kicker mute">you dug them up</div><div class="numeralLg" style="color:{SUCCESS}">+17</div></div>'
            f'<div style="text-align:right"><div class="kicker mute">tickles ready &middot; past 25 is fine</div><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><span class="numeral">18</span><span class="handT mute">&rarr;</span><span class="numeral">35</span>{coin_mark(16)}</div></div></div>')
    h += ab(14, 452, sticker(card, SUN, 20, -0.5, "sticker", pad="10px 14px"), w=362)
    h += ab(14, 708, sticker(f'<div style="display:flex;align-items:center;gap:10px">{face("biscuit", 34)}<div class="handT" style="line-height:18px">'
                             f'Biscuit&#8217;s side: Lot 7 went to a pig at {nm(16)}, so he came for yours. His Sheep fancies pinecones: {nm(18)}.</div></div>',
                             CREAM, 14, 0.4, "flat", pad="6px 10px"), w=362)
    h += ab(14, 784, f'<div style="display:flex;gap:10px;width:362px">{pill_btn("Back to the ring", "C1.dc.html", CREAM, "sm", "flex:1")}{pill_btn("Another lot", "C3.dc.html", PAPER, "sm", "flex:1")}</div>')
    h += ab(178, 404, ribbon("top lot of the day", 196, 40, ROSE, 3))
    return page("C4 The gavel falls", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# ROW D · The Market Paper (a market-day newspaper)
# Story: yesterday a pig paid 16 for pinecones; today Maya's WANTED ad pays 13, you print a FOR SALE
# at 14, and she answers it.
# ═════════════════════════════════════════════════════════════════════════════
def rule2(style=""):
    return f'<div aria-hidden="true" style="border-top:2px solid {INK};border-bottom:1px solid {INK};height:2px;{style}"></div>'


def masthead(small=False):
    fs = 22 if small else 30
    return (f'<div style="text-align:center">'
            f'<div class="whimsy" style="font-size:{fs}px;line-height:{fs + 4}px;letter-spacing:.4px">The Hedgerow Herald</div></div>')


PRICES_D = [("pinecone", 12, "up 1"), ("clover", 12, "up 2"), ("red_berries", 11, "same"), ("blue_feather", 10, "down 1"),
            ("snail_shell", 10, "same"), ("old_key", 29, "down 1"), ("tin_whistle", 32, "up 2")]


def d1():
    col = (f'<div style="display:flex;gap:8px;align-items:center">'
           f'<div class="flat" style="width:58px;height:66px;border-radius:999px;background:{CREAM};overflow:hidden;flex:none;position:relative;border-width:2px">'
           f'<img src="{A["bull_a"]}" alt="Bullion" style="position:absolute;width:96px;height:96px;left:-20px;top:-6px;max-width:none"></div>'
           f'<div style="min-width:0"><div class="kickerPillSm acc">bullion says</div>'
           f'<div class="cardTitleSm" style="line-height:18px">Ask high, and wait</div></div></div>'
           f'<div class="bodySm" style="margin-top:6px;line-height:17px">Yesterday the patient pigs did best: every pinecone set sold above the Sheep&#8217;s {nm(9)}. A thing is worth what a pig will pay for it!</div>')
    rows = ""
    for fid, p, mv in PRICES_D:
        up = mv.startswith("up")
        rows += (f'<div style="display:flex;align-items:center;gap:4px;min-height:21px;border-top:1px dotted {MUTESOFT}">{glyph(fid, 16)}'
                 f'<span class="kicker clip" style="flex:1">{SHORT[fid]}</span><span class="numeral" style="font-size:14px">{p}</span>'
                 f'<span class="kicker" style="width:40px;text-align:right;{"color:" + SUCCESS if up else "color:" + MUTE}">{mv}</span></div>')
    table = (f'<div class="kickerPillSm">yesterday&#8217;s prices</div><div class="kicker mute" style="line-height:14px;margin-bottom:2px">a set of 3, last sold</div>{rows}')
    orders = (f'<div class="kickerPill acc" style="margin-bottom:6px">&#9733; orders from town</div>'
              f'<div style="display:flex;gap:10px">'
              + order_slip("THE MILLER", "red_berries", 14, "yours &middot; 5 days left", w=160, rot=-1, pin=False)
              + order_slip("THE CHANDLER", "snail_shell", 13, "on your menu &middot; take it", w=160, rot=1, pin=False)
              + '</div>')
    teaser = (f'<div style="display:flex;align-items:center;gap:10px">{trio("pinecone", 24)}<div style="flex:1;min-width:0">'
              f'<div class="cardTitleSm">Maya wants 3 pinecones</div><div class="kicker">WANTED, page 2 &middot; paying {nm(13)} &middot; you have 3</div></div></div>')
    body = (masthead()
            + rule2("margin-top:2px")
            + f'<div style="display:flex;justify-content:space-between;align-items:center"><span class="kicker">Thursday 29 October &middot; market day</span>'
              f'<span style="display:inline-flex;align-items:center;gap:4px"><span class="kicker">you: 18 ready</span>{coin_mark(15)}</span></div>'
            + f'<div style="border-top:1px solid {INK}"></div>'
            + f'<div class="whimsy" style="font-size:25px;line-height:27px;text-transform:uppercase;letter-spacing:.2px;margin-top:2px">Pinecones fetch 16 as Sheep take a fancy</div>'
            + f'<div class="bodySm" style="line-height:17px">One set went for {nm(16)} to a pig whose Ghost Sheep fancied them. Most changed hooves at {nm(12)}; three pigs are still asking.</div>'
            + f'<div style="display:flex;gap:10px;border-top:2px solid {INK};padding-top:8px;margin-top:2px">'
              f'<div style="flex:1;min-width:0">{col}</div><div aria-hidden="true" style="border-left:1px solid {INK}"></div><div style="width:166px;flex:none">{table}</div></div>'
            + f'<div class="dashed" style="border-radius:8px;padding:8px 10px 10px 10px;background:{CREAM};margin-top:2px">{orders}</div>'
            + sticker(teaser, ROSE, 12, -0.6, "sm", pad="6px 10px")
            + pill_btn("Turn to the classifieds, page 2 &rsaquo;", "D2.dc.html", SUN, "sticker", "width:100%;min-height:56px")
            + hand_line("FOR SALE &middot; WANTED &middot; WILL SWAP", "kicker mute"))
    h = f'<div style="position:absolute;inset:0;background:{PAPER}"></div>'
    h += f'<div style="position:absolute;left:16px;right:16px;top:12px;display:flex;flex-direction:column;gap:10px">{body}</div>'
    return page("D1 The Hedgerow Herald", f'<div class="root">{h}</div>')


def ad(fid, text, who, whoname, href=None, swap_for=None, mine=False, hi=False):
    g = trio(fid, 20, .5)
    if swap_for:
        g += swap_mark(16) + glyph(swap_for, 20)
    stamp_ = (f'<span style="display:inline-flex;align-items:center;gap:3px">'
              f'<span style="display:inline-flex;border:1.5px solid {ACCENT};border-radius:999px;padding:1px;transform:rotate(-8deg)">{face(who, 18, 1)}</span>'
              f'<span class="kicker" style="font-style:italic">{whoname}</span></span>')
    btn = (f'<a href="{href}" class="flat btn" style="display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:8px;background:{SUN if hi else PAPER};color:{INK};border-width:1.5px;margin-top:4px">'
           f'<span class="label" style="font-size:11px;line-height:13px;text-align:center">Answer this ad</span></a>' if href is not None else
           f'<button type="button" class="flat btn" style="display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:8px;background:{PAPER};border-width:1.5px;margin-top:4px;width:100%">'
           f'<span class="label" style="font-size:11px;line-height:13px;text-align:center">Answer this ad</span></button>')
    return (f'<div style="padding:6px 0 8px 0;border-bottom:1px solid {INK}">'
            f'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px">{g}</div>'
            f'<div class="bodySm" style="font-weight:800;line-height:16px;margin-top:2px">{text}</div>'
            f'<div style="margin-top:2px">{stamp_}</div>{btn}</div>')


def d2():
    h = f'<div style="position:absolute;inset:0;background:{PAPER}"></div>'
    h += back_link("Front page", "D1.dc.html", top=10)
    h += corner_coin(18, size=48, top=6, label="")
    h += ab(16, 62, masthead(True), w=358)
    h += ab(16, 90, f'<div class="kickerPill" style="text-align:center">classifieds &middot; page 2</div>', w=358)
    h += ab(16, 108, rule2(), w=358)
    cols = [
        ("For sale", [ad("red_berries", f"3 red berries, {nm(11)} tickles.", "maya", "Maya.", ""),
                      ad("old_key", f"3 old keys, {nm(29)} tickles.", "biscuit", "Biscuit.", ""),
                      ad("snail_shell", f"3 snail shells, {nm(10)}. Going cheap.", "pig", "A pig.", ""),
                      ad("tin_whistle", f"A tin whistle, {nm(34)}. Goes alone.", "pig", "A pig.", "")]),
        ("Wanted", [ad("pinecone", f"3 pinecones wanted. Paying {nm(13)}.", "maya", "Maya.", "D3.dc.html", hi=True),
                    ad("old_key", f"3 old keys wanted. Paying {nm(27)}.", "pig", "A pig.", ""),
                    ad("clover", f"3 clovers wanted. Paying {nm(12)}.", "pig", "A pig.", "")]),
        ("Will swap", [ad("blue_feather", "3 blue feathers for 1 old key.", "pig", "A pig.", "", swap_for="old_key"),
                       ad("river_pebble", "3 river pebbles for 1 pinecone.", "biscuit", "Biscuit.", "", swap_for="pinecone"),
                       ad("wool_tuft", "3 tufts of wool for 2 clovers.", "maya", "Maya.", "", swap_for="clover")]),
    ]
    html = ""
    for i, (t, ads) in enumerate(cols):
        bl = f"border-left:1px solid {INK};padding-left:8px;" if i else ""
        html += (f'<div style="flex:1;min-width:0;{bl}"><div class="whimsy" style="font-size:16px;line-height:20px;text-transform:uppercase;text-align:center;border-bottom:2px solid {INK};padding-bottom:2px">{t}</div>'
                 f'{"".join(ads)}</div>')
    h += ab(16, 118, f'<div style="display:flex;gap:8px;width:358px">{html}</div>')
    h += ab(16, 742, rule2(), w=358)
    h += ab(16, 756, pill_btn("Place an ad", "D3.dc.html", SUN, "sticker", "width:100%;min-height:56px"), w=358)
    return page("D2 The classifieds", f'<div class="root">{h}</div>')


def clipping(inner, rot=-1.5, w=300, sold=False):
    stamp_ = (f'<div aria-hidden="true" style="position:absolute;right:-16px;top:-18px;transform:rotate(-14deg)">'
              f'<div class="whimsy" style="font-size:34px;line-height:36px;color:{ACCENT};border:3px double {ACCENT};border-radius:8px;padding:0 10px;background:rgba(255,250,240,.85)">SOLD</div></div>' if sold else "")
    return (f'<div style="position:relative;width:{w}px;transform:rotate({rot}deg)">'
            f'<div class="stickerSm" style="background:{PAPER};border-style:dashed;border-radius:4px;padding:10px 12px">{inner}</div>{stamp_}</div>')


def my_ad(price_n=14):
    return (f'<div class="whimsy" style="font-size:14px;line-height:18px;text-transform:uppercase;border-bottom:2px solid {INK};padding-bottom:2px">For sale</div>'
            f'<div style="display:flex;align-items:center;gap:10px;margin-top:6px">{basket("pinecone", 64, style="margin:-6px 0 -8px -4px")}'
            f'<div style="min-width:0"><div class="body" style="font-weight:800;line-height:19px">3 pinecones, {nm(price_n)} tickles. Dug fresh.</div>'
            f'<div style="display:flex;align-items:center;gap:4px;margin-top:2px"><span style="display:inline-flex;border:1.5px solid {ACCENT};border-radius:999px;padding:1px;transform:rotate(-8deg)">{face("you", 20, 1)}</span>'
            f'<span class="kicker" style="font-style:italic">signed with your name</span></div></div></div>')


def d3():
    h = f'<div style="position:absolute;inset:0;background:{PAPER}"></div>'
    h += back_link("Classifieds", "D2.dc.html")
    h += corner_coin(18, size=56, top=8)
    h += ab(16, 70, crown("THE HEDGEROW HERALD", "Place an ad"))
    body = (segmented(["For sale", "Wanted", "Will swap"], "For sale")
            + f'<div class="cardTitleSm">The set</div>'
            + f'<div style="display:flex;gap:8px;flex-wrap:nowrap">'
            + "".join(f'<button type="button" class="{"sticker" if s else "stickerSm"} btn" aria-pressed="{"true" if s else "false"}" style="display:inline-flex;align-items:center;gap:4px;min-height:44px;border-radius:999px;background:{SUN if s else PAPER};padding:0 10px">{trio(f, 18)}<span class="kicker">{t}</span></button>'
                      for f, t, s in [("pinecone", "pinecones", True), ("river_pebble", "pebbles", False), ("snail_shell", "shells", False)])
            + '</div>'
            + f'<div class="cardTitleSm">Your price</div>'
            + stepper(14, f"{each(14)} &middot; Maya&#8217;s WANTED ad pays {nm(13)} &middot; pigs paid {nm(11)} to {nm(14)} this week", big=46))
    h += ab(16, 140, f'<div style="display:flex;flex-direction:column;gap:8px;width:358px">{body}</div>')
    h += ab(16, 452, f'<div class="kickerPill acc">&#9733; how it will print</div>', w=358)
    h += ab(34, 476, clipping(my_ad(), -1.5, 322))
    h += ab(16, 612, hand_line("friends see your name; other pigs see &#8220;a pig&#8221; &middot; it runs 24 hours", "kicker mute"), w=358)
    h += ab(16, 640, outlet_line(A["ghost_sheep"], f"Your Sheep pays {nm(9)} for these. Answer Maya now at {nm(13)}, or hold out for {nm(14)}.", CREAM, "flat", 28), w=358)
    h += ab(16, 708, f'<div style="display:flex;flex-direction:column;gap:8px;width:358px">'
                     + ticket("14", "tickles", "Print it for", "D4.dc.html", aria="Print the ad: 3 pinecones for 14 tickles", h=60)
                     + pill_btn(f"Answer Maya&#8217;s ad for {nm(13)} instead", None, CREAM, "flat", "width:100%") + '</div>')
    return page("D3 Place an ad", f'<div class="root">{h}</div>')


def d4():
    h = f'<div style="position:absolute;inset:0;background:{PAPER}"></div>'
    h += back_link("Classifieds", "D2.dc.html")
    h += corner_coin(32, "banked", 56, 8)
    h += ab(16, 70, crown("THE HEDGEROW HERALD", "Your ad was answered"))
    h += ab(30, 160, clipping(my_ad(), -2, 316, sold=True))
    card = (f'<div style="display:flex;align-items:center;gap:8px">{face("maya", 30)}<div class="cardTitle" style="flex:1">Maya answered your ad: {nm(14)} tickles for your 3 pinecones</div></div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:2px dashed {INK}">'
            f'<div><div class="kicker">you dug them up</div><div class="numeralLg" style="color:{SUCCESS}">+14</div></div>'
            f'<div style="text-align:right"><div class="kicker">tickles ready &middot; past 25 is fine</div><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><span class="numeral">18</span><span class="handT">&rarr;</span><span class="numeral">32</span>{coin_mark(16)}</div></div></div>')
    h += ab(14, 300, sticker(card, SUN, 20, -0.6, "sticker", pad="10px 14px"), w=362)
    h += ab(-4, 452, f'<img src="{A["bull_cheer"]}" alt="Bullion cheering" style="width:128px;height:128px;object-fit:contain">')
    h += ab(116, 470, sticker('<div class="handLg" style="line-height:21px">Read all about it! You held out for 14 and got it!</div>', PAPER, 16, 1.5, "sm", pad="6px 10px"), w=258)
    tomorrow = (f'<div class="kickerPillSm acc">&#9733; in tomorrow&#8217;s herald</div>'
                f'<div style="display:flex;align-items:center;gap:8px;margin-top:4px">{gimg("g_star", 30)}<div style="min-width:0">'
                f'<div class="whimsy" style="font-size:16px;line-height:20px;text-transform:uppercase">Seller of the day</div>'
                f'<div class="bodySm" style="line-height:17px">3 pinecones for {nm(14)}: the best pinecone sale of the day.</div></div></div>')
    h += ab(14, 586, sticker(tomorrow, PAPER, 8, 0.6, "sm", pad="8px 12px", style=f"border-style:solid"), w=362)
    h += ab(14, 676, sticker(f'<div style="display:flex;align-items:center;gap:10px">{face("maya", 34)}<div class="handT" style="line-height:18px">'
                             f'Maya&#8217;s side: her ad paid {nm(13)}; she paid your {nm(14)} because her Sheep pays {nm(18)} for three.</div></div>', CREAM, 14, 0, "flat", pad="6px 10px"), w=362)
    h += ab(14, 770, f'<div style="display:flex;gap:10px;width:362px">{pill_btn("Back to the paper", "D1.dc.html", CREAM, "sm", "flex:1")}{pill_btn("Place another ad", "D3.dc.html", PAPER, "sm", "flex:1")}</div>')
    return page("D4 Your ad answered", f'<div class="root">{h}</div>')


# ═════════════════════════════════════════════════════════════════════════════
# write boards
# ═════════════════════════════════════════════════════════════════════════════
BOARDS = {
    "Rules.dc.html": ("0 · The rules and the outlets", R0, RW, RH),
    "Main.dc.html": ("A1 · The square: stalls, orders, your stall", a1(), 390, 844),
    "A2.dc.html": ("A2 · Maya's stall: her sets, a swap, your outlets", a2(), 390, 844),
    "A3.dc.html": ("A3 · Set out your stall", a3(), 390, 844),
    "A4.dc.html": ("A4 · Sold! The bell rings", a4(), 390, 844),
    "B1.dc.html": ("B1 · The Big Board: chalk prices, the ticker", b1(), 390, 844),
    "B2.dc.html": ("B2 · The pinecone ticker", b2(), 390, 844),
    "B3.dc.html": ("B3 · Post an order", b3(), 390, 844),
    "B4.dc.html": ("B4 · The deal: your line on the tape", b4(), 390, 844),
    "C1.dc.html": ("C1 · The Sale Ring: Lot 7 in the ring", c1(), 390, 844),
    "C2.dc.html": ("C2 · Lot 7: the bidding, what it's worth to you", c2(), 390, 844),
    "C3.dc.html": ("C3 · Put a lot in the ring", c3(), 390, 844),
    "C4.dc.html": ("C4 · The gavel falls", c4(), 390, 844),
    "D1.dc.html": ("D1 · The Hedgerow Herald: front page", d1(), 390, 844),
    "D2.dc.html": ("D2 · The classifieds", d2(), 390, 844),
    "D3.dc.html": ("D3 · Place an ad", d3(), 390, 844),
    "D4.dc.html": ("D4 · Your ad answered", d4(), 390, 844),
}
for path, (_, html, _w, _h) in BOARDS.items():
    with open(os.path.join(ROOT, path), "w") as f:
        f.write(html)

# ── canvas.json ──────────────────────────────────────────────────────────────
W, H, GX, ROW_H = 390, 844, 80, 1204
rows = [("0", ["Rules.dc.html"]),
        ("A", ["Main.dc.html", "A2.dc.html", "A3.dc.html", "A4.dc.html"]),
        ("B", ["B1.dc.html", "B2.dc.html", "B3.dc.html", "B4.dc.html"]),
        ("C", ["C1.dc.html", "C2.dc.html", "C3.dc.html", "C4.dc.html"]),
        ("D", ["D1.dc.html", "D2.dc.html", "D3.dc.html", "D4.dc.html"])]
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
order = ["Main.dc.html", "A2.dc.html", "A3.dc.html", "A4.dc.html", "Rules.dc.html",
         "B1.dc.html", "B2.dc.html", "B3.dc.html", "B4.dc.html",
         "C1.dc.html", "C2.dc.html", "C3.dc.html", "C4.dc.html",
         "D1.dc.html", "D2.dc.html", "D3.dc.html", "D4.dc.html"]

TITLES = {
    "0": "0 · The rules and the outlets (the same on every row)",
    "A": "A · The Market Square (a farmers' market)",
    "B": "B · The Big Board (a stock exchange)",
    "C": "C · The Sale Ring (a livestock sale)",
    "D": "D · The Market Paper (a market-day newspaper)",
}
STICKY = {
    "0": ("0 · The rules and the outlets\n\n"
          "SETS: a set is three of one find, for every find; the tin whistle trades alone. The price per find is printed beside every set price ('12 · 4 each') so every pinecone compares. The basket is the picture of a set on every row.\n\n"
          "STRAIGHT UP: give one set, ask for 1 to 3 of one other find ('3 pinecones for 1 old key'). Both sides move at once, no tickles, nothing minted. It shows under both finds.\n\n"
          "THE MONEY: the coin (tickles ready). Buying spends it, selling high piles it up, past 25 is fine (the coin reads 'banked'). The tickled total and the Board never move.\n\n"
          "OUTLETS (why a pig pays a high price): the Ghost Sheep (live) · a friend's wish (live) · the Stamp Book (NEW: hand Bullion a set, get that find's stamp, every four stamps unlock a cosmetic, mints nothing) · Bullion's Orders (NEW: your own menu of town orders, accept one, a week to fill it, two a week, at most 28 tickles a week enter this way) · the workbench (later) · the herd's Larder (later). Every outlet is printed on the find with the buyer's gain spelled out.\n\n"
          "PILLARS: Collect (the Stamp Book, a set for an order or a recipe) · Connect (every trade has a pig on the other side; friends named, 'a pig' for strangers). Contend untouched.\n\n"
          "COST: the Stamp Book is a table plus a stamp page and 12 stamp paintings; Orders are a per-pig menu, an accept, a fill, and the only new faucet (capped)."),
    "A": ("A · The Market Square (a farmers' market)\n\n"
          "THE FEEL: a painted square. Every pig selling has a stall (awning, pig face on the counter, baskets of sets with paper price tags, a chalk sign saying what they WANT). Bullion rings the bell from his crate; the day's orders hang on a cork noticeboard; your own stall waits at the front.\n\n"
          "BEST AT: every trade has a pig. Demand is on the stall itself (Maya's sign: WANTED 3 pinecones, 13), so 'who wants what, and why' is the first thing you see. The warmest of the four.\n\n"
          "COST TO BUILD: medium-high. A scrolling row of stalls built from one stall painting plus overlays (glyphs, tags, name plank, chalk) is cheap; the square scene, the 'set out your stall' flow and the sale moment are new screens. Same server as round 1 plus sets and swaps.\n\n"
          "RISK: browsing by pig hides prices. Comparing pinecones means visiting stalls (fix: the wanted strip, or B's board as each find's page). A thin board looks like an empty square on day one.\n\n"
          "STORY IN PLAY: your Sheep fancies clovers and your miller wants red berries, so Maya's stall has your bargains; Maya's Sheep fancies pinecones, so she buys yours. Square > Maya's stall > Set out your stall > Sold!"),
    "B": ("B · The Big Board (a stock exchange)\n\n"
          "THE FEEL: the bigboard painting as the hero, prices written on it in chalk (find · set of 3 · last · up/down · selling · wanted), a ticker tape of real deals across the top, Bullion beside it with the chalk.\n\n"
          "BEST AT: reading prices. Closest to the founder's first 'stock market' ask. Demand is a number (sets wanted) and a ladder with friends' names; 'paid 9 · sold for 14 · up 5' teaches profit plainly.\n\n"
          "COST TO BUILD: lowest. It is round 1's order book with sets, straight up and the outlets panel; the board and ticker are one screen over market_status(). The chalk table is a list in a costume.\n\n"
          "RISK: the coldest. A table of numbers is the least 'pig' of the four, and six columns are tight on a phone; strangers are 'a pig' so the tape can read anonymous. Thin days look like a dead exchange.\n\n"
          "STORY IN PLAY: pinecones sell from 12 and are wanted at 11; you post yours at 14; the 12 and the 13 go first, then Maya takes yours. Board > Pinecones > Post an order > your line on the tape."),
    "C": ("C · The Sale Ring (a livestock sale)\n\n"
          "THE ONE MECHANIC DIFFERENCE: sets sell at timed auctions (1 hour or 8 hours), not fixed prices. Opening bid, optional buy-it-now, or a swap lot (best offer of finds). Highest bid at the bell wins.\n\n"
          "THE FEEL: Bullion at the podium with the gavel, the lot in its basket on the sawdust, a countdown, a paddle of your live bids.\n\n"
          "BEST AT: drama, and it finds the highest price for the seller by itself ('the bidding took it from 10 to 17'). Selling high is literally the show.\n\n"
          "COST TO BUILD: highest. A scheduled close (pg_cron), outbid pushes, held tickles per bid, buy-it-now, swap-lot offers, and the ring scene.\n\n"
          "RISK: waiting. You can't buy the set you need now; a pig must be awake when the gavel falls. With a thin board most lots get one bidder and open-price = sale price. Bidding wars between friends can sting (Contend creeping in).\n\n"
          "STORY IN PLAY: Lot 7 (Maya's pinecones) has Biscuit at 13; it goes to a pig at 16, so Biscuit comes for your lot. Ring > Lot 7 > Into the ring > the gavel falls."),
    "D": ("D · The Market Paper (a market-day newspaper)\n\n"
          "THE FEEL: The Hedgerow Herald. A front page with a headline from yesterday's real trades, Bullion's column, yesterday's prices, orders from town; then the classifieds: FOR SALE, WANTED, WILL SWAP, each ad signed with a pig-face stamp and an 'Answer this ad' button.\n\n"
          "BEST AT: straight-up swaps read naturally as ads ('3 blue feathers for 1 old key. A pig.'). WANTED ads make demand visible in words, and 'seller of the day' gives a good sale a byline. Daily rhythm: a new paper each morning.\n\n"
          "COST TO BUILD: medium. The headline and seller-of-the-day need a daily digest of real trades (one cron); ads are offers in a costume. Three narrow columns are tight on small phones.\n\n"
          "RISK: reading. It is the wordiest; prices sit in sentences, not columns. A paper with three ads on day one feels empty, and yesterday's headline can go stale by the afternoon.\n\n"
          "STORY IN PLAY: Maya's WANTED ad pays 13; you print a FOR SALE at 14 instead; she answers it. Front page > Classifieds > Place an ad > answered, SOLD."),
}
FILL = {"0": "orange", "A": "green", "B": "blue", "C": "purple", "D": "pink"}

notes = {
    "brief": {"x": 0, "y": -1180, "w": 1240, "fill": "gray", "text":
              "TTP Market UI: make it a market · round 2 · 2026-10-29\n\n"
              "THE FOUNDER, ON ROUND 1 (his words): 'Maybe make it feel a little more like a market?' · 'The tickles are what are used to trade here. Basically the optimization should be to sell high to others.' · 'We need to think about other outlets.' · 'We need to trade in sets of 3 or 4 of the item. We can also trade straight up.'\n\n"
              "SAME ON EVERY ROW (row 0): a set is three of one find, the tin whistle goes alone, the price per find beside every set price · straight up: one set for 1 to 3 of one other find, no tickles · the outlets printed on every find with the buyer's gain ('Pay 11 for these three, fill your miller's order for 14') · money = the coin (tickles ready): buying spends it, selling piles it up past 25 · pig to pig: Bullion hosts and never trades, friends named, 'a pig' for strangers · a good sale is a moment (bell, cheer, 'best pinecone sale today') and demand is on screen (wanted counts, WANTED signs and ads). Only the Sale Ring changes a mechanic: timed auctions.\n\n"
              "THE SUPPLY CATCH: three of one specific find is about 19 days of digging for one pig (about 1.8 finds a day across twelve kinds). Sellers will have a set every week or so of whatever they stacked up; a buyer chasing one set will usually have to buy it. The board will be thin at first. Levers: finds per dig in The Feast's tuning, and errands.\n\n"
              "NUMBERS: the Sheep pays 3 a common (9 a set), 6 when he fancies it (18 a set); pinecone sets trade 11 to 14 (16 at a peak); an old key set 27 to 30; Orders pay up to 14. Each row is one market day, internally consistent; receipts show both kinds (dug it up: +14, and paid 9 · sold for 14 · up 5).\n\n"
              "PICK: a row, or a mix (e.g. A's square as home with B's board as each find's page; D's WANTED ads inside A's stalls). Also: sets of three for all, or four for commons?\n\n"
              "Every phone board links in Play: home > detail > put a set up > the deal. Art: the new stall, big board, sale ring, basket and Bullion-with-gavel paintings, Bullion (idle, cheer), the twelve find glyphs, Rosie, Maya's Pepper, the Ghost Sheep."},
}
for r, (key, _) in enumerate(rows):
    y = r * ROW_H
    notes[f"t{key}"] = {"x": 0, "y": y - 250, "text": TITLES[key], "kind": "title1", "maxW": row_w[key]}
    notes[f"s{key}"] = {"x": row_w[key] + GX, "y": y, "w": 560, "text": STICKY[key], "fill": FILL[key]}

now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
canvas = {
    "v": 3,
    "createdOnFiles": {"v": 1, "at": now},
    "title": "TTP Market UI: make it a market · 2026-10-29",
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
bad = [p for p, (_, html, _w, _h) in BOARDS.items() if "—" in html or "&mdash;" in html]
assert not bad, f"em dash in {bad}"
assert not any("—" in n.get("text", "") for n in notes.values()), "em dash in a note"
import re
for p, (_, html, _w, _h) in BOARDS.items():
    for href in re.findall(r'href="([^"#]+\.dc\.html)"', html):
        assert href in BOARDS, f"{p} links to missing {href}"
    for src in re.findall(r'(?:src="|url\()(/_blob/[0-9a-f]+)', html):
        assert src in A.values(), f"{p} uses an unknown blob {src}"
print("wrote", len(BOARDS), "boards + canvas.json")
