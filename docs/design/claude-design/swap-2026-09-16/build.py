#!/usr/bin/env python3
"""Writes the barn-swap canvas artboards (.dc.html) from one shared style block.
Tokens mirror constants/theme.ts (WHIMSY / RADII / SPACE / BORDER / TILT / OPACITY /
ART_SIZE / TAP_MIN / PAGE_PAD / STATUS_SAFE / AVATAR_SIZE); the visit anatomy is
components/BarnVisitModal.tsx + components/visit/* as shipped in build 190; the
room, the pigs and the find glyphs are shipped art (img/). Copy per
docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md Part 2 §2 + §12."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;family=Fredoka:wght@600;700&amp;display=swap">'

# ── tokens (constants/theme.ts) ─────────────────────────────────────────────
INK = "#2a1f15"; PAPER = "#fffaf0"; CREAM = "#fbeee2"; CREAM2 = "#f6e6d4"; SUN = "#ffd87a"
ROSE = "#ffd6dc"; SAGE = "#c9dec1"; ACCENT = "#a03e2f"; MUTE = "#605449"; MUTE_DIM = "#6a5c50"
BARK = "#3a2c1e"; BARK_TEXT = "#fff3e2"; SKY = "#c8e3f0"

STYLE = f"""
    body {{ margin: 0; background: {CREAM}; color: {INK}; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }}
    a {{ color: {ACCENT}; }} a:hover {{ color: {INK}; }}
    img {{ display: block; }} svg {{ display: block; }}
    .pageTitle {{ font-family: "Caprasimo", "Cooper Black", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }}
    .cardTitle {{ font-family: "Caprasimo", "Cooper Black", Georgia, serif; font-weight: 400; font-size: 18px; line-height: 22px; letter-spacing: .2px; }}
    .cardTitleSm {{ font-family: "Caprasimo", "Cooper Black", Georgia, serif; font-weight: 400; font-size: 14px; line-height: 18px; }}
    .body {{ font-size: 15px; line-height: 21px; }}
    .label {{ font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }}
    .kicker {{ font-family: "Patrick Hand", "Segoe Print", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; }}
    .hand {{ font-family: "Patrick Hand", "Segoe Print", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }}
    .kickerPill {{ font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: {MUTE}; }}
    .mute {{ color: {MUTE}; }} .accent {{ color: {ACCENT}; }}
    /* ── the visit frame: chrome over a flex:1 stage over the strip ── */
    .room {{ position: relative; width: 390px; height: 844px; overflow: hidden; background: {SKY} url("room.jpg") center / cover no-repeat; }}
    .chrome {{ position: absolute; left: 18px; right: 18px; top: 56px; z-index: 5; display: flex; flex-direction: column; gap: 8px; }}
    .hrow {{ height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
    .plaque {{ display: flex; align-items: center; gap: 4px; padding: 4px 12px; background: {BARK}; color: {BARK_TEXT}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 2px 2px 0 {INK}; min-width: 0; flex-shrink: 1; box-sizing: border-box; }}
    .plaque img {{ width: 12px; height: 12px; }}
    .plaque span {{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .leave {{ display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 14px 6px 12px; border: 2px solid {INK}; border-radius: 999px; background: {PAPER}; font-weight: 800; font-size: 14px; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; flex-shrink: 0; }}
    .leave svg {{ width: 14px; height: 14px; }}
    .srow {{ display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }}
    .tag {{ display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px; padding: 0 12px; border: 2px solid {INK}; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; background: {PAPER}; white-space: nowrap; box-sizing: border-box; box-shadow: 2px 2px 0 {INK}; }}
    .tag.sun {{ background: {SUN}; }} .tag.paper {{ box-shadow: none; }}
    .tag img.g {{ width: 14px; height: 14px; }}
    .tag img.av {{ width: 26px; height: 26px; margin-left: -8px; }}
    .tag svg {{ width: 14px; height: 14px; }}
    .toggle {{ position: absolute; left: 50%; top: 152px; transform: translateX(-50%); width: 190px; height: 48px; background: {PAPER}; border: 2px solid {INK}; border-radius: 999px; box-shadow: 2px 2px 0 {INK}; display: flex; padding: 4px; box-sizing: border-box; z-index: 5; }}
    .toggle div {{ flex: 1; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; border-radius: 999px; color: {MUTE}; }}
    .toggle div.on {{ background: {SUN}; border: 2px solid {INK}; color: {INK}; }}
    .gear {{ position: absolute; right: 18px; top: 186px; width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 250, 240, 0.45); display: flex; align-items: center; justify-content: center; opacity: .7; z-index: 4; }}
    .gear svg {{ width: 26px; height: 26px; }}
    /* ── the stage: two pigs on one ground line, guest left facing right, host right facing left ── */
    .pig {{ position: absolute; z-index: 2; display: flex; flex-direction: column; align-items: center; }}
    .pig img.sprite {{ width: 132px; height: 132px; object-fit: contain; }}
    .pig img.mirror {{ transform: scaleX(-1); }}
    .guest {{ left: 50px; bottom: 190px; }}
    .host {{ right: 40px; bottom: 150px; }}
    .nametag {{ margin-top: -10px; padding: 0 8px; background: {PAPER}; border: 1.5px solid {INK}; border-radius: 999px; font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 11px; line-height: 16px; }}
    .chip {{ margin-top: -8px; }}
    .chip .tag {{ height: 24px; font-size: 11px; padding: 0 10px; }}
    .bubble {{ display: flex; flex-direction: column; align-items: center; margin-bottom: -4px; }}
    .bubble .card {{ display: flex; align-items: center; gap: 4px; padding: 4px 8px; max-width: 176px; background: {PAPER}; border: 2px solid {INK}; border-radius: 18px; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; }}
    .bubble .card img {{ width: 24px; height: 24px; flex-shrink: 0; }}
    .bubble .txt {{ display: flex; flex-direction: column; min-width: 0; }}
    .bubble .txt .kicker {{ line-height: 16px; }}
    .bubble .tail {{ width: 10px; height: 10px; margin-top: 2px; margin-left: 40px; background: {PAPER}; border: 1.5px solid {INK}; border-radius: 999px; box-sizing: border-box; }}
    .bubble .tail.sm {{ width: 6px; height: 6px; margin-left: 64px; }}
    /* ── the strip, above the action bar ── */
    .strip {{ position: absolute; left: 18px; right: 18px; bottom: 96px; z-index: 6; display: flex; flex-direction: column; gap: 4px; }}
    .strip .head {{ display: flex; align-items: center; gap: 4px; color: {MUTE}; }}
    .strip .head img {{ width: 12px; height: 12px; }}
    .strip .row {{ display: flex; flex-wrap: wrap; gap: 4px; }}
    .tile {{ width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: {PAPER}; border: 1.5px solid {INK}; border-radius: 14px; box-sizing: border-box; }}
    .tile img {{ width: 24px; height: 24px; }}
    .tile.lifted {{ background: {SUN}; border-width: 3px; box-shadow: 2px 2px 0 {INK}; }}
    .tile.rest {{ opacity: .7; }}
    .tile.muted {{ opacity: .55; }}
    .tile .from {{ position: absolute; right: -5px; top: -5px; width: 16px; height: 16px; border-radius: 50%; background: {ROSE}; border: 1.5px solid {INK}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }}
    .tile .from img {{ width: 10px; height: 10px; }}
    .tile.rel {{ position: relative; }}
    .btn {{ display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 11px 18px; border: 2px solid {INK}; border-radius: 22px; background: {SUN}; font-weight: 800; font-size: 15px; letter-spacing: .1px; box-shadow: 2px 2px 0 {INK}; box-sizing: border-box; color: {INK}; text-align: center; }}
    .btn.link {{ background: transparent; border-color: transparent; box-shadow: none; color: {ACCENT}; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; padding: 10px; }}
    /* ── the tray: a sticker rising from the strip (the visit's dialog style, TILT.dialog) ── */
    .tray {{ position: absolute; left: 18px; right: 18px; bottom: 46px; z-index: 8; background: {PAPER}; border: 2px solid {INK}; border-radius: 18px; box-shadow: 4px 4px 0 {INK}; padding: 14px 16px 12px; display: flex; flex-direction: column; gap: 12px; transform: rotate(-0.8deg); box-sizing: border-box; }}
    .tray .trow {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }}
    .tray .gave {{ display: flex; align-items: center; gap: 8px; }}
    .tray .gave .tile {{ flex-shrink: 0; }}
    .tray .close {{ width: 44px; height: 44px; margin: -8px -10px 0 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }}
    .tray .close span {{ width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid {INK}; background: {PAPER}; display: flex; align-items: center; justify-content: center; }}
    .tray .close svg {{ width: 12px; height: 12px; }}
    .opts {{ display: flex; gap: 8px; }}
    .opt {{ flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px 6px; background: {PAPER}; border: 1.5px solid {INK}; border-radius: 14px; box-sizing: border-box; min-height: 44px; }}
    .opt img {{ width: 40px; height: 40px; }}
    .opt .kicker {{ text-align: center; line-height: 14px; }}
    .opt .n {{ font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 12px; line-height: 14px; color: {MUTE}; }}
    .scrim {{ position: absolute; inset: 0; background: rgba(42, 31, 21, 0.55); z-index: 20; }}
    /* ── the centred dialog (AdaptiveModalScaffold inline, maxWidth 320, TILT.dialog) ── */
    .dialog {{ position: absolute; left: 35px; width: 320px; top: 128px; z-index: 21; background: {PAPER}; border: 2px solid {INK}; border-radius: 18px; box-shadow: 4px 4px 0 {INK}; padding: 24px; display: flex; flex-direction: column; align-items: center; transform: rotate(-0.8deg); box-sizing: border-box; }}
    .dialog .closerow {{ align-self: stretch; display: flex; align-items: center; justify-content: space-between; margin: -14px -14px 0 0; }}
    .dialog .kicker.accent {{ margin-top: 4px; }}
    .dialog .closerow .x {{ width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }}
    .dialog .closerow .x span {{ width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid {INK}; background: {PAPER}; display: flex; align-items: center; justify-content: center; }}
    .dialog .closerow .x svg {{ width: 12px; height: 12px; }}
    .dialog .art {{ display: flex; align-items: center; gap: 10px; }}
    .dialog .art img {{ width: 64px; height: 64px; }}
    .dialog .art img.sm {{ width: 40px; height: 40px; }}
    .dialog .art .arrow {{ width: 28px; height: 28px; }}
    .dialog .pageTitle {{ margin-top: 8px; text-align: center; }}
    .dialog .body {{ margin-top: 8px; margin-bottom: 16px; text-align: center; color: {MUTE}; }}
    .dialog .btn {{ align-self: stretch; }}
    .dialog .btn.link {{ margin-top: 12px; }}
    .dialog img.z {{ width: 40px; height: 40px; }}
"""

X = f'<svg viewBox="0 0 24 24" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
BARN = f'<svg viewBox="0 0 24 24" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9l8-5 8 5v11M4 20h16M9 20v-7h6v7M9 13l6 7M15 13l-6 7"></path></svg>'
GEAR = f'<svg viewBox="0 0 24 24" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path></svg>'

def chrome(host: str, you: int, them: int, visits: str = "3 of 3 visits left") -> str:
    return f'''<div class="chrome">
    <div class="hrow">
      <div class="plaque cardTitle"><img src="g_star.png" alt=""><span>{host}'s Barn</span></div>
      <div class="leave">{X}Leave</div>
    </div>
    <div class="srow">
      <div class="tag"><img class="av" src="g_pigface.png" alt=""><img class="g" src="g_heart.png" alt="">{you}</div>
      <div class="tag"><img class="av" src="g_pigface.png" alt=""><img class="g" src="g_heart.png" alt="">{them}</div>
      <div class="tag sun">{BARN}{visits}</div>
    </div>
  </div>
  <div class="toggle"><div>Outside</div><div class="on">Inside</div></div>
  <div class="gear">{GEAR}</div>'''

def bubble(find: str, line: str, sub: str = "", sub_tone: str = "mute") -> str:
    subhtml = f'<div class="kicker {sub_tone}">{sub}</div>' if sub else ""
    return f'''<div class="bubble"><div class="card"><img src="f_{find}.png" alt=""><div class="txt"><div class="kicker">{line}</div>{subhtml}</div></div><div class="tail"></div><div class="tail sm"></div></div>'''

def guest(sprite: str = "p_face_sit_1.png") -> str:
    return f'<div class="pig guest"><img class="sprite" src="{sprite}" alt="your pig"><div class="nametag">you</div></div>'

def host(bub: str, chip: str, sprite: str = "p_face_1.png", mirror: bool = True) -> str:
    m = " mirror" if mirror else ""
    return f'<div class="pig host">{bub}<img class="sprite{m}" src="{sprite}" alt="their pig"><div class="chip">{chip}</div></div>'

CHIP_COUNT = lambda n: f'<div class="tag paper"><img class="g" src="g_heart.png" alt="">{n} tickles</div>'
CHIP_SPENT = f'<div class="tag sun"><img class="g" src="g_zzz.png" alt="">tickled out</div>'

def tile(find: str, cls: str = "", from_friend: bool = False) -> str:
    mark = '<div class="from"><img src="g_heart.png" alt=""></div>' if from_friend else ""
    rel = " rel" if from_friend else ""
    return f'<div class="tile{rel} {cls}"><img src="f_{find}.png" alt="">{mark}</div>'

def strip(line: str, tiles: str) -> str:
    return f'''<div class="strip"><div class="head"><img src="g_bag.png" alt=""><div class="kicker">{line}</div></div><div class="row">{tiles}</div></div>'''

def room(body: str) -> str:
    return f'<div class="room">{body}</div>'

def page(body: str) -> str:
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  {FONTS}
  <style>{STYLE}  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
'''

HOST = "Maple"

# 1 · Main · the visit, a match in the bag — bubble says "will swap"
main = room(
    chrome(HOST, 37, 20)
    + guest()
    + host(bubble("red_berries", "hoping for some red berries", "will swap"), CHIP_COUNT(0))
    + strip("you have some red berries — tap it to swap",
            tile("blue_feather", "rest") + tile("old_key", "rest") + tile("red_berries", "lifted") + tile("wool_tuft", "rest"))
)

# 2 · Tray · the lifted find was tapped: three options, or just give it
tray = room(
    chrome(HOST, 37, 20)
    + guest()
    + host(bubble("red_berries", "hoping for some red berries", "will swap"), CHIP_COUNT(0))
    + f'''<div class="tray">
    <div class="trow"><div class="gave">{tile("red_berries", "lifted")}<div><div class="kicker accent">{HOST}'s pig can spare</div><div class="cardTitle">one of these for your red berries</div></div></div><div class="close"><span>{X}</span></div></div>
    <div class="opts">
      <div class="opt"><img src="f_old_key.png" alt=""><div class="kicker">old key</div></div>
      <div class="opt"><img src="f_river_pebble.png" alt=""><div class="kicker">river pebble</div></div>
      <div class="opt"><img src="f_pinecone.png" alt=""><div class="kicker">pinecone</div></div>
    </div>
    <div class="btn link">…or just give it</div>
  </div>'''
    + strip("you have some red berries — tap it to swap",
            tile("blue_feather", "rest") + tile("old_key", "rest") + tile("red_berries", "lifted") + tile("wool_tuft", "rest"))
)

# 3 · Tray · gift only — the host's bag has nothing to spare
tray_gift = room(
    chrome(HOST, 37, 20)
    + guest()
    + host(bubble("red_berries", "hoping for some red berries", "gift only"), CHIP_COUNT(0))
    + f'''<div class="tray">
    <div class="trow"><div class="gave">{tile("red_berries", "lifted")}<div><div class="kicker accent">{HOST}'s pig</div><div class="cardTitle">has nothing to spare yet</div></div></div><div class="close"><span>{X}</span></div></div>
    <div class="hand mute">a gift still tickles you both — and it lands in the bag over there, so next time there may be something to spare.</div>
    <div class="btn">Just give it</div>
  </div>'''
    + strip("you have some red berries — tap it to give",
            tile("blue_feather", "rest") + tile("old_key", "rest") + tile("red_berries", "lifted") + tile("wool_tuft", "rest"))
)

def dialog(inner: str) -> str:
    return f'<div class="scrim"></div><div class="dialog">{inner}</div>'

CLOSE_ROW = lambda label: f'<div class="closerow"><div class="kicker mute">{label}</div><div class="x"><span>{X}</span></div></div>'

# 4 · Receipt · the swap landed
receipt = room(
    chrome(HOST, 40, 23)
    + guest("p_happy_1.png")
    + host(bubble("pinecone", "next time: a pinecone", "", ""), CHIP_COUNT(0), sprite="p_happy_1.png")
    + dialog(
        CLOSE_ROW("Back to the visit")
        + '<div class="art"><img src="f_red_berries.png" alt="red berries"><svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="#605449" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3"></path></svg><img src="f_old_key.png" alt="old key"></div>'
        + '<div class="kicker accent">swapped</div>'
        + f'<div class="pageTitle">{HOST}\'s pig is beaming</div>'
        + f'<div class="body">{HOST}\'s pig got the red berries it was hoping for; you took the old key. You both got 3 tickles.</div>'
        + '<div class="btn">Back to the visit</div>'
    )
)

# 5 · Receipt · a gift landed
receipt_gift = room(
    chrome(HOST, 40, 23)
    + guest("p_happy_1.png")
    + host(bubble("pinecone", "next time: a pinecone", "", ""), CHIP_COUNT(0), sprite="p_happy_1.png")
    + dialog(
        CLOSE_ROW("Back to the visit")
        + '<div class="art"><img src="f_red_berries.png" alt="red berries"></div>'
        + '<div class="kicker accent">a gift</div>'
        + f'<div class="pageTitle">{HOST}\'s pig is beaming</div>'
        + f'<div class="body">{HOST}\'s pig got the red berries it was hoping for — you gave it away. You both got 3 tickles, and a generous tick.</div>'
        + '<div class="btn">Back to the visit</div>'
    )
)

# 6 · After · the strip goes quiet; the taken find is in the bag; the bubble says next time
after = room(
    chrome(HOST, 40, 23)
    + guest("p_happy_1.png")
    + host(bubble("pinecone", "next time: a pinecone", "", ""), CHIP_COUNT(0), sprite="p_happy_1.png")
    + strip("you swapped the red berries for the old key",
            tile("blue_feather") + tile("old_key") + tile("wool_tuft") + tile("old_key", "", from_friend=True))
)

# 7 · Swapped today · back the same day: the wish is open to others, not to you
today = room(
    chrome(HOST, 40, 23, "2 of 3 visits left")
    + guest()
    + host(bubble("pinecone", "hoping for a pinecone", "you two swapped today", "mute"), CHIP_COUNT(0))
    + strip("you two swapped today — come back tomorrow",
            tile("blue_feather", "muted") + tile("pinecone", "muted") + tile("wool_tuft", "muted") + tile("old_key", "muted", from_friend=True))
)

# 8 · Nap card · arriving at a sleeping barn with a match in the bag
nap = room(
    chrome(HOST, 37, 20)
    + guest()
    + host(bubble("red_berries", "hoping for some red berries", "will swap"), CHIP_SPENT, sprite="p_tired_1.png")
    + dialog(
        CLOSE_ROW("Head home")
        + '<img class="z" src="g_zzz.png" alt="">'
        + '<div class="pageTitle">This barn is napping</div>'
        + '<div class="body">Wakes in 4h 12m. You have 3 of 3 visits left.</div>'
        + '<div class="btn">Head home</div>'
        + '<div class="btn link">Swap</div>'
    )
)

# Flow notes
notes = f'''<div style="width: 900px; padding: 32px 36px; box-sizing: border-box; background: {PAPER}; color: {INK}; display: flex; flex-direction: column; gap: 18px;">
  <div class="kicker accent">the swap on a visit · flow notes</div>
  <div class="pageTitle">One tap more than a delivery, and the find goes both ways</div>
  <div class="body">The visit keeps its shape — plaque · tallies · toggle · scene · strip, and <i>Head home</i> only once the pigs are tickled out. A swap changes two things: the <b>bubble</b> gains a second line (<i>will swap</i> / <i>gift only</i>), and tapping the <b>lifted find</b> opens the <b>offer tray</b> instead of firing the server. Everything else the delivery already did — the ceremony, the receipt, the nap card — keeps its place.</div>
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 2px solid {INK}; border-radius: 14px; background: {CREAM2};"><div class="cardTitle">The tray</div><div class="body">Rises from the strip in the visit's dialog style. Up to three finds the host's bag can spare, chosen by the server from the host's biggest stacks (frozen per wish, so the tray is the same on every refresh and a bag is never on show). A count under an option means the host has several. <i>…or just give it</i> is the gift. Tap not drag — the stage is a box-none layer.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 2px solid {INK}; border-radius: 14px; background: {CREAM2};"><div class="cardTitle">Gift only</div><div class="body">Options empty — the host's bag is empty or holds only the wished find. The tray says so once and offers the one button. The bubble already warned (<i>gift only</i>), so nobody arrives expecting a swap.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 2px solid {INK}; border-radius: 14px; background: {CREAM2};"><div class="cardTitle">The receipt</div><div class="body">The host's gain is the title; both finds on the card; the tickles second; the giver never "earns". A gift adds <i>and a generous tick</i>. Past the day's paid cap (ten swaps across all your friends) the line reads <i>(no tickles — you've swapped plenty today)</i> and the swap still happens; a pair can only swap once a day anyway.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 2px solid {INK}; border-radius: 14px; background: {CREAM2};"><div class="cardTitle">After, and the next day</div><div class="body">The strip goes quiet and the taken find sits in it with a small mark (from a friend). The bubble shows the pig's next wish under <i>next time</i>. Come back the same day and the bubble says <i>you two swapped today</i>, nothing lifts, the strip says come back tomorrow — the server's gate, drawn honestly.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 2px solid {INK}; border-radius: 14px; background: {CREAM2};"><div class="cardTitle">The nap card</div><div class="body"><i>Leave a find</i> becomes <i>Swap</i>. Only offered when the wish is open, the pair hasn't swapped today, and the bag holds a match — otherwise it would be a second Head home. The card folds, the host stays asleep, the tray works as on any visit.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 2px solid {INK}; border-radius: 14px; background: {CREAM2};"><div class="cardTitle">What the server answers</div><div class="body"><i>wish_changed</i> and <i>option_gone</i> redraw the bubble and tray in place with a one-line toast (<i>{HOST}'s pig changed its mind</i>) — nothing moves. <i>host_bag_full</i> keeps the tray and points at the swap. <i>already_today</i> quiets the strip. A retry reuses the same nonce, so a double tap can never swap twice.</div></div>
  </div>
  <div class="hand mute">Sample bag, names and tallies. Tokens from constants/theme.ts; anatomy from components/BarnVisitModal.tsx and components/visit/*; the room, the pigs and the finds are shipped art. Spec: docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md Part 2 §2, §6, §12.</div>
</div>'''

BOARDS = {
    "Main.dc.html": main,
    "Tray.dc.html": tray,
    "TrayGiftOnly.dc.html": tray_gift,
    "Receipt.dc.html": receipt,
    "ReceiptGift.dc.html": receipt_gift,
    "After.dc.html": after,
    "SwappedToday.dc.html": today,
    "NapSwap.dc.html": nap,
    "Rationale.dc.html": notes,
}

if __name__ == "__main__":
    for name, body in BOARDS.items():
        with open(os.path.join(HERE, name), "w") as f:
            f.write(page(body))
        print("wrote", name)
