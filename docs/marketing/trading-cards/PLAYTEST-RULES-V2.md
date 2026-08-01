# Rosie's Loadout — playtest rules v2

## The goal

Wear the opposing Legend out by reducing its **12 Cheer to 0**. There is no die
roll or battle check: attackers deal their printed Bash. Drawing from an empty
deck is the alternate loss condition.

## Product sizes

- **Learn-to-play:** one Legend plus an 18-card matched deck.
- **Constructed:** one Legend plus a 24-card deck, two copies maximum, and one
  copy maximum for a Legendary card.
- Cards must match at least one of the Legend's two favored styles.

Twenty-four is the first constructed target, not a permanent truth. The
simulator records turns, Training choices, attacks, full-loadout turns, and
Places played so later playtests can justify moving it.

## Board

Each player has one Legend, up to six Training cards, one Head, one Held, one
Aura, two Critters, one Place, a deck, hand, and discard.

## Turn

1. **Ready:** ready your Gear and Critters.
2. **Draw:** draw one.
3. **Grow:** optionally tuck one hand card as Training. Gain one level, unlock
   its style, restore one Cheer, and keep only its Training strip visible.
4. **Act:** play at most one Gear, one Critter, one Stunt, and one Place whose
   rank is no higher than your level and whose style you have trained.
5. **Battle:** attack with Held Gear and any Critters you are willing to
   exhaust. Targets do not strike back.
6. **End:** resolve end-of-turn effects and clear temporary Critter damage.

## The loadout

- **Head:** exhausts to prevent its Guard.
- **Held:** exhausts so the Legend can attack for its Bash.
- **Aura:** supplies one persistent rule rather than a generic stat.
- **Critters:** attack with Bash or stay ready to protect.
- **Place:** one persistent destination; a new Place replaces the old one.

The simulator currently tests a sharper protection rule: one ready Critter may
exhaust to prevent one damage. This gives defense a visible cost and avoids the
paper draft's risk of two permanently ready Critters stalling every attack.

## Why Places belong

Gear answers “what did my pig bring?” Places answer “where is this bout
happening?” One Place slot creates a small build-around choice without adding a
second board. Because a Place is also Training, drawing one is never entirely
dead. Its full-art treatment is a visual category signal, not a power tier.

## Run the simulator

```sh
npm run prototype:loadout
```

Use `train N`, `play N`, `attack gear legend`,
`attack critter:0 legend`, and `next`. Type `state` at any point to inspect the
complete in-memory model.

