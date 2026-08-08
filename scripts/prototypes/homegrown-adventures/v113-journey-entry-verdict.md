# v0.113 clearing-to-idle-watch transition prototype

Question: after the route lights open beyond Rosie, how should the existing
idle Farm watch receive that handoff without feeling like a hard cut into a
dashboard?

All treatments keep the same reducer transition, six-hour timestamps, idle
journey, route, Field Guide result, rewards, reload behavior, and reduced-motion
path. `?journeyentry=A|B|C` changes only the first 900 ms after the already
automatic handoff.

## A — current cut

The clearing disappears and the complete Farm watch, field note, return ticket,
packed stamp, and route arrive together. It is fast but reads as a screen change
and information dump.

## B — dusk dissolve

A route-tinted dusk veil carries the palette across the image change while the
existing information waits briefly. It softens the cut, but the transition is
generic and loses the path lights the player was already following.

## C — lights arrive at Home

The five route-colored lights keep their clearing positions across the image
change, travel into the Farm path, and fade as the existing note, ticket, stamp,
route, and prototype fast-forward settle in. The underlying Farm remains the same idle watch. This is
the strongest candidate because the same world object crosses the edit and
explains why attention returns Home before the information appears.

Production should implement C as ephemeral React presentation only. Direct
reload and reduced motion should paint the stable idle watch immediately; no
save field, reducer state, timer fact, route, reward, confirmation, loading
screen, or Rive trigger should be added.
