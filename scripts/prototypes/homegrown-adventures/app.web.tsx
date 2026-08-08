// @ts-nocheck -- throwaway standalone lab; the reducer and Rive contract are checked separately.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	HOMEGROWN_RIVE_ASSET_AUTHORED,
	HomegrownRiveScene,
} from "../../../components/prototypes/homegrown-adventures/HomegrownRiveScene.web";
import { AdventureGlowrootRive } from "../../../components/prototypes/homegrown-adventures/AdventureGlowrootRive.web";
import { LanternleafReflectionsRive } from "../../../components/prototypes/homegrown-adventures/LanternleafReflectionsRive.web";
import {
	ACTIONS,
	adventureHomewardAt,
	adventureJourneyPhase,
	adventureOpportunity,
	adventureStory,
	BAG_ITEMS,
	BAG_SLOT_ORDER,
	bagItem,
	bagPackingCost,
	bagReturnReward,
	CROP_RULES,
	createInitialState,
	createPrototypeState,
	deserializeState,
	FIRST_ADVENTURE_OPPORTUNITY,
	HOMEGROWN_STORAGE_KEY,
	homegrownReducer,
	HARVEST_PATTERN,
	playerPresentation,
	PROTOTYPE_POSITIONS,
	serializeState,
	SECOND_ADVENTURE_OPPORTUNITY,
	STAGES,
	toolReturnBonus,
	WORLD_TARGETS,
} from "./game.mjs";
import {
	CLOVER_LUSH_THRESHOLD,
	homegrownRiveModel,
} from "./homegrownRiveModel.mjs";
import { formatAdventureReturnPromise } from "./journeyTime.mjs";
import "./styles.css";

const VARIANTS = {
	A: { name: "Rosie First", question: "Does the living Barn explain the loop by itself?" },
	B: { name: "Purpose Cards", question: "Does naming the purpose make farming click sooner?" },
	C: { name: "Welcome Home", question: "Does a brief return ceremony strengthen the Discovery without hiding Rosie?" },
};

// PROTOTYPE ONLY: three Position 7 structures answering whether Rosie's first
// Bag can begin empty, expose every real choice, and remain calm at phone size.
const BAG_CHOICE_STUDIES = Object.freeze({
	A: Object.freeze({ name: "All choices open" }),
	B: Object.freeze({ name: "One question" }),
	C: Object.freeze({ name: "Bag pockets" }),
});

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
	const opportunity = adventureOpportunity(state);
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	if (state.stage === STAGES.NEAR_DISCOVERY) {
		const copy = (lanternleaf ? {
			provision: {
				title: "Rosie found the open-gate trail",
				body: "Without a Provision she came Home before the Lanternleaves reflected their light.",
			},
			tool: {
				title: "Rosie saw leaves reflecting Glowroot",
				body: "A Tool could trace which reflections lead past the open gate.",
			},
			pack: {
				title: "Rosie mapped a new path",
				body: "A Pack could bring the trail's useful supplies Home next time.",
			},
		} : {
			provision: {
				title: "Rosie followed a warm moth trail",
				body: "Without a Provision she came Home kindly before the Glowroot seed opened.",
			},
			tool: {
				title: "Rosie found something warm underground",
				body: "A Tool could uncover the root she felt beneath the soft soil.",
			},
			pack: {
				title: "Rosie brought Home a glowing leaf-print",
				body: "A Pack could carry the delicate Glowroot Seed safely next time.",
			},
		})[state.nearDiscoveryReason];
		if (copy) return { eyebrow: "Near-Discovery · never failure", ...copy };
	}
	if (state.stage === STAGES.STARTING && state.hasTickled && !state.purpose) {
		return {
			eyebrow: "A named Request",
			title: opportunity.name,
			body: lanternleaf
				? "Glowroot opened the crossing. Grow a Provision so Rosie can follow its reflected leaves after dark."
				: "Choose what to grow for first. The dusk request makes Clover Lunch meaningful.",
		};
	}
	if (state.stage === STAGES.STARTING && state.purpose) {
		return {
			eyebrow: "Purpose before crop",
			title: `Grow Clover Lunch for ${opportunity.name}`,
			body: lanternleaf
				? "This harvest has a job: help Rosie stay past the open gate until nightfall."
				: "This harvest has a job: help Rosie stay beyond the hedge until the moths appear.",
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
			body: `The first bed is resting. Pack for ${opportunity.name} and this harvest becomes part of Rosie's journey.`,
		};
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && !state.changeRevealed) {
		return {
			eyebrow: "Rosie is Home",
			title: "Something glows inside her Bag",
			body: "Tickle Rosie first. Her return story reveals the named Discovery before any collection screen.",
		};
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && state.glowrootPlanted) {
		return {
			eyebrow: "A new route",
			title: "Rosie mapped the Lanternleaf Path",
			body: "Glowroot already grows at Home. Its light revealed a repeatable path, and the supplies can stay in Farm stock.",
		};
	}
	if (state.stage === STAGES.ADVENTURE && lanternleaf) {
		return {
			eyebrow: "Past the open gate",
			title: opportunity.waitingObjective,
			body: "The reflected leaves form a route while Rosie is away. Her prepared Bag shapes what comes Home.",
		};
	}
	if (state.stage === STAGES.PACKED && state.underprepared) {
		return {
			eyebrow: "A light Bag",
			title: "Rosie can still have a kind Adventure",
			body: "Without Clover Lunch she will return with a specific clue, not a failed mission or an empty reward.",
		};
	}
	if (state.stage === STAGES.PACKED && lanternleaf) {
		return {
			eyebrow: "Rosie’s Bag",
			title: `${opportunity.name} is packed`,
			body: "Clover Lunch · a chosen Tool · a chosen Pack. Each capability changes what Rosie can notice and carry Home.",
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

function HeartChip({ value }) {
	return (
		<div className="heart-chip" aria-label={`Tickles earned: ${value}`}>
			<Glyph name="heart" />
			<strong>{value.toLocaleString()}</strong>
		</div>
	);
}

function WorldAction({ presentation, onAction, waiting = false }) {
	if (presentation.target === WORLD_TARGETS.ROSIE) return null;
	return (
		<button
			className={`world-action world-action-${presentation.target} ${waiting ? "is-waiting" : ""}`}
			type="button"
			onClick={onAction}
			disabled={waiting}
			aria-describedby="current-objective"
		>
			<span className="world-action-pulse" aria-hidden="true" />
			<span className="world-action-label">
				{presentation.label}
				{presentation.detail && presentation.detailInAction !== false && <small>{presentation.detail}</small>}
			</span>
		</button>
	);
}

const BAG_SLOT_LABELS = {
	provision: "Provision",
	tool: "Tool",
	pack: "Pack",
};

function SeedAdventureReceipt({ opportunity, className = "" }) {
	return (
		<div
			className={`seed-adventure-receipt ${className}`}
			role="note"
			aria-label={`For ${opportunity.name}: Clover becomes Rosie’s Provision. ${opportunity.detail}.`}
		>
			<span><small>Grow for Rosie</small><strong>Clover becomes a Provision</strong></span>
			<em>{opportunity.detail}</em>
		</div>
	);
}

function SeedChoicePanel({ state, opportunity, onChoose }) {
	const farmStock = state.farmStock ?? {};
	const cloverSeeds = farmStock[CROP_RULES.clover.seedId] ?? 0;
	const glowrootSeeds = farmStock["glowroot-seed"] ?? 0;
	const compost = farmStock.compost ?? 0;
	const rememberedMorning = state.daysCompleted > 0 && state.glowrootPlanted;

	if (rememberedMorning) {
		return (
			<section className="seed-choice-panel seed-choice-memory" aria-label="Choose the next crop while Home keeps growing">
				<button className="seed-next-primary" type="button" onClick={onChoose} disabled={cloverSeeds < 1}>
					<span className="seed-art seed-art-clover" aria-hidden="true">☘</span>
					<span className="seed-next-copy">
						<small>Plant next</small>
						<strong>Clover Seed</strong>
						<b>{cloverSeeds} owned · stocks Rosie’s next Adventure</b>
					</span>
					<em>{cloverSeeds > 0 ? "Choose Clover" : "Need a Seed"}</em>
				</button>
				<div className="seed-choice-support">
					<div className="seed-memory-strip" aria-label="Already growing at Home">
						<strong>Growing</strong>
						<span><i aria-hidden="true">●</i><b>Moonberries</b><small>Bed 2</small></span>
						<span><i aria-hidden="true">✦</i><b>Glowroot</b><small>Bed 3</small></span>
					</div>
					<div className="seed-compost-note" aria-label={`Compost is an optional boost after choosing a Seed. ${compost} owned.`}>
						<i aria-hidden="true">♣</i>
						<span><small>Optional after Seed</small><strong>Compost · {compost} owned</strong></span>
					</div>
					{glowrootSeeds > 0 && <p>{glowrootSeeds} Glowroot Seed{glowrootSeeds === 1 ? "" : "s"} safe in Farm stock</p>}
				</div>
				<SeedAdventureReceipt opportunity={opportunity} className="seed-adventure-memory-receipt" />
			</section>
		);
	}

	return (
		<section className="seed-choice-panel" aria-label="Choose what to grow from Farm stock">
			<div className="farm-stock-label"><span aria-hidden="true">⌂</span><strong>Farm stock</strong></div>
			<div className="seed-choice-grid">
				<button
					type="button"
					className="seed-choice-card is-available"
					onClick={onChoose}
					disabled={cloverSeeds < 1}
				>
					<span className="seed-art seed-art-clover" aria-hidden="true">☘</span>
					<strong>Clover Seed</strong>
					<small>{cloverSeeds} owned</small>
					<b>{cloverSeeds > 0 ? "Choose Clover" : "Need a Seed"}</b>
				</button>
				<div className="seed-choice-card is-unknown" aria-label="Moonberry has not been discovered">
					<span className="seed-art seed-art-moonberry" aria-hidden="true">●</span>
					<strong>Moonberry</strong>
					<small>Not discovered</small>
					<b aria-hidden="true">?</b>
				</div>
				<div className="seed-choice-card is-supply" aria-label={`Compost: ${compost} owned`}>
					<span className="seed-art seed-art-compost" aria-hidden="true">♣</span>
					<strong>Compost</strong>
					<small>{compost} owned</small>
					<b>Optional boost</b>
				</div>
			</div>
			<SeedAdventureReceipt opportunity={opportunity} />
		</section>
	);
}

function PlantingPanel({ state, onToggleCompost, onPlant }) {
	const seeds = state.farmStock?.[CROP_RULES.clover.seedId] ?? 0;
	const compost = state.farmStock?.compost ?? 0;
	const boosted = state.compostApplied && compost > 0;
	const promisedYield = CROP_RULES.clover.baseYield + (boosted ? CROP_RULES.clover.compostYieldBonus : 0);
	return (
		<section className="planting-panel" aria-label="Plant Clover and choose whether to add Compost">
			<div className="planting-costs">
				<div className="planting-cost is-required">
					<span className="seed-art seed-art-clover" aria-hidden="true">☘</span>
					<span><small>Required Seed</small><strong>Clover</strong><b>{seeds} → {Math.max(0, seeds - 1)}</b></span>
				</div>
				<button
					type="button"
					className={`planting-cost compost-toggle ${boosted ? "is-selected" : ""}`}
					onClick={onToggleCompost}
					disabled={compost < 1 && !boosted}
					aria-pressed={boosted}
				>
					<span className="seed-art seed-art-compost" aria-hidden="true">♣</span>
					<span><small>Optional boost</small><strong>{boosted ? "Compost added" : "Add Compost"}</strong><b>{boosted ? `${compost} → ${compost - 1}` : `${compost} owned`}</b></span>
					<i aria-hidden="true">{boosted ? "✓" : "+"}</i>
				</button>
			</div>
			<div className="planting-effect" role="status">
				<strong>{promisedYield} Clover Lunches · ready in {boosted ? 2 : 4} hours</strong>
				<small>{boosted ? "Compost saves 2 hours and adds 1 Lunch." : "Add Compost: 1 more Lunch, 2 hours sooner."}</small>
			</div>
			<button type="button" className="plant-confirm" onClick={onPlant} disabled={seeds < 1}>
				{boosted ? "Plant with Compost" : "Plant Clover"}
			</button>
		</section>
	);
}

function GrowthStatusPanel({ state, onPreview }) {
	return (
		<section className={`growth-status-panel ${state.compostApplied ? "is-composted" : ""}`} aria-label="Clover growth status">
			<span className="growth-badge"><i aria-hidden="true">{state.compostApplied ? "✓" : "☘"}</i>{state.compostApplied ? "Composted" : "Growing normally"}</span>
			<strong>Ready in {state.compostApplied ? "2 hours" : "4 hours"}</strong>
			<small>Once ready, this crop waits safely until you harvest it.</small>
			<button type="button" onClick={onPreview}>Preview it ready</button>
		</section>
	);
}

const HARVEST_DIRECTION_LABELS = {
	left: { arrow: "←", name: "Left" },
	right: { arrow: "→", name: "Right" },
	up: { arrow: "↑", name: "Up" },
};

function HarvestRhythmPanel({ state, onBeat, onGatherNormally }) {
	const gestureStart = useRef(null);
	const beatIndex = state.harvestBeats?.length ?? 0;
	const nextDirection = HARVEST_PATTERN[beatIndex] ?? null;
	const nextLabel = nextDirection ? HARVEST_DIRECTION_LABELS[nextDirection] : null;
	const startGesture = (event) => {
		gestureStart.current = { x: event.clientX, y: event.clientY };
		try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
	};
	const finishGesture = (event) => {
		const start = gestureStart.current;
		gestureStart.current = null;
		if (!start) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
		const direction = Math.abs(dx) > Math.abs(dy)
			? dx < 0 ? "left" : "right"
			: dy < 0 ? "up" : null;
		if (direction) onBeat(direction, "swipe");
	};

	const pattern = (
		<div className="harvest-pattern" aria-label="Left, then Right, then Up">
			{HARVEST_PATTERN.map((direction, index) => (
				index === beatIndex
					? <button
						key={direction}
						type="button"
						className="is-next"
						onClick={() => onBeat(direction, "button")}
						aria-label={`Tap ${HARVEST_DIRECTION_LABELS[direction].name} instead`}
					>{HARVEST_DIRECTION_LABELS[direction].arrow}</button>
					: <span
						key={direction}
						className={index < beatIndex ? "is-complete" : ""}
					>{HARVEST_DIRECTION_LABELS[direction].arrow}</span>
			))}
		</div>
	);
	const guaranteedYield =
		CROP_RULES.clover.baseYield +
		(state.compostApplied ? CROP_RULES.clover.compostYieldBonus : 0);

	return (
		<div className="harvest-experiment">
			<div
				className="harvest-gesture-zone"
				onPointerDown={startGesture}
				onPointerUp={finishGesture}
				onPointerCancel={() => { gestureStart.current = null; }}
				role="group"
				aria-label="Swipe Clover left, right, then up"
			>
				<span aria-hidden="true">{nextLabel?.arrow}</span>
			</div>
			<section className="harvest-bed-ribbon is-unified" aria-label="Follow Clover's harvest rhythm">
				<strong aria-live="polite">{nextLabel ? `Swipe ${nextLabel.name}` : "Harvest complete"}</strong>
				{pattern}
				<small>Swipe bed · or tap arrow</small>
			</section>
			<div className="harvest-bed-assist is-unified">
				<span><i aria-hidden="true">✓</i> {guaranteedYield} Lunches guaranteed · clean rhythm +1</span>
				<button type="button" className="harvest-normal" onClick={onGatherNormally}>Gather normally</button>
			</div>
		</div>
	);
}

function HarvestStockIcon({ kind }) {
	if (kind === "clover") return <span className="stock-clover-art" aria-hidden="true"><i /><i /><i /><i /></span>;
	if (kind === "seed") return <span className="stock-seed-art" aria-hidden="true"><i /></span>;
	if (kind === "compost") return <span className="stock-compost-art" aria-hidden="true"><i /><i /><i /></span>;
	return <span className="stock-material-art" aria-hidden="true"><i /><i /><i /></span>;
}

function HarvestResultPanel({ state, actionLabel, onContinue }) {
	const compostBonus = state.compostApplied ? CROP_RULES.clover.compostYieldBonus : 0;
	const rhythmBonus = state.harvestRhythmBonus ? 1 : 0;
	const stockItems = [
		{ id: "clover", name: "Clover Lunch", value: state.farmStock?.["clover-lunch"] ?? 0, kind: "clover" },
		{ id: "seed", name: "Clover Seed", value: state.farmStock?.[CROP_RULES.clover.seedId] ?? 0, kind: "seed" },
		{ id: "compost", name: "Compost", value: state.farmStock?.compost ?? 0, kind: "compost" },
		{ id: "materials", name: "Willow Fiber", value: state.farmStock?.["willow-fiber"] ?? 0, kind: "materials" },
	];
	const stockGrid = <div className="farm-stock-grid">{stockItems.map((item) => (
		<div className={`farm-stock-item stock-kind-${item.kind}`} key={item.id}>
			<HarvestStockIcon kind={item.kind} />
			<small>{item.name}</small>
			<strong>{item.value}</strong>
		</div>
	))}</div>;
	const harvestBasket = <div className="harvest-basket" role="status" aria-label={`Clover Lunch plus ${state.lastHarvestYield}`}>
		<span className="harvest-basket-image" aria-hidden="true" />
		<div className="harvest-basket-label"><strong>Clover Lunch +{state.lastHarvestYield}</strong><small>{CROP_RULES.clover.baseYield} harvest{compostBonus ? ` · +${compostBonus} Compost` : ""}{rhythmBonus ? " · +1 rhythm" : ""}</small></div>
	</div>;
	const continueButton = <button type="button" className="harvest-prepare" onClick={onContinue}>{actionLabel}</button>;
	return (
		<section className="harvest-result-world harvest-result-shelf" aria-label="Clover harvest added to Farm stock">
			<div className="farm-stock-shelf"><strong>Farm stock</strong>{stockGrid}</div>
			{harvestBasket}
			{continueButton}
		</section>
	);
}

function BagItemArt({ itemId }) {
	return <span className={`bag-item-art bag-item-art-${itemId ?? "empty"}`} aria-hidden="true"><i /><i /><i /><i /></span>;
}

const BAG_ITEM_EFFECT_LABELS = Object.freeze({
	"glow-beneath-hedge": Object.freeze({
		"clover-lunch": "Stay until dusk",
		"hand-trowel": "Dig through soft soil",
		lantern: "Follow a glow after dark",
		"wicker-basket": "Carry a find Home",
		"cloth-wrap": "Protect a delicate find",
	}),
	"lights-past-open-gate": Object.freeze({
		"clover-lunch": "Stay until nightfall",
		"hand-trowel": "Search beneath the path",
		lantern: "Follow reflected leaves",
		"wicker-basket": "Carry sturdy supplies Home",
		"cloth-wrap": "Protect delicate leaves",
	}),
});

function BagSelectionPanel({ bag, farmStock, opportunity, activeSelection, onSelect, onConfirm }) {
	const selectedProvisionId = bag.provision ?? null;
	const selectedProvisionOwned = selectedProvisionId === null ? 0 : farmStock?.[selectedProvisionId] ?? 0;
	const selectedPackCost = bagPackingCost(bag.pack ?? null);
	const selectedPackMaterialOwned = selectedPackCost === null
		? 0
		: farmStock?.[selectedPackCost.itemId] ?? 0;
	const needsProvision = selectedProvisionId !== null && selectedProvisionOwned < 1;
	const needsPackingMaterial = selectedPackCost !== null && selectedPackMaterialOwned < selectedPackCost.amount;
	const canPack = !needsProvision && !needsPackingMaterial;
	const flightItemId = activeSelection?.item ?? activeSelection?.previousItem ?? null;
	const flightIsRemoval = activeSelection?.item === null && activeSelection?.previousItem !== null;
	const cycleItem = (slot) => {
		const choices = BAG_ITEMS[slot];
		const current = choices.findIndex((item) => item.id === bag[slot]);
		const next = choices[(current + 1 + choices.length) % choices.length];
		onSelect(slot, next.id);
	};

	return (
		<section className="bag-selection" aria-label="Choose what Rosie carries">
			{activeSelection && flightItemId && (
				<span
					key={`${activeSelection.slot}-${flightItemId}-${activeSelection.at}`}
					className={`bag-flight-item bag-flight-${activeSelection.slot} ${flightIsRemoval ? "is-removal" : "is-placement"}`}
					aria-hidden="true"
				>
					<BagItemArt itemId={flightItemId} />
				</span>
			)}
			<div className="bag-stage" aria-hidden="true">
				<span className="open-adventure-bag" />
				<div className="bag-packed-preview">
					{BAG_SLOT_ORDER.map((slot) => {
						const selected = bagItem(slot, bag[slot]);
						return <span className={`bag-preview-${slot} ${selected ? "is-filled" : "is-empty"}`} key={slot}><BagItemArt itemId={selected?.id} /></span>;
					})}
				</div>
			</div>
			<div className="bag-slot-grid">
			{BAG_SLOT_ORDER.map((slot) => {
				const selected = bagItem(slot, bag[slot]);
				const defaultItem = BAG_ITEMS[slot][0];
				const choices = BAG_ITEMS[slot];
				const currentIndex = choices.findIndex((item) => item.id === bag[slot]);
				const nextItem = choices[(currentIndex + 1 + choices.length) % choices.length];
				const nextPackingCost = slot === "pack" ? bagPackingCost(nextItem.id) : null;
				const nextPackingMaterialOwned = nextPackingCost === null
					? 0
					: farmStock?.[nextPackingCost.itemId] ?? 0;
				const changeBlocked = nextPackingCost !== null && nextPackingMaterialOwned < nextPackingCost.amount;
				const owned = slot === "provision" ? farmStock?.[selected?.id ?? defaultItem.id] ?? 0 : null;
				const packingCost = slot === "pack" ? bagPackingCost(selected?.id ?? null) : null;
				const packingMaterialOwned = packingCost === null ? 0 : farmStock?.[packingCost.itemId] ?? 0;
				const unavailable = (slot === "provision" && selected && owned < 1) ||
					(packingCost !== null && packingMaterialOwned < packingCost.amount);
				const effectLabel = selected
					? BAG_ITEM_EFFECT_LABELS[opportunity.id]?.[selected.id] ?? selected.effect
					: null;
				return (
					<div className={`bag-slot-card ${selected ? "is-filled" : "is-empty"} ${unavailable ? "is-unavailable" : ""}`} key={slot}>
						<span className="bag-slot-kind">{BAG_SLOT_LABELS[slot]}</span>
						<span className="bag-item-icon" aria-hidden="true"><BagItemArt itemId={selected?.id} /></span>
						<strong>{selected?.name ?? "Empty"}</strong>
						{selected ? (
							<small>{slot === "provision"
								? owned > 0
									? `${owned} → ${owned - 1} · ${effectLabel}`
									: `0 owned · Grow more or leave empty`
								: packingCost !== null
									? packingMaterialOwned >= packingCost.amount
										? `${packingMaterialOwned} Fiber → ${packingMaterialOwned - packingCost.amount} · ${effectLabel}`
										: `Needs ${packingCost.amount} ${packingCost.name}`
									: effectLabel}</small>
						) : (
							<small>Rosie can leave without one</small>
						)}
						<button
							type="button"
							className="bag-change"
							onClick={() => cycleItem(slot)}
							disabled={changeBlocked}
							aria-label={changeBlocked
								? `Need Willow Fiber to choose ${nextItem.name}`
								: selected
									? `Change ${BAG_SLOT_LABELS[slot]}`
									: `Choose ${defaultItem.name} for ${BAG_SLOT_LABELS[slot]}`}
						>
							{changeBlocked ? "Needs Fiber" : selected ? "Change" : "Choose"}
						</button>
						<button
							type="button"
							className="bag-empty"
							disabled={!selected}
							aria-label={`Leave ${BAG_SLOT_LABELS[slot]} empty`}
							onClick={() => onSelect(slot, null)}
						>
							Empty
						</button>
					</div>
				);
			})}
		</div>
		<button type="button" className="bag-confirm" onClick={onConfirm} disabled={!canPack}>
			{canPack ? "Pack these" : needsProvision ? "Need Clover Lunch" : "Need Willow Fiber"}
		</button>
		<p>{canPack
			? "Provision and fresh packing are used once. Tool and Pack come Home."
			: needsProvision
				? "Leave Provision empty to explore with a useful clue."
				: "Choose Wicker Basket, leave Pack empty, or bring back Willow Fiber."}</p>
		</section>
	);
}

function BagChoiceStudyOption({ slot, item, selected, disabled, detail, onSelect }) {
	const name = item?.name ?? "Leave empty";
	return (
		<button
			type="button"
			className={`bag-study-option ${selected ? "is-selected" : ""} ${item ? "" : "is-empty"}`}
			disabled={disabled}
			aria-pressed={selected}
			onClick={() => onSelect(slot, item?.id ?? null)}
		>
			<span aria-hidden="true"><BagItemArt itemId={item?.id} /></span>
			<strong>{name}</strong>
			<small>{detail}</small>
		</button>
	);
}

function BagChoiceStudyPanel({ variant, farmStock, opportunity }) {
	const [draft, setDraft] = useState({ provision: null, tool: null, pack: null });
	const [focus, setFocus] = useState("provision");
	const selectedCount = BAG_SLOT_ORDER.filter((slot) => draft[slot] !== null).length;
	const select = (slot, itemId) => setDraft((current) => ({ ...current, [slot]: itemId }));
	const detailFor = (slot, item) => {
		if (!item) return "A kind clue still comes Home";
		if (slot === "provision") {
			const owned = farmStock?.[item.id] ?? 0;
			return `${owned} owned · ${BAG_ITEM_EFFECT_LABELS[opportunity.id]?.[item.id] ?? item.effect}`;
		}
		const cost = slot === "pack" ? bagPackingCost(item.id) : null;
		if (cost) {
			const owned = farmStock?.[cost.itemId] ?? 0;
			return owned >= cost.amount
				? `${cost.amount} ${cost.name} · ${BAG_ITEM_EFFECT_LABELS[opportunity.id]?.[item.id] ?? item.effect}`
				: `Needs ${cost.amount} ${cost.name}`;
		}
		return BAG_ITEM_EFFECT_LABELS[opportunity.id]?.[item.id] ?? item.effect;
	};
	const choicesFor = (slot) => [
		...BAG_ITEMS[slot].map((item) => {
			const cost = slot === "pack" ? bagPackingCost(item.id) : null;
			const disabled = cost !== null && (farmStock?.[cost.itemId] ?? 0) < cost.amount;
			return <BagChoiceStudyOption
				key={item.id}
				slot={slot}
				item={item}
				selected={draft[slot] === item.id}
				disabled={disabled}
				detail={detailFor(slot, item)}
				onSelect={select}
			/>;
		}),
		<BagChoiceStudyOption
			key={`${slot}-empty`}
			slot={slot}
			item={null}
			selected={draft[slot] === null}
			disabled={false}
			detail={detailFor(slot, null)}
			onSelect={select}
		/>,
	];
	const packLabel = selectedCount === 0
		? "Set out with an empty Bag"
		: `Pack ${selectedCount} ${selectedCount === 1 ? "choice" : "choices"}`;
	const question = {
		provision: "How long should Rosie stay?",
		tool: "What should Rosie try?",
		pack: "What can Rosie carry Home?",
	}[focus];

	if (variant === "A") {
		return (
			<section className="bag-choice-study bag-choice-study-a" aria-label="Choose every Bag slot directly">
				<div className="bag-study-title"><strong>Rosie's Bag starts empty</strong><small>Choose any item—or leave any slot open.</small></div>
				<div className="bag-study-all-rows">
					{BAG_SLOT_ORDER.map((slot) => <div className="bag-study-row" key={slot}>
						<strong>{BAG_SLOT_LABELS[slot]}</strong>
						<div>{choicesFor(slot)}</div>
					</div>)}
				</div>
				<button className="bag-study-confirm" type="button">{packLabel}</button>
			</section>
		);
	}

	if (variant === "B") {
		const focusIndex = BAG_SLOT_ORDER.indexOf(focus);
		return (
			<section className="bag-choice-study bag-choice-study-b" aria-label="Choose one Bag question at a time">
				<div className="bag-study-title"><strong>Pack for the hedge glow</strong><small>The Bag begins empty. Every slot is optional.</small></div>
				<div className="bag-study-progress" role="tablist" aria-label="Bag slots">
					{BAG_SLOT_ORDER.map((slot) => {
						const selected = bagItem(slot, draft[slot]);
						return <button key={slot} type="button" role="tab" aria-selected={focus === slot} onClick={() => setFocus(slot)}>
							<small>{BAG_SLOT_LABELS[slot]}</small><strong>{selected?.name ?? "Empty"}</strong>
						</button>;
					})}
				</div>
				<div className="bag-study-question">
					<div><small>{BAG_SLOT_LABELS[focus]}</small><strong>{question}</strong></div>
					<div className="bag-study-question-options">{choicesFor(focus)}</div>
					<button
						type="button"
						className="bag-study-next"
						onClick={() => setFocus(BAG_SLOT_ORDER[Math.min(BAG_SLOT_ORDER.length - 1, focusIndex + 1)])}
						disabled={focusIndex === BAG_SLOT_ORDER.length - 1}
					>{focusIndex === BAG_SLOT_ORDER.length - 1 ? "All choices visible" : `Next: ${BAG_SLOT_LABELS[BAG_SLOT_ORDER[focusIndex + 1]]}`}</button>
				</div>
				<button className="bag-study-confirm" type="button">{packLabel}</button>
			</section>
		);
	}

	return (
		<section className="bag-choice-study bag-choice-study-c" aria-label="Choose Bag items from physical pockets">
			<div className="bag-study-title"><strong>Rosie's open Bag</strong><small>Tap a pocket. Empty is always a kind choice.</small></div>
			<div className="bag-study-physical" aria-label="Bag pockets">
				<span className="open-adventure-bag" aria-hidden="true" />
				{BAG_SLOT_ORDER.map((slot) => {
					const selected = bagItem(slot, draft[slot]);
					return <button key={slot} type="button" className={`bag-study-pocket pocket-${slot} ${focus === slot ? "is-active" : ""}`} onClick={() => setFocus(slot)}>
						<BagItemArt itemId={selected?.id} /><small>{BAG_SLOT_LABELS[slot]}</small><strong>{selected?.name ?? "Empty"}</strong>
					</button>;
				})}
			</div>
			<div className="bag-study-pocket-picker">
				<div><small>{BAG_SLOT_LABELS[focus]}</small><strong>{question}</strong></div>
				<div>{choicesFor(focus)}</div>
			</div>
			<button className="bag-study-confirm" type="button">{packLabel}</button>
		</section>
	);
}

function PackedLoadoutRibbon({ bag, farmStock }) {
	return (
		<div className="packed-loadout" aria-label="Rosie's packed items">
		{BAG_SLOT_ORDER.map((slot) => {
			const selected = bagItem(slot, bag[slot]);
			const packingCost = slot === "pack" ? bagPackingCost(selected?.id ?? null) : null;
			const remainingPackingMaterial = packingCost === null
				? null
				: farmStock?.[packingCost.itemId] ?? 0;
			const slotLabel = packingCost === null
				? BAG_SLOT_LABELS[slot]
				: `${BAG_SLOT_LABELS[slot]} · Fiber ${remainingPackingMaterial}`;
			return (
				<span key={slot} className={selected ? "" : "is-empty"}>
					<i aria-hidden="true">{selected?.icon ?? "·"}</i>
					<small>{slotLabel}</small>
					<strong>{selected?.name ?? "Empty"}</strong>
				</span>
			);
		})}
		</div>
	);
}

function AdventureVignetteOverlay({ state, beat }) {
	const story = adventureStory(state);
	const opportunity = adventureOpportunity(state);
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const activeBeatIndex = BAG_SLOT_ORDER.indexOf(beat);
	const resolved = beat === "resolved";
	const activeTag = resolved ? null : story.journeyTags[activeBeatIndex];
	return (
		<section
			className="adventure-vignette-overlay"
			data-adventure-cause-beat={beat}
			data-story-kind={story.kind}
			aria-label="Beyond-the-hedge journey"
		>
			{resolved ? (
				<div key={beat} className="adventure-auto-handoff" role="status" aria-live="polite">
					<i aria-hidden="true"><b /><b /><b /></i>
					<small>Rosie follows the {lanternleaf ? "reflected leaves" : "warm light"}</small>
					<strong>The journey continues…</strong>
				</div>
			) : (
				<div key={beat} className="adventure-field-note" role="status" aria-live="polite">
					<i aria-hidden="true">{activeTag.icon}</i>
					<small>{BAG_SLOT_LABELS[activeTag.slot]}</small>
					<strong>{activeTag.name}</strong>
					<p>{activeTag.detail}</p>
				</div>
			)}
		</section>
	);
}

function journeyWatchCopy(lanternleaf, journeyPhase) {
	if (journeyPhase === "homeward") {
		return lanternleaf
			? {
				eyebrow: "The leaves turn Home",
				title: "Rosie is heading Home",
				body: "Silver reflections now point toward the old gate. The porch light is waiting for her.",
			}
			: {
				eyebrow: "The moths turn Home",
				title: "Rosie is heading Home",
				body: "Warm lights are drifting toward the old gate. The porch light is waiting for her.",
			};
	}
	return lanternleaf
		? {
			eyebrow: "Beyond the open gate",
			title: "Rosie follows reflected leaves",
			body: "Her Bag keeps the silver route within reach while Home waits beyond the hedge.",
		}
		: {
			eyebrow: "Beyond the hedge",
			title: "Rosie follows warm moths",
			body: "Her Bag keeps the golden trail within reach while Home waits beyond the hedge.",
		};
}

function JourneyPackedStamp({ bag }) {
	const items = BAG_SLOT_ORDER.map((slot) => ({
		slot,
		item: bagItem(slot, bag?.[slot] ?? null),
	}));
	const label = `Rosie set out with: ${items.map(({ slot, item }) => `${BAG_SLOT_LABELS[slot]} ${item?.name ?? "empty"}`).join(", ")}`;
	return <div className="journey-packed-stamp" role="group" aria-label={label}>
		<small aria-hidden="true">Packed</small>
		{items.map(({ slot, item }) => <span key={slot} className={item ? "" : "is-empty"}><BagItemArt itemId={item?.id} /></span>)}
	</div>;
}

function JourneyWatchPanel({ state, journeyPhase, now, actionLabel, onAction }) {
	const opportunity = adventureOpportunity(state);
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const homecomingReady = state.adventureComplete;
	const trailLabel = lanternleaf ? "Reflected leaves" : "Warm moth trail";
	const copy = journeyWatchCopy(lanternleaf, journeyPhase);
	const homeward = journeyPhase === "homeward";
	const returnPromise = homecomingReady
		? null
		: formatAdventureReturnPromise(state.adventureReadyAt, { now });

	return (
		<section
			className={`journey-watch ${homecomingReady ? "is-homecoming-ready" : ""}`}
			data-journey-phase={journeyPhase}
			aria-label="Rosie's adventure progress"
		>
			<div className="journey-watch-tint" aria-hidden="true" />
			<div className="journey-home-dusk" aria-hidden="true"><i /></div>
			<div className="journey-watch-note" role="status" aria-live="polite">
				<span className="journey-watch-mark" aria-hidden="true" />
				<small>{homecomingReady ? "The gate bell rings" : copy.eyebrow}</small>
				<strong>{homecomingReady ? "Rosie is Home" : copy.title}</strong>
				<p>{homecomingReady
					? "Welcome her before opening the Bag. The Discovery still belongs to Homecoming."
					: copy.body}</p>
			</div>
			{returnPromise && <div className="journey-return-time-ticket" role="group" aria-label={returnPromise.ariaLabel}>
				<small aria-hidden="true">Expected Home</small>
				<strong aria-hidden="true">{returnPromise.display}</strong>
			</div>}
			{!homecomingReady && <JourneyPackedStamp bag={state.bag} />}
			<ol className="journey-watch-route" aria-label={homecomingReady ? "Adventure complete" : "Adventure in progress"}>
				<li className="is-complete"><i aria-hidden="true">1</i><span>Set off</span></li>
				<li className={homecomingReady || homeward ? "is-complete" : "is-current"}><i aria-hidden="true">2</i><span>{trailLabel}</span></li>
				<li className={homecomingReady || homeward ? "is-current" : ""}><i aria-hidden="true">3</i><span>{homecomingReady ? "At Home" : "Homeward"}</span></li>
			</ol>
			<div className="journey-watch-lights" aria-hidden="true"><i /><i /><i /><i /></div>
			{homecomingReady && <button type="button" className="journey-watch-action" onClick={onAction}>{actionLabel}</button>}
		</section>
	);
}

function ReturnRewardPanel({ state, actionLabel, onAction, handoffActive = false }) {
	const nearDiscovery = state.stage === STAGES.NEAR_DISCOVERY;
	const opportunity = adventureOpportunity(state);
	const lanternleafDiscovery = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const story = adventureStory(state);
	const packReward = bagReturnReward(state.bag?.pack ?? null);
	const toolBonus = nearDiscovery ? null : toolReturnBonus(state.bag?.tool ?? null);
	const glowrootAmount = 1 + (toolBonus?.itemId === "glowroot-seed" ? toolBonus.amount : 0);
	const willowFiberAmount = 2 + (toolBonus?.itemId === "willow-fiber" ? toolBonus.amount : 0);
	const practicalReward = nearDiscovery
		? { name: "Compost", amount: 1 }
		: packReward ?? { name: "Pack supply", amount: 0 };
	return (
		<section className="return-reward-panel" data-return-kind={nearDiscovery ? "near-discovery" : "discovery"} data-tool-bonus={toolBonus?.itemId ?? "none"} aria-label="Rosie's return rewards">
			{!nearDiscovery && packReward?.itemId === "clover-seed" && (
				<span className="return-pack-supply return-pack-supply-seed" aria-hidden="true" />
			)}
			{toolBonus?.itemId === "glowroot-seed" && (
				<span className="return-tool-bonus return-tool-bonus-seed" aria-hidden="true" />
			)}
			{toolBonus?.itemId === "willow-fiber" && (
				<span className="return-tool-bonus return-tool-bonus-fiber" aria-hidden="true" />
			)}
			<div className="return-discovery-plaque">
				<span className="return-card-eyebrow">{nearDiscovery ? "Useful clue" : lanternleafDiscovery ? "New route" : "New Discovery"}</span>
				<strong>{nearDiscovery ? opportunity.clueName : lanternleafDiscovery ? opportunity.discoveryName : `Glowroot Seed  +${glowrootAmount}`}</strong>
				<small>{nearDiscovery
					? story.result
					: lanternleafDiscovery
						? `Glowroot revealed a repeatable path · ${glowrootAmount === 1 ? "one Seed stays" : "two Seeds stay"} in Farm stock`
						: "A slow Crop that glows after dusk"}</small>
			</div>
			<div className="return-stock-ledger" aria-label="Farm stock returned">
				<strong className="return-stock-title">Added to Farm stock</strong>
				<div>
					<span><b>{practicalReward.name}</b><strong>+{practicalReward.amount}</strong></span>
					<span>
						<b>{nearDiscovery ? lanternleafDiscovery ? "Trail clue" : "Leaf-print clue" : "Glowroot Seed"}</b>
						<strong>{nearDiscovery ? "Found" : `+${glowrootAmount}`}</strong>
						{!nearDiscovery && toolBonus?.itemId === "glowroot-seed" && (
							<small className="return-stock-cause">Find +1 · Trowel +1</small>
						)}
					</span>
					<span>
						<b>Willow Fiber</b>
						<strong>+{nearDiscovery ? 1 : willowFiberAmount}</strong>
						{!nearDiscovery && toolBonus?.itemId === "willow-fiber" && (
							<small className="return-stock-cause">Find +2 · Lantern +1</small>
						)}
					</span>
				</div>
			</div>
			<button type="button" className="return-reward-action" disabled={handoffActive} onClick={onAction}>{actionLabel}</button>
		</section>
	);
}

function SeedHandoff({ origin, phase }) {
	if (!phase) return null;
	return (
		<div
			className={`seed-handoff origin-${origin} is-${phase}`}
			role="status"
			aria-live="polite"
			aria-label={phase === "arriving" ? "Glowroot Seed arrives at Bed 3" : "Rosie carries the Glowroot Seed to Bed 3"}
		>
			{origin === "base" && phase === "departing" && <span className="seed-handoff-base-mask" aria-hidden="true" />}
			<span className="seed-handoff-token" aria-hidden="true" />
		</div>
	);
}

function HomeMemoryPanel({ state, actionLabel, onAction, showAction = true, expanded, onToggle }) {
	const stock = state.farmStock ?? {};
	const stockItems = [
		["☘", "Clover Seed", stock["clover-seed"] ?? 0],
		["✦", "Glowroot Seed", stock["glowroot-seed"] ?? 0],
		["♣", "Compost", stock.compost ?? 0],
		["≋", "Willow Fiber", stock["willow-fiber"] ?? 0],
	];
	return (
		<section className={`home-memory-panel home-memory-panel-pocket ${expanded ? "is-expanded" : ""} ${showAction ? "has-action" : ""}`} aria-label="The Farm remembers this Adventure">
			<div className="home-memory-pocket-detail" id="farm-memory-detail" hidden={!expanded}>
				<strong>Crops grow · Stock stays · Discoveries stay</strong>
				<div aria-label="Current Farm stock">
					{stockItems.map(([icon, name, amount]) => <span key={name}><i aria-hidden="true">{icon}</i><small>{name}</small><b>{amount}</b></span>)}
				</div>
			</div>
			<button
				type="button"
				className="home-memory-pocket"
				aria-controls="farm-memory-detail"
				aria-expanded={expanded}
				aria-label={expanded ? "Close Farm memory and stock" : "Open Farm memory and stock"}
				onClick={onToggle}
			>
				<strong>The Farm remembers</strong>
				<span aria-hidden="true">{stockItems.map(([icon, , amount]) => `${icon}${amount}`).join("  ")}</span>
				<small>{expanded ? "Close" : "See stock"}</small>
			</button>
			{showAction && <button type="button" className="home-memory-action" onClick={onAction}>{actionLabel}</button>}
		</section>
	);
}

function NewDayHandoff() {
	return (
		<div className="new-day-handoff" role="status" aria-live="polite">
			<div>
				<strong>A new morning</strong>
				<small>Your Farm remembers</small>
			</div>
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
const HOMEGROWN_REVIEW_STORAGE_KEY = `${HOMEGROWN_STORAGE_KEY}.review`;
const ADVENTURE_CAUSE_BEAT_MS = 900;
const ADVENTURE_HANDOFF_MS = 900;
const REDUCED_ADVENTURE_HANDOFF_MS = 1800;
const RAPID_TRANSITION_GUARD_MS = 350;
const HARVEST_CELEBRATION_MS = 560;
const NEW_DAY_HANDOFF_MS = 900;
const REDUCED_NEW_DAY_HANDOFF_MS = 300;
const SEED_HANDOFF_DEPART_MS = 420;
const SEED_HANDOFF_ARRIVE_MS = 460;
const GLOWROOT_HOME_REVEAL_MS = 900;
const RAPID_TRANSITION_ACTIONS = new Set([
	ACTIONS.TICKLE,
	ACTIONS.SELECT_CROP,
	ACTIONS.TOGGLE_COMPOST,
	ACTIONS.PLANT_CLOVER,
	ACTIONS.ADVANCE_TIME,
	ACTIONS.HARVEST_CLOVER,
	ACTIONS.OPEN_BAG_SELECTION,
	ACTIONS.PACK_ADVENTURE,
	ACTIONS.START_ADVENTURE,
	ACTIONS.CONTINUE_ADVENTURE_STORY,
	ACTIONS.WELCOME_HOME,
	ACTIONS.ACKNOWLEDGE_RETURN,
	ACTIONS.PLANT_GLOWROOT,
	ACTIONS.PLANT_NEXT,
	ACTIONS.RETRY_PREP,
	ACTIONS.START_NEW_DAY,
]);

function compactStoryCopy(state) {
	if (state.stage === STAGES.DEVELOPED) {
		return { eyebrow: "Home remembers", title: "Glowroot lives at Home" };
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && state.glowrootPlanted) {
		return { eyebrow: "Home recognizes it", title: "Another Glowroot Seed · stocked" };
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

function PurposeSign({ state }) {
	let copy;
	if (state.stage === STAGES.GLOWROOT_RETURNED) {
		copy = state.glowrootPlanted
			? {
				id: "glowroot-stocked",
				eyebrow: "Home remembers",
				title: "Glowroot Seed",
				detail: "Keeping it in Farm stock",
				mark: "glow",
				label: "Current purpose: Keep the returning Glowroot Seed in Farm stock",
			}
			: {
				id: "glowroot-found",
				eyebrow: "Rosie found",
				title: "Glowroot Seed",
				detail: "Ready to plant",
				mark: "glow",
				label: "Current purpose: Rosie found Glowroot Seed, ready to plant",
			};
	} else if (state.stage === STAGES.DEVELOPED && state.nextPlanting) {
		copy = {
			id: "dusk-moths-welcomed",
			eyebrow: "Purpose fulfilled",
			title: "Dusk moths",
			detail: "Moonberries welcomed them",
			mark: "berry",
			label: "Purpose fulfilled: Moonberries welcomed the dusk moths",
		};
	} else if (state.stage === STAGES.DEVELOPED) {
		copy = {
			id: "moonberries-request",
			eyebrow: "Grow for",
			title: "Moonberries",
			detail: "Invite the dusk moths",
			mark: "berry",
			label: "Current purpose: Grow Moonberries to invite the dusk moths",
		};
	} else {
		return null;
	}

	return (
		<div
			className={`purpose-sign mark-${copy.mark}`}
			data-purpose-sign={copy.id}
			role="status"
			aria-live="polite"
			aria-label={copy.label}
		>
			<span className="purpose-sign-eyebrow">{copy.eyebrow}</span>
			<strong>{copy.title}</strong>
			<span className="crop-mark" aria-hidden="true" />
			<small>{copy.detail}</small>
		</div>
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

function BagChoiceStudySwitcher({ variant, setVariant }) {
	const keys = Object.keys(BAG_CHOICE_STUDIES);
	const index = keys.indexOf(variant);
	useEffect(() => {
		const onKeyDown = (event) => {
			const target = event.target;
			if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
			if (event.key === "ArrowLeft") setVariant(keys[(index + keys.length - 1) % keys.length]);
			if (event.key === "ArrowRight") setVariant(keys[(index + 1) % keys.length]);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [index, keys, setVariant]);
	return (
		<div className="bag-choice-study-switcher" aria-label="First Bag prototype variants">
			<button type="button" aria-label="Previous Bag variant" onClick={() => setVariant(keys[(index + keys.length - 1) % keys.length])}>←</button>
			<span><strong>{variant}</strong><small>{BAG_CHOICE_STUDIES[variant].name}</small></span>
			<button type="button" aria-label="Next Bag variant" onClick={() => setVariant(keys[(index + 1) % keys.length])}>→</button>
		</div>
	);
}

function JourneyReviewRailAction({ actionLabel, onAction }) {
	return (
		<div className="journey-review-rail-action" aria-label="Journey review shortcut">
			<span><small>Browser prototype</small><strong>Skip the six-hour wait</strong></span>
			<button type="button" aria-label={actionLabel} onClick={onAction}><span aria-hidden="true">↠</span> Fast-forward</button>
		</div>
	);
}

function positionRailName({ position, showingAdventureVignette, showingJourneyWatch, journeyPhase, adventureComplete }) {
	if (position !== 9) return PROTOTYPE_POSITIONS[position - 1].name;
	if (showingAdventureVignette) return "Adventure begins";
	if (!showingJourneyWatch) return PROTOTYPE_POSITIONS[position - 1].name;
	if (adventureComplete) return "At the gate";
	return journeyPhase === "homeward" ? "Heading Home" : "Following the trail";
}

function journeyHudObjective({ showingJourneyWatch, journeyPhase, adventureComplete, defaultObjective }) {
	if (!showingJourneyWatch || adventureComplete || journeyPhase !== "homeward") return defaultObjective;
	return "Rosie is heading Home";
}

function PositionRail({ position, onChange, positionName }) {
	const current = PROTOTYPE_POSITIONS[position - 1];
	const atStart = position === 1;
	const atEnd = position === PROTOTYPE_POSITIONS.length;
	return (
		<nav className="position-rail" aria-label="Prototype progression positions">
			<button
				type="button"
				disabled={atStart}
				onClick={() => onChange(position - 1)}
				aria-label="Previous position"
			>
				<span aria-hidden="true">←</span><strong>Previous</strong>
			</button>
			<div className="position-readout" role="status" aria-live="polite">
				<strong>Position {position} / {PROTOTYPE_POSITIONS.length}</strong>
				<small>{positionName ?? current.name}</small>
			</div>
			<button
				type="button"
				onClick={() => onChange(atEnd ? 1 : position + 1)}
				aria-label={atEnd ? "Loop to first position" : "Next position"}
			>
				<strong>{atEnd ? "Loop" : "Next"}</strong><span aria-hidden="true">{atEnd ? "↻" : "→"}</span>
			</button>
		</nav>
	);
}

function sceneImage() {
	// Crop and Home consequences now live in the authored Rive scene. Keeping
	// one Barn plate makes the player's lasting changes legible and causal.
	return "starting";
}

function sceneLabel(state, { gateHomecomingReady = false, journeyPhase = null, plantingGlowroot = false } = {}) {
	if (plantingGlowroot) {
		return "Glowroot Seed is ready to plant. Rosie waits beside the warm paper-craft Barn and the empty third Kitchen Patch bed.";
	}
	if (gateHomecomingReady) {
		return "Rosie has returned through the warm paper-craft Barn gate and stands in the yard with her packed satchel. Her Discovery remains inside until the player welcomes her Home.";
	}
	if (state.stage === STAGES.ADVENTURE) {
		const journeyDetail = journeyPhase === "homeward"
			? "The route lights have turned toward the old gate and the porch light glows brighter as Rosie heads Home."
			: "Route lights lead beyond the hedge while the porch keeps one small light glowing for Rosie.";
		if (journeyPhase === "homeward") {
			const homewardRoute = adventureOpportunity(state).id === SECOND_ADVENTURE_OPPORTUNITY.id
				? "Silver reflections turn toward the old gate"
				: "Warm moth lights turn toward the old gate";
			return `Rosie is heading Home. ${homewardRoute} across the twilight paper-craft Barn and remembered Kitchen Patch. The porch light is waiting for her.`;
		}
		return `${stageCopy(state).title}. The twilight paper-craft Barn and remembered Kitchen Patch stay visible while Rosie explores beyond the hedge. ${journeyDetail}`;
	}
	if ([STAGES.GLOWROOT_RETURNED, STAGES.NEAR_DISCOVERY].includes(state.stage)) {
		return `${stageCopy(state).title}. Rosie stands in the warm lantern-lit Barn workshop behind a wooden table holding the exact supplies she carried Home.`;
	}
	const rememberedHome = state.glowrootPlanted
		? " The open hedge, earned bell, Glowroot bed, and growing crops remain from the last Adventure."
		: "";
	return `${stageCopy(state).title}. Warm paper-craft Barn exterior with Rosie and a three-bed Kitchen Patch.${rememberedHome}`;
}

function App() {
	const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
	const initialSearch = new URLSearchParams(window.location.search);
	const loopMode = initialSearch.get("mode") === "loop";
	const autoPlay = loopMode && !initialSearch.has("position");
	const requestedPosition = Number(initialSearch.get("position"));
	const hasRequestedPosition = Number.isInteger(requestedPosition) && requestedPosition >= 1 && requestedPosition <= PROTOTYPE_POSITIONS.length;
	const requestedJourneyPhase = initialSearch.get("journey") === "homeward" ? "homeward" : "trail";
	const requestedAdventureRoute = initialSearch.get("route") === "lanternleaf" ? "lanternleaf" : "glowroot";
	const requestedBagChoiceVariant = initialSearch.get("bagchoice")?.toUpperCase();
	const initialBagChoiceVariant = Object.hasOwn(BAG_CHOICE_STUDIES, requestedBagChoiceVariant) ? requestedBagChoiceVariant : "A";
	const bagChoiceStudy = hasRequestedPosition && requestedPosition === 7 && initialSearch.has("bagchoice");
	const reviewMode = loopMode || hasRequestedPosition;
	const [state, dispatch] = useReducer(homegrownReducer, undefined, () => {
		if (hasRequestedPosition) {
			const persistedReview = deserializeState(localStorage.getItem(HOMEGROWN_REVIEW_STORAGE_KEY), {
				reduceMotion: prefersReduced,
			});
			if (
				persistedReview.prototypePosition === requestedPosition &&
				requestedJourneyPhase === "trail" &&
				requestedAdventureRoute === "glowroot"
			) return persistedReview;
			return createPrototypeState(requestedPosition, {
				reduceMotion: persistedReview.reduceMotion,
				journeyPhase: requestedJourneyPhase,
				adventureRoute: requestedAdventureRoute,
			});
		}
		if (loopMode) return createInitialState({ reduceMotion: prefersReduced });
		return deserializeState(localStorage.getItem(HOMEGROWN_STORAGE_KEY), { reduceMotion: prefersReduced });
	});
	const [variant, setVariant] = useVariant();
	const [bagChoiceVariant, setBagChoiceVariantState] = useState(initialBagChoiceVariant);
	const [visualNow, setVisualNow] = useState(() => Date.now());
	const presentation = useMemo(() => playerPresentation(state), [state]);
	const opportunity = useMemo(() => adventureOpportunity(state), [state]);
	const riveModel = useMemo(
		() => homegrownRiveModel(state, visualNow),
		[state, visualNow],
	);
	const image = sceneImage();
	const [feedback, setFeedback] = useState(0);
	const [startingNewDay, setStartingNewDay] = useState(false);
	const [adventureCauseBeat, setAdventureCauseBeat] = useState("provision");
	const [seedHandoff, setSeedHandoff] = useState(null);
	const [glowrootHomeReveal, setGlowrootHomeReveal] = useState(false);
	const [homeMemoryExpanded, setHomeMemoryExpanded] = useState(false);
	const transitionLockUntil = useRef(0);
	const newDayTimer = useRef(null);
	const glowrootHomeRevealTimer = useRef(null);
	const seedHandoffTimers = useRef([]);
	const debug = new URLSearchParams(window.location.search).get("debug") === "1";
	const setBagChoiceVariant = useCallback((nextVariant) => {
		const normalized = Object.hasOwn(BAG_CHOICE_STUDIES, nextVariant) ? nextVariant : "A";
		const url = new URL(window.location.href);
		url.searchParams.set("bagchoice", normalized);
		window.history.replaceState({}, "", url);
		setBagChoiceVariantState(normalized);
	}, []);
	const position = state.prototypePosition ?? 1;
	const choosingSeed = position === 2 && state.stage === STAGES.STARTING && !state.selectedCrop;
	const plantingCrop = position === 3 && state.stage === STAGES.STARTING && state.selectedCrop === "clover";
	const showingGrowth = position === 4 && state.stage === STAGES.CLOVER_GROWING;
	const showingHarvestRhythm =
		position === 5 &&
		state.stage === STAGES.CLOVER_READY &&
		state.changeRevealed &&
		!state.cloverHarvested;
	const harvestCelebrationEndsAt = (state.harvestCompletedAt ?? 0) + HARVEST_CELEBRATION_MS;
	const showingHarvestCelebration =
		position === 6 &&
		state.stage === STAGES.CLOVER_READY &&
		state.cloverHarvested &&
		!state.reduceMotion &&
		visualNow < harvestCelebrationEndsAt;
	const showingHarvestResult = position === 6 && state.stage === STAGES.CLOVER_READY && state.cloverHarvested && !showingHarvestCelebration;
	const showingFarmingPanel = choosingSeed || plantingCrop || showingGrowth || showingHarvestRhythm || showingHarvestCelebration || showingHarvestResult;
	const choosingBag = position === 7 && state.stage === STAGES.CLOVER_READY && state.cloverHarvested;
	const departing = position === 8 && state.stage === STAGES.ADVENTURE && !state.departureComplete;
	const showingAdventureVignette = position === 9 && state.stage === STAGES.ADVENTURE && state.departureComplete && !state.adventureVignetteSeen;
	const showingJourneyWatch = position === 9 && state.stage === STAGES.ADVENTURE && state.departureComplete && state.adventureVignetteSeen;
	const gateHomecomingReady = showingJourneyWatch && state.adventureComplete;
	const journeyPhase = adventureJourneyPhase(state, visualNow) ?? "trail";
	const currentPositionName = positionRailName({
		position,
		showingAdventureVignette,
		showingJourneyWatch,
		journeyPhase,
		adventureComplete: state.adventureComplete,
	});
	const adventureEnvironmentRevealed = ["tool", "pack", "resolved"].includes(adventureCauseBeat);
	const showingReturnReward = position === 10 && [STAGES.GLOWROOT_RETURNED, STAGES.NEAR_DISCOVERY].includes(state.stage);
	const returnKind = state.stage === STAGES.NEAR_DISCOVERY ? "near-discovery" : "discovery";
	const homeMemoryEarned = state.glowrootPlanted;
	const showingGlowrootPlanting =
		position === 11 &&
		state.stage === STAGES.GLOWROOT_RETURNED &&
		state.returnRewardAcknowledged &&
		!state.glowrootPlanted;
	const showingHomeMemory = position === 11 && homeMemoryEarned;
	const showingMoonberryPlanting =
		showingHomeMemory &&
		state.stage === STAGES.DEVELOPED &&
		!state.nextPlanting;
	const showingHomeTickle =
		showingHomeMemory &&
		state.stage === STAGES.DEVELOPED &&
		state.nextPlanting === "moonberries" &&
		!state.cycleComplete;
	const holdingGlowrootHomeReveal = glowrootHomeReveal && !state.reduceMotion;
	const showPackedLoadout = position >= 8 && position <= 10 && !showingAdventureVignette && !showingJourneyWatch && !showingReturnReward;
	const sceneRiveViewModel = useMemo(() => {
		if (
			!showingAdventureVignette ||
			opportunity.id !== SECOND_ADVENTURE_OPPORTUNITY.id
		) return riveModel.viewModel;
		return {
			...riveModel.viewModel,
			bedOneState: "empty",
			bedTwoState: "empty",
			bedThreeState: "empty",
			hedgehogVisible: false,
			frogVisible: false,
			mothsVisible: false,
			hedgeCrossingOpen: false,
			hedgeBellEarned: false,
		};
	}, [opportunity.id, riveModel.viewModel, showingAdventureVignette]);
	const adventureAttentionTrigger = showingAdventureVignette && !state.reduceMotion && adventureCauseBeat === "tool"
		? "adventure-attention"
		: null;
	const sceneRiveTrigger = adventureAttentionTrigger ?? (gateHomecomingReady ? "return" : riveModel.trigger);
	const sceneRiveTriggerNonce = adventureAttentionTrigger
		? `${riveModel.triggerNonce}:adventure-attention:${opportunity.id}`
		: gateHomecomingReady
		? `${riveModel.triggerNonce}:gate-homecoming`
		: riveModel.triggerNonce;
	const waiting = departing || (autoPlay && (
		state.stage === STAGES.CLOVER_GROWING ||
		(state.stage === STAGES.ADVENTURE && state.departureComplete && state.adventureVignetteSeen && !state.adventureComplete)
	));
	const visiblePresentation = holdingGlowrootHomeReveal
		? { ...presentation, objective: "Glowroot takes root", detail: "The Farm remembers" }
		: showingHarvestCelebration
		? { ...presentation, objective: "Harvesting Clover…" }
		: showingAdventureVignette
		? {
			...presentation,
			objective: adventureStory(state).journeyObjective,
		}
		: showingJourneyWatch
		? {
			...presentation,
			objective: journeyHudObjective({
				showingJourneyWatch,
				journeyPhase,
				adventureComplete: state.adventureComplete,
				defaultObjective: presentation.objective,
			}),
		}
		: waiting
		? {
			...presentation,
			label: departing
				? "Rosie is heading beyond the hedge…"
				: state.stage === STAGES.CLOVER_GROWING
					? "Clover is growing…"
					: "Rosie is exploring…",
		}
		: presentation;

	useEffect(() => {
		if (!showingAdventureVignette) {
			setAdventureCauseBeat("provision");
			return undefined;
		}
		if (state.reduceMotion) {
			setAdventureCauseBeat("resolved");
			return undefined;
		}

		setAdventureCauseBeat("provision");
		const timers = [
			window.setTimeout(() => setAdventureCauseBeat("tool"), ADVENTURE_CAUSE_BEAT_MS),
			window.setTimeout(() => setAdventureCauseBeat("pack"), ADVENTURE_CAUSE_BEAT_MS * 2),
			window.setTimeout(() => setAdventureCauseBeat("resolved"), ADVENTURE_CAUSE_BEAT_MS * 3),
		];
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, [showingAdventureVignette, state.reduceMotion]);

	useEffect(() => {
		if (!showingAdventureVignette || adventureCauseBeat !== "resolved") return undefined;
		const timer = window.setTimeout(
			() => dispatch({ type: ACTIONS.CONTINUE_ADVENTURE_STORY }),
			state.reduceMotion ? REDUCED_ADVENTURE_HANDOFF_MS : ADVENTURE_HANDOFF_MS,
		);
		return () => window.clearTimeout(timer);
	}, [adventureCauseBeat, showingAdventureVignette, state.reduceMotion]);

	useEffect(() => {
		localStorage.setItem(
			reviewMode ? HOMEGROWN_REVIEW_STORAGE_KEY : HOMEGROWN_STORAGE_KEY,
			serializeState(state),
		);
		document.documentElement.dataset.reduceMotion = String(state.reduceMotion);
	}, [reviewMode, state]);

	useEffect(() => {
		const url = new URL(window.location.href);
		if (url.searchParams.get("position") === String(position)) return;
		url.searchParams.set("position", String(position));
		window.history.replaceState({}, "", url);
	}, [position]);

	useEffect(() => {
		const now = Date.now();
		setVisualNow(now);
		if (
			state.stage !== STAGES.CLOVER_GROWING ||
			state.plantedAt === null ||
			state.readyAt === null ||
			state.readyAt <= state.plantedAt
		) {
			return undefined;
		}

		const lushAt =
			state.plantedAt +
			(state.readyAt - state.plantedAt) * CLOVER_LUSH_THRESHOLD;
		const timers = [];
		if (lushAt > now) {
			timers.push(window.setTimeout(() => setVisualNow(Date.now()), lushAt - now + 16));
		}
		if (state.readyAt > now) {
			timers.push(window.setTimeout(
				() => dispatch({ type: ACTIONS.SETTLE, now: Date.now() }),
				state.readyAt - now + 16,
			));
		}

		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, [state.plantedAt, state.readyAt, state.stage]);

	useEffect(() => {
		if (!showingHarvestCelebration) return undefined;
		const delay = Math.max(0, harvestCelebrationEndsAt - Date.now());
		const timer = window.setTimeout(() => setVisualNow(Date.now()), delay + 16);
		return () => window.clearTimeout(timer);
	}, [harvestCelebrationEndsAt, showingHarvestCelebration]);

	useEffect(() => {
		if (!departing || state.departureReadyAt === null) return undefined;
		const delay = Math.max(0, state.departureReadyAt - Date.now());
		const timer = window.setTimeout(
			() => dispatch({ type: ACTIONS.SETTLE, now: Date.now() }),
			delay,
		);
		return () => window.clearTimeout(timer);
	}, [departing, state.departureReadyAt]);

	useEffect(() => {
		if (!showingJourneyWatch) return undefined;
		const now = Date.now();
		setVisualNow(now);
		const homewardAt = adventureHomewardAt(state);
		const timers = [];
		if (!state.adventureComplete && homewardAt !== null && homewardAt > now) {
			timers.push(window.setTimeout(
				() => setVisualNow(Date.now()),
				homewardAt - now + 16,
			));
		}
		if (!state.adventureComplete && state.adventureReadyAt !== null) {
			if (state.adventureReadyAt <= now) {
				dispatch({ type: ACTIONS.SETTLE, now });
			} else {
				timers.push(window.setTimeout(
					() => dispatch({ type: ACTIONS.SETTLE, now: Date.now() }),
					state.adventureReadyAt - now + 16,
				));
			}
		}
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, [showingJourneyWatch, state.adventureComplete, state.adventureReadyAt, state.adventureStartedAt]);

	useEffect(() => {
		if (!waiting) return undefined;
		if (departing) return undefined;
		const delay = state.reduceMotion ? 120 : 1900;
		const timer = window.setTimeout(() => dispatch({ type: ACTIONS.ADVANCE_TIME }), delay);
		return () => window.clearTimeout(timer);
	}, [departing, state.reduceMotion, state.stage, waiting]);

	useEffect(() => {
		const onVisibility = () => {
			if (!document.hidden) dispatch({ type: ACTIONS.SETTLE, now: Date.now() });
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, []);

	useEffect(() => () => {
		window.clearTimeout(newDayTimer.current);
		window.clearTimeout(glowrootHomeRevealTimer.current);
		seedHandoffTimers.current.forEach((timer) => window.clearTimeout(timer));
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

	const act = useCallback((nextAction) => {
		setHomeMemoryExpanded(false);
		const now = performance.now();
		const guardsTransition =
			RAPID_TRANSITION_ACTIONS.has(nextAction.type) ||
			(nextAction.type === ACTIONS.HARVEST_BEAT && nextAction.finalBeat);
		if (guardsTransition) {
			if (now < transitionLockUntil.current) return;
			transitionLockUntil.current = now + RAPID_TRANSITION_GUARD_MS;
		}
		if (nextAction.type === ACTIONS.START_NEW_DAY) {
			if (startingNewDay) return;
			setStartingNewDay(true);
			dispatch(nextAction);
			signalFeedback(nextAction.type);
			window.clearTimeout(newDayTimer.current);
			newDayTimer.current = window.setTimeout(
				() => setStartingNewDay(false),
				state.reduceMotion ? REDUCED_NEW_DAY_HANDOFF_MS : NEW_DAY_HANDOFF_MS,
			);
			return;
		}
		if (nextAction.type === ACTIONS.PLANT_GLOWROOT && !state.reduceMotion) {
			setGlowrootHomeReveal(true);
			window.clearTimeout(glowrootHomeRevealTimer.current);
			glowrootHomeRevealTimer.current = window.setTimeout(
				() => setGlowrootHomeReveal(false),
				GLOWROOT_HOME_REVEAL_MS,
			);
		}
		dispatch(nextAction);
		signalFeedback(nextAction.type);
	}, [signalFeedback, startingNewDay, state.reduceMotion]);

	const jumpToPosition = useCallback((nextPosition) => {
		if (seedHandoff || holdingGlowrootHomeReveal) return;
		setHomeMemoryExpanded(false);
		const now = performance.now();
		if (now < transitionLockUntil.current) return;
		transitionLockUntil.current = now + RAPID_TRANSITION_GUARD_MS;
		dispatch({ type: ACTIONS.JUMP_TO_POSITION, position: nextPosition });
	}, [holdingGlowrootHomeReveal, seedHandoff]);

	const selectBagItem = useCallback((slot, item) => {
		dispatch({ type: ACTIONS.SET_BAG_SLOT, slot, item });
	}, []);

	const acknowledgeReturn = useCallback(() => {
		const needsSeedHandoff =
			state.stage === STAGES.GLOWROOT_RETURNED &&
			!state.glowrootPlanted &&
			visiblePresentation.action.type === ACTIONS.ACKNOWLEDGE_RETURN;
		if (!needsSeedHandoff || state.reduceMotion || seedHandoff) {
			act(visiblePresentation.action);
			return;
		}

		seedHandoffTimers.current.forEach((timer) => window.clearTimeout(timer));
		setSeedHandoff("departing");
		const departTimer = window.setTimeout(() => {
			act(visiblePresentation.action);
			setSeedHandoff("arriving");
			const arriveTimer = window.setTimeout(() => setSeedHandoff(null), SEED_HANDOFF_ARRIVE_MS);
			seedHandoffTimers.current.push(arriveTimer);
		}, SEED_HANDOFF_DEPART_MS);
		seedHandoffTimers.current = [departTimer];
	}, [act, seedHandoff, state.glowrootPlanted, state.reduceMotion, state.stage, visiblePresentation.action]);

	return <main className={`lab ${debug ? "lab-debug" : "lab-player"} variant-${variant}`}>
		{debug && <header className="lab-context">
			<p><strong>Homegrown Adventures</strong><span>{VARIANTS[variant].question}</span></p>
			<span className="prototype-badge">Prototype · browser lab</span>
		</header>}
		<div
			className={`phone scene-${image} stage-${state.stage} ${state.compostApplied ? "composted-crop" : ""} ${departing ? "departure-in-progress" : ""} ${showingAdventureVignette ? "adventure-vignette-open" : ""} ${showingJourneyWatch ? "journey-watch-open" : ""} ${gateHomecomingReady ? "gate-homecoming-ready" : ""} ${showingReturnReward ? "return-homecoming-open" : ""} ${showingGlowrootPlanting ? "glowroot-planting-open" : ""} ${showingMoonberryPlanting && !holdingGlowrootHomeReveal ? "moonberry-planting-open" : ""} ${showingHomeTickle ? "home-tickle-open" : ""} ${startingNewDay ? "new-day-in-progress" : ""} ${seedHandoff ? "seed-handoff-active" : ""} ${holdingGlowrootHomeReveal ? "glowroot-home-reveal" : ""} ${homeMemoryEarned ? "home-memory-earned" : ""} rosie-action-${riveModel.viewModel.rosieAction} feedback-${feedback % 2} ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "rive-authored" : "rive-probe"}`}
			aria-busy={startingNewDay || Boolean(seedHandoff) || holdingGlowrootHomeReveal}
			data-adventure-kind={showingAdventureVignette ? adventureStory(state).kind : undefined}
			data-adventure-opportunity={opportunity.id}
			data-adventure-provision={showingAdventureVignette ? state.bag?.provision ?? "none" : undefined}
			data-adventure-tool={showingAdventureVignette ? state.bag?.tool ?? "none" : undefined}
			data-adventure-pack={showingAdventureVignette ? state.bag?.pack ?? "none" : undefined}
			data-adventure-beat={showingAdventureVignette ? adventureCauseBeat : undefined}
			data-return-kind={showingReturnReward ? returnKind : undefined}
			data-return-tool={showingReturnReward ? state.bag?.tool ?? "none" : undefined}
			data-return-pack={showingReturnReward ? state.bag?.pack ?? "none" : undefined}
		>
			<div className="scene-plate" role="img" aria-label={sceneLabel(state, {
				gateHomecomingReady,
				journeyPhase,
				plantingGlowroot: showingGlowrootPlanting,
			})} />
			{showingAdventureVignette && opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id && (
				<LanternleafReflectionsRive active={adventureEnvironmentRevealed} reduceMotion={state.reduceMotion} />
			)}
			<HomegrownRiveScene
				key="homegrown-rive-scene"
				reduceMotion={state.reduceMotion}
				model={sceneRiveViewModel}
				playInitialTrigger={gateHomecomingReady}
				showPondResident={homeMemoryEarned && sceneRiveViewModel.frogVisible}
				showHomePose={showingHomeMemory}
				trigger={sceneRiveTrigger}
				triggerNonce={sceneRiveTriggerNonce}
				bagReceiveSlot={riveModel.bagReceive?.slot ?? null}
			/>
			{showingAdventureVignette && <div className="adventure-vignette-backdrop" aria-hidden="true" />}
			{showingAdventureVignette && <div className="adventure-provision-prop" aria-hidden="true" />}
			{showingAdventureVignette && <div className="adventure-tool-prop" aria-hidden="true" />}
			{showingAdventureVignette && <div className="adventure-pack-prop" aria-hidden="true" />}
			{showingAdventureVignette && <div className="adventure-find-handoff" aria-hidden="true"><i /><i /></div>}
			{showingReturnReward && <div className="return-homecoming-backdrop" aria-hidden="true" />}
			{showingReturnReward && <div className="return-tool-prop" aria-hidden="true" />}
			{showingReturnReward && <div className="return-pack-prop" aria-hidden="true" />}
			{showingAdventureVignette && <div className="adventure-bed-mask" aria-hidden="true" />}
			{showingReturnReward && <div className="return-table-mask" aria-hidden="true" />}
			{showingAdventureVignette &&
			adventureStory(state).kind === "discovery" &&
			opportunity.id === FIRST_ADVENTURE_OPPORTUNITY.id && (
				<AdventureGlowrootRive active={adventureEnvironmentRevealed} reduceMotion={state.reduceMotion} />
			)}
			<div className="quiet-hud">
				<HeartChip value={state.ticklesEarned} />
				<div className={`current-objective ${visiblePresentation.detail ? "has-detail" : ""}`} id="current-objective" role="status" aria-live="polite">
					<span className="objective-dot" aria-hidden="true" />
					<span className="objective-copy">
						<strong>{visiblePresentation.objective}</strong>
						{visiblePresentation.detail && <small>{visiblePresentation.detail}</small>}
					</span>
				</div>
			</div>
			{state.stage !== STAGES.ADVENTURE && !showingReturnReward && !showingGlowrootPlanting && (!showingHomeMemory || showingHomeTickle) && !homeMemoryExpanded && !showingFarmingPanel && !choosingBag && !showPackedLoadout && <button
				className={`rosie-hit ${visiblePresentation.target === WORLD_TARGETS.ROSIE ? "is-guided" : ""}`}
				type="button"
				aria-label={visiblePresentation.target === WORLD_TARGETS.ROSIE ? visiblePresentation.label : "Tickle Rosie"}
				onClick={() => act(visiblePresentation.target === WORLD_TARGETS.ROSIE ? visiblePresentation.action : { type: ACTIONS.TICKLE })}
			>
				{visiblePresentation.target === WORLD_TARGETS.ROSIE && <span>{visiblePresentation.label}</span>}
			</button>}
			{showPackedLoadout && <PackedLoadoutRibbon bag={state.bag} farmStock={state.farmStock} />}
			{choosingSeed && <SeedChoicePanel
				state={state}
				opportunity={opportunity}
				onChoose={() => act(visiblePresentation.action)}
			/>}
			{plantingCrop && <PlantingPanel
				state={state}
				onToggleCompost={() => act({ type: ACTIONS.TOGGLE_COMPOST })}
				onPlant={() => act(visiblePresentation.action)}
			/>}
			{showingGrowth && <GrowthStatusPanel
				state={state}
				onPreview={() => act(visiblePresentation.action)}
			/>}
			{showingHarvestRhythm && <HarvestRhythmPanel
				state={state}
				onBeat={(direction, input) => act({
					type: ACTIONS.HARVEST_BEAT,
					direction,
					input,
					finalBeat: (state.harvestBeats?.length ?? 0) === HARVEST_PATTERN.length - 1,
				})}
				onGatherNormally={() => act(visiblePresentation.action)}
			/>}
			{showingHarvestResult && <HarvestResultPanel
				state={state}
				actionLabel={visiblePresentation.label}
				onContinue={() => act(visiblePresentation.action)}
			/>}
			{showingAdventureVignette && <AdventureVignetteOverlay
				state={state}
				beat={adventureCauseBeat}
			/>}
			{showingJourneyWatch && <JourneyWatchPanel
				state={state}
				journeyPhase={journeyPhase}
				now={visualNow}
				actionLabel={visiblePresentation.label}
				onAction={() => act(visiblePresentation.action)}
			/>}
			{showingReturnReward && <ReturnRewardPanel
				state={state}
				actionLabel={visiblePresentation.label}
				handoffActive={Boolean(seedHandoff)}
				onAction={acknowledgeReturn}
			/>}
			<SeedHandoff origin={state.bag?.tool === "hand-trowel" ? "bonus" : "base"} phase={seedHandoff} />
			{showingHomeMemory && !holdingGlowrootHomeReveal && <HomeMemoryPanel
				state={state}
				actionLabel={visiblePresentation.label}
				onAction={() => act(visiblePresentation.action)}
				expanded={homeMemoryExpanded}
				onToggle={() => setHomeMemoryExpanded((value) => !value)}
				showAction={!showingMoonberryPlanting && !showingHomeTickle}
			/>}
			{showingMoonberryPlanting && !holdingGlowrootHomeReveal && !homeMemoryExpanded && <WorldAction
				key={`${visiblePresentation.target}-${visiblePresentation.action.type}-${visiblePresentation.label}`}
				presentation={visiblePresentation}
				onAction={() => act(visiblePresentation.action)}
				waiting={waiting}
			/>}
			{startingNewDay && <NewDayHandoff />}
			{choosingBag && bagChoiceStudy && <BagChoiceStudyPanel
				key={bagChoiceVariant}
				variant={bagChoiceVariant}
				farmStock={state.farmStock}
				opportunity={opportunity}
			/>}
			{choosingBag && !bagChoiceStudy && <BagSelectionPanel
				bag={state.bag}
				farmStock={state.farmStock}
				opportunity={opportunity}
				activeSelection={riveModel.bagReceive}
				onSelect={selectBagItem}
				onConfirm={() => act(visiblePresentation.action)}
			/>}
			{!showingFarmingPanel && !choosingBag && !showingAdventureVignette && !showingJourneyWatch && !showingReturnReward && !showingHomeMemory && <WorldAction
				key={`${visiblePresentation.target}-${visiblePresentation.action.type}-${visiblePresentation.label}`}
				presentation={visiblePresentation}
				onAction={() => act(visiblePresentation.action)}
				waiting={waiting || seedHandoff === "arriving"}
			/>}
		</div>
		{showingJourneyWatch && !state.adventureComplete && <JourneyReviewRailAction
			actionLabel={presentation.label}
			onAction={() => act(presentation.action)}
		/>}
		<PositionRail position={position} onChange={jumpToPosition} positionName={currentPositionName} />
		{bagChoiceStudy && <BagChoiceStudySwitcher variant={bagChoiceVariant} setVariant={setBagChoiceVariant} />}
		{debug && <DevTools state={state} dispatch={dispatch} variant={variant} />}
		{debug && <VariantSwitcher variant={variant} setVariant={setVariant} />}
	</main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<App />);
