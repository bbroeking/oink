# Pack opening cue sheet

Audio and haptics are host-owned. Rive supplies visual phase; React Native fires
these cues and respects mute/reduced-motion settings.

| Cue | Visual moment | Audio | Haptic |
| --- | --- | --- | --- |
| packet_pickup | Pack becomes interactive | short waxed-paper lift | light impact |
| tear_tension | tearProgress crosses 0.25 | low paper strain loop begins | none |
| tear_release | tearProgress reaches 1 or tap-open commits | dry seam rip, 180–260 ms | medium impact |
| card_land | each card reaches settled pose | soft card-on-paper pat | selection |
| foil_glint | foil inspection begins | quiet glassy brush | light impact, once |
| living_visit | living illustration opens | card-specific 1.5–2.5 s ambience | none |
| pack_complete | fifth card settles | pleased pig snort + scrapbook tap | success |
| reset | replay returns to sealed pack | subtle paper fold | none |

Never loop a haptic with the continuous tear gesture. Quantize audio feedback at
thresholds while visual tearProgress remains continuous.

