import {
	ACTIONS,
	ADVENTURE_STORAGE_KEY,
	OPTIONS,
	STEPS,
	adventureReducer,
	adventureTrace,
	createInitialAdventureState,
	deserializeAdventureState,
	optionFor,
	resolveAdventure,
	serializeAdventureState,
} from "./game.mjs";

const root = document.querySelector("#adventure-root");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const requestedFresh = new URLSearchParams(window.location.search).get("fresh") === "1";

if (requestedFresh) localStorage.removeItem(ADVENTURE_STORAGE_KEY);

let state = deserializeAdventureState(
	requestedFresh ? null : localStorage.getItem(ADVENTURE_STORAGE_KEY),
	{ reduceMotion: prefersReducedMotion.matches },
);

state = applyUrlState(state);

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function applyUrlState(current) {
	const params = new URLSearchParams(window.location.search);
	let next = current;
	for (const kind of ["destination", "tool", "pack", "intention", "trip"]) {
		const value = params.get(kind);
		if (value && OPTIONS[kind].some((option) => option.id === value)) {
			next = { ...next, [kind]: value };
		}
	}
	const stepId = params.get("step");
	const step = STEPS.findIndex((entry) => entry.id === stepId);
	if (step >= 0) next = { ...next, step, ticklesEarned: step >= 3 ? 20 : 0 };
	return next;
}

function persist() {
	localStorage.setItem(ADVENTURE_STORAGE_KEY, serializeAdventureState(state));
	const url = new URL(window.location.href);
	url.searchParams.delete("fresh");
	url.searchParams.set("step", STEPS[state.step].id);
	for (const kind of ["tool", "pack", "intention", "trip"]) {
		url.searchParams.set(kind, state[kind]);
	}
	window.history.replaceState({}, "", url);
}

function dispatch(action, { announce = true } = {}) {
	state = adventureReducer(state, action);
	persist();
	render();
	if (announce) {
		const heading = document.querySelector("#screen-title");
		heading?.focus({ preventScroll: false });
	}
}

function choiceGroup(kind, legend) {
	return `
		<fieldset class="choice-group">
			<legend>${escapeHtml(legend)}</legend>
			<div class="choice-list">
				${OPTIONS[kind]
					.map((option) => {
						const selected = state[kind] === option.id;
						return `
							<button
								type="button"
								class="choice${selected ? " is-selected" : ""}"
								data-choice-kind="${kind}"
								data-choice-value="${option.id}"
								aria-pressed="${selected}"
							>
								<span class="choice-dot" aria-hidden="true"></span>
								<span><strong>${escapeHtml(option.name)}</strong><small>${escapeHtml(option.detail)}</small></span>
							</button>`;
					})
					.join("")}
			</div>
		</fieldset>`;
}

function invitationScreen() {
	const destination = optionFor("destination", state.destination);
	return `
		<section class="screen scene-screen invitation-screen" aria-labelledby="screen-title">
			<img class="scene-image" src="./assets/homegrown-adventures/adventure-clearing-lantern.webp" alt="A narrow hedge path lit by faint lights at dusk" />
			<div class="scene-shade"></div>
			<div class="scene-copy sticker dark-sticker">
				<p class="hand-label">A possibility just beyond Home</p>
				<h2 id="screen-title" tabindex="-1">A glow beneath the hedge</h2>
				<p>Rosie noticed warm lights gathering near Clover Verge. Choose how she should look closer.</p>
				<div class="place-ticket">
					<span>${escapeHtml(destination.name)}</span>
					<small>${escapeHtml(destination.detail)}</small>
				</div>
			</div>
		</section>`;
}

function prepareScreen() {
	return `
		<section class="screen prepare-screen" aria-labelledby="screen-title">
			<div class="paper-heading">
				<p class="hand-label">Rosie's Adventure Bag</p>
				<h2 id="screen-title" tabindex="-1">Prepare a possibility</h2>
				<p>Nothing here is grown or harvested. Adventure choices stand on their own.</p>
			</div>
			<div class="bag-stage sticker sticker--sky sticker--sm sticker--straight" aria-hidden="true">
				<img src="./assets/homegrown-adventures/open-adventure-bag.webp" alt="" />
				<img class="bag-rosie" src="./rosie.png" alt="" />
			</div>
			<div class="choice-scroll">
				${choiceGroup("tool", "Choose one Tool")}
				${choiceGroup("pack", "Choose one Pack")}
				${choiceGroup("intention", "Give Rosie an Intention")}
				${choiceGroup("trip", "Choose the trip shape")}
			</div>
		</section>`;
}

function journeyScreen() {
	const tool = optionFor("tool", state.tool);
	const pack = optionFor("pack", state.pack);
	const intention = optionFor("intention", state.intention);
	const trip = optionFor("trip", state.trip);
	return `
		<section class="screen scene-screen journey-screen" aria-labelledby="screen-title">
			<img class="scene-image" src="./assets/homegrown-adventures/adventure-clearing-discovery.webp" alt="A deep hedge clearing at dusk with a faint golden glow beneath the roots" />
			<div class="scene-shade"></div>
			<div class="journey-route" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
			<div class="scene-copy sticker dark-sticker journey-note">
				<p class="hand-label">Clover Verge · while you are away</p>
				<h2 id="screen-title" tabindex="-1">Rosie follows what you made possible</h2>
				<ul class="causality-list">
					<li><strong>${escapeHtml(tool.name)}</strong><span>${escapeHtml(tool.detail)}</span></li>
					<li><strong>${escapeHtml(pack.name)}</strong><span>${escapeHtml(pack.detail)}</span></li>
					<li><strong>${escapeHtml(intention.name)}</strong><span>${escapeHtml(trip.name)} gives the choice time to matter.</span></li>
				</ul>
				<p class="journey-promise">The click-through skips the wait. The shipped game would let this unfold kindly while you are away.</p>
			</div>
		</section>`;
}

function returnScreen() {
	const outcome = resolveAdventure(state);
	return `
		<section class="screen scene-screen return-screen" aria-labelledby="screen-title">
			<img class="scene-image" src="./assets/homegrown-adventures/return-homecoming-discovery.webp" alt="A lantern-lit Barn worktable facing an open hedge gate at dusk" />
			<div class="scene-shade return-shade"></div>
			<img class="return-rosie" src="./rosie.png" alt="Rosie home from her Adventure" />
			<div class="scene-copy sticker return-card">
				<p class="hand-label">${escapeHtml(outcome.kind)} · Rosie is Home</p>
				<h2 id="screen-title" tabindex="-1">${escapeHtml(outcome.name)}</h2>
				<p>${escapeHtml(outcome.story)}</p>
				<div class="cause-receipt sticker sticker--sun sticker--flat sticker--straight"><strong>Your care mattered</strong><span>${escapeHtml(outcome.cause)}</span></div>
				<div class="reward-row">
					<span><strong>+20 tickles</strong><small>fixed homecoming reward</small></span>
					<span><strong>${escapeHtml(outcome.trace)}</strong><small>the world remembers</small></span>
				</div>
			</div>
		</section>`;
}

function verdictChoices(kind, legend, choices) {
	return `
		<fieldset class="verdict-group">
			<legend>${escapeHtml(legend)}</legend>
			<div>
				${choices
					.map(([value, label]) => `
						<button type="button" data-verdict-kind="${kind}" data-verdict-value="${value}" aria-pressed="${state.verdict[kind] === value}" class="verdict-choice chip${state.verdict[kind] === value ? " is-selected" : ""}">${escapeHtml(label)}</button>`)
					.join("")}
			</div>
		</fieldset>`;
}

function reflectScreen() {
	const outcome = resolveAdventure(state);
	return `
		<section class="screen reflect-screen" aria-labelledby="screen-title">
			<div class="paper-heading">
				<p class="hand-label">The next page is yours</p>
				<h2 id="screen-title" tabindex="-1">Would you send Rosie again?</h2>
				<p class="next-question sticker sticker--sun sticker--flat sticker--straight">${escapeHtml(outcome.next)}</p>
			</div>
			<div class="memory-strip sticker sticker--sky sticker--sm sticker--straight">
				<img src="./rosie.png" alt="Rosie waiting beside the Adventure journal" />
				<div><small>Home remembers</small><strong>${escapeHtml(outcome.name)}</strong><span>${escapeHtml(outcome.trace)}</span></div>
			</div>
			<div class="validation-sheet sticker sticker--straight">
				<h3>Two quick validation questions</h3>
				<p>No account, analytics, or personal data. Copy the anonymous result and send it back to the facilitator.</p>
				${verdictChoices("pull", "What most makes you want another Adventure?", [
					["place", "The place"],
					["preparation", "Changing preparation"],
					["rosie", "Rosie's story"],
					["find", "The named Find"],
					["nothing", "Nothing yet"],
				])}
				${verdictChoices("resend", "Would you send Rosie out again?", [
					["yes", "Yes"],
					["maybe", "Maybe"],
					["no", "No"],
				])}
				<div class="validation-actions">
					<button type="button" class="secondary-button btn btn--sm" data-action="copy">Copy anonymous result</button>
					<button type="button" class="primary-button btn btn--sm" data-action="change-one">Change one thing</button>
				</div>
				<p class="copy-status" role="status" aria-live="polite"></p>
			</div>
		</section>`;
}

function progressMarkup() {
	return STEPS.map((step, index) => `
		<li class="${index === state.step ? "is-current" : index < state.step ? "is-complete" : ""}" ${index === state.step ? 'aria-current="step"' : ""}>
			<span>${index + 1}</span><small>${escapeHtml(step.label)}</small>
		</li>`).join("");
}

function screenMarkup() {
	return [invitationScreen, prepareScreen, journeyScreen, returnScreen, reflectScreen][state.step]();
}

function render() {
	const atStart = state.step === 0;
	const atEnd = state.step === STEPS.length - 1;
	root.innerHTML = `
		<header class="lab-header">
			<div>
				<a class="brand-link" href="./" aria-label="Tickle the Pig home"><span class="pig-mark" aria-hidden="true"><i></i></span>Tickle the Pig</a>
				<h1>Beyond the Hedge</h1>
				<p>An Adventure-only web click-through. No crops, plots, harvests, compost, or Farm stock.</p>
			</div>
			<div class="header-actions">
				<span class="lab-badge tag tag--sun">Local-only prototype</span>
				<button type="button" class="text-button btn btn--link" data-action="reset">Start fresh</button>
			</div>
		</header>
		<div class="question-bar sticker sticker--bark sticker--straight">
			<strong>Validation question</strong>
			<span>Does preparation create enough curiosity and causality that you want to send Rosie out again?</span>
		</div>
		<main class="review-layout">
			<section class="phone-stage" aria-label="Adventure prototype">
				<div class="phone ${state.reduceMotion ? "reduce-motion" : ""}">
					<div class="phone-status" aria-hidden="true"><span>9:41</span><i></i><span>${state.ticklesBefore + state.ticklesEarned} tickles</span></div>
					${screenMarkup()}
				</div>
				<div class="review-controls sticker sticker--straight">
					<button type="button" data-action="back" ${atStart ? "disabled" : ""}><span aria-hidden="true">←</span><strong>Previous</strong></button>
					<div><small>Adventure step</small><strong>${state.step + 1} / ${STEPS.length} · ${escapeHtml(STEPS[state.step].label)}</strong></div>
					<button type="button" data-action="next" ${atEnd ? "disabled" : ""}><strong>${state.step === 2 ? "Welcome Home" : "Next"}</strong><span aria-hidden="true">→</span></button>
				</div>
			</section>
			<aside class="review-notes sticker">
				<h2>Adventure stands alone</h2>
				<p>The player begins with a nearby mystery, not a crop requirement. The choices change Rosie's story and Find; every return leaves a trace at Home.</p>
				<ol class="step-list">${progressMarkup()}</ol>
				<div class="boundary-note sticker sticker--sky sticker--flat sticker--straight">
					<strong>Deliberate boundary</strong>
					<p>Farming can become its own game and reward lane. It does not unlock, provision, accelerate, or explain this Adventure loop.</p>
				</div>
				<label class="motion-toggle"><input type="checkbox" data-action="motion" ${state.reduceMotion ? "checked" : ""} /><span>Reduce motion</span></label>
			</aside>
		</main>`;
}

async function copyTrace() {
	const value = adventureTrace(state);
	try {
		await navigator.clipboard.writeText(value);
		const status = document.querySelector(".copy-status");
		if (status) status.textContent = "Anonymous result copied.";
	} catch {
		const textarea = document.createElement("textarea");
		textarea.value = value;
		document.body.append(textarea);
		textarea.select();
		document.execCommand("copy");
		textarea.remove();
		const status = document.querySelector(".copy-status");
		if (status) status.textContent = "Anonymous result copied.";
	}
}

root.addEventListener("click", (event) => {
	const choice = event.target.closest("[data-choice-kind]");
	if (choice) {
		dispatch({
			type: ACTIONS.CHOOSE,
			kind: choice.dataset.choiceKind,
			value: choice.dataset.choiceValue,
		}, { announce: false });
		return;
	}
	const verdict = event.target.closest("[data-verdict-kind]");
	if (verdict) {
		dispatch({
			type: ACTIONS.SET_VERDICT,
			kind: verdict.dataset.verdictKind,
			value: verdict.dataset.verdictValue,
		}, { announce: false });
		return;
	}
	const action = event.target.closest("[data-action]")?.dataset.action;
	if (action === "next") dispatch({ type: ACTIONS.NEXT });
	if (action === "back") dispatch({ type: ACTIONS.BACK });
	if (action === "change-one") {
		state = { ...state, step: 1 };
		persist();
		render();
		document.querySelector("#screen-title")?.focus();
	}
	if (action === "copy") copyTrace();
	if (action === "reset") dispatch({ type: ACTIONS.RESET });
});

root.addEventListener("change", (event) => {
	if (event.target.matches('[data-action="motion"]')) {
		dispatch({ type: ACTIONS.SET_REDUCED_MOTION, value: event.target.checked }, { announce: false });
	}
});

prefersReducedMotion.addEventListener("change", (event) => {
	dispatch({ type: ACTIONS.SET_REDUCED_MOTION, value: event.matches }, { announce: false });
});

window.addEventListener("popstate", () => {
	state = applyUrlState(state);
	render();
});

render();
