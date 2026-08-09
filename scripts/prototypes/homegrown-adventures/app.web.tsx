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
	canChooseKnownAdventureRoute,
	cropHarvestPattern,
	CROP_RULES,
	createInitialState,
	createPrototypeState,
	deserializeState,
	FIRST_ADVENTURE_OPPORTUNITY,
	HOMEGROWN_STORAGE_KEY,
	homegrownReducer,
	nearDiscoveryGuide,
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
	A: { name: "New Route Again", question: "Does the existing Lanternleaf memory still read truthfully after a repeat outing?" },
	B: { name: "Familiar Homecoming", question: "Should the existing storybook memory celebrate Rosie returning from a familiar trail?" },
	C: { name: "Place + Supplies", question: "Should the completed Home separate the permanent route from today's stocked supplies?" },
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
		title: "Rosie discovered Glowroot",
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
	const revisitingKnownRoute = Boolean(state.selectedAdventureOpportunityId);
	const crop = CROP_RULES[state.selectedCrop] ?? CROP_RULES.clover;
	if (
		state.stage === STAGES.DEVELOPED &&
		state.cycleComplete &&
		state.fieldGuide.includes(SECOND_ADVENTURE_OPPORTUNITY.discoveryName)
	) {
		return {
			eyebrow: "Home remembers",
			title: "Lanternleaf Path joined Rosie's map",
			body: "The reflected route now guides Rosie Home while every earlier Glowroot change remains in the Farm.",
		};
	}
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
				body: "A Carrier could bring the trail's useful supplies Home next time.",
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
				body: "A Carrier could bring the delicate Glowroot Seed safely Home next time.",
			},
		})[state.nearDiscoveryReason];
		if (copy) return { eyebrow: "Near-Discovery · never failure", ...copy };
	}
	if (state.stage === STAGES.STARTING && state.hasTickled && !state.purpose) {
		if (canChooseKnownAdventureRoute(state) && !state.selectedAdventureOpportunityId) {
			return {
				eyebrow: "Rosie’s map",
				title: "Two familiar trails are waiting",
				body: "Choose where Rosie explores today. Both routes are safe, and preparation changes what she notices and carries Home.",
			};
		}
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
			title: `${state.selectedCrop === "moonberries" ? "Tend" : "Grow"} ${crop.outputName} for ${opportunity.name}`,
			body: lanternleaf && state.selectedCrop === "moonberries"
				? "This harvest has a job: reveal the silver leaves that mark the hidden night path."
				: lanternleaf
				? "This harvest has a job: help Rosie stay past the open gate until nightfall."
				: "This harvest has a job: help Rosie stay beyond the hedge until the moths appear.",
		};
	}
	if (state.stage === STAGES.CLOVER_GROWING) {
		return {
			eyebrow: "Growing kindly",
			title: `${crop.outputName} ${state.selectedCrop === "moonberries" ? "are deepening" : "is taking root"}`,
			body: "It will wait safely when ready. Nothing is harmed while you are away.",
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		const cropPossessive = `${crop.name}${crop.name.endsWith("s") ? "’" : "'s"}`;
		return {
			eyebrow: "Ready to harvest",
			title: `${crop.outputName} ${state.selectedCrop === "moonberries" ? "are" : "is"} ready`,
			body: `Tickle Rosie to begin ${cropPossessive} personal harvest rhythm. The crop will keep waiting safely.`,
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return {
			eyebrow: "The patch rustles",
			title: `${crop.outputName} ${state.selectedCrop === "moonberries" ? "are" : "is"} ready`,
			body: `Follow ${crop.name}'s personal swipe rhythm. The complete harvest is always guaranteed.`,
		};
	}
	if (state.stage === STAGES.CLOVER_READY && state.cloverHarvested) {
		const choosingBag = state.prototypePosition >= 7;
		return {
			eyebrow: choosingBag ? "The Bag starts empty" : "Harvest tucked away",
			title: choosingBag ? "Rosie's Bag is ready to pack" : `${crop.outputName} joined Farm stock`,
			body: choosingBag
				? `Choose what helps with ${opportunity.name}, or leave every slot empty for a useful clue.`
				: state.selectedCrop === "moonberries"
					? `The harvest is stocked and Moonberry roots stay in Bed 2, ready to grow again. Open Rosie's Bag when you are ready to prepare for ${opportunity.name}.`
					: `The first bed is resting. Open Rosie's Bag when you are ready to prepare for ${opportunity.name}.`,
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
		if (revisitingKnownRoute) {
			return {
				eyebrow: "A familiar route",
				title: lanternleaf
					? "Rosie followed Lanternleaf Path again"
					: "Rosie revisited the hedge glow",
				body: "The route was already mapped. This outing deepened Rosie’s knowledge and brought useful supplies back to Farm stock.",
			};
		}
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
			body: "Without a complete Bag she will return with a specific clue, not a failed mission or an empty reward.",
		};
	}
	if (state.stage === STAGES.PACKED && lanternleaf) {
		const provisionName = bagItem("provision", state.bag?.provision)?.name ?? "No Provision";
		return {
			eyebrow: "Rosie’s Bag",
			title: `${opportunity.name} is packed`,
			body: `${provisionName} · a chosen Tool · a chosen Carrier. Each capability changes what Rosie can notice and carry Home.`,
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
	pack: "Carrier",
};


function SeedAdventureReceipt({ opportunity, className = "", twoCrops = false }) {
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const promise = twoCrops
		? "Both harvests help Rosie explore"
		: "Clover becomes a Provision";
	const detail = twoCrops
		? lanternleaf
			? "Clover: stay until nightfall · Moonberries: reveal reflected leaves"
			: "Clover: stay until dusk · Moonberries: notice hidden reflections"
		: opportunity.detail;
	return (
		<div
			className={`seed-adventure-receipt ${className}`}
			role="note"
			aria-label={`For ${opportunity.name}: ${promise}. ${detail}.`}
		>
			<span><small>{twoCrops ? "Known route" : "Grow for Rosie"}</small><strong>{promise}</strong></span>
			<em>{detail}</em>
		</div>
	);
}

function SeedChoicePanel({ state, opportunity, onChoose }) {
	const farmStock = state.farmStock ?? {};
	const cloverSeeds = farmStock[CROP_RULES.clover.seedId] ?? 0;
	const compost = farmStock.compost ?? 0;
	const rememberedMorning = state.daysCompleted > 0 && state.glowrootPlanted;
	const moonberriesAvailable = state.nextPlanting === "moonberries";

	if (rememberedMorning) {
		const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
		return (
			<section className="seed-choice-panel crop-choice-study" aria-label="Choose one useful crop for Rosie's next Adventure">
				<div className="crop-choice-question"><strong>{lanternleaf ? "What should Rosie grow for the lights?" : "What should Rosie grow for the hedge glow?"}</strong><small>Both harvests wait safely and fit her Provision pocket.</small></div>
				<div className="crop-choice-options">
					<button className="crop-path crop-path-clover" type="button" onClick={() => onChoose("clover")} disabled={cloverSeeds < 1}>
						<span className="seed-art seed-art-clover" aria-hidden="true">☘</span>
						<span><small>Clover · 4 hours</small><strong>Clover Lunch</strong><b>3 guaranteed · {lanternleaf ? "stay until nightfall" : "stay until dusk"}</b></span>
						<em>{cloverSeeds > 0 ? "Grow Clover" : "Need a Seed"}</em>
					</button>
					<button className="crop-path crop-path-moonberry" type="button" onClick={() => onChoose("moonberries")} disabled={!moonberriesAvailable}>
						<span className="seed-art seed-art-moonberry" aria-hidden="true">●</span>
						<span><small>Moonberries · 8 hours</small><strong>Moonberries</strong><b>4 guaranteed · {lanternleaf ? "reveal reflected leaves" : "notice hidden reflections"}</b></span>
						<em>{moonberriesAvailable ? "Tend Moonberries" : "Still taking root"}</em>
					</button>
				</div>
				<SeedAdventureReceipt opportunity={opportunity} className="seed-adventure-memory-receipt" twoCrops />
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
					onClick={() => onChoose("clover")}
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

function PurposeHandoff({ opportunity, choosingRoute = false }) {
	return (
		<div className="purpose-handoff" role="status" aria-live="polite">
			<small>{choosingRoute ? "Rosie’s map" : "Rosie's curiosity"}</small>
			<strong>{choosingRoute ? "Two familiar trails are waiting" : opportunity.name}</strong>
			<span>{choosingRoute ? "Choose where she explores today" : opportunity.detail}</span>
		</div>
	);
}

function KnownRouteMap({ onChoose }) {
	return (
		<section className="known-route-map" aria-label="Choose one of Rosie's known Adventure routes">
			<header><span aria-hidden="true">⌁</span><div><small>Rosie's map · 2 known routes</small><strong>Where should Rosie explore today?</strong></div></header>
			<div className="known-route-map-list">
				<button type="button" className="known-route-map-row route-glowroot" onClick={() => onChoose(FIRST_ADVENTURE_OPPORTUNITY.id)}>
					<i aria-hidden="true">✦</i><span><small>Known clearing · dusk</small><strong>A Glow Beneath the Hedge</strong><b>Soft soil · careful carrying</b></span><em>Choose</em>
				</button>
				<button type="button" className="known-route-map-row route-lanternleaf" onClick={() => onChoose(SECOND_ADVENTURE_OPPORTUNITY.id)}>
					<i aria-hidden="true">◇</i><span><small>Mapped path · nightfall</small><strong>Lights Past the Open Gate</strong><b>Reflected leaves · gentle wrap</b></span><em>Choose</em>
				</button>
			</div>
			<footer>Both routes are safe. Preparation changes what Rosie notices and carries Home.</footer>
		</section>
	);
}

function PlantingPanel({ state, onToggleCompost, onPlant }) {
	const rule = CROP_RULES[state.selectedCrop] ?? CROP_RULES.clover;
	const isMoonberries = state.selectedCrop === "moonberries";
	const seeds = rule.seedId === null ? null : state.farmStock?.[rule.seedId] ?? 0;
	const compost = state.farmStock?.compost ?? 0;
	const boosted = state.compostApplied && compost > 0;
	const promisedYield = rule.baseYield + (boosted ? rule.compostYieldBonus : 0);
	const normalHours = rule.baseDurationMs / (60 * 60 * 1000);
	const boostedHours = rule.compostDurationMs / (60 * 60 * 1000);
	return (
		<section className="planting-panel" aria-label={`${isMoonberries ? "Tend Moonberries" : "Plant Clover"} and choose whether to add Compost`}>
			<div className="planting-costs">
				<div className="planting-cost is-required">
					<span className={`seed-art ${isMoonberries ? "seed-art-moonberry" : "seed-art-clover"}`} aria-hidden="true">{isMoonberries ? "●" : "☘"}</span>
					<span><small>{isMoonberries ? "Rooted in Bed 2" : "Required Seed"}</small><strong>{rule.name}</strong><b>{isMoonberries ? "No Seed spent" : `${seeds} → ${Math.max(0, seeds - 1)}`}</b></span>
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
				<strong>{promisedYield} {rule.outputName} · ready in {boosted ? boostedHours : normalHours} hours</strong>
				<small>{boosted ? `Compost saves ${normalHours - boostedHours} hours and adds 1.` : `Add Compost: 1 more, ${normalHours - boostedHours} hours sooner.`}</small>
			</div>
			<button type="button" className="plant-confirm" onClick={onPlant} disabled={!isMoonberries && seeds < 1}>
				{boosted ? `${isMoonberries ? "Tend" : "Plant"} with Compost` : `${isMoonberries ? "Tend" : "Plant"} ${rule.name}`}
			</button>
		</section>
	);
}

function GrowthStatusPanel({ state, onPreview }) {
	const rule = CROP_RULES[state.selectedCrop] ?? CROP_RULES.clover;
	const hours = (state.compostApplied ? rule.compostDurationMs : rule.baseDurationMs) / (60 * 60 * 1000);
	return (
		<section className={`growth-status-panel ${state.compostApplied ? "is-composted" : ""}`} aria-label={`${rule.name} growth status`}>
			<span className="growth-badge"><i aria-hidden="true">{state.compostApplied ? "✓" : state.selectedCrop === "moonberries" ? "●" : "☘"}</i>{state.compostApplied ? "Composted" : "Growing normally"}</span>
			<strong>Ready in {hours} hours</strong>
			<small>Once ready, this crop waits safely until you harvest it.</small>
			<button type="button" onClick={onPreview}>Preview it ready</button>
		</section>
	);
}

const HARVEST_DIRECTION_LABELS = {
	left: { arrow: "←", name: "Left" },
	right: { arrow: "→", name: "Right" },
	up: { arrow: "↑", name: "Up" },
	down: { arrow: "↓", name: "Down" },
};

function HarvestRhythmPanel({ state, onBeat, onGatherNormally }) {
	const rule = CROP_RULES[state.selectedCrop] ?? CROP_RULES.clover;
	const rhythmName = state.selectedCrop === "moonberries" ? "Moonberry" : rule.name;
	const harvestPattern = cropHarvestPattern(state);
	const gestureStart = useRef(null);
	const beatIndex = state.harvestBeats?.length ?? 0;
	const nextDirection = harvestPattern[beatIndex] ?? null;
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
			: dy < 0 ? "up" : "down";
		if (direction) onBeat(direction, "swipe");
	};

	const pattern = (
		<div className="harvest-pattern" aria-label={harvestPattern.map((direction) => HARVEST_DIRECTION_LABELS[direction].name).join(", then ")}>
			{harvestPattern.map((direction, index) => (
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
		rule.baseYield +
		(state.compostApplied ? rule.compostYieldBonus : 0);

	return (
		<div className="harvest-experiment">
			<div
				className="harvest-gesture-zone"
				onPointerDown={startGesture}
				onPointerUp={finishGesture}
				onPointerCancel={() => { gestureStart.current = null; }}
				role="group"
				aria-label={`Swipe ${rhythmName}: ${harvestPattern.map((direction) => HARVEST_DIRECTION_LABELS[direction].name).join(", then ")}`}
			>
				<span aria-hidden="true">{nextLabel?.arrow}</span>
			</div>
			<section className="harvest-bed-ribbon is-unified" aria-label={`Follow the ${rhythmName} harvest rhythm`}>
				<strong aria-live="polite">{nextLabel ? `Swipe ${nextLabel.name}` : "Harvest complete"}</strong>
				{pattern}
				<small>Swipe bed · or tap arrow</small>
			</section>
			<div className="harvest-bed-assist is-unified">
				<span><i aria-hidden="true">✓</i> {guaranteedYield} {rule.outputName} guaranteed · clean rhythm +1</span>
				<button type="button" className="harvest-normal" onClick={onGatherNormally}>Gather normally</button>
			</div>
		</div>
	);
}

function HarvestStockIcon({ kind }) {
	if (kind === "clover") return <span className="stock-clover-art" aria-hidden="true"><i /><i /><i /><i /></span>;
	if (kind === "moonberries") return <span className="stock-moonberry-art" aria-hidden="true"><i /><i /><i /><i /></span>;
	if (kind === "seed") return <span className="stock-seed-art" aria-hidden="true"><i /></span>;
	if (kind === "compost") return <span className="stock-compost-art" aria-hidden="true"><i /><i /><i /></span>;
	return <span className="stock-material-art" aria-hidden="true"><i /><i /><i /></span>;
}

function HarvestResultPanel({ state, actionLabel, onContinue }) {
	const rule = CROP_RULES[state.selectedCrop] ?? CROP_RULES.clover;
	const isMoonberries = state.selectedCrop === "moonberries";
	const compostBonus = state.compostApplied ? rule.compostYieldBonus : 0;
	const rhythmBonus = state.harvestRhythmBonus ? 1 : 0;
	const stockItems = [
		{ id: rule.outputId, name: rule.outputName, value: state.farmStock?.[rule.outputId] ?? 0, kind: isMoonberries ? "moonberries" : "clover" },
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
	const harvestBasket = <div className={`harvest-basket ${isMoonberries ? "is-moonberries" : ""}`} role="status" aria-label={`${rule.outputName} plus ${state.lastHarvestYield}`}>
		<span className="harvest-basket-image" aria-hidden="true" />
		<div className="harvest-basket-label">
			<strong>{rule.outputName} +{state.lastHarvestYield}</strong>
			<small>{rule.baseYield} harvest{compostBonus ? ` · +${compostBonus} from Compost` : ""}{rhythmBonus ? " · +1 rhythm" : ""}</small>
			{isMoonberries && <span className="harvest-basket-regrowth">Roots stay in Bed 2</span>}
		</div>
	</div>;
	const continueButton = <button type="button" className="harvest-prepare" onClick={onContinue}>{actionLabel}</button>;
	return (
		<section className="harvest-result-world harvest-result-shelf" aria-label={`${rule.outputName} harvest added to Farm stock`}>
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
		moonberries: "Reveal warm reflections",
		"hand-trowel": "Dig through soft soil",
		lantern: "Follow a glow after dark",
		"wicker-basket": "Carry a find Home",
		"cloth-wrap": "Protect a delicate find",
	}),
	"lights-past-open-gate": Object.freeze({
		"clover-lunch": "Stay until nightfall",
		moonberries: "Reveal reflected leaves",
		"hand-trowel": "Search beneath the path",
		lantern: "Follow reflected leaves",
		"wicker-basket": "Carry sturdy supplies Home",
		"cloth-wrap": "Protect delicate leaves",
	}),
});

function BagSelectionOption({ slot, item, selected, disabled, detail, onSelect }) {
	return (
		<button
			type="button"
			className={`bag-guided-option ${selected ? "is-selected" : ""} ${item ? "" : "is-empty"}`}
			disabled={disabled}
			aria-pressed={selected}
			onClick={() => onSelect(slot, item?.id ?? null)}
		>
			<span aria-hidden="true"><BagItemArt itemId={item?.id} /></span>
			<strong>{item?.name ?? "Leave empty"}</strong>
			<small>{detail}</small>
		</button>
	);
}

function BagSelectionPanel({ bag, farmStock, opportunity, activeSelection, initialFocus = "provision", clueGuide = null, clueSlot = null, onSelect, onConfirm }) {
	const [focus, setFocus] = useState(initialFocus);
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
	const selectedCount = BAG_SLOT_ORDER.filter((slot) => bag[slot] !== null).length;
	const focusIndex = BAG_SLOT_ORDER.indexOf(focus);
	const question = {
		provision: "What should help Rosie keep going?",
		tool: "What should Rosie try?",
		pack: "What should hold Rosie's find?",
	}[focus];
	const showingClue = clueGuide !== null && clueSlot !== null;
	const clueIsApplied = showingClue && bag[clueSlot] !== null;
	const optionDetail = (slot, item) => {
		if (!item) return slot === "pack"
			? "Rosie remembers it, but cannot carry it Home"
			: "A kind clue still comes Home";
		const effect = BAG_ITEM_EFFECT_LABELS[opportunity.id]?.[item.id] ?? item.effect;
		if (slot === "provision") {
			const owned = farmStock?.[item.id] ?? 0;
			return owned > 0 ? `${owned} owned · ${effect}` : "Grow more before packing";
		}
		const cost = slot === "pack" ? bagPackingCost(item.id) : null;
		if (!cost) return effect;
		const owned = farmStock?.[cost.itemId] ?? 0;
		return owned >= cost.amount ? `${cost.amount} ${cost.name} · ${effect}` : `Needs ${cost.amount} ${cost.name}`;
	};
	const focusChoices = [
		...BAG_ITEMS[focus].map((item) => {
			const packingCost = focus === "pack" ? bagPackingCost(item.id) : null;
			const unavailable = focus === "provision"
				? (farmStock?.[item.id] ?? 0) < 1
				: packingCost !== null && (farmStock?.[packingCost.itemId] ?? 0) < packingCost.amount;
			return <BagSelectionOption
				key={item.id}
				slot={focus}
				item={item}
				selected={bag[focus] === item.id}
				disabled={unavailable}
				detail={optionDetail(focus, item)}
				onSelect={onSelect}
			/>;
		}),
		<BagSelectionOption
			key={`${focus}-empty`}
			slot={focus}
			item={null}
			selected={bag[focus] === null}
			disabled={false}
			detail={optionDetail(focus, null)}
			onSelect={onSelect}
		/>,
	];
	const chosenProvision = bagItem("provision", bag.provision);
	const packLabel = !canPack
		? needsProvision ? `Need ${chosenProvision?.name ?? "Provision"}` : "Need Willow Fiber"
		: selectedCount === 0
			? "Set out with an empty Bag"
			: `Pack ${selectedCount} ${selectedCount === 1 ? "choice" : "choices"}`;
	const moveFocus = (event, currentIndex) => {
		const keyDirection = {
			ArrowRight: 1,
			ArrowDown: 1,
			ArrowLeft: -1,
			ArrowUp: -1,
		}[event.key];
		let nextIndex = currentIndex;
		if (keyDirection) nextIndex = (currentIndex + keyDirection + BAG_SLOT_ORDER.length) % BAG_SLOT_ORDER.length;
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = BAG_SLOT_ORDER.length - 1;
		else return;
		event.preventDefault();
		const nextSlot = BAG_SLOT_ORDER[nextIndex];
		setFocus(nextSlot);
		event.currentTarget.parentElement?.querySelector(`[data-bag-tab="${nextSlot}"]`)?.focus();
	};

	return (
		<section className={`bag-selection bag-selection-guided ${showingClue ? "has-bag-clue" : ""}`} aria-label="Choose what Rosie carries">
			{activeSelection && flightItemId && (
				<span
					key={`${activeSelection.slot}-${flightItemId}-${activeSelection.at}`}
					className={`bag-flight-item bag-flight-${activeSelection.slot} ${flightIsRemoval ? "is-removal" : "is-placement"}`}
					aria-hidden="true"
				>
					<BagItemArt itemId={flightItemId} />
				</span>
			)}
			<div className="bag-guided-title">
				<strong>Pack for {opportunity.name}</strong>
				<small>{showingClue
					? clueIsApplied
						? `${bagItem(clueSlot, bag[clueSlot])?.name} answers the ${opportunity.clueName} clue.`
						: clueGuide.next
					: "The Bag begins empty. Every slot is optional."}</small>
			</div>
			<div className="bag-stage bag-guided-stage" aria-hidden="true">
				<span className="open-adventure-bag" />
				<div className="bag-packed-preview">
					{BAG_SLOT_ORDER.map((slot) => {
						const selected = bagItem(slot, bag[slot]);
						return <span className={`bag-preview-${slot} ${selected ? "is-filled" : "is-empty"}`} key={slot}><BagItemArt itemId={selected?.id} /></span>;
					})}
				</div>
			</div>
			<div className="bag-guided-tabs" role="tablist" aria-label="Bag slots">
				{BAG_SLOT_ORDER.map((slot, index) => {
					const selected = bagItem(slot, bag[slot]);
					return <button
						key={slot}
						type="button"
						role="tab"
						id={`bag-tab-${slot}`}
						data-bag-tab={slot}
						aria-controls={`bag-panel-${slot}`}
						aria-selected={focus === slot}
						tabIndex={focus === slot ? 0 : -1}
						onClick={() => setFocus(slot)}
						onKeyDown={(event) => moveFocus(event, index)}
					>
						<small>{BAG_SLOT_LABELS[slot]}</small>
						<strong>{selected?.name ?? "Empty"}</strong>
						{slot === clueSlot && <i>{clueIsApplied ? "Answered" : "Clue"}</i>}
					</button>;
				})}
			</div>
			<div
				className="bag-guided-picker"
				role="tabpanel"
				id={`bag-panel-${focus}`}
				aria-labelledby={`bag-tab-${focus}`}
			>
				<div className="bag-guided-question"><small>{BAG_SLOT_LABELS[focus]}</small><strong>{question}</strong></div>
				<div className="bag-guided-options">{focusChoices}</div>
				<button
					type="button"
					className="bag-guided-next"
					disabled={focusIndex === BAG_SLOT_ORDER.length - 1}
					onClick={() => setFocus(BAG_SLOT_ORDER[Math.min(BAG_SLOT_ORDER.length - 1, focusIndex + 1)])}
				>{focusIndex === BAG_SLOT_ORDER.length - 1 ? "All choices visible" : `Next: ${BAG_SLOT_LABELS[BAG_SLOT_ORDER[focusIndex + 1]]}`}</button>
			</div>
		<button type="button" className="bag-confirm" onClick={onConfirm} disabled={!canPack}>
			{packLabel}
		</button>
		<p>{canPack
			? selectedCount === 0
				? "An empty Bag still returns a useful clue. Rosie is always safe."
				: "Provision and fresh lining are used once. Tool and Carrier come Home."
			: needsProvision
				? "Leave Provision empty to explore with a useful clue."
				: "Choose Wicker Basket, leave Carrier empty, or bring back Willow Fiber."}</p>
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

function adventureProvisionPresentation(state) {
	const story = adventureStory(state);
	const opportunity = adventureOpportunity(state);
	const provision = state.bag?.provision ?? null;
	const detail = story.journeyTags[0].detail;
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;

	if (provision === "clover-lunch") {
		return {
			objective: `Clover Lunch carries Rosie into ${lanternleaf ? "nightfall" : "dusk"}`,
			detail,
		};
	}
	if (provision === "moonberries") {
		return {
			objective: lanternleaf
				? "Moonberries reveal the reflected path"
				: "Moonberries reveal hidden reflections",
			detail,
		};
	}
	return {
		objective: lanternleaf
			? "Daylight turns Rosie Home before the leaves shine"
			: "Daylight turns Rosie Home before the root opens",
		detail,
	};
}

function adventureToolPresentation(state) {
	const story = adventureStory(state);
	const opportunity = adventureOpportunity(state);
	const tool = state.bag?.tool ?? null;
	const detail = story.journeyTags[1].detail;
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;

	if (tool === "hand-trowel") {
		return {
			objective: lanternleaf
				? "Hand Trowel tests the Lanternleaf path"
				: "Hand Trowel parts the soft roots",
			detail,
		};
	}
	if (tool === "lantern") {
		return {
			objective: lanternleaf
				? "Lantern light catches the reflected leaves"
				: "Lantern light follows the fading glow",
			detail,
		};
	}
	return {
		objective: lanternleaf
			? "Rosie leaves the shifting trail undisturbed"
			: "Rosie leaves the warm roots safely sleeping",
		detail,
	};
}

function adventurePackPresentation(state) {
	const story = adventureStory(state);
	const opportunity = adventureOpportunity(state);
	const pack = state.bag?.pack ?? null;
	const detail = story.journeyTags[2].detail;
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const clue = story.kind === "near-discovery";

	if (pack === "wicker-basket") {
		return {
			objective: clue
				? "Wicker Basket keeps the trail clue safe"
				: lanternleaf
					? "Wicker Basket gathers the trail supplies"
					: "Wicker Basket makes the Glowroot find safe",
			detail,
		};
	}
	if (pack === "cloth-wrap") {
		return {
			objective: clue
				? "Cloth Wrap protects the trail clue"
				: lanternleaf
					? "Cloth Wrap protects the Lanternleaf"
					: "Cloth Wrap protects the delicate find",
			detail,
		};
	}
	return {
		objective: lanternleaf
			? "Rosie maps the route for another visit"
			: "Rosie records where the find rests",
		detail,
	};
}

function adventureHandoffPresentation(state) {
	const lanternleaf = adventureOpportunity(state).id === SECOND_ADVENTURE_OPPORTUNITY.id;
	return {
		objective: lanternleaf
			? "Silver leaves lead Rosie onward"
			: "Warm lights lead Rosie onward",
		detail: lanternleaf
			? "Past the open gate"
			: "Beyond the hedge",
	};
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
				<div key={beat} className="adventure-trail-opening" role="status" aria-live="polite">
					<span className="sr-only">Rosie follows the {lanternleaf ? "reflected leaves beyond the gate" : "warm moth lights beyond the hedge"}. The journey continues.</span>
					<i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
				</div>
			) : beat === "provision" ? (
				<div key={beat} className="adventure-dusk-observation" role="status" aria-live="polite">
					<span className="sr-only">{activeTag.name} {activeTag.detail}</span>
					<i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
				</div>
			) : beat === "tool" ? (
				<div
					key={beat}
					className="adventure-tool-observation"
					data-tool-kind={state.bag?.tool ?? "none"}
					role="status"
					aria-live="polite"
				>
					<span className="sr-only">{activeTag.name} {activeTag.detail}</span>
					<i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
				</div>
			) : beat === "pack" ? (
				<div
					key={beat}
					className="adventure-pack-observation"
					data-pack-kind={state.bag?.pack ?? "none"}
					role="status"
					aria-live="polite"
				>
					<span className="sr-only">{activeTag.name} {activeTag.detail}</span>
					<i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
				</div>
			) : null}
		</section>
	);
}

function journeyWatchCopy(lanternleaf, journeyPhase, missingSlot = null) {
	if (missingSlot) {
		if (journeyPhase === "homeward") {
			return {
				eyebrow: "A useful clue is coming Home",
				title: "Rosie turns toward the porch light",
				body: "She knows what to pack next time. Home is waiting beyond the old gate.",
			};
		}

		const firstRoute = {
			provision: {
				eyebrow: "Daylight at the warm roots",
				title: "Rosie follows as far as daylight allows",
				body: "Without a Provision, she marks the warm glow and starts Home with a useful trail clue.",
			},
			tool: {
				eyebrow: "Soft roots beneath the hedge",
				title: "Rosie studies the sleeping root",
				body: "Without a Tool, she leaves the roots undisturbed and remembers exactly where to return.",
			},
			pack: {
				eyebrow: "A delicate find stays safe",
				title: "Rosie leaves the Glowroot where it grows",
				body: "Without a Carrier, she traces its glowing leaf-print and remembers the way back.",
			},
		};
		const secondRoute = {
			provision: {
				eyebrow: "Dusk at the open gate",
				title: "Rosie marks the first reflections",
				body: "Without a Provision, she saves the night route for another outing and starts Home with a clue.",
			},
			tool: {
				eyebrow: "Reflections beyond the gate",
				title: "Rosie watches the shifting leaves",
				body: "Without a Tool, she follows their direction but cannot reveal the complete path.",
			},
			pack: {
				eyebrow: "A delicate trail stays safe",
				title: "Rosie leaves the trail supplies where they belong",
				body: "Without a Carrier, she records the reflected path so she can return prepared.",
			},
		};
		return (lanternleaf ? secondRoute : firstRoute)[missingSlot] ?? {
			eyebrow: "A useful clue",
			title: "Rosie learns where to return",
			body: "The light Bag changes this outing, but Rosie still brings useful knowledge Home.",
		};
	}

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

function JourneyWatchPanel({ state, journeyPhase, now, actionLabel, onAction, entering = false }) {
	const opportunity = adventureOpportunity(state);
	const lanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const homecomingReady = state.adventureComplete;
	const missingSlot = state.underprepared ? state.nearDiscoveryReason : null;
	const trailLabels = lanternleaf
		? { provision: "Marked reflections", tool: "Path clue", pack: "Trail map" }
		: { provision: "Marked the glow", tool: "Root clue", pack: "Leaf-print" };
	const trailLabel = missingSlot
		? trailLabels[missingSlot]
		: lanternleaf ? "Reflected leaves" : "Warm moth trail";
	const copy = journeyWatchCopy(lanternleaf, journeyPhase, missingSlot);
	const homeward = journeyPhase === "homeward";
	const returnPromise = homecomingReady
		? null
		: formatAdventureReturnPromise(state.adventureReadyAt, { now });
	const routeStatus = homecomingReady
		? "Rosie is at the gate"
		: homeward
			? lanternleaf ? "Silver leaves turn Home" : "Warm lights turn Home"
			: trailLabel;

	return (
		<section
			className={`journey-watch ${missingSlot ? "is-near-discovery" : ""} ${homecomingReady ? "is-homecoming-ready" : ""} ${entering ? "is-entering" : ""}`}
			data-journey-phase={journeyPhase}
			data-missing-capability={missingSlot ?? undefined}
			aria-label="Rosie's adventure progress"
		>
			{entering && <div className="journey-entry-lights" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
			<div className="journey-watch-tint" aria-hidden="true" />
			<div className="journey-home-dusk" aria-hidden="true"><i /></div>
			<div className="journey-watch-note" role="status" aria-live="polite">
				<div className="journey-watch-story">
					<span className="journey-watch-mark" aria-hidden="true" />
					<div>
						<small>{homecomingReady ? "The gate bell rings" : copy.eyebrow}</small>
						<strong>{homecomingReady ? "Rosie is Home" : copy.title}</strong>
						<p>{homecomingReady
							? "Welcome her before opening the Bag. The Discovery still belongs to Homecoming."
							: copy.body}</p>
					</div>
				</div>
				{!homecomingReady && <div className="journey-watch-facts">
					{returnPromise && <div className="journey-return-time-ticket" role="group" aria-label={returnPromise.ariaLabel}>
						<small aria-hidden="true">Expected Home</small>
						<strong aria-hidden="true">{returnPromise.display}</strong>
					</div>}
					<JourneyPackedStamp bag={state.bag} />
				</div>}
			</div>
			<ol className="journey-watch-route" aria-label={homecomingReady ? "Adventure complete" : "Adventure in progress"}>
				<li className="is-complete"><i aria-hidden="true">1</i><span>Set off</span></li>
				<li className={homecomingReady || homeward ? "is-complete" : "is-current"}><i aria-hidden="true">2</i><span>{trailLabel}</span></li>
				<li className={homecomingReady || homeward ? "is-current" : ""}><i aria-hidden="true">3</i><span>{homecomingReady ? "At Home" : "Homeward"}</span></li>
			</ol>
			<div className="journey-watch-lights" aria-hidden="true">
				<span>{routeStatus}</span>
				<i /><i /><i /><i /><i />
			</div>
			{homecomingReady && <button type="button" className="journey-watch-action" onClick={onAction}>{actionLabel}</button>}
		</section>
	);
}

function ReturnRewardPanel({ state, actionLabel, onAction, handoffActive = false }) {
	const nearDiscovery = state.stage === STAGES.NEAR_DISCOVERY;
	const opportunity = adventureOpportunity(state);
	const lanternleafDiscovery = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const revisitingKnownRoute = Boolean(state.selectedAdventureOpportunityId);
	const guide = nearDiscovery ? nearDiscoveryGuide(state) : null;
	const packReward = bagReturnReward(state.bag?.pack ?? null);
	const toolBonus = nearDiscovery ? null : toolReturnBonus(state.bag?.tool ?? null);
	const glowrootAmount = 1 + (toolBonus?.itemId === "glowroot-seed" ? toolBonus.amount : 0);
	const willowFiberAmount = 2 + (toolBonus?.itemId === "willow-fiber" ? toolBonus.amount : 0);
	const practicalReward = nearDiscovery
		? { name: "Compost", amount: 1 }
		: packReward ?? { name: "Carrier supply", amount: 0 };
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
			<div className={`return-discovery-plaque ${nearDiscovery ? "is-near-discovery" : ""}`}>
				<span className="return-card-eyebrow">{nearDiscovery ? "Field Guide updated" : revisitingKnownRoute ? "Route revisited" : lanternleafDiscovery ? "New route" : "New Discovery"}</span>
				<strong>{nearDiscovery ? opportunity.clueName : revisitingKnownRoute ? opportunity.name : lanternleafDiscovery ? opportunity.discoveryName : "Glowroot"}</strong>
				<small>{nearDiscovery
					? guide.story
						: revisitingKnownRoute
							? `${opportunity.discoveryName} is already mapped · this outing added useful Farm supplies`
						: lanternleafDiscovery
							? `Glowroot revealed a repeatable path · ${glowrootAmount === 1 ? "one Seed stays" : "two Seeds stay"} in Farm stock`
							: "A new living Crop for Home"}</small>
				{nearDiscovery && <div className="return-guide-next">
					<span>Try next time</span>
					<b>{guide.next}</b>
				</div>}
			</div>
			<div className={`return-stock-ledger ${nearDiscovery ? "return-stock-ledger-near" : ""}`} aria-label={nearDiscovery ? "Supplies brought Home" : "Farm stock returned"}>
				<strong className="return-stock-title">{nearDiscovery ? "Supplies brought Home" : "Added to Farm stock"}</strong>
				<div>
					{!nearDiscovery && <span>
						<b>Glowroot Seed</b>
						<strong>+{glowrootAmount}</strong>
						{toolBonus?.itemId === "glowroot-seed" && (
							<small className="return-stock-cause">Find +1 · Trowel +1</small>
						)}
					</span>}
					<span><b>{practicalReward.name}</b><strong>+{practicalReward.amount}</strong></span>
					<span>
						<b>Willow Fiber</b>
						<strong>+{nearDiscovery ? 1 : willowFiberAmount}</strong>
						{!nearDiscovery && toolBonus?.itemId === "willow-fiber" && (
							<small className="return-stock-cause">Find +2 · Lantern +1</small>
						)}
					</span>
				</div>
			</div>
			<button type="button" className="return-reward-action" disabled={handoffActive} onClick={onAction}>{nearDiscovery ? guide.action : actionLabel}</button>
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

function homeMemoryContent(state) {
	if (state.fieldGuide.includes(SECOND_ADVENTURE_OPPORTUNITY.discoveryName)) {
		return {
			ariaLabel: "Lanternleaf Path's lasting Home memory and Farm stock",
			pocketTitle: "Lanternleaf Path is mapped",
			pocketDetail: "Silver trail · Safe return · New route",
			plaqueLabel: "The Barn remembers the Lanternleaf Path",
			plaqueDetail: "Lanternleaf Path now guides Rosie Home.",
			positionName: "Lanternleaf Path at Home",
		};
	}
	return {
		ariaLabel: "Glowroot's lasting Home changes and Farm stock",
		pocketTitle: "Glowroot changed Home",
		pocketDetail: "Bed 3 · Open hedge · Pond frog",
		plaqueLabel: "The Barn remembers that Glowroot changed Home",
		plaqueDetail: "Glowroot now lights the open path.",
		positionName: "Glowroot at Home",
	};
}

function repeatHomeMemoryPrototype(memory, variant) {
	if (variant === "B") {
		return {
			...memory,
			ariaLabel: "Today's familiar Lanternleaf outing and Farm stock",
			pocketTitle: "Lanternleaf Path · visited today",
			pocketDetail: "Known trail · Rosie Home · Supplies stocked",
			plaqueEyebrow: "Today’s outing",
			plaqueTitle: "A familiar trail brought Rosie Home",
			plaqueLabel: "Rosie returned from the familiar Lanternleaf Path",
			plaqueDetail: "Rosie followed the silver leaves Home again.",
			positionName: "Lanternleaf Path revisited",
		};
	}
	return memory;
}

function HomeMemoryPanel({ state, memory, actionLabel, onAction, showAction = true, expanded, onToggle }) {
	const stock = state.farmStock ?? {};
	const stockItems = [
		["☘", "Clover Seed", stock["clover-seed"] ?? 0],
		["✦", "Glowroot Seed", stock["glowroot-seed"] ?? 0],
		["♣", "Compost", stock.compost ?? 0],
		["≋", "Willow Fiber", stock["willow-fiber"] ?? 0],
	];
	return (
		<section className={`home-memory-panel home-memory-panel-pocket ${expanded ? "is-expanded" : ""} ${showAction ? "has-action" : ""}`} aria-label={memory.ariaLabel}>
			<div className="home-memory-pocket-detail" id="farm-memory-detail" hidden={!expanded}>
				<strong>Farm stock stays useful</strong>
				<div aria-label="Current Farm stock">
					{stockItems.map(([icon, name, amount]) => <span key={name}><i aria-hidden="true">{icon}</i><small>{name}</small><b>{amount}</b></span>)}
				</div>
			</div>
			<button
				type="button"
				className="home-memory-pocket"
				aria-controls="farm-memory-detail"
				aria-expanded={expanded}
				aria-label={expanded ? "Close Home changes and Farm stock" : "Open Home changes and Farm stock"}
				onClick={onToggle}
			>
				<strong>{memory.pocketTitle}</strong>
				<span>{memory.pocketDetail}</span>
				<small>{expanded ? "Close" : "See stock"}</small>
			</button>
			{showAction && <button type="button" className="home-memory-action" onClick={onAction}>{actionLabel}</button>}
		</section>
	);
}


function HomeMemoryDayPlaque({ memory, treatment = "A" }) {
	if (treatment === "C") {
		return (
			<div className="home-memory-day-plaque repeat-home-ledger" aria-label="Known Lanternleaf place and today's stocked supplies">
				<span><small>Known place</small><strong>Lanternleaf Path</strong><em>Still guides Rosie Home</em></span>
				<span><small>Today’s outing</small><strong>Supplies stocked</strong><em>Seed · Compost · Willow Fiber</em></span>
			</div>
		);
	}
	return (
		<div className="home-memory-day-plaque" aria-label={memory.plaqueLabel}>
			<small>{memory.plaqueEyebrow ?? "Home remembers"}</small>
			<strong>{memory.plaqueTitle ?? "The Barn remembers"}</strong>
			<span>{memory.plaqueDetail}</span>
		</div>
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
const JOURNEY_ENTRY_BRIDGE_MS = 900;
const RAPID_TRANSITION_GUARD_MS = 350;
const HARVEST_CELEBRATION_MS = 560;
const NEW_DAY_HANDOFF_MS = 900;
const REDUCED_NEW_DAY_HANDOFF_MS = 300;
const SEED_HANDOFF_DEPART_MS = 420;
const SEED_HANDOFF_ARRIVE_MS = 460;
const GLOWROOT_HOME_REVEAL_MS = 900;
const PURPOSE_HANDOFF_MS = 1200;
const REDUCED_PURPOSE_HANDOFF_MS = 900;
const RAPID_TRANSITION_ACTIONS = new Set([
	ACTIONS.TICKLE,
	ACTIONS.CHOOSE_ADVENTURE_ROUTE,
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
	if (
		state.stage === STAGES.STARTING &&
		state.hasTickled &&
		!state.selectedCrop &&
		!state.selectedAdventureOpportunityId &&
		canChooseKnownAdventureRoute(state)
	) {
		return "Rosie is choosing between two familiar routes. The warm paper-craft Barn, open hedge, Glowroot bed, rooted Moonberry bed, pond frog, and mapped gate remain visible behind her storybook map.";
	}
	const rememberedHome = state.glowrootPlanted
		? state.nextPlanting === "moonberries"
			? " The open hedge, earned bell, Glowroot bed, and rooted Moonberry bed remain from the last Adventure. Harvested Bed 1 rests empty."
			: " The open hedge, earned bell, and Glowroot bed remain from the last Adventure. Harvested Bed 1 rests empty."
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
	const repeatHomePrototype = initialSearch.get("repeat") === "1";
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
			const reviewState = createPrototypeState(requestedPosition, {
				reduceMotion: persistedReview.reduceMotion,
				journeyPhase: requestedJourneyPhase,
				adventureRoute: requestedAdventureRoute,
			});
			return repeatHomePrototype && requestedPosition === 11
				? {
					...reviewState,
					daysCompleted: 2,
					selectedAdventureOpportunityId: SECOND_ADVENTURE_OPPORTUNITY.id,
				}
				: reviewState;
		}
		if (loopMode) return createInitialState({ reduceMotion: prefersReduced });
		return deserializeState(localStorage.getItem(HOMEGROWN_STORAGE_KEY), { reduceMotion: prefersReduced });
	});
	const [variant, setVariant] = useVariant();
	const [visualNow, setVisualNow] = useState(() => Date.now());
	const presentation = useMemo(() => playerPresentation(state), [state]);
	const opportunity = useMemo(() => adventureOpportunity(state), [state]);
	const bagClueSlot = BAG_SLOT_ORDER.includes(state.nearDiscoveryReason)
		? state.nearDiscoveryReason
		: null;
	const bagClueGuide = useMemo(
		() => bagClueSlot === null ? null : nearDiscoveryGuide(state),
		[state, bagClueSlot],
	);
	const riveModel = useMemo(
		() => homegrownRiveModel(state, visualNow),
		[state, visualNow],
	);
	const image = sceneImage();
	const [feedback, setFeedback] = useState(0);
	const [startingNewDay, setStartingNewDay] = useState(false);
	const [adventureCauseBeat, setAdventureCauseBeat] = useState("provision");
	const [journeyEntryFresh, setJourneyEntryFresh] = useState(false);
	const [seedHandoff, setSeedHandoff] = useState(null);
	const [glowrootHomeReveal, setGlowrootHomeReveal] = useState(false);
	const [purposeHandoff, setPurposeHandoff] = useState(false);
	const [homeMemoryExpanded, setHomeMemoryExpanded] = useState(false);
	const transitionLockUntil = useRef(0);
	const newDayTimer = useRef(null);
	const glowrootHomeRevealTimer = useRef(null);
	const purposeHandoffTimer = useRef(null);
	const seedHandoffTimers = useRef([]);
	const debug = new URLSearchParams(window.location.search).get("debug") === "1";
	const position = state.prototypePosition ?? 1;
	const choosingRoute =
		position === 2 &&
		state.stage === STAGES.STARTING &&
		!state.selectedCrop &&
		canChooseKnownAdventureRoute(state) &&
		!state.selectedAdventureOpportunityId;
	const choosingSeed = position === 2 && state.stage === STAGES.STARTING && !state.selectedCrop && !choosingRoute;
	const plantingCrop = position === 3 && state.stage === STAGES.STARTING && Boolean(CROP_RULES[state.selectedCrop]);
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
	const showingFarmingPanel = choosingRoute || choosingSeed || plantingCrop || showingGrowth || showingHarvestRhythm || showingHarvestCelebration || showingHarvestResult;
	const choosingBag = position === 7 && state.stage === STAGES.CLOVER_READY && state.cloverHarvested;
	const departing = position === 8 && state.stage === STAGES.ADVENTURE && !state.departureComplete;
	const showingAdventureVignette = position === 9 && state.stage === STAGES.ADVENTURE && state.departureComplete && !state.adventureVignetteSeen;
	const showingJourneyWatch = position === 9 && state.stage === STAGES.ADVENTURE && state.departureComplete && state.adventureVignetteSeen;
	const gateHomecomingReady = showingJourneyWatch && state.adventureComplete;
	const journeyPhase = adventureJourneyPhase(state, visualNow) ?? "trail";
	const repeatHomeStudy =
		debug &&
		repeatHomePrototype &&
		position === 11 &&
		state.stage === STAGES.DEVELOPED &&
		Boolean(state.selectedAdventureOpportunityId);
	const homeMemory = repeatHomeStudy
		? repeatHomeMemoryPrototype(homeMemoryContent(state), variant)
		: homeMemoryContent(state);
	const defaultPositionName = positionRailName({
		position,
		showingAdventureVignette,
		showingJourneyWatch,
		journeyPhase,
		adventureComplete: state.adventureComplete,
	});
	const currentPositionName =
		choosingRoute
			? "Choose today’s route"
			: position === 11 && state.stage === STAGES.DEVELOPED && state.cycleComplete
			? homeMemory.positionName
			: defaultPositionName;
	const adventureEnvironmentRevealed = ["tool", "pack", "resolved"].includes(adventureCauseBeat);
	const showingReturnReward = position === 10 && [STAGES.GLOWROOT_RETURNED, STAGES.NEAR_DISCOVERY].includes(state.stage);
	const returnKind = state.stage === STAGES.NEAR_DISCOVERY
		? "near-discovery"
		: state.selectedAdventureOpportunityId
			? "revisit"
			: "discovery";
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
	const showingHomeMemoryPromise =
		showingHomeMemory &&
		state.stage === STAGES.DEVELOPED &&
		state.cycleComplete;
	const holdingGlowrootHomeReveal = glowrootHomeReveal && !state.reduceMotion;
	const holdingPurposeHandoff = purposeHandoff && (choosingRoute || choosingSeed);
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
	const adventureProvisionTrigger = showingAdventureVignette && !state.reduceMotion && adventureCauseBeat === "provision"
		? "adventure-provision"
		: null;
	const adventureAttentionTrigger = showingAdventureVignette && !state.reduceMotion && adventureCauseBeat === "tool"
		? "adventure-attention"
		: null;
	const sceneRiveTrigger = adventureProvisionTrigger ?? adventureAttentionTrigger ?? (gateHomecomingReady ? "return" : riveModel.trigger);
	const sceneRiveTriggerNonce = adventureProvisionTrigger
		? `${riveModel.triggerNonce}:adventure-provision:${opportunity.id}`
		: adventureAttentionTrigger
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
		? { ...presentation, objective: `Harvesting ${CROP_RULES[state.selectedCrop]?.name ?? "crop"}…` }
		: showingAdventureVignette && adventureCauseBeat === "provision"
		? {
			...presentation,
			...adventureProvisionPresentation(state),
		}
		: showingAdventureVignette && adventureCauseBeat === "tool"
		? {
			...presentation,
			...adventureToolPresentation(state),
		}
		: showingAdventureVignette && adventureCauseBeat === "pack"
		? {
			...presentation,
			...adventurePackPresentation(state),
		}
		: showingAdventureVignette && adventureCauseBeat === "resolved"
		? {
			...presentation,
			...adventureHandoffPresentation(state),
		}
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
					? `${CROP_RULES[state.selectedCrop]?.name ?? "Crop"} ${state.selectedCrop === "moonberries" ? "are" : "is"} growing…`
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
			() => {
				if (!state.reduceMotion) setJourneyEntryFresh(true);
				dispatch({ type: ACTIONS.CONTINUE_ADVENTURE_STORY });
			},
			state.reduceMotion ? REDUCED_ADVENTURE_HANDOFF_MS : ADVENTURE_HANDOFF_MS,
		);
		return () => window.clearTimeout(timer);
	}, [adventureCauseBeat, showingAdventureVignette, state.reduceMotion]);

	useEffect(() => {
		if (!journeyEntryFresh) return undefined;
		const timer = window.setTimeout(() => setJourneyEntryFresh(false), JOURNEY_ENTRY_BRIDGE_MS);
		return () => window.clearTimeout(timer);
	}, [journeyEntryFresh]);

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
		window.clearTimeout(purposeHandoffTimer.current);
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
		if (nextAction.type === ACTIONS.TICKLE && position === 1) {
			setPurposeHandoff(true);
			window.clearTimeout(purposeHandoffTimer.current);
			purposeHandoffTimer.current = window.setTimeout(
				() => setPurposeHandoff(false),
				state.reduceMotion ? REDUCED_PURPOSE_HANDOFF_MS : PURPOSE_HANDOFF_MS,
			);
		}
		dispatch(nextAction);
		signalFeedback(nextAction.type);
	}, [position, signalFeedback, startingNewDay, state.reduceMotion]);

	const jumpToPosition = useCallback((nextPosition) => {
		if (seedHandoff || holdingGlowrootHomeReveal || holdingPurposeHandoff) return;
		setHomeMemoryExpanded(false);
		const now = performance.now();
		if (now < transitionLockUntil.current) return;
		transitionLockUntil.current = now + RAPID_TRANSITION_GUARD_MS;
		dispatch({ type: ACTIONS.JUMP_TO_POSITION, position: nextPosition });
	}, [holdingGlowrootHomeReveal, holdingPurposeHandoff, seedHandoff]);

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
			className={`phone scene-${image} stage-${state.stage} ${state.compostApplied ? "composted-crop" : ""} ${departing ? "departure-in-progress" : ""} ${showingAdventureVignette ? "adventure-vignette-open" : ""} ${showingJourneyWatch ? "journey-watch-open" : ""} ${gateHomecomingReady ? "gate-homecoming-ready" : ""} ${showingReturnReward ? "return-homecoming-open" : ""} ${showingGlowrootPlanting ? "glowroot-planting-open" : ""} ${showingMoonberryPlanting && !holdingGlowrootHomeReveal ? "moonberry-planting-open" : ""} ${showingHomeTickle ? "home-tickle-open" : ""} ${startingNewDay ? "new-day-in-progress" : ""} ${seedHandoff ? "seed-handoff-active" : ""} ${holdingGlowrootHomeReveal ? "glowroot-home-reveal" : ""} ${holdingPurposeHandoff ? "purpose-handoff-open" : ""} ${homeMemoryEarned ? "home-memory-earned" : ""} rosie-action-${riveModel.viewModel.rosieAction} feedback-${feedback % 2} ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "rive-authored" : "rive-probe"}`}
			aria-busy={startingNewDay || Boolean(seedHandoff) || holdingGlowrootHomeReveal || holdingPurposeHandoff}
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
			{showingHomeMemoryPromise && <HomeMemoryDayPlaque memory={homeMemory} treatment={repeatHomeStudy ? variant : "A"} />}
			{state.stage !== STAGES.ADVENTURE && !showingReturnReward && !showingGlowrootPlanting && (!showingHomeMemory || showingHomeTickle) && !homeMemoryExpanded && !showingFarmingPanel && !choosingBag && !showPackedLoadout && <button
				className={`rosie-hit ${visiblePresentation.target === WORLD_TARGETS.ROSIE ? "is-guided" : ""}`}
				type="button"
				aria-label={visiblePresentation.target === WORLD_TARGETS.ROSIE ? visiblePresentation.label : "Tickle Rosie"}
				onClick={() => act(visiblePresentation.target === WORLD_TARGETS.ROSIE ? visiblePresentation.action : { type: ACTIONS.TICKLE })}
			>
				{visiblePresentation.target === WORLD_TARGETS.ROSIE && <span>{visiblePresentation.label}</span>}
			</button>}
			{showPackedLoadout && <PackedLoadoutRibbon bag={state.bag} farmStock={state.farmStock} />}
			{choosingRoute && !holdingPurposeHandoff && <KnownRouteMap
				onChoose={(opportunityId) => act({ type: ACTIONS.CHOOSE_ADVENTURE_ROUTE, opportunityId })}
			/>}
			{choosingSeed && !holdingPurposeHandoff && <SeedChoicePanel
				state={state}
				opportunity={opportunity}
				onChoose={(crop) => act({ type: ACTIONS.SELECT_CROP, crop })}
			/>}
			{holdingPurposeHandoff && <PurposeHandoff opportunity={opportunity} choosingRoute={choosingRoute} />}
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
					finalBeat: (state.harvestBeats?.length ?? 0) === cropHarvestPattern(state).length - 1,
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
				entering={journeyEntryFresh}
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
				memory={homeMemory}
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
			{choosingBag && <BagSelectionPanel
				bag={state.bag}
				farmStock={state.farmStock}
				opportunity={opportunity}
				activeSelection={riveModel.bagReceive}
				initialFocus={state.nearDiscoveryReason ?? "provision"}
				clueGuide={bagClueGuide}
				clueSlot={bagClueSlot}
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
		{showingJourneyWatch && !state.adventureComplete && !journeyEntryFresh && <JourneyReviewRailAction
			actionLabel={presentation.label}
			onAction={() => act(presentation.action)}
		/>}
		<PositionRail position={position} onChange={jumpToPosition} positionName={currentPositionName} />
		{debug && <DevTools state={state} dispatch={dispatch} variant={variant} />}
		{debug && <VariantSwitcher variant={variant} setVariant={setVariant} />}
	</main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<App />);
