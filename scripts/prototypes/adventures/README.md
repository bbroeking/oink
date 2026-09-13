# Beyond the Hedge Adventure click-through

This is the dedicated, web-only validation surface for Adventures. It starts
with a nearby mystery and contains no crop, plot, harvest, compost, Farm-stock,
or farming-output gate.

Run from the repository root:

```sh
npm run prototype:adventure
```

Then open `http://127.0.0.1:4174/adventures.html?fresh=1`.

The canonical hosted route is:

`https://ticklethepig.com/adventures?fresh=1`

The build also keeps the GitHub Pages artifact available as a fallback at
`https://bbroeking.github.io/oink/adventures.html?fresh=1`.

The page saves only local prototype state and exposes an anonymous copyable
result at the end. It sends no analytics or player data.

Build and test:

```sh
npm run prototype:adventure:build
npm run prototype:adventure:test
```

The older `docs/idle-lab.html` remains historical Beyond-the-Hedge evidence.
The combined `docs/homegrown-adventures.html` remains integration evidence for
the earlier farm-to-Adventure hypothesis; neither is the canonical external
Adventure validation route.
