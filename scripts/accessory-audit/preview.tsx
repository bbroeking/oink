import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";
import { PigStage, type EquippedItem } from "../../components/ui/PigStage";
import { PIG_ANIMATION_SPECS, pigAnchorAnimation, pigDrawnFacing, resolveFacingAnimation, type PigAnimation, type PigFacing } from "../../components/ui/pigRendererContract";
import { CATEGORY_ANCHORS, HAT_IMAGES, HAT_REL, resolveAnchor } from "../../constants/hats";
import type { AnchorName } from "../../constants/hat_overlay_types";
import { PIG_IDS, pigDefinition, type PigId } from "../../utils/pigs";
import PREVIEW_ITEM_CATEGORIES from "./previewCatalog.generated.json";
import "./preview.css";

type Slot = "hat" | "bow" | "glasses" | "mask" | "neck" | "held" | "aura";
const ITEM_CATEGORIES: Record<string, string | undefined> = PREVIEW_ITEM_CATEGORIES;
const NON_COSMETIC = new Set(["goblin_grunt", "goblin_scout", "goblin_brute", "goblin_warboss", "goblin_grunt_hit", "goblin_scout_hit", "goblin_brute_hit", "goblin_warboss_hit", "mud_splat", "mud_splat_gold"]);

function slotOf(id: string): Slot | null {
	const anchor = HAT_REL[id]?.anchor;
	const category = ITEM_CATEGORIES[id];
	if (category === "background" || category === "tickle_particle") return null;
	if (category && ["hat", "bow", "glasses", "mask", "held", "aura"].includes(category)) return category as Slot;
	if (category === "necklace" || category === "scarf") return "neck";
	if (anchor === "eyes" || anchor === "eye_l" || anchor === "eye_r") return "glasses";
	if (anchor === "neck") return id.includes("bow") ? "bow" : "neck";
	if (anchor === "hand_r" || anchor === "hand_l") return "held";
	if (anchor === "body") return "aura";
	return anchor ? "hat" : null;
}

const ITEMS = Object.keys(HAT_IMAGES).filter((id) => !NON_COSMETIC.has(id) && !id.startsWith("flag_") && slotOf(id) !== null).sort().map((id) => ({ id, slot: slotOf(id)! }));
const ANIMATIONS = Object.keys(PIG_ANIMATION_SPECS) as PigAnimation[];
const INITIAL_PARAMS = new URLSearchParams(window.location.search);
const initialPig = INITIAL_PARAMS.get("pig");
const initialItem = INITIAL_PARAMS.get("item");
const initialAnimation = INITIAL_PARAMS.get("animation");

function itemProps(item: { id: string; slot: Slot } | undefined) {
	if (!item) return {};
	const equipped: EquippedItem = { id: item.id, category: item.slot, emoji: null };
	return item.slot === "hat" ? { equipped } : item.slot === "bow" ? { equippedBow: equipped } : item.slot === "glasses" ? { equippedGlasses: equipped } : item.slot === "mask" ? { equippedMask: equipped } : item.slot === "neck" ? { equippedNeck: equipped } : item.slot === "held" ? { equippedHeld: equipped } : { equippedAura: equipped };
}
function stageProps(items: { id: string; slot: Slot }[]) { return Object.assign({}, ...items.map(itemProps)); }
const TRANSITIONS: readonly { animation: PigAnimation; facing?: PigFacing }[] = [{ animation: "idle" }, { animation: "jump" }, { animation: "idle" }, { animation: "wave" }, { animation: "idle", facing: "right" }, { animation: "sit", facing: "right" }, { animation: "idle" }];

function Preview() {
	const [pigId, setPigId] = useState<PigId>(PIG_IDS.includes(initialPig as PigId) ? initialPig as PigId : "rosie");
	const [animation, setAnimation] = useState<PigAnimation>(ANIMATIONS.includes(initialAnimation as PigAnimation) ? initialAnimation as PigAnimation : "idle");
	const [facing, setFacing] = useState<PigFacing | undefined>();
	const [itemId, setItemId] = useState(ITEMS.some((item) => item.id === initialItem) ? initialItem! : ITEMS.find((item) => item.slot === "hat")?.id ?? ITEMS[0]?.id);
	const [frame, setFrame] = useState(0);
	const [playing, setPlaying] = useState(true);
	const [transitionMode, setTransitionMode] = useState(false);
	const [transitionIndex, setTransitionIndex] = useState(0);
	const [loadout, setLoadout] = useState<"single" | "helpers">("single");
	const [displayedFrame, setDisplayedFrame] = useState(0);
	const [showAnchor, setShowAnchor] = useState(false);
	const item = ITEMS.find((candidate) => candidate.id === itemId);
	const helpers = useMemo(() => ["bow", "glasses", "held"].map((slot) => ITEMS.find((candidate) => candidate.slot === slot)).filter((candidate): candidate is (typeof ITEMS)[number] => !!candidate), []);
	const equipped = loadout === "helpers" ? stageProps([...helpers, ...(item ? [item] : [])]) : itemProps(item);
	const transitionPhase = transitionMode ? TRANSITIONS[transitionIndex] : undefined;
	const activeAnimation = transitionPhase?.animation ?? animation;
	const activeFacing = transitionMode ? transitionPhase?.facing : facing;
	const drawn = resolveFacingAnimation(activeAnimation, activeFacing);
	const frames = PIG_ANIMATION_SPECS[drawn]?.frames.length ?? 1;
	const safeFrame = frame % frames;
	const visibleFrame = playing ? displayedFrame : safeFrame;
	const itemCategory = item ? ITEM_CATEGORIES[item.id] : undefined;
	const anchorName = (HAT_REL[item?.id ?? ""]?.anchor ?? (itemCategory ? CATEGORY_ANCHORS[itemCategory] : undefined) ?? "head") as AnchorName;
	const rawAnchor = resolveAnchor(pigAnchorAnimation(drawn), visibleFrame, anchorName, pigId);
	const mirrored = activeFacing !== undefined && activeFacing !== pigDrawnFacing(drawn);
	const anchor = { x: mirrored ? 300 - rawAnchor.x : rawAnchor.x, y: rawAnchor.y };
	const advanceTransition = useCallback(() => setTransitionIndex((value) => (value + 1) % TRANSITIONS.length), []);

	useEffect(() => {
		if (!transitionMode || !playing) return;
		const phase = TRANSITIONS[transitionIndex];
		const spec = PIG_ANIMATION_SPECS[resolveFacingAnimation(phase.animation, phase.facing)];
		if (!spec.loop) return;
		const timer = window.setTimeout(advanceTransition, ((spec.playback?.length ?? spec.frames.length) / spec.fps) * 1000);
		return () => window.clearTimeout(timer);
	}, [advanceTransition, playing, transitionIndex, transitionMode]);

	return <main data-testid="accessory-audit">
		<header className="masthead"><div><p className="eyebrow">Tickle the Pig · visual QA</p><h1>Accessory attachment audit</h1></div><div className="source-pill"><span />Production PigStage</div></header>
		<section className="workspace">
			<div className="preview-card">
				<div className="card-heading"><div><p className="eyebrow">Live fitting room</p><h2>{item?.id.replaceAll("_", " ")}</h2></div><div className="heading-actions"><span className="frame-readout">{drawn} · {visibleFrame + 1}/{frames}</span>{item?.slot === "hat" && <a className="download-link" href={`./contact-sheets/${item.id}-${pigId}.jpg`} download>All 48 frames ↓</a>}</div></div>
				<section className="controls" aria-label="Preview controls">
					<label>Pig<select value={pigId} onChange={(e) => setPigId(e.target.value as PigId)} data-testid="pig-select">{PIG_IDS.map((id) => <option value={id} key={id}>{pigDefinition(id).name}</option>)}</select></label>
					<label>Animation<select value={animation} onChange={(e) => { setTransitionMode(false); setAnimation(e.target.value as PigAnimation); setFrame(0); }} data-testid="animation-select">{ANIMATIONS.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
					<label>Item<select value={itemId} onChange={(e) => setItemId(e.target.value)} data-testid="item-select">{ITEMS.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.id} · {candidate.slot}</option>)}</select></label>
					<label>Facing<select value={facing ?? "front"} onChange={(e) => setFacing(e.target.value === "front" ? undefined : e.target.value as PigFacing)} data-testid="facing-select"><option value="front">front</option><option value="left">left</option><option value="right">right</option></select></label>
					<button className="primary" onClick={() => { if (playing) setFrame(displayedFrame); setPlaying((value) => !value); }} data-testid="play-pause">{playing ? "Pause" : "Play"}</button>
					<button onClick={() => { setPlaying(false); setFrame((visibleFrame - 1 + frames) % frames); }} data-testid="previous-frame">Previous frame</button>
					<button onClick={() => { setPlaying(false); setFrame((visibleFrame + 1) % frames); }} data-testid="next-frame">Next frame</button>
					<button onClick={() => { setTransitionMode(false); setAnimation(activeAnimation); setFacing(activeFacing === "right" ? "left" : "right"); }} data-testid="mirror">Mirror</button>
					<button onClick={() => setLoadout((value) => value === "single" ? "helpers" : "single")} data-testid="loadout-helper">{loadout === "single" ? "Add bow + face + held" : "Selected item only"}</button>
					<button onClick={() => { if (!transitionMode) setPlaying(true); setTransitionMode((value) => !value); setTransitionIndex(0); }} data-testid="transition-mode">Transitions {transitionMode ? "on" : "off"}</button>
					<button className={showAnchor ? "active" : ""} onClick={() => setShowAnchor((value) => !value)} data-testid="anchor-marker">Anchor {showAnchor ? "on" : "off"}</button>
				</section>
				<section className="live" aria-label="Live preview"><div className="stage-shell"><View style={{ width: 300, height: 300 }} data-testid="live-stage"><PigStage pigId={pigId} pigAnimation={activeAnimation} facing={activeFacing} pigFrozen={!playing} pigFrameIdx={visibleFrame} onPigFrame={setDisplayedFrame} onPigComplete={transitionMode ? advanceTransition : undefined} renderer="raster" riveRolloutEnabled={false} {...equipped} /></View>{showAnchor && <span className="anchor" style={{ left: anchor.x, top: anchor.y }} title={`${anchorName} ${Math.round(anchor.x)}, ${Math.round(anchor.y)}`} />}</div><p className="caption">Normal game size · 300 px · {playing ? "native clock running" : "pinned source frame"}</p></section>
			</div>
			<aside className="rulings"><p className="eyebrow">Inspection rulings</p><h2>What to watch</h2>{[["01", "Head lock", "Crown and brim should travel with the skull, without lag or float."], ["02", "Tilt & shape", "Rotation and scale should agree with the head angle in each drawing."], ["03", "Layer order", "Ears, face items, bows, neckwear, and held props should overlap naturally."], ["04", "Loop seams", "Watch the last-to-first frame and automated transitions for sudden jumps."]].map(([number, title, copy]) => <div className="ruling" key={number}><b>{number}</b><div><h3>{title}</h3><p>{copy}</p></div></div>)}<p className="hand-note">Turn on the sage anchor marker when a slip is hard to distinguish from a changing silhouette.</p></aside>
		</section>
		<section className="frames-card" aria-label="Source frame contact sheet"><div className="section-heading"><div><p className="eyebrow">Frame by frame</p><h2>Every source frame</h2></div><p>Click any drawing to pause and inspect it at full size.</p></div><div className="contact-grid" data-testid="contact-grid">{Array.from({ length: frames }, (_, index) => <button className={`frame-tile ${!playing && safeFrame === index ? "selected" : ""}`} key={index} onClick={() => { setPlaying(false); setFrame(index); }}><span className="contact-stage"><span className="thumbnail-scale"><PigStage pigId={pigId} pigAnimation={activeAnimation} facing={activeFacing} pigFrozen pigFrameIdx={index} renderer="raster" riveRolloutEnabled={false} {...equipped} /></span></span><span className="frame-caption">Frame {String(index + 1).padStart(2, "0")}</span></button>)}</div></section>
		<footer><span>Renderer: raster production path</span><span>Assets: intrinsic PNG dimensions</span><span>Clock: production playback</span></footer>
	</main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<Preview />);
