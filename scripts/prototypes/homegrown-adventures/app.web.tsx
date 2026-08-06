// @ts-nocheck -- throwaway standalone lab; the reducer and Rive contract are checked separately.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	HOMEGROWN_RIVE_ASSET_AUTHORED,
	HomegrownRiveScene,
} from "../../../components/prototypes/homegrown-adventures/HomegrownRiveScene.web";
import {
	ACTIONS,
	createInitialState,
	deserializeState,
	HOMEGROWN_STORAGE_KEY,
	homegrownReducer,
	primaryAction,
	serializeState,
	STAGES,
} from "./game.mjs";
import { homegrownRiveModel } from "./homegrownRiveModel.mjs";
import "./styles.css";

const VARIANTS = {
	A: { name: "Rosie First", question: "Does the living Barn explain the loop by itself?" },
	B: { name: "Purpose Cards", question: "Does naming the purpose make farming click sooner?" },
	C: { name: "Welcome Home", question: "Does a brief return ceremony strengthen the Discovery without hiding Rosie?" },
};

const STAGE_COPY = {
	[STAGES.STARTING]: {
		eyebrow: "Morning at the Barn",
		title: "Rosie has something to show you",
		body: "Start with affection. The Kitchen Patch wakes after Rosie's first tickle.",
	},
	[STAGES.CLOVER_GROWING]: {
		eyebrow: "Growing kindly",
		title: "Clover Lunch is taking root",
		body: "It will wait safely when ripe. Nothing is harmed while you are away.",
	},
	[STAGES.CLOVER_READY]: {
		eyebrow: "The patch rustles",
		title: "Clover Lunch is ready",
		body: "The first welcome tickle helps Rosie point out what changed while you were gone.",
	},
	[STAGES.PACKED]: {
		eyebrow: "Rosie's Bag",
		title: "Dusk Picnic is packed",
		body: "Clover Lunch · Wooden Spoon · Wicker Basket · Bring something Home. Preparation creates possibility.",
	},
	[STAGES.ADVENTURE]: {
		eyebrow: "Beyond the hedge",
		title: "Rosie is following the moths",
		body: "The Adventure unfolds while you are away. A kind return is guaranteed.",
	},
	[STAGES.GLOWROOT_RETURNED]: {
		eyebrow: "A named Discovery",
		title: "Rosie found: Glowroot Seed",
		body: "The Clover Lunch let Rosie stay until dusk, when the moths revealed a warm gold seed.",
	},
	[STAGES.NEAR_DISCOVERY]: {
		eyebrow: "Near-Discovery · never failure",
		title: "Rosie followed a warm moth trail",
		body: "She came Home with a useful clue: pack Clover Lunch next time so she can wait for the Glowroot seed to open.",
	},
	[STAGES.DEVELOPED]: {
		eyebrow: "Home remembers",
		title: "Glowroot changed the Barn path",
		body: "The Hedge Bell rings, the crossing opens, and the Field Guide remembers what you found.",
	},
};

function stageCopy(state) {
	if (state.stage === STAGES.STARTING && state.hasTickled && !state.purpose) {
		return {
			eyebrow: "A named Request",
			title: "The dusk moths need a picnic gift",
			body: "Choose what to grow for first. Their request makes Clover Lunch meaningful.",
		};
	}
	if (state.stage === STAGES.STARTING && state.purpose) {
		return {
			eyebrow: "Purpose before crop",
			title: "Grow Clover Lunch for the Dusk Picnic",
			body: "This harvest has a job: help Rosie stay beyond the hedge until the moths appear.",
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		return {
			eyebrow: "Something changed",
			title: "The Kitchen Patch is rustling",
			body: "Welcome Rosie with a tickle and she will point out what happened while you were away.",
		};
	}
	if (state.stage === STAGES.CLOVER_READY && state.cloverHarvested) {
		return {
			eyebrow: "Harvest tucked away",
			title: "Clover Lunch is in Rosie's Bag",
			body: "The first bed is resting. Pack the picnic and this harvest becomes part of Rosie's Adventure.",
		};
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && !state.changeRevealed) {
		return {
			eyebrow: "Rosie is Home",
			title: "Something glows inside her Bag",
			body: "Tickle Rosie first. Her return story reveals the named Discovery before any collection screen.",
		};
	}
	if (state.stage === STAGES.PACKED && state.underprepared) {
		return {
			eyebrow: "A light Bag",
			title: "Rosie can still have a kind Adventure",
			body: "Without Clover Lunch she will return with a specific clue, not a failed mission or an empty reward.",
		};
	}
	return STAGE_COPY[state.stage];
}

const PURPOSES = [
	{ id: "clover", name: "Clover Lunch", job: "Pack it for an Adventure", mark: "clover" },
	{ id: "moonberries", name: "Moonberries", job: "Invite the dusk moths", mark: "berry" },
	{ id: "glowroot", name: "Glowroot", job: "Light and restore Home", mark: "glow" },
];

function readVariant() {
	const value = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
	return Object.hasOwn(VARIANTS, value) ? value : "A";
}

function useVariant() {
	const [variant, setVariantState] = useState(readVariant);
	const setVariant = useCallback((next) => {
		const normalized = Object.hasOwn(VARIANTS, next) ? next : "A";
		const url = new URL(window.location.href);
		url.searchParams.set("variant", normalized);
		window.history.replaceState({}, "", url);
		setVariantState(normalized);
	}, []);

	useEffect(() => {
		const onKey = (event) => {
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
			if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
			const keys = Object.keys(VARIANTS);
			const current = keys.indexOf(variant);
			const delta = event.key === "ArrowRight" ? 1 : -1;
			setVariant(keys[(current + delta + keys.length) % keys.length]);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setVariant, variant]);

	return [variant, setVariant];
}

function Glyph({ name }) {
	const paths = {
		heart: <path d="M12 21s-7-4.6-9.3-9C.6 8 2.8 4.7 6.6 4.7c2.2 0 3.8 1.3 5.4 3 1.6-1.7 3.2-3 5.4-3 3.8 0 6 3.3 3.9 7.3C19 16.4 12 21 12 21Z" />,
		spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />,
		barn: <path d="m3 10 9-7 9 7v11h-6v-6H9v6H3V10Zm3 1h12l-6-4.7L6 11Z" />,
		friends: <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM1.5 21c0-4 2.7-6.5 6.5-6.5s6.5 2.5 6.5 6.5h-13Zm12.2 0c0-2-.6-3.8-1.7-5.1 1.1-1 2.5-1.4 4-1.4 3.8 0 6.5 2.5 6.5 6.5h-8.8Z" />,
		season: <path d="M20.8 3.2C12 3 5 6.4 4.2 13.4c-.3 2.9 1.4 5.1 4 5.8 4.1 1.2 8.1-2.4 9.8-6.8-2.4 3.1-5.1 4.4-8.2 4.4 4-1.8 7-4.9 11-13.6ZM5 20l2-2" />,
		shop: <path d="M4 9h16l-1 12H5L4 9Zm3 0V7a5 5 0 0 1 10 0v2h-3V7a2 2 0 1 0-4 0v2H7Z" />,
		me: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9c0-4.2 3.2-6.7 8-6.7s8 2.5 8 6.7H4Z" />,
	};
	return <svg aria-hidden="true" viewBox="0 0 24 24"><g>{paths[name]}</g></svg>;
}

function Counter({ kind, value, label }) {
	return (
		<div className={`counter counter-${kind}`} aria-label={`${label}: ${value}`}>
			<span className="counter-icon"><Glyph name={kind === "earned" ? "heart" : "spark"} /></span>
			<span><strong>{value.toLocaleString()}</strong><small>{label}</small></span>
		</div>
	);
}

function BottomNav() {
	const items = [["barn", "Barn"], ["friends", "Friends"], ["season", "Season"], ["shop", "Shop"], ["me", "Me"]];
	return (
		<nav className="bottom-nav" aria-label="Primary">
			{items.map(([icon, label]) => (
				<button key={label} type="button" className={label === "Barn" ? "selected" : ""} aria-current={label === "Barn" ? "page" : undefined} disabled={label !== "Barn"}>
					<Glyph name={icon} /><span>{label}</span>
				</button>
			))}
		</nav>
	);
}

function PurposeShelf({ state }) {
	if (state.stage !== STAGES.STARTING) return null;
	return (
		<div className="purpose-shelf" aria-label="What to grow for">
			{PURPOSES.map((purpose) => (
				<div className={`purpose-card mark-${purpose.mark}`} key={purpose.id}>
					<span className="crop-mark" />
					<strong>{purpose.name}</strong>
					<small>{purpose.job}</small>
				</div>
			))}
		</div>
	);
}

const RETURN_CEREMONY_MS = 2400;

function compactStoryCopy(state) {
	if (state.stage === STAGES.DEVELOPED) {
		return { eyebrow: "Home remembers", title: "Glowroot lives at Home" };
	}
	if (state.changeRevealed) {
		return { eyebrow: "A named Discovery", title: "Glowroot Seed · ready to plant" };
	}
	return { eyebrow: "Rosie is Home", title: "Something glows in her Bag" };
}

function StoryCard({ state, variant }) {
	const copy = stageCopy(state);
	const [returnCeremony, setReturnCeremony] = useState(false);
	const [storyExpanded, setStoryExpanded] = useState(false);
	const previousStage = useRef(state.stage);

	useEffect(() => {
		const enteredReturn =
			previousStage.current !== STAGES.GLOWROOT_RETURNED &&
			state.stage === STAGES.GLOWROOT_RETURNED &&
			state.lastAction === "return";
		previousStage.current = state.stage;

		if (!enteredReturn || state.reduceMotion) {
			setReturnCeremony(false);
			return undefined;
		}

		setReturnCeremony(true);
		const timer = window.setTimeout(() => setReturnCeremony(false), RETURN_CEREMONY_MS);
		return () => window.clearTimeout(timer);
	}, [state.lastAction, state.reduceMotion, state.stage]);

	useEffect(() => setStoryExpanded(false), [state.stage]);

	const compact =
		!returnCeremony &&
		(state.stage === STAGES.GLOWROOT_RETURNED || state.stage === STAGES.DEVELOPED);
	const presentation = returnCeremony ? "ceremony" : compact ? "compact" : "standard";

	if (compact) {
		const compactCopy = compactStoryCopy(state);
		return (
			<section
				className={`story-card story-${variant} story-card-compact ${storyExpanded ? "story-expanded" : ""}`}
				data-story-presentation={presentation}
				aria-live="polite"
			>
				<button
					className="story-summary"
					type="button"
					aria-expanded={storyExpanded}
					aria-controls="home-story-details"
					onClick={() => setStoryExpanded((value) => !value)}
				>
					<span className="story-pin" />
					<span className="story-compact-copy">
						<span className="eyebrow">{compactCopy.eyebrow}</span>
						<h1>{compactCopy.title}</h1>
					</span>
					<span className="story-open-label" aria-hidden="true">{storyExpanded ? "Close ↗" : "Read ↘"}</span>
				</button>
				<div className="story-details" id="home-story-details" hidden={!storyExpanded}>
					<p>{copy.body}</p>
					{state.stage === STAGES.DEVELOPED && (
						<>
							<div className="field-guide"><strong>Field Guide</strong><span>{state.fieldGuide.join(" · ")}</span></div>
							<div className="farm-favor">Farm Favor: Mara watered one Moonberry bed. Optional, bounded, no advantage.</div>
						</>
					)}
				</div>
			</section>
		);
	}

	return (
		<section
			className={`story-card story-${variant} story-card-${presentation}`}
			data-story-presentation={presentation}
			aria-live="polite"
		>
			<span className="story-pin" />
			<p className="eyebrow">{copy.eyebrow}</p>
			<h1>{copy.title}</h1>
			<p>{copy.body}</p>
			{state.stage === STAGES.DEVELOPED && (
				<><div className="field-guide"><strong>Field Guide</strong><span>{state.fieldGuide.join(" · ")}</span></div><div className="farm-favor">Farm Favor: Mara watered one Moonberry bed. Optional, bounded, no advantage.</div></>
			)}
		</section>
	);
}

function DevTools({ state, dispatch, variant }) {
	const [open, setOpen] = useState(false);
	const copyTrace = async () => {
		await navigator.clipboard?.writeText(JSON.stringify({ variant, trace: state.trace }, null, 2));
	};
	return (
		<aside className={`dev-tools ${open ? "open" : ""}`}>
			<button className="dev-toggle" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>Lab tools</button>
			<div className="dev-panel" hidden={!open}>
				<div className="dev-heading"><strong>Throwaway prototype</strong><span>No backend or personal data.</span></div>
				<div className="dev-row">
					<button type="button" onClick={() => dispatch({ type: ACTIONS.ADVANCE_TIME })}>Advance time</button>
					<button type="button" onClick={() => dispatch({ type: ACTIONS.RESET })}>Reset</button>
					<button type="button" onClick={() => dispatch({ type: ACTIONS.TOGGLE_REDUCED_MOTION })}>{state.reduceMotion ? "Use motion" : "Reduce motion"}</button>
				</div>
				<label>Review state<select value={state.stage === STAGES.DEVELOPED ? "developed" : state.stage === STAGES.CLOVER_READY ? "ready" : "starting"} onChange={(event) => dispatch({ type: ACTIONS.JUMP_TO_STATE, target: event.target.value })}>
					<option value="starting">Starting Barn</option><option value="ready">First payoff</option><option value="developed">Developed Barn</option>
				</select></label>
				<div className="reference-links"><strong>Approved visual context</strong>
					<a href="./assets/homegrown-adventures/01-starting-barn.png" target="_blank">Starting Barn</a>
					<a href="./assets/homegrown-adventures/02-first-payoff.png" target="_blank">First payoff</a>
					<a href="./assets/homegrown-adventures/03-developed-barn.png" target="_blank">Developed Barn</a>
				</div>
				<div className={`rive-proof ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "authored" : "probe"}`}><span><strong>{HOMEGROWN_RIVE_ASSET_AUTHORED ? "Authored Rive scene connected" : "Rive WebGL2 runtime connected"}</strong>{HOMEGROWN_RIVE_ASSET_AUTHORED ? "Reducer state is bound to the Homegrown Adventures View Model." : "Official probe asset only. Rosie scene export still required."}</span></div>
				<ol className="trace" aria-label="Anonymous interaction trace">{state.trace.slice(-8).map((item, index) => <li key={`${item.at}-${index}`}><strong>{item.kind}</strong> {item.detail}</li>)}</ol>
				<button type="button" onClick={copyTrace}>Copy anonymous trace</button>
			</div>
		</aside>
	);
}

function VariantSwitcher({ variant, setVariant }) {
	const keys = Object.keys(VARIANTS);
	const index = keys.indexOf(variant);
	return (
		<div className="variant-switcher" aria-label="Prototype variant switcher">
			<button type="button" aria-label="Previous variant" onClick={() => setVariant(keys[(index + keys.length - 1) % keys.length])}>←</button>
			<span><strong>{variant}</strong><small>{VARIANTS[variant].name}</small></span>
			<button type="button" aria-label="Next variant" onClick={() => setVariant(keys[(index + 1) % keys.length])}>→</button>
		</div>
	);
}

function sceneImage() {
	// Crop and Home consequences now live in the authored Rive scene. Keeping
	// one Barn plate makes the player's lasting changes legible and causal.
	return "starting";
}

function App() {
	const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
	const [state, dispatch] = useReducer(homegrownReducer, undefined, () => deserializeState(localStorage.getItem(HOMEGROWN_STORAGE_KEY), { reduceMotion: prefersReduced }));
	const [variant, setVariant] = useVariant();
	const action = useMemo(() => primaryAction(state), [state]);
	const riveModel = useMemo(() => homegrownRiveModel(state), [state]);
	const image = sceneImage();
	const [feedback, setFeedback] = useState(0);

	useEffect(() => {
		localStorage.setItem(HOMEGROWN_STORAGE_KEY, serializeState(state));
		document.documentElement.dataset.reduceMotion = String(state.reduceMotion);
	}, [state]);

	useEffect(() => {
		const onVisibility = () => {
			if (!document.hidden) dispatch({ type: ACTIONS.SETTLE, now: Date.now() });
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, []);

	const signalFeedback = useCallback((type) => {
		setFeedback((value) => value + 1);
		if (type === ACTIONS.TICKLE) navigator.vibrate?.(12);
		if (state.reduceMotion) return;
		try {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) return;
			const audio = new AudioContext();
			const oscillator = audio.createOscillator();
			const gain = audio.createGain();
			oscillator.frequency.value = type === ACTIONS.TICKLE ? 520 : 390;
			gain.gain.setValueAtTime(0.035, audio.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
			oscillator.connect(gain).connect(audio.destination);
			oscillator.start(); oscillator.stop(audio.currentTime + 0.09);
			oscillator.onended = () => audio.close();
		} catch {}
	}, [state.reduceMotion]);

	const act = useCallback((nextAction = action) => {
		dispatch(nextAction);
		signalFeedback(nextAction.type);
	}, [action, signalFeedback]);

	return <main className={`lab variant-${variant}`}>
		<header className="lab-context">
			<p><strong>Homegrown Adventures</strong><span>{VARIANTS[variant].question}</span></p>
			<span className="prototype-badge">Prototype · browser lab</span>
		</header>
		<div className={`phone scene-${image} rosie-action-${riveModel.viewModel.rosieAction} feedback-${feedback % 2} ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "rive-authored" : "rive-probe"}`}>
			<div className="scene-plate" role="img" aria-label={`${stageCopy(state).title}. Warm paper-craft Barn exterior with Rosie and a three-bed Kitchen Patch.`} />
			<HomegrownRiveScene
				reduceMotion={state.reduceMotion}
				model={riveModel.viewModel}
				trigger={riveModel.trigger}
				triggerNonce={riveModel.triggerNonce}
			/>
			<div className="hud">
				<Counter kind="earned" value={state.ticklesEarned} label="Tickles earned" />
				<Counter kind="ready" value={`${state.readyToTickle} / 25`} label="Ready to tickle" />
			</div>
			<button className="rosie-hit" type="button" aria-label="Tickle Rosie" onClick={() => act({ type: ACTIONS.TICKLE })}><span>Tickle Rosie</span></button>
			{variant === "B" && <PurposeShelf state={state} />}
			<StoryCard state={state} variant={variant} />
			{state.stage === STAGES.CLOVER_READY && state.cloverHarvested && <button className="near-discovery-action" type="button" onClick={() => act({ type: ACTIONS.PACK_LIGHT })}>Preview kind miss: leave Clover Home</button>}
			<button className="primary-action" type="button" onClick={() => act()}>{action.label}</button>
			{state.stage === STAGES.DEVELOPED && state.nextPlanting && <div className="next-choice" role="status">Next: {state.nextPlanting} for a purpose</div>}
			<BottomNav />
		</div>
		<DevTools state={state} dispatch={dispatch} variant={variant} />
		<VariantSwitcher variant={variant} setVariant={setVariant} />
	</main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<App />);
