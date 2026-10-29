# Matchmade play — initial concept boards

**2026-10-02 revision:** user requires head-to-head wins/rating alongside cooperative options. [02-mud-volley-ranked-v2.png](02-mud-volley-ranked-v2.png) is the current competitive concept: random rivals, individual Splats and a season leaderboard. It was edited using built-in image_gen with the exact [revision prompt](02-mud-volley-ranked-prompt.txt). The original five boards below remain the initial cooperative/social exploration; their friend-entry buttons are historical sketches.

Started 2026-10-01. Generated with the **built-in image_gen tool**, using the project's pig lineup, barn concept and Visit screenshot as reference images. These are proposed UI/gameplay directions, not shipped screenshots or runtime assets.

| Board | Rule |
| --- | --- |
| [01-tickle-duet.png](01-tickle-duet.png) | Make and copy a partner's tickle/boop phrase |
| [02-mud-volley.png](02-mud-volley.png) | Cooperatively toss and catch across a fence |
| [03-truffle-trail.png](03-truffle-trail.png) | One pig sends a scent clue; another digs |
| [04-picnic-relay.png](04-picnic-relay.png) | Picker receives requests; Mixer alone sees the recipe |
| [05-pig-pageant.png](05-pig-pageant.png) | Dress from an equal loaner trunk and cheer |

Each board contains an entry screen, active UI and expressive gameplay vignette. The final Mud Volley board uses one shared tally. The final Trail/Picnic boards expose only the partner's sent clue/request on the local role view.

Exact initial prompts are in [prompts.json](prompts.json); targeted edit prompts and selected outputs are in [revisions.json](revisions.json). The initial competitive Volley draft was rejected to fit the product charter. Initial Trail/Picnic views were corrected to preserve the proposed partial-information play.

Future implementation should map layouts to existing tokens, Glyphs, native accessible controls and PigStage; concept props and art are not proof that new animation families or costume slots already exist. Written rules take precedence over illustrative decoration.

See the [gallery](../../../../docs/explorations/2026-10-01-matchmade-play/index.html), [concept descriptions](../../../../docs/explorations/2026-10-01-matchmade-play/concepts.md) and [current ranked matchmaking specification](../../../../docs/explorations/2026-10-01-matchmade-play/ranked-matchmaking-spec.md).
