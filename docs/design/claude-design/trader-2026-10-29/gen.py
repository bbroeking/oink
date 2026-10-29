# Generates the 15 phone artboards + canvas.json for "TTP Trader — 2026-10-29".
# Tokens are constants/theme.ts verbatim (WHIMSY / FONTS / RADII / SPACE / TYPE / shadows).
import json, os, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "project")
os.makedirs(ROOT, exist_ok=True)

# ── art (uploaded /_blob urls) ────────────────────────────────────────────────
A = dict(
    ghost="/_blob/9d64b67d13a59a359d5820cbc33f96a4", glow="/_blob/511cc308384a75bb4ec6b005dd3888b7",
    greet="/_blob/b988f3a06c064e7616d0956f5a935d92", take="/_blob/36184e0b56bd0e0c1ab04b1beb0b0aef",
    leave="/_blob/2f3c977f4602fa2c2a992b711cfbb969", idle="/_blob/e6a68c131175f73245ac64b011d4c4e2",
    shake="/_blob/1a7bc4aabaed0f64dc38291b317d7c75", g_trader="/_blob/16b2e77e8f6c22890321a085789d604c",
    g_pigface="/_blob/c1dc9e496fbfdf319cbe194e0600f90f", g_barn="/_blob/ece8226e24c1d976c6f2e8067f96b36f",
    river_pebble="/_blob/468db3d44eea49fd53202cf6270e44dd", blue_feather="/_blob/fb41572e805d6a31a17ab44032617d81",
    clover="/_blob/d6eabbb3676afc194dfdaf742059cd0a", snail_shell="/_blob/7a95e81d665a4cbcdd052fd920b06cd4",
    brass_button="/_blob/5996b23596e6eba142168e82f6a3b2d4", wool_tuft="/_blob/330b6077a33fa9c0736b33421df4f865",
    red_berries="/_blob/276f87ce344d68188f93ba1de3154e41", pinecone="/_blob/3b6f8fc1263f6a7424b79a83f0582822",
    old_key="/_blob/0b95d32fe63013062315171ba5d1a663", honeycomb="/_blob/073a30068e7c32b823886a1a52033392",
    marble="/_blob/eada46d328915efe28e6bb99379d24b8", tin_whistle="/_blob/f9add597fcac2c768eb3fabd5b9ec61d",
    g_bag="/_blob/2cc23829f4b1ad894a64fe0b4b191e7c", g_handshake="/_blob/5df318180c45b24338e4b09a1249f49b",
    g_gift="/_blob/67c7b7e797b7ac21e9bbbce0f4bf20a8", g_ghost="/_blob/ed85b3d5bcceb71ec09dc0f35c6f6bcb",
    g_check="/_blob/c5bc6b204493a0f1005fdf3a9debe4b7", g_heart="/_blob/d99129f28ab9f35c705af2e599dda3fa",
    k_music_box="/_blob/df7d8b7173a669a2556a19697b0fcade", h_moon_cap="/_blob/6d8007d7430ab315b2d8b9560b3db346",
    rosie="/_blob/7421d0c9899f385432051f48d575730c", pepper="/_blob/2c55875cf0dc7d2566ee9ebdfd6592a8",
    g_trades="/_blob/b3ef080031f827f9d313bf06c5ed2e46", g_friends="/_blob/b0306f28442b46419739920c49d275b2",
    g_star="/_blob/4ab603862892bbf910cff3bb8e695c83", g_lock="/_blob/338ac95c2d5526b25093d189ab299243",
    h_skull_mask="/_blob/4d3a1ca387467ade2f698a4e8d5f2218", k_petrified="/_blob/e648866cce32d30b29c9f0f2def5b6cc",
    g_sparkle="/_blob/edf07286fd829aaa2d02121b79273948", g_arrow="/_blob/e12d2d8e2f582b81f88ef882487519b0",
)
NAMES = dict(river_pebble="river pebble", blue_feather="blue feather", clover="four-leaf clover", snail_shell="snail shell",
             brass_button="brass button", wool_tuft="tuft of wool", red_berries="red berries", pinecone="pinecone",
             old_key="old key", honeycomb="honeycomb chip", marble="glass marble", tin_whistle="tin whistle")

# ── tokens (constants/theme.ts) ──────────────────────────────────────────────
INK="#2a1f15"; PAPER="#fffaf0"; CREAM="#fbeee2"; CREAM2="#f6e6d4"; ROSE="#ffd6dc"; ROSEDEEP="#f8a8b3"
SAGE="#c9dec1"; SUN="#ffd87a"; LILAC="#d6c8f0"; LILACDEEP="#a89bff"; ACCENT="#a03e2f"; GOLDINK="#5A3F00"
SAGEINK="#7A9B63"; INKDEEP="#1a1411"; SCRIM="rgba(42,31,21,0.55)"; INKWASH="rgba(42,31,21,0.08)"
MUTE="#6b5a4a"  # WHIMSY text-safe secondary ink (≥4.5:1 on paper)

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
.numeralLg{{font-family:'Caprasimo',serif;font-weight:400;font-size:26px;line-height:28px}}
.numeral{{font-family:'Caprasimo',serif;font-weight:400;font-size:16px;line-height:20px}}
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
.px{{image-rendering:auto}}
"""

def snout(size=18):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none">'
            f'<ellipse cx="12" cy="12" rx="10" ry="8" fill="{ROSEDEEP}" stroke="{INK}" stroke-width="1.6"/>'
            f'<ellipse cx="9" cy="13" rx="1.3" ry="1.8" fill="{INK}"/><ellipse cx="15" cy="13" rx="1.3" ry="1.8" fill="{INK}"/></svg>')

def xmark():
    return (f'<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="{INK}" stroke-width="3" stroke-linecap="round" fill="none"/></svg>')

def arrow_svg(size=18, color=INK):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path d="M4 12 H19 M13 6 L19 12 L13 18" stroke="{color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>')

def page(title, body):
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
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":844}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

# ── pieces ───────────────────────────────────────────────────────────────────
def crown(kicker, title):
    return (f'<div style="position:absolute;left:16px;top:22px;right:16px;display:flex;flex-direction:column;gap:2px">'
            f'<div class="kickerPill acc">{kicker}</div><div class="pageTitle">{title}</div>'
            f'<div style="height:2px;width:72px;background:{INK};border-radius:2px;margin-top:6px"></div></div>')

def yard(trader_img=None, trader_size=132, trader_style="", dusk=False, rosie_x=58, bubble=None, glow=False):
    ground = LILAC if dusk else SAGE
    hedge = LILACDEEP if dusk else SAGEINK
    sky = CREAM if dusk else PAPER
    h = f'<div style="position:absolute;inset:0;background:{sky}"></div>'
    h += f'<div style="position:absolute;left:0;right:0;top:430px;bottom:0;background:{ground};border-top:2px solid {INK}"></div>'
    # hedge: a row of round shrubs on the horizon
    shr = ""
    for i, (x, w) in enumerate([(-10, 80), (60, 70), (120, 86), (196, 72), (258, 84), (330, 80)]):
        shr += f'<div style="position:absolute;left:{x}px;top:{400 - (i % 2) * 8}px;width:{w}px;height:{w // 2 + 20}px;background:{hedge};border:2px solid {INK};border-radius:{w}px {w}px 10px 10px;box-shadow:2px 2px 0 {INK}"></div>'
    h += shr
    if glow:
        h += f'<img src="{A["glow"]}" alt="" aria-hidden="true" style="position:absolute;left:214px;top:300px;width:180px;height:180px;object-fit:contain;opacity:.95">'
    elif trader_img:
        h += f'<img src="{trader_img}" alt="The Ghost Sheep Trader at the hedge" style="position:absolute;left:236px;top:{448 - trader_size}px;width:{trader_size}px;height:{trader_size}px;object-fit:contain;{trader_style}">'
    h += f'<img src="{A["rosie"]}" alt="Rosie, your pig" style="position:absolute;left:{rosie_x}px;top:318px;width:168px;height:168px;object-fit:contain">'
    if bubble:
        h += bubble
    return h

def sticker(inner, color=PAPER, radius=14, rot=0, shadow="sticker", style="", pad="12px 14px", extra_cls=""):
    cls = {"sticker": "sticker", "sm": "stickerSm", "flat": "flat", "dashed": "dashed", "none": ""}[shadow]
    return (f'<div class="{cls} {extra_cls}" style="background:{color};border-radius:{radius}px;padding:{pad};'
            f'transform:rotate({rot}deg);{style}">{inner}</div>')

def barn_button_fan(rows, open_=True, top=430):
    """rows: list of (glyph_url, title, sub, highlight)."""
    h = ""
    if open_:
        y = top
        items = ""
        for g, t, s, hi in rows:
            bg = SUN if hi else PAPER
            items += (f'<div class="stickerSm" style="display:flex;align-items:center;gap:10px;background:{bg};border-radius:14px;padding:8px 12px 8px 8px;min-height:56px;width:252px">'
                      f'<img src="{g}" alt="" aria-hidden="true" style="width:36px;height:36px;object-fit:contain;flex:none">'
                      f'<div style="display:flex;flex-direction:column;min-width:0"><div class="cardTitleSm">{t}</div><div class="handT mute" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{s}</div></div></div>')
        h += f'<div style="position:absolute;right:16px;bottom:116px;display:flex;flex-direction:column;align-items:flex-end;gap:10px">{items}</div>'
    h += (f'<button type="button" aria-label="Barn menu" class="sticker" style="position:absolute;right:16px;bottom:36px;width:68px;height:68px;border-radius:999px;background:{SUN};display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer">'
          f'<img src="{A["g_barn"]}" alt="" aria-hidden="true" style="width:44px;height:44px;object-fit:contain"></button>')
    return h

def toast(glyph, title, sub, color=PAPER, top=128, rot=-1.2):
    inner = (f'<div style="display:flex;align-items:center;gap:10px"><img src="{glyph}" alt="" aria-hidden="true" style="width:40px;height:40px;object-fit:contain;flex:none">'
             f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="cardTitle">{title}</div><div class="handT mute">{sub}</div></div></div>')
    return f'<div style="position:absolute;left:16px;right:16px;top:{top}px">{sticker(inner, color=color, radius=18, rot=rot, pad="10px 14px")}</div>'

def tickle_bank(n="41"):
    inner = (f'<div style="display:flex;align-items:baseline;gap:8px"><div class="fredoka" style="font-size:30px;line-height:32px">{n}</div>'
             f'<div class="kickerPill mute">tickled today</div></div>')
    return f'<div style="position:absolute;right:16px;top:30px">{sticker(inner, color=SUN, radius=14, rot=1, shadow="sm", pad="8px 12px")}</div>'

def sheet(kicker, title, body, footer, top=112, scene=None):
    scene = scene or yard(trader_img=A["idle"])
    h = scene + f'<div style="position:absolute;inset:0;background:{SCRIM}"></div>'
    h += (f'<div style="position:absolute;left:0;right:0;top:{top}px;bottom:0;background:{PAPER};border:2px solid {INK};border-bottom:0;border-radius:22px 22px 0 0;box-sizing:border-box;display:flex;flex-direction:column">'
          f'<div style="align-self:center;width:44px;height:4px;border-radius:2px;background:{CREAM2};margin-top:10px"></div>'
          f'<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 16px 0 16px">'
          f'<div style="display:flex;flex-direction:column;gap:2px"><div class="kickerPill acc">{kicker}</div><div class="pageTitle">{title}</div>'
          f'<div style="height:2px;width:72px;background:{INK};border-radius:2px;margin-top:6px"></div></div>'
          f'<button type="button" aria-label="Close" class="flat" style="width:44px;height:44px;border-radius:999px;background:{CREAM};display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer">{xmark()}</button></div>'
          f'<div style="flex:1;min-height:0;overflow:hidden;padding:12px 16px 0 16px;display:flex;flex-direction:column;gap:8px">{body}</div>'
          f'<div style="padding:12px 16px 28px 16px;border-top:2px solid {CREAM2}">{footer}</div></div>')
    return h

def him(img, bubble_inner, color=PAPER, size=104):
    return (f'<div style="display:flex;align-items:center;gap:8px"><img src="{img}" alt="The Ghost Sheep Trader" style="width:{size}px;height:{size}px;object-fit:contain;flex:none">'
            f'{sticker(bubble_inner, color=color, radius=18, rot=-1.2, shadow="sm", style="flex:1;min-width:0", pad="10px 12px")}</div>')

def find_tile(fid, price=None, state="paper", count=None, tag=None, w=104, art=44, tone=INK, href=None, label=None):
    bg = {"paper": PAPER, "sun": SUN, "cream": CREAM, "rose": ROSE, "lilac": LILAC, "sage": SAGE}[state]
    sh = "sticker" if state == "sun" else "stickerSm"
    bd = f"border:3px solid {INK};" if state == "sun" else ""
    inner = f'<img src="{A[fid]}" alt="" aria-hidden="true" style="width:{art}px;height:{art}px;object-fit:contain">'
    if count:
        inner += f'<div class="kickerPillSm" style="position:absolute;right:6px;top:6px;background:{INK};color:{PAPER};border-radius:999px;padding:2px 6px">&times;{count}</div>'
    inner += f'<div class="kicker" style="text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">{label or NAMES[fid]}</div>'
    if price is not None:
        inner += f'<div style="display:flex;align-items:center;gap:4px">{snout(16)}<div class="numeral" style="color:{tone}">+{price}</div></div>'
    if tag:
        inner += f'<div class="kickerPillSm acc" style="white-space:nowrap">{tag}</div>'
    tagel = "a" if href else "div"
    hrefattr = f' href="{href}"' if href else ""
    return (f'<{tagel}{hrefattr} class="{sh}" style="position:relative;width:{w}px;background:{bg};{bd}border-radius:14px;padding:12px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;color:{INK}">{inner}</{tagel}>')

def empty_tile(w=104):
    return f'<div class="dashed" style="width:{w}px;min-height:96px;background:{CREAM};border-radius:14px"></div>'

def ticket(stub, cap, label, href=None, tone="golden", disabled=False):
    face, stubc = {"golden": (SUN, ROSE), "companion": (SUN, SUN), "season": (ROSE, LILAC)}[tone]
    op = "opacity:.55;" if disabled else ""
    tag = "a" if (href and not disabled) else "div"
    hrefattr = f' href="{href}"' if (href and not disabled) else ""
    return (f'<{tag}{hrefattr} class="sticker" style="display:flex;height:64px;border-radius:14px;overflow:hidden;background:{face};color:{INK};{op}">'
            f'<div style="width:78px;flex:none;background:{stubc};border-right:2px dashed {INK};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0">'
            f'<div class="numeralLg" style="font-size:22px;line-height:24px">{stub}</div><div class="kickerPillSm mute">{cap}</div></div>'
            f'<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 12px;text-align:center"><div class="label" style="font-size:15px;line-height:19px;color:{GOLDINK}">{label}</div></div></{tag}>')

def hand_line(text, cls="handT mute", align="center", style=""):
    return f'<div class="{cls}" style="text-align:{align};{style}">{text}</div>'

def section_header(t, sub=None):
    s = f'<div class="handT mute">{sub}</div>' if sub else ""
    return f'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:4px"><div class="sectionTitle">{t}</div>{s}</div>'

def pig_face(img, name, size=40):
    return (f'<div style="display:flex;align-items:center;gap:6px"><img src="{img}" alt="" aria-hidden="true" class="flat" style="width:{size}px;height:{size}px;border-radius:999px;background:{CREAM};object-fit:cover">'
            f'<div class="cardTitleSm">{name}</div></div>')

def grid(tiles, gap=8):
    return f'<div style="display:flex;flex-wrap:wrap;gap:{gap}px">{"".join(tiles)}</div>'

def tally_bubble(before, after, line, sub="tickled now"):
    return (f'<div style="display:flex;align-items:baseline;gap:8px"><div class="numeralLg">{before}</div><div class="handT mute">&rarr;</div><div class="numeralLg">{after}</div></div>'
            f'<div class="kickerPill mute">{sub}</div><div class="handT mute">{line}</div>')

def link_pill(text, href):
    return f'<a href="{href}" class="flat" style="display:inline-flex;align-items:center;gap:6px;background:{CREAM};border-radius:999px;padding:8px 14px;min-height:44px;color:{INK}"><span class="label">{text}</span>{arrow_svg(14)}</a>'

# ═════════════════════════════════════════════════════════════════════════════
# DIRECTION A — Ghost Sheep v2: sets and trade-ups
# ═════════════════════════════════════════════════════════════════════════════
FAN_A = [(A["g_barn"], "Enter Barn", "Rosie is home", False),
         (A["g_bag"], "Satchel", "7 finds · hoping for a marble", False),
         (A["g_trader"], "Trader", "the Ghost Sheep · pairs today · 5h 40m left", True)]

A1 = page("A1 Arrival", f'<div class="root">{yard(trader_img=A["greet"])}{crown("YOUR BARN", "The yard")}{tickle_bank("41")}'
          + toast(A["g_trader"], "The Ghost Sheep is at the hedge", "Today he fancies pairs. Three alike, he trades up.")
          + barn_button_fan(FAN_A)
          + f'<a href="A2.dc.html" aria-label="Open the Trader" style="position:absolute;right:16px;bottom:116px;width:252px;height:56px;border-radius:14px"></a></div>')

def a_bag(selected=("river_pebble", "river_pebble")):
    # bag of seven: 3 pebbles, 2 clovers, 1 key, 1 feather. Pairs selected = sun.
    return grid([
        find_tile("river_pebble", 3, "sun", count=3, tag="a pair · +9"),
        find_tile("clover", 3, "paper", count=2),
        find_tile("old_key", 8, "paper"),
        find_tile("blue_feather", 3, "cream", tag="pays double"),
        find_tile("snail_shell", 3, "paper"),
        empty_tile(), empty_tile(),
    ])

A2_body = (him(A["idle"], f'<div class="handLg">Finds for tickles. Bring me a pair and I pay half again. Three alike and I will trade you up.</div>')
           + hand_line("takes 6 more finds · 5h 40m left")
           + section_header("Your bag", "tap finds to make a hand")
           + a_bag()
           + sticker(f'<div style="display:flex;align-items:center;gap:10px"><img src="{A["river_pebble"]}" alt="" aria-hidden="true" style="width:32px;height:32px"><img src="{A["river_pebble"]}" alt="" aria-hidden="true" style="width:32px;height:32px;margin-left:-14px">'
                     f'<div style="display:flex;flex-direction:column"><div class="cardTitleSm">a pair of pebbles</div><div class="handT mute">3 + 3, then half again: 9 tickles</div></div>'
                     f'<div style="margin-left:auto;display:flex;align-items:center;gap:4px">{snout(16)}<div class="numeralLg" style="font-size:22px;line-height:24px">+9</div></div></div>',
                     color=CREAM, radius=14, rot=0.6, shadow="sm", pad="8px 12px", style="margin-top:4px")
           + hand_line("hold one more pebble and he will trade all three for a marble", style="margin-top:2px"))
A2 = page("A2 Trade sheet", f'<div class="root">{sheet("AT THE HEDGE", "The Ghost Sheep Trader", A2_body, ticket("+9", "tickles", "Hand over the pair", href="A3.dc.html"))}</div>')

A3_body = (him(A["take"], f'<div class="handLg">Three pebbles, little pig? Then a glass marble is yours. My pick of which. No take-backs.</div>', color=CREAM)
           + section_header("Trade up")
           + f'<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:4px">'
           + f'<div style="display:flex;gap:4px">{find_tile("river_pebble", None, "sun", w=72, art=36, label="pebble")}{find_tile("river_pebble", None, "sun", w=72, art=36, label="pebble")}{find_tile("river_pebble", None, "sun", w=72, art=36, label="pebble")}</div>'
           + f'{arrow_svg(28)}'
           + f'{find_tile("marble", None, "lilac", w=96, art=48, tag="uncommon")}</div>'
           + sticker(f'<div class="handT" style="text-align:center">Three of a kind go into his satchel. One find of the next rarity comes back, his choice, seeded for the day. Rare has no trade-up: nothing sits above it.</div>', color=PAPER, radius=14, rot=-0.5, shadow="sm", pad="10px 12px")
           + hand_line("finds for finds. he never pays snouts, and nothing here is for sale.", style="margin-top:4px"))
A3 = page("A3 Confirm trade-up", f'<div class="root">{sheet("AT THE HEDGE", "The Ghost Sheep Trader", A3_body, ticket("3&rarr;1", "trade up", "Trade three pebbles for a marble", href="A4.dc.html"))}</div>')

A4_body = (him(A["take"], tally_bubble("41", "50", "a pair of pebbles went into his satchel · +9"), color=SUN)
           + sticker(f'<div style="display:flex;align-items:center;gap:10px"><img src="{A["marble"]}" alt="" aria-hidden="true" style="width:44px;height:44px"><div style="display:flex;flex-direction:column"><div class="cardTitle">a glass marble</div><div class="handT mute">came back for three pebbles · new to your bag</div></div><img src="{A["g_sparkle"]}" alt="" aria-hidden="true" style="width:28px;height:28px;margin-left:auto"></div>',
                     color=LILAC, radius=18, rot=0.8, shadow="sticker", pad="10px 12px")
           + hand_line("takes 1 more find · 5h 12m left")
           + section_header("Your bag", "after")
           + grid([find_tile("marble", 8, "cream", tag="pays double"), find_tile("clover", 3, "paper", count=2), find_tile("old_key", 8, "paper"),
                   find_tile("blue_feather", 3, "paper"), find_tile("snail_shell", 3, "paper"), empty_tile(), empty_tile()]))
A4 = page("A4 Receipt", f'<div class="root">{sheet("AT THE HEDGE", "The Ghost Sheep Trader", A4_body, ticket("?", "pick one", "Pick a find to hand over", href="A5.dc.html", disabled=False))}</div>')

A5 = page("A5 He leaves", f'<div class="root">{yard(trader_img=A["leave"], trader_style="opacity:.55;filter:grayscale(1)")}{crown("YOUR BARN", "The yard")}{tickle_bank("50")}'
          + toast(A["g_trader"], "The Ghost Sheep wandered off", "What is left stays yours. He is back tomorrow, some hour of his own.", color=CREAM)
          + barn_button_fan([(A["g_barn"], "Enter Barn", "Rosie is home", False), (A["g_bag"], "Satchel", "6 finds · 1 new", False)])
          + '</div>')

# ═════════════════════════════════════════════════════════════════════════════
# DIRECTION B — The roaming broker
# ═════════════════════════════════════════════════════════════════════════════
FAN_B = [(A["g_barn"], "Enter Barn", "Rosie is home", False),
         (A["g_bag"], "Satchel", "7 finds · hoping for a marble", False),
         (A["g_trader"], "Trader", "the Ghost Sheep · from Maya's · 4h left", True)]

def route_strip(stops):
    parts = []
    for i, (img, name, state) in enumerate(stops):
        if i:
            parts.append(f'<div style="width:22px;height:2px;background:{INK};border-radius:2px;flex:none"></div>')
        bg = SUN if state == "here" else (PAPER if state == "done" else CREAM)
        op = "" if state != "next" else "border-style:dashed;"
        parts.append(f'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:60px">'
                     f'<img src="{img}" alt="" aria-hidden="true" class="flat" style="width:44px;height:44px;border-radius:999px;background:{bg};object-fit:cover;{op}">'
                     f'<div class="kicker" style="white-space:nowrap">{name}</div></div>')
    return f'<div style="display:flex;align-items:center;justify-content:center">{"".join(parts)}</div>'

B1 = page("B1 Arrival", f'<div class="root">{yard(trader_img=A["greet"])}{crown("YOUR BARN", "The yard")}{tickle_bank("41")}'
          + toast(A["g_pigface"], "The Ghost Sheep came from Maya's", "He is carrying her pig's wish. A blue feather, and you have two.")
          + barn_button_fan(FAN_B)
          + f'<a href="B2.dc.html" aria-label="Open the Trader" style="position:absolute;right:16px;bottom:116px;width:252px;height:56px;border-radius:14px"></a></div>')

B2_body = (him(A["idle"], f'<div class="handLg">Maya\'s pig is hoping for a blue feather. You carry two. Send one along and take something she can spare.</div>')
           + section_header("He carries", "last seen at Maya's, 2h ago")
           + sticker(f'<div style="display:flex;align-items:center;gap:10px">{pig_face(A["pepper"], "Maya")}<div class="handT mute">is hoping for</div><img src="{A["blue_feather"]}" alt="" aria-hidden="true" style="width:40px;height:40px"><div class="cardTitleSm">a blue feather</div></div>',
                     color=ROSE, radius=18, rot=-0.8, shadow="sm", pad="8px 12px")
           + section_header("She can spare", "his pick from her biggest stacks")
           + grid([find_tile("pinecone", None, "sun", tag="take this", label="pinecone"), find_tile("clover", None, "paper", label="clover"), find_tile("snail_shell", None, "paper", label="snail shell")])
           + hand_line("or just give the feather. a gift counts too.", style="margin-top:2px")
           + section_header("His route today")
           + route_strip([(A["g_pigface"], "Tom", "done"), (A["pepper"], "Maya", "done"), (A["rosie"], "you", "here"), (A["g_ghost"], "next", "next")]))
B2 = page("B2 Trade sheet", f'<div class="root">{sheet("AT THE HEDGE", "The Ghost Sheep Trader", B2_body, ticket("1:1", "swap", "Send the feather, take a pinecone", href="B3.dc.html"))}</div>')

B3_body = (him(A["take"], f'<div class="handLg">A feather for Maya, a pinecone for you. I carry, I never pay. The delivery tickles you both when it lands.</div>', color=CREAM)
           + f'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px">'
           + f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px">{pig_face(A["rosie"], "your bag", 36)}{find_tile("blue_feather", None, "sun", w=108, art=44, count=2)}</div>'
           + f'<div style="display:flex;flex-direction:column;align-items:center;gap:2px">{arrow_svg(26)}<img src="{A["g_trader"]}" alt="" aria-hidden="true" style="width:40px;height:40px"><div style="transform:rotate(180deg)">{arrow_svg(26)}</div></div>'
           + f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px">{pig_face(A["pepper"], "Maya\'s bag", 36)}{find_tile("pinecone", None, "sun", w=108, art=44, count=4)}</div></div>'
           + sticker(f'<div class="handT" style="text-align:center">Finds move one for one between bags and mint nothing. Same rule as the barn swap: one per pair per day, the flat 3 tickles each when it lands.</div>', color=PAPER, radius=14, rot=0.5, shadow="sm", pad="10px 12px", style="margin-top:6px")
           + hand_line("he never pays snouts. nothing here is for sale.", style="margin-top:2px"))
B3 = page("B3 Confirm swap", f'<div class="root">{sheet("AT THE HEDGE", "The Ghost Sheep Trader", B3_body, ticket("+3", "when it lands", "Seal the swap", href="B4.dc.html"))}</div>')

B4_body = (him(A["take"], f'<div style="display:flex;align-items:baseline;gap:8px"><div class="numeralLg">41</div><div class="handT mute">&rarr;</div><div class="numeralLg">44</div></div><div class="kickerPill mute">tickled when it lands</div><div class="handT mute">the feather is in his satchel for Maya · a pinecone is in yours</div>', color=SUN)
           + sticker(f'<div style="display:flex;align-items:center;gap:10px"><img src="{A["pinecone"]}" alt="" aria-hidden="true" style="width:44px;height:44px"><div style="display:flex;flex-direction:column"><div class="cardTitle">a pinecone</div><div class="handT mute">from Maya\'s bag · new to yours</div></div></div>',
                     color=LILAC, radius=18, rot=0.8, shadow="sticker", pad="10px 12px")
           + section_header("Where he goes next")
           + route_strip([(A["pepper"], "Maya", "done"), (A["rosie"], "you", "here"), (A["pepper"], "Maya", "next")])
           + hand_line("he is off to Maya's with your feather. she will see him at her hedge within the hour.")
           + f'<div style="display:flex;justify-content:center;gap:8px;margin-top:4px">{link_pill("Tell Maya", "B5.dc.html")}{link_pill("Visit her barn", "B5.dc.html")}</div>')
B4 = page("B4 Receipt", f'<div class="root">{sheet("AT THE HEDGE", "The Ghost Sheep Trader", B4_body, ticket("3", "finds left", "Hand him a find for tickles", href="B5.dc.html"))}</div>')

B5 = page("B5 He moves on", f'<div class="root">{yard(trader_img=A["leave"], trader_style="opacity:.55;filter:grayscale(1)")}{crown("YOUR BARN", "The yard")}{tickle_bank("44")}'
          + toast(A["g_pigface"], "The Ghost Sheep is at Maya's now", "Your feather landed. +3 tickles, and Maya's pig got its wish.", color=SUN)
          + barn_button_fan([(A["g_barn"], "Enter Barn", "Rosie is home", False), (A["g_bag"], "Satchel", "7 finds · 1 swapped today", False)])
          + '</div>')

# ═════════════════════════════════════════════════════════════════════════════
# DIRECTION C — The seasonal wanderer (Old Wisp folded into the Ghost Sheep)
# ═════════════════════════════════════════════════════════════════════════════
FAN_C = [(A["g_barn"], "Enter Barn", "Rosie is home", False),
         (A["g_bag"], "Satchel", "7 finds · hoping for a marble", False),
         (A["g_ghost"], "Trader", "Old Wisp · Hallows week · 3h left", True)]

def keepsake_row(filled=3, total=7):
    cells = ""
    for i in range(total):
        if i < filled:
            img = A["k_music_box"] if i == filled - 1 else A["k_petrified"]
            cells += f'<img src="{img}" alt="" aria-hidden="true" class="flat" style="width:40px;height:40px;border-radius:12px;background:{LILAC};object-fit:contain;padding:3px">'
        else:
            cells += f'<div class="dashed" style="width:40px;height:40px;border-radius:12px;background:{CREAM}"></div>'
    return f'<div style="display:flex;justify-content:center;gap:6px">{cells}</div>'

C1 = page("C1 Arrival (Hallows week)", f'<div class="root">{yard(trader_img=A["greet"], dusk=True)}{crown("YOUR BARN · HALLOWS WEEK", "The yard at dusk")}{tickle_bank("41")}'
          + toast(A["g_ghost"], "Old Wisp is at the hedge", "Tonight he asks for a crescent moon cap. He pays in keepsakes.", color=LILAC)
          + barn_button_fan(FAN_C)
          + f'<a href="C2.dc.html" aria-label="Open the Trader" style="position:absolute;right:16px;bottom:116px;width:252px;height:56px;border-radius:14px"></a></div>')

C2_body = (him(A["idle"], f'<div class="handLg">Hallows week, little pig. The hood comes off and the name changes. Bring me a crescent moon cap and I leave you a keepsake. Finds still pay, as ever.</div>', color=LILAC)
           + section_header("Tonight he asks for")
           + sticker(f'<div style="display:flex;align-items:center;gap:12px"><img src="{A["h_moon_cap"]}" alt="" aria-hidden="true" class="flat" style="width:64px;height:64px;border-radius:14px;background:{PAPER};object-fit:contain;padding:4px">'
                     f'<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="cardTitle">crescent moon cap</div><div class="handT mute">in your closet · earned on the Season 1 pass</div><div class="kickerPillSm acc">leaves your closet for good</div></div></div>',
                     color=PAPER, radius=18, rot=-0.8, shadow="sm", pad="10px 12px")
           + f'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:2px"><div class="handT mute">and leaves</div>{arrow_svg(18)}<img src="{A["k_music_box"]}" alt="" aria-hidden="true" style="width:40px;height:40px"><div style="display:flex;flex-direction:column"><div class="cardTitleSm">the Hollow Music Box</div><div class="kicker mute">Hallows 2026 keepsake · 3 of 7</div></div></div>'
           + section_header("Finds for tickles", "takes 6 more · 3h left")
           + grid([find_tile("river_pebble", 3, "paper", count=3), find_tile("old_key", 8, "paper"), find_tile("blue_feather", 6, "cream", tag="pays double")]))
C2 = page("C2 Trade sheet", f'<div class="root">{sheet("AT THE HEDGE · HALLOWS WEEK", "Old Wisp", C2_body, ticket("1 of 7", "keepsake", "Hand over the moon cap", href="C3.dc.html", tone="season"))}</div>')

C3_body = (him(A["take"], f'<div class="handLg">Sure, little pig? The cap goes into my satchel for good. Bought pieces I never take. Earned ones, gladly.</div>', color=LILAC)
           + f'<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px">'
           + f'<img src="{A["h_moon_cap"]}" alt="" aria-hidden="true" class="sticker" style="width:96px;height:96px;border-radius:18px;background:{SUN};object-fit:contain;padding:6px">{arrow_svg(28)}<img src="{A["g_trader"]}" alt="" aria-hidden="true" style="width:56px;height:56px">{arrow_svg(28)}'
           + f'<img src="{A["k_music_box"]}" alt="" aria-hidden="true" class="sticker" style="width:96px;height:96px;border-radius:18px;background:{LILAC};object-fit:contain;padding:6px"></div>'
           + sticker(f'<div class="handT" style="text-align:center">An earned wearable is spent, not sold: no tickles, no snouts, a keepsake that hangs in the Barn. A friend\'s spare can fill tomorrow\'s ask.</div>', color=PAPER, radius=14, rot=0.5, shadow="sm", pad="10px 12px", style="margin-top:6px")
           + section_header("Not for him")
           + sticker(f'<div style="display:flex;align-items:center;gap:10px;opacity:.7"><img src="{A["h_skull_mask"]}" alt="" aria-hidden="true" style="width:40px;height:40px;object-fit:contain"><div style="display:flex;flex-direction:column"><div class="cardTitleSm">skull mask</div><div class="handT mute">bought in the store · never convertible</div></div><img src="{A["g_lock"]}" alt="" aria-hidden="true" style="width:28px;height:28px;margin-left:auto"></div>',
                     color=CREAM2, radius=14, rot=0, shadow="flat", pad="8px 12px"))
C3 = page("C3 Confirm hand-over", f'<div class="root">{sheet("AT THE HEDGE · HALLOWS WEEK", "Old Wisp", C3_body, ticket("3/7", "keepsake", "Hand it over for good", href="C4.dc.html", tone="season"))}</div>')

C4_body = (him(A["take"], f'<div class="cardTitle">A keepsake for you</div><div class="handT mute">the moon cap went into his satchel · the Hollow Music Box hangs in your Barn tonight</div>', color=SUN)
           + f'<div style="display:flex;justify-content:center;margin-top:4px"><img src="{A["k_music_box"]}" alt="The Hollow Music Box keepsake" class="sticker" style="width:168px;height:168px;border-radius:22px;background:{LILAC};object-fit:contain;padding:12px;transform:rotate(-1.5deg)"></div>'
           + section_header("Hallows 2026", "3 of 7 keepsakes")
           + keepsake_row(3, 7)
           + hand_line("one ask a day until the week ends. the set closes with it; what you have, you keep.")
           + f'<div style="display:flex;justify-content:center;gap:8px;margin-top:4px">{link_pill("Hang it in the Barn", "C5.dc.html")}</div>')
C4 = page("C4 Receipt", f'<div class="root">{sheet("AT THE HEDGE · HALLOWS WEEK", "Old Wisp", C4_body, ticket("6", "finds left", "Hand him a find for tickles", href="C5.dc.html", tone="season"))}</div>')

C5 = page("C5 He leaves; a friend needs yours", f'<div class="root">{yard(trader_img=A["leave"], dusk=True, trader_style="opacity:.55;filter:grayscale(1)")}{crown("YOUR BARN · HALLOWS WEEK", "The yard at dusk")}{tickle_bank("41")}'
          + toast(A["g_ghost"], "Old Wisp wandered off", "Tomorrow's ask comes at dusk.", color=CREAM)
          + f'<div style="position:absolute;left:16px;right:16px;top:214px">'
          + sticker(f'<div style="display:flex;align-items:center;gap:10px">{pig_face(A["pepper"], "Tom", 40)}<div style="display:flex;flex-direction:column;min-width:0"><div class="cardTitleSm">needs a skull mask tonight</div><div class="handT mute">you have a spare. swap it for his stitched bow.</div></div><img src="{A["h_skull_mask"]}" alt="" aria-hidden="true" style="width:40px;height:40px;margin-left:auto"></div>'
                    + f'<div style="display:flex;gap:8px;margin-top:8px">{link_pill("Swap with Tom", "C1.dc.html")}</div>',
                    color=ROSE, radius=18, rot=0.8, shadow="sticker", pad="10px 12px")
          + '</div>'
          + barn_button_fan([(A["g_barn"], "Enter Barn", "a music box plays inside", False), (A["g_bag"], "Satchel", "7 finds", False)])
          + '</div>')

BOARDS = {
    "Main.dc.html": ("A1 · Arrival: the fan", A1), "A2.dc.html": ("A2 · The sheet: a hand in the bag", A2), "A3.dc.html": ("A3 · Confirm: three alike, one up", A3),
    "A4.dc.html": ("A4 · Receipt: tally and the marble", A4), "A5.dc.html": ("A5 · He leaves", A5),
    "B1.dc.html": ("B1 · Arrival: he came from Maya's", B1), "B2.dc.html": ("B2 · The sheet: a wish he carries", B2), "B3.dc.html": ("B3 · Confirm: two bags, one for one", B3),
    "B4.dc.html": ("B4 · Receipt: it lands at Maya's", B4), "B5.dc.html": ("B5 · He moves on", B5),
    "C1.dc.html": ("C1 · Arrival: Hallows week", C1), "C2.dc.html": ("C2 · The sheet: tonight's ask", C2), "C3.dc.html": ("C3 · Confirm: spent, not sold", C3),
    "C4.dc.html": ("C4 · Receipt: the keepsake", C4), "C5.dc.html": ("C5 · He leaves, a friend needs yours", C5),
}
for path, (_, html) in BOARDS.items():
    with open(os.path.join(ROOT, path), "w") as f:
        f.write(html)

# ── canvas.json ──────────────────────────────────────────────────────────────
W, H, GX, GY = 390, 844, 80, 120
rows = [("A", ["Main.dc.html", "A2.dc.html", "A3.dc.html", "A4.dc.html", "A5.dc.html"]),
        ("B", ["B1.dc.html", "B2.dc.html", "B3.dc.html", "B4.dc.html", "B5.dc.html"]),
        ("C", ["C1.dc.html", "C2.dc.html", "C3.dc.html", "C4.dc.html", "C5.dc.html"])]
ROW_H = H + GY + 240  # board + gap + title clearance
boards, order = {}, []
for r, (_, files) in enumerate(rows):
    y = r * ROW_H
    for i, p in enumerate(files):
        boards[p] = {"x": i * (W + GX), "y": y, "w": W, "h": H, "title": BOARDS[p][0], "is_interactive": True}
        order.append(p)
ROW_W = 5 * W + 4 * GX
STICKY_X = ROW_W + GX

TITLES = {
    "A": "A · Ghost Sheep v2: sets and trade-ups",
    "B": "B · The roaming broker: he carries a friend's wish",
    "C": "C · The seasonal wanderer: Old Wisp folded into the Ghost Sheep",
}
STICKY = {
    "A": ("A · Ghost Sheep v2: sets and trade-ups\n\n"
          "WHAT: he still buys singles (3/8/20, fancy ×2). New: a PAIR pays half again (two alike handed over in one visit), and THREE ALIKE trade up one rarity (3 → 1, his seeded pick of which; rare has no trade-up). The bag of six grows to nine so a hand can actually form.\n\n"
          "PILLAR: Collect (holding becomes a reason; a dead-end stack becomes a step up). Contend: none. Connect: none, honestly.\n\n"
          "CHARTER CHECK: no new currency (applied tickles only) · never snouts · paid items untouched (finds only) · finds given-never-sold stands (trade-up is finds for a find, a 3→1 sink, never a faucet) · one sentence: 'pairs pay more, three alike go up'.\n\n"
          "SERVER: trader_tuning gains {pairMultiplier, tradeUp:true}; trade_with_trader judges a pair over the visit's trader_sales (no multi-select RPC needed); NEW trade_up_with_trader(find_id, nonce): delete 3 rows, insert 1, ledger kind='trade_up'; satchel cap 6 → 9 in satchel tuning. One migration, two RPCs.\n\n"
          "CLIENT: TraderSheet gains the hand strip + a trade-up ticket state + the lilac 'came back' receipt; hook: one new mutation; fan sub-line.\n\n"
          "BUILD: 2.5 h fits IF pairs are judged server-side over the visit and flushes are deferred. Migration 45m · sheet 75m · tests 30m. Risk: the bag cap change touches the Satchel sheet's empty slots."),
    "B": ("B · The roaming broker\n\n"
          "WHAT: on arrival he is carrying ONE sounder-mate's rolled wish (seeded: a mate whose wish you can fill from your bag; else nobody, and he trades as today). You send the find and take one of up to three spares the server picks from her biggest stacks (the barn swap's own rule), or just give it. The sheet shows his route today (seeded arrival order across the herd), so 'he was at Maya's 2h ago' is a text message.\n\n"
          "PILLAR: Connect first (a specific friend's want, carried to you), Collect (a lone digger meets a rare), Contend ('N swapped' on the Board already counts it).\n\n"
          "CHARTER CHECK: no new currency · never snouts (he carries, he never pays; the flat 3 tickles each is the delivery the barn swap already pays) · finds move 1:1 and mint nothing · one swap per pair per UTC day reuses the swap cap · nothing bought is ever involved.\n\n"
          "SERVER: trader_status() gains carrying {friend, wish, spares[]} via _peek_wish + _wish_options; NEW broker_swap(nonce, give_item_id, take_find_id|null) wrapping the barn swap's transfer path with the trader as the courier; route = sounder-mates' trader_visits for the day ordered by arrival (read-only). One migration, two RPC changes, no new table.\n\n"
          "CLIENT: a 'He carries' section + spare picker + route strip on TraderSheet; a landed-delivery toast; the Satchel's swaps tab lists the courier.\n\n"
          "BUILD: 3.5 to 4 h. Does NOT fit 2.5 h whole. B-lite (carry the wish, GIVE only through the existing swap RPC, no spares, route line only) is ~2.5 h and keeps the Connect beat."),
    "C": ("C · The seasonal wanderer\n\n"
          "WHAT: on a seasonal week (Hallows first) the same visitor goes by Old Wisp, dusk tint on the yard, and ADDS one ask a day: a named earned wearable or find. Hand it over and he leaves a seasonal keepsake (a Barn furnishing, 7 per set, the set closes with the week). He still buys finds for tickles underneath.\n\n"
          "PILLAR: Collect (a set with an end, keepsakes hang in the Barn), Connect (friends swap spare wearables to fill each other's asks; the 10-14 ruling).\n\n"
          "CHARTER CHECK: keepsake = furnishing, not a currency · never snouts, never tickles for a wearable · paid items NEVER convertible: an ask only ever names earned pieces, provenance checked server-side, bought pieces shown locked · finds given-never-sold unchanged. CAUTION: spending a wearable consumes it; the permanent-unlock promise needs the instance ledger before this is real.\n\n"
          "SERVER: wearable instance ledger + mint provenance backfill (the big one), seasonal_asks(user, local_day, item), redeem_seasonal_ask(nonce) granting via grant_habitat_item, swap_wearable(friend, give, take); seasonal window in app_settings.\n\n"
          "CLIENT: dusk yard, Old Wisp name/greetings, ask card + keepsake reveal + set row, friend swap entry.\n\n"
          "BUILD: 8 to 12 h. Not today. C-lite (ask for a FIND, pay a keepsake via grant_habitat_item, no wearables) is ~2.5 h but drops the wearable loop that makes it Old Wisp."),
}
notes = {
    "brief": {"x": 0, "y": -760, "w": 1180, "fill": "gray", "text":
              "TTP Trader, next version · 2026-10-29 · pick one direction for a ~2.5 h Opus build at 13:45 EDT\n\n"
              "TODAY: the Ghost Sheep Trader is a Trader row on the Barn button's fan while he is at the hedge (one 6 h visit per pig per local day, seeded 08 to 22 in the feeding zone). His sheet is the bag with a price on every tile: 3 / 8 / 20 applied tickles by rarity, the fancied find ×2, six per visit, never snouts (app_settings.trader_tuning; trade_with_trader; trader_sales is the ledger).\n\n"
              "RULES EVERY DIRECTION KEEPS: no new currency · the trader never pays snouts · bought items are never convertible · finds are given, never sold (a swap mints nothing) · the fan is the one door · tokens, painted glyphs, no em dashes.\n\n"
              "Each row: arrival on the fan · the sheet · the confirm · the receipt · the leave. Boards link in Play (tap the Trader row or the ticket). Art is the real trader frames, find glyphs, Rosie idle_1, Pepper as the friend's pig."},
}
for r, (key, _) in enumerate(rows):
    y = r * ROW_H
    notes[f"t{key}"] = {"x": 0, "y": y - 250, "text": TITLES[key], "kind": "title1", "maxW": ROW_W}
    notes[f"s{key}"] = {"x": STICKY_X, "y": y, "w": 520, "text": STICKY[key], "fill": {"A": "green", "B": "blue", "C": "purple"}[key]}

canvas = {
    "v": 3,
    "createdOnFiles": {"v": 1, "at": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"},
    "title": "TTP Trader — 2026-10-29",
    "launch": {"view": "canvas"},
    "pages": [],
    "boards": boards,
    "order": order,
    "notes": notes,
    "designSystems": [],
}
with open(os.path.join(ROOT, "canvas.json"), "w") as f:
    json.dump(canvas, f, indent=1)
print("wrote", len(BOARDS), "boards +", "canvas.json")
