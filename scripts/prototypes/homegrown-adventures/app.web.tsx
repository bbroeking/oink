// @ts-nocheck -- throwaway standalone lab; the reducer and Rive contract are checked separately.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	HOMEGROWN_RIVE_ASSET_AUTHORED,
	HomegrownRiveScene,
} from "../../../components/prototypes/homegrown-adventures/HomegrownRiveScene.web";
import {
	ACTIONS,
	adventureStory,
	BAG_ITEMS,
	BAG_SLOT_ORDER,
	bagItem,
	CROP_RULES,
	createInitialState,
	createPrototypeState,
	deserializeState,
	HOMEGROWN_STORAGE_KEY,
	homegrownReducer,
	HARVEST_PATTERN,
	playerPresentation,
	PROTOTYPE_POSITIONS,
	serializeState,
	STAGES,
	WORLD_TARGETS,
} from "./game.mjs";
import {
	CLOVER_LUSH_THRESHOLD,
	homegrownRiveModel,
} from "./homegrownRiveModel.mjs";
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
	if (state.stage === STAGES.NEAR_DISCOVERY) {
		const copy = {
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
		}[state.nearDiscoveryReason];
		if (copy) return { eyebrow: "Near-Discovery · never failure", ...copy };
	}
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
			<span className="world-action-label">{presentation.label}</span>
		</button>
	);
}

const BAG_SLOT_LABELS = {
	provision: "Provision",
	tool: "Tool",
	pack: "Pack",
};

function SeedChoicePanel({ state, onChoose }) {
	const farmStock = state.farmStock ?? {};
	const cloverSeeds = farmStock[CROP_RULES.clover.seedId] ?? 0;
	const compost = farmStock.compost ?? 0;
	const rememberedMorning = state.daysCompleted > 0 && state.glowrootPlanted;

	if (rememberedMorning) {
		return (
			<section className="seed-choice-panel seed-choice-memory" aria-label="Choose the next crop while Home keeps growing">
				<div className="seed-memory-ledger">
					<strong>Already growing at Home</strong>
					<span><i aria-hidden="true">●</i><b>Moonberries</b><small>Bed 2 · growing</small></span>
					<span><i aria-hidden="true">✦</i><b>Glowroot</b><small>Bed 3 · planted</small></span>
				</div>
				<div className="seed-choice-next-row">
					<button type="button" onClick={onChoose} disabled={cloverSeeds < 1}>
						<span className="seed-art seed-art-clover" aria-hidden="true">☘</span>
						<span><small>Plant next</small><strong>Clover Seed</strong><b>{cloverSeeds} owned</b></span>
						<em>{cloverSeeds > 0 ? "Choose Clover" : "Need a Seed"}</em>
					</button>
					<div><span className="seed-art seed-art-compost" aria-hidden="true">♣</span><span><small>Optional boost</small><strong>Compost</strong><b>{compost} owned</b></span></div>
				</div>
				<p>Your Adventure changed Home. Clover can stock the next one.</p>
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
			<p>Clover becomes a Provision for Rosie’s dusk Adventure.</p>
		</section>
	);
}

function PlantingPanel({ state, onToggleCompost, onPlant }) {
	const seeds = state.farmStock?.[CROP_RULES.clover.seedId] ?? 0;
	const compost = state.farmStock?.compost ?? 0;
	const boosted = state.compostApplied && compost > 0;
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
					<span><small>Optional Compost</small><strong>{boosted ? "Added" : "Saved"}</strong><b>{boosted ? `${compost} → ${compost - 1}` : `${compost} stays`}</b></span>
					<i aria-hidden="true">{boosted ? "✓" : "+"}</i>
				</button>
			</div>
			<div className="planting-effect" role="status">
				<strong>{boosted ? "Ready in 2 hours · Harvest 4" : "Ready in 4 hours · Harvest 3"}</strong>
				<small>{boosted ? "Compost grows it sooner and gives one extra." : "Nothing is lost. Compost is a choice, not a requirement."}</small>
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
				<span
					key={direction}
					className={`${index < beatIndex ? "is-complete" : ""} ${index === beatIndex ? "is-next" : ""}`}
				>
					{HARVEST_DIRECTION_LABELS[direction].arrow}
				</span>
			))}
		</div>
	);
	const assistButton = nextDirection && (
		<button
			type="button"
			className="harvest-assist"
			onClick={() => onBeat(nextDirection, "button")}
			aria-label={`Harvest ${nextLabel.name}`}
		>
			<span aria-hidden="true">{nextLabel.arrow}</span>
			<strong>Tap {nextLabel.name}</strong>
		</button>
	);

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
			<section className="harvest-bed-ribbon" aria-label="Follow Clover's harvest rhythm">
				<strong aria-live="polite">{nextLabel ? `Swipe ${nextLabel.name}` : "Harvest complete"}</strong>
				{pattern}
				<small>on the flowered bed</small>
			</section>
			<div className="harvest-bed-assist">
				{assistButton}
				<span><i aria-hidden="true">✓</i> Harvest guaranteed · clean rhythm +1</span>
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

function HarvestResultPanel({ state, onContinue }) {
	const compostBonus = state.compostApplied ? CROP_RULES.clover.compostYieldBonus : 0;
	const rhythmBonus = state.harvestRhythmBonus ? 1 : 0;
	const stockItems = [
		{ id: "clover", name: "Clover Lunch", value: state.farmStock?.["clover-lunch"] ?? 0, kind: "clover" },
		{ id: "seed", name: "Clover Seed", value: state.farmStock?.[CROP_RULES.clover.seedId] ?? 0, kind: "seed" },
		{ id: "compost", name: "Compost", value: state.farmStock?.compost ?? 0, kind: "compost" },
		{ id: "materials", name: "Materials", value: state.farmStock?.["willow-fiber"] ?? 0, kind: "materials" },
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
	const continueButton = <button type="button" className="harvest-prepare" onClick={onContinue}>Prepare an Adventure</button>;
	return (
		<section className="harvest-result-world harvest-result-shelf" aria-label="Clover harvest added to Farm stock">
			<div className="farm-stock-shelf"><strong>Farm stock</strong>{stockGrid}</div>
			{harvestBasket}
			{continueButton}
		</section>
	);
}

function BagSelectionPanel({ bag, farmStock, onSelect, onConfirm }) {
	const selectedProvisionId = bag.provision ?? null;
	const selectedProvisionOwned = selectedProvisionId === null ? 0 : farmStock?.[selectedProvisionId] ?? 0;
	const canPack = selectedProvisionId === null || selectedProvisionOwned > 0;
	const cycleItem = (slot) => {
		const choices = BAG_ITEMS[slot];
		const current = choices.findIndex((item) => item.id === bag[slot]);
		const next = choices[(current + 1 + choices.length) % choices.length];
		onSelect(slot, next.id);
	};

	return (
		<section className="bag-selection" aria-label="Choose what Rosie carries">
		<div className="bag-slot-grid">
			{BAG_SLOT_ORDER.map((slot) => {
				const selected = bagItem(slot, bag[slot]);
				const defaultItem = BAG_ITEMS[slot][0];
				const owned = slot === "provision" ? farmStock?.[selected?.id ?? defaultItem.id] ?? 0 : null;
				const unavailable = slot === "provision" && selected && owned < 1;
				return (
					<div className={`bag-slot-card ${selected ? "is-filled" : "is-empty"} ${unavailable ? "is-unavailable" : ""}`} key={slot}>
						<span className="bag-slot-kind">{BAG_SLOT_LABELS[slot]}</span>
						<span className="bag-item-icon" aria-hidden="true">{selected?.icon ?? "·"}</span>
						<strong>{selected?.name ?? "Empty"}</strong>
						{selected ? (
							<small>{slot === "provision"
								? owned > 0
									? `${owned} → ${owned - 1} · ${selected.effect}`
									: `0 owned · Grow more or leave empty`
								: `Reusable · ${selected.effect}`}</small>
						) : (
							<small>Rosie can leave without one</small>
						)}
						<button type="button" className="bag-change" onClick={() => cycleItem(slot)}>
							{selected ? "Change" : `Choose ${defaultItem.name}`}
						</button>
						<button
							type="button"
							className="bag-empty"
							disabled={!selected}
							onClick={() => onSelect(slot, null)}
						>
							Leave empty
						</button>
					</div>
				);
			})}
		</div>
		<button type="button" className="bag-confirm" onClick={onConfirm} disabled={!canPack}>
			{canPack ? "Pack these" : "Need Clover Lunch"}
		</button>
		<p>{canPack ? "Provisions are used once. Tools and Packs come Home." : "Leave Provision empty to explore with a useful clue."}</p>
		</section>
	);
}

function PackedLoadoutRibbon({ bag }) {
	return (
		<div className="packed-loadout" aria-label="Rosie's packed items">
		{BAG_SLOT_ORDER.map((slot) => {
			const selected = bagItem(slot, bag[slot]);
			return (
				<span key={slot} className={selected ? "" : "is-empty"}>
					<i aria-hidden="true">{selected?.icon ?? "·"}</i>
					<small>{BAG_SLOT_LABELS[slot]}</small>
					<strong>{selected?.name ?? "Empty"}</strong>
				</span>
			);
		})}
		</div>
	);
}

function AdventureVignetteOverlay({ state, onContinue }) {
	const story = adventureStory(state);
	return (
		<section className="adventure-vignette-overlay" data-story-kind={story.kind} aria-label="Beyond-the-hedge Adventure">
			<div className="adventure-cause-tags">
				{story.tags.map((tag) => (
					<div key={tag.slot} className={tag.name.startsWith("No ") ? "is-empty" : ""}>
						<i aria-hidden="true">{tag.icon}</i>
						<strong>{tag.name}</strong>
						<small>{tag.detail}</small>
					</div>
				))}
			</div>
			<div className="adventure-find" role="status">
				<span className="glowroot-token" aria-hidden="true">✦</span>
				<strong>{story.headline}</strong>
				<small>{story.result}</small>
			</div>
			<button type="button" className="adventure-continue" onClick={onContinue}>Continue the story</button>
		</section>
	);
}

function ReturnRewardPanel({ state, actionLabel, onAction }) {
	const nearDiscovery = state.stage === STAGES.NEAR_DISCOVERY;
	const story = adventureStory(state);
	return (
		<section className="return-reward-panel" data-return-kind={nearDiscovery ? "near-discovery" : "discovery"} aria-label="Rosie's return rewards">
			<div className="return-discovery-card">
				<span className="return-card-eyebrow">{nearDiscovery ? "Useful clue" : "New Discovery"}</span>
				<span className="return-seed" aria-hidden="true">✦</span>
				<strong>{nearDiscovery ? "Glowroot Trail" : "Glowroot Seed  +1"}</strong>
				<small>{nearDiscovery ? story.result : "A slow Crop that glows after dusk"}</small>
			</div>
			<div className="return-preparation-recap" aria-label="How Rosie's preparation helped">
				{story.tags.map((tag) => <span key={tag.slot}><b>{tag.name}</b><small>{tag.detail}</small></span>)}
			</div>
			<div className="return-supplies" aria-label="Farm supplies returned">
				<span><i aria-hidden="true">♣</i><b>Compost</b><strong>+1</strong></span>
				<span><i aria-hidden="true">≋</i><b>Willow Fiber</b><strong>+{nearDiscovery ? 1 : 2}</strong></span>
			</div>
			<button type="button" className="return-reward-action" onClick={onAction}>{actionLabel}</button>
		</section>
	);
}

function HomeMemoryPanel({ state, actionLabel, onAction }) {
	const stock = state.farmStock ?? {};
	return (
		<section className="home-memory-panel" aria-label="The Barn remembers this Adventure">
			<div className="home-memory-promise">
				<strong>The Barn remembers</strong>
				<div>
					<span><i aria-hidden="true">☘</i><b>Crops</b><small>keep growing</small></span>
					<span><i aria-hidden="true">⌂</i><b>Farm stock</b><small>remains</small></span>
					<span><i aria-hidden="true">✦</i><b>Discoveries</b><small>stay</small></span>
				</div>
			</div>
			<div className="home-memory-stock" aria-label="Farm stock after planting Glowroot">
				<strong>Farm stock</strong>
				<div>
					<span><i aria-hidden="true">☘</i><small>Clover Lunch</small><b>{stock["clover-lunch"] ?? 0}</b></span>
					<span><i aria-hidden="true">✦</i><small>Glowroot Seed</small><b>{stock["glowroot-seed"] ?? 0}</b></span>
					<span><i aria-hidden="true">♣</i><small>Compost</small><b>{stock.compost ?? 0}</b></span>
					<span><i aria-hidden="true">≋</i><small>Materials</small><b>{stock["willow-fiber"] ?? 0}</b></span>
				</div>
			</div>
			<button type="button" className="home-memory-action" onClick={onAction}>{actionLabel}</button>
		</section>
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
const RAPID_TRANSITION_GUARD_MS = 350;
const HARVEST_CELEBRATION_MS = 560;
const RAPID_TRANSITION_ACTIONS = new Set([
	ACTIONS.TICKLE,
	ACTIONS.SELECT_CROP,
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
		copy = {
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

function PositionRail({ position, onChange }) {
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
				<small>{current.name}</small>
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

function sceneLabel(state) {
	if (state.stage === STAGES.ADVENTURE) {
		return `${stageCopy(state).title}. The warm paper-craft Barn and Kitchen Patch are quiet while Rosie explores beyond the hedge.`;
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
	const reviewMode = loopMode || hasRequestedPosition;
	const [state, dispatch] = useReducer(homegrownReducer, undefined, () => {
		if (hasRequestedPosition) {
			const persistedReview = deserializeState(localStorage.getItem(HOMEGROWN_REVIEW_STORAGE_KEY), {
				reduceMotion: prefersReduced,
			});
			if (persistedReview.prototypePosition === requestedPosition) return persistedReview;
			return createPrototypeState(requestedPosition, { reduceMotion: persistedReview.reduceMotion });
		}
		if (loopMode) return createInitialState({ reduceMotion: prefersReduced });
		return deserializeState(localStorage.getItem(HOMEGROWN_STORAGE_KEY), { reduceMotion: prefersReduced });
	});
	const [variant, setVariant] = useVariant();
	const [visualNow, setVisualNow] = useState(() => Date.now());
	const presentation = useMemo(() => playerPresentation(state), [state]);
	const riveModel = useMemo(
		() => homegrownRiveModel(state, visualNow),
		[state, visualNow],
	);
	const image = sceneImage();
	const [feedback, setFeedback] = useState(0);
	const transitionLockUntil = useRef(0);
	const debug = new URLSearchParams(window.location.search).get("debug") === "1";
	const position = state.prototypePosition ?? 1;
	const choosingSeed = position === 2 && state.stage === STAGES.STARTING && !state.selectedCrop;
	const plantingCrop = position === 3 && state.stage === STAGES.STARTING && state.selectedCrop === "clover";
	const showingGrowth = position === 4 && state.stage === STAGES.CLOVER_GROWING;
	const showingHarvestRhythm = position === 5 && state.stage === STAGES.CLOVER_READY && !state.cloverHarvested;
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
	const showingReturnReward = position === 10 && [STAGES.GLOWROOT_RETURNED, STAGES.NEAR_DISCOVERY].includes(state.stage);
	const showingHomeMemory = position === 11 && state.glowrootPlanted;
	const showPackedLoadout = position >= 8 && position <= 10 && !showingAdventureVignette && !showingReturnReward;
	const waiting = departing || (autoPlay && (
		state.stage === STAGES.CLOVER_GROWING ||
		(state.stage === STAGES.ADVENTURE && state.departureComplete && state.adventureVignetteSeen && !state.adventureComplete)
	));
	const visiblePresentation = showingHarvestCelebration
		? { ...presentation, objective: "Harvesting Clover…" }
		: showingHarvestRhythm
		? { ...presentation, objective: "Clover’s rhythm: ← → ↑" }
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
		const now = performance.now();
		const guardsTransition =
			RAPID_TRANSITION_ACTIONS.has(nextAction.type) ||
			(nextAction.type === ACTIONS.HARVEST_BEAT && nextAction.finalBeat);
		if (guardsTransition) {
			if (now < transitionLockUntil.current) return;
			transitionLockUntil.current = now + RAPID_TRANSITION_GUARD_MS;
		}
		dispatch(nextAction);
		signalFeedback(nextAction.type);
	}, [signalFeedback]);

	const jumpToPosition = useCallback((nextPosition) => {
		dispatch({ type: ACTIONS.JUMP_TO_POSITION, position: nextPosition });
	}, []);

	const selectBagItem = useCallback((slot, item) => {
		dispatch({ type: ACTIONS.SET_BAG_SLOT, slot, item });
	}, []);

	return <main className={`lab ${debug ? "lab-debug" : "lab-player"} variant-${variant}`}>
		{debug && <header className="lab-context">
			<p><strong>Homegrown Adventures</strong><span>{VARIANTS[variant].question}</span></p>
			<span className="prototype-badge">Prototype · browser lab</span>
		</header>}
		<div className={`phone scene-${image} stage-${state.stage} ${state.compostApplied ? "composted-crop" : ""} ${departing ? "departure-in-progress" : ""} ${showingAdventureVignette ? "adventure-vignette-open" : ""} rosie-action-${riveModel.viewModel.rosieAction} feedback-${feedback % 2} ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "rive-authored" : "rive-probe"}`}>
			<div className="scene-plate" role="img" aria-label={sceneLabel(state)} />
			{showingAdventureVignette && <div className="adventure-vignette-backdrop" aria-hidden="true" />}
			<HomegrownRiveScene
				reduceMotion={state.reduceMotion}
				model={riveModel.viewModel}
				trigger={riveModel.trigger}
				triggerNonce={riveModel.triggerNonce}
			/>
			{showingAdventureVignette && <div className="adventure-bed-mask" aria-hidden="true" />}
			<div className="quiet-hud">
				<HeartChip value={state.ticklesEarned} />
				<div className="current-objective" id="current-objective" role="status" aria-live="polite">
					<span aria-hidden="true" />
					<strong>{visiblePresentation.objective}</strong>
				</div>
			</div>
			{state.stage !== STAGES.ADVENTURE && !showingReturnReward && !showingHomeMemory && !showingFarmingPanel && !choosingBag && !showPackedLoadout && <button
				className={`rosie-hit ${visiblePresentation.target === WORLD_TARGETS.ROSIE ? "is-guided" : ""}`}
				type="button"
				aria-label={visiblePresentation.target === WORLD_TARGETS.ROSIE ? visiblePresentation.label : "Tickle Rosie"}
				onClick={() => act(visiblePresentation.target === WORLD_TARGETS.ROSIE ? visiblePresentation.action : { type: ACTIONS.TICKLE })}
			>
				{visiblePresentation.target === WORLD_TARGETS.ROSIE && <span>{visiblePresentation.label}</span>}
			</button>}
			{showPackedLoadout && <PackedLoadoutRibbon bag={state.bag} />}
			{choosingSeed && <SeedChoicePanel
				state={state}
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
				onContinue={() => act(visiblePresentation.action)}
			/>}
			{showingAdventureVignette && <AdventureVignetteOverlay
				state={state}
				onContinue={() => act(visiblePresentation.action)}
			/>}
			{showingReturnReward && <ReturnRewardPanel
				state={state}
				actionLabel={visiblePresentation.label}
				onAction={() => act(visiblePresentation.action)}
			/>}
			{showingHomeMemory && <HomeMemoryPanel
				state={state}
				actionLabel={visiblePresentation.label}
				onAction={() => act(visiblePresentation.action)}
			/>}
			{choosingBag && <BagSelectionPanel
				bag={state.bag}
				farmStock={state.farmStock}
				onSelect={selectBagItem}
				onConfirm={() => act(visiblePresentation.action)}
			/>}
			{!showingFarmingPanel && !choosingBag && !showingAdventureVignette && !showingReturnReward && !showingHomeMemory && <WorldAction
				key={`${visiblePresentation.target}-${visiblePresentation.action.type}-${visiblePresentation.label}`}
				presentation={visiblePresentation}
				onAction={() => act(visiblePresentation.action)}
				waiting={waiting}
			/>}
		</div>
		<PositionRail position={position} onChange={jumpToPosition} />
		{debug && <DevTools state={state} dispatch={dispatch} variant={variant} />}
		{debug && <VariantSwitcher variant={variant} setVariant={setVariant} />}
	</main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<App />);
