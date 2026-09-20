#!/usr/bin/env python3
"""The Ghost Sheep Trader, developed — today's sheet beside four aspects, as one
comparison artifact.  Run from the repo root:
    python3 docs/design/claude-design/trader-2026-09-20/gen.py --artifact <outdir>
Reuses the Me round's CSS (docs/design/claude-design/me-2026-09-20/gen.py) so the
two artifacts read as one series. Every colour / size is a token from tokens.css.
"""
import os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, "..", "..", "..", ".."))
ME = open(os.path.join(REPO, "docs/design/claude-design/me-2026-09-20/gen.py")).read()
CSS = re.search(r'\nCSS = """(.*?)"""\n', ME, re.S).group(1)
PAGE_CSS = re.search(r'\n    PAGE_CSS = """(.*?)"""\n', ME, re.S).group(1)

ART_SRC = {
    "trader":   ("assets/images/trader/ghost_sheep.png", 240),
    "rosie":    ("assets/images/sprites/rosie/idle_1.png", 220),
    "rosie_walk": ("assets/images/sprites/rosie/walk_2.png", 220),
    "bandit":   ("assets/images/sprites/bandit/face_1.png", 96),
    "pepper":   ("assets/images/sprites/pepper/face_1.png", 96),
    "feather":  ("assets/images/glyphs/finds/blue_feather.png", 96),
    "whistle":  ("assets/images/glyphs/finds/tin_whistle.png", 96),
    "pebble":   ("assets/images/glyphs/finds/river_pebble.png", 96),
    "clover":   ("assets/images/glyphs/finds/clover.png", 96),
    "scarf":    ("assets/images/glyphs/scarf.png", 96),
    "clipboard":("assets/images/glyphs/clipboard.png", 96),
    "yard":     ("assets/images/backgrounds/homestead_barn.jpg", 800),
}
def export_assets(outdir):
    os.makedirs(outdir, exist_ok=True)
    for k, (path, size) in ART_SRC.items():
        src = os.path.join(REPO, path)
        if not os.path.exists(src):
            alt = src.replace("pepper", "bandit"); src = alt
        im = Image.open(src).convert("RGBA"); im.thumbnail((size, size), Image.LANCZOS)
        im.save(os.path.join(outdir, k + ".png"), "PNG", optimize=True)
A = lambda k: f"art/{k}.png"

EXTRA_CSS = """
/* the trader sheet inside a phone */
.phone{min-height:700px;background:#5a4b3c}
.yardbg{position:absolute;inset:0;background:url(art/yard.png) center/cover;opacity:.55}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--paper);border:2px solid var(--ink);border-bottom:0;border-radius:22px 22px 0 0;box-shadow:var(--shadow);padding:14px var(--page-pad) 22px;display:flex;flex-direction:column;gap:var(--s-md)}
.grab{width:56px;height:5px;border-radius:3px;background:var(--ui-muted);margin:0 auto 4px}
.sh-head{display:flex;justify-content:space-between;align-items:flex-start}
.xbtn{width:40px;height:40px;border:2px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;background:var(--paper)}
.him{display:flex;gap:10px;align-items:center}
.him img.t{width:120px;height:120px;flex:none}
.bubble{flex:1;min-width:0;padding:12px 14px;transform:rotate(1.5deg)}
.bubble .handLg{font-family:"Patrick Hand",cursive;font-size:17px;line-height:22px}
.count{text-align:center}
.tiles{display:flex;gap:8px}
.tile{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 4px;transform:none}
.tile img{width:52px;height:52px}
.tile .nm{font-family:"Patrick Hand",cursive;font-size:14px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.tile .pr{display:flex;align-items:center;gap:3px;font-family:"Caprasimo",Georgia,serif;font-size:17px}
.tile .pr i{width:14px;height:14px;border-radius:50%;background:var(--rose-deep);border:1.5px solid var(--ink);display:inline-block}
.tile.empty{border-style:dashed;box-shadow:none;background:var(--cream)}
.ticket{margin-top:4px;display:flex;align-items:stretch;border:2px solid var(--ink);border-radius:14px;box-shadow:var(--shadow);overflow:hidden;background:var(--slop-band)}
.ticket .stub{width:96px;border-right:2px dashed var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;background:var(--cream2)}
.ticket .face{flex:1;display:flex;align-items:center;justify-content:center;font-family:"Caprasimo",Georgia,serif;font-size:18px;padding:14px}
.ticket.off{background:var(--cream2);color:var(--mute)}
/* aspects */
.rumour{display:flex;gap:10px;align-items:center;padding:10px 12px;transform:rotate(-.5deg)}
.rumour img{width:40px;height:40px;border-radius:50%;border:2px solid var(--ink);background:var(--paper);flex:none}
.rumour .txt{flex:1;min-width:0}
.rumour.dim{opacity:.7}
.ledger{display:flex;flex-direction:column;gap:6px;padding:10px 12px;transform:rotate(.4deg)}
.ledger .row{display:flex;justify-content:space-between;align-items:baseline;border:0;min-height:0;padding:0}
.rungs{display:flex;gap:6px;margin-top:4px}
.rung{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid var(--ink);border-radius:10px;padding:6px 4px;background:var(--paper);text-align:center}
.rung.done{background:var(--sage)}.rung.next{background:var(--sun);box-shadow:var(--shadow-sm)}
.rung.locked{border-style:dashed;color:var(--mute);background:var(--cream)}
.rung img{width:28px;height:28px;display:block}
.rung .k{font-weight:900;font-size:10px;letter-spacing:1.2px;text-transform:uppercase}
.rung .v{font-family:"Patrick Hand",cursive;font-size:12px;line-height:14px}
.herd{padding:10px 12px;transform:rotate(-.4deg);display:flex;flex-direction:column;gap:6px}
.faces{display:flex}
.faces img{width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);background:var(--paper);margin-left:-8px}
.faces img:first-child{margin-left:0}
/* the scene */
.scene{position:absolute;inset:0;overflow:hidden}
.scene .bg{position:absolute;inset:0;background:url(art/yard.png) center/cover}
.scene .rosie{position:absolute;left:36%;bottom:200px;width:150px;transform:scaleX(-1)}
.scene .trader{position:absolute;right:-6px;bottom:214px;width:118px}
.scene .say{position:absolute;right:14px;bottom:330px;padding:8px 12px;transform:rotate(-2deg);font-family:"Patrick Hand",cursive;font-size:15px;line-height:19px;max-width:180px}
.scene .hint{position:absolute;left:18px;right:18px;bottom:120px;text-align:center}
.beats{display:flex;gap:10px;margin-top:10px}
.beat{flex:1;border:2px solid var(--ink);border-radius:12px;background:var(--paper);padding:8px;font-size:12px;line-height:16px;box-shadow:var(--shadow-sm)}
.beat b{display:block;font-family:"Caprasimo",Georgia,serif;font-weight:400;font-size:13px;margin-bottom:2px}
.moves .mv{max-width:1000px}
"""

def tile(art, name, price, sel=False, fancied=False, extra=""):
    cls = "sticker sm tile" + (" sun" if sel else " cream" if fancied else " paper")
    ex = f'<div class="kickerPill" style="color:var(--accent);font-size:9px">{extra}</div>' if extra else ""
    return f'<div class="{cls}"><img src="{A(art)}" alt=""><div class="nm">{name}</div><div class="pr"><i></i>+{price}</div>{ex}</div>'

def sheet(bubble, count, mid="", tiles=None, ticket=("?", "pick one", "Pick a find to hand over", True), tally=False):
    tiles = tiles or [tile("feather","blue feather",3), tile("whistle","tin whistle",20), tile("pebble","river pebble",3)]
    stub, cap, face, off = ticket
    return f"""<div class="yardbg"></div><div class="sheet">
<div class="grab"></div>
<div class="sh-head"><div><div class="kicker">★ at the hedge</div><div class="pageTitle" style="font-size:24px;line-height:28px">The Ghost Sheep Trader</div></div><div class="xbtn">×</div></div>
<div class="him"><img class="t" src="{A('trader')}" alt=""><div class="sticker sm bubble {'sun' if tally else 'paper'}">{bubble}</div></div>
<div class="hand mute count">{count}</div>
{mid}
<div class="tiles">{''.join(tiles)}</div>
<div class="ticket{' off' if off else ''}"><div class="stub"><div class="numeralLg" style="font-size:20px;line-height:22px">{stub}</div><div class="kickerPill" style="font-size:9px">{cap}</div></div><div class="face">{face}</div></div>
</div>"""

def phone(inner, cap):
    return f'<figure class="ph"><div class="phone">{inner}</div><figcaption class="hand mute">{cap}</figcaption></figure>'

# ── the five boards ────────────────────────────────────────────────────────────
TODAY = sheet('<div class="handLg">Finds for tickles. Today I fancy a four-leaf clover — that one pays double.</div>',
              "takes 3 more finds · 4h 7m left")

A_RUMOUR = sheet(
    '<div class="handLg">Finds for tickles. And — Maya\'s Pickles has been after a tin whistle two days now. You\'re carrying two.</div>',
    "takes 3 more finds · 4h 7m left",
    mid=f"""<div class="kickerPill" style="margin-top:2px">he's heard</div>
<div class="sticker sm cream rumour"><img src="{A('bandit')}" alt=""><div class="txt"><div class="label">Pickles wants a tin whistle</div><div class="handSm mute">Maya's pig · you have 2</div></div><div class="btn xs">Hand it over</div></div>
<div class="sticker sm paper rumour dim"><img src="{A('pepper')}" alt=""><div class="txt"><div class="label">Copper wants a clover</div><div class="handSm mute">Otis's pig · none in your bag</div></div><div class="btn xs ghost">Send a pig</div></div>""")

B_REGULAR = sheet(
    '<div class="handLg">You again. Good. Same terms as always — and I\'ve been counting.</div>',
    "takes 3 more finds · 4h 7m left",
    mid=f"""<div class="sticker sm paper ledger"><div class="row"><span class="kickerPill" style="color:var(--accent)">hedge regular</span><span class="label">14 handed over</span></div>
<div class="progress"><i style="width:56%"></i></div>
<div class="handSm mute">11 more and the hooded scarf is yours</div>
<div class="rungs">
<div class="rung done"><img src="{A('clipboard')}" alt=""><div class="k">5</div><div class="v">a Field Guide line</div></div>
<div class="rung next"><img src="{A('scarf')}" alt=""><div class="k">25</div><div class="v">the hooded scarf</div></div>
<div class="rung locked"><div class="k" style="font-size:14px;letter-spacing:0">…</div><div class="k">100</div><div class="v">Hedge Regular title</div></div>
</div></div>""")

C_HERD = sheet(
    '<div class="handLg">Sunday. Today I fancy tin whistles — from the whole herd, mind.</div>',
    "takes 3 more finds · 4h 7m left",
    mid=f"""<div class="sticker sm sage herd"><div style="display:flex;justify-content:space-between;align-items:center"><span class="kickerPill" style="color:var(--ink)">the herd's fancy · sunday</span><div class="faces"><img src="{A('bandit')}" alt=""><img src="{A('rosie')}" alt=""><img src="{A('pepper')}" alt=""><img src="{A('bandit')}" alt=""></div></div>
<div class="label">the herd's handed him 11 tin whistles</div>
<div class="progress"><i style="width:55%;background:var(--sun)"></i></div>
<div class="handSm mute">20 pays every snout a Gold Bunting · yours: 3</div></div>""",
    tiles=[tile("feather","blue feather",3), tile("whistle","tin whistle",40, fancied=True, extra="pays double · counts for the herd"), tile("pebble","river pebble",3)])

D_SCENE = f"""<div class="scene"><div class="bg"></div>
<img class="rosie" src="{A('rosie_walk')}" alt="">
<img class="trader" src="{A('trader')}" alt="">
<div class="sticker sm paper say">Psst. Little pig.</div>
<div class="sticker sm paper hint"><div class="label">Rosie's gone to the hedge</div><div class="handSm mute">tap him · he has finds for tickles</div></div>
</div>"""

def section(d, title, pillar, thesis, phones, keeps, costs, risk):
    li = lambda xs: "".join(f"<li>{x}</li>" for x in xs)
    return f"""
<section class="dir" id="dir-{d}">
  <aside class="aside">
    <div class="kicker">aspect {d} · {pillar}</div>
    <h2 class="sectionTitle">{title}</h2>
    <p class="thesis">{thesis}</p>
    <div class="ledger" style="transform:none;padding:0;background:none;box-shadow:none;border:0">
      <div><span class="kickerPill">what it adds</span><ul>{li(keeps)}</ul></div>
      <div><span class="kickerPill">what it costs</span><ul>{li(costs)}</ul></div>
      <div><span class="kickerPill">the risk</span><p>{risk}</p></div>
    </div>
  </aside>
  <div class="phones">{phones}</div>
</section>"""

BODY = f"""
<div class="wrap">
<header class="crownbar">
  <div class="kickerPill">★ tickle the pig · the ghost sheep trader · design round · 20 sep 2026</div>
  <h1 class="pageTitle">The Trader, developed</h1>
  <p class="lede">Today he is a good coat on a vending machine: once a day for six hours he buys finds at rarity prices, fancies one find at double, takes three, and says one line. Since this afternoon he pays tickles and never snouts. Four aspects below each give him one more thing to be — a gossip, a memory, a herd event, a presence in the yard — and each is checked against a pillar and priced.</p>
</header>

<section class="dir" id="today">
  <aside class="aside">
    <div class="kicker">today</div>
    <h2 class="sectionTitle">The sheet as shipped</h2>
    <p class="thesis">Him and his line, the count, the offers three-up (a short last row squared off with dashed slots since this evening), and the trade ticket.</p>
    <div class="ledger" style="transform:none;padding:0;background:none;box-shadow:none;border:0">
      <div><span class="kickerPill">what he does</span><ul><li>Arrives once a day inside 08–22 local, stays 6 h, seeded per pig</li><li>Buys finds: common 3 · uncommon 8 · rare 20; the fancied find ×2; three per visit</li><li>Pays <b>tickles</b> — the count, not snouts, not the bank (pushed 20260920100000)</li><li>Five animation families, a fan row, a Field Guide page</li></ul></div>
      <div><span class="kickerPill">what he isn't yet</span><ul><li>Anyone's friend, anyone's memory, or the herd's business</li></ul></div>
    </div>
  </aside>
  <div class="phones">{phone(TODAY, "the sheet, today")}</div>
</section>

{section("A", "He carries rumours", "Connect",
  "His greeting draws on live herd data — who's pig is wishing for what, and whether you're carrying it — and the rumour is a door: hand it over on a visit, or send a pig for one you don't have.",
  phone(A_RUMOUR, "the rumour under the count"),
  ["One or two rumours from friends' wishes, best match first (you have it · you don't)", "A door per rumour: the visit's swap, or the errand ticket with that wish preset", "His line names the friend and the pig — the same voice, more to say"],
  ["Client only: useFriendWishTargets already knows the wishes; the errand route takes ?send=", "Copy: a rumour template per case (have it · don't · none today)", "No server work"],
  "If nobody's wishing, he has nothing to say — the rumour row hides and he is today's trader again. Fine, but the aspect is only as alive as the herd's wishes.")}

{section("B", "He remembers regulars", "Collect",
  "trader_sales is already a ledger. Count it, and every find handed over is a step toward something only he gives — a Field Guide line at 5, his hooded scarf at 25, a title at 100 — and his greeting knows you.",
  phone(B_REGULAR, "the ledger between him and the offers"),
  ["A regular's strip: handed-over count, the next rung, the bar", "Three rungs: 5 · a Field Guide line, 25 · the hooded scarf (a wearable cut from his kit), 100 · the Hedge Regular title", "A greeting for a regular — “You again. Good.”"],
  ["Server: a count from trader_sales in trader_status(); a grant at each rung (idempotent, like the ladder)", "Art: one wearable through the regen studio + placement", "A Field Guide reveal on the first rung"],
  "A ladder to 100 at three a visit is ~34 visits — months. The rungs must feel like his gifts, not a grind; the count on the strip does the work, not the goal.")}

{section("C", "The herd's fancy", "Contend",
  "One day a week his fancy is the whole crew's: everyone's hand-overs of that find count on one tally at the hedge, and a threshold pays the herd. The Trough's shape, at his fence.",
  phone(C_HERD, "sunday: the herd tally above the offers"),
  ["A crew-wide want and tally, one day a week", "The fancied tile says it: pays double · counts for the herd", "A herd prize at the threshold (Gold Bunting again, or a herd-only find)"],
  ["Server: a herd tally per (crew, week) + the seeded herd want + the payout on threshold", "Client: the tally card, the tile's second line, a fan row when the herd is close", "Announce copy for the crew when it pays (the Barn Draw's lane)"],
  "It makes him a schedule again — the thing the spec removed. Worth it only as a sprint (one day, resets), never a standing ladder; and it competes with the Trough for the herd's Sunday.")}

{section("D", "The visit is a scene", "craft",
  "Not a sheet change — the yard. When he's at the hedge Rosie wanders over to him, he rummages, a tap opens the sheet; the take shows the find go into his satchel, and he has a leaving line per outcome.",
  phone(D_SCENE, "the yard while he's here") + f'''<div class="ph" style="align-self:center;max-width:390px"><div class="beats">
<div class="beat"><b>1 · he's here</b>Rosie walks to the hedge (the walk family), stops facing him; he rummages on idle.</div>
<div class="beat"><b>2 · the take</b>The find arcs from the tile into his satchel; the tally counts up as it lands.</div>
<div class="beat"><b>3 · he goes</b>A line for the way it went — "Good doing business." · "Nothing today, then." — and the leave.</div></div>
<div class="handSm mute" style="margin-top:8px">The greeter's walk is the errand's walk; the arc is the reward return's coin hop; nothing new to draw.</div></div>''',
  ["Rosie reacts to him — the yard says he's here before the fan row does", "A rummage idle, a take with the find in flight, a leaving line per outcome", "The same beats the Pen's homecoming already plays"],
  ["Client only: the walk family, the reward-return arc, three lines of copy", "A rummage idle is two frames on the existing idle sheet"],
  "Motion that plays every day must stay short — the walk is a beat, not a wait; if Rosie's mid-tickle she does not go.")}

<section class="compare" id="compare">
  <div>
    <h2 class="sectionTitle">Side by side</h2>
    <p><b>A</b> and <b>D</b> cost nothing on the server and change what a visit <i>feels</i> like: he knows the herd, and the yard knows he's here. <b>B</b> gives him a memory and one collectible that exists nowhere else — cheap on the server, one piece of art. <b>C</b> is the only one that makes him a herd event, and the only one that reintroduces a schedule.</p>
    <p>Together A + B make him a character: a sheep who knows your friends' wishes and knows how many times you've come to the hedge. C waits until the Trough's herd-prize pattern has had a few Mondays. D is polish to do alongside whichever ships first.</p>
  </div>
  <div>
    <div class="verdict"><div class="tape"></div>
      <h3>Recommendation: A + B now, D alongside, C later</h3>
      <ol>
        <li><b>A · rumours</b> — the greeting names a friend's wish; a rumour row under the count with a door each.</li>
        <li><b>B · regulars</b> — count from trader_sales in trader_status; rungs 5 · 25 · 100; the hooded scarf.</li>
        <li><b>D · the scene</b> — Rosie walks to the hedge; the take arcs; a leaving line.</li>
        <li><b>C · the herd's fancy</b> — a later sprint, after the Trough settles.</li>
      </ol>
    </div>
  </div>
</section>

<section class="moves" id="moves">
  <h2 class="sectionTitle">What each aspect touches</h2>
  <p class="sub">Server · client · art · copy, per aspect.</p>
  <div class="mv">
    <div class="head kickerPill">aspect</div><div class="head"></div><div class="head kickerPill">touches</div>
    <div>A · rumours</div><div class="arrow">→</div><div class="to">TraderSheet (rumour row) · utils/trader (greeting) · useFriendWishTargets · the errand's ?send= · copy</div>
    <div>B · regulars</div><div class="arrow">→</div><div class="to">migration: trader_status() count + rung grants · TraderSheet (ledger strip) · one wearable + RelSpec · Field Guide line · a title row</div>
    <div>C · herd's fancy</div><div class="arrow">→</div><div class="to">migration: herd want + tally + payout · TraderSheet (tally card, tile line) · Barn fan row · crew announce</div>
    <div>D · the scene</div><div class="arrow">→</div><div class="to">Barn (Rosie's walk to the hedge) · TraderSprite (rummage, take arc) · utils/trader (leaving lines)</div>
  </div>
</section>

<footer>Generated from <code>docs/design/claude-design/trader-2026-09-20/gen.py</code>; the Me round's CSS is shared. Reply with letters — the next round is one aspect, refined.</footer>
</div>
"""

if "--artifact" in sys.argv:
    out = sys.argv[sys.argv.index("--artifact") + 1]
    export_assets(os.path.join(out, "art"))
    html = f"""<title>The Trader, developed</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Nunito:wght@700;800;900&family=Patrick+Hand&display=swap">
<style>{CSS}{PAGE_CSS}{EXTRA_CSS}</style>
{BODY}"""
    with open(os.path.join(out, "index.html"), "w") as f: f.write(html)
    print("wrote", os.path.join(out, "index.html"))
