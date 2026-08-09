# v0.118 carrier-language prototype

## Question

Rosie now visibly wears her permanent Adventure Bag. Does the third loadout
slot still read truthfully when its chosen object is a second carrier—or when
the slot is empty?

## Runnable treatments

- `?position=7&carrier=A` — **Pack** (current production language).
- `?position=7&carrier=B` — **Carrier** (names the separate object by function).
- `?position=7&carrier=C` — **Find Kit** (names the discovery-handling job).

All three treatments preserve the same reducer slot (`bag.pack`), Wicker
Basket, Cloth Wrap, empty choice, costs, deterministic results, accessibility,
Rive asset, and persistent hip satchel. Only player-facing vocabulary changes.

## Evidence to compare

Review Position 7 empty and selected states, Position 8 departure, and the
first Position 9 causal clearing. Ask whether a player can explain why Rosie
wears a Bag while also choosing—or declining—the third item.

Do not merge the switcher. Record the winning language, then implement only
that bounded vocabulary on main if the rendered comparison supports it.

## Rendered verdict

**B — Carrier wins.**

- **Pack** repeats the overall Bag metaphor. It makes `Pack: Empty` appear to
  contradict the permanent satchel that Rosie is visibly wearing.
- **Find Kit** explains the mechanic but asks the player to translate familiar
  objects such as a Wicker Basket into a more abstract system name.
- **Carrier** names exactly why the third object is separate from Rosie's Bag:
  the Bag holds her Provision and Tool; the Carrier determines whether the
  find itself can come Home. `Carrier: Wicker Basket` remained clear in the
  departure ribbon and idle folio, including the incomplete-Bag branch.

The production checkpoint should change player-facing vocabulary only. Keep
the internal `bag.pack` field, Rive satchel, item identities, costs, outcomes,
save format, and all other gameplay untouched. Do not ship the `carrier` query
parameter or the three-treatment switcher.
