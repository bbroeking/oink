#!/usr/bin/env bash

set -euo pipefail

if ! command -v magick >/dev/null 2>&1; then
	echo "ImageMagick's magick command is required." >&2
	exit 1
fi

output_dir="${1:-assets/rive/prototype/textures}"
reference="assets/images/sprites/rosie/idle_1.png"
pigs=(rosie copper pepper bandit pickles biscuit)

mkdir -p "$output_dir"

alpha_mask="$(mktemp "${TMPDIR:-/tmp}/oink-rive-alpha.XXXXXX.png")"
trap 'rm -f "$alpha_mask"' EXIT

magick "$reference" -alpha extract "$alpha_mask"

for pig in "${pigs[@]}"; do
	source="assets/images/sprites/$pig/idle_1.png"
	output="$output_dir/$pig.png"

	if [[ ! -f "$source" ]]; then
		echo "Missing idle texture for $pig: $source" >&2
		exit 1
	fi

	# Every skin receives Rosie's exact alpha field. Rive can then duplicate one
	# mesh and its weights without skin-dependent outer-geometry drift.
	magick "$source" "$alpha_mask" -compose CopyOpacity -composite "$output"

	difference="$(
		magick compare -metric AE \
			<(magick "$reference" -alpha extract png:-) \
			<(magick "$output" -alpha extract png:-) \
			null: 2>&1 || true
	)"
	if [[ "$difference" != "0 (0)" && "$difference" != "0" ]]; then
		echo "Alpha normalization failed for $pig: $difference" >&2
		exit 1
	fi
done

echo "Built ${#pigs[@]} identical-geometry mesh textures in $output_dir"
