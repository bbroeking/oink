# The Errand — Build 1 of the scavenging pigs (2026-09-17)

Design canvas: https://claude.ai/code/artifact/3c3d1272-53e4-4d4e-b2c8-be9bc3f3417f

Plan: `../../scavenging-plan-2026-09-17.md` §3 Build 1 (reasoning in `../../pig-search-2026-09-17.md` and `../../finds-sets-and-scavenging-2026-09-17.md`). Every pig is a generic worker in Build 1; the about-sheet and ticket hint on the states board sketch where Build 2's pips and families land.

| Board | What it shows |
| --- | --- |
| `Main.dc.html` | The Pen as the job board: paddock, six medallions (Rosie included — she is sendable), the pig card with the job segment (At home · In the Pen · Out looking) and one action, *Send Bandit to look for…*. |
| `Send_Sheet.dc.html` | What to look for: friends' wishes first, your pig's wish, *anything*. |
| `Ticket.dc.html` | Who goes? — the one confirm ticket both entrances land on: target stub, pig choice with back-by, *one errand a day*, Send. |
| `Friends_Door.dc.html` | The target-first door on the Friends row: *send a pig* on a wish you can't fill, *give it* on one you can, *back ~7:40* on one a pig is already out for. |
| `Out.dc.html` | Out looking: Rosie alone in the paddock, Bandit's medallion dashed, the card shows the errand and *Call him home*. |
| `Home_Empty_Yard.dc.html` | Home while Rosie is out: the mound, *Rosie's out looking · back by 7:40*, the fan's *Rosie · out* row. |
| `Homecoming.dc.html` | He's back: the find on his snout, the tape note, **Give it to Maya** / **Keep it**, the honest line under them. |
| `Corkboard.dc.html` | The board under the paddock where returns wait as pins (for Maya · anything · muddy trotters); three waiting and a pig rests. |
| `States.dc.html` | Medallion and job-segment states; empty hands; Satchel full (he holds it); recall (spends the day); send failed (turns round at the gate); push fired, return not yet materialised; the push itself; Build 2's about-sheet and ticket hint; the Reduce Motion note. |

Regenerate with `python3 gen.py` (imports the Pen boards' generator for tokens and pieces), then re-seed and republish `the-errand.html`.
