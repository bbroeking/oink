#!/usr/bin/env python3
# Emits the Snout Deep bag/finds/dismiss artboards from one shared style block.
# Every value is lifted from constants/theme.ts (WHIMSY, TYPE, RADII, SPACE,
# BORDER, STICKER_SHADOW, ART_SIZE, PAGE_PAD) and the Snout Deep sheets.
import os, textwrap

OUT = os.path.dirname(os.path.abspath(__file__))

STYLE = """
@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@600;700;800;900&family=Patrick+Hand&family=Fredoka:wght@700&display=swap');
:root{
  --ink:#2a1f15; --paper:#fffaf0; --cream:#fbeee2; --cream2:#f6e6d4;
  --rose:#ffd6dc; --roseDeep:#f8a8b3; --sky:#c8e3f0; --sage:#c9dec1; --sun:#ffd87a;
  --lilac:#d6c8f0; --accent:#a03e2f; --goldInk:#5A3F00; --sageInk:#7A9B63;
  --mute:#605449; --muteSoft:#8c7e71; --bark:#3a2c1e;
  --dirt:#7b5535; --dirt2:#8b6544;
}
*{box-sizing:border-box;margin:0}
body{margin:0;background:var(--cream);color:var(--ink);font-family:'Nunito',sans-serif;font-weight:700}
a{color:var(--accent)} a:hover{color:#7d2f23}
/* type roles (TYPE.*) */
.pageTitle{font-family:'Caprasimo',serif;font-weight:400;font-size:26px;line-height:28px}
.sectionTitle{font-family:'Caprasimo',serif;font-weight:400;font-size:22px;line-height:24px;letter-spacing:.2px}
.cardTitle{font-family:'Caprasimo',serif;font-weight:400;font-size:18px;line-height:22px;letter-spacing:.2px}
.cardTitleSm{font-family:'Caprasimo',serif;font-weight:400;font-size:15px;line-height:22px;letter-spacing:.2px}
.numeral{font-family:'Caprasimo',serif;font-weight:400;font-size:16px;line-height:20px}
.body{font-size:15px;line-height:21px;font-weight:700}
.bodySm{font-size:13px;line-height:18px;font-weight:700}
.label{font-size:12px;line-height:16px;font-weight:800;letter-spacing:.3px}
.kicker{font-family:'Patrick Hand',cursive;font-weight:400;font-size:13px;line-height:18px;letter-spacing:.4px}
.hand{font-family:'Patrick Hand',cursive;font-weight:400;font-size:14px;line-height:20px}
.handLg{font-family:'Patrick Hand',cursive;font-weight:400;font-size:17px;line-height:24px}
.kickerPill{font-size:11px;line-height:14px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase}
.mute{color:var(--mute)} .accent{color:var(--accent)}
/* the phone (390x844), safe-area top 59 / bottom 34 */
.phone{width:390px;height:844px;background:var(--cream);overflow:hidden;position:relative;display:flex;flex-direction:column}
.page{padding:59px 18px 34px;display:flex;flex-direction:column;gap:12px;height:100%}
/* sticker = paper, 2px ink border, 4px hard shadow (STICKER_SHADOW) */
.sticker{background:var(--paper);border:2px solid var(--ink);border-radius:14px;box-shadow:4px 4px 0 var(--ink)}
.stickerSm{background:var(--paper);border:2px solid var(--ink);border-radius:14px;box-shadow:2px 2px 0 var(--ink)}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--paper);border:2px solid var(--ink);border-radius:999px;padding:6px 12px;box-shadow:2px 2px 0 var(--ink)}
.tag{display:inline-flex;align-items:center;background:var(--cream2);border:1.5px solid var(--ink);border-radius:999px;padding:2px 8px}
.btn{display:flex;align-items:center;justify-content:center;min-height:44px;padding:11px 18px;border:2px solid var(--ink);border-radius:22px;background:var(--paper);font-size:15px;font-weight:800;box-shadow:4px 4px 0 var(--ink)}
.btnGold{background:var(--sun);color:var(--goldInk)}
.btnLg{min-height:54px;border-radius:999px;font-size:17px}
.handLink{font-family:'Patrick Hand',cursive;font-weight:400;font-size:14px;color:var(--accent);text-decoration:underline;text-underline-offset:3px;text-align:center}
.iconBtn{width:44px;height:44px;border:2px solid var(--ink);border-radius:999px;background:var(--paper);display:flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 var(--ink)}
/* the ledger sheet (reveal-family-spec §1) */
.sheet{background:var(--paper);border:2px solid var(--ink);border-radius:22px 22px 0 0;box-shadow:0 -4px 0 var(--ink);padding:18px 24px 34px;display:flex;flex-direction:column;gap:12px}
.rule{height:2px;background:var(--ink);border-radius:2px}
.ledger{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:12px;padding:12px 0}
.row+.row{border-top:1.5px solid rgba(42,31,21,.3)}
.disc{width:40px;height:40px;border-radius:999px;border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;flex:none}
.words{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.value{font-family:'Patrick Hand',cursive;font-weight:400;font-size:14px;text-align:right;flex:none}
.scrim{position:absolute;inset:0;background:rgba(42,31,21,.55)}
.badge{position:absolute;top:-8px;right:-8px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--accent);color:var(--paper);border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}
/* the dig header (SnoutDeepPatch) */
.dighead{display:flex;align-items:flex-start;gap:10px}
.sign{flex:1;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
/* canvas notes */
.note{font-family:'Patrick Hand',cursive;font-weight:400;font-size:15px;line-height:20px;color:var(--mute);width:390px}
.note b{color:var(--ink);font-weight:400}
"""

def head(title):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <title>{title}</title>
  <style>{STYLE}</style>
</helmet>
"""

FOOT = """
</x-dc>
</body>
</html>
"""

# ── SVG marks: ink-outline sketches, 24-grid, stroke 2 ────────────────────────
def svg(paths, size=24, fill="none"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" '
            f'stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>')

MARK = {
  "truffle_d": svg('<path d="M5 13c0-4 3-7 7-7s7 3 7 7c0 3-2 5-4 5H9c-2 0-4-2-4-5z" fill="#d9b25a"/><path d="M9 11l1 1M14 10l1 1M12 14l1 1" /><path d="M17 5l.6 1.6L19 7l-1.4.5L17 9l-.6-1.5L15 7l1.4-.4z" fill="#ffd87a"/>'),
  "truffle_l": svg('<path d="M4 14c0-5 3.5-9 8-9s8 4 8 9c0 3-2 5-4 5H8c-2 0-4-2-4-5z" fill="#d9b25a"/><path d="M8 12l1 1M13 10l1 1M12 15l1 1M16 13l1 1"/><path d="M18 3l.6 1.6L20 5l-1.4.5L18 7l-.6-1.5L16 5l1.4-.4z" fill="#ffd87a"/>'),
  "boom": svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="3.5" fill="#ffd6dc"/>'),
  "pouch": svg('<path d="M8 8h8l3 8c0 3-2 5-7 5s-7-2-7-5z" fill="#c9905c"/><path d="M8 8c0-2 2-3 4-3s4 1 4 3M7 8h10"/><path d="M12 5V3"/>'),
  "apple": svg('<path d="M12 8c-1.5-1.5-4-1.5-5.5 0C4 10.5 5 16 8 19c1.5 1.5 2.5 1 4 0 1.5 1 2.5 1.5 4 0 3-3 4-8.5 1.5-11-1.5-1.5-4-1.5-5.5 0z" fill="#f8a8b3"/><path d="M12 8V5M12 5c1-1.5 2.5-2 4-1.5"/>'),
  "boot": svg('<path d="M8 4h6v9l5 3v4H6v-6l2-1z" fill="#c9905c"/><path d="M8 13h6M8 8h6"/>'),
  "horseshoe": svg('<path d="M6 19V11a6 6 0 0 1 12 0v8" /><path d="M6 19h3M15 19h3"/><circle cx="8" cy="11" r=".8" fill="#2a1f15"/><circle cx="16" cy="11" r=".8" fill="#2a1f15"/><circle cx="12" cy="6.5" r=".8" fill="#2a1f15"/>'),
  "cap": svg('<path d="M4.5 10.5l2-2.5 2.5 1 2-2 2 2 2.5-1 2 2.5 2.5.5-1 2.5 1 2.5-2.5.5-2 2.5-2.5-1-2 2-2-2-2.5 1-2-2.5-2.5-.5 1-2.5-1-2.5z" fill="#c8e3f0"/><circle cx="12" cy="12" r="3.5"/>'),
  "shimmer": svg('<path d="M12 3l7 7-7 11-7-11z" fill="#d6c8f0"/><path d="M5 10h14M12 3l-3 7 3 11 3-11z"/>'),
  "acorn": svg('<path d="M7 9c0-2 2-3 5-3s5 1 5 3H7z" fill="#c9905c"/><path d="M8 9c0 5 2 9 4 11 2-2 4-6 4-11" fill="#d9b25a"/><path d="M12 6V4"/><circle cx="16" cy="16" r="3" fill="#ffd87a"/><path d="M16 13v-1.5M16 20.5V19M13 16h-1.5M20.5 16H19"/>'),
  "tea": svg('<path d="M9 4h6v3l3 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8l3-3z" fill="#c8e3f0"/><path d="M6 12h12"/><path d="M9 7h6"/>'),
  "scroll": svg('<path d="M6 6a2 2 0 0 1 2-2h11v13a2 2 0 0 1-2 2H7" fill="#fffaf0"/><path d="M6 6v11a2 2 0 0 0 2 2h9"/><path d="M10 8h6M10 11h6M10 14h4"/>'),
  "relic": svg('<path d="M8 4h8v12l-4 5-4-5z" fill="#c9dec1"/><path d="M10 8h4M10 11h4M12 13v3"/>'),
  "furnishing": svg('<path d="M9 3h6l1 3H8z" fill="#ffd87a"/><path d="M8 6h8v10H8z" fill="#ffd87a"/><path d="M8 16l-1 3h10l-1-3"/><path d="M12 8v6"/><path d="M11 2h2"/>'),
  "bow": svg('<path d="M12 12c-3-4-7-5-8-3s2 6 8 3zM12 12c3-4 7-5 8-3s-2 6-8 3z" fill="#ffd6dc"/><circle cx="12" cy="12" r="2" fill="#f8a8b3"/><path d="M11 14l-2 6M13 14l2 6"/>'),
  "charm": svg('<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" fill="#d6c8f0"/><path d="M12 3v2"/>'),
  "stone": svg('<ellipse cx="12" cy="13" rx="9" ry="7" fill="#8c7e71"/>'),
  "bag": svg('<path d="M5 9h14l-1.5 11a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" fill="#c9905c"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/><path d="M5 12h14"/>'),
  "x": svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  "chev": svg('<path d="M9 6l6 6-6 6"/>'),
  "check": svg('<path d="M5 12l4 4 10-10"/>'),
  "shovel": svg('<path d="M12 3v9"/><path d="M9 3h6"/><path d="M8 12h8v3a4 4 0 0 1-8 0z" fill="#c8e3f0"/>'),
  "door": svg('<path d="M4 10L12 4l8 6v10H4z" fill="#e8b4a0"/><path d="M9 20v-8h6v8" fill="#c25a3f"/>'),
}

PAINTED = {"boom","pouch","apple","boot","horseshoe","cap","shimmer","acorn","tea","scroll","relic","furnishing","bow","charm","bag"}
def sized(mark, art):
    if mark in PAINTED:
        return '<img src="%s.png" width="%d" height="%d" style="display:block;width:%dpx;height:%dpx">' % (mark, art, art, art, art)
    if mark in ("truffle_d", "truffle_l"):
        return '<img src="truffle.png" width="%d" height="%d" style="display:block;width:%dpx;height:%dpx">' % (art, art, art, art)
    return MARK[mark].replace('width="24" height="24"', 'width="%d" height="%d"' % (art, art))

def disc(tone, mark, size=40, art=24):
    return ('<div class="disc" style="width:%dpx;height:%dpx;background:var(--%s)">%s</div>'
            % (size, size, tone, sized(mark, art)))

def write(name, body):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(head(name.replace(".dc.html", "")) + body + FOOT)

# ── shared fragments ──────────────────────────────────────────────────────────
def dig_header(closes="closes in 3h 16m"):
    return f"""
<div class="dighead">
  <div class="iconBtn">{MARK["x"]}</div>
  <div class="sticker sign">
    <div class="body">the truffle patch · Feeding</div>
    <div class="hand mute">{closes} · how it works ›</div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
    <div style="width:56px;height:56px;border-radius:999px;background:var(--rose);border:2px solid var(--ink)"></div>
    <div class="chip" style="padding:4px 10px"><span class="label">snoring</span></div>
  </div>
</div>"""

def verb_bar():
    return """
<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:12px">
  <div class="sticker" style="padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:40px;height:40px;border-radius:999px;background:var(--rose)"></div><div class="body">Sniff</div><div class="hand mute">quietest</div></div>
  <div class="sticker" style="padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--sun)"><div style="width:40px;height:40px;border-radius:999px;background:var(--paper)"></div><div class="body">Rub</div><div class="hand mute">quiet</div></div>
  <div class="sticker" style="padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:40px;height:40px;border-radius:999px;background:var(--sky)"></div><div class="body">Shove</div><div class="hand mute">loud</div></div>
</div>"""

def grid(rows=5, cols=6, cleared=()):
    cells = []
    for i in range(rows * cols):
        bg = "var(--paper)" if i in cleared else "var(--dirt2)"
        cells.append(f'<div style="aspect-ratio:1;border-radius:10px;background:{bg}"></div>')
    return (f'<div style="background:var(--dirt);border:2px solid var(--ink);border-radius:18px;padding:8px;'
            f'box-shadow:4px 4px 0 var(--ink);display:grid;grid-template-columns:repeat({cols}, minmax(0, 1fr));gap:6px">'
            + "".join(cells) + "</div>")

def pouch(loose_html, bag_html, bag_label="in the bag", bag_sub="yours already"):
    return f"""
<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px">
  <div class="stickerSm" style="padding:10px 12px;display:flex;flex-direction:column;gap:6px;border-style:dashed">
    <div class="hand mute"><b style="color:var(--ink);font-weight:400">loose</b> his if he wakes</div>
    <div style="display:flex;gap:6px;min-height:24px">{loose_html}</div>
  </div>
  <div class="stickerSm" style="padding:10px 12px;display:flex;flex-direction:column;gap:6px">
    <div class="hand mute"><b style="color:var(--ink);font-weight:400">{bag_label}</b> {bag_sub}</div>
    <div style="display:flex;gap:6px;min-height:24px">{bag_html}</div>
  </div>
</div>"""

def footer():
    return """
<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px">
  <div class="btn">Tie it off</div>
  <div class="btn">Dig deeper</div>
</div>"""

# ── 1. Main: the Bag sheet ────────────────────────────────────────────────────
def slot(mark, tone, name, count, sub):
    return f"""
  <div class="sticker" style="padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative">
    {disc(tone, mark, 40, 24)}
    <div class="cardTitleSm" style="text-align:center;line-height:18px">{name}</div>
    <div class="hand mute" style="text-align:center;font-size:12px;line-height:15px">{sub}</div>
    <div class="badge" style="background:var(--ink)">{count}</div>
  </div>"""

def kept(mark, tone, name, home):
    return f"""
  <div class="row" style="padding:8px 0">
    {disc(tone, mark, 32, 20)}
    <div class="words"><div class="body">{name}</div><div class="hand mute">{home}</div></div>
    <div class="value accent">{home.split(' ')[-1]} ›</div>
  </div>"""

MAIN = f"""
<div class="phone">
  <div style="position:absolute;inset:0;background:linear-gradient(#c8e3f0,#c9dec1 60%,#7d4f2a 92%)"></div>
  <div class="scrim"></div>
  <div class="sheet" style="position:absolute;left:0;right:0;bottom:0;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="kicker accent">the bag</div>
        <div class="pageTitle">What you dug up</div>
        <div class="hand mute">use a thing when you like — it keeps until you do.</div>
      </div>
      <div class="iconBtn">{MARK["x"]}</div>
    </div>
    <div class="rule"></div>
    <div class="kickerPill mute">to use · 6</div>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;padding:4px 4px 6px">
      {slot("boom","rose","Tickle Boom","2","fire · +19 tickles")}
      {slot("acorn","sun","Clockwork Acorn","1","wind · a day of auto")}
      {slot("tea","sky","warm tea","1","drink · 8 h warm")}
      {slot("apple","rose","windfall apple","3","feed Rosie · +8")}
      {slot("scroll","cream2","Pass XP scroll","1","read · +40 XP")}
      {slot("charm","lilac","bless charm","1","send · one free")}
    </div>
    <div class="kickerPill mute">kept · already home</div>
    <div class="ledger">
      {kept("boot","cream2","his old boot","on the shelf")}
      {kept("furnishing","sun","Rusty Lantern","in the Barn")}
      {kept("relic","sage","a clay snout","in the Burrow Book")}
      {kept("bow","rose","a buried bow","in the wardrobe")}
    </div>
    <div class="rule"></div>
    <div class="btn btnGold">Done</div>
  </div>
</div>
"""
write("Main.dc.html", MAIN)

# ── 2. Item detail ────────────────────────────────────────────────────────────
DETAIL = f"""
<div class="phone">
  <div style="position:absolute;inset:0;background:linear-gradient(#c8e3f0,#c9dec1 60%,#7d4f2a 92%)"></div>
  <div class="scrim"></div>
  <div class="sheet" style="position:absolute;left:0;right:0;bottom:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="kicker accent">the bag · to use</div>
        <div class="pageTitle">Tickle Boom</div>
        <div class="hand mute">you have two. one fires now, the other keeps.</div>
      </div>
      <div class="iconBtn">{MARK["x"]}</div>
    </div>
    <div style="display:flex;justify-content:center;padding:8px 0">{disc("rose","boom",120,72)}</div>
    <div class="rule"></div>
    <div class="ledger">
      <div class="row">{disc("sun","boom")}<div class="words"><div class="body">fires</div><div class="hand mute">+3 tickles, and more the further behind the leader you are</div></div><div class="value">+19 now</div></div>
      <div class="row">{disc("sage","check")}<div class="words"><div class="body">counts</div><div class="hand mute">toward today's tickle and the herd's race</div></div><div class="value">today</div></div>
      <div class="row">{disc("cream2","bag")}<div class="words"><div class="body">keeps</div><div class="hand mute">nothing spoils. fire it on a slow day</div></div><div class="value">forever</div></div>
    </div>
    <div class="rule"></div>
    <div class="btn btnGold btnLg">Fire one</div>
    <div class="handLink">keep it for now ›</div>
  </div>
</div>
"""
write("ItemDetail.dc.html", DETAIL)

# ── 3. Bag entry A — the Barn button's fan ────────────────────────────────────
def yard(children):
    return f"""
<div class="phone">
  <div style="position:absolute;inset:0;background:linear-gradient(#c8e3f0 0%,#dfe9d3 45%,#a9c58e 70%,#7d4f2a 92%)"></div>
  <div style="position:absolute;left:24px;top:70px" class="sticker"><div style="padding:10px 16px;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border-radius:999px;background:var(--rose)"></div><div><div class="numeral" style="font-size:24px">38</div><div class="kickerPill mute">tickled</div></div></div></div>
  <div style="position:absolute;right:20px;top:64px;width:104px;height:104px;border-radius:999px;background:var(--cream2);border:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="numeral" style="font-size:30px">8</div><div class="hand mute">of 25</div></div>
  <div style="position:absolute;left:80px;right:80px;top:300px;height:360px;border-radius:200px 200px 60px 60px;background:#f4c6c0;opacity:.7"></div>
  {children}
  <div style="position:absolute;left:0;right:0;bottom:0;height:110px;background:var(--bark)"></div>
</div>"""

FAN_A = yard(f"""
  <div style="position:absolute;right:20px;bottom:126px;display:flex;flex-direction:column;align-items:center;gap:10px">
    <div class="chip"><span class="body">bag</span>{disc("cream2","bag",32,20)}<div class="badge">3</div></div>
    <div class="chip"><span class="body">barn</span>{disc("cream2","door",32,20)}</div>
    <div class="chip" style="background:var(--sun)"><span class="body">dig</span>{disc("paper","shovel",32,20)}</div>
    <div style="width:72px;height:72px;border-radius:999px;background:var(--paper);border:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink);display:flex;align-items:center;justify-content:center;position:relative">{MARK["shovel"].replace('width="24" height="24"','width="40" height="40"')}<div class="badge">3</div></div>
  </div>
""")
write("BagEntryA.dc.html", FAN_A)

# ── 4. Bag entry B — a satchel hung in the yard ───────────────────────────────
FAN_B = yard(f"""
  <div style="position:absolute;left:22px;bottom:200px;display:flex;flex-direction:column;align-items:center;gap:4px">
    <div class="sticker" style="width:64px;height:64px;border-radius:999px;display:flex;align-items:center;justify-content:center;position:relative;transform:rotate(-4deg)">{MARK["bag"].replace('width="24" height="24"','width="36" height="36"')}<div class="badge">3</div></div>
    <div class="tag"><span class="kicker">bag</span></div>
  </div>
  <div style="position:absolute;right:20px;bottom:126px;width:72px;height:72px;border-radius:999px;background:var(--paper);border:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink);display:flex;align-items:center;justify-content:center">{MARK["shovel"].replace('width="24" height="24"','width="40" height="40"')}</div>
""")
write("BagEntryB.dc.html", FAN_B)

# ── 5. In the dig: a thing surfaces → into the bag ────────────────────────────
DIG_REVEAL = f"""
<div class="phone"><div class="page" style="gap:10px">
  {dig_header()}
  {verb_bar()}
  <div style="display:flex;gap:8px">
    <div class="chip" style="background:var(--sun);padding:4px 12px"><span class="label">topsoil</span></div>
    <div class="chip" style="background:var(--cream2);padding:4px 12px;box-shadow:none"><span class="label mute">the mud</span></div>
    <div class="chip" style="background:var(--cream2);padding:4px 12px;box-shadow:none"><span class="label mute">the root</span></div>
  </div>
  <div style="position:relative">
    {grid(cleared=(19,20,25,26))}
    <div class="sticker" style="position:absolute;left:12px;right:12px;top:40%;padding:12px 14px;display:flex;align-items:center;gap:12px;background:var(--rose);transform:rotate(-2deg)">
      {disc("paper","boom",48,28)}
      <div class="words"><div class="cardTitle">a Tickle Boom</div><div class="hand mute">into the bag · fire it when you like</div></div>
      {MARK["bag"]}
    </div>
  </div>
  <div class="sticker" style="padding:10px 12px"><div class="hand">a 3 beside a 1 — the truffle runs one way. follow the bigger number.</div></div>
  {pouch("", disc("rose","boom",24,14) + disc("cream2","boot",24,14))}
  {footer()}
</div></div>
"""
write("DigReveal.dc.html", DIG_REVEAL)

# ── 6. Dismiss: the leave sheet ───────────────────────────────────────────────
LEAVE = f"""
<div class="phone"><div class="page" style="gap:10px">
  {dig_header()}
  {verb_bar()}
  <div style="display:flex;gap:8px"><div class="chip" style="background:var(--sun);padding:4px 12px"><span class="label">topsoil</span></div></div>
  {grid(cleared=(19,20,25,26,27))}
  <div class="scrim"></div>
  <div class="sheet" style="position:absolute;left:0;right:0;bottom:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="kicker accent">leaving the patch</div>
        <div class="pageTitle">Your dig waits here.</div>
        <div class="hand mute">nothing is lost by leaving. the patch closes in 3h 16m.</div>
      </div>
      <div class="iconBtn">{MARK["x"]}</div>
    </div>
    <div class="rule"></div>
    <div class="ledger">
      <div class="row">{disc("sun","truffle_d")}<div class="words"><div class="body">a truffle, loose</div><div class="hand mute">stays loose. he keeps sleeping while you're away</div></div><div class="value">waits</div></div>
      <div class="row">{disc("rose","bag")}<div class="words"><div class="body">2 things in the bag</div><div class="hand mute">a Tickle Boom, his old boot — yours already</div></div><div class="value">kept</div></div>
      <div class="row">{disc("cream2","x")}<div class="words"><div class="body">if the patch closes first</div><div class="hand mute">the dig ties itself off where you left it</div></div><div class="value">tie</div></div>
    </div>
    <div class="rule"></div>
    <div class="btn btnGold btnLg">Keep digging</div>
    <div class="handLink">leave for now ›</div>
  </div>
</div></div>
"""
write("LeaveSheet.dc.html", LEAVE)

# ── 7. The receipt, with the bag line ────────────────────────────────────────
RECEIPT = f"""
<div class="phone">
  <div style="position:absolute;inset:0;background:var(--cream)"></div>
  <div class="scrim"></div>
  <div class="sheet" style="position:absolute;left:0;right:0;bottom:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="kicker accent">the truffle patch</div>
        <div class="pageTitle">Tied off at the mud</div>
        <div class="hand mute">two layers · 23 actions · he slept through it</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="ledger">
      <div class="row">{disc("sun","truffle_l")}<div class="words"><div class="body">two truffles</div><div class="hand mute">the herd's — +2 Golden Truffles</div></div><div class="value">+2 GT</div></div>
      <div class="row">{disc("rose","boom")}<div class="words"><div class="body">a Tickle Boom</div><div class="hand mute">into the bag</div></div><div class="value">bag</div></div>
      <div class="row">{disc("sun","acorn")}<div class="words"><div class="body">a Clockwork Acorn</div><div class="hand mute">into the bag</div></div><div class="value">bag</div></div>
      <div class="row">{disc("cream2","boot")}<div class="words"><div class="body">his old boot</div><div class="hand mute">on the shelf, in the Barn</div></div><div class="value">shelf</div></div>
      <div class="row">{disc("lilac","shimmer")}<div class="words"><div class="body">a shimmer pocket</div><div class="hand mute">+1 Mote, straight to your count</div></div><div class="value">+1</div></div>
      <div class="row">{disc("sage","check")}<div class="words"><div class="body">Pass XP</div><div class="hand mute">for the dig</div></div><div class="value">+20</div></div>
    </div>
    <div class="rule"></div>
    <div class="btn btnGold btnLg">Back to the Barn</div>
    <div class="handLink">share the dig ›</div>
  </div>
</div>
"""
write("Receipt.dc.html", RECEIPT)

# ── 8. Back on the Barn: the bag badge ────────────────────────────────────────
AFTER = yard(f"""
  <div style="position:absolute;left:18px;right:18px;top:170px" class="sticker"><div style="padding:10px 14px;display:flex;align-items:center;gap:10px">{disc("rose","bag",32,20)}<div class="words"><div class="body">2 things in the bag</div><div class="hand mute">a Tickle Boom, a Clockwork Acorn · tap to use</div></div>{MARK["chev"]}</div></div>
  <div style="position:absolute;right:20px;bottom:126px;width:72px;height:72px;border-radius:999px;background:var(--cream2);border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;position:relative">{MARK["door"].replace('width="24" height="24"','width="40" height="40"')}<div class="badge">2</div></div>
  <div style="position:absolute;right:104px;bottom:150px" class="tag"><span class="kicker">dug this Feeding · tied at the mud</span></div>
""")
write("BarnAfter.dc.html", AFTER)

# ── 9. The find icon sheet ────────────────────────────────────────────────────
FINDS = [
 ("truffle_d","sun","domino truffle","topsoil · food","a lumpy two-lobed truffle, one gold sparkle"),
 ("truffle_l","sun","the fat one","mud · food","the same truffle, fatter, three lobes"),
 ("boom","rose","Tickle Boom","topsoil · use","a rose burst, hand-drawn rays, a little pop"),
 ("pouch","cream2","snout pouch","topsoil · counts","a drawstring leather pouch, snout stamp"),
 ("apple","rose","windfall apple","topsoil · use","a bruised windfall apple, one leaf"),
 ("boot","cream2","his old boot","topsoil · shelf","a muddy work boot, laces undone"),
 ("horseshoe","cream2","bent horseshoe","topsoil · shelf","an iron horseshoe, one bent heel"),
 ("cap","sky","bottle cap","topsoil · shelf","a crimped bottle cap, faded print"),
 ("shimmer","lilac","shimmer pocket","mud · counts","a lilac gem in a pocket of dirt"),
 ("acorn","sun","Clockwork Acorn","mud · use","an acorn with a brass wind-up key"),
 ("tea","sky","flask of warm tea","mud · use","a stoppered flask, steam curl"),
 ("scroll","cream2","Pass XP scroll","mud · use","a rolled scroll, wax seal"),
 ("relic","sage","relic","root · Burrow Book","a clay tablet with a snout carved in"),
 ("furnishing","sun","Unearthed furnishing","root · Barn","a rusty lantern (one of ~12 pieces)"),
 ("bow","rose","a buried bow","root · wardrobe","a ribbon bow, a little earth on it"),
 ("charm","lilac","bless charm","root · use","a heart-shaped charm on a loop"),
 ("stone","cream2","stone","any · inert","an ink pebble — the one hand-cut shape"),
]
cards = "".join(f"""
  <div class="sticker" style="padding:14px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
    {disc(tone, k, 72, 44)}
    <div style="display:flex;gap:6px">{disc(tone,k,40,24)}{disc(tone,k,24,14)}</div>
    <div class="cardTitleSm">{name}</div>
    <div class="kicker mute">{where}</div>
    <div class="hand" style="color:var(--mute)">{brief}</div>
  </div>""" for k,tone,name,where,brief in FINDS)
ICONS = f"""
<div style="width:1180px;background:var(--cream);padding:32px;display:flex;flex-direction:column;gap:20px">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div class="kicker accent">the finds · icon sheet</div>
    <div class="pageTitle">Seventeen things you can dig up</div>
    <div class="hand mute" style="max-width:820px">every find gets its own mark — today five of them borrow other glyphs (a heart for the apple, a gear for the acorn, a coffee for the tea, a trophy for the relic, a gift for the pouch). one style for the set: flat sticker, 2px ink outline, the pastel disc behind it is the layer's tone. three sizes: 72 (reveal · detail), 40 (bag slot · ledger row), 24 (pouch · tile). these are sketches for the ImageGen lane; the brief under each is the prompt seed.</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:16px">{cards}</div>
</div>
"""
write("FindIcons.dc.html", ICONS)

# ── 10. The flow ──────────────────────────────────────────────────────────────
def box(title, sub, tone="paper", w=170):
    return (f'<div class="sticker" style="width:{w}px;padding:12px 14px;background:var(--{tone});display:flex;flex-direction:column;gap:2px">'
            f'<div class="cardTitleSm">{title}</div><div class="hand mute">{sub}</div></div>')
ARROW = '<div style="display:flex;align-items:center;color:var(--ink)"><svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h34M30 6l6 6-6 6"/></svg></div>'
FLOW = f"""
<div style="width:1180px;background:var(--cream);padding:32px;display:flex;flex-direction:column;gap:24px">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div class="kicker accent">the flow</div>
    <div class="pageTitle">Dig → bag → use</div>
    <div class="hand mute">things stop applying themselves the moment they surface. they go into the bag; the player spends them when it suits. currencies (snouts, motes) and homes (shelf, Barn, Burrow Book, wardrobe) still land directly — the bag's kept shelf is the record and the door.</div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    {box("Barn button","fan: dig · barn · bag")}{ARROW}{box("the dig","full screen, slides up")}{ARROW}{box("a thing surfaces","reveal sticker: into the bag","rose")}{ARROW}{box("tie / wake / cap","the receipt, every find with its destination")}{ARROW}{box("Back to the Barn","bag badge counts the new things","sun")}
  </div>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    {box("X mid-dig","0 actions → just closes","cream2")}{ARROW}{box("Leave the patch?","only with actions: waits · kept · closes-first tie","cream2")}{ARROW}{box("leave for now","snapshot + sync; Barn button says 'dig waits'","cream2")}{ARROW}{box("press dig again","restores where you left it","cream2")}
  </div>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    {box("bag","to use · kept","sun")}{ARROW}{box("item detail","what it does · Fire one / keep it")}{ARROW}{box("used","the same reveal grammar: +19 tickles, yours","rose")}{ARROW}{box("kept row","tap → the shelf / Barn / Burrow Book / wardrobe")}
  </div>
  <div class="hand mute" style="max-width:900px">what changes in the game: the Boom's auto-apply rule, the acorn's contraption charge, the tea blessing, the apple's happiness and the scroll's XP all move from <b style="color:var(--ink);font-weight:400">reveal</b> to <b style="color:var(--ink);font-weight:400">use</b>. one new table, `bag_items(uid, kind, count, source)`, one RPC `use_bag_item(kind)` that does what the reveal used to do.</div>
</div>
"""
write("Flow.dc.html", FLOW)
print("ok")

# ═════════════════════════════════════════════════════════════════════════════
# THE TALLY — every find is worth tickles; the reward ticks up after the dig.
# ═════════════════════════════════════════════════════════════════════════════
def hero_count(n, sub="tickled", size=44):
    return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:0">'
            f'<div style="font-family:\'Fredoka\',sans-serif;font-weight:700;font-size:{size}px;line-height:{size+4}px">{n}</div>'
            f'<div class="kickerPill mute">{sub}</div></div>')

def tally_row(mark, tone, name, sub, val, landed=True):
    op = "1" if landed else ".35"
    return (f'<div class="row" style="opacity:{op}">{disc(tone, mark)}'
            f'<div class="words"><div class="body">{name}</div><div class="hand mute">{sub}</div></div>'
            f'<div class="numeral" style="color:var(--accent)">+{val}</div></div>')

# A — the receipt is the tally: rows land one by one, the count ticks at the top
TALLY_A = f"""
<div class="phone">
  <div style="position:absolute;inset:0;background:var(--cream)"></div>
  <div class="scrim"></div>
  <div class="sheet" style="position:absolute;left:0;right:0;bottom:0;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="kicker accent">the truffle patch · tied at the mud</div>
        <div class="pageTitle">What the dig was worth</div>
        <div class="hand mute">each thing lands, the count ticks. 23 actions · he slept through it.</div>
      </div>
    </div>
    <div class="sticker" style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:var(--sun)">
      {hero_count("38", "before")}
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h34M30 6l6 6-6 6"/></svg>
      {hero_count("105", "tickled now")}
    </div>
    <div class="rule"></div>
    <div class="ledger">
      {tally_row("truffle_d","sun","a truffle","the herd's too — +1 Golden Truffle","10")}
      {tally_row("boom","rose","a Tickle Boom","the catch-up: 3 + 16 for the gap","19")}
      {tally_row("boot","cream2","his old boot","on the shelf as well","3")}
      {tally_row("shimmer","lilac","a shimmer pocket","+1 Mote as well","8")}
      {tally_row("truffle_l","sun","the fat one","+1 Golden Truffle","15")}
      {tally_row("acorn","sun","a Clockwork Acorn","a day of Auto-Tickler as well","12")}
    </div>
    <div class="rule"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="body">the dig</div><div class="numeral accent" style="font-size:22px">+67</div></div>
    <div class="btn btnGold btnLg">Back to the Barn</div>
    <div class="handLink">share the dig ›</div>
  </div>
</div>
"""
write("TallyA.dc.html", TALLY_A)

# B — no sheet: back on the Barn, the finds tumble out and the stamp ticks up
TALLY_B = yard(f"""
  <div style="position:absolute;left:18px;top:64px" class="sticker"><div style="padding:10px 16px;display:flex;align-items:center;gap:12px;background:var(--sun)"><div style="width:22px;height:22px;border-radius:999px;background:var(--rose);border:2px solid var(--ink)"></div>{hero_count("57","tickled",32)}<div class="chip" style="padding:2px 8px;background:var(--rose)"><span class="numeral">+19</span></div></div></div>
  <div style="position:absolute;left:60px;top:250px;display:flex;flex-direction:column;gap:14px;align-items:flex-start">
    <div class="chip" style="background:var(--paper);transform:rotate(-6deg);opacity:.5">{sized("truffle_d",20)}<span class="hand">a truffle · +10</span></div>
    <div class="chip" style="background:var(--rose);transform:rotate(3deg);margin-left:120px">{sized("boom",20)}<span class="hand">a Tickle Boom · +19</span></div>
    <div class="chip" style="background:var(--cream2);transform:rotate(-2deg);margin-left:40px;opacity:.35">{sized("boot",20)}<span class="hand">his old boot · +3</span></div>
    <div class="chip" style="background:var(--lilac);transform:rotate(4deg);margin-left:150px;opacity:.35">{sized("shimmer",20)}<span class="hand">a shimmer pocket · +8</span></div>
  </div>
  <div style="position:absolute;left:150px;top:520px;display:flex;gap:10px">
    <div style="font-family:'Patrick Hand',cursive;font-size:22px;color:var(--accent);transform:rotate(-8deg)">+19</div>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffd6dc" stroke="#2a1f15" stroke-width="2"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>
  </div>
  <div style="position:absolute;left:18px;right:18px;bottom:130px" class="tag"><span class="kicker">4 of 6 things · tap to hurry</span></div>
  <div style="position:absolute;right:20px;bottom:126px;width:72px;height:72px;border-radius:999px;background:var(--cream2);border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;position:relative">{sized("door",40)}</div>
""")
write("TallyB.dc.html", TALLY_B)

# C — the weigh-in (low-fi): a hanging scale in the Barn door; the pan fills, the needle climbs
TALLY_C = f"""
<div class="phone"><div class="page" style="gap:14px;align-items:center;justify-content:center">
  <div class="kicker accent">the weigh-in · low-fi</div>
  <div class="pageTitle" style="text-align:center">What did you bring back?</div>
  <div style="width:300px;height:360px;position:relative">
    <div style="position:absolute;left:0;right:0;top:0;height:8px;background:var(--bark);border-radius:4px"></div>
    <div style="position:absolute;left:149px;top:8px;width:2px;height:120px;background:var(--ink)"></div>
    <div style="position:absolute;left:30px;right:30px;top:128px;height:110px;border:2px solid var(--ink);border-radius:0 0 120px 120px;background:var(--cream2);box-shadow:4px 4px 0 var(--ink);display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;justify-content:center;padding:20px 40px 30px">{disc("sun","truffle_d",40,24)}{disc("rose","boom",40,24)}{disc("cream2","boot",40,24)}{disc("lilac","shimmer",40,24)}</div>
    <div style="position:absolute;left:60px;right:60px;top:260px" class="sticker"><div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center"><div class="hand mute">the pan reads</div>{hero_count("+40","tickles",32)}</div></div>
    <div class="chip" style="position:absolute;left:190px;top:60px;background:var(--sun)"><span class="hand">the fat one next</span></div>
  </div>
  <div class="hand mute" style="text-align:center;width:300px">things drop in one at a time; the needle swings, the number climbs. the Barn stamp ticks up when you leave.</div>
  <div class="btn btnGold" style="width:220px">Take it to the Barn</div>
</div></div>
"""
write("TallyC.dc.html", TALLY_C)

# D — the stamp (low-fi): finds laid out as priced stickers, then one stamp slams the total
TALLY_D = f"""
<div class="phone"><div class="page" style="gap:12px;justify-content:center">
  <div class="kicker accent">the stamp · low-fi</div>
  <div class="pageTitle">The dig, priced.</div>
  <div class="sticker" style="padding:14px;display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;background:var(--paper)">
    {''.join(f'<div class="stickerSm" style="padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;transform:rotate({r}deg)">{disc(t,k,40,24)}<div class="hand">{n}</div><div class="numeral accent">+{v}</div></div>' for k,t,n,v,r in [("truffle_d","sun","a truffle",10,-3),("boom","rose","Tickle Boom",19,2),("boot","cream2","his old boot",3,-1),("shimmer","lilac","shimmer pocket",8,3),("truffle_l","sun","the fat one",15,-2),("acorn","sun","Clockwork Acorn",12,1)])}
  </div>
  <div style="display:flex;justify-content:center;margin-top:-30px">
    <div style="width:170px;height:170px;border-radius:999px;border:6px double var(--accent);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-12deg);background:rgba(255,250,240,.7)">
      <div style="font-family:'Fredoka',sans-serif;font-weight:700;font-size:54px;line-height:56px;color:var(--accent)">+67</div>
      <div class="kickerPill accent">tickled</div>
    </div>
  </div>
  <div class="hand mute" style="text-align:center">the stickers lay down one by one, priced. then the stamp slams the total and the Barn count ticks up under it.</div>
  <div class="btn btnGold">Back to the Barn</div>
</div></div>
"""
write("TallyD.dc.html", TALLY_D)

# The value table
VALUES = [
 ("truffle_d","sun","a truffle","topsoil","10","also +1 GT, the herd's"),
 ("boom","rose","Tickle Boom","topsoil","3 + gap","the catch-up formula, 19 for a player 4 days behind"),
 ("pouch","cream2","snout pouch","topsoil","5","also +15 snouts"),
 ("apple","rose","windfall apple","topsoil","4","also Rosie +8 happiness"),
 ("boot","cream2","boot · horseshoe · cap","topsoil","3","also a shelf keepsake; dupes +10 snouts"),
 ("truffle_l","sun","the fat one","mud","15","also +1 GT"),
 ("shimmer","lilac","shimmer pocket","mud","8","also +1 Mote"),
 ("acorn","sun","Clockwork Acorn","mud","12","also a day of Auto-Tickler"),
 ("tea","sky","flask of warm tea","mud","8","also warm_tea, 8 h"),
 ("scroll","cream2","Pass XP scroll","mud","10","also +40 Pass XP"),
 ("relic","sage","relic","root","15","also the Burrow Book"),
 ("furnishing","sun","Unearthed furnishing","root","20","also a Barn piece"),
 ("bow","rose","a buried bow","root","25","also a cosmetic"),
 ("charm","lilac","bless charm","root","12","also one free blessing"),
 ("stone","cream2","stone","any","0","inert — it just says so"),
]
vrows = "".join(f'<div class="row" style="padding:8px 0">{disc(t,k,32,20)}<div class="words"><div class="body">{n}</div><div class="hand mute">{extra}</div></div><div class="kicker mute" style="width:60px">{layer}</div><div class="numeral accent" style="width:64px;text-align:right">+{v}</div></div>' for k,t,n,layer,v,extra in VALUES)
TALLY_VALUES = f"""
<div style="width:560px;background:var(--cream);padding:28px;display:flex;flex-direction:column;gap:12px">
  <div class="kicker accent">the values · a first table</div>
  <div class="pageTitle">Everything pays tickles</div>
  <div class="hand mute">the layer sets the band — topsoil 3–10, the mud 8–15, the root 12–25. whatever a thing also does (a shelf piece, a blessing, XP) is a bonus on top, never instead. a full tied dig at the root reads +60 to +90; a topsoil tie +15 to +35. these are placeholders to tune against the catch-up (spec §4), not final.</div>
  <div class="rule"></div>
  <div class="ledger">{vrows}</div>
  <div class="rule"></div>
  <div class="hand mute">server: one column, `dig_finds.tickles`, applied by `submit_rooting_deep` through the same tickle ledger as a tap; the client gets the per-find values back on the receipt so the tally can count them up.</div>
</div>
"""
write("TallyValues.dc.html", TALLY_VALUES)

# ═════════════════════════════════════════════════════════════════════════════
# VARIANTS ON A — the tally receipt
# ═════════════════════════════════════════════════════════════════════════════
MARK["heart"] = svg('<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" fill="#ffd6dc"/>')
MARK["pig"] = svg('<circle cx="12" cy="12" r="9" fill="#f8c9c9"/><ellipse cx="12" cy="14" rx="4" ry="3" fill="#f2a5b0"/><circle cx="10.5" cy="14" r=".7" fill="#2a1f15"/><circle cx="13.5" cy="14" r=".7" fill="#2a1f15"/><path d="M8 10.5l1-1M16 10.5l-1-1"/><path d="M6 6l2 3M18 6l-2 3"/>')

def sheet_head(kicker, title, sub, close=False):
    x = f'<div class="iconBtn">{MARK["x"]}</div>' if close else ""
    return f"""<div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="kicker accent">{kicker}</div>
        <div class="pageTitle">{title}</div>
        <div class="hand mute">{sub}</div>
      </div>{x}</div>"""

def sheet(inner, extra=""):
    return f"""
<div class="phone">
  <div style="position:absolute;inset:0;background:var(--cream)"></div>
  <div class="scrim"></div>
  <div class="sheet" style="position:absolute;left:0;right:0;bottom:0;gap:10px;{extra}">{inner}</div>
</div>"""

def odometer(n, size=44):
    tiles = "".join(f'<div style="width:{size*0.72:.0f}px;height:{size+8}px;border:2px solid var(--ink);border-radius:8px;background:var(--paper);display:flex;align-items:center;justify-content:center;font-family:\'Fredoka\',sans-serif;font-weight:700;font-size:{size}px;box-shadow:inset 0 -6px 0 rgba(42,31,21,.12)">{d}</div>' for d in str(n))
    return f'<div style="display:flex;gap:4px">{tiles}</div>'

ROWS_LANDED = [("truffle_d","sun","a truffle","the herd's too — +1 Golden Truffle","10"),
               ("boom","rose","a Tickle Boom","the catch-up: 3 + 16 for the gap","19"),
               ("boot","cream2","his old boot","on the shelf as well","3"),
               ("shimmer","lilac","a shimmer pocket","+1 Mote as well","8")]
ROWS_WAITING = [("truffle_l","sun","the fat one","+1 Golden Truffle","15"),
                ("acorn","sun","a Clockwork Acorn","a day of Auto-Tickler as well","12")]
def rows(landed=ROWS_LANDED, waiting=ROWS_WAITING):
    return "".join(tally_row(*r) for r in landed) + "".join(tally_row(*r, landed=False) for r in waiting)

# A1 — by layer: the descent told in three bands, each with its own subtotal
def band(name, total, live, inner):
    op = "1" if live else ".35"
    return f"""<div style="opacity:{op}"><div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0 0"><div class="kickerPill mute">{name}</div><div class="numeral">{total}</div></div>{inner}</div>"""
A1 = sheet(
  sheet_head("the truffle patch · tied at the mud", "What the dig was worth", "layer by layer, the way you dug it.") +
  f"""<div class="sticker" style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:var(--sun)">{hero_count("38","before")}<svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h34M30 6l6 6-6 6"/></svg>{hero_count("78","tickled now")}</div>
  <div class="rule"></div>
  {band("topsoil", "+32", True, "<div class='ledger'>" + "".join(tally_row(*r) for r in ROWS_LANDED[:3]) + "</div>")}
  {band("the mud", "+8 …", True, "<div class='ledger'>" + tally_row(*ROWS_LANDED[3]) + "".join(tally_row(*r, landed=False) for r in ROWS_WAITING) + "</div>")}
  {band("the root", "not this time", False, "<div class='hand mute' style='padding:4px 0 8px'>you tied off at the mud. the root pays 12–25 a thing.</div>")}
  <div class="rule"></div>
  <div class="btn btnGold btnLg" style="opacity:.5">Back to the Barn</div>""")
A1 = A1.replace('class="row" style="opacity:1"', 'class="row" style="opacity:1;padding:7px 0"').replace('class="row" style="opacity:.35"', 'class="row" style="opacity:.35;padding:7px 0"')
write("VariantA1.dc.html", A1)

# A2 — the stamp is the counter: no top hero; each +n flies down into the Barn's own TICKLED stamp at the foot
A2 = sheet(
  sheet_head("the truffle patch · tied at the mud", "Into the count", "every thing you dug is a tickle or ten. watch them land.") +
  f"""<div class="rule"></div>
  <div class="ledger">{rows()}</div>
  <div style="position:relative;height:36px"><div style="position:absolute;left:180px;top:-18px;display:flex;gap:6px;align-items:center;transform:rotate(-10deg)">{sized("heart",22)}<span class="numeral accent">+8</span></div></div>
  <div class="sticker" style="padding:14px 18px;display:flex;align-items:center;gap:14px;background:var(--rose);align-self:center;transform:rotate(-2deg)">
    <div style="width:26px;height:26px;border-radius:999px;background:var(--paper);border:2px solid var(--ink);display:flex;align-items:center;justify-content:center">{sized("heart",16)}</div>
    {hero_count("74","tickled",40)}
  </div>
  <div class="hand mute" style="text-align:center">the same stamp as the Barn's — it goes home with this number.</div>
  <div class="btn btnGold btnLg" style="opacity:.5">Back to the Barn</div>""")
write("VariantA2.dc.html", A2)

# A3 — the odometer: digit reels roll; each row shows its share of the dig as a little bar
def bar_row(mark, tone, name, val, share, landed=True):
    op = "1" if landed else ".35"
    return f"""<div class="row" style="opacity:{op};padding:10px 0">{disc(tone, mark)}<div class="words"><div class="body">{name}</div><div style="height:8px;border:1.5px solid var(--ink);border-radius:999px;background:var(--paper);overflow:hidden"><div style="width:{share}%;height:100%;background:var(--accent)"></div></div></div><div class="numeral" style="color:var(--accent);width:44px;text-align:right">+{val}</div></div>"""
A3 = sheet(
  sheet_head("the truffle patch · tied at the mud", "The count rolls", "23 actions · he slept through it") +
  f"""<div style="display:flex;justify-content:center;align-items:flex-end;gap:12px;padding:6px 0">{odometer("74")}<div class="kickerPill mute" style="padding-bottom:8px">tickled</div></div>
  <div class="rule"></div>
  <div class="ledger">
    {bar_row("truffle_d","sun","a truffle","10",28)}{bar_row("boom","rose","a Tickle Boom","19",53)}{bar_row("boot","cream2","his old boot","3",8)}{bar_row("shimmer","lilac","a shimmer pocket","8",22)}{bar_row("truffle_l","sun","the fat one","15",42,False)}{bar_row("acorn","sun","a Clockwork Acorn","12",33,False)}
  </div>
  <div class="rule"></div>
  <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="hand mute">the dig · your best this week</div><div class="numeral accent" style="font-size:22px">+67</div></div>
  <div class="btn btnGold btnLg" style="opacity:.5">Back to the Barn</div>""")
write("VariantA3.dc.html", A3)

# A4 — Rosie takes the tickles: the count sits on her face; each row that lands tickles her
A4 = sheet(
  sheet_head("the truffle patch · tied at the mud", "Rosie gets the lot", "every find is a tickle. she counts them for you.") +
  f"""<div style="display:flex;align-items:center;gap:16px;justify-content:center;padding:4px 0">
    <div style="position:relative">{disc("rose","pig",96,64)}<div style="position:absolute;right:-10px;top:-6px;transform:rotate(12deg)">{sized("heart",28)}</div><div style="position:absolute;left:-14px;bottom:4px;transform:rotate(-12deg)">{sized("heart",20)}</div></div>
    <div style="display:flex;flex-direction:column"><div style="font-family:'Fredoka',sans-serif;font-weight:700;font-size:44px;line-height:48px">74</div><div class="kickerPill mute">tickled</div><div class="hand accent">+36 from the dig</div></div>
  </div>
  <div class="rule"></div>
  <div class="ledger">{rows()}</div>
  <div class="rule"></div>
  <div class="hand mute" style="text-align:center">she laughs on the last one.</div>
  <div class="btn btnGold btnLg" style="opacity:.5">Back to the Barn</div>""")
write("VariantA4.dc.html", A4)

# A5 — two beats: the finds first (what), then the number (how much), one sheet that flips
A5 = sheet(
  sheet_head("the truffle patch · tied at the mud", "You brought back six", "tap to count them up ›") +
  f"""<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;padding:6px 0">
    {''.join(f'<div class="stickerSm" style="padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;transform:rotate({r}deg)">{disc(t,k,48,28)}<div class="hand" style="text-align:center">{n}</div></div>' for k,t,n,r in [("truffle_d","sun","a truffle",-3),("boom","rose","a Tickle Boom",2),("boot","cream2","his old boot",-1),("shimmer","lilac","shimmer pocket",3),("truffle_l","sun","the fat one",-2),("acorn","sun","Clockwork Acorn",1)])}
  </div>
  <div class="rule"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;opacity:.35"><div class="hand mute">then the second beat: prices roll in, the count ticks 38 → 74</div>{odometer("38",28)}</div>
  <div class="btn btnGold btnLg">Count them up</div>""")
write("VariantA5.dc.html", A5)

# A when he woke — the tally still ticks for what's kept; the truffle row reads his
A_WOKE = sheet(
  sheet_head("the truffle patch · he woke at the mud", "He woke. Still worth it.", "the things are yours. the loose truffle was his.") +
  f"""<div class="sticker" style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:var(--cream2)">{hero_count("38","before")}<svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h34M30 6l6 6-6 6"/></svg>{hero_count("68","tickled now")}</div>
  <div class="rule"></div>
  <div class="ledger">
    <div class="row">{disc("roseDeep","truffle_l")}<div class="words"><div class="body">the fat one</div><div class="hand mute">his — comes back gilded next Feeding</div></div><div class="numeral mute">his</div></div>
    {tally_row("truffle_d","sun","a truffle","banked before he woke","10")}{tally_row("boom","rose","a Tickle Boom","the catch-up","19")}{tally_row("boot","cream2","his old boot","on the shelf as well","3")}{tally_row("shimmer","lilac","a shimmer pocket","+1 Mote as well","8")}{tally_row("acorn","sun","a Clockwork Acorn","a day of Auto-Tickler as well","12")}
  </div>
  <div class="rule"></div>
  <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="body">the dig</div><div class="numeral accent" style="font-size:22px">+52</div></div>
  <div class="btn btnGold btnLg">Back to the Barn</div>
  <div class="handLink">next time — tie it at the mud?</div>""")
write("VariantAWoke.dc.html", A_WOKE)


# ── The painted marks: the ImageGen set, keyed and sized ─────────────────────
PAINTED_ROWS = [("truffle_d","sun","truffle","the one glyph that already existed — the style anchor"),
 ("boom","rose","Tickle Boom","topsoil"),("pouch","cream2","snout pouch","topsoil"),("apple","rose","windfall apple","topsoil"),
 ("boot","cream2","his old boot","topsoil"),("horseshoe","cream2","bent horseshoe","topsoil"),("cap","sky","bottle cap","topsoil"),
 ("shimmer","lilac","shimmer pocket","the mud"),("acorn","sun","Clockwork Acorn","the mud"),("tea","sky","flask of warm tea","the mud"),("scroll","cream2","Pass XP scroll","the mud"),
 ("relic","sage","relic","the root"),("furnishing","sun","Unearthed furnishing","the root"),("bow","rose","a buried bow","the root"),("charm","lilac","bless charm","the root"),
 ("bag","cream2","the bag","the satchel, for the Barn button")]
pcards = "".join(f"""
  <div class="sticker" style="padding:14px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
    {sized(k, 96)}
    <div style="display:flex;gap:8px;align-items:center">{disc(t,k,40,26)}{disc(t,k,24,16)}{sized(k,24)}</div>
    <div class="cardTitleSm">{n}</div>
    <div class="kicker mute">{w}</div>
  </div>""" for k,t,n,w in PAINTED_ROWS)
PAINTED_SHEET = f"""
<div style="width:1180px;background:var(--cream);padding:32px;display:flex;flex-direction:column;gap:20px">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div class="kicker accent">the finds · painted</div>
    <div class="pageTitle">The set, from the ImageGen lane</div>
    <div class="hand mute" style="max-width:820px">one prompt per thing, the truffle glyph attached as the style anchor, backgrounds keyed. shown at 96, on the layer's disc at 40 and 24, and bare at 24. stone stays the hand-cut ink pebble. these are review candidates — redo any with a note.</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:16px">{pcards}</div>
</div>
"""
write("PaintedMarks.dc.html", PAINTED_SHEET)
