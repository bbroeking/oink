# Mote Alchemy implementation log

Updated: 2026-08-14

## Goal

Replace the slot-machine presentation with one full-page alchemy machine. The
player sets Warmth, Whirl, and Resonance. The server spends one Mote and returns
0, 3, 5, 10, or 25 Tickles. Rive presents the confirmed result. Rive does not
select, grant, reroll, or save a reward.

## Current gate

Status: visual approval required.

Do not extract runtime layers or edit the Rive source until the user approves
the exact master and the state language.

The four approval images use a 390 x 844 canvas:

| State | File | SHA-256 |
| --- | --- | --- |
| Ready | `assets/concepts/mote-machine/alchemy-master/mote-alchemy-ready-390x844-v2.png` | `e8593800674ae69c14fbd53f4e8f2517520c7ebdcdcd954996319cc0efabc7c4` |
| Active | `assets/concepts/mote-machine/alchemy-master/mote-alchemy-active-390x844-v2.png` | `a6f3068835d45bdf053db12752dff6ed0d18d9ee411a2e5743c63f736c537bb3` |
| Success | `assets/concepts/mote-machine/alchemy-master/mote-alchemy-success-390x844-v2.png` | `e8c239502d5eb854aa39f3f02d3071d71b6cfd02b1257a11d7e0f0a1952e9a49` |
| Failed | `assets/concepts/mote-machine/alchemy-master/mote-alchemy-failed-390x844-v2.png` | `c2d485db0315f32845badd9c636c718866f936f52c57c7d8a7eaf2881544000b` |

The comparison sheet is
`assets/concepts/mote-machine/alchemy-master/mote-alchemy-state-comparison-v2.png`.

ChatGPT Image Gen made the images in reference-image mode. The Ready image is
the registration master. The other images are state references only. They have
small generated geometry changes and must not become separate runtime screens.

Version 2 replaces the realistic fantasy treatment in version 1. It uses the
Tickle the Pig visual system from `PRODUCT.md` and `DESIGN.md`:

- warm cream paper and pastel surfaces;
- dark-brown ink outlines;
- small hard offset shadows with no blur;
- friendly rounded pig forms;
- simple watercolor texture;
- fewer small decorations and larger readable controls;
- a cozy paper-diorama workshop instead of a cinematic fantasy room.

## Approved design rules that do not depend on the image gate

- Use one central glass chamber.
- Use three direct controls: Warmth, Whirl, and Resonance.
- Use one large reaction control.
- Keep the output tray empty before a result.
- A zero result consumes the Mote and produces no Tickles.
- A zero result leaves no residue and no consolation item.
- Do not use reels, paylines, fruit, casino lights, a pull lever, coins, jackpot
  copy, near-miss cues, or slot-machine motion.
- Keep all changing text as live Rive text.
- Keep reward authority on the server.

## Visual review evidence

- The machine is centered on the 390 x 844 canvas.
- The glass chamber is the primary visual object.
- All three controls are in one readable row.
- The reaction control and output tray remain visible above the bottom safe
  area.
- The Active state keeps the tray empty and does not show a result.
- The Success state shows a confirmed Tickles result as light, not as an item.
- The Failed state shows an empty chamber and an empty tray.
- The source images include generated text. The runtime layer pack must remove
  this text and replace it with live Rive text.

## Old-to-new implementation map

| Current slot concept | Mote Alchemy replacement |
| --- | --- |
| `spin` presentation trigger | confirmed reaction presentation trigger |
| three reel strips | chamber liquid, reaction streams, and particle groups |
| lever | reaction plunger |
| reel stop sequence | 3 to 5 second reaction build and resolve sequence |
| reward shelf | output tray |
| `Machine Spin` | full reaction timeline |
| `Machine Settle` | Reduced Motion result settle |
| “reels turning” copy | “reaction is building” copy |
| guaranteed positive result | confirmed result can be 0, 3, 5, 10, or 25 |

The current native route already has these useful safety parts:

- A synchronous in-flight guard blocks duplicate requests.
- A durable request ID supports receipt recovery.
- Native writes the confirmed result before it starts Rive motion.
- Native owns VoiceOver output and a safe runtime fallback.
- The route uses a full-page shell and `Fit.Layout`.

The current implementation still requires these changes:

- Add Warmth, Whirl, and Resonance to the native, Rive, receipt, and RPC
  contracts.
- Store the selected control values in the durable receipt.
- Add the zero-Tickles result to the server and client result types.
- Grant Tickles only when the confirmed result is greater than zero.
- Replace all player-facing spin, reel, and lever copy.
- Replace slot-specific test and verifier requirements.
- Replace the Rive hierarchy and animation with chamber components.
- Keep idempotency, one-Mote debit, timeout recovery, and one announcement per
  receipt.

## Current runtime evidence

The JavaScript, iOS, and Android runtime files are byte-identical. Each file is
1,407,909 bytes. The SHA-256 is
`56ac954904a0088431f13fa6862556ea5548d3fabb6445a4a4f485a1f159175a`.
This file is the old experimental runtime. It is not an accepted Mote Alchemy
export.

## Next action after approval

Generate one consistent component sheet from the Ready master. Then create
clean isolated layers. Register every layer on the 390 x 844 canvas. Build a
local composite and compare it with the Ready master before Rive authoring.

## Safety record

- No database migration was pushed.
- No production data was changed.
- No distributable build was started.
- No store upload was started.
- No files were staged, committed, or pushed.
