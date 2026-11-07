# Generates the boards + canvas.json for "TTP Market: Bullion · 2026-10-29".
# House approach copied from ../trader-2026-10-29/gen.py: tokens are constants/theme.ts
# verbatim (WHIMSY / FONTS / RADII / SPACE / TYPE / shadows), every board is a .dc.html.
# Spec: docs/design/market-2026-10-29/spec.md (critiques beside it).
import json, os, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "project")
os.makedirs(ROOT, exist_ok=True)

# ── art (uploaded /_blob urls) ────────────────────────────────────────────────
A = dict(
    bull_a="/_blob/e9df7f3377dc8d969dba642845612f54", bull_b="/_blob/57f5b8cf910f9fdc73e31aea3d845e9c",
    bull_c="/_blob/bf8c3f9788d52f5d27bb22655fd8325f", bull_cheer="/_blob/a5860f387b75336821ea3818c87e1e20",
    bull_shrug="/_blob/0842d210756db80bea94b0193e4b751d", g_bullion="/_blob/683deb48a79ea5bcca7815eaf51e437c",
    river_pebble="/_blob/002c6577bad52b0d2ba41ffde28a1ad3", blue_feather="/_blob/f07d9e7465b56d9499330a36b1c95c5f",
    clover="/_blob/ee5fa3d6a9655649e280a44b77ac458c", snail_shell="/_blob/d6af43802d6e35e8809e7c8d24334613",
    brass_button="/_blob/643d2ce9083d284df4feaa2277f3aa95", wool_tuft="/_blob/bde891974956a3dfe2002d0bbe8e94d4",
    red_berries="/_blob/d30df50a0e227ba407268f0579b41852", pinecone="/_blob/d63054384d6e2758bf4c65ee4de23644",
    old_key="/_blob/fc95090137f1dcfbf640313f36b30b9b", honeycomb="/_blob/db281999da28e89215dbe76c5c303e4c",
    marble="/_blob/dc0fd7d5d83e7c305663a4875cc38765", tin_whistle="/_blob/6f2c50271b0a7868f6b68a5c1f729f2e",
    rosie="/_blob/766b3c0f48ee75e7cef5966b0f563c9e", pepper="/_blob/db2ae863b7b14d65b4d8f58ea9f17f37",
    g_trader="/_blob/a53473d459745c1bb76f9d417b051d40", ghost_sheep="/_blob/dacd2964c887b78d8fd76f6498da96b1",
    g_barn="/_blob/8572cd097742b7e8433d2ba8886920be", g_bag="/_blob/e52588795bb5f4d2216aacbe7345e2ad",
    g_handshake="/_blob/58b5e91fe14944dac6a0a982327b2ce8", g_check="/_blob/cf53ded4282e0b6788a18eef02b37a02",
    g_pigface="/_blob/d6f3f702d194faeb8db5868bd3524469", g_friends="/_blob/8e77f2de920d9a414ed3fa3f3805daa1",
    g_bell="/_blob/08e01f6752a143bec02c5a7296dedff0", g_scales="/_blob/eae94ea7120bf653807016099650a189",
    g_sparkle="/_blob/23ab08088c7e35f28856a0fd71fe6db9", g_star="/_blob/12a719df8a297bd658ac4f6c0447b127",
)
NAMES = dict(river_pebble="river pebble", blue_feather="blue feather", clover="four-leaf clover", snail_shell="snail shell",
             brass_button="brass button", wool_tuft="tuft of wool", red_berries="red berries", pinecone="pinecone",
             old_key="old key", honeycomb="honeycomb chip", marble="glass marble", tin_whistle="tin whistle")
SHORT = dict(NAMES, clover="clover", wool_tuft="wool", honeycomb="honeycomb", marble="marble", brass_button="button",
             river_pebble="pebble", blue_feather="feather", snail_shell="snail shell", red_berries="berries", tin_whistle="whistle")
FINDS = ["river_pebble", "blue_feather", "clover", "snail_shell", "brass_button", "wool_tuft",
         "red_berries", "pinecone", "old_key", "honeycomb", "marble", "tin_whistle"]

# ── tokens (constants/theme.ts) ──────────────────────────────────────────────
INK = "#2a1f15"; PAPER = "#fffaf0"; CREAM = "#fbeee2"; CREAM2 = "#f6e6d4"; ROSE = "#ffd6dc"; ROSEDEEP = "#f8a8b3"
SAGE = "#c9dec1"; SUN = "#ffd87a"; LILAC = "#d6c8f0"; LILACDEEP = "#a89bff"; ACCENT = "#a03e2f"; GOLDINK = "#5A3F00"
SAGEINK = "#7A9B63"; SCRIM = "rgba(42,31,21,0.55)"
MUTE = "#605449"      # WHIMSY.mute, text-safe on every core pastel
MUTESOFT = "#8c7e71"  # WHIMSY.muteSoft, rules and boundaries only (never a word)

FONTLINK = '<link href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Fredoka:wght@600;700&amp;family=Nunito:wght@600;700;800;900&amp;family=Patrick+Hand&amp;display=swap" rel="stylesheet">'

CSS = f"""
body{{margin:0}}
a{{color:{ACCENT};text-decoration:none}}a:hover{{color:{INK}}}
.root{{width:390px;height:844px;box-sizing:border-box;position:relative;overflow:hidden;background:{PAPER};color:{INK};font-family:'Nunito',sans-serif;font-weight:700}}
.whimsy{{font-family:'Caprasimo',serif;font-weight:400}}
.hand{{font-family:'Patrick Hand',cursive;font-weight:400}}
.fredoka{{font-family:'Fredoka',sans-serif;font-weight:700}}
.pageTitle{{font-family:'Caprasimo',serif;font-weight:400;font-size:26px;line-height:28px}}
.sectionTitle{{font-family:'Caprasimo',serif;font-weight:400;font-size:22px;line-height:24px;letter-spacing:.2px}}
.cardTitle{{font-family:'Caprasimo',serif;font-weight:400;font-size:18px;line-height:22px;letter-spacing:.2px}}
.cardTitleSm{{font-family:'Caprasimo',serif;font-weight:400;font-size:15px;line-height:22px;letter-spacing:.2px}}
.displayLg{{font-family:'Caprasimo',serif;font-weight:400;font-size:36px;line-height:38px}}
.numeralLg{{font-family:'Caprasimo',serif;font-weight:400;font-size:26px;line-height:28px}}
.numeral{{font-family:'Caprasimo',serif;font-weight:400;font-size:16px;line-height:20px}}
.numIn{{font-family:'Caprasimo',serif;font-weight:400;font-size:1.06em;letter-spacing:.2px}}
.body{{font-size:15px;line-height:21px}}
.bodySm{{font-size:13px;line-height:18px}}
.label{{font-weight:800;font-size:12px;line-height:16px;letter-spacing:.3px}}
.kicker{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:13px;line-height:18px;letter-spacing:.4px}}
.handT{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:14px;line-height:20px}}
.handLg{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:17px;line-height:24px}}
.handDisplay{{font-family:'Patrick Hand',cursive;font-weight:400;font-size:21px;line-height:28px}}
.kickerPill{{font-weight:800;font-size:11px;line-height:14px;letter-spacing:1.6px;text-transform:uppercase}}
.kickerPillSm{{font-weight:800;font-size:10px;line-height:13px;letter-spacing:1.6px;text-transform:uppercase}}
.mute{{color:{MUTE}}}
.acc{{color:{ACCENT}}}
.sticker{{border:2px solid {INK};box-shadow:4px 4px 0 {INK};box-sizing:border-box}}
.stickerSm{{border:2px solid {INK};box-shadow:2px 2px 0 {INK};box-sizing:border-box}}
.flat{{border:2px solid {INK};box-sizing:border-box}}
.dashed{{border:2px dashed {INK};box-sizing:border-box}}
.btn{{font:inherit;color:{INK};margin:0;cursor:pointer;-webkit-appearance:none;appearance:none;text-align:left}}
.clip{{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
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
    """The market's currency: a tiny TickleCoin (paper face, heavy rim, dashed minted
    ring, the rose chip on its shoulder). Reads as 'tickles ready', never as the pink
    snout (the tickled count)."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none">'
            f'<g transform="rotate(4 12 12)"><circle cx="12.6" cy="13" r="9.3" fill="{PAPER}" stroke="{INK}" stroke-width="2.4"/>'
            f'<circle cx="12.6" cy="13" r="5.5" fill="none" stroke="{INK}" stroke-width="1.2" stroke-dasharray="2.2 1.8" opacity=".45"/></g>'
            f'<circle cx="5.2" cy="5.4" r="3.7" fill="{ROSE}" stroke="{INK}" stroke-width="1.4"/></svg>')


def snout(size=18):
    """The tickled-count mark (pink snout), used only on the cut draft (row C)."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none">'
            f'<ellipse cx="12" cy="12" rx="10" ry="8" fill="{ROSEDEEP}" stroke="{INK}" stroke-width="1.6"/>'
            f'<ellipse cx="9" cy="13" rx="1.3" ry="1.8" fill="{INK}"/><ellipse cx="15" cy="13" rx="1.3" ry="1.8" fill="{INK}"/></svg>')


def xmark():
    return f'<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="{INK}" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'


def pm_svg(plus):
    v = '<path d="M12 5 V19" stroke-linecap="round"/>' if plus else ""
    return (f'<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" stroke="{INK}" stroke-width="3.2" fill="none">'
            f'<path d="M5 12 H19" stroke-linecap="round"/>{v}</svg>')


def nm(n):
    """A price inside a sentence still wears the numeral face."""
    return f'<span class="numIn">{n}</span>'


def price(n, cls="numeral", mark=15, gap=3):
    return f'<span style="display:inline-flex;align-items:center;gap:{gap}px;white-space:nowrap"><span class="{cls}">{n}</span>{coin_mark(mark)}</span>'


# ── pieces ───────────────────────────────────────────────────────────────────
def sticker(inner, color=PAPER, radius=14, rot=0, shadow="sticker", style="", pad="12px 14px"):
    cls = {"sticker": "sticker", "sm": "stickerSm", "flat": "flat", "dashed": "dashed", "none": ""}[shadow]
    return (f'<div class="{cls}" style="background:{color};border-radius:{radius}px;padding:{pad};'
            f'transform:rotate({rot}deg);{style}">{inner}</div>')


def crown(kicker, title, sub=None):
    s = f'<div class="handT mute" style="margin-top:4px">{sub}</div>' if sub else ""
    return (f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0">'
            f'<div class="kickerPill acc">&#9733; {kicker}</div><div class="pageTitle">{title}</div>'
            f'<div style="height:2px;width:72px;background:{INK};border-radius:2px;margin-top:6px"></div>{s}</div>')


def coin(n, cap="of 25", size=72, label="tickles ready"):
    """TickleCoin (components/TickleCoin.tsx) drawn small: paper face, heavy rim, sticker
    shadow, 4deg lean, dashed minted ring, rose sparkle chip, Caprasimo count, hand cap."""
    chip = max(22, round(size * .3))
    fs = round(size * .4)
    capfs = 13 if size < 90 else 15
    spoken = f"{n} {'tickles banked' if cap == 'banked' else cap + ' tickles ready'}"
    lab = f'<div class="handT" style="text-align:center;white-space:nowrap">{label}</div>' if label else ""
    return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:none">'
            f'<button type="button" class="btn" aria-label="{spoken}" style="position:relative;width:{size}px;height:{size}px;border-radius:999px;border:3px solid {INK};background:{PAPER};box-shadow:4px 4px 0 {INK};transform:rotate(4deg);display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:0;text-align:center">'
            f'<span aria-hidden="true" style="position:absolute;inset:{4 if size < 80 else 6}px;border-radius:999px;border:2px dashed {INK};opacity:.3"></span>'
            f'<span aria-hidden="true" style="position:absolute;top:-8px;left:-8px;width:{chip}px;height:{chip}px;border-radius:999px;border:2px solid {INK};background:{ROSE};box-shadow:2px 2px 0 {INK};transform:rotate(-8deg);display:flex;align-items:center;justify-content:center;box-sizing:border-box">'
            f'<img src="{A["g_sparkle"]}" alt="" style="width:{round(chip * .62)}px;height:{round(chip * .62)}px;object-fit:contain"></span>'
            f'<span class="whimsy" style="font-size:{fs}px;line-height:{fs + 2}px;margin-top:-2px">{n}</span>'
            f'<span class="hand mute" style="font-size:{capfs}px;line-height:{capfs + 2}px;margin-top:-2px">{cap}</span></button>{lab}</div>')


def corner_coin(n, cap="of 25", size=68, top=14, label="tickles ready"):
    return f'<div style="position:absolute;right:18px;top:{top}px">{coin(n, cap, size, label)}</div>'


def back_link(text, href, top=18):
    return (f'<a href="{href}" class="flat" style="position:absolute;left:16px;top:{top}px;display:inline-flex;align-items:center;gap:6px;'
            f'background:{CREAM};border-radius:999px;padding:0 14px 0 12px;min-height:44px;color:{INK}"><span class="cardTitleSm" style="font-size:18px">&#8249;</span><span class="label">{text}</span></a>')


def section_header(t, sub=None, style=""):
    s = f'<div class="handT mute" style="white-space:nowrap">{sub}</div>' if sub else ""
    return f'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;{style}"><div class="sectionTitle">{t}</div>{s}</div>'


def hand_line(text, cls="handT mute", align="center", style=""):
    return f'<div class="{cls}" style="text-align:{align};{style}">{text}</div>'


def bull_say(img, inner, color=PAPER, size=84, rot=-1.2, alt="Bullion the bull", shadow="sm"):
    return (f'<div style="display:flex;align-items:center;gap:6px"><img src="{img}" alt="{alt}" style="width:{size}px;height:{size}px;object-fit:contain;flex:none">'
            f'{sticker(inner, color=color, radius=18, rot=rot, shadow=shadow, style="flex:1;min-width:0", pad="10px 12px")}</div>')


def face(img, size=24):
    return f'<img src="{img}" alt="" aria-hidden="true" class="flat" style="width:{size}px;height:{size}px;border-radius:999px;background:{CREAM};object-fit:cover;flex:none;border-width:1.5px">'


def glyph(fid, size=34, style=""):
    return f'<img src="{A[fid]}" alt="" aria-hidden="true" style="width:{size}px;height:{size}px;object-fit:contain;flex:none;{style}">'


def ticket(stub, cap, label, href=None, tone="golden", stub_right=False, aria=None, style=""):
    """TicketButton. The market's commits read as a sentence, so its stub (the price)
    tears off the RIGHT end: 'Buy now for | 5 tickles'. Price stated once, on the stub."""
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
    return (f'<{tag}{attr}{ar} class="sticker btn" style="display:flex;height:64px;border-radius:14px;overflow:hidden;background:{face_c};color:{INK};padding:0;{style}">{inner}</{tag}>')


def pill_btn(text, href=None, fill=CREAM, shadow="flat", style=""):
    cls = {"flat": "flat", "sm": "stickerSm", "sticker": "sticker"}[shadow]
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    return (f'<{tag}{attr} class="{cls} btn" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:{fill};border-radius:999px;'
            f'padding:0 16px;min-height:44px;color:{INK};{style}"><span class="label" style="font-size:13px">{text}</span></{tag}>')


def toast(glyph_url, title, sub, color=PAPER, top=128, rot=-1.2, right=16):
    inner = (f'<div style="display:flex;align-items:center;gap:10px"><img src="{glyph_url}" alt="" aria-hidden="true" style="width:44px;height:44px;object-fit:contain;flex:none">'
             f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="cardTitle">{title}</div><div class="handT mute">{sub}</div></div></div>')
    return f'<div style="position:absolute;left:16px;right:{right}px;top:{top}px">{sticker(inner, color=color, radius=18, rot=rot, pad="10px 14px")}</div>'


def segmented(options, chosen):
    segs = ""
    for o in options:
        on = o == chosen
        segs += (f'<button type="button" class="btn" aria-pressed="{"true" if on else "false"}" style="flex:1;min-height:44px;border-radius:999px;'
                 f'border:1.5px solid {INK if on else "transparent"};background:{SUN if on else "transparent"};display:flex;align-items:center;justify-content:center;padding:0 8px">'
                 f'<span class="label" style="font-size:13px;color:{INK if on else MUTE}">{o}</span></button>')
    return f'<div class="flat" style="display:flex;gap:4px;padding:4px;border-radius:999px;background:{PAPER}">{segs}</div>'


def stepper(n, band):
    rb = (f'border-radius:999px;background:{CREAM};width:56px;height:56px;display:flex;align-items:center;justify-content:center;padding:0;flex:none')
    return (f'<div style="display:flex;align-items:center;justify-content:center;gap:22px">'
            f'<button type="button" class="stickerSm btn" aria-label="One less" style="{rb}">{pm_svg(False)}</button>'
            f'<div style="display:flex;align-items:center;gap:6px;min-width:96px;justify-content:center"><span class="whimsy" style="font-size:56px;line-height:58px">{n}</span>{coin_mark(28)}</div>'
            f'<button type="button" class="stickerSm btn" aria-label="One more" style="{rb}">{pm_svg(True)}</button></div>'
            f'<div class="handT mute" style="text-align:center;margin-top:-2px">{band}</div>')


# ── the yard + the Barn button's fan ─────────────────────────────────────────
def yard():
    h = f'<div style="position:absolute;inset:0;background:{PAPER}"></div>'
    h += f'<div style="position:absolute;left:0;right:0;top:430px;bottom:0;background:{SAGE};border-top:2px solid {INK}"></div>'
    for i, (x, w) in enumerate([(-10, 80), (60, 70), (120, 86), (196, 72), (258, 84), (330, 80)]):
        h += (f'<div style="position:absolute;left:{x}px;top:{400 - (i % 2) * 8}px;width:{w}px;height:{w // 2 + 20}px;background:{SAGEINK};'
              f'border:2px solid {INK};border-radius:{w}px {w}px 10px 10px;box-shadow:2px 2px 0 {INK}"></div>')
    h += f'<img src="{A["ghost_sheep"]}" alt="The Ghost Sheep Trader at the hedge" style="position:absolute;left:246px;top:318px;width:120px;height:120px;object-fit:contain">'
    h += f'<img src="{A["rosie"]}" alt="Rosie, your pig" style="position:absolute;left:34px;top:290px;width:168px;height:168px;object-fit:contain">'
    return h


def fan(rows, w=278):
    """rows: (glyph_url, title, sub, highlight, href)."""
    items = ""
    for g, t, s, hi, href in rows:
        bg = SUN if hi else PAPER
        cls = "sticker" if hi else "stickerSm"
        bd = "border-width:3px;" if hi else ""
        tag = "a" if href else "button"
        attr = f' href="{href}"' if href else ' type="button"'
        items += (f'<{tag}{attr} class="{cls} btn" style="display:flex;align-items:center;gap:10px;background:{bg};{bd}border-radius:14px;padding:8px 12px 8px 8px;min-height:56px;width:{w}px;color:{INK}">'
                  f'<img src="{g}" alt="" aria-hidden="true" style="width:38px;height:38px;object-fit:contain;flex:none">'
                  f'<span style="display:flex;flex-direction:column;min-width:0"><span class="cardTitleSm">{t}</span><span class="handT mute clip">{s}</span></span></{tag}>')
    h = f'<div style="position:absolute;right:16px;bottom:116px;display:flex;flex-direction:column;align-items:flex-end;gap:10px">{items}</div>'
    h += (f'<button type="button" aria-label="Barn menu" class="sticker btn" style="position:absolute;right:16px;bottom:36px;width:68px;height:68px;border-radius:999px;background:{SUN};display:flex;align-items:center;justify-content:center;padding:0">'
          f'<img src="{A["g_barn"]}" alt="" aria-hidden="true" style="width:44px;height:44px;object-fit:contain"></button>')
    return h


def sheet(kicker, title, body, footer, top, scene, close_href):
    h = scene + f'<div style="position:absolute;inset:0;background:{SCRIM}"></div>'
    h += (f'<div style="position:absolute;left:0;right:0;top:{top}px;bottom:0;background:{PAPER};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;box-sizing:border-box;display:flex;flex-direction:column">'
          f'<div style="align-self:center;width:44px;height:4px;border-radius:2px;background:{CREAM2};margin-top:10px"></div>'
          f'<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 16px 0 16px">{crown(kicker, title)}'
          f'<a href="{close_href}" aria-label="Close" class="flat" style="width:44px;height:44px;border-radius:999px;background:{CREAM};display:flex;align-items:center;justify-content:center;flex:none">{xmark()}</a></div>'
          f'<div style="flex:1;min-height:0;overflow:hidden;padding:14px 16px 0 16px;display:flex;flex-direction:column;gap:10px">{body}</div>'
          f'<div style="padding:12px 16px 28px 16px;border-top:2px solid {CREAM2}">{footer}</div></div>')
    return h


# ═════════════════════════════════════════════════════════════════════════════
# ROW 0 · Bullion (the character board, not a phone)
# ═════════════════════════════════════════════════════════════════════════════
BW, BH = 1240, 640


def look_card(tag, img, caption, w, hero=False, extra=""):
    color = SUN if hero else PAPER
    tagbg = INK if hero else CREAM
    tagfg = PAPER if hero else INK
    return (f'<div class="sticker" style="width:{w}px;height:332px;background:{color};border-radius:22px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;'
            f'transform:rotate({-0.6 if hero else (0.5 if tag == "B" else -0.4)}deg)">'
            f'<div style="display:flex"><span class="kickerPillSm" style="background:{tagbg};color:{tagfg};border:2px solid {INK};border-radius:999px;padding:3px 10px">{tag}</span></div>'
            f'<div style="flex:1;min-height:0;display:flex;align-items:center;gap:10px">'
            f'<img src="{img}" alt="Bullion, look {tag[0]}" style="flex:1;min-width:0;height:100%;object-fit:contain">{extra}</div>'
            f'<div class="handLg" style="text-align:center">{caption}</div></div>')


def pose(img, cap, alt):
    return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:112px">'
            f'<img src="{img}" alt="{alt}" class="flat" style="width:92px;height:92px;object-fit:contain;background:{PAPER};border-radius:14px;padding:4px">'
            f'<div class="kicker" style="text-align:center">{cap}</div></div>')


def chips(words):
    return "".join(f'<span class="flat handT" style="background:{PAPER};border-radius:999px;padding:3px 12px;white-space:nowrap">{w}</span>' for w in words)


def host_card(img, name, words, loud):
    cls = "sticker" if loud else "flat"
    bg = CREAM if loud else CREAM2
    return (f'<div class="{cls}" style="flex:1;min-width:0;background:{bg};border-radius:18px;padding:12px 16px;display:flex;align-items:center;gap:14px;'
            f'transform:rotate({-0.5 if loud else 0.3}deg)">'
            f'<img src="{img}" alt="" aria-hidden="true" style="width:84px;height:84px;object-fit:contain;flex:none">'
            f'<div style="display:flex;flex-direction:column;gap:8px;min-width:0"><div class="cardTitle">{name}</div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:6px">{chips(words)}</div></div></div>')


R0 = page("Bullion · the host", (
    f'<div class="root" style="width:{BW}px;height:{BH}px;padding:28px 32px">'
    f'<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px">'
    f'{crown("MEET THE HOST", "Bullion")}'
    f'<div class="handLg mute" style="max-width:560px;text-align:right">Loud, sunny, always at the market. He hosts every deal between pigs, cheers both sides, and never buys or sells a thing himself.</div></div>'
    f'<div style="display:flex;gap:28px;margin-top:22px">'
    + look_card("A · RECOMMENDED", A["bull_a"], "Green visor, mustard waistcoat, a chalk slate going up.", 520, hero=True,
                extra=f'<div style="display:flex;flex-direction:column;gap:6px;flex:none">{pose(A["bull_cheer"], "a deal done", "Bullion cheering, hooves up")}{pose(A["bull_shrug"], "a quiet board", "Bullion shrugging, palms up")}</div>')
    + look_card("B", A["bull_b"], "Straw boater, red bow tie, a brass bell to ring each deal. A fairground caller.", 300)
    + look_card("C", A["bull_c"], "Striped apron, spectacles, a balance scale. A careful shopkeeper.", 300)
    + '</div>'
    f'<div style="display:flex;gap:24px;margin-top:26px">'
    + host_card(A["g_bullion"], "Bullion", ["loud", "sunny", "always at the market", "hosts every deal", "never buys or sells"], True)
    + host_card(A["ghost_sheep"], "The Ghost Sheep", ["quiet", "hooded", "once a day", "collects finds out of the world"], False)
    + '</div></div>'), BW, BH)

# ═════════════════════════════════════════════════════════════════════════════
# ROW A · Bullion's Market (building this)
# ═════════════════════════════════════════════════════════════════════════════
# per find: (last sold, change word, best selling, best buying, you have)
BOOK = {
    "river_pebble": (2, "same", 3, 2, 4), "blue_feather": (3, "up 1", 4, 3, 1), "clover": (3, "same", 3, 2, 0),
    "snail_shell": (2, "down 1", 2, 1, 3), "brass_button": (4, "up 1", 5, 3, 0), "wool_tuft": (3, "same", 4, 2, 1),
    "red_berries": (3, "down 1", 4, 2, 0), "pinecone": (5, "up 1", 5, 4, 2), "old_key": (9, "up 2", 10, 7, 0),
    "honeycomb": (8, "same", 9, 6, 1), "marble": (7, "down 1", 8, 6, 0), "tin_whistle": (None, None, None, 16, 0),
}

# A1 · the yard, the fan open
FAN = [(A["g_barn"], "Enter Barn", "Rosie is home", False, None),
       (A["g_bag"], "Satchel", "12 finds · 2 pinecones", False, None),
       (A["g_trader"], "Trader", "the Ghost Sheep · 4h left", False, None),
       (A["g_bullion"], "Market", "Bullion · 4 pigs selling pinecones", True, "A2.dc.html")]

A1 = page("A1 The fan", (
    f'<div class="root">{yard()}'
    f'<div style="position:absolute;left:16px;top:22px">{crown("YOUR BARN", "The yard")}</div>'
    + corner_coin(18, size=84, top=16)
    + toast(A["g_bullion"], "Bullion's Market is open", "Post the price you'll pay or take for a find. Bullion finds you a pig who agrees.", top=146, rot=-1)
    + fan(FAN) + '</div>'))


# A2 · the market page
def find_row(fid, href=None):
    last, change, sell, buy, have = BOOK[fid]
    sub = (f"selling from {nm(sell)}" if sell else "no pig selling yet") + " · " + (f"buying at {nm(buy)}" if buy else "no pig buying yet")
    have_tag = (f'<span class="kicker" style="background:{CREAM};border:1.5px solid {CREAM2};border-radius:999px;padding:0 8px;white-space:nowrap;flex:none">you have {have}</span>' if have else "")
    if last:
        right = price(last, "numeral", 14) + f'<span class="label {"" if change.startswith("up") else "mute"}" style="font-size:11px;line-height:14px">{change}</span>'
    else:
        right = f'<span class="kicker mute" style="white-space:nowrap">not yet</span>'
    inner = (f'{glyph(fid, 34)}<span style="flex:1;min-width:0;display:flex;flex-direction:column">'
             f'<span style="display:flex;align-items:center;gap:6px;min-width:0"><span class="cardTitleSm clip">{NAMES[fid]}</span>{have_tag}</span>'
             f'<span class="kicker mute clip">{sub}</span></span>'
             f'<span style="display:flex;flex-direction:column;align-items:flex-end;flex:none;min-width:40px">{right}</span>')
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    return (f'<{tag}{attr} class="stickerSm btn" aria-label="{NAMES[fid]}" style="display:flex;align-items:center;gap:10px;min-height:50px;padding:3px 12px 3px 8px;background:{PAPER};border-radius:14px;color:{INK};width:100%;box-sizing:border-box">{inner}</{tag}>')


def offer_row(fid, verb, price_n, left, action="Cancel"):
    return (f'<div class="stickerSm" style="display:flex;align-items:center;gap:10px;padding:6px 8px 6px 10px;background:{PAPER};border-radius:14px">'
            f'{glyph(fid, 36)}<div style="flex:1;min-width:0;display:flex;flex-direction:column">'
            f'<div class="cardTitleSm clip">{verb} {"an" if NAMES[fid][0] in "aeiou" else "a"} {NAMES[fid]}</div>'
            f'<div class="kicker mute">{"asking" if verb == "Selling" else "paying"} {nm(price_n)} · {left}</div></div>'
            f'{pill_btn(action)}</div>')


A2_rows = "".join(find_row(f, "A3.dc.html" if f == "pinecone" else ("A6.dc.html" if f == "tin_whistle" else None)) for f in FINDS)
A2 = page("A2 The market", (
    f'<div class="root"><div style="position:absolute;inset:0;padding:20px 16px 0 16px;display:flex;flex-direction:column;gap:10px">'
    f'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;min-height:96px">'
    f'{crown("THE MARKET", "Bullion&#8217;s Market", "spent " + nm(23) + " · took in " + nm(31))}<div style="padding:4px 2px 0 0">{coin(18, size=70)}</div></div>'
    + bull_say(A["bull_a"], f'<div class="handLg">14 pinecones changed hooves yesterday, last at {nm(5)}. Up, up, up!</div>', color=SUN, size=82)
    + section_header("Your offers", "1 of 4 up", "margin-top:2px")
    + offer_row("pinecone", "Selling", 6, "20h left")
    + section_header("The finds", "last sold", "margin-top:4px")
    + f'<div style="display:flex;flex-direction:column;gap:6px">{A2_rows}</div>'
    + '</div></div>'))


# A3 · the pinecone page
def strip_svg(days, prices, w=334, h=86):
    n = len(prices)
    x0, x1 = 18, w - 18
    step = (x1 - x0) / (n - 1)
    lo, hi = min(prices) - 0.6, max(prices) + 0.6
    top, bot = 22, h - 24

    def y(p):
        return top + (hi - p) / (hi - lo) * (bot - top)
    pts = [(x0 + i * step, y(p)) for i, p in enumerate(prices)]
    poly = " ".join(f"{x:.1f},{yy:.1f}" for x, yy in pts)
    s = (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="Last sold each day: '
         + ", ".join(f"{d} {p}" for d, p in zip(days, prices)) + '" style="display:block">')
    s += f'<polyline points="{poly}" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    for i, ((x, yy), p, d) in enumerate(zip(pts, prices, days)):
        last = i == n - 1
        s += f'<circle cx="{x:.1f}" cy="{yy:.1f}" r="{7 if last else 4.6}" fill="{SUN if last else PAPER}" stroke="{INK}" stroke-width="2"/>'
        s += f'<text x="{x:.1f}" y="{yy - (12 if last else 10):.1f}" text-anchor="middle" font-family="Caprasimo, serif" font-size="{15 if last else 13}" fill="{INK}">{p}</text>'
        s += f'<text x="{x:.1f}" y="{h - 4}" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="13" fill="{MUTE}">{d}</text>'
    return s + "</svg>"


def book_col(title, rows):
    """rows: (price, who_html, mine)."""
    r = ""
    for i, (p, who, mine) in enumerate(rows):
        bt = f"border-top:2px dashed {CREAM2};" if i else ""
        bg = f"background:{CREAM};border-radius:10px;" if mine else ""
        cls = "numeralLg" if i == 0 else "numeral"
        fs = "font-size:22px;line-height:24px" if i == 0 else ""
        r += (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:34px;padding:0 6px;{bt}{bg}">'
              f'<span style="display:inline-flex;align-items:center;gap:3px"><span class="{cls}" style="{fs}">{p}</span>{coin_mark(14 if i else 17)}</span>'
              f'<span style="display:inline-flex;align-items:center;gap:5px" class="handT">{who}</span></div>')
    return (f'<div class="stickerSm" style="flex:1;min-width:0;background:{PAPER};border-radius:14px;padding:8px 8px 6px 8px">'
            f'<div class="cardTitleSm" style="padding:0 6px 4px 6px">{title}</div>{r}</div>')


BIDS = [(4, f'{face(A["pepper"], 22)}Maya', False), (3, "2 pigs", False), (2, "a pig", False)]
ASKS = [(5, "a pig", False), (6, '<span class="acc">you</span>', True), (7, "3 pigs", False)]
DAYS = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"]
PCS = [3, 3, 4, 3, 4, 4, 5]


def pinecone_top(n_coin=18, tally=None):
    h = back_link("The market", "A2.dc.html")
    h += corner_coin(n_coin, size=68, top=14)
    h += (f'<div style="position:absolute;left:16px;right:96px;top:74px;display:flex;align-items:center;gap:14px">'
          f'<div class="sticker" style="width:96px;height:96px;border-radius:18px;background:{CREAM};display:flex;align-items:center;justify-content:center;transform:rotate(-2deg);flex:none">{glyph("pinecone", 74)}</div>'
          f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="kickerPill acc">&#9733; COMMON FIND</div><div class="pageTitle">Pinecone</div>'
          f'<div style="display:flex;align-items:center;gap:6px;margin-top:2px"><span class="handLg">Last sold for</span>{price(5, "displayLg", 22, 4)}</div>'
          f'<div class="label">up 1 since Tuesday</div></div></div>')
    return h


def a3_scene():
    h = pinecone_top()
    h += (f'<div style="position:absolute;left:16px;right:16px;top:188px;display:flex;flex-direction:column;gap:12px">'
          f'<div class="flat" style="background:{CREAM};border-radius:14px;padding:6px 10px 4px 10px">'
          f'<div class="kicker mute">last sold, each of the last seven days</div>{strip_svg(DAYS, PCS)}</div>'
          f'<div class="flat" style="display:flex;align-items:center;gap:10px;background:{PAPER};border-radius:14px;padding:6px 12px 6px 8px">'
          f'<img src="{A["g_trader"]}" alt="" aria-hidden="true" style="width:36px;height:36px;object-fit:contain;flex:none">'
          f'<div class="handT" style="text-wrap:balance">The Ghost Sheep pays {nm(3)} · yours fancies pinecones today: {nm(6)}</div></div>'
          + section_header("The board", "ties go to who came first", "margin-top:2px")
          + f'<div style="display:flex;gap:10px">{book_col("Pigs buying", BIDS)}{book_col("Pigs selling", ASKS)}</div>'
          f'<div class="flat" style="display:flex;align-items:center;gap:10px;background:{CREAM};border-radius:14px;padding:6px 12px 6px 10px;margin-top:2px">'
          f'<div style="display:flex;flex:none">{glyph("pinecone", 30)}{glyph("pinecone", 30, "margin-left:-14px")}</div>'
          f'<div style="display:flex;flex-direction:column;min-width:0"><div class="cardTitleSm">you have 2</div>'
          f'<div class="kicker mute">one you bought for {nm(4)} · one more is up for {nm(6)}</div></div></div></div>')
    h += (f'<div style="position:absolute;left:16px;right:16px;bottom:26px;display:flex;flex-direction:column;gap:10px">'
          f'<div style="display:flex;gap:10px">'
          + ticket("5", "tickles", "Buy now for", href="A5.dc.html", tone="golden", stub_right=True, aria="Buy now for 5 tickles", style="flex:1;min-width:0")
          + ticket("4", "tickles", "Sell now for", tone="paper", stub_right=True, aria="Sell now for 4 tickles", style="flex:1;min-width:0")
          + '</div>'
          + pill_btn("Name your price", "A4.dc.html", fill=CREAM, shadow="sm", style="width:100%;min-height:48px")
          + '</div>')
    return h


A3 = page("A3 The pinecone", f'<div class="root">{a3_scene()}</div>')


# A4 · Name your price (sheet over A3)
def ask_chip(p, who, kind="plain"):
    st = {"plain": f"background:{PAPER};", "mine": f"background:{CREAM};", "new": f"background:{PAPER};border-style:dashed;border-width:2.5px;"}[kind]
    return (f'<span class="flat" style="display:inline-flex;align-items:center;gap:4px;border-radius:12px;padding:4px 10px;{st}">'
            f'<span class="numeral">{p}</span>{coin_mark(13)}<span class="kicker{" acc" if kind != "plain" else ""}" style="white-space:nowrap">{who}</span></span>')


A4_body = (segmented(["Selling", "Buying"], "Selling")
           + '<div style="margin-top:4px">' + stepper(5, "1 to 9 for a pinecone") + '</div>'
           + f'<div class="flat" style="background:{CREAM};border-radius:14px;padding:8px 10px;display:flex;flex-direction:column;gap:6px">'
           f'<div class="kicker mute">where it would sit · pigs selling, cheapest first</div>'
           f'<div style="display:flex;gap:6px;flex-wrap:nowrap">{ask_chip(5, "a pig")}{ask_chip(5, "yours", "new")}{ask_chip(6, "you", "mine")}{ask_chip(7, "3 pigs")}</div>'
           f'<div class="handT">you&#8217;d tie the cheapest pig selling. First come, first sold.</div></div>'
           + hand_line("stays up 24 hours · cancel any time")
           + bull_say(A["bull_a"], '<div class="handLg">Ask high and you might wait. Ask low and it goes quick.</div>', size=72, rot=1))
A4 = page("A4 Name your price", '<div class="root">' + sheet("PINECONE", "Name your price", A4_body,
          ticket("5", "tickles", "Put it up for", href="A5.dc.html", tone="golden", stub_right=True, aria="Put a pinecone up for 5 tickles"),
          top=258, scene=a3_scene(), close_href="A3.dc.html") + '</div>')


# A5 · receipt
def push_row(title, sub, when="now"):
    return (f'<div class="flat" style="display:flex;align-items:center;gap:10px;background:{CREAM2};border-radius:18px;padding:10px 12px">'
            f'<img src="{A["g_bullion"]}" alt="" aria-hidden="true" class="flat" style="width:38px;height:38px;border-radius:10px;background:{PAPER};object-fit:contain;padding:2px;flex:none;border-width:1.5px">'
            f'<div style="flex:1;min-width:0;display:flex;flex-direction:column"><div class="kickerPillSm mute">Tickle the Pig · {when}</div>'
            f'<div class="cardTitleSm">{title}</div><div class="kicker mute">{sub}</div></div>{face(A["pepper"], 36)}</div>')


A5 = page("A5 Receipt", (
    f'<div class="root">{back_link("The market", "A2.dc.html")}{corner_coin(13, size=68, top=14)}'
    f'<div style="position:absolute;left:16px;right:16px;top:104px;display:flex;flex-direction:column;gap:12px">'
    f'<div style="display:flex;align-items:flex-end;gap:4px;margin-left:-6px">'
    f'<img src="{A["bull_cheer"]}" alt="Bullion cheering, hooves up" style="width:150px;height:150px;object-fit:contain;flex:none">'
    + sticker('<div class="handLg">A fine deal between fine pigs! Up, up, up!</div>', color=PAPER, radius=18, rot=1.2, shadow="sm", pad="10px 12px", style="flex:1;min-width:0;margin-bottom:34px")
    + '</div>'
    + sticker(f'<div class="cardTitle">You bought a pinecone from a pig for {nm(5)}</div>'
              f'<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span class="numeralLg">18</span><span class="handLg mute">&rarr;</span><span class="numeralLg">13</span>{coin_mark(20)}'
              f'<span class="kickerPill mute" style="margin-left:4px">tickles ready</span></div>',
              color=SUN, radius=18, rot=-0.8, pad="12px 14px")
    + sticker(f'<div style="display:flex;align-items:center;gap:10px">{glyph("pinecone", 44)}<div style="display:flex;flex-direction:column;min-width:0">'
              f'<div class="cardTitleSm">It&#8217;s in your Satchel</div><div class="kicker mute">you have 3 now · this one cost {nm(5)}</div></div></div>',
              color=PAPER, radius=14, rot=0.5, shadow="sm", pad="8px 12px")
    + f'<div class="flat" style="display:flex;align-items:center;gap:10px;background:{CREAM};border-radius:14px;padding:6px 12px 6px 8px">'
    f'<img src="{A["g_trader"]}" alt="" aria-hidden="true" style="width:36px;height:36px;object-fit:contain;flex:none">'
    f'<div class="handT">Your Ghost Sheep fancies pinecones today and pays {nm(6)}</div></div>'
    + section_header("Later", "when the one you put up sells", "margin-top:8px")
    + push_row("Maya bought your pinecone for " + nm(5), "Paid " + nm(4) + " · sold for " + nm(5) + " · up 1")
    + hand_line("the push and the Inbox row say the same words · the pig who waited hears it too", "kicker mute")
    + '</div>'
    f'<div style="position:absolute;left:16px;right:16px;bottom:30px;display:flex;justify-content:center">{pill_btn("Back to the market", "A2.dc.html", fill=CREAM, shadow="sm", style="min-width:220px")}</div>'
    + '</div>'))


# A6 · quiet states
def quiet(kicker, inner, rot, color=PAPER):
    return sticker(f'<div class="kickerPillSm acc" style="margin-bottom:4px">&#9733; {kicker}</div>{inner}', color=color, radius=16, rot=rot, shadow="sm", pad="10px 12px")


def quiet_row(fid, title, sub, action=""):
    return (f'<div style="display:flex;align-items:center;gap:10px">{glyph(fid, 40)}<div style="flex:1;min-width:0;display:flex;flex-direction:column">'
            f'<div class="cardTitleSm">{title}</div><div class="handT mute">{sub}</div></div></div>{action}')


A6 = page("A6 Quiet states", (
    f'<div class="root"><div style="position:absolute;left:16px;top:22px">{crown("THE MARKET", "Quiet moments")}</div>{corner_coin(18, size=68, top=14)}'
    f'<div style="position:absolute;left:16px;right:16px;top:112px;display:flex;flex-direction:column;gap:14px">'
    + bull_say(A["bull_shrug"], '<div class="handLg">Not every day is a big one. Last sold is a clue, not a promise.</div>', size=118, rot=-1)
    + quiet("BUY NOW, A HOOF TOO LATE",
            f'<div class="cardTitle">The price moved</div><div class="handT mute">The pig selling at {nm(5)} just sold. Next is {nm(6)}.</div>'
            f'<div style="display:flex;gap:8px;margin-top:8px">{pill_btn("Buy for " + nm(6) + "?", "A5.dc.html", fill=SUN, shadow="sm", style="flex:1")}{pill_btn("Not now", "A3.dc.html", style="flex:1")}</div>', -0.8)
    + quiet("AN EMPTY BOARD",
            quiet_row("tin_whistle", "No pig is selling a tin whistle yet.", "Name your price and be the first.",
                      f'<div style="display:flex;margin-top:8px">{pill_btn("Name your price", "A4.dc.html", style="flex:1")}</div>'), 0.7)
    + quiet("A LAPSED OFFER",
            quiet_row("old_key", "Your offer for an old key lapsed", "You&#8217;d tickled those tickles away. Nothing was spent, and you can post it again."), -0.5)
    + quiet("BACK IN YOUR SATCHEL",
            quiet_row("snail_shell", "Your snail shell came home", "24 hours and no taker. It&#8217;s back in your bag."), 0.6, color=CREAM)
    + '</div></div>'))

# ═════════════════════════════════════════════════════════════════════════════
# ROW B · Market day (alternative)
# ═════════════════════════════════════════════════════════════════════════════
CLEAR = {"river_pebble": (2, 9), "blue_feather": (4, 6), "clover": (3, 8), "snail_shell": (2, 11), "brass_button": (4, 5),
         "wool_tuft": (3, 4), "red_berries": (3, 7), "pinecone": (5, 14), "old_key": (8, 3), "honeycomb": (8, 2),
         "marble": (7, 2), "tin_whistle": (None, 0)}


def pigs_in(n):
    faces = "".join(f'<img src="{A["g_pigface"]}" alt="" aria-hidden="true" style="width:24px;height:24px;object-fit:contain;margin-left:{0 if i == 0 else -9}px">' for i in range(n))
    return f'<div style="display:flex;align-items:center">{faces}</div>'


def sealed_row(fid, title, sub):
    return (f'<div class="stickerSm" style="display:flex;align-items:center;gap:10px;padding:4px 8px 4px 10px;background:{PAPER};border-radius:14px">'
            f'{glyph(fid, 30)}<div style="flex:1;min-width:0;display:flex;flex-direction:column"><div class="cardTitleSm clip">{title}</div>'
            f'<div class="kicker mute">{sub} · sealed till six</div></div>{pill_btn("Change")}</div>')


B1 = page("B1 Seal a price", (
    f'<div class="root">{back_link("The market", "B1.dc.html")}{corner_coin(18, size=68, top=14)}'
    f'<div style="position:absolute;left:16px;right:96px;top:74px;display:flex;align-items:center;gap:14px">'
    f'<div class="sticker" style="width:88px;height:88px;border-radius:18px;background:{CREAM};display:flex;align-items:center;justify-content:center;transform:rotate(-2deg);flex:none">{glyph("pinecone", 66)}</div>'
    f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="kickerPill acc">&#9733; MARKET DAY</div><div class="pageTitle">Pinecone</div>'
    f'<div class="handT mute">yesterday&#8217;s bell: {nm(5)}</div></div></div>'
    f'<div style="position:absolute;left:16px;right:16px;top:180px;display:flex;flex-direction:column;gap:10px">'
    f'<div class="flat" style="background:{CREAM};border-radius:14px;padding:8px 12px;display:flex;flex-direction:column;gap:6px">'
    f'<div style="display:flex;align-items:center;gap:8px"><img src="{A["g_bell"]}" alt="" aria-hidden="true" style="width:30px;height:30px;object-fit:contain">'
    f'<div class="handT" style="flex:1">the bell rings at six · 4h 12m</div></div>'
    f'<div style="display:flex;align-items:center;gap:10px">{pigs_in(11)}<div class="handT">11 pigs are in on pinecones</div></div>'
    f'<div class="kicker mute">nobody sees a price till the bell</div></div>'
    + segmented(["Selling", "Buying"], "Selling")
    + stepper(5, "at least " + nm(5) + " · if the bell says more, you get more")
    + bull_say(A["bull_a"], '<div class="handLg">Tell me your price before the bell. At six I ring it, and every find clears at one price!</div>', size=78, rot=1)
    + section_header("Sealed today", "3 of 4", "margin-top:2px")
    + f'<div style="display:flex;flex-direction:column;gap:6px">{sealed_row("old_key", "Buying an old key", "up to " + nm(9))}{sealed_row("snail_shell", "Selling a snail shell", "at least " + nm(4))}</div>'
    + '</div>'
    f'<div style="position:absolute;left:16px;right:16px;bottom:28px">'
    + ticket("5", "at least", "Seal it for", href="B2.dc.html", tone="golden", stub_right=True, aria="Seal a pinecone at 5 tickles or more")
    + '</div></div>'))


def clear_tile(fid):
    p, n = CLEAR[fid]
    hi = fid == "pinecone"
    pr = price(p, "numeral", 14) if p else '<span class="kicker mute">no match</span>'
    sub = f"{n} traded" if n else "0 traded"
    return (f'<div class="{"sticker" if hi else "stickerSm"}" style="background:{CREAM if hi else PAPER};{"border-width:3px;" if hi else ""}border-radius:14px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:0;min-height:92px;box-sizing:border-box">'
            f'{glyph(fid, 32)}<div class="kicker clip" style="max-width:100%">{SHORT[fid]}</div>{pr}<div class="kickerPillSm mute" style="letter-spacing:.8px">{sub}</div></div>')


B2 = page("B2 The bell", (
    f'<div class="root"><div style="position:absolute;left:16px;top:22px">{crown("MARKET DAY · SIX O&#8217;CLOCK", "The bell rang")}</div>'
    f'<div style="position:absolute;left:16px;right:16px;top:100px;display:flex;flex-direction:column;gap:10px">'
    f'<div style="display:flex;align-items:center;gap:6px;position:relative">'
    f'<img src="{A["bull_cheer"]}" alt="Bullion ringing the bell" style="width:132px;height:132px;object-fit:contain;flex:none">'
    f'<img src="{A["g_bell"]}" alt="" aria-hidden="true" style="position:absolute;left:96px;top:-6px;width:54px;height:54px;object-fit:contain;transform:rotate(18deg)">'
    + sticker(f'<div class="handLg">Ding, ding! One price for every pig. Here&#8217;s where it all fell!</div>', color=SUN, radius=18, rot=-1.2, shadow="sm", pad="10px 12px", style="flex:1;min-width:0;margin-left:12px")
    + '</div>'
    + section_header("Today&#8217;s prices", "every trade at the bell price")
    + f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">{"".join(clear_tile(f) for f in FINDS)}</div>'
    + '</div>'
    f'<div style="position:absolute;left:16px;right:16px;bottom:28px">'
    + ticket("3", "offers", "See how yours went", href="B3.dc.html", tone="golden")
    + '</div></div>'))


def result_row(fid, title, sub, ok=True):
    mark = (f'<img src="{A["g_check"]}" alt="done" style="width:28px;height:28px;object-fit:contain;flex:none">' if ok else "")
    return sticker(f'<div style="display:flex;align-items:center;gap:10px">{glyph(fid, 40)}<div style="flex:1;min-width:0;display:flex;flex-direction:column">'
                   f'<div class="cardTitleSm">{title}</div><div class="kicker mute">{sub}</div></div>{mark}</div>',
                   color=PAPER if ok else CREAM, radius=14, rot=0, shadow="sm" if ok else "flat", pad="8px 12px")


B3 = page("B3 Your results", (
    f'<div class="root"><div style="position:absolute;left:16px;top:22px">{crown("MARKET DAY · YOUR RESULTS", "How it went")}</div>{corner_coin(15, size=68, top=14)}'
    f'<div style="position:absolute;left:16px;right:16px;top:118px;display:flex;flex-direction:column;gap:12px">'
    + bull_say(A["bull_a"], f'<div class="handLg">Same bell tomorrow at six. Bring your best price!</div>', size=96, rot=1)
    + sticker(f'<div style="display:flex;align-items:center;gap:8px"><span class="numeralLg">18</span><span class="handLg mute">&rarr;</span><span class="numeralLg">15</span>{coin_mark(20)}'
              f'<span class="kickerPill mute" style="margin-left:4px">tickles ready</span></div><div class="handT mute">spent {nm(8)} · took in {nm(5)}</div>',
              color=SUN, radius=18, rot=-0.8, pad="10px 14px")
    + result_row("pinecone", "Sold a pinecone for " + nm(5), "you asked at least " + nm(5) + " · Paid " + nm(4) + " · sold for " + nm(5) + " · up 1")
    + result_row("old_key", "Bought an old key for " + nm(8), "you&#8217;d have paid " + nm(9) + ". The bell said " + nm(8) + ", so " + nm(8) + " it was")
    + result_row("snail_shell", "Your snail shell came home", "the bell said " + nm(2) + ", under your " + nm(4) + " · back in your Satchel", ok=False)
    + section_header("At the same bell", None, "margin-top:6px")
    + f'<div class="flat" style="display:flex;align-items:center;gap:10px;background:{CREAM};border-radius:14px;padding:8px 12px">{face(A["pepper"], 36)}'
      f'<div style="display:flex;flex-direction:column;min-width:0"><div class="cardTitleSm">Maya traded pinecones too</div>'
      f'<div class="kicker mute">14 changed hooves at {nm(5)} · one price for every pig</div></div></div>'
    + '</div>'
    f'<div style="position:absolute;left:16px;right:16px;bottom:30px;display:flex;justify-content:center">{pill_btn("Back to market day", "B1.dc.html", fill=CREAM, shadow="sm", style="min-width:220px")}</div>'
    + '</div>'))

# ═════════════════════════════════════════════════════════════════════════════
# ROW C · Bullion makes the market (the first draft, cut)
# ═════════════════════════════════════════════════════════════════════════════
SHELF = {"river_pebble": (40, None, 4), "blue_feather": (18, 2, 4), "clover": (21, 2, 4), "snail_shell": (33, 1, 2),
         "brass_button": (9, 3, 5), "wool_tuft": (26, 2, 4), "red_berries": (14, 2, 5), "pinecone": (12, 3, 5),
         "old_key": (6, 7, 12), "honeycomb": (8, 6, 11), "marble": (11, 5, 10), "tin_whistle": (2, 18, 30)}


def tickled(n):
    inner = (f'<div style="display:flex;align-items:center;gap:6px">{snout(20)}<div class="fredoka" style="font-size:24px;line-height:26px">{n}</div></div>'
             f'<div class="kickerPillSm mute" style="text-align:right">tickled</div>')
    return f'<div style="position:absolute;right:16px;top:22px">{sticker(inner, color=CREAM, radius=14, rot=1.5, shadow="sm", pad="6px 10px")}</div>'


def snout_price(n):
    return f'<span style="display:inline-flex;align-items:center;gap:3px"><span class="numeral">{n}</span>{snout(14)}</span>'


def shelf_row(fid, href=None):
    stock, pay, ask = SHELF[fid]
    news = fid == "snail_shell"
    sub = f"on my shelf: {stock}" + (" · shelf full, not buying" if pay is None else "") + (" · the news" if news else "")
    right = (f'<div style="display:flex;flex-direction:column;align-items:flex-end;flex:none;gap:0">'
             f'<div style="display:flex;align-items:center;gap:4px"><span class="kicker mute">I pay</span>{snout_price(pay) if pay else "<span class=numeral>&#8211;</span>"}</div>'
             f'<div style="display:flex;align-items:center;gap:4px"><span class="kicker mute">I ask</span>{snout_price(ask)}</div></div>')
    inner = (f'{glyph(fid, 34)}<div style="flex:1;min-width:0;display:flex;flex-direction:column"><div class="cardTitleSm clip">{NAMES[fid]}</div>'
             f'<div class="kicker mute clip">{sub}</div></div>{right}')
    tag = "a" if href else "button"
    attr = f' href="{href}"' if href else ' type="button"'
    return (f'<{tag}{attr} class="stickerSm btn" style="display:flex;align-items:center;gap:10px;min-height:56px;padding:4px 12px 4px 8px;background:{ROSE if news else PAPER};border-radius:14px;color:{INK};width:100%;box-sizing:border-box">{inner}</{tag}>')


C1 = page("C1 Bullion's shelf", (
    f'<div class="root"><div style="position:absolute;inset:0;padding:22px 16px 0 16px;display:flex;flex-direction:column;gap:10px">'
    f'{crown("THE MARKET", "Bullion&#8217;s Shelf")}'
    + sticker(f'<div class="kickerPill acc">&#9733; Today&#8217;s news</div><div class="cardTitle">A wet night: snail shells everywhere</div>'
              f'<div class="kicker mute">snail shells down by a third till tomorrow&#8217;s headline</div>', color=PAPER, radius=16, rot=-1.2, pad="8px 12px", style="margin-top:4px")
    + bull_say(A["bull_a"], '<div class="handLg">I buy, I sell, and my prices move! Snail shells are cheap today. Scoop them up!</div>', size=80, rot=1)
    + section_header("On my shelf", "I pay · I ask")
    + f'<div style="display:flex;flex-direction:column;gap:6px">{"".join(shelf_row(f, "C2.dc.html" if f == "pinecone" else None) for f in ["snail_shell", "pinecone", "river_pebble", "blue_feather", "clover", "brass_button", "wool_tuft", "red_berries", "old_key"])}</div>'
    + f'</div>{tickled("1,204")}</div>'))

C2 = page("C2 The draft's find page", (
    f'<div class="root">{back_link("The shelf", "C1.dc.html")}{tickled("1,204")}'
    f'<div style="position:absolute;left:16px;right:16px;top:76px;display:flex;align-items:center;gap:14px">'
    f'<div class="sticker" style="width:88px;height:88px;border-radius:18px;background:{CREAM};display:flex;align-items:center;justify-content:center;transform:rotate(-2deg);flex:none">{glyph("pinecone", 66)}</div>'
    f'<div style="display:flex;flex-direction:column;gap:2px"><div class="kickerPill acc">&#9733; COMMON FIND</div><div class="pageTitle">Pinecone</div>'
    f'<div class="handT mute">12 on Bullion&#8217;s shelf · he wants 20</div></div></div>'
    f'<div style="position:absolute;left:16px;right:16px;top:186px;display:flex;flex-direction:column;gap:12px">'
    + bull_say(A["bull_a"], f'<div style="display:flex;gap:18px;align-items:baseline"><div><div class="kicker mute">I pay</div>{snout_price(3)}</div><div><div class="kicker mute">I ask</div>{snout_price(5)}</div></div>'
               f'<div class="handT mute">my prices move with my stock and the news</div>', size=78, rot=-1)
    + section_header("Pigs inside my spread")
    + sticker(f'<div style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:6px">{face(A["pepper"], 26)}<span class="handT">Maya asks</span>{snout_price(4)}</div>'
              f'<div style="display:flex;align-items:center;gap:6px"><span class="handT">a pig pays</span>{snout_price(4)}</div></div>', color=PAPER, radius=14, shadow="sm", pad="8px 12px")
    + section_header("Your pinecones")
    + sticker(f'<div style="display:flex;align-items:center;gap:10px">{glyph("pinecone", 40)}<div style="display:flex;flex-direction:column">'
              f'<div class="cardTitleSm">3 held · worth 12 now · up 2</div><div class="kicker mute">paid 10 · made at the market: +38 all time</div></div></div>',
              color=SUN, radius=16, rot=0.8, pad="10px 12px")
    + f'<div class="flat" style="display:flex;align-items:center;gap:10px;background:{CREAM};border-radius:14px;padding:6px 12px 6px 8px">'
      f'<img src="{A["g_trader"]}" alt="" aria-hidden="true" style="width:34px;height:34px;object-fit:contain;flex:none">'
      f'<div class="handT">your Sheep fancies pinecones today (pays 6)</div></div>'
    + pill_btn("Post a price inside his spread", fill=PAPER, shadow="sm", style="width:100%")
    + '</div>'
    f'<div style="position:absolute;left:16px;right:16px;bottom:28px;display:flex;flex-direction:column;gap:10px">'
    + ticket("3", "tickled", "Sell one to Bullion", tone="paper")
    + ticket("5", "tickled", "Buy one from Bullion", tone="golden")
    + '</div></div>'))

# ═════════════════════════════════════════════════════════════════════════════
# write boards
# ═════════════════════════════════════════════════════════════════════════════
BOARDS = {
    "Bullion.dc.html": ("Bullion · three looks, two poses, two hosts", R0, BW, BH),
    "Main.dc.html": ("A1 · The fan: a Market row", A1, 390, 844),
    "A2.dc.html": ("A2 · The market: chatter, coin, your offers, the twelve", A2, 390, 844),
    "A3.dc.html": ("A3 · The pinecone: last sold, the board, three ways in", A3, 390, 844),
    "A4.dc.html": ("A4 · Name your price", A4, 390, 844),
    "A5.dc.html": ("A5 · Receipt: both sides hear it", A5, 390, 844),
    "A6.dc.html": ("A6 · Quiet moments: moved, empty, lapsed, home", A6, 390, 844),
    "B1.dc.html": ("B1 · Seal a price before the bell", B1, 390, 844),
    "B2.dc.html": ("B2 · Six o'clock: the bell clears every find", B2, 390, 844),
    "B3.dc.html": ("B3 · Your results", B3, 390, 844),
    "C1.dc.html": ("C1 · Bullion's shelf: his quotes and the news", C1, 390, 844),
    "C2.dc.html": ("C2 · The draft's find page: worth and spread", C2, 390, 844),
}
for path, (_, html, _w, _h) in BOARDS.items():
    with open(os.path.join(ROOT, path), "w") as f:
        f.write(html)

# ── canvas.json ──────────────────────────────────────────────────────────────
W, H, GX, ROW_H = 390, 844, 80, 1204
rows = [("0", ["Bullion.dc.html"]),
        ("A", ["Main.dc.html", "A2.dc.html", "A3.dc.html", "A4.dc.html", "A5.dc.html", "A6.dc.html"]),
        ("B", ["B1.dc.html", "B2.dc.html", "B3.dc.html"]),
        ("C", ["C1.dc.html", "C2.dc.html"])]
boards, row_w = {}, {}
for r, (key, files) in enumerate(rows):
    y, x = r * ROW_H, 0
    for p in files:
        title, _, bw, bh = BOARDS[p]
        boards[p] = {"x": x, "y": y, "w": bw, "h": bh, "title": title, "is_interactive": True}
        x += bw + GX
    row_w[key] = x - GX
order = ["Main.dc.html", "A2.dc.html", "A3.dc.html", "A4.dc.html", "A5.dc.html", "A6.dc.html",
         "Bullion.dc.html", "B1.dc.html", "B2.dc.html", "B3.dc.html", "C1.dc.html", "C2.dc.html"]

TITLES = {
    "0": "Bullion · the host (pick a look)",
    "A": "A · Bullion's Market (building this)",
    "B": "B · Market day (alternative)",
    "C": "C · Bullion makes the market (cut)",
}
STICKY = {
    "0": ("Bullion · the host\n\n"
          "WHAT: a loud, sunny bull who lives at the market all day. He hosts every deal and never buys, sells, holds or takes a cut. He reads yesterday's busiest find off real trades ('14 pinecones changed hooves yesterday, last at 5'), says one tip per visit, and cheers both sides of every deal, whoever did better.\n\n"
          "PILLAR: Connect (he names the pig on the other side of your deal) · Collect (the finds he talks about are the twelve you dig).\n\n"
          "CHARTER CHECK: a character, never a currency · painted sticker in the Ghost Sheep's hand, never emoji · the two NPCs never blur: one hosts and is always there, one collects and comes once a day. The Sheep's fancy is why two pigs value one pinecone differently, which is why they trade.\n\n"
          "SERVER: nothing for him alone; his chatter is market_status().chatter (yesterday UTC, the busiest find, its last price).\n\n"
          "CLIENT: BullionArt with three poses (idle, cheer on a fill, shrug on a quiet board or a moved price), g_bullion for the fan row, the rotating tips in constants/market.ts.\n\n"
          "PICK: A (visor, waistcoat, chalk slate; the slate's line can follow the chatter) · B (boater, bow tie, bell) · C (apron, spectacles, scale). Recommended: A."),
    "A": ("A · Bullion's Market (building this)\n\n"
          "ONE SENTENCE: Post the price you'll pay or take for a find, and Bullion matches you with a pig who agrees.\n\n"
          "WHAT: a pig-to-pig order book for the twelve finds, one per offer, priced in tickles ready (the coin). Per find: Pigs selling (cheapest first) and Pigs buying (highest first); ties go to the earliest; a friend is named, anyone else is 'a pig'. Last sold for (a real trade, never a quote), a seven-day strip, and the Ghost Sheep's price as the anchor. Buy now / Sell now take the best offer at 'at most' / 'at least' the price you saw (worse answers 'the price moved'). Name your price rests 24 h, cancel any time; an offer that meets the board fills at once at the price already waiting. Receipts: Paid 4 · sold for 6 · up 2, or Dug it up · sold for 6. Ledger: spent 23 · took in 31.\n\n"
          "PILLAR: Collect first (buy the find you're missing, a third pinecone for a trade-up, a friend's wish) · Connect (every trade has a pig on the other side; 'Maya bought your pinecone for 5'). Contend untouched: no Board points move.\n\n"
          "CHARTER CHECK: no new currency (the coin) · pig to pig only: every tickle a buyer pays lands with a seller, the market mints nothing and burns nothing · never the tickled count, snouts or the Board · finds only, never cosmetics or anything bought with money · no fee · no red losses, no shame states (a lapsed offer is a quiet line).\n\n"
          "SERVER: 20261030120000_bullions_market.sql. market_offers / market_trades / market_receipts; satchel_items gains cost + source 'market'. market_status, market_book, market_place (nonce-idempotent, per-find advisory lock, price then time, never yourself, fills at the resting price, price_moved + best), market_cancel, dev_market_seed. app_settings.market_tuning: 4 open offers, 24 h, band 1 to 3x the Sheep's price (commons 1 to 9), 30 posts a day. Ships dark; turns on after The Feast's flip (2026-11-09).\n\n"
          "CLIENT: constants/market.ts, utils/market.ts (fail-soft: an un-pushed server reads as closed), hooks/useMarket.ts, app/market.tsx + components/market/* (slate, find page, stepper, receipt, BullionArt), a Market row on the Barn fan while enabled.\n\n"
          "FLOW IN PLAY: fan Market row > the market > pinecone > Buy now (receipt) or Name your price (sheet). Tin whistle row > quiet moments.\n\n"
          "OPEN: which tickles (built: the coin) · Bullion's look · name strangers, or keep 'a pig' until a trade."),
    "B": ("B · Market day (alternative)\n\n"
          "ONE SENTENCE: Post what you'll pay or take before the evening bell; at six Bullion rings it and every find clears at one price.\n\n"
          "WHAT: sealed offers all day (you see how many pigs are in, never a price); at 18:00 one clearing price per find; everyone who matched trades at it; unmatched offers come home.\n\n"
          "WHY IT'S ATTRACTIVE: no sniping and no camping the board · every pig who traded a pinecone today got the same price, so nobody feels fleeced · a daily rendezvous: the bell is a reason for the herd to show up together, and it gives Bullion a big moment.\n\n"
          "WHY NOT FIRST: you wait up to a day to trade (a friend's wish can't be bought now) · less of the stock-market feel the founder asked for: no live board, no Buy now · thinner learning of buying vs selling: one price hides the gap · a scheduled clear and a clearing algorithm to build and test.\n\n"
          "PILLAR: Collect · Connect (the bell is a shared moment).\n\n"
          "CHARTER CHECK: same money and limits as A; pig to pig, mints nothing.\n\n"
          "SERVER: A's tables plus a pg_cron clear at 18:00 computing the uniform price per find (the price that matches the most finds).\n\n"
          "CLIENT: sealed-offer page, the bell reveal, the results page. Could layer on A later as a weekly event."),
    "C": ("C · Bullion makes the market (the first draft, cut)\n\n"
          "WHAT: Bullion as an NPC market maker. A real shelf (he only resells what pigs sold him), his own 'I pay 2 · I ask 4' quotes moved by his stock and a daily news headline, pig offers inside his spread, money = the tickled count (the pink snout), and a 'worth' on your whole bag.\n\n"
          "WHY CUT (Codex and ChatGPT, independently):\n"
          "· Moving NPC prices mint tickles over time: buy from him at the bottom, sell back at the top, every cycle. His top bid even beat the Sheep's 20.\n"
          "· A global shelf is easy to corner: seven units hit the stock clamp, so a few pigs can empty it or flood it.\n"
          "· Scheduled news rewards camping the reset.\n"
          "· 'Worth 12 now · up 2' promised liquidity nobody had: he might not buy all of it, or stop buying.\n"
          "· Spending the tickled count spends the leaderboard, and friends could move Board points by overpaying.\n\n"
          "KEPT FROM IT: Bullion himself, the Ghost Sheep's fancy as the reason values differ, a cost on every find, friends named.\n\n"
          "PILLAR it claimed: Collect, and Contend by accident (the Board). CHARTER: failed fairness by construction."),
}
FILL = {"0": "orange", "A": "green", "B": "blue", "C": "red"}

notes = {
    "brief": {"x": 0, "y": -760, "w": 1180, "fill": "gray", "text":
              "TTP Market: Bullion · 2026-10-29\n\n"
              "THE ASK (founder): a little stock-market-style experience, a simple order book where players buy, sell and trade items for tickles, hosted by a new character (a bull); simple, approachable, fun; players can see what their things are worth and what they made or lost; a playful way to learn how markets work while trading pig to pig.\n\n"
              "ONE SENTENCE: Post the price you'll pay or take for a find, and Bullion matches you with a pig who agrees.\n\n"
              "THE MONEY: tickles ready (the coin, N of 25). Pig to pig only: every tickle a buyer pays lands with a seller. The market mints nothing, burns nothing, and never touches the tickled count, snouts or the Board. On these boards the coin mark means tickles ready; the pink snout (row C only) means the tickled count.\n\n"
              "CUT: Bullion's own shelf and moving quotes, news multipliers, a 'worth' on the whole bag, fees, quantity over 1, charts beyond the seven-day strip.\n\n"
              "PICK: A as built / B / C · Bullion look A / B / C.\n\n"
              "Boards link in Play: the fan's Market row, then the pinecone, then Buy now or Name your price. Art: Bullion's three looks plus cheer and shrug (Codex ImageGen), the real find glyphs, Rosie, Maya's Pepper, the Ghost Sheep."},
}
for r, (key, _) in enumerate(rows):
    y = r * ROW_H
    notes[f"t{key}"] = {"x": 0, "y": y - 250, "text": TITLES[key], "kind": "title1", "maxW": row_w[key]}
    notes[f"s{key}"] = {"x": row_w[key] + GX, "y": y, "w": 560 if key == "A" else 520, "text": STICKY[key], "fill": FILL[key]}

now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
canvas = {
    "v": 3,
    "createdOnFiles": {"v": 1, "at": now},
    "title": "TTP Market: Bullion · 2026-10-29",
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

# ── guard: no em dash in anything a player reads ─────────────────────────────
bad = [p for p, (_, html, _w, _h) in BOARDS.items() if "—" in html or "&mdash;" in html]
assert not bad, f"em dash in {bad}"
print("wrote", len(BOARDS), "boards + canvas.json")
