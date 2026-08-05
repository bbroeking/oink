# Homegrown Adventures prototype

Throwaway browser prototype for the loop in
`docs/homegrown-adventures-build-goals.md`. It uses one deterministic reducer
and three UI variants; `?variant=A|B|C` changes presentation without changing
the saved simulation.

Run from the repository root:

```sh
npm run prototype:homegrown
```

Then open `http://127.0.0.1:4174/homegrown-adventures.html?variant=A`.

Build and test:

```sh
npm run prototype:homegrown:build
npm run prototype:homegrown:test
```

The web-only Rive wrapper is real and uses `@rive-app/react-webgl2`, but the
checked-in `runtime-sample.riv` is explicitly only a runtime probe. The authored
Rosie/Home scene remains blocked on an export from the Rive editor. Static
concept plates keep the gameplay prototype usable without misrepresenting that
asset as finished.
