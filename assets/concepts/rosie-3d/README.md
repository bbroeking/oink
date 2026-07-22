# Rosie quadruped 3D references

`rosie-quadruped-turnaround-v1.png` was generated from `docs/rosie.png` as a consistent four-view reference for Meshy multi-image-to-3D reconstruction and quadruped rigging.

The four `rosie-quadruped-*-v1.png` files are cropped inputs from that sheet: front, left, rear, and right.

## Rig-ready v3

`rosie-rig-ready-turnaround-v3.png` redesigns the neutral pose around animation needs:

- a raised, readable belly instead of a surface that blends into the thighs;
- a widened stance with the far-side legs still visible in profile;
- four straight, separated legs and clean ankle/hoof boundaries; and
- a longer external tail stalk before the curl, leaving clearance from the rump.

Use the four files in `v3-rig-ready/` as Meshy multi-image inputs in this order:

1. `rosie-rig-ready-front-v3.png`
2. `rosie-rig-ready-left-v3.png`
3. `rosie-rig-ready-rear-v3.png`
4. `rosie-rig-ready-right-v3.png`

The rear view was generated separately so the tail reads as a projecting appendage rather than a flat curl embedded in the rump.
