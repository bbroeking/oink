# Base-set missing-art generation prompts

Mode: built-in image generation  
Use case: `illustration-story`  
Output: 1024×1536 PNG  
Generated: July 29, 2026

These prompts produced the first complete illustration pass for the 34 cards
that previously had `needs-illustration` status. The selected source files and
their metadata-stripped `-print-vN.png` render derivatives live in
`assets/images/trading-cards/base-set-art/`. `cards.mjs` references the print
derivatives so ImageMagick can embed them reliably in generated SVG and PDF
proofs without altering the original generated PNGs.

## Shared art stem

Create a polished original vertical narrative illustration for a physical
trading-card art window. Match the saturated storybook color, crisp expressive
dark-cocoa ink contours, softly painted layered environments, luminous accents,
chibi fantasy scale, and premium children's-book finish of the supplied style
reference. The energy should recall a cozy 2000s side-scrolling fantasy MMORPG
without copying any existing franchise.

Use a portrait 2:3 full-bleed composition. Keep the main action large and
readable in the central upper two-thirds, use foreground overlap and layered
depth, and keep the lower quarter calmer for card cropping. Preserve a strong
silhouette at thumbnail size.

Do not generate a card frame, title plate, UI, icons, letters, numbers, readable
text, logos, QR codes, borders, or watermarks. Do not copy an existing
character, environment, or trade dress.

Critters and Enemies used `034-firefly-swarm-v1.png` as a painting-style
reference. Hungerling scenes additionally used
`assets/concepts/great-hungerer/hungerlings_hog_v2_rosie_1.png` as an identity
reference. Stunts used `034-firefly-swarm-v1.png` for style and
`assets/images/trading-cards/full-art/rosie-full-art-v1.png` for Rosie's exact
identity.

## Critter scene briefs

- **034 Firefly Swarm:** About twelve enthusiastic golden fireflies spiral in
  different directions above a violet-blue reed marsh and lantern bridge.
- **035 Dewdrop Spider:** A friendly eight-legged spider balances in the center
  of a silvery clover web that catches dew, crumbs, and a flower petal.
- **036 Trough Sparrow:** A tiny plump sparrow stands on a wooden trough rim,
  chest puffed and chirping emphatically at breakfast.
- **037 Bumblebee:** A round fuzzy bumblebee loops through an oversized
  wildflower garden, trailing curling golden pollen.
- **038 Puddle Duckling:** A tiny yellow duckling paddles after pink hoofprints
  through a rain-dappled garden puddle.
- **039 Garden Snail:** A determined snail races down a broad leaf ramp as dew
  and petals fly behind its glossy spiral shell.
- **040 Lantern Rabbit:** A cream rabbit bounds over twilight stepping stones
  while friendly fireflies illuminate the path ahead.
- **041 Bog Frog:** A very round green frog sits resolutely in the exact center
  of a narrow mossy stepping stone.
- **042 Truffle Mole:** A joyful mole bursts from a garden mound holding a
  softly glowing golden truffle above the flying soil.
- **043 Waltzing Moth:** A fuzzy luna-like moth dances around a glowing flower
  lantern at an indigo festival-night pond.
- **044 Shy Field Mouse:** A tawny mouse peeks from beneath a curled leaf while
  quietly pushing a helpful clover sprig onto the path.
- **045 Acorn Squirrel:** A red squirrel bounds along an orchard branch with an
  absurd, carefully balanced armful of acorns.
- **046 Moon Firefly:** A rare silver-blue firefly hovers above a moonlit pond
  carrying a pocket-sized orb of moonlight.
- **047 Coquí Critter:** A tiny emerald coquí sings from a wet orchid leaf while
  two warm light ripples travel through the night air.
- **048 Mud Crab:** A stout coral mud crab charges sideways across a bog path,
  moving a glowing red bead away from a tired plant.
- **049 Glowworm Choir:** Seven glowworms gather on a mossy fallen-log stage,
  their overlapping golden-green light forming one halo.
- **050 Field Mouse Family:** Exactly seven field mice squeeze warmly into a
  root-burrow doorway while passing seeds, clover, and a berry inward.
- **051 Robin Lookout:** A red-breasted robin calls from the highest crooked
  fence post over a windblown garden and reed path.

## Enemy scene briefs

- **053 Peeking Hungerling:** One identity-matched Hungerling peeks from behind
  a giant mushroom while very obviously hiding a glowing truffle.
- **054 Mud-Slick Spider:** A friendly round eight-legged spider skates
  uncontrollably across a glossy mud puddle with silk caught on the reeds.
- **055 Truffle-Thief Crow:** A cheeky blue-black crow swoops from a woodland
  patch with a golden truffle held carefully in its beak.
- **057 Cheek-Stuffed Hungerling:** One identity-matched Hungerling sits in a
  truffle patch with comically enormous stuffed cheeks and one last truffle.
- **058 Bog Bubble:** A translucent violet bog bubble pops to reveal a smaller,
  equally rude bubble inside amid iridescent droplets.
- **059 Root Tangle:** A stubborn spiral of animated roots crosses a woodland
  path and gently pins an abandoned toy shovel by its handle.
- **061 Scurrying Hungerling:** One identity-matched Hungerling dashes through a
  twilight patch clutching three truffles while muddy crumbs fly behind.

## Stunt scene briefs

- **064 Big Wind-Up:** Rosie charges through a mud-derby spiral with three
  translucent wind-up motion echoes behind the single solid foreground Rosie.
- **065 Duck Into the Mud:** Rosie dives snout-first into a soft mud bank as
  leaves pass overhead and a warm protective splash curls around her.
- **066 Quick Change:** Rosie pops through patchwork festival curtains while a
  cap, toy shovel, and aura ribbon whirl around her in a sparkling swap.
- **069 Root Around:** Rosie noses through leaves and garden soil to uncover a
  useful half-buried wooden-handled tool beneath sillier objects.
- **070 Firefly Feint:** Rosie dashes through twilight reeds while a brilliant
  firefly decoy streaks in the opposite direction.
- **072 Mud Wrap:** Rosie relaxes while a ribbon of warm spa mud spirals around
  her like a cozy protective wrap beside a steaming wallow.
- **074 Encore!:** Rosie lands on a lantern-lit festival stage while a
  translucent leap arc shows an immediate second performance.
- **075 Glimmer Truffle:** Rosie discovers a small pearly truffle glowing with
  violet, mint, and rose light beneath giant clover leaves.
- **076 Snoot Boop:** Rosie gives one precise, gentle snout tap to a grumpy
  thorn-root puff, sending out a soft coral-and-gold diplomacy ripple.
