# Rive pig prototype assets

This directory contains source art for the decision spike described in
`docs/design/rive-homepage-implementation-plan-2026-07.md`.

The files are not production homepage assets. The generated parts decomposition
must first prove that Rosie can be reassembled faithfully and that Pickles can
be represented as paint and markings on the exact same geometry.

## Source

- `source/rosie-rig-parts-chromakey-v1.png` is the built-in image-generation
  output using `assets/images/pigs/normalized/rosie.png` as the locked reference.
- `source/rosie-rig-parts-v1.png` is the locally alpha-matted version.
- `source/rosie-body-base-v2.png` replaces the first sheet's torso because that
  version still contained limb stubs and could not rotate cleanly beneath the
  four separate legs.
- `rig-manifest.json` records the proposed hierarchy, pivots, prototype skins,
  cosmetic stress cases, and animation scope.

## Extract parts

From the repository root:

```sh
scripts/rive/extract-prototype-rig-parts.sh
```

This writes 15 transparent, individually importable PNGs under
`parts/rosie/`. The crop coordinates are intentionally fixed to the v1 source
sheet so a changed source cannot silently move pivots.

The decomposed-parts assembly did not pass the Rosie silhouette review and is
retained only as an investigated prototype lane. The active Rive lane uses the
approved full idle sprite as a deformable image mesh.

## Build mesh textures

```sh
scripts/rive/build-prototype-mesh-textures.sh
```

This builds all six `textures/*.png` files from the current `idle_1` art while
copying Rosie's exact alpha field to every output. All six textures therefore
have identical canvas dimensions and outer geometry and can use duplicated
mesh vertices and bone weights inside one Rive file.

## Authoring rule

Create one skeleton and one animation set. Duplicate one image mesh and its
weights for all six normalized textures, then switch those identical meshes
through one skin Solo. Skins may not have separate bones, joint coordinates, or
animation timelines.
