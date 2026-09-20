#!/usr/bin/env python3
"""Me page simplification — three directions as standalone HTML boards.

Run from the repo root:  python3 docs/design/claude-design/me-2026-09-20/gen.py
Every colour / size below is a token from constants/theme.ts (web/tokens.css).
"""
import base64, io, os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, "..", "..", "..", ".."))

def art(path, size):
    im = Image.open(os.path.join(REPO, path)).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

import sys, json, datetime as dt
ART_SRC = {
    "rosie":    ("assets/images/sprites/rosie/idle_1.png", 200),
    "bandit":   ("assets/images/sprites/bandit/idle_1.png", 160),
    "gift":     ("assets/images/glyphs/gift.png", 96),
    "crown":    ("assets/images/glyphs/crown.png", 96),
    "trophy":   ("assets/images/glyphs/trophy.png", 96),
    "sparkles": ("assets/images/glyphs/sparkles.png", 96),
}
DC = "--dc" in sys.argv          # canvas-export mode: project/*.dc.html + canvas.json
BLOBS = {}
if DC:
    bm = sys.argv[sys.argv.index("--dc") + 1]
    BLOBS = json.load(open(bm))   # {"rosie": "/_blob/<id>", ...} from upload_asset
ARTIFACT = "--artifact" in sys.argv   # one comparison page for the Artifact tool, art as sibling files
def A_(k):
    if DC: return BLOBS[k]
    if ARTIFACT: return f"art/{k}.png"
    return art(*ART_SRC[k])
ROSIE, BANDIT, GIFT, CROWN, TROPHY, SPARKLES = (A_(k) for k in ("rosie","bandit","gift","crown","trophy","sparkles"))

def export_assets(outdir):
    """Write the downscaled PNGs to disk so they can be uploaded to a canvas."""
    os.makedirs(outdir, exist_ok=True)
    for k, (path, size) in ART_SRC.items():
        im = Image.open(os.path.join(REPO, path)).convert("RGBA"); im.thumbnail((size, size), Image.LANCZOS)
        im.save(os.path.join(outdir, k + ".png"), "PNG", optimize=True)
if "--assets" in sys.argv:
    export_assets(sys.argv[sys.argv.index("--assets") + 1]); sys.exit(0)

CSS = """
:root{--ink:#2a1f15;--paper:#fffaf0;--cream:#fbeee2;--cream2:#f6e6d4;--mute:#605449;--ui-muted:#8c7e71;--bark:#3a2c1e;--bark-text:#fff3e2;
--rose:#ffd6dc;--rose-deep:#f8a8b3;--sky:#c8e3f0;--sage:#c9dec1;--sun:#ffd87a;--lilac:#d6c8f0;--peach:#ffc8a8;--slop-gold:#F5C44A;--slop-band:#FFE7AD;
--accent:#a03e2f;--success-text:#476436;--success-surface:#e8f5e0;--danger:#a03e2f;
--r-sm:8px;--r-md:12px;--r-lg:14px;--r-xl:18px;--r-pill:999px;
--s-xxs:2px;--s-xs:4px;--s-sm:8px;--s-md:12px;--s-card:14px;--s-lg:16px;--s-xl:24px;--s-xxl:32px;--page-pad:18px;
--shadow:4px 4px 0 var(--ink);--shadow-sm:2px 2px 0 var(--ink);}
*{box-sizing:border-box}
body{margin:0;background:#e9dccb;color:var(--ink);font-family:"Nunito","Trebuchet MS",sans-serif;font-weight:700;font-size:15px;line-height:21px;padding:32px 24px}
img,svg{display:block}
.boards{display:flex;gap:40px;align-items:flex-start;justify-content:center;flex-wrap:wrap}
.board{display:flex;flex-direction:column;gap:10px;align-items:center}
.board > .cap{font-family:"Patrick Hand",cursive;font-size:16px;line-height:20px;color:var(--mute)}
.brief{max-width:1240px;margin:0 auto 28px;display:flex;gap:24px;align-items:flex-start}
.brief h1{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:26px;line-height:28px;margin:0 0 6px}
.brief p{margin:0;color:var(--mute)}
.brief .rules{flex:1}
.brief ul{margin:6px 0 0;padding-left:18px;color:var(--mute)}
/* type roles */
.pageTitle{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:26px;line-height:28px}
.sectionTitle{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:22px;line-height:24px;letter-spacing:.2px}
.cardTitle{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:18px;line-height:22px;letter-spacing:.2px}
.cardTitleSm{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:15px;line-height:22px;letter-spacing:.2px}
.numeralLg{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:26px;line-height:28px}
.numeral{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:16px;line-height:20px}
.body{font-size:15px;line-height:21px}.bodySm{font-size:13px;line-height:18px}
.hand{font-family:"Patrick Hand",cursive;font-weight:400;font-size:15px;line-height:20px}
.handSm{font-family:"Patrick Hand",cursive;font-weight:400;font-size:13px;line-height:17px}
.kicker{font-family:"Patrick Hand",cursive;font-weight:400;font-size:13px;line-height:18px;letter-spacing:.4px;color:var(--accent);white-space:nowrap}
.kickerPill{font-weight:800;font-size:11px;line-height:14px;letter-spacing:1.6px;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.label{font-weight:800;font-size:12px;line-height:16px;letter-spacing:.3px}
.mute{color:var(--mute)}.accent{color:var(--accent)}.center{text-align:center}
/* phone */
.phone{position:relative;width:390px;min-height:900px;overflow:hidden;background:var(--cream);display:flex;flex-direction:column;border-radius:36px;border:2px solid var(--ink);box-shadow:var(--shadow)}
.phone.tall{min-height:900px}
.status{height:48px;flex:none}
.scroll{flex:1;padding:0 var(--page-pad) 0;display:flex;flex-direction:column;gap:var(--s-lg)}
.scroll>*{flex:none}
.crown{display:flex;flex-direction:column;gap:4px;padding-top:6px}
.crown .rule{height:2px;width:64px;background:var(--ink);opacity:.3;border-radius:1px;margin-top:2px}
.tabbar{flex:none;height:84px;background:var(--bark);border-top:2px solid var(--ink);display:flex;align-items:center;justify-content:space-around;padding:0 10px 14px}
.sign{font-family:"Patrick Hand",cursive;font-size:14px;line-height:16px;color:var(--bark-text);background:#5a4630;border:2px solid var(--ink);border-radius:6px;padding:5px 9px;box-shadow:var(--shadow-sm);transform:rotate(-1deg)}
.sign:nth-child(2n){transform:rotate(1.2deg)}
.sign.on{background:var(--sun);color:var(--ink)}
/* sticker */
.sticker{position:relative;background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow);padding:var(--s-card);transform:rotate(-.6deg)}
.sticker.straight{transform:none}.sticker.r{transform:rotate(.6deg)}.sticker.sm{box-shadow:var(--shadow-sm)}.sticker.flat{box-shadow:none}
.rose{background:var(--rose)}.sun{background:var(--sun)}.sage{background:var(--sage)}.lilac{background:var(--lilac)}.paper{background:var(--paper)}.cream2{background:var(--cream2)}.slop{background:var(--slop-band)}.sky{background:var(--sky)}.peach{background:var(--peach)}
.tape{position:absolute;top:-9px;left:22px;width:66px;height:18px;background:var(--sun);border:1px solid var(--ink);border-radius:2px;transform:rotate(-8deg);opacity:.95}
.ribbon{position:absolute;top:-10px;right:14px;background:var(--sun);border:2px solid var(--ink);border-radius:var(--r-sm);padding:2px 8px;font-weight:900;font-size:10px;letter-spacing:1.4px;box-shadow:var(--shadow-sm);transform:rotate(2deg)}
.ribbon.gold{background:var(--slop-gold)}
/* controls */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--s-sm);min-height:44px;padding:9px 18px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:22px;box-shadow:var(--shadow-sm);font-weight:800;font-size:15px;letter-spacing:.2px;white-space:nowrap}
.btn.sm{min-height:36px;padding:6px 14px;font-size:13px}.btn.xs{min-height:28px;padding:3px 10px;font-size:12px;border-radius:999px}
.btn.full{display:flex;width:100%}
.btn.ghost{border-color:var(--ui-muted);box-shadow:none}
.btn.gold{background:linear-gradient(180deg,#ffe38f,#f5c44a);color:#3a2a08}
.btn.lilac{background:var(--lilac)}
.btn.link{min-height:44px;padding:0;background:none;border:0;box-shadow:none;text-decoration:underline;font-weight:700}
.btn.handlink{min-height:32px;padding:0;background:none;border:0;box-shadow:none;font-family:"Patrick Hand",cursive;font-weight:400;font-size:15px;color:var(--accent)}
.tag{display:inline-flex;align-items:center;gap:4px;border:2px solid var(--ink);border-radius:var(--r-sm);padding:1px 8px;font-weight:900;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;background:var(--paper);box-shadow:var(--shadow-sm)}
.tag.sun{background:var(--sun)}.tag.sage{background:var(--sage)}.tag.gold{background:var(--slop-gold)}.tag.rose{background:var(--rose)}
.chip{display:inline-flex;align-items:center;gap:6px;border:2px solid var(--ink);border-radius:999px;padding:4px 12px;font-weight:800;font-size:12px;background:var(--paper);box-shadow:var(--shadow-sm)}
.chip.on{background:var(--sun)}
/* rows */
.group{background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow-sm);overflow:hidden}
.row{display:flex;align-items:center;gap:var(--s-md);min-height:52px;padding:8px var(--s-card);border-top:1px solid var(--cream2)}
.row:first-child{border-top:0}
.row .ic{width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center}
.row .ic img{width:26px;height:26px}
.row .txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.row .txt .sub{color:var(--mute);font-size:13px;line-height:17px}
.row .chev{color:var(--ui-muted);font-weight:900;font-size:18px;flex:none}
.row.danger .lbl{color:var(--danger)}
/* section header */
.sh{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:4px}
.sh .t{display:flex;flex-direction:column;gap:2px}
/* identity */
.id{display:flex;gap:var(--s-md);align-items:center}
.avatar{width:76px;height:76px;border-radius:50%;background:var(--paper);border:2px solid var(--ink);box-shadow:var(--shadow-sm);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;flex:none}
.avatar.md{width:56px;height:56px}.avatar.lg{width:96px;height:96px}
.avatar img{width:92%;margin-bottom:-4px}
.idcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.stats{display:flex;border-top:2px dashed rgba(42,31,21,.35);margin-top:var(--s-md);padding-top:var(--s-md)}
.stats .st{flex:1;display:flex;flex-direction:column;align-items:center;gap:0;text-align:center}
.stats .st+.st{border-left:1px solid rgba(42,31,21,.3)}
.codepill{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--paper);border:2px dashed var(--ink);border-radius:var(--r-md);padding:6px 6px 6px 12px}
.progress{height:10px;border:2px solid var(--ink);border-radius:999px;background:var(--paper);overflow:hidden}
.progress i{display:block;height:100%;background:var(--lilac);border-right:2px solid var(--ink)}
.icon{width:18px;height:18px}
.footer{padding:8px 0 16px;text-align:center}
.pigpair{position:relative;width:78px;height:64px;flex:none}
.pigpair img{position:absolute;bottom:0}
.pigpair .a{left:0;width:56px}.pigpair .b{right:0;width:40px;bottom:2px;transform:scaleX(-1)}
.seg{display:flex;gap:6px;background:var(--cream2);border:2px solid var(--ink);border-radius:999px;padding:4px}
.seg div{flex:1;text-align:center;font-weight:800;font-size:13px;line-height:18px;padding:6px 0;border-radius:999px;color:var(--mute)}
.seg div.on{background:var(--sun);color:var(--ink);border:2px solid var(--ink);box-shadow:var(--shadow-sm);padding:4px 0}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;padding:4px 2px}
.tile{min-height:132px;display:flex;flex-direction:column;justify-content:space-between;padding:12px}
.tile img.g{width:34px;height:34px}
.tile .top{display:flex;justify-content:space-between;align-items:flex-start}
.fold{position:absolute;right:0;top:0;width:0;height:0;border-style:solid;border-width:0 22px 22px 0;border-color:transparent var(--cream) transparent transparent}
.note{position:absolute;left:100%;top:0;margin-left:14px;width:200px;font-family:"Patrick Hand",cursive;font-size:14px;line-height:18px;color:var(--mute)}
.callout{display:flex;flex-direction:column;gap:6px;width:390px;background:var(--paper);border:2px dashed var(--ink);border-radius:var(--r-lg);padding:12px 14px;color:var(--mute);font-family:"Patrick Hand",cursive;font-size:15px;line-height:19px}
.callout b{color:var(--ink);font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:16px}
"""

CHEV = '<span class="chev">›</span>'
COPY_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
SHARE_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/></svg>'
def line_icon(kind):
    d = {
      "edit":'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      "lock":'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
      "scroll":'<path d="M6 3h11a2 2 0 0 1 2 2v11H6z"/><path d="M6 16v2a3 3 0 0 0 3 3h12"/><path d="M9 8h6M9 12h6"/>',
      "refresh":'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
      "bell":'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
      "exit":'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
      "x":'<path d="M18 6 6 18M6 6l12 12"/>',
      "gear":'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      "ticket":'<path d="M3 9a2 2 0 0 0 2-2V6h14v1a2 2 0 0 0 2 2v6a2 2 0 0 0-2 2v1H5v-1a2 2 0 0 0-2-2z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
      "users":'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/>',
    }[kind]
    return f'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2a1f15" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{d}</svg>'

def tabbar():
    return '<div class="tabbar"><div class="sign">Barn</div><div class="sign">Friends</div><div class="sign">Season</div><div class="sign">Shop</div><div class="sign on">Me</div></div>'

def crown(kicker="your scrapbook", title="Me"):
    return f'<div class="crown"><div class="kickerPill">★ {kicker}</div><div class="pageTitle">{title}</div><div class="rule"></div></div>'

PHONES = []   # (direction, stem, title, inner html) — filled as boards are built
def phone(inner, cap, tall=False, note=None, stem=None, direction=None):
    if stem: PHONES.append((direction, stem, cap, inner))
    n = f'<div class="note">{note}</div>' if note else ""
    return f'<div class="board"><div class="phone{" tall" if tall else ""}"><div class="status"></div><div class="scroll">{inner}</div>{tabbar()}{n}</div><div class="cap">{cap}</div></div>'

def row(icon_html, label, sub=None, badge="", danger=False, chev=True):
    s = f'<div class="sub">{sub}</div>' if sub else ""
    return f'<div class="row{" danger" if danger else ""}"><div class="ic">{icon_html}</div><div class="txt"><div class="lbl">{label}</div>{s}</div>{badge}{CHEV if chev else ""}</div>'

def glyph(src, size=26):
    return f'<img src="{src}" width="{size}" height="{size}" alt="">'

def identity(member=False, size="", show_code_btn=True, stats=True):
    tag = '<span class="tag gold">Slop club</span>' if member else '<span class="tag">Free range</span>'
    st = ""
    if stats:
        st = ('<div class="stats">'
              '<div class="st"><div class="numeralLg">12,480</div><div class="handSm mute">lifetime tickles</div></div>'
              '<div class="st"><div class="numeralLg">61</div><div class="handSm mute">active days</div></div>'
              '<div class="st"><div class="numeralLg">Jun ’26</div><div class="handSm mute">joined</div></div>'
              '</div>')
    btn = f'<div style="margin-top:12px"><div class="btn ghost full">{COPY_SVG} Copy my friend code</div></div>' if show_code_btn else ""
    return (f'<div class="sticker rose" style="position:relative"><div class="tape"></div>'
            f'<div class="id"><div class="avatar {size}"><img src="{ROSIE}" alt=""></div>'
            f'<div class="idcol"><div class="hand mute">your friend code</div>'
            f'<div class="cardTitle">briguy <span class="hand accent">· Truffle Hound</span></div>'
            f'<div class="kickerPill">@briguy#4821</div><div style="margin-top:4px">{tag}</div></div></div>'
            f'{st}{btn}</div>')

def footer():
    return '<div class="footer hand mute">★ tickle the pig · v1.9.3 ★</div>'

def brief(title, one_liner, rules):
    lis = "".join(f"<li>{r}</li>" for r in rules)
    return f'<div class="brief"><div class="rules"><h1>{title}</h1><p>{one_liner}</p><ul>{lis}</ul></div></div>'

def page(title, body):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@700;800;900&family=Patrick+Hand&display=swap">
<style>{CSS}</style></head><body>{body}</body></html>"""

# ------------------------------------------------------------------ A · the passport
def A():
    def progress_group():
        return ('<div class="sh"><div class="t"><div class="kicker">your prestige</div><div class="sectionTitle">Your story</div></div></div>'
                '<div class="group">'
                + row(glyph(CROWN), "Wallow rank W2", "Muddy Regular · next W3 refills faster", '<span class="tag rose">W2</span>')
                + row(glyph(TROPHY), "Achievements", "devotion, generous + greedy ladders", '<span class="tag sun">3</span>')
                + row(glyph(SPARKLES), "Prestige gear", "2 earned · in your closet")
                + '</div>')
    def herd_group(member):
        return ('<div class="sh"><div class="t"><div class="kicker">grow the herd</div><div class="sectionTitle">Invite &amp; redeem</div></div></div>'
                '<div class="group">'
                + row(line_icon("users"), "Invite new pigs", "PIGGY-4821 · 1 of 3 to the Messenger Hat", f'<div class="btn xs">{SHARE_SVG} Share</div>')
                + row(glyph(GIFT), "Redeem a Golden Ticket", "scan or type a code")
                + '</div>')
    def slop_free():
        return (f'<div class="sticker slop r" style="position:relative;margin-top:6px"><div class="ribbon">One friend</div>'
                f'<div style="display:flex;gap:12px;align-items:center"><div class="pigpair"><img class="a" src="{ROSIE}"><img class="b" src="{BANDIT}"></div>'
                f'<div style="flex:1;min-width:0"><div class="kickerPill">Slop club</div><div class="cardTitle">Give Rosie a friend.</div>'
                f'<div class="hand mute">a companion, the members band, monthly drops</div></div></div>'
                f'<div class="btn gold full" style="margin-top:12px">Join the Slop Club</div>'
                f'<div class="handSm mute center" style="margin-top:6px">plans, prices, terms on the next page</div></div>')
    def slop_member():
        return ('<div class="group">' + row(glyph(CROWN), "Slop Club", "active · Bandit is in the Pen", '<span class="tag gold">Active</span>') + '</div>')
    def settings_group():
        return ('<div class="sh"><div class="t"><div class="kicker">settings</div><div class="sectionTitle">The back door</div></div></div>'
                '<div class="group">'
                + row(line_icon("gear"), "Settings", "name, blocked pigs, purchases, sign out")
                + row(line_icon("scroll"), "What’s new")
                + row(line_icon("bell"), "Found a bug or have an idea?")
                + '</div>')
    free = crown() + identity() + progress_group() + herd_group(False) + slop_free() + settings_group() + footer()
    memb = crown() + identity(member=True) + progress_group() + slop_member() + herd_group(True) + settings_group() + footer()
    body = brief("A · The passport",
                 "One identity card, then every big surface becomes a door. The page you can read in one screen.",
                 ["The friend-code card is the only sticker that stays — everything below it is a row group (the Settings geometry, promoted).",
                  "Wallow rank, Achievements, Referrals each open their own sheet/screen; the row shows the one number that matters (next rank · ready to claim · 1 of 3).",
                  "Slop Club: non-members get one slim band with the pig pair and the gold CTA; members get a row. Fine print + legal move to the paywall page.",
                  "Settings folds to one door plus What’s new and the whisper. Sign out / delete live inside it.",
                  "Risk: the referral surface (Connect) loses its share button prominence — kept as an inline Share on the row."])
    body += '<div class="boards">' + phone(free, "free-range player", tall=True, stem="A_Free", direction="A") + phone(memb, "Slop Club member", tall=True, stem="A_Member", direction="A") + '</div>'
    return page("A · The passport", body)

# ------------------------------------------------------------------ B · the tile board
def B():
    def tiles(member):
        slop = (f'<div class="sticker sm slop tile straight" style="position:relative"><div class="ribbon gold" style="font-size:9px">Active</div><div class="top"><img class="g" src="{CROWN}"></div><div><div class="cardTitleSm">Bandit’s in the Pen</div><div class="handSm mute">visit the Pen ›</div></div></div>'
                if member else
                f'<div class="sticker sm slop tile straight"><div class="top"><img class="g" src="{CROWN}"><span class="kickerPill">slop club</span></div><div><div class="cardTitleSm">Give Rosie a friend.</div><div class="btn gold xs" style="margin-top:6px">Join</div></div></div>')
        return ('<div class="tiles">'
                f'<div class="sticker sm paper tile straight"><div class="top"><img class="g" src="{CROWN}"><span class="kickerPill">wallow</span></div><div><div class="numeralLg">W2</div><div class="handSm mute">Muddy Regular · W3 next ›</div></div></div>'
                f'<div class="sticker sm paper tile straight"><div class="top"><img class="g" src="{TROPHY}"><span class="tag sun">3 ready</span></div><div><div class="numeralLg">27</div><div class="handSm mute">achievements earned ›</div></div></div>'
                f'<div class="sticker sm lilac tile straight"><div class="top">{line_icon("users")}<span class="kickerPill">referrals</span></div><div><div class="numeralLg">1 <span class="numeral mute">of 3</span></div><div class="handSm mute">to the Messenger Hat ›</div></div></div>'
                + slop + '</div>')
    def share_band():
        return ('<div class="sticker rose r"><div class="kicker">grow the herd</div><div class="cardTitle">Share your referral code</div>'
                f'<div class="codepill" style="margin-top:8px"><span class="sectionTitle" style="letter-spacing:1px">PIGGY-4821</span><div class="btn xs ghost">{COPY_SVG} Copy</div></div>'
                f'<div class="btn lilac full" style="margin-top:10px">{SHARE_SVG} Share your referral code</div>'
                '<div class="handSm mute" style="margin-top:6px">100 tickles each time a friend reaches 100.</div></div>')
    def ticket_row():
        return '<div class="group">' + row(glyph(GIFT), "Redeem a Golden Ticket", "scan or type a code") + '</div>'
    def settings():
        return ('<div class="sh"><div class="t"><div class="kicker">settings</div><div class="sectionTitle">Settings</div></div></div>'
                '<div class="group">' + row(line_icon("gear"), "Account &amp; privacy", "name, blocked pigs, purchases, sign out")
                + row(line_icon("scroll"), "What’s new") + row(line_icon("bell"), "Found a bug or have an idea?") + '</div>')
    def ident():
        # identity with the code pill inline, no full-width copy button
        return (f'<div class="sticker rose" style="position:relative"><div class="tape"></div>'
                f'<div class="id"><div class="avatar lg"><img src="{ROSIE}" alt=""></div>'
                f'<div class="idcol"><div class="cardTitle">briguy</div><div class="hand accent">Truffle Hound</div>'
                f'<div class="codepill" style="margin-top:6px;padding:3px 3px 3px 10px"><span class="label">@briguy#4821</span>{COPY_SVG}</div></div></div>'
                '<div class="stats">'
                '<div class="st"><div class="numeralLg">12,480</div><div class="handSm mute">lifetime tickles</div></div>'
                '<div class="st"><div class="numeralLg">61</div><div class="handSm mute">active days</div></div>'
                '<div class="st"><div class="numeralLg">Jun ’26</div><div class="handSm mute">joined</div></div>'
                '</div></div>')
    free = crown() + ident() + '<div class="sh"><div class="t"><div class="kicker">at a glance</div><div class="sectionTitle">Your board</div></div></div>' + tiles(False) + share_band() + ticket_row() + settings() + footer()
    memb = crown() + ident() + '<div class="sh"><div class="t"><div class="kicker">at a glance</div><div class="sectionTitle">Your board</div></div></div>' + tiles(True) + share_band() + ticket_row() + settings() + footer()
    body = brief("B · The tile board",
                 "Identity on top, then four square stickers — one number each — for the four things you’d otherwise scroll past.",
                 ["Wallow · Achievements · Referrals · Slop Club become 2×2 tiles: a glyph, a numeral, one hand-line. Each tile is a door.",
                  "The friend code lives inside the identity card as a pill with a copy mark — no full-width button.",
                  "Sharing stays above the fold-ish as its own rose band (Connect wants the share, not a row).",
                  "Membership sells from a gold tile for non-members; the long pitch (pig pair, ‘also included’, legal) moves to the paywall page.",
                  "Risk: tiles want equal weight; if the membership CTA needs to shout, this direction whispers it."])
    body += '<div class="boards">' + phone(free, "free-range player", tall=True, stem="B_Free", direction="B") + phone(memb, "Slop Club member", tall=True, stem="B_Member", direction="B") + '</div>'
    return page("B · The tile board", body)

# ------------------------------------------------------------------ C · three shelves
def C():
    def head(on):
        segs = "".join(f'<div class="{"on" if s==on else ""}">{s}</div>' for s in ("Story","Herd","Settings"))
        ident = (f'<div class="sticker rose sm straight" style="padding:10px 12px">'
                 f'<div class="id"><div class="avatar md"><img src="{ROSIE}" alt=""></div>'
                 f'<div class="idcol"><div class="cardTitle">briguy <span class="hand accent">· Truffle Hound</span></div>'
                 f'<div class="kickerPill">@briguy#4821 · <span style="color:#a03e2f">free range</span></div></div>'
                 f'<div class="btn xs ghost">{COPY_SVG} code</div></div></div>')
        return crown() + ident + f'<div class="seg">{segs}</div>'
    def story():
        return ('<div class="sticker paper flat straight" style="padding:10px 12px"><div class="stats" style="border-top:0;margin-top:0;padding-top:0">'
                '<div class="st"><div class="numeralLg">12,480</div><div class="handSm mute">lifetime tickles</div></div>'
                '<div class="st"><div class="numeralLg">61</div><div class="handSm mute">active days</div></div>'
                '<div class="st"><div class="numeralLg">Jun ’26</div><div class="handSm mute">joined</div></div></div>'
                '<div class="btn handlink" style="margin:4px auto 0;display:flex">the long story ›</div></div>'
                '<div class="sh"><div class="t"><div class="kicker">your prestige</div><div class="sectionTitle">Wallow rank</div></div><div class="chip">W2 · Muddy Regular</div></div>'
                '<div class="sticker paper r"><div style="display:flex;justify-content:space-between;align-items:center">'
                '<div><div class="kickerPill accent">next wallow</div><div class="cardTitleSm">Reach W3</div></div><div class="tag rose" style="font-size:14px;padding:4px 10px">W3</div></div>'
                '<div style="display:flex;justify-content:space-between;margin-top:8px" class="bodySm"><span class="mute">Tickle refill</span><span>6m → 5m</span></div>'
                '<div style="display:flex;justify-content:space-between;margin-top:2px" class="bodySm"><span class="mute">Friend visits</span><span>12h → 10h</span></div>'
                '<div class="hand accent" style="margin-top:6px">+ exclusive W3 wearable</div></div>'
                '<div class="group">' + row(glyph(TROPHY), "Achievements", "devotion, generous + greedy ladders", '<span class="tag sun">3</span>')
                + row(glyph(SPARKLES), "Prestige gear", "2 earned") + '</div>')
    def herd():
        return (f'<div class="sticker slop r" style="position:relative"><div class="ribbon">One friend</div>'
                f'<div style="display:flex;gap:12px;align-items:center"><div class="pigpair"><img class="a" src="{ROSIE}"><img class="b" src="{BANDIT}"></div>'
                f'<div style="flex:1;min-width:0"><div class="kickerPill">Slop club</div><div class="cardTitle">Give Rosie a friend.</div></div></div>'
                f'<div class="btn gold full" style="margin-top:12px">Join the Slop Club</div></div>'
                '<div class="sh"><div class="t"><div class="kicker">referrals</div><div class="sectionTitle">Invite new pigs</div></div></div>'
                '<div class="sticker rose">'
                f'<div class="codepill"><span class="sectionTitle" style="letter-spacing:1px">PIGGY-4821</span><div class="btn xs ghost">{COPY_SVG} Copy</div></div>'
                f'<div class="btn lilac full" style="margin-top:10px">{SHARE_SVG} Share your referral code</div>'
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span class="label">1 of 3 to the Messenger Hat</span><span class="handSm mute">2 on the way</span></div>'
                '<div class="progress" style="margin-top:6px"><i style="width:33%"></i></div>'
                '<div class="btn handlink" style="margin-top:6px">referral board + rewards ›</div></div>'
                '<div class="group">' + row(glyph(GIFT), "Redeem a Golden Ticket", "scan or type a code") + '</div>')
    def settings():
        return ('<div class="group">' + row(line_icon("edit"), "Change your name") + row(line_icon("lock"), "Blocked users")
                + row(line_icon("scroll"), "What’s new") + row(line_icon("refresh"), "Barn introduction") + row(line_icon("bell"), "Found a bug or have an idea?") + '</div>'
                '<div class="group">' + row(line_icon("refresh"), "Restore purchases") + '</div>'
                '<div class="group">' + row(line_icon("exit"), "Sign out") + row(line_icon("x"), "Delete account", danger=True) + '</div>' + footer())
    body = brief("C · Three shelves",
                 "The identity strip stays put; a segmented control splits the rest into Story · Herd · Settings, each a short pane.",
                 ["Story = lifetime band, Wallow rank (kept as a card, trimmed), Achievements + prestige gear rows.",
                  "Herd = Slop Club pitch (trimmed) + referral code/share/progress + Golden Ticket. Everything about other pigs on one shelf.",
                  "Settings = today’s three groups, unchanged, but no longer 1,400pt down the page.",
                  "Identity compacts to a strip (56pt pig, name, handle, tiny ‘code’ button) so the segmented control sits high.",
                  "Risk: this creates rooms — against the 2026-09-17 ‘one scroll per destination’ ruling for the Shop. Worth it only if the panes stay short enough to never scroll."])
    body += '<div class="boards">' + phone(head("Story") + story(), "Story shelf", stem="C_Story", direction="C") + phone(head("Herd") + herd(), "Herd shelf", stem="C_Herd", direction="C") + phone(head("Settings") + settings(), "Settings shelf", stem="C_Settings", direction="C") + '</div>'
    return page("C · Three shelves", body)

BRIEFS = {
    "A": ("A · The passport", "One identity card, then every big surface becomes a door. Wallow · Achievements · Referrals are rows with one number each; the Slop Club pitch shrinks to a band (non-member) or a row (member); Settings folds to one door. Fine print + legal → the paywall page."),
    "B": ("B · The tile board", "Identity on top, then a 2×2 of square stickers (Wallow · Achievements · Referrals · Slop Club) — a glyph, a numeral, one hand-line, each a door. The share stays a real button in its own band. Settings folds to one door."),
    "C": ("C · Three shelves", "A compact identity strip, then Story · Herd · Settings behind a segmented control; each pane short. Cuts against the 2026-09-17 ‘one scroll per destination’ Shop ruling — only worth it if the panes never scroll."),
}
DC_H = {"A": 1560, "B": 1500, "C": 1000}

def dc_board(stem, title, inner, h):
    css = CSS.replace("body{margin:0;background:#e9dccb;", "body{margin:0;background:#fffaf0;").replace("padding:32px 24px}", "padding:0}")
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;display=swap">
<style>{css}
.phone{{border:0;border-radius:0;box-shadow:none;min-height:{h}px}}</style>
</helmet>
<div style="width: 390px; height: {h}px; box-sizing: border-box; overflow: hidden; background: #fffaf0;">
<div class="phone"><div class="status"></div><div class="scroll">{inner}</div>{tabbar()}</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

for name, fn in (("A_passport.html", A), ("B_tiles.html", B), ("C_shelves.html", C)):
    html = fn()
    if not DC and not ARTIFACT:
        with open(os.path.join(ROOT, name), "w") as f: f.write(html)
        print("wrote", name)

if DC:
    out = os.path.join(ROOT, "project"); os.makedirs(out, exist_ok=True)
    boards, order, notes = {}, [], {}
    y = 0
    for d in ("A", "B", "C"):
        row = [p for p in PHONES if p[0] == d]
        h = DC_H[d]
        title, brief = BRIEFS[d]
        notes[f"t_{d}"] = {"x": 0, "y": y, "text": title, "kind": "title1", "maxW": 470 * len(row) + 480}
        notes[f"n_{d}"] = {"x": 470 * len(row), "y": y + 240, "w": 420, "text": brief, "size": "m"}
        x = 0
        for _, stem, cap, inner in row:
            fname = f"{stem}.dc.html"
            with open(os.path.join(out, fname), "w") as f: f.write(dc_board(stem, f"{d} · {cap}", inner, h))
            boards[fname] = {"x": x, "y": y + 240, "w": 390, "h": h, "title": f"{d} · {cap}"}
            order.append(fname); x += 470
        y += 240 + h + 120
    # the entry artboard is the first one, renamed Main
    first = order[0]
    os.replace(os.path.join(out, first), os.path.join(out, "Main.dc.html"))
    boards["Main.dc.html"] = boards.pop(first); order[0] = "Main.dc.html"
    canvas = {"v": 3, "createdOnFiles": {"v": 1, "at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")},
              "title": "Me, simplified", "launch": {"view": "canvas"}, "pages": [], "boards": boards,
              "order": order, "notes": notes, "designSystems": []}
    json.dump(canvas, open(os.path.join(out, "canvas.json"), "w"), indent=1)
    print("wrote", len(order), "artboards + canvas.json →", out)


# ------------------------------------------------------------------ the artifact: one comparison page
if ARTIFACT:
    out = sys.argv[sys.argv.index("--artifact") + 1]
    export_assets(os.path.join(out, "art"))
    phone_css = CSS.split("/* phone */")[1]
    def phones_row(d):
        row = [p for p in PHONES if p[0] == d]
        return '<div class="phones">' + "".join(
            f'<figure class="ph"><div class="phone"><div class="status"></div><div class="scroll">{inner}</div>{tabbar()}</div><figcaption class="hand mute">{cap}</figcaption></figure>'
            for _, stem, cap, inner in row) + '</div>'
    def section(d, title, thesis, keeps, moves, risk):
        li = lambda xs: "".join(f"<li>{x}</li>" for x in xs)
        return f"""
<section class="dir" id="dir-{d}">
  <aside class="aside">
    <div class="kicker">direction {d}</div>
    <h2 class="sectionTitle">{title}</h2>
    <p class="thesis">{thesis}</p>
    <div class="ledger">
      <div><span class="kickerPill">keeps</span><ul>{li(keeps)}</ul></div>
      <div><span class="kickerPill">moves off the page</span><ul>{li(moves)}</ul></div>
      <div><span class="kickerPill">the risk</span><p>{risk}</p></div>
    </div>
  </aside>
  {phones_row(d)}
</section>"""

    PAGE_CSS = """
:root{--desk:#e6d6c2;--desk-line:rgba(42,31,21,.10)}
html{color-scheme:light}
body{background:var(--desk);padding:0 0 64px;font-family:"Nunito","Trebuchet MS",sans-serif}
.wrap{max-width:1360px;margin:0 auto;padding-inline:24px}
header.crownbar{padding-block:40px 24px;display:flex;flex-direction:column;gap:6px;max-width:66ch}
header .pageTitle{font-size:40px;line-height:44px;text-wrap:balance}
header .lede{font-size:16px;line-height:24px;color:var(--mute);margin:8px 0 0}
.today{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.today .tk{background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-md);box-shadow:var(--shadow-sm);padding:6px 10px;font-size:13px;line-height:18px;transform:rotate(-.4deg)}
.today .tk:nth-child(2n){transform:rotate(.5deg)}
.today .tk b{font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:15px;margin-right:4px}
.dir{display:grid;grid-template-columns:minmax(260px,320px) 1fr;gap:28px;align-items:start;padding-block:36px;border-top:2px dashed var(--desk-line)}
.aside{position:sticky;top:24px;background:var(--paper);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow);padding:18px;transform:rotate(-.5deg)}
.aside .sectionTitle{margin:2px 0 8px;font-size:26px;line-height:30px}
.aside .thesis{margin:0 0 14px;font-size:15px;line-height:22px}
.ledger{display:flex;flex-direction:column;gap:12px;border-top:2px dashed rgba(42,31,21,.3);padding-top:12px}
.ledger ul{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:19px}
.ledger p{margin:4px 0 0;font-size:13px;line-height:19px}
.phones{min-width:0;display:flex;gap:28px;overflow-x:auto;padding:12px 4px 20px;scroll-snap-type:x proximity}
.ph{margin:0;flex:none;display:flex;flex-direction:column;gap:8px;align-items:center;scroll-snap-align:start}
.ph .phone{width:390px}
.compare{padding-block:36px;border-top:2px dashed var(--desk-line);display:grid;grid-template-columns:minmax(0,62ch) 1fr;gap:36px;align-items:start}
.compare h2{margin:0 0 10px}
.compare p{font-size:15px;line-height:23px;margin:0 0 12px}
.compare .cut{display:flex;flex-direction:column;gap:10px}
.bar{display:grid;grid-template-columns:120px 1fr 64px;align-items:center;gap:10px;font-size:13px}
.bar .tr{height:16px;border:2px solid var(--ink);border-radius:999px;background:var(--paper);overflow:hidden}
.bar .tr i{display:block;height:100%;background:var(--rose);border-right:2px solid var(--ink)}
.bar.now .tr i{background:var(--cream2)}
.bar.pick .tr i{background:var(--sun)}
.bar .n{font-variant-numeric:tabular-nums;text-align:right;font-weight:800}
.verdict{background:var(--sun);border:2px solid var(--ink);border-radius:var(--r-xl);box-shadow:var(--shadow);padding:18px 20px;transform:rotate(.4deg);position:relative;margin-top:14px}
.verdict .tape{left:auto;right:28px}
.verdict h3{margin:0 0 6px;font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:22px}
.verdict ol{margin:8px 0 0;padding-left:20px;font-size:14px;line-height:21px}
.moves{padding-block:36px;border-top:2px dashed var(--desk-line)}
.moves h2{margin:0 0 4px}
.moves .sub{color:var(--mute);margin:0 0 16px;font-size:14px}
.mv{display:grid;grid-template-columns:1fr 24px 1fr;gap:10px 14px;align-items:baseline;max-width:900px}
.mv > div{padding:8px 0;border-top:1px solid var(--desk-line);font-size:14px;line-height:20px}
.mv > div.arrow{color:var(--ui-muted);font-weight:900;text-align:center}
.mv .to{font-weight:800}
.mv .head{border-top:0;padding-bottom:2px}
footer{padding-top:28px;border-top:2px dashed var(--desk-line);color:var(--mute);font-size:13px;line-height:19px}
footer code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--paper);padding:1px 5px;border-radius:4px;border:1px solid var(--desk-line)}
:focus-visible{outline:3px solid #3d687f;outline-offset:2px}
@media (max-width:900px){.dir,.compare{grid-template-columns:1fr}.aside{position:static}.mv{grid-template-columns:1fr}.mv .arrow{display:none}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
"""
    body = f"""
<div class="wrap">
<header class="crownbar">
  <div class="kickerPill">★ tickle the pig · me tab · design round · 20 sep 2026</div>
  <h1 class="pageTitle">Me, simplified</h1>
  <p class="lede">The Me tab is the scrapbook page: who you are, how far you've wallowed, the herd you've grown, and the back door. Today it is seven stacked stickers and eight settings rows — the friend-code card, the Wallow rank card, an Achievements row, a tall Slop Club pitch, a taller referral card, a Golden Ticket row, then Settings. Three directions below cut the same fat in three shapes. Every one keeps the identity card and the tab's crown.</p>
  <div class="today" aria-label="What the page holds today">
    <span class="tk"><b>1</b> friend-code card</span><span class="tk"><b>2</b> Wallow rank</span><span class="tk"><b>3</b> Achievements</span><span class="tk"><b>4</b> Slop Club pitch</span><span class="tk"><b>5</b> referral card</span><span class="tk"><b>6</b> Golden Ticket</span><span class="tk"><b>7</b> Settings · 8 rows</span>
  </div>
</header>

{section("A", "The passport",
  "One identity card, then every big surface becomes a door. The row group Settings already uses is promoted to the whole page, so a player reads the page in one screen and opens what they came for.",
  ["The friend-code card, stats band and copy button, unchanged", "A gold Slop Club band for non-members — pig pair, one line, one CTA", "Share, inline on the referral row"],
  ["Wallow's next-rank deltas → the rank sheet", "Referral ladder, recent referrals, fine print → /recruits-progress", "Slop Club 'also included', fine print, Terms · Privacy → the paywall page", "Name, blocked pigs, restore, sign out, delete → one Settings door"],
  "The referral surface loses its full-width Share — Connect's one ask on this page is now a small button on a row.")}

{section("B", "The tile board",
  "Identity on top, then four square stickers — one glyph, one numeral, one hand-line — for the four things you'd otherwise scroll past. Progress reads at a glance; the share keeps its own band.",
  ["The friend code as a pill inside the identity card, no full-width button", "A rose 'share your code' band with the lilac Share button", "Wallow · Achievements · Referrals · Slop Club as equal tiles, each a door"],
  ["Same as A for Wallow, referrals and the membership pitch", "Settings → one Account &amp; privacy door plus What's new and the whisper"],
  "Tiles want equal weight. If the membership CTA must shout at non-members, this direction whispers it from a tile.")}

{section("C", "Three shelves",
  "A compact identity strip stays put; a segmented control splits the rest into Story · Herd · Settings. Each pane is short enough to never scroll, and Settings keeps today's three groups.",
  ["Wallow rank as a card, trimmed to next-rank only", "The full referral band — code, Share, milestone bar, board link", "Today's Settings rows, all of them, on their own shelf"],
  ["The membership 'also included' row and legal → the paywall page", "The lifetime band leaves the identity card for the Story shelf"],
  "It makes rooms. The Shop ruling of 17 Sep — one scroll per destination, a room's sign becomes a spot on the page — points the other way; this only earns its keep if every pane fits without scrolling.")}

<section class="compare" id="compare">
  <div>
    <h2 class="sectionTitle">Side by side</h2>
    <p>Where they agree: nobody keeps the tall Slop Club pitch or the referral card's ladder on this page — the paywall and <code>/recruits-progress</code> already own that content, and the Me page has been re-explaining it. Nobody touches the identity card's shape. The differences are all in what the page does with the middle.</p>
    <p><b>A</b> is the deepest cut. It reuses one geometry (the row group) for everything below the card, so the page has three kinds of thing on it — a card, rows, a band — and a player's eye learns the page in one pass. Its cost is honesty about the share: Connect asks this page for exactly one thing, and A shrinks it to a small button.</p>
    <p><b>B</b> spends more surfaces to put a number on each door. That's the collector's instinct — W2, 27, 1 of 3 — and it keeps the share as a real button. But four equal tiles say four equal things, and the membership tile can't lead the way the gold card does today.</p>
    <p><b>C</b> is the least change to any one surface and the most change to the page's shape. Its panes are the shortest, but a pane is a room, and the Shop just paid to get rid of rooms.</p>
  </div>
  <div>
    <div class="cut" aria-label="Surfaces stacked on the page before Settings">
      <div class="kickerPill" style="margin-bottom:2px">surfaces stacked before Settings · one scroll</div>
      <div class="bar now"><span>today</span><div class="tr"><i style="width:100%"></i></div><span class="n">6 + 8 rows</span></div>
      <div class="bar pick"><span>A · passport</span><div class="tr"><i style="width:34%"></i></div><span class="n">1 + 8 rows</span></div>
      <div class="bar"><span>B · tiles</span><div class="tr"><i style="width:62%"></i></div><span class="n">6 + 4 rows</span></div>
      <div class="bar"><span>C · shelves</span><div class="tr"><i style="width:44%"></i></div><span class="n">≤3 per shelf</span></div>
    </div>
    <div class="verdict"><div class="tape"></div>
      <h3>Recommendation: A, with B's share band</h3>
      <p style="margin:0;font-size:14px;line-height:21px">Take the passport and lift one thing from the tile board: the rose share band sits between “Your story” and “Invite &amp; redeem”, so the page keeps one full-width Share for Connect and everything else is a row. Serves <b>Connect</b> (the share stays an act, not a row) and <b>craft</b> (one row geometry, one card, one band).</p>
      <ol>
        <li>Card · story rows · share band · redeem row · Slop Club band (non-members) · back door.</li>
        <li>Members: the Slop Club band becomes a row under “Your story”.</li>
        <li>Wallow and referral detail move to sheets that already exist; nothing is deleted from the game.</li>
      </ol>
    </div>
  </div>
</section>

<section class="moves" id="moves">
  <h2 class="sectionTitle">What moves where</h2>
  <p class="sub">Every element on today's page, and where it lands in the recommendation.</p>
  <div class="mv">
    <div class="head kickerPill">today</div><div class="head"></div><div class="head kickerPill">recommendation</div>
    <div>Friend-code card · stats band · copy button</div><div class="arrow">→</div><div class="to">stays, unchanged</div>
    <div>Wallow rank card (current · next · deltas · gear link)</div><div class="arrow">→</div><div class="to">one row; deltas + gear link in the rank sheet</div>
    <div>Achievements row</div><div class="arrow">→</div><div class="to">stays, in the “Your story” group</div>
    <div>Slop Club card (pig pair · also included · CTA · fine print · legal)</div><div class="arrow">→</div><div class="to">non-members: band with pig pair + CTA; members: a row. Rest → paywall page</div>
    <div>Referral card (intro · code · Share · milestone · standing · recent · details · fine print · redeem box)</div><div class="arrow">→</div><div class="to">share band (code + Share) and one row; ladder + recent → /recruits-progress; redeem box stays for eligible new accounts only</div>
    <div>Golden Ticket row</div><div class="arrow">→</div><div class="to">stays, in “Invite &amp; redeem”</div>
    <div>Settings · 8 rows in 3 groups</div><div class="arrow">→</div><div class="to">Settings door (name · blocked · restore · sign out · delete) + What's new + whisper</div>
  </div>
</section>

<footer>
  Boards and this page are generated from <code>docs/design/claude-design/me-2026-09-20/gen.py</code>; the same file exports the artboards for a Claude Design canvas (<code>--dc</code>). Reply with a letter — or a mix — and the next round is one direction, refined.
</footer>
</div>
"""
    html = f"""<title>Me, simplified</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@700;800;900&family=Patrick+Hand&display=swap">
<style>{CSS}{PAGE_CSS}</style>
{body}"""
    with open(os.path.join(out, "index.html"), "w") as f: f.write(html)
    print("wrote", os.path.join(out, "index.html"), "+ art/")
