#!/usr/bin/env bash

set -euo pipefail

if ! command -v magick >/dev/null 2>&1; then
	echo "ImageMagick's magick command is required." >&2
	exit 1
fi

input="${1:-assets/rive/prototype/source/rosie-rig-parts-v1.png}"
output_dir="${2:-assets/rive/prototype/parts/rosie}"
body_source="assets/rive/prototype/source/rosie-body-base-v2.png"

if [[ ! -f "$input" ]]; then
	echo "Input parts sheet not found: $input" >&2
	exit 1
fi

mkdir -p "$output_dir"

extract_part() {
	local name="$1"
	local geometry="$2"

	magick "$input" \
		-crop "$geometry" \
		+repage \
		-bordercolor none \
		-border 16 \
		"$output_dir/$name.png"
}

# These crops are locked to rosie-rig-parts-v1.png. Each rectangle is the
# connected alpha-component bound plus a 16 px transparent working margin.
extract_part "head_base" "564x519+98+37"
extract_part "ear_screen_left" "244x196+699+63"
extract_part "ear_screen_right" "226x200+1124+64"
extract_part "eye_screen_left" "106x108+754+300"
extract_part "eye_screen_right" "100x105+977+303"
extract_part "snout" "199x142+1169+301"
extract_part "cheek_screen_left" "129x101+728+461"
extract_part "cheek_screen_right" "123x99+980+463"
extract_part "mouth" "173x81+1180+486"
extract_part "leg_bent_screen_left" "170x275+673+656"
extract_part "leg_bent_screen_right" "170x277+865+656"
extract_part "leg_straight_screen_left" "157x261+1070+672"
extract_part "leg_straight_screen_right" "182x256+1261+661"
extract_part "tail" "85x92+83+686"

if [[ ! -f "$body_source" ]]; then
	echo "Clean body source not found: $body_source" >&2
	exit 1
fi

magick "$body_source" \
	-trim \
	+repage \
	-bordercolor none \
	-border 16 \
	"$output_dir/body_base.png"

echo "Extracted 15 prototype rig parts to $output_dir"
