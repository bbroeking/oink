# v0.112 resolved-to-journey handoff prototype verdict

Question: after Provision, Tool, and Pack have each changed the clearing, what
should carry Rosie into the existing idle journey without making the player
read or confirm another result?

All three treatments keep the same deterministic reducer transition, 900 ms
handoff, route, reward, Bag rules, idle journey, and reduced-motion hold.
`?handoff=A|B|C` changes only presentation.

## A — floating story caption

The shipped control repeats **Rosie follows… / The journey continues…** above
Rosie. It is understandable, but it turns the world-led sequence back into a
small report and visually pauses the scene.

## B — physical path marker

A small wooden trail marker places the same idea inside the clearing. It is
more tangible than the caption, but it invents an unexplained object and still
asks the player to read a second explanation after the HUD has named the cause.

## C — trail opens (winner)

Five route-colored lights rise from the completed Pack transfer into the path.
The existing HUD changes to **Warm lights lead Rosie onward · Beyond the
hedge** or **Silver leaves lead Rosie onward · Past the open gate**. There is no
visible card, caption, prompt, or new object. A polite screen-reader status
announces the same route fact. The light path visually anticipates the route
lights in the existing journey watch, so the automatic scene change reads as
continuation rather than dismissal.

Implement C on main. Preserve the current timing and reduced-motion semantics;
do not add a click, reward reveal, Rive trigger, save field, or progression
rule.
