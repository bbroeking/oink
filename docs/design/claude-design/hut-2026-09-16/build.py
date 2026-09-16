#!/usr/bin/env python3
"""Writes the Trading Hut canvas artboards (.dc.html) from one shared style block.
Tokens mirror constants/theme.ts as lifted for the Shop canvas (../shop-2026-09-16/).
The hooded bust and the hut are inline-SVG placeholders until the icon sheet lands."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caprasimo&amp;family=Nunito:wght@700;800;900&amp;family=Patrick+Hand&amp;family=Fredoka:wght@600;700&amp;display=swap">'

STYLE = """
    body { margin: 0; background: #fbeee2; color: #2a1f15; font-family: "Nunito", "Trebuchet MS", sans-serif; font-weight: 700; font-size: 15px; line-height: 21px; }
    a { color: #a03e2f; } a:hover { color: #2a1f15; }
    img { display: block; } svg { display: block; }
    .whimsy { font-family: "Caprasimo", "Cooper Black", Georgia, serif; font-weight: 400; }
    .hand { font-family: "Patrick Hand", "Segoe Print", "Comic Sans MS", cursive; font-weight: 400; }
    .pageTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
    .sectionTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 22px; line-height: 24px; letter-spacing: .2px; }
    .cardTitle { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 18px; line-height: 22px; letter-spacing: .2px; }
    .numeral { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 16px; line-height: 20px; }
    .numeralLg { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 26px; line-height: 28px; }
    .body { font-size: 15px; line-height: 21px; }
    .bodySm { font-size: 13px; line-height: 18px; }
    .label { font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; }
    .kicker { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: #a03e2f; }
    .handTxt { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 20px; }
    .handLg { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 17px; line-height: 24px; }
    .kickerPill { font-weight: 800; font-size: 11px; line-height: 14px; letter-spacing: 1.6px; text-transform: uppercase; color: #605449; }
    .mute { color: #605449; }
    .sticker { background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; }
    .tag { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 24px; padding: 2px 12px; border: 1.5px solid #2a1f15; border-radius: 999px; font-weight: 800; font-size: 12px; line-height: 16px; letter-spacing: .3px; background: #fffaf0; white-space: nowrap; box-sizing: border-box; }
    .tag.sun { background: #ffd87a; } .tag.sage { background: #c9dec1; } .tag.muted { background: #f6e6d4; color: #6a5c50; } .tag.rose { background: #ffd6dc; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 11px 18px; border: 2px solid #2a1f15; border-radius: 22px; background: #ffd87a; font-weight: 800; font-size: 15px; letter-spacing: .1px; box-shadow: 2px 2px 0 #2a1f15; white-space: nowrap; box-sizing: border-box; color: #2a1f15; }
    .btn.ghost { background: #fffaf0; } .btn.full { align-self: stretch; }
    /* ── the yard (Home) ── */
    .yard { position: relative; width: 390px; height: 844px; overflow: hidden; background: #c8e3f0 url("yard.jpg") center / cover no-repeat; }
    .earned { position: absolute; top: 70px; left: 20px; background: #ffd6dc; border: 3px solid #2a1f15; border-radius: 16px; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(-3deg); padding: 8px 14px 8px 12px; display: flex; align-items: center; gap: 8px; z-index: 2; }
    .earned img { width: 26px; height: 26px; }
    .earned .n { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 22px; line-height: 22px; }
    .earned .cap { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 11px; line-height: 14px; letter-spacing: 1.5px; text-transform: uppercase; color: #605449; margin-top: 2px; }
    .coin { position: absolute; top: 66px; right: 20px; width: 100px; height: 100px; background: #fffaf0; border: 3px solid #2a1f15; border-radius: 50%; box-shadow: 4px 4px 0 #2a1f15; transform: rotate(4deg); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; box-sizing: border-box; }
    .coin:before { content: ""; position: absolute; inset: 6px; border: 2px dashed rgba(42, 31, 21, 0.25); border-radius: 50%; }
    .coin .big { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 38px; line-height: 40px; letter-spacing: .5px; }
    .coin .cap { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 12px; line-height: 14px; color: #605449; margin-top: 2px; }
    .coin .chip { position: absolute; left: -12px; top: -8px; width: 30px; height: 30px; background: #ffd6dc; border: 2.5px solid #2a1f15; border-radius: 50%; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; justify-content: center; transform: rotate(-8deg); box-sizing: border-box; }
    .coin .chip img { width: 18px; height: 18px; }
    .flame { position: absolute; top: 150px; right: 34px; background: #ffd87a; border: 2.5px solid #2a1f15; border-radius: 10px; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; gap: 4px; padding: 2px 8px 2px 4px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 13px; line-height: 18px; transform: rotate(-3deg); z-index: 3; }
    .flame img { width: 18px; height: 18px; }
    .clockline { position: absolute; top: 184px; right: 22px; font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 14px; line-height: 18px; color: #fffaf0; white-space: nowrap; text-shadow: 0 1px 0 #2a1f15, 1px 0 0 #2a1f15, -1px 0 0 #2a1f15, 0 -1px 0 #2a1f15; }
    .rosie { position: absolute; left: 50%; bottom: 150px; width: 240px; transform: translateX(-50%); z-index: 2; }
    .fab { position: absolute; right: 22px; bottom: 146px; width: 72px; height: 72px; border-radius: 50%; background: #ffd87a; border: 3px solid #2a1f15; box-shadow: 4px 4px 0 #2a1f15; display: flex; align-items: center; justify-content: center; transform: rotate(-3deg); z-index: 6; box-sizing: border-box; }
    .fab svg { width: 40px; height: 40px; }
    .fab .more { position: absolute; right: -8px; top: -8px; width: 26px; height: 26px; border-radius: 50%; background: #fffaf0; border: 2.5px solid #2a1f15; box-shadow: 2px 2px 0 #2a1f15; display: flex; align-items: center; justify-content: center; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 16px; line-height: 16px; box-sizing: border-box; }
    .fab .lbl { position: absolute; right: 84px; top: 50%; transform: translateY(-50%) rotate(-2deg); background: #fffaf0; border: 2px solid #2a1f15; border-radius: 7px; font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; padding: 0 9px; white-space: nowrap; box-shadow: 2px 2px 0 #2a1f15; }
    .mound { position: absolute; left: 30px; bottom: 176px; width: 54px; height: 24px; background: #3a2c1e; border: 2.5px solid #2a1f15; border-radius: 50%; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; z-index: 2; }
    .mound img { position: absolute; left: 50%; top: -16px; transform: translateX(-50%); width: 26px; height: 26px; }
    .htab { position: absolute; left: 0; right: 0; bottom: 0; height: 124px; background: linear-gradient(180deg, #8d5a2c, #74441e); border-top: 3px solid #2a1f15; z-index: 20; }
    .htab:before { content: ""; position: absolute; left: 0; right: 0; top: 10px; height: 3px; background: #2a1f15; opacity: .35; }
    .hsign { position: absolute; top: 30px; width: 62px; height: 66px; background: #fffaf0; border: 3px solid #2a1f15; border-radius: 10px; box-shadow: 3px 3px 0 #2a1f15; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 12px; box-sizing: border-box; }
    .hsign:before { content: ""; position: absolute; top: -22px; left: 50%; width: 2px; height: 22px; background: #2a1f15; transform: translateX(-50%); }
    .hsign svg { width: 22px; height: 22px; }
    .hsign.on { background: #ffc8a8; transform: rotate(-2deg); }
    /* the hut in the yard — a thing in the background up the field, right edge, ~two mounds wide */
    .hut { position: absolute; right: 14px; bottom: 318px; width: 96px; height: 92px; z-index: 1; }
    .hut svg { width: 96px; height: 92px; }
    .glow { position: absolute; right: -4px; bottom: 300px; width: 140px; height: 130px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 216, 122, 0.55), rgba(255, 216, 122, 0)); z-index: 0; }
    .ytag { position: absolute; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 7px; font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 12px; line-height: 18px; padding: 0 8px; white-space: nowrap; box-shadow: 2px 2px 0 #2a1f15; z-index: 4; }
    .receiptToast { position: absolute; left: 18px; right: 136px; top: 56px; z-index: 40; background: #fffaf0; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 4px 4px 0 #2a1f15; padding: 10px 14px; display: flex; align-items: center; gap: 12px; transform: rotate(-0.6deg); }
    .receiptToast img { width: 30px; height: 30px; }
    /* ── the hut section (/hut) — dim bark room, one warm lantern ── */
    .room { position: relative; width: 390px; height: 844px; overflow: hidden; background: #2a1f15; color: #fff3e2; display: flex; flex-direction: column; }
    .room .paper { color: #2a1f15; }
    .planks { position: absolute; inset: 0; background: repeating-linear-gradient(180deg, #3a2c1e 0 46px, #2f2318 46px 48px); }
    .lampGlow { position: absolute; left: 50%; top: 150px; width: 420px; height: 420px; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 216, 122, 0.28), rgba(255, 216, 122, 0)); pointer-events: none; }
    .topbar { position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between; padding: 56px 18px 0; }
    .back { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 12px 6px 8px; border: 2px solid #2a1f15; border-radius: 999px; background: #fffaf0; color: #2a1f15; font-weight: 800; font-size: 13px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; }
    .back svg { width: 16px; height: 16px; }
    .counter { position: relative; z-index: 2; margin: 18px 18px 0; height: 262px; }
    .hatch { position: absolute; left: 50%; top: 0; width: 176px; height: 176px; transform: translateX(-50%); background: #1b130d; border: 3px solid #2a1f15; border-radius: 88px 88px 18px 18px; box-shadow: 4px 4px 0 #2a1f15, inset 0 0 0 6px #5b3b1e; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; box-sizing: border-box; }
    .hatch svg { width: 150px; height: 150px; }
    .hatch.shut { background: repeating-linear-gradient(180deg, #8d5a2c 0 28px, #74441e 28px 30px); }
    .lantern { position: absolute; left: 6px; top: 6px; width: 44px; height: 70px; }
    .slate { position: absolute; right: 0; top: 18px; width: 92px; background: #1b130d; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 4px 4px 0 #2a1f15; padding: 8px 8px 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; transform: rotate(3deg); box-sizing: border-box; }
    .slate .kk { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 11px; line-height: 14px; letter-spacing: 1.2px; text-transform: uppercase; color: #cdbfae; }
    .slate img { width: 44px; height: 44px; }
    .slate .x2 { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 18px; line-height: 20px; color: #ffd87a; }
    .line { position: absolute; left: 50%; top: 186px; transform: translateX(-50%) rotate(-1deg); background: #fffaf0; color: #2a1f15; border: 2px solid #2a1f15; border-radius: 10px; box-shadow: 2px 2px 0 #2a1f15; padding: 6px 12px; font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 15px; line-height: 20px; white-space: nowrap; }
    .slot { position: absolute; left: 50%; top: 232px; width: 150px; height: 14px; transform: translateX(-50%); background: #0e0906; border: 2px solid #2a1f15; border-radius: 7px; box-shadow: inset 0 3px 0 rgba(0,0,0,.6); box-sizing: border-box; }
    .slip { position: absolute; left: 50%; top: 218px; width: 168px; transform: translateX(-50%) rotate(-2deg); background: #fffaf0; color: #2a1f15; border: 2px solid #2a1f15; border-radius: 4px 4px 10px 10px; box-shadow: 4px 4px 0 #2a1f15; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; z-index: 5; box-sizing: border-box; }
    .slip:before { content: ""; position: absolute; left: 0; right: 0; top: -1px; height: 6px; background: repeating-linear-gradient(90deg, #fffaf0 0 8px, #2a1f15 8px 10px); opacity: .5; }
    .slip .stamp { position: absolute; right: 10px; bottom: 10px; width: 40px; height: 40px; border: 2.5px solid #a03e2f; border-radius: 50%; opacity: .75; transform: rotate(-14deg); display: flex; align-items: center; justify-content: center; font-family: "Patrick Hand", cursive; font-size: 10px; line-height: 12px; text-align: center; color: #a03e2f; letter-spacing: 1px; text-transform: uppercase; }
    .section { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 10px; padding: 0 18px; }
    .shead { display: flex; align-items: flex-end; justify-content: space-between; }
    .shead .k { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; letter-spacing: .4px; color: #ffd87a; }
    .shead .t { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 20px; line-height: 24px; color: #fff3e2; }
    .stacks { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .stack { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px 8px; background: #fffaf0; color: #2a1f15; border: 2px solid #2a1f15; border-radius: 14px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; min-height: 88px; }
    .stack img { width: 40px; height: 40px; }
    .stack .n { font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 15px; line-height: 18px; }
    .stack .hint { font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 11px; line-height: 13px; color: #605449; text-align: center; }
    .stack.ready { background: #ffd87a; transform: translateY(-6px); box-shadow: 4px 4px 0 #2a1f15; }
    .stack.ready .deal { position: absolute; top: -12px; right: -8px; background: #c9dec1; border: 2px solid #2a1f15; border-radius: 999px; box-shadow: 2px 2px 0 #2a1f15; padding: 1px 8px; font-family: "Caprasimo", Georgia, serif; font-weight: 400; font-size: 12px; line-height: 16px; white-space: nowrap; }
    .stack.dim { background: #f6e6d4; color: #6a5c50; opacity: .9; }
    .stack.dim img { opacity: .55; }
    .dealings { display: flex; flex-direction: column; gap: 6px; }
    .drow { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fffaf0; color: #2a1f15; border: 2px solid #2a1f15; border-radius: 12px; box-shadow: 2px 2px 0 #2a1f15; box-sizing: border-box; min-height: 44px; }
    .drow img { width: 24px; height: 24px; }
    .drow .when { margin-left: auto; font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; color: #605449; }
    .foot { position: relative; z-index: 2; margin-top: auto; padding: 0 18px 28px; font-family: "Patrick Hand", cursive; font-weight: 400; font-size: 13px; line-height: 18px; color: #cdbfae; text-align: center; }
    .confirm { position: absolute; left: 18px; right: 18px; bottom: 28px; z-index: 30; }
    .scrim { position: absolute; inset: 0; background: rgba(14, 9, 6, 0.62); z-index: 30; }
    .card { position: absolute; left: 22px; right: 22px; top: 250px; z-index: 31; background: #fffaf0; color: #2a1f15; border: 2px solid #2a1f15; border-radius: 18px; box-shadow: 4px 4px 0 #2a1f15; padding: 20px 18px 18px; display: flex; flex-direction: column; gap: 14px; transform: rotate(-0.6deg); box-sizing: border-box; }
    .deal { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; background: #f6e6d4; border: 2px solid #2a1f15; border-radius: 14px; box-sizing: border-box; }
    .deal img { width: 30px; height: 30px; }
    .deal .arrow { font-family: "Caprasimo", Georgia, serif; font-size: 20px; line-height: 24px; }
    .tally { display: flex; align-items: baseline; justify-content: center; gap: 10px; }
    .tally .from { font-family: "Caprasimo", Georgia, serif; font-size: 18px; line-height: 22px; color: #6a5c50; text-decoration: line-through; }
    .tally .to { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 34px; line-height: 36px; }
    .tally .cap { font-family: "Patrick Hand", cursive; font-size: 13px; line-height: 16px; color: #605449; }
"""

# ── placeholder art: the hut (dark / lit) and the hooded bust ──────────────
def hut_svg(lit: bool, tag: str = "", shut: bool = True) -> str:
    lamp = "#ffd87a" if lit else "#6a5c50"
    halo = '<circle cx="18" cy="38" r="14" fill="#ffd87a" opacity=".45"></circle>' if lit else ""
    hatch = ('<rect x="40" y="46" width="30" height="24" rx="4" fill="#1b130d" stroke="#2a1f15" stroke-width="2.5"></rect>'
             + ('<path d="M45 70 Q55 52 65 70 Z" fill="#3e4a6b" stroke="#2a1f15" stroke-width="2"></path><ellipse cx="55" cy="66" rx="5" ry="3.5" fill="#f3e9d8" stroke="#2a1f15" stroke-width="1.5"></ellipse>' if not shut else
                '<path d="M40 52 H70 M40 58 H70 M40 64 H70" stroke="#74441e" stroke-width="5"></path><path d="M40 52 H70 M40 58 H70 M40 64 H70" stroke="#2a1f15" stroke-width="1.2"></path>'))
    return f'''<svg viewBox="0 0 96 92">
  {halo}
  <path d="M12 44 L50 14 L90 40 L86 42 L50 20 L16 46 Z" fill="#3e4a6b" stroke="#2a1f15" stroke-width="2.5" stroke-linejoin="round"></path>
  <path d="M14 44 H86 L84 88 H18 Z" fill="#8d5a2c" stroke="#2a1f15" stroke-width="2.5" stroke-linejoin="round"></path>
  <path d="M22 54 H80 M20 64 H82 M20 74 H80" stroke="#5b3b1e" stroke-width="2"></path>
  <path d="M14 44 L50 16 L86 42" fill="none" stroke="#2a1f15" stroke-width="2.5" stroke-linejoin="round"></path>
  <path d="M8 40 L20 36 M88 38 L92 30" stroke="#c8ad77" stroke-width="2" stroke-linecap="round"></path>
  {hatch}
  <rect x="22" y="58" width="12" height="30" rx="2" fill="#5b3b1e" stroke="#2a1f15" stroke-width="2.5"></rect>
  <rect x="60" y="84" width="22" height="8" rx="2" fill="#a07a4a" stroke="#2a1f15" stroke-width="2"></rect>
  <path d="M18 24 V38" stroke="#2a1f15" stroke-width="2"></path>
  <rect x="12" y="32" width="12" height="14" rx="3" fill="{lamp}" stroke="#2a1f15" stroke-width="2.5"></rect>
</svg>'''

BUST = '''<svg viewBox="0 0 150 150">
  <path d="M20 150 C22 108 50 96 75 96 C100 96 128 108 130 150 Z" fill="#f3e9d8" stroke="#2a1f15" stroke-width="3"></path>
  <path d="M60 128 L120 150 M52 150 L112 118" stroke="#b98b3e" stroke-width="7" stroke-linecap="round"></path>
  <path d="M60 128 L120 150" stroke="#2a1f15" stroke-width="2"></path>
  <path d="M30 118 C22 70 40 30 82 26 C118 24 132 60 124 118 C112 108 96 100 80 100 C60 100 44 108 30 118 Z" fill="#3e4a6b" stroke="#2a1f15" stroke-width="3" stroke-linejoin="round"></path>
  <path d="M44 106 C52 80 64 70 82 70 C100 70 110 80 114 104 C104 96 92 92 80 92 C68 92 54 96 44 106 Z" fill="#1b130d"></path>
  <path d="M70 92 C60 92 52 100 54 112 C60 120 76 122 90 116 C102 110 102 98 92 92 C86 89 78 89 70 92 Z" fill="#f3e9d8" stroke="#2a1f15" stroke-width="2.5"></path>
  <ellipse cx="80" cy="106" rx="7" ry="5" fill="#2a1f15"></ellipse>
  <path d="M36 62 C28 52 30 40 42 38 C46 46 44 54 40 60 Z M120 60 C128 50 126 38 114 36 C110 44 112 52 116 58 Z" fill="#f3e9d8" stroke="#2a1f15" stroke-width="2.5" stroke-linejoin="round"></path>
</svg>'''

LANTERN = '''<svg viewBox="0 0 44 70"><path d="M22 2 V12" stroke="#2a1f15" stroke-width="3"></path><path d="M10 14 H34 L30 22 H14 Z" fill="#5b3b1e" stroke="#2a1f15" stroke-width="2.5" stroke-linejoin="round"></path><rect x="12" y="22" width="20" height="30" rx="3" fill="#ffd87a" stroke="#2a1f15" stroke-width="2.5"></rect><path d="M22 28 V46" stroke="#ff9b3d" stroke-width="5" stroke-linecap="round"></path><path d="M10 52 H34 L30 60 H14 Z" fill="#5b3b1e" stroke="#2a1f15" stroke-width="2.5" stroke-linejoin="round"></path></svg>'''
LANTERN_OFF = LANTERN.replace('#ffd87a', '#3a2c1e').replace('#ff9b3d', '#2a1f15')

FAB = '''<div class="fab"><svg viewBox="0 0 64 64"><path d="M8 26 L32 8 L56 26 V58 H8 Z" fill="#ffc8a8" stroke="#2a1f15" stroke-width="3" stroke-linejoin="round"></path><rect x="16" y="30" width="16" height="28" fill="#a03e2f" stroke="#2a1f15" stroke-width="3" stroke-linejoin="round"></rect><path d="M16 30 L32 58 M32 30 L16 58" stroke="#2a1f15" stroke-width="2.4" stroke-linecap="round"></path><rect x="32" y="30" width="16" height="28" fill="#3a2c1e" stroke="#2a1f15" stroke-width="3" stroke-linejoin="round"></rect><path d="M36 44 H48 M44 39 L49 44 L44 49" fill="none" stroke="#fff3e2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg><div class="more">+</div><div class="lbl">barn</div></div>'''

HTAB = '''<div class="htab"><div class="hsign on" style="left: 16px;"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9l8-5 8 5v11M4 20h16M9 20v-7h6v7M9 13l6 7M15 13l-6 7"></path></svg><span>Barn</span></div><div class="hsign" style="left: 92px; transform: rotate(1.5deg);"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.5"></circle><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M15 19c0-2 1.5-3.5 4-3.5s3 1.5 3 3.5"></path></svg><span>Friends</span></div><div class="hsign" style="left: 168px; transform: rotate(-1deg);"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"></path></svg><span>Season</span></div><div class="hsign" style="left: 244px; transform: rotate(2deg);"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"></path></svg><span>Shop</span></div><div class="hsign" style="left: 320px; transform: rotate(-1.5deg);"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg><span>Me</span></div></div>'''

BACK = '''<div class="back"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>Yard</div>'''
SLIP_ICON = '''<svg viewBox="0 0 24 24" fill="none" stroke="#2a1f15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"></path><path d="M9 8h6M9 12h6"></path></svg>'''

def page(title: str, body: str) -> str:
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <title>{title}</title>
  {FONTS}
  <style>{STYLE}  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
'''

def yard(hut_html: str, extra: str = "", coin: str = "38") -> str:
    return f'''<div class="yard">
  <div class="earned"><img src="g_heart.png" alt=""><div><div class="n">1,126</div><div class="cap">tickled</div></div></div>
  <div class="coin"><div class="chip"><img src="g_heart.png" alt=""></div><div class="big">{coin}</div><div class="cap">of 25</div></div>
  <div class="flame"><img src="g_flame.png" alt="">12</div>
  <div class="clockline">+1 in 42:10</div>
  {hut_html}
  <img class="rosie" src="rosie_sprite.png" alt="">
  <div class="mound"><img src="g_truffle.png" alt=""></div>
  {FAB}
  {extra}
  {HTAB}
</div>'''

# 1 · Home · the hut, dark, just tapped
main = yard(
    f'<div class="hut">{hut_svg(lit=False)}</div>',
    '<div class="ytag" style="right: 18px; bottom: 296px; transform: rotate(-2deg);">Shut. Someone\'s in there.</div>'
)

# 2 · Home · the lantern lit, after a dig receipt
lit = yard(
    f'<div class="glow"></div><div class="hut">{hut_svg(lit=True, shut=False)}</div>',
    '<div class="receiptToast"><img src="f_river_pebble.png" alt=""><div><div class="label">Satchel got heavier</div><div class="handTxt mute">a river pebble — that makes three</div></div></div>'
)

def room(hatch_inner: str, line: str, slate: str, after_counter: str, stacks: str, today: str, dealings: str, overlay: str = "", lantern: str = LANTERN, hatch_cls: str = "") -> str:
    return f'''<div class="room">
  <div class="planks"></div>
  <div class="lampGlow"></div>
  <div class="topbar">{BACK}<div class="tag muted">{today}</div></div>
  <div class="counter">
    <div class="lantern">{lantern}</div>
    <div class="hatch {hatch_cls}">{hatch_inner}</div>
    {slate}
    <div class="line">{line}</div>
    <div class="slot"></div>
    {after_counter}
  </div>
  <div class="section" style="margin-top: 18px;">
    <div class="shead"><div><div class="k">your satchel</div><div class="t">Stacks</div></div><div class="tag sage">sets only</div></div>
    <div class="stacks">{stacks}</div>
  </div>
  <div class="section" style="margin-top: 18px;">
    <div class="shead"><div><div class="k">proof you were there</div><div class="t">Dealings</div></div></div>
    <div class="dealings">{dealings}</div>
  </div>
  <div class="foot">Sets only. Three of one find.</div>
  {overlay}
</div>'''

SLATE = '<div class="slate"><div class="kk">today I fancy</div><img src="f_honeycomb.png" alt=""><div class="x2">×2</div></div>'
SLATE_OFF = '<div class="slate" style="opacity:.55"><div class="kk">tomorrow</div><div class="x2" style="color:#cdbfae">?</div></div>'

def stack(img, n, cls="", hint="", deal=""):
    d = f'<div class="deal">{deal}</div>' if deal else ""
    h = f'<div class="hint">{hint}</div>' if hint else ""
    return f'<div class="stack {cls}">{d}<img src="{img}" alt=""><div class="n">×{n}</div>{h}</div>'

STACKS_READY = (stack("f_river_pebble.png", 3, "ready", "", "3 → +5") + stack("f_wool_tuft.png", 2, "dim", "one more")
                + stack("f_old_key.png", 1, "dim", "two more") + stack("f_pinecone.png", 1, "dim", "two more")
                + stack("f_blue_feather.png", 2, "dim", "one more") + stack("f_marble.png", 1, "dim", "two more"))
STACKS_AFTER = (stack("f_wool_tuft.png", 2, "dim", "one more") + stack("f_old_key.png", 1, "dim", "two more")
                + stack("f_pinecone.png", 1, "dim", "two more") + stack("f_blue_feather.png", 2, "dim", "one more")
                + stack("f_marble.png", 1, "dim", "two more"))
DEALINGS_EMPTY = '<div class="drow" style="justify-content:center"><div class="handTxt mute">no dealings yet</div></div>'
DEALINGS_ONE = f'<div class="drow">{SLIP_ICON}<img src="f_river_pebble.png" alt=""><div class="label">3 river pebbles · +5</div><div class="when">just now</div></div>'
DEALINGS_MANY = (f'<div class="drow">{SLIP_ICON}<img src="f_river_pebble.png" alt=""><div class="label">3 river pebbles · +5</div><div class="when">today</div></div>'
                 f'<div class="drow">{SLIP_ICON}<img src="f_honeycomb.png" alt=""><div class="label">3 honeycomb chips · +24</div><div class="when">today</div></div>'
                 f'<div class="drow">{SLIP_ICON}<img src="f_pinecone.png" alt=""><div class="label">3 pinecones · +5</div><div class="when">today</div></div>')

# 3 · /hut · first entry — onboarding over the counter
onboarding = room(BUST, "Three of a kind, little pig.", SLATE, "", STACKS_READY, "0 of 3 today", DEALINGS_EMPTY,
    overlay='''<div class="scrim"></div>
  <div class="card">
    <div class="kicker">★ the hut</div>
    <div class="handLg">“I take sets. You take tickles. Don’t ask where they go.”</div>
    <div class="deal"><img src="f_river_pebble.png" alt=""><img src="f_river_pebble.png" alt=""><img src="f_river_pebble.png" alt=""><div class="arrow">→</div><div class="tag sun">+5 tickles</div></div>
    <div class="btn full">Show me</div>
  </div>''')

# 4 · /hut · the counter, open, a set ready — confirm pill armed
counter = room(BUST, "Sets. Only sets.", SLATE, "", STACKS_READY, "0 of 3 today", DEALINGS_EMPTY,
    overlay='<div class="confirm"><div class="btn full">Hand over 3 river pebbles · +5 tickles</div></div>')

# 5 · /hut · the slip — just after the sale
slip = room(BUST, "Come back with more.", SLATE, '''<div class="slip">
      <div class="kickerPill">the stranger</div>
      <div class="label">3 river pebbles</div>
      <div class="tally"><div class="from">38</div><div class="to">43</div><div class="cap">tickled</div></div>
      <div class="handTxt mute">“Come back with more.”</div>
      <div class="stamp">paid</div>
    </div>''', STACKS_AFTER, "1 of 3 today", DEALINGS_ONE)

# 6 · /hut · known dark — shutters down, lantern out
dark = room("", "That’s my lot till midnight.", SLATE_OFF, "", STACKS_AFTER, "3 of 3 · resets at midnight", DEALINGS_MANY, lantern=LANTERN_OFF, hatch_cls="shut")

# 7 · Rationale — the states and the rules (flow print)
rationale = '''<div style="width: 900px; background: #fffaf0; color: #2a1f15; padding: 40px 48px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px;">
  <div class="kicker">★ the trading hut · flow notes</div>
  <div class="pageTitle">The hut is scenery; the sheep is a state.</div>
  <div class="body" style="max-width: 720px;">A crooked hut stands up the field on every background from the first launch. Nothing announces it. When a dig lands your third of a find, the lantern lights and the hooded bust looks out of the hatch — that is the whole notification. Tap it and the yard dims into the hut. Three of one find for tickles, three sets a day, a printed slip as the receipt. The shade is tone, never terms: the exact tickles are on the chip before you confirm.</div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">
    <div class="sticker" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"><div class="cardTitle">unmet · dark</div><div class="bodySm">Shutters closed, no light. Tap: the shutters rattle, a tag — <span class="hand">Shut. Someone’s in there.</span> No section yet.</div></div>
    <div class="sticker" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; background: #ffd87a;"><div class="cardTitle">lit</div><div class="bodySm">Any stack of three, and sets left today. Lantern on, bust in the hatch. Tap: door-swing into <span class="hand">/hut</span>. First time: the onboarding line + the exact deal.</div></div>
    <div class="sticker" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"><div class="cardTitle">known · dark</div><div class="bodySm">Met, but no sets or none left. Dark hut, section still opens: shutters down, <span class="hand">Nothing for me today?</span> / <span class="hand">That’s my lot till midnight.</span>, stacks with “one more”.</div></div>
  </div>
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
    <div style="display: flex; flex-direction: column; gap: 6px;"><div class="sectionTitle">The deal</div><div class="bodySm">Exactly three of one find, oldest three leave the bag. Common 5 · uncommon 12 · rare 30 applied tickles (score, never the bank). Today’s fancy on the slate pays ×2. Three sets a day; the shutters close on the third. Never singles, never mixed, never a find in someone’s ask.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px;"><div class="sectionTitle">Placement</div><div class="bodySm">One overlay hut at the right edge, up the field (behind Rosie’s ground line, clear of the Barn button and the coin), on all 47 backgrounds — Rosie and the mound already sit on the painterly scenes as cartoon overlays. No hut on the Interior or on a friend’s visit. A bespoke variant only for a scene the founder rejects on the sim.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px;"><div class="sectionTitle">What the section is not</div><div class="bodySm">No swaps, asks, friends or shop. One deal, one rule line. Reached only through the hut — never a tab, never the Barn fan.</div></div>
    <div style="display: flex; flex-direction: column; gap: 6px;"><div class="sectionTitle">Art still to land</div><div class="bodySm">The hooded bust and the hut here are placeholders. Icon sheet (one row: <span class="hand">stranger · hut · slip</span>, framed like pigface.png) → the yard hut as two layers (dark + lantern glow) → a 4-frame hatch family. Spec: docs/design/2026-09-16-trading-hut.md.</div></div>
  </div>
</div>'''

files = {
    "Main.dc.html": page("Home · the hut, dark", main),
    "HutLit.dc.html": page("Home · the lantern lit", lit),
    "HutOnboarding.dc.html": page("The hut · first entry", onboarding),
    "HutCounter.dc.html": page("The hut · the counter", counter),
    "HutSlip.dc.html": page("The hut · the slip", slip),
    "HutDark.dc.html": page("The hut · shutters down", dark),
    "Rationale.dc.html": page("Flow notes", rationale),
}
for name, html in files.items():
    with open(os.path.join(HERE, name), "w") as f:
        f.write(html)
print("wrote", ", ".join(files))
