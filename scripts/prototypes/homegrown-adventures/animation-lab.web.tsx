// @ts-nocheck -- throwaway motion workbench for the authored Homegrown Rive scene.
// Three animation-lab layouts are switchable with ?variant=A|B|C.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	HOMEGROWN_RIVE_ASSET_AUTHORED,
	HomegrownRiveScene,
} from "../../../components/prototypes/homegrown-adventures/HomegrownRiveScene.web";
import { AdventureGlowrootRive } from "../../../components/prototypes/homegrown-adventures/AdventureGlowrootRive.web";
import {
	ACTIONS,
	createInitialState,
	homegrownReducer,
} from "./game.mjs";
import { homegrownRiveModel } from "./homegrownRiveModel.mjs";
import "./animation-lab.css";

const BASE_TIME = 2_000_000;
const action = (type, extra = {}) => ({ type, ...extra });
const TICKLED = [action(ACTIONS.TICKLE)];
const PURPOSED = [...TICKLED, action(ACTIONS.CHOOSE_PURPOSE, { purpose: "dusk-picnic" })];
const PLANTED = [...PURPOSED, action(ACTIONS.PLANT_CLOVER)];
const READY = [...PLANTED, action(ACTIONS.ADVANCE_TIME)];
const REVEALED = [...READY, action(ACTIONS.TICKLE)];
const HARVESTED = [...REVEALED, action(ACTIONS.HARVEST_CLOVER)];
const PACKED = [...HARVESTED, action(ACTIONS.PACK_ADVENTURE)];
const DEPARTING = [...PACKED, action(ACTIONS.START_ADVENTURE)];
const ADVENTURE_READY = [
	...DEPARTING,
	action(ACTIONS.SETTLE),
	action(ACTIONS.ADVANCE_TIME),
];
const RETURNED = [...ADVENTURE_READY, action(ACTIONS.WELCOME_HOME)];
const DISCOVERED = [...RETURNED, action(ACTIONS.ACKNOWLEDGE_RETURN)];
const DEVELOPED = [...DISCOVERED, action(ACTIONS.PLANT_GLOWROOT)];
const MOONBERRIES = [
	...DEVELOPED,
	action(ACTIONS.PLANT_NEXT, { crop: "moonberries" }),
];

const STUDIES = [
	{
		id: "breathe",
		group: "Rosie",
		title: "Breathe",
		purpose: "Calm life between actions",
		static: true,
		from: [],
		to: [],
	},
	{
		id: "tickle",
		group: "Rosie",
		title: "Tickle",
		purpose: "Immediate affection feedback",
		from: [],
		to: TICKLED,
	},
	{
		id: "notice",
		group: "Rosie",
		title: "Notice the patch",
		purpose: "Rosie directs the next tap",
		from: READY,
		to: REVEALED,
	},
	{
		id: "plant",
		group: "Growth",
		title: "Plant Clover",
		purpose: "Seed arrives in bed one",
		from: PURPOSED,
		to: PLANTED,
	},
	{
		id: "growing",
		group: "Growth",
		title: "Growing",
		purpose: "Readable idle crop state",
		static: true,
		from: PLANTED,
		to: PLANTED,
	},
	{
		id: "ready",
		group: "Growth",
		title: "Ready flourish",
		purpose: "Growth becomes harvestable",
		from: PLANTED,
		to: READY,
	},
	{
		id: "harvest",
		group: "Growth",
		title: "Harvest",
		purpose: "Crop leaves the bed cleanly",
		from: REVEALED,
		to: HARVESTED,
	},
	{
		id: "pack",
		group: "Adventure",
		title: "Equip the Bag",
		purpose: "Preparation becomes visible",
		from: HARVESTED,
		to: PACKED,
	},
	{
		id: "departure",
		group: "Adventure",
		title: "Cross the hedge",
		purpose: "The packed Bag turns into a real departure",
		from: PACKED,
		to: DEPARTING,
	},
	{
		id: "glowroot-reveal",
		group: "Adventure",
		title: "Reveal Glowroot",
		purpose: "Preparation becomes a living discovery",
		static: true,
		from: ADVENTURE_READY,
		to: ADVENTURE_READY,
	},
	{
		id: "return",
		group: "Adventure",
		title: "Welcome Home",
		purpose: "Rosie returns with weight",
		from: ADVENTURE_READY,
		to: RETURNED,
	},
	{
		id: "home",
		group: "Home",
		title: "Glowroot changes Home",
		purpose: "A lasting Barn consequence",
		from: DISCOVERED,
		to: DEVELOPED,
	},
	{
		id: "moonberries",
		group: "Home",
		title: "Moonberries grow",
		purpose: "The second purpose takes root",
		from: DEVELOPED,
		to: MOONBERRIES,
	},
	{
		id: "moth",
		group: "Home",
		title: "Moth joins the laugh",
		purpose: "The resident answers Rosie",
		from: MOONBERRIES,
		to: [...MOONBERRIES, action(ACTIONS.TICKLE)],
	},
];

const STUDY_BY_ID = new Map(STUDIES.map((study) => [study.id, study]));
const GROUPS = ["Rosie", "Growth", "Adventure", "Home"];
const VARIANTS = {
	A: { name: "Workbench", description: "Stage beside grouped motion controls" },
	B: { name: "Growth Focus", description: "Crop states dominate the review" },
	C: { name: "Motion Reel", description: "A large stage with a compact cue rail" },
};

function buildState(actions, reduceMotion) {
	let state = createInitialState({ now: BASE_TIME, reduceMotion });
	for (const [index, next] of actions.entries()) {
		state = homegrownReducer(state, {
			now: BASE_TIME + (index + 1) * 1_000,
			...next,
		});
	}
	return state;
}

function neutralize(state) {
	return { ...state, lastAction: "motion-lab-base" };
}

function studyNow(state, studyId) {
	if (
		studyId === "growing" &&
		state.plantedAt !== null &&
		state.readyAt !== null
	) {
		return state.plantedAt + (state.readyAt - state.plantedAt) * 0.66;
	}
	return state.trace.at(-1)?.at ?? BASE_TIME;
}

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
			if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
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

function MotionStage({ activeStudy, bedBusy, harvestCount, onBedAction, reduceMotion, sceneState, revision, emphasis = "full" }) {
	const presentationNow = studyNow(sceneState, activeStudy.id);
	const riveModel = useMemo(
		() => homegrownRiveModel(sceneState, presentationNow),
		[presentationNow, sceneState],
	);
	const bedState = riveModel.viewModel.bedOneState;
	const bedLabel = bedBusy
		? bedState === "ready" ? "Clover Lunch is getting ready" : "Clover Lunch is growing"
		: bedState === "ready" ? "Harvest Clover Lunch" : "Plant Clover Lunch";
	const showingAdventureGlowroot = activeStudy.id === "glowroot-reveal";
	return (
		<section className={`motion-stage motion-stage-${emphasis}`} aria-label="Authored animation preview">
			<div className={`motion-phone ${showingAdventureGlowroot ? "is-adventure-glowroot" : ""}`}>
				<div className="motion-world">
					<div className="motion-scene-plate" />
					<HomegrownRiveScene
						reduceMotion={reduceMotion}
						model={riveModel.viewModel}
						trigger={riveModel.trigger}
						triggerNonce={`${riveModel.triggerNonce}:${revision}`}
					/>
					{showingAdventureGlowroot && (
						<AdventureGlowrootRive key={`adventure-glowroot-${revision}`} reduceMotion={reduceMotion} />
					)}
				</div>
				{!showingAdventureGlowroot && <button
					className={`motion-bed-action bed-${bedState} ${bedBusy ? "is-busy" : ""}`}
					type="button"
					onClick={onBedAction}
					disabled={bedBusy}
					aria-label={bedLabel}
				>
					<span>{bedLabel}</span>
				</button>}
				{harvestCount > 0 && <div key={harvestCount} className="harvest-reward" role="status">
					<span aria-hidden="true" />
					<strong>Clover Lunch gathered</strong>
				</div>}
				<div className="motion-caption" aria-live="polite">
					<strong>{activeStudy.title}</strong>
					<span>{activeStudy.purpose}</span>
				</div>
			</div>
			<div className="motion-state-readout" aria-label="Current Rive state">
				<span>Rosie <strong>{riveModel.viewModel.rosieAction}</strong></span>
				<span>Bed one <strong>{riveModel.viewModel.bedOneState}</strong></span>
				<span>Bag <strong>{riveModel.viewModel.satchelEquipped ? "equipped" : "hidden"}</strong></span>
				<span>Home <strong>{riveModel.viewModel.hedgeCrossingOpen ? "developed" : "starting"}</strong></span>
			</div>
		</section>
	);
}

function StudyButton({ study, active, activate, compact = false }) {
	return (
		<button
			className={`study-button ${active ? "active" : ""} ${compact ? "compact" : ""}`}
			type="button"
			onMouseEnter={() => activate(study.id)}
			onFocus={() => activate(study.id)}
			onClick={() => activate(study.id)}
			aria-pressed={active}
		>
			<span className="study-mark" aria-hidden="true" />
			<span><strong>{study.title}</strong>{!compact && <small>{study.purpose}</small>}</span>
			<span className="replay-mark" aria-hidden="true" />
		</button>
	);
}

function StudyGroups({ activeId, activate, groups = GROUPS }) {
	return (
		<div className="study-groups">
			{groups.map((group) => (
				<section className="study-group" key={group}>
					<h2>{group}</h2>
					<div className="study-list">
						{STUDIES.filter((study) => study.group === group).map((study) => (
							<StudyButton key={study.id} study={study} active={activeId === study.id} activate={activate} />
						))}
					</div>
				</section>
			))}
		</div>
	);
}

function WorkbenchVariant(props) {
	return (
		<div className="workbench-layout">
			<MotionStage {...props} />
			<aside className="workbench-controls" aria-label="Animation studies">
				<StudyGroups activeId={props.activeStudy.id} activate={props.activate} />
			</aside>
		</div>
	);
}

function GrowthVariant(props) {
	const growthStudies = STUDIES.filter((study) => study.group === "Growth");
	return (
		<div className="growth-layout">
			<MotionStage {...props} emphasis="growth" />
			<div className="growth-review">
				<div className="growth-heading">
					<h2>Plant it. Watch it grow. Harvest it.</h2>
					<p>Tap the empty bed to plant. It grows automatically; tap the ready clover to gather it.</p>
				</div>
				<div className="growth-rail" aria-label="Crop growth sequence">
					{growthStudies.map((study, index) => (
						<div className="growth-beat" key={study.id}>
							<span className="growth-number" aria-hidden="true">{index + 1}</span>
							<StudyButton study={study} active={props.activeStudy.id === study.id} activate={props.activate} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function ReelVariant(props) {
	return (
		<div className="reel-layout">
			<MotionStage {...props} emphasis="reel" />
			<div className="reel-controls" aria-label="Motion cue reel">
				{STUDIES.map((study) => (
					<StudyButton key={study.id} compact study={study} active={props.activeStudy.id === study.id} activate={props.activate} />
				))}
			</div>
		</div>
	);
}

function VariantSwitcher({ variant, setVariant }) {
	const keys = Object.keys(VARIANTS);
	const index = keys.indexOf(variant);
	return (
		<div className="motion-variant-switcher" aria-label="Animation lab layout switcher">
			<button type="button" aria-label="Previous layout" onClick={() => setVariant(keys[(index + keys.length - 1) % keys.length])}>←</button>
			<span><strong>{variant}</strong><small>{VARIANTS[variant].name}</small></span>
			<button type="button" aria-label="Next layout" onClick={() => setVariant(keys[(index + 1) % keys.length])}>→</button>
		</div>
	);
}

function App() {
	const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
	const [reduceMotion, setReduceMotion] = useState(prefersReduced);
	const [variant, setVariant] = useVariant();
	const [activeId, setActiveId] = useState("breathe");
	const [sceneState, setSceneState] = useState(() => buildState([], prefersReduced));
	const [revision, setRevision] = useState(0);
	const [bedBusy, setBedBusy] = useState(false);
	const [harvestCount, setHarvestCount] = useState(0);
	const previewTimer = useRef(null);
	const bedTimers = useRef(new Set());

	const clearBedTimers = useCallback(() => {
		for (const timer of bedTimers.current) window.clearTimeout(timer);
		bedTimers.current.clear();
	}, []);
	const scheduleBed = useCallback((callback, delay) => {
		const timer = window.setTimeout(() => {
			bedTimers.current.delete(timer);
			callback();
		}, delay);
		bedTimers.current.add(timer);
	}, []);

	useEffect(() => () => {
		window.clearTimeout(previewTimer.current);
		clearBedTimers();
	}, [clearBedTimers]);
	useEffect(() => {
		document.documentElement.dataset.motionLabReduced = String(reduceMotion);
	}, [reduceMotion]);

	const activateRaw = useCallback((id, reduced = reduceMotion) => {
		const study = STUDY_BY_ID.get(id) ?? STUDIES[0];
		window.clearTimeout(previewTimer.current);
		setActiveId(study.id);
		setSceneState(neutralize(buildState(study.from, reduced)));
		setRevision((value) => value + 1);
		previewTimer.current = window.setTimeout(() => {
			const targetState = buildState(study.to, reduced);
			setSceneState(study.static ? neutralize(targetState) : targetState);
			setRevision((value) => value + 1);
		}, 90);
	}, [reduceMotion]);

	const activate = useCallback((id, reduced = reduceMotion) => {
		clearBedTimers();
		setBedBusy(false);
		activateRaw(id, reduced);
	}, [activateRaw, clearBedTimers, reduceMotion]);

	const currentBedState = useMemo(
		() => homegrownRiveModel(sceneState, studyNow(sceneState, activeId)).viewModel.bedOneState,
		[activeId, sceneState],
	);
	const runBedAction = useCallback(() => {
		if (bedBusy) return;
		clearBedTimers();
		if (currentBedState === "ready") {
			setBedBusy(true);
			setHarvestCount((value) => value + 1);
			activateRaw("harvest", reduceMotion);
			scheduleBed(() => setBedBusy(false), reduceMotion ? 100 : 680);
			return;
		}

		setBedBusy(true);
		activateRaw("plant", reduceMotion);
		if (reduceMotion) {
			scheduleBed(() => {
				activateRaw("ready", true);
				setBedBusy(false);
			}, 120);
			return;
		}
		scheduleBed(() => activateRaw("growing", false), 620);
		scheduleBed(() => activateRaw("ready", false), 1_620);
		scheduleBed(() => setBedBusy(false), 2_480);
	}, [activateRaw, bedBusy, clearBedTimers, currentBedState, reduceMotion, scheduleBed]);

	const toggleReducedMotion = () => {
		const next = !reduceMotion;
		setReduceMotion(next);
		activate(activeId, next);
	};

	const activeStudy = STUDY_BY_ID.get(activeId) ?? STUDIES[0];
	const stageProps = {
		activeStudy,
		activate,
		bedBusy,
		harvestCount,
		onBedAction: runBedAction,
		reduceMotion,
		revision,
		sceneState,
	};

	return (
		<main className={`motion-lab motion-variant-${variant}`}>
			<header className="motion-header">
				<div>
					<a href="./homegrown-adventures.html?variant=A&mode=loop">Play the full loop →</a>
					<h1>Homegrown Motion Lab</h1>
					<p>Hover to preview. Click to pin and replay the actual Rive animation.</p>
				</div>
				<button className="motion-setting" type="button" onClick={toggleReducedMotion} aria-pressed={reduceMotion}>
					<span aria-hidden="true" />
					{reduceMotion ? "Use motion" : "Reduce motion"}
				</button>
			</header>

			{variant === "A" && <WorkbenchVariant {...stageProps} />}
			{variant === "B" && <GrowthVariant {...stageProps} />}
			{variant === "C" && <ReelVariant {...stageProps} />}

			<footer className="motion-footer">
				<span>{HOMEGROWN_RIVE_ASSET_AUTHORED ? "Authored Rive scene connected" : "Rive probe only"}</span>
				<span>{VARIANTS[variant].description}</span>
			</footer>
			<VariantSwitcher variant={variant} setVariant={setVariant} />
		</main>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<App />);
