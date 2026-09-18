#!/usr/bin/env python3
"""The Errand — Build 1 of the scavenging pigs (docs/design/scavenging-plan-2026-09-17.md §3).
Phone boards for every screen and state the loop needs, plus one sheet of the
smaller states. Reuses the Pen boards' tokens and pieces (../pen-furnish-2026-09-17/gen.py).
Regenerate with `python3 gen.py`, then re-seed and republish."""
import json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "..", "pen-furnish-2026-09-17"))
import gen as pen  # noqa: E402  (tokens, CSS, paddock, medallion, page, cell, beat …)

from gen import (INK, PAPER, CREAM, CREAM2, SUN, SAGE, PEACH, LILAC, ROSE, SKY, ACCENT, MUTE, MUTEDIM,
                 BARK, BARKTEXT, GRASS, GRASS2, PIG_ACCENT, PIGS, back, crown, tag, page, cell, paddock)

CORK = "#d9b27f"; CORK2 = "#c99c63"
FINDS = {
    "river_pebble": "river pebble", "blue_feather": "blue feather", "clover": "four-leaf clover",
    "snail_shell": "snail shell", "brass_button": "brass button", "wool_tuft": "tuft of wool",
    "red_berries": "red berries", "pinecone": "pinecone", "old_key": "old key",
    "honeycomb": "honeycomb chip", "marble": "glass marble", "tin_whistle": "tin whistle",
}

EXTRA_CSS = f"""
    .med {{ width: 54px; }} .fenceRow {{ gap: 4px; }}
    .listRow {{ min-height: 50px !important; padding: 4px 4px !important; }}
    .jobSeg {{ display: flex; border: 2px solid {INK}; border-radius: 999px; background: {PAPER}; box-shadow: 2px 2px 0 {INK}; padding: 3px; gap: 2px; }}
    .jobSeg span {{ flex: 1 1 0; min-height: 30px; border-radius: 999px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; padding: 0 6px; }}
    .jobSeg span.on {{ background: {SUN}; box-shadow: inset 0 0 0 2px {INK}; }}
    .jobSeg span.out {{ background: {LILAC}; box-shadow: inset 0 0 0 2px {INK}; }}
    .med.out .face {{ box-shadow: none; border-style: dashed; background: {CREAM2}; }}
    .med.out .face img.pig {{ opacity: .45; }}
    .med.back .face:after {{ content: ""; position: absolute; right: -4px; top: -4px; width: 14px; height: 14px; border-radius: 999px; background: {SUN}; border: 2px solid {INK}; box-sizing: border-box; }}
    .findCoin {{ width: 44px; height: 44px; border-radius: 999px; border: 2px solid {INK}; background: {PAPER}; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0 {INK}; flex: none; box-sizing: border-box; }}
    .findCoin img {{ width: 30px; height: 30px; object-fit: contain; }}
    .findCoin.sm {{ width: 32px; height: 32px; box-shadow: none; }} .findCoin.sm img {{ width: 22px; height: 22px; }}
    .listRow {{ display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 4px; border-bottom: 1.5px solid rgba(42,31,21,.14); }}
    .listRow:last-child {{ border-bottom: 0; }}
    .listRow .who {{ width: 40px; height: 40px; border-radius: 999px; border: 2px solid {INK}; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; flex: none; box-sizing: border-box; }}
    .listRow .who img {{ width: 92%; height: 92%; object-fit: contain; }}
    .sheet {{ position: absolute; left: 0; right: 0; bottom: 0; background: {PAPER}; border: 2px solid {INK}; border-bottom: 0; border-radius: 22px 22px 0 0; padding: 10px 18px 26px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 -4px 0 {INK}; z-index: 31; }}
    .ticket {{ border: 2px solid {INK}; border-radius: 14px; background: {PAPER}; box-shadow: 4px 4px 0 {INK}; overflow: hidden; }}
    .ticket .stub {{ display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 2px dashed {INK}; background: {CREAM}; }}
    .ticket .body {{ display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 14px; }}
    .pigPick {{ display: flex; gap: 8px; }}
    .pigPick a {{ flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px; border: 2px solid {INK}; border-radius: 12px; background: {CREAM}; color: {INK}; box-sizing: border-box; }}
    .pigPick a.on {{ background: {SUN}; box-shadow: 2px 2px 0 {INK}; border-width: 3px; }}
    .pigPick a.away {{ border-style: dashed; color: {MUTEDIM}; }}
    .pigPick .face {{ width: 44px; height: 44px; border-radius: 999px; border: 2px solid {INK}; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; box-sizing: border-box; }}
    .pigPick .face img {{ width: 92%; height: 92%; object-fit: contain; }}
    .cork {{ position: relative; border: 2px solid {INK}; border-radius: 14px; background: repeating-linear-gradient(45deg, {CORK}, {CORK} 6px, {CORK2} 6px, {CORK2} 7px); box-shadow: 4px 4px 0 {INK}; padding: 22px 12px 14px; display: flex; gap: 10px; justify-content: space-around; align-items: flex-start; min-height: 120px; }}
    .cork .lbl {{ position: absolute; top: -10px; left: 14px; padding: 1px 10px; background: {BARK}; color: {BARKTEXT}; border: 2px solid {INK}; border-radius: 8px; font-weight: 800; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; }}
    .pin {{ position: relative; width: 92px; padding: 14px 8px 8px; background: {PAPER}; border: 1.5px solid {INK}; box-shadow: 2px 2px 0 {INK}; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; box-sizing: border-box; }}
    .pin:before {{ content: ""; position: absolute; top: -7px; left: 50%; width: 12px; height: 12px; margin-left: -6px; border-radius: 999px; background: {ACCENT}; border: 1.5px solid {INK}; }}
    .pin img {{ width: 34px; height: 34px; object-fit: contain; }}
    .pin.paw {{ background: {CREAM2}; }}
    .yard {{ position: relative; flex: 1; overflow: hidden; background: linear-gradient(180deg, {SKY} 0%, #dceef5 55%, {GRASS} 56%, {GRASS2} 100%); }}
    .yard .mound {{ position: absolute; left: 40px; bottom: 110px; width: 150px; height: 44px; border-radius: 80px 80px 10px 10px; background: #a4743f; border: 2px solid {INK}; }}
    .yard .gone {{ position: absolute; left: 50%; bottom: 200px; transform: translateX(-50%) rotate(-1.5deg); padding: 8px 14px; background: {PAPER}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 4px 4px 0 {INK}; text-align: center; white-space: nowrap; }}
    .corner {{ position: absolute; top: 16px; padding: 8px 12px; background: {ROSE}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 4px 4px 0 {INK}; }}
    .fanRow {{ position: absolute; right: 16px; bottom: 24px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }}
    .fanRow .pill {{ display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: {PAPER}; border: 2px solid {INK}; border-radius: 999px; box-shadow: 2px 2px 0 {INK}; font-family: "Patrick Hand", cursive; font-size: 14px; }}
    .fanRow .pill img {{ width: 16px; height: 16px; }}
    .fanRow .fab {{ width: 64px; height: 64px; border-radius: 999px; background: {SUN}; border: 2px solid {INK}; box-shadow: 4px 4px 0 {INK}; display: flex; align-items: center; justify-content: center; }}
    .fanRow .fab img {{ width: 36px; height: 36px; }}
    .toast {{ position: absolute; left: 18px; right: 18px; top: 64px; padding: 10px 14px; background: {BARK}; color: {BARKTEXT}; border: 2px solid {INK}; border-radius: 12px; box-shadow: 4px 4px 0 {INK}; display: flex; align-items: center; gap: 10px; z-index: 40; }}
    .push {{ display: flex; gap: 10px; padding: 10px 12px; background: {PAPER}; border: 2px solid {INK}; border-radius: 14px; box-shadow: 2px 2px 0 {INK}; align-items: center; }}
    .push img {{ width: 36px; height: 36px; border-radius: 8px; }}
    .pips {{ display: flex; gap: 3px; }} .pips i {{ width: 10px; height: 10px; border-radius: 999px; border: 1.5px solid {INK}; background: {PAPER}; display: block; }} .pips i.on {{ background: {SUN}; }}
"""
pen.CSS = pen.CSS + EXTRA_CSS

def find_coin(fid, sm=False):
    return f'<span class="findCoin{" sm" if sm else ""}"><img src="f_{fid}.png" alt="{FINDS[fid]}"></span>'

def pips(n):
    return '<span class="pips">' + "".join(f'<i class="{"on" if i < n else ""}"></i>' for i in range(3)) + "</span>"

def medallion(pid, name, state="off"):
    if state in ("out", "back"):
        tint = PIG_ACCENT[pid][1]
        return f'<a href="#" class="med {state}" aria-label="{name}"><span class="face" style="background:{tint}"><img class="pig" src="{pid}.png" alt=""></span><span class="nm">{name}</span></a>'
    return pen.medallion(pid, name, state)

def fence(sel=None, out=None, back=None, rosie=False):
    pigs = ([("rosie", "Rosie")] if rosie else []) + [(p[0], p[1]) for p in PIGS]
    out_ = '<div class="fenceRow">'
    for pid, name in pigs:
        st = "out" if pid == out else "back" if pid == back else "on" if pid == sel else "off"
        out_ += medallion(pid, name, st)
    return out_ + "</div>"

def job_seg(on="home"):
    cells = [("home", "At home"), ("pen", "In the Pen"), ("out", "Out looking")]
    return '<div class="jobSeg">' + "".join(f'<span class="{"out" if on == k == "out" else "on" if on == k else ""}">{l}</span>' for k, l in cells) + "</div>"

def card(pid, body, tape="the job", line=None):
    _, name, coat, motif, _l = next(p for p in PIGS if p[0] == pid) if pid != "rosie" else ("rosie", "Rosie", "Classic pink", "g_heart", "")
    solid = PIG_ACCENT[pid][0]
    ln = f'<span class="hand mute">{line}</span>' if line else ""
    return f'''<div class="sticker" style="position:relative;padding:18px 16px 16px;transform:rotate(-.6deg);display:flex;flex-direction:column;gap:12px">
<span class="tape" style="top:-9px;left:50%;margin-left:-40px">{tape}</span>
<div class="row" style="gap:12px">
  <a href="#" class="plate" style="background:{solid};color:{INK}" aria-label="About {name}"><span class="handDisplay">{name}</span></a>
  <div class="col" style="flex:1;min-width:0"><span class="label">{coat}</span>{ln}</div>
  <span class="motif"><img src="{motif}.png" alt=""></span>
</div>
{body}
</div>'''

def pen_page(paddock_html, fence_html, card_html, extra="", overlay=""):
    return f'''<div class="status"></div>{back()}
{crown("rosie’s place", "The Pen")}
<div style="display:flex;flex-direction:column;gap:14px;padding:14px 18px 24px">
{paddock_html}{fence_html}{extra}{card_html}
</div>{overlay}'''

# ── 1. Main — the job board ────────────────────────────────────────────────
body1 = f'''{job_seg("pen")}
<a href="#" class="btn lilac" style="width:100%">Send Bandit to look for…</a>
<div class="hand mute" style="text-align:center">one errand a day · back in about 4h</div>'''
MAIN = page(pen_page(paddock("bandit", "Bandit, in the Pen"), fence("bandit", rosie=True),
                     card("bandit", body1, tape="the job", line="looks anywhere · Nose 1")))

# ── 2. Send sheet — friends first ───────────────────────────────────────────
def wish_row(pid, who, fid, note, first=False):
    return f'''<a href="#" class="listRow" style="color:{INK}"><span class="who" style="background:{PIG_ACCENT[pid][1]}"><img src="{pid}.png" alt=""></span>
<div class="col" style="flex:1;min-width:0"><span class="label">{who}</span><span class="hand mute">{note}</span></div>{find_coin(fid, sm=True)}</a>'''
sheet2 = f'''<div class="sheet">
<div class="grabber"></div>
<div class="sectionTitle">What should Bandit look for?</div>
<div class="kickerPill">friends’ wishes</div>
{wish_row("pickles", "Maya’s Pickles", "blue_feather", "hoping for a blue feather · 2 days")}
{wish_row("rosie", "Theo’s Rosie", "marble", "hoping for a glass marble · today")}
<div class="kickerPill" style="margin-top:6px">your pig</div>
{wish_row("rosie", "Rosie", "honeycomb", "she’s hoping for a chip of honeycomb")}
<div class="kickerPill" style="margin-top:6px">or</div>
<a href="#" class="listRow" style="color:{INK}"><span class="findCoin sm" style="border-style:dashed"><img src="g_search.png" alt=""></span><div class="col" style="flex:1"><span class="label">Anything</span><span class="hand mute">whatever he finds is yours</span></div></a>
</div>'''
SEND = page(pen_page(paddock("bandit", "Bandit, in the Pen"), fence("bandit", rosie=True),
                     card("bandit", body1, tape="the job", line="looks anywhere · Nose 1"),
                     overlay=f'<div class="scrim" style="align-items:flex-end;padding:0"></div>{sheet2}'))

# ── 3. Ticket — who goes? ───────────────────────────────────────────────────
def ticket(target_fid, for_line, pigs, chosen, back_by, hint=None):
    chosen_name = next(n for pid, n, *_ in pigs if pid == chosen)
    pp = '<div class="pigPick">'
    for pid, name, when, st in pigs:
        cls = "on" if pid == chosen else st
        pp += f'<a href="#" class="{cls}"><span class="face" style="background:{PIG_ACCENT[pid][1]}"><img src="{pid}.png" alt=""></span><span class="label">{name}</span><span class="hand mute">{when}</span></a>'
    pp += "</div>"
    h = f'<div class="hand" style="color:{ACCENT}">{hint}</div>' if hint else ""
    return f'''<div class="ticket">
<div class="stub">{find_coin(target_fid)}<div class="col" style="flex:1"><span class="cardTitle">{FINDS[target_fid]}</span><span class="hand mute">{for_line}</span></div></div>
<div class="body">
<div class="kickerPill">who goes?</div>{pp}{h}
<div class="row" style="justify-content:space-between"><span class="hand mute">back by {back_by} · one errand a day</span></div>
<a href="#" class="btn gold" style="width:100%">Send {chosen_name}</a>
</div></div>'''
tk = ticket("blue_feather", "for Maya’s Pickles", [("rosie", "Rosie", "back ~7:40", ""), ("bandit", "Bandit", "back ~7:40", "")], "bandit", "7:40pm")
TICKET = page(pen_page(paddock("bandit", "Bandit, in the Pen"), fence("bandit", rosie=True),
                       card("bandit", body1, tape="the job"),
                       overlay=f'<div class="scrim" style="align-items:flex-end;padding:0"></div><div class="sheet"><div class="grabber"></div>{tk}<a href="#" class="btn ghost" style="width:100%">Not now</a></div>'))

# ── 4. Friends row — the target-first door ─────────────────────────────────
def friend_row(pid, who, sub, right):
    return f'''<div class="sticker flat" style="padding:10px 12px;display:flex;align-items:center;gap:12px;transform:rotate(-.4deg)"><span class="who" style="width:44px;height:44px;border-radius:999px;border:2px solid {INK};overflow:hidden;display:flex;align-items:flex-end;justify-content:center;background:{PIG_ACCENT[pid][1]};flex:none;box-sizing:border-box"><img src="{pid}.png" alt="" style="width:92%;height:92%;object-fit:contain"></span><div class="col" style="flex:1;min-width:0"><span class="cardTitleSm">{who}</span><span class="hand mute">{sub}</span></div>{right}</div>'''
FRIENDS = page(f'''<div class="status"></div>
{crown("your herd", "Friends")}
<div style="display:flex;flex-direction:column;gap:12px;padding:14px 18px">
{friend_row("pickles", "Maya", "hoping for a blue feather", tag("sun", "send a pig", "g_pen"))}
{friend_row("rosie", "Theo", "hoping for a glass marble · you have it", tag("sage", "give it", "g_gift"))}
{friend_row("copper", "June", "hoping for an old key · Bandit’s out looking", tag("muted hand", "back ~7:40"))}
{friend_row("rosie", "Sam", "tickled you this morning", tag("hand", "visit ›"))}
<div class="hand mute" style="text-align:center;padding-top:6px">a wish you can fill says <b>give it</b>; one you can’t says <b>send a pig</b> — same row, same tap size</div>
</div>''')

# ── 5. Out — the Pen while Bandit is away ──────────────────────────────────
body5 = f'''{job_seg("out")}
<div class="row" style="gap:12px;padding:4px 0">{find_coin("blue_feather")}<div class="col" style="flex:1"><span class="label">looking for a blue feather</span><span class="hand mute">for Maya’s Pickles · back by 7:40pm</span></div></div>
<a href="#" class="btn ghost" style="width:100%">Call him home</a>'''
OUT = page(pen_page(paddock("bandit", "Bandit’s out looking", rosie_only=True), fence("bandit", out="bandit", rosie=True),
                    card("bandit", body5, tape="out looking")))

# ── 6. Home — the empty yard (Rosie out) ───────────────────────────────────
HOME = page(f'''<div class="status"></div>
<div class="yard">
<div class="corner" style="left:16px"><span class="numeralLg">243</span> <span class="kickerPill" style="color:{INK}">tickled</span></div>
<div class="corner" style="right:16px;background:{PAPER}"><span class="numeralLg">9</span><span class="hand mute"> of 25</span></div>
<div class="mound"></div>
<div class="gone"><div class="cardTitle">Rosie’s out looking</div><div class="hand mute">back by 7:40 · tap to visit the Pen</div></div>
<div class="fanRow"><span class="pill"><img src="g_pen.png" alt="">Rosie · out</span><span class="pill"><img src="g_gift.png" alt="">Trader</span><span class="fab"><img src="g_barn.png" alt=""></span></div>
</div>
<div style="height:90px;background:linear-gradient(180deg,#8d5a2c,#74441e);border-top:2px solid {INK}"></div>''')

# ── 7. Homecoming ───────────────────────────────────────────────────────────
def paddock_home(pid, fid):
    posts = "".join(f'<div class="post" style="left:{x}px;bottom:26px"></div>' for x in (34, 130, 226, 322))
    return f'''<div class="paddock">
<div class="grass"></div><div class="rail" style="bottom:78px"></div><div class="rail" style="bottom:48px"></div>{posts}
<div class="pig" style="left:24px"><img src="rosie.png" alt="Rosie"></div>
<div class="pig" style="right:22px"><img src="{pid}.png" alt=""></div>
<span class="findCoin" style="position:absolute;right:52px;bottom:66px;transform:rotate(8deg)"><img src="f_{fid}.png" alt=""></span>
<div class="note hand">Bandit’s back!</div>
</div>'''
body7 = f'''<div class="row" style="gap:12px">{find_coin("blue_feather")}<div class="col" style="flex:1"><span class="cardTitle">a blue feather</span><span class="hand mute">the one Maya’s Pickles is hoping for</span></div></div>
<a href="#" class="btn gold" style="width:100%">Give it to Maya</a>
<a href="#" class="btn" style="width:100%">Keep it</a>
<div class="hand mute" style="text-align:center">giving pays you both 3 tickles · keeping puts it in your Satchel (4 of 6)</div>'''
HOMECOMING = page(pen_page(paddock_home("bandit", "blue_feather"), fence("bandit", back="bandit", rosie=True),
                           card("bandit", body7, tape="he found it")))

# ── 8. Corkboard — returns wait here ───────────────────────────────────────
def pin(fid, top, sub, paw=False):
    im = f'<img src="f_{fid}.png" alt="">' if fid else '<img src="g_dizzy.png" alt="" style="opacity:.6">'
    return f'<a href="#" class="pin{" paw" if paw else ""}" style="color:{INK}"><span class="kickerPillSm" style="color:{MUTE}">{top}</span>{im}<span class="hand" style="line-height:16px">{sub}</span></a>'
cork = f'''<div class="cork"><span class="lbl">the board · 3 waiting</span>
{pin("blue_feather", "for Maya", "blue feather<br>yesterday")}
{pin("river_pebble", "anything", "river pebble<br>Tue")}
{pin(None, "Rosie", "muddy trotters,<br>nothing else", paw=True)}
</div>
<div class="hand mute" style="text-align:center;margin-top:-4px">three on the board and a pig rests until you look</div>'''
CORK = page(pen_page(paddock("bandit", "Bandit, resting"), fence("bandit", rosie=True), card("bandit", body1, tape="the job"), extra=cork))

# ── 9. States sheet ─────────────────────────────────────────────────────────
recall = f'''<div class="dialog" style="width:330px"><div class="sectionTitle">Call Bandit home?</div><div class="body mute">He’ll come back now, empty-handed. Today’s errand is spent either way.</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:4px"><a href="#" class="btn destructive" style="width:100%">Call him home</a><a href="#" class="btn lilac" style="width:100%">Let him look</a></div></div>'''
empty_hands = card("bandit", f'''<div class="row" style="gap:12px"><span class="findCoin" style="border-style:dashed;background:{CREAM2}"><img src="g_dizzy.png" alt="" style="opacity:.6"></span><div class="col" style="flex:1"><span class="cardTitle">muddy trotters</span><span class="hand mute">he looked everywhere; the feather wasn’t there today. Maya’s wish is still open.</span></div></div><a href="#" class="btn" style="width:100%">Ok, Bandit</a>''', tape="back")
full_bag = card("bandit", f'''<div class="row" style="gap:12px">{find_coin("river_pebble")}<div class="col" style="flex:1"><span class="cardTitle">a river pebble</span><span class="hand mute">your Satchel is full (6 of 6) — he’s keeping it in his mouth until there’s room</span></div></div><a href="#" class="btn" style="width:100%">Open the Satchel</a><a href="#" class="btn ghost sm" style="width:100%">Toss it</a>''', tape="he found it")
failed = f'''<div style="position:relative;width:354px;display:flex;flex-direction:column;gap:12px"><div class="toast"><img src="g_dizzy.png" alt="" style="width:20px;height:20px"><span class="bodySm">The gate stuck. Bandit’s still in the Pen — try again.</span></div>{paddock("bandit", "Bandit, in the Pen")}</div>'''
opening = f'''<div style="width:354px;display:flex;flex-direction:column;gap:12px">{paddock("bandit", "Bandit’s at the gate", rosie_only=True)}<div class="beat"><div class="dots"><i></i><i></i><i></i></div><div class="hand mute">back — opening the gate…</div></div></div>'''
push = f'''<div class="push" style="width:354px"><img src="bandit.png" alt="" style="background:{PIG_ACCENT["bandit"][1]};border:1.5px solid {INK}"><div class="col" style="flex:1"><span class="label">Bandit’s back</span><span class="bodySm mute">He found the blue feather Maya’s Pickles was hoping for.</span></div><span class="hand mute">now</span></div>'''
about = f'''<div class="sheet" style="position:relative;width:354px;border-bottom:2px solid {INK};border-radius:22px;box-shadow:4px 4px 0 {INK}"><div class="grabber"></div>
<div class="row" style="gap:12px"><span class="plate" style="background:{PIG_ACCENT["bandit"][0]}"><span class="handDisplay">Bandit</span></span><div class="col"><span class="label">Black with a cream blaze</span><span class="hand mute">keeps whatever he finds</span></div></div>
<div class="kickerPill" style="margin-top:4px">his nose · lost things</div>
<div class="row" style="gap:8px">{find_coin("brass_button", True)}{find_coin("old_key", True)}<span class="findCoin sm" style="border-style:dashed"><img src="f_tin_whistle.png" alt="" style="opacity:.3"></span><span class="hand mute">2 of 3 · the whistle’s still out there</span></div>
<div class="col" style="gap:6px;margin-top:4px">
<div class="row" style="justify-content:space-between"><span class="label">Nose</span>{pips(2)}<span class="hand mute" style="width:150px">better at lost things</span></div>
<div class="row" style="justify-content:space-between"><span class="label">Trot</span>{pips(1)}<span class="hand mute" style="width:150px">back in about 6h</span></div>
<div class="row" style="justify-content:space-between"><span class="label">Pockets</span>{pips(3)}<span class="hand mute" style="width:150px">sometimes brings two</span></div>
<div class="row" style="justify-content:space-between"><span class="label">Glint</span>{pips(1)}<span class="hand mute" style="width:150px">plain luck</span></div>
</div>
<div class="hand mute" style="margin-top:4px">every pig has seven pips; they just spend them differently</div>
</div>'''
STATES = page(f'''
<div style="padding:24px 28px;display:flex;flex-direction:column;gap:26px">
<div class="col" style="gap:4px"><div class="kicker">the Errand · states</div><div class="sectionTitle">Every state the loop can be in</div></div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("medallion · home", pen.medallion("bandit","Bandit","off"))}
{cell("selected", pen.medallion("bandit","Bandit","on"))}
{cell("out looking (dashed, faded)", medallion("bandit","Bandit","out"))}
{cell("back with something (sun dot)", medallion("bandit","Bandit","back"))}
{cell("job segment · in the Pen", '<div style="width:300px">'+job_seg("pen")+'</div>')}
{cell("job segment · out looking (lilac)", '<div style="width:300px">'+job_seg("out")+'</div>')}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("return · empty hands (never a fail)", '<div style="width:354px">'+empty_hands+'</div>')}
{cell("return · Satchel full (he holds it)", '<div style="width:354px">'+full_bag+'</div>')}
{cell("recall (spends the day)", recall)}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("send failed (turns round at the gate)", failed)}
{cell("push fired, return not materialised yet", opening)}
{cell("the push", push)}
</div>
<div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
{cell("about Bandit — Build 2 (pips, family, tally)", about)}
{cell("ticket hint — Build 2", '<div style="width:354px">'+ticket("marble", "for Theo’s Rosie", [("rosie","Rosie","back ~7:40",""),("pepper","Pepper","back ~9:40",""),("copper","Copper","back ~5:40","")], "rosie", "7:40pm", hint="Pepper’s the better nose for a marble — she’d be back by 9:40.")+'</div>')}
</div>
<div class="hand mute" style="max-width:820px">Reduce Motion: the walk out and the walk in are cuts; the pig is simply gone, then simply back. Otherwise the Lounge walk strips carry him through the gate, and the homecoming lands with the one <b>tap</b> spring. A visitor to an empty yard sees the same hand line, can bless and wish, and the visit still counts.</div>
</div>''', w=1200, h=1500)

BOARDS = {
    "Main.dc.html": MAIN, "Send_Sheet.dc.html": SEND, "Ticket.dc.html": TICKET, "Friends_Door.dc.html": FRIENDS,
    "Out.dc.html": OUT, "Home_Empty_Yard.dc.html": HOME, "Homecoming.dc.html": HOMECOMING, "Corkboard.dc.html": CORK,
    "States.dc.html": STATES,
}
for name, html in BOARDS.items():
    with open(os.path.join(ROOT, name), "w") as f:
        f.write(html)

PH = 844
canvas = {
    "artboards": [
        {"file": "Main.dc.html", "title": "1 · the Pen, the job board", "x": 0, "y": 0, "w": 390, "h": PH},
        {"file": "Send_Sheet.dc.html", "title": "2 · what to look for (friends first)", "x": 480, "y": 0, "w": 390, "h": PH},
        {"file": "Ticket.dc.html", "title": "3 · who goes? the ticket", "x": 960, "y": 0, "w": 390, "h": PH},
        {"file": "Friends_Door.dc.html", "title": "2b · the target-first door", "x": 1440, "y": 0, "w": 390, "h": PH},
        {"file": "Out.dc.html", "title": "4 · out looking", "x": 0, "y": 1000, "w": 390, "h": PH},
        {"file": "Home_Empty_Yard.dc.html", "title": "4b · Home while Rosie is out", "x": 480, "y": 1000, "w": 390, "h": PH},
        {"file": "Homecoming.dc.html", "title": "5 · the homecoming", "x": 960, "y": 1000, "w": 390, "h": PH},
        {"file": "Corkboard.dc.html", "title": "6 · the board (returns wait)", "x": 1440, "y": 1000, "w": 390, "h": PH},
        {"file": "States.dc.html", "title": "7 · states", "x": 0, "y": 2000, "w": 1200, "h": 1500},
    ],
    "annotations": [
        {"id": "loop", "x": 1920, "y": 0, "w": 320, "text": "BUILD 1 · THE ERRAND (docs/design/scavenging-plan-2026-09-17.md §3)\n\nSend a pig to look for a Find; it comes back hours later with it or without it. Every pig is a generic worker in Build 1 (stats and families are Build 2 — the about-sheet and ticket hint on the states board show where they land).\n\nRead left to right: the job board → what to look for (friends' wishes first) → who goes → out → the homecoming (Give / Keep) → the board where returns wait."},
        {"id": "rules", "x": 1920, "y": 300, "w": 320, "text": "RULES DRAWN HERE\n• Rosie is sendable; Home shows the empty yard and says when she's back (4b).\n• One errand per pig per day. A recall spends the day; a failed send doesn't.\n• Only a Find ever comes back. Give = the existing gift swap (3 tickles each). Keep = Satchel; full bag = he holds it in his mouth.\n• Empty hands is muddy trotters, never a fail.\n• The push says who and what; the return is materialised on open (the gate line)."},
        {"id": "next", "x": 1920, "y": 1000, "w": 320, "text": "NOT DRAWN (later)\nBuild 2: families on the find coins, pips on the about sheet (sketched), the curio case in the Barn, the Trader's family fancy + trade-up, the spoken wish bias.\nBuild 3: hands at the Trader, the herd's wishbook."},
    ],
    "launch": {"view": "canvas"},
}
with open(os.path.join(ROOT, "canvas.json"), "w") as f:
    json.dump(canvas, f, indent=1)
print("wrote", len(BOARDS), "boards")
