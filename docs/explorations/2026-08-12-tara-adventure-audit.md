# Tara's independent Adventure audit

**Date:** 2026-08-12  
**Surface:** `https://ticklethepig.com/adventures?fresh=1`  
**Role:** adversarial product playtester and web QA evaluator  
**Scope boundary:** no product code, configuration, deployment, database, or existing documentation was changed for this audit.

## Verdict

**Iterate before using this prototype as evidence that preparation causality is validated.** The hosted artifact is technically stable, genuinely has no farming prerequisite, works across the tested viewport sizes, preserves state, exposes a fixed first-return reward, sends no analytics payloads, and leaves the surrounding site routes healthy. The central product test is nevertheless confounded: 16 apparently meaningful loadouts collapse into four priority-ordered results, and many selected dimensions have no effect while the interface says that every choice mattered. A replay also displays a second `+20 tickles` receipt without increasing the total beyond 140.

This is ready for internal discussion and moderated exploratory sessions after those limitations are disclosed. It is not ready to support a claim that Tool, Pack, Intention, and trip shape are all legible causal levers, nor that repeated Adventures satisfy the earn-more-tickles loop.

## Evidence and method

- Exercised all 16 Tool × Pack × Intention × trip-shape combinations against the live return screen.
- Completed normal click-throughs for the default Wicker Basket path, Dry Bag path, Good Wander + Wooden Spoon path, and Lantern + strange-intention path.
- Exercised Previous/Next, Change one thing, Start fresh, local resume after refresh, shareable URL state, verdict selection, anonymous result copy, and browser Back.
- Inspected the source model in `scripts/prototypes/adventures/game.mjs`, renderer in `app.mjs`, styles, generated public files, tests, design brief, and playtest guide.
- Ran true Chrome viewport checks for every screen at 320, 375, 390, 430, and 1280 CSS pixels (25 screen/viewport cases).
- Inspected keyboard focus order and focus styling at 390px, OS reduced-motion emulation, manual reduced-motion behavior, touch-target dimensions, image load state, layout overflow, runtime logs, and live request traffic.
- Checked live HTTP status and relevant headers for Adventures, privacy, referral/invite, redemption, and Apple association routes.

## Severity-ranked findings

| Severity | Type | Finding | Consequence |
| --- | --- | --- | --- |
| **High** | Objective product logic | Sixteen advertised loadouts collapse into four priority-ordered outcomes; numerous chosen dimensions are ignored while the journey and return claim that the choices mattered. | The prototype cannot cleanly validate its primary causality question. |
| **High** | Objective economy behavior | First completion changes 120 → 140, but completing another Adventure via **Change one thing** leaves the total at 140 while showing another `+20 tickles` receipt. | Repeated play does not visibly earn more tickles and the receipt becomes misleading. |
| **Medium** | Heuristic product | The lasting Home consequence is prose over one unchanged return/home scene, not a visible persistent world change. | Testers may remember the Find but fail the Home-consequence threshold. |
| **Medium** | Heuristic product | Mechanical farming separation passes, but the validation chrome repeatedly names crops, plots, harvests, compost, Farm stock, crop requirements, and Farming. | Negating farming may prime exactly the Farm mental model the test is intended to exclude. |
| **Medium** | Objective privacy/trust | A full run made only GET requests and no analytics requests, but it contacted Google Fonts. | The absolute statement “No … personal data” is too broad because normal connection metadata is disclosed to Google. |
| **Medium** | Objective navigation | The app uses `history.replaceState` for every step. Browser Back after moving to Prepare exited to `about:blank` in a fresh tab instead of returning to Invitation. | External testers may leave the test accidentally; only the bespoke Previous control navigates steps. |
| **Medium** | Objective accessibility | Selecting a preparation choice rerenders the root and leaves focus on `BODY`; this was observed after selecting Lantern. | Keyboard and switch-control users can lose their place and must traverse controls again. |
| **Low** | Objective accessibility | The manual Reduce motion toggle works immediately but returns to the OS preference after refresh. | A user's explicit session choice is not preserved even though other review state is. |
| **Low** | Objective accessibility | Buttons and inputs get the custom 4px focus outline, while the home/brand link receives only the browser's 1px default outline. | Focus is visible but inconsistent and weaker on the first focusable element. |

## Finding detail

### 1. Preparation causality is sparse and priority-ordered

`resolveAdventure` evaluates outcomes in this order:

1. Good Wander + Wooden Spoon → Hedge Bell, regardless of Pack or Intention.
2. Dry Bag → Creek Glass, unless the Hedge Bell condition already won.
3. Lantern + strange Intention → Clover Beetle route, unless Dry Bag already won.
4. Everything else → Blue Button.

The live 16-combination result distribution was:

| Result | Loadouts | Share |
| --- | ---: | ---: |
| Creek Glass | 6 | 37.5% |
| Hedge Bell | 4 | 25% |
| Blue Button | 4 | 25% |
| Clover Beetle's Route | 2 | 12.5% |

Specific contradictions:

- Good Wander versus Poke Around makes no difference with Lantern.
- Intention makes no difference for either Wooden Spoon route or any Dry Bag route.
- Pack and Intention make no difference when Wooden Spoon + Good Wander is selected.
- Tool and trip shape make no difference for most Dry Bag combinations.
- “Bring something for Home” frequently resolves to an outcome whose receipt credits only the Basket.
- The Journey screen always says the trip “gives the choice time to matter,” even where changing that trip produces the same story.
- The Return screen always says “Your care mattered,” even when one or more displayed choices were ignored by resolution.

The four authored results themselves are deterministic and readable. The defect is not randomness; it is that the interface represents four levers as jointly causal when the resolver often uses only one or two. This also creates a recipe-learning risk: Dry Bag dominates six combinations, and the only Wooden Spoon + Good Wander result is labeled a **Wonder**, which can teach “longer is better loot.”

### 2. Repeated tickles do not accumulate

Reproduction:

1. Start at 120 tickles.
2. Complete the Dry Bag path. Return shows `+20 tickles`; status shows 140.
3. Continue to Replay and choose **Change one thing**.
4. Change only Pack to Wicker Basket and complete the next return.
5. Return again shows `+20 tickles`; status still shows 140.

The reducer stores a single `ticklesEarned` value and sets it to 20 rather than banking a completion. That is consistent with a single illustrative run, but not with the replay CTA or the stated game direction of always earning more tickles.

### 3. Home trace is explicit but not visually lasting

All four outcomes provide concrete trace text:

- Blue Button on the Barn shelf plus Rain-Glass marked for another visit.
- Creek Glass on Rosie's Adventure shelf.
- Clover Beetle route in the Field Guide.
- Hedge Bell beside the Barn door.

That is good narrative causality. However, every return uses the same Barn-worktable image and Replay uses the same Rosie memory strip. The bell, glass, button, route, changed shelf, and opened route are not visibly present. Tara can verify that a sentence exists, but only fresh people can show whether the consequence is perceived and remembered.

### 4. Adventure is mechanically separate, but the page keeps invoking farming

No setup option, state field, route, or resolver condition requires crops, planting, plots, harvest timing, compost, seeds, or Farm inventory. That boundary passes objectively.

Visible cues that may still prime a Farm prerequisite or FarmVille frame:

- Header: “No crops, plots, harvests, compost, or Farm stock.”
- Prepare: “Nothing here is grown or harvested.”
- Review note: “not a crop requirement.”
- Boundary note: “Farming can become its own game and reward lane.”
- Agrarian fiction/objects: Barn, Wicker Basket, Clover Verge, clover husk, Barn shelf/door, and the Barn-worktable return art.
- Public asset paths contain `homegrown-adventures` (not normally visible to a player, but evidence that the implementation still shares the historical visual vocabulary).

Barn, basket, and clover can belong naturally to Rosie's world without implying a gate. The avoidable risk comes from repeating the prohibited farming vocabulary four times before asking whether the player thought about farming.

### 5. Network privacy is good, but the promise should be narrower

A complete live path generated 12 requests, all GETs. Origins were only:

- `https://ticklethepig.com`
- `https://fonts.googleapis.com`
- `https://fonts.gstatic.com`

No POST, beacon, account, Supabase, Sentry, PostHog, Segment, or other analytics request occurred. Source inspection found only localStorage persistence and clipboard output. The copied trace contains choices, result, fixed reward, and two verdict answers—no account identifier.

The Google-hosted font requests still expose ordinary request metadata such as IP address, user agent, and referrer to a third party. Therefore “No account or analytics; results stay in this browser unless you copy them” would be supported, while the current absolute “No … personal data” wording is not.

## Branch matrix

All returns displayed 140 total tickles from a 120 starting value and a fixed `+20 tickles` receipt.

| Tool | Pack | Intention | Trip | Live result |
| --- | --- | --- | --- | --- |
| Wooden Spoon | Wicker Basket | Strange | Poke Around | Blue Button |
| Wooden Spoon | Wicker Basket | Strange | Good Wander | Hedge Bell |
| Wooden Spoon | Wicker Basket | For Home | Poke Around | Blue Button |
| Wooden Spoon | Wicker Basket | For Home | Good Wander | Hedge Bell |
| Wooden Spoon | Dry Bag | Strange | Poke Around | Creek Glass |
| Wooden Spoon | Dry Bag | Strange | Good Wander | Hedge Bell |
| Wooden Spoon | Dry Bag | For Home | Poke Around | Creek Glass |
| Wooden Spoon | Dry Bag | For Home | Good Wander | Hedge Bell |
| Lantern | Wicker Basket | Strange | Poke Around | Clover Beetle route |
| Lantern | Wicker Basket | Strange | Good Wander | Clover Beetle route |
| Lantern | Wicker Basket | For Home | Poke Around | Blue Button |
| Lantern | Wicker Basket | For Home | Good Wander | Blue Button |
| Lantern | Dry Bag | Strange | Poke Around | Creek Glass |
| Lantern | Dry Bag | Strange | Good Wander | Creek Glass |
| Lantern | Dry Bag | For Home | Poke Around | Creek Glass |
| Lantern | Dry Bag | For Home | Good Wander | Creek Glass |

## Technical test matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Default Wicker path | Pass | Blue Button, Rain-Glass clue, Home shelf trace, fixed +20. |
| Dry Bag path | Pass | Creek Glass, explicit preservation cause, Adventure-shelf trace, fixed +20. |
| Wooden Spoon + Good Wander | Pass | Hedge Bell, fencepost/listening cause, Barn-door trace, fixed +20. |
| Lantern + strange Intention | Pass | Clover Beetle route, light/attention cause, Field Guide trace, fixed +20. |
| All meaningful combinations | Logic executes; product concern | 16/16 deterministic; only four results and multiple ignored choices. |
| Previous/Next | Pass | Step rail clamps at ends and focuses the new screen heading. |
| Change one thing | Partial | Returns to Prepare and preserves loadout, but another reward does not accumulate. |
| Start fresh | Pass | Restores Invitation, defaults, 120 tickles, and disabled Previous; survives refresh. |
| Refresh/local resume | Pass | Dry Bag return resumed as Creek Glass with the same URL and state. |
| URL state | Pass | Step, Tool, Pack, Intention, and trip are represented and restored. |
| Browser Back | Fail | Prepare → browser Back exited the prototype in a fresh tab. |
| Anonymous copy | Pass | Clipboard contained destination, loadout, result, Home trace, +20, and verdicts with no identifier. |
| Runtime | Pass | No page warnings or errors observed during the live audit. |
| Responsive layout | Pass | Invitation, Prepare, Journey, Return, and Replay checked at 320/375/390/430/1280; no document or screen horizontal overflow. |
| Images | Pass | No broken image in any of the 25 viewport/screen cases. |
| Touch targets | Pass with note | Visible button/link targets were at least 44px; checkbox itself is 20px inside a 44px label. |
| Keyboard focus order | Mostly pass | Brand → Start fresh → eight choices → Previous → Next → Reduce motion was logical; selection focus loss remains. |
| Reduced motion | Partial | OS preference disables animation; manual toggle works immediately but is not retained after refresh. |
| Enlarged layout | Pass as structural proxy | 640px and 320px reflow cover 200% and 400%-equivalent narrowing from a 1280px desktop; human browser-zoom/VoiceOver review remains. |
| Analytics/account transmission | Pass | No analytics/account code or request; no non-GET request. Google Fonts privacy caveat above. |
| Noindex | Pass | Adventure response was HTTP 200 with `X-Robots-Tag: noindex, nofollow`; document also has `noindex,nofollow`. |
| Adjacent routes | Pass | `/privacy`, `/r/tara-audit`, `/i/tara-audit`, `/redeem/tara-audit`, and AASA returned HTTP 200; AASA content type was JSON. |

## Playtest thresholds: what Tara can and cannot judge

| Threshold | Tara judgment | Why |
| --- | --- | --- |
| Place: 4/5 describe Clover Verge as a place | **Human-only**; heuristically promising | Rain, puddle light, hedge, and humming fencepost provide a place vocabulary. Recall cannot be simulated. |
| Causality: 4/5 explain Dry Bag → Creek Glass | **Mechanical pass; human-only comprehension** | The cause is deterministic and explicitly stated. Human explanation still needs testing. |
| Independent Dry Bag hypothesis: 3/5 | **Human-only; risk of over-coaching** | “wet, fragile,” “waterproof,” and after-rain copy nearly names the solution. This may measure reading a recipe more than world inference. |
| Hedge Bell memory: 4/5 | **Human-only** | Strong name and prose; no visual bell artifact. |
| Home consequence: 4/5 | **Human-only; at risk** | Trace text exists, but Home does not visibly change. |
| Curiosity/resend: 4/5 with a specific hope | **Human-only** | Replay questions are evocative, but clicking Next or Yes is not evidence of desire. |
| Anti-optimization: no more than 1/5 efficiency-led | **Human-only; at risk** | Dry Bag dominance, deterministic recipes, `Wonder`, and Good Wander's longer duration can read as a value ladder. |
| Adventure/Farm separation: 4/5 explain Adventure without crops | **Mechanical pass; human-only mental model** | No farming gate exists, but repeated anti-farming copy may prime farming. |

## Recommended order of work

1. Make every displayed preparation dimension causally honest for every authored outcome, or visibly mark which dimensions are relevant to the current possibility. Do not say all choices mattered when the resolver ignored them.
2. Decide whether **Change one thing** represents a second completion. If yes, bank another 20 and show 160; if no, label it as a non-economic comparison replay and suppress the second reward receipt.
3. Give at least the headline Home traces a visible, persistent representation, especially the Hedge Bell.
4. Remove farming-denial language from the unprimed tester surface. Keep the boundary in facilitator documentation, not in the artifact being used to measure spontaneous separation.
5. Self-host fonts or narrow the privacy claim; preserve the current no-analytics/local-result behavior.
6. Preserve focus on the newly selected choice after rerender and consider step-aware browser history.
7. Run five fresh moderated humans using the existing guide. Do not count Tara, automated clicks, or the in-page Yes button toward the five-person thresholds.

## Concise ship/iterate decision

**Ship as a labeled internal prototype: yes. Use as an external technical click-through: yes. Treat its product thesis as validated or integrate it into production: no—iterate causality and repeated tickle earning first, then run the five-person round.**
