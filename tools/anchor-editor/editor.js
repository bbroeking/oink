// Pig anchor editor — standalone tool for authoring PIG_FRAME_ANCHORS.
//
// Vanilla JS / Canvas. Open index.html directly in Chrome (file://) or
// run `npx serve` from /tools/anchor-editor.
//
// Workflow:
//   1. Open the editor — initial state is REST_ANCHORS + the current
//      PIG_FRAME_ANCHORS shifts baked in (sad: -7, wave: -40).
//   2. Pick a frame in the thumbnail grid → it loads in the focus view.
//   3. Drag anchor dots in the focus view, OR type coords on the right.
//   4. localStorage auto-saves every change.
//   5. Export → a TS-ready PIG_FRAME_ANCHORS literal you paste into
//      constants/hats.ts.

// ── Config ────────────────────────────────────────────────────
const ANIMATIONS = ["idle", "walk", "jump", "happy", "sad", "surprise", "wave"];
const FRAMES_PER_ANIM = 4;
const SPRITE_PATH = (anim, f) => `../../assets/images/sprites/rosie/${anim}_${f}.png`;
const CARD_SIZE = 300; // logical card-coord space
const FOCUS_SCALE = 2; // focus canvas renders sprite at 2× zoom = 600px
const STORAGE_KEY = "anchor-editor-v1";
const ITEMS_STORAGE_KEY = "anchor-editor-items-v1";

// Items mode — list of every known item id and where its PNG lives.
// Pulled from constants/hats.ts → HAT_IMAGES. Hardcoded here so the
// editor doesn't need a build step. If new items are added, append.
const ITEM_PATHS = {
	// Hats / accessories
	wizard: "hats/wizard.png", cowboy: "hats/cowboy.png", tophat: "hats/tophat.png",
	party: "hats/party.png", monocle: "hats/monocle.png", beanie: "hats/beanie.png",
	halo: "hats/halo.png", viking_helmet: "hats/viking_helmet.png",
	pirate_tricorn: "hats/pirate_tricorn.png", chef_toque: "hats/chef_toque.png",
	aviator_sunglasses: "hats/aviator_sunglasses.png",
	vr_headset: "hats/vr_headset.png", three_d_glasses: "hats/three_d_glasses.png",
	nerd_glasses: "hats/nerd_glasses.png", round_glasses: "hats/round_glasses.png",
	pink_bow: "hats/pink_bow.png", ribbon_bow: "hats/ribbon_bow.png",
	hair_bow: "hats/hair_bow.png", gift_bow: "hats/gift_bow.png",
	polka_bow: "hats/polka_bow.png", sleep_mask: "hats/sleep_mask.png",
	domino: "hats/domino.png", hero_mask: "hats/hero_mask.png",
	cat_mask: "hats/cat_mask.png", masquerade: "hats/masquerade.png",
	knit_scarf: "hats/knit_scarf.png", silk_scarf: "hats/silk_scarf.png",
	bandana_red: "hats/bandana_red.png", cape_scarf: "hats/cape_scarf.png",
	striped_scarf: "hats/striped_scarf.png", winter_scarf: "hats/winter_scarf.png",
	summer_kerchief: "hats/summer_kerchief.png", ascot: "hats/ascot.png",
	neckwarmer: "hats/neckwarmer.png", rainbow_scarf: "hats/rainbow_scarf.png",
	royal_cape: "hats/royal_cape.png", vampire_cape: "hats/vampire_cape.png",
	hero_cape: "hats/hero_cape.png", magician_cape: "hats/magician_cape.png",
	fur_cape: "hats/fur_cape.png", silk_cape: "hats/silk_cape.png",
	leather_cape: "hats/leather_cape.png", short_cape: "hats/short_cape.png",
	ermine_cape: "hats/ermine_cape.png", star_cape: "hats/star_cape.png",
	magic_wand: "hats/magic_wand.png", toy_sword: "hats/toy_sword.png",
	controller: "hats/controller.png", pearl_necklace: "hats/pearl_necklace.png",
	gold_chain: "hats/gold_chain.png", locket: "hats/locket.png",
	bone_necklace: "hats/bone_necklace.png", charm_necklace: "hats/charm_necklace.png",
	diamond_pendant: "hats/diamond_pendant.png",
	emerald_pendant: "hats/emerald_pendant.png", choker: "hats/choker.png",
	bell_collar: "hats/bell_collar.png", ribbon_choker: "hats/ribbon_choker.png",
	pencil: "hats/pencil.png", magnifier: "hats/magnifier.png",
	balloon: "hats/balloon.png", flowers: "hats/flowers.png",
	ice_cream: "hats/ice_cream.png", pizza_slice: "hats/pizza_slice.png",
	coffee_mug: "hats/coffee_mug.png", black_bow_tie: "hats/black_bow_tie.png",
	archery_bow: "hats/archery_bow.png", silk_bow: "hats/silk_bow.png",
	velvet_bow: "hats/velvet_bow.png", rainbow_bow: "hats/rainbow_bow.png",
	robber_mask: "hats/robber_mask.png", gas_mask: "hats/gas_mask.png",
	carnival_mask: "hats/carnival_mask.png", venice_mask: "hats/venice_mask.png",
	skull_mask: "hats/skull_mask.png", swim_goggles: "hats/swim_goggles.png",
	heart_sunglasses: "hats/heart_sunglasses.png",
	pixel_glasses: "hats/pixel_glasses.png", pink_glow: "hats/pink_glow.png",
	gold_aura: "hats/gold_aura.png", rainbow_aura: "hats/rainbow_aura.png",
	fire_aura: "hats/fire_aura.png", ice_aura: "hats/ice_aura.png",
	electric_aura: "hats/electric_aura.png", shadow_aura: "hats/shadow_aura.png",
	holy_aura: "hats/holy_aura.png", sparkle_aura: "hats/sparkle_aura.png",
	petal_aura: "hats/petal_aura.png", crown: "hats/crown.png",
	safety_goggles: "hats/safety_goggles.png",
	// Backgrounds
	homestead_barn: "backgrounds/homestead_barn.jpg",
	sunset_farm: "backgrounds/sunset_farm.png",
	snowy_farm: "backgrounds/snowy_farm.png",
	beach_island: "backgrounds/beach_island.png",
	space_station: "backgrounds/space_station.png",
	candyland: "backgrounds/candyland.png",
	forest_grove: "backgrounds/forest_grove.png",
	jungle: "backgrounds/jungle.png",
	underwater: "backgrounds/underwater.png",
	desert_dunes: "backgrounds/desert_dunes.png",
	mountain_top: "backgrounds/mountain_top.png",
};

const ITEM_PATH = (id) => `../../assets/images/${ITEM_PATHS[id]}`;

const DEFAULT_ITEM_OVERLAY = { bottom: 200, left: 100, width: 100, height: 100 };

// In-app rendering ratio: sprite source is 351×257, rendered into the
// 300×300 card via resizeMode=contain → the pig occupies the middle
// 300×220 band. Markers show this band so the editor matches what the
// user actually sees in the app at any screen size.
const SPRITE_NATIVE_W = 351;
const SPRITE_NATIVE_H = 257;
function spriteBand() {
	const scale = Math.min(CARD_SIZE / SPRITE_NATIVE_W, CARD_SIZE / SPRITE_NATIVE_H);
	const renderedH = SPRITE_NATIVE_H * scale; // ~220
	const renderedW = SPRITE_NATIVE_W * scale; // ~300
	const top = (CARD_SIZE - renderedH) / 2;    // ~40
	const left = (CARD_SIZE - renderedW) / 2;   // 0
	return { top, left, width: renderedW, height: renderedH };
}

// Per-animation playback FPS. Mirrors the SpritePig ANIMATIONS table so
// the editor preview cycles at the same rate as the live app.
const ANIM_FPS = {
	idle: 2.5,
	walk: 4,
	jump: 6,
	happy: 4,
	sad: 3,
	surprise: 6,
	wave: 4,
};

// Physical anchors — drawn as draggable dots in the editor and stored
// per (anim, frame). `eyes` / `feet` are NOT in this list: they're
// virtual midpoints derived from eye_l/eye_r and leg_l/leg_r at render
// time. Same model as constants/hats.ts.
const ANCHOR_NAMES = [
	"head",
	"eye_l",
	"eye_r",
	"snout",
	"mouth",
	"neck",
	"body",
	"hand_l",
	"hand_r",
	"leg_l",
	"leg_r",
];

const ANCHOR_COLORS = {
	head: "#FF3B30",
	eye_l: "#FF9500",
	eye_r: "#FFB04A",
	snout: "#FFCC00",
	mouth: "#34C759",
	neck: "#5AC8FA",
	body: "#007AFF",
	hand_l: "#AF52DE",
	hand_r: "#FF2D92",
	leg_l: "#8E8E93",
	leg_r: "#BBBBBB",
};

// REST = canonical idle frame 0 anatomy. Keep in sync with
// constants/hats.ts → REST_ANCHORS so the editor's diffs match what
// the runtime expects.
const REST_ANCHORS = {
	head: { x: 162, y: 34 },
	eye_l: { x: 131, y: 108 },
	eye_r: { x: 222, y: 108 },
	snout: { x: 185, y: 136 },
	mouth: { x: 181, y: 170 },
	neck: { x: 170, y: 220 },
	body: { x: 157, y: 235 },
	hand_l: { x: 133, y: 280 },
	hand_r: { x: 235, y: 266 },
	leg_l: { x: 27, y: 266 },
	leg_r: { x: 75, y: 235 },
};

// Seed shifts that match the current PIG_FRAME_ANCHORS shortcuts. The
// editor expands these to full per-anchor positions so users can
// override any individual anchor independently.
const SEED_SHIFTS = {
	sad: -7,
	wave: -40,
};

// ── State ─────────────────────────────────────────────────────
// `anchors[anim][frame][anchorName] = { x, y }` — the source of truth.
let anchors = loadState() ?? seedState();

// `itemPlacements[id] = { base: {bottom, left, width, height}, perAnim:
// { [anim]: Partial<{bottom, left, width, height}> | null } }`.
// base defines the default overlay; perAnim entries override per anim.
let itemPlacements = loadItemPlacements();

let focus = { anim: "sad", frame: 0 };
let mode = "anchors"; // "anchors" | "items"
let selectedAnchor = null;
let dragging = null; // anchor mode: { anchor }; item mode: { kind, offsetX, offsetY }
let currentItemId = null;
let previewAccessories = false; // anchor-mode toggle: render every item at computed pos
let playing = false;
let playTimer = null;

// Loaded sprite Image objects. img[`anim_frame`] = HTMLImageElement.
const spriteImgs = {};
const spriteReady = {};

// Loaded item PNG Image objects. itemImgs[id] = HTMLImageElement.
const itemImgs = {};
const itemReady = {};

// Thumbnail canvases by frame key.
const thumbCtx = {};

// ── Init ──────────────────────────────────────────────────────
function init() {
	preloadSprites().then(() => {
		buildAnchorPanel();
		buildThumbnails();
		buildItemDatalist();
		buildItemPicker();
		bindGlobalEvents();
		render();
	});
	// Preload every accessory in the background — non-blocking so the
	// editor is usable immediately. Each image triggers a re-render
	// of the picker cell + canvas as it lands.
	preloadAllItems();
}

function preloadAllItems() {
	for (const id of Object.keys(ITEM_PATHS)) {
		ensureItemImg(id);
	}
}

function ensureItemImg(id) {
	if (!ITEM_PATHS[id]) return null;
	if (itemImgs[id]) return itemImgs[id];
	const img = new Image();
	itemImgs[id] = img;
	itemReady[id] = false;
	img.onload = () => {
		itemReady[id] = true;
		// Tell the picker cell to repaint (it shows the same img).
		const cell = document.querySelector(`.itemPickerCell[data-id="${id}"] img`);
		if (cell) cell.src = img.src;
		// And the canvas if this is the current item.
		if (id === currentItemId) {
			renderFocus();
			renderThumbnails();
		}
	};
	img.onerror = () => {
		console.warn("Item image missing:", id);
		itemReady[id] = false;
	};
	img.src = ITEM_PATH(id);
	return img;
}

function buildItemDatalist() {
	const dl = document.getElementById("itemIdList");
	dl.innerHTML = "";
	for (const id of Object.keys(ITEM_PATHS).sort()) {
		const o = document.createElement("option");
		o.value = id;
		dl.appendChild(o);
	}
}

// Big fullscreen "Browse all accessories" modal. Larger thumbnails
// grouped by category, with a search field that filters live. Click
// any item → loads it and dismisses the modal. Much faster than
// hunting through the narrow sidebar.
function buildItemBrowser() {
	const grid = document.getElementById("browserGrid");
	grid.innerHTML = "";
	// Group items by category. Items with no known category fall into
	// "other" so they're still findable.
	const byCategory = {};
	for (const id of Object.keys(ITEM_PATHS)) {
		const cat =
			(typeof ITEM_CATEGORY !== "undefined" ? ITEM_CATEGORY[id] : null) ??
			"other";
		(byCategory[cat] = byCategory[cat] ?? []).push(id);
	}
	// Stable category order — common categories first, then alpha.
	const CATEGORY_ORDER = [
		"hat", "bow", "glasses", "mask", "scarf",
		"necklace", "cape", "held", "aura", "background", "other",
	];
	const cats = Object.keys(byCategory).sort((a, b) => {
		const ai = CATEGORY_ORDER.indexOf(a);
		const bi = CATEGORY_ORDER.indexOf(b);
		return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
	});
	for (const cat of cats) {
		const section = document.createElement("div");
		section.className = "browserCategory";
		section.dataset.category = cat;
		const header = document.createElement("h4");
		header.className = "browserCategoryHeader";
		header.textContent = `${cat} · ${byCategory[cat].length}`;
		section.appendChild(header);
		const subgrid = document.createElement("div");
		subgrid.className = "browserCategoryGrid";
		for (const id of byCategory[cat].sort()) {
			const cell = document.createElement("div");
			cell.className = "browserCell";
			cell.dataset.id = id;
			cell.title = id;
			cell.innerHTML = `
				<img alt="${id}" src="${ITEM_PATH(id)}" loading="lazy"/>
				<span class="label">${id}</span>
			`;
			cell.addEventListener("click", () => {
				document.getElementById("itemIdInput").value = id;
				loadItem(id);
				closeItemBrowser();
			});
			subgrid.appendChild(cell);
		}
		section.appendChild(subgrid);
		grid.appendChild(section);
	}
}

function openItemBrowser() {
	const modal = document.getElementById("browserModal");
	// Lazy-build on first open so we don't pay the DOM cost upfront.
	if (!document.getElementById("browserGrid").children.length) {
		buildItemBrowser();
	}
	// Re-highlight the currently-loaded item.
	document.querySelectorAll(".browserCell").forEach((c) => {
		c.classList.toggle("active", c.dataset.id === currentItemId);
	});
	const search = document.getElementById("browserSearch");
	search.value = "";
	filterItemBrowser("");
	modal.showModal();
	// Focus search so typing immediately filters.
	setTimeout(() => search.focus(), 0);
}

function closeItemBrowser() {
	document.getElementById("browserModal").close();
}

function filterItemBrowser(query) {
	const q = query.toLowerCase().trim();
	for (const section of document.querySelectorAll(".browserCategory")) {
		let visible = 0;
		for (const cell of section.querySelectorAll(".browserCell")) {
			const id = cell.dataset.id;
			const show = !q || id.includes(q);
			cell.style.display = show ? "" : "none";
			if (show) visible++;
		}
		section.style.display = visible > 0 ? "" : "none";
	}
}

function buildItemPicker() {
	const grid = document.getElementById("itemPickerGrid");
	grid.innerHTML = "";
	// Group by category. Items without a known category fall under "other".
	const byCategory = {};
	for (const id of Object.keys(ITEM_PATHS)) {
		const cat =
			(typeof ITEM_CATEGORY !== "undefined" ? ITEM_CATEGORY[id] : null) ??
			"other";
		(byCategory[cat] = byCategory[cat] ?? []).push(id);
	}
	const CATEGORY_ORDER = [
		"hat", "bow", "glasses", "mask", "scarf",
		"necklace", "cape", "held", "aura", "background", "other",
	];
	const cats = Object.keys(byCategory).sort((a, b) => {
		const ai = CATEGORY_ORDER.indexOf(a);
		const bi = CATEGORY_ORDER.indexOf(b);
		return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
	});
	for (const cat of cats) {
		const header = document.createElement("div");
		header.className = "itemPickerCategoryHeader";
		header.dataset.category = cat;
		header.textContent = `${cat} · ${byCategory[cat].length}`;
		grid.appendChild(header);
		for (const id of byCategory[cat].sort()) {
			const cell = document.createElement("div");
			cell.className = "itemPickerCell";
			cell.dataset.id = id;
			cell.dataset.category = cat;
			cell.title = id;
			cell.innerHTML = `
				<img alt="${id}" src="${ITEM_PATH(id)}" loading="lazy"/>
				<span class="label">${id}</span>
			`;
			cell.addEventListener("click", () => {
				document.getElementById("itemIdInput").value = id;
				loadItem(id);
			});
			grid.appendChild(cell);
		}
	}
}

function filterItemPicker(query) {
	const q = query.toLowerCase().trim();
	// Track which categories still have visible cells; hide their
	// headers when empty so the sidebar doesn't show dangling labels.
	const visibleByCat = {};
	for (const cell of document.querySelectorAll(".itemPickerCell")) {
		const id = cell.dataset.id;
		const show = !q || id.includes(q);
		cell.style.display = show ? "" : "none";
		if (show) {
			visibleByCat[cell.dataset.category] =
				(visibleByCat[cell.dataset.category] ?? 0) + 1;
		}
	}
	for (const header of document.querySelectorAll(".itemPickerCategoryHeader")) {
		header.style.display = visibleByCat[header.dataset.category] ? "" : "none";
	}
}

function loadItem(id) {
	if (!ITEM_PATHS[id]) {
		alert(`Unknown item id: ${id}\n\nKnown ids include: ${
			Object.keys(ITEM_PATHS).slice(0, 5).join(", ")}, ...`);
		return;
	}
	currentItemId = id;
	if (!itemPlacements[id]) {
		itemPlacements[id] = {
			base: { ...DEFAULT_ITEM_OVERLAY },
			perAnim: {},
		};
		saveItemPlacements();
	}
	ensureItemImg(id);
	// Highlight the active picker cell.
	document.querySelectorAll(".itemPickerCell").forEach((c) => {
		c.classList.toggle("active", c.dataset.id === id);
	});
	render();
}

function preloadSprites() {
	const promises = [];
	for (const anim of ANIMATIONS) {
		for (let f = 1; f <= FRAMES_PER_ANIM; f++) {
			const key = `${anim}_${f}`;
			const img = new Image();
			spriteImgs[key] = img;
			spriteReady[key] = false;
			promises.push(
				new Promise((resolve) => {
					img.onload = () => {
						spriteReady[key] = true;
						resolve();
					};
					img.onerror = () => {
						console.warn("Sprite missing:", key);
						resolve(); // don't block init on a missing frame
					};
					img.src = SPRITE_PATH(anim, f);
				})
			);
		}
	}
	return Promise.all(promises);
}

function seedState() {
	// Build initial PIG_FRAME_ANCHORS state. Every (anim, frame) gets
	// a full anchor map. Animations with a SEED_SHIFT have y-shifted
	// from REST; everything else starts at REST.
	const out = {};
	for (const anim of ANIMATIONS) {
		const dy = SEED_SHIFTS[anim] ?? 0;
		out[anim] = [];
		for (let f = 0; f < FRAMES_PER_ANIM; f++) {
			const frame = {};
			for (const name of ANCHOR_NAMES) {
				frame[name] = {
					x: REST_ANCHORS[name].x,
					y: REST_ANCHORS[name].y + dy,
				};
			}
			out[anim].push(frame);
		}
	}
	return out;
}

function loadState() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return migrateState(parsed);
	} catch {
		return null;
	}
}

// Migrate older localStorage state that had `eyes` and `feet` as
// stored anchors. Expand each into the new eye_l/eye_r and
// leg_l/leg_r pair, preserving any offset the user had applied (the
// expanded pair sits ±82 / ±30 around the old eyes/feet point).
function migrateState(state) {
	if (!state || typeof state !== "object") return state;
	const EYE_HALF_SPREAD = 82;
	const LEG_HALF_SPREAD = 30;
	for (const anim of ANIMATIONS) {
		const frames = state[anim];
		if (!Array.isArray(frames)) continue;
		for (let f = 0; f < frames.length; f++) {
			const frame = frames[f] ?? {};
			if (frame.eyes && (!frame.eye_l || !frame.eye_r)) {
				frame.eye_l = frame.eye_l ?? {
					x: frame.eyes.x - EYE_HALF_SPREAD,
					y: frame.eyes.y,
				};
				frame.eye_r = frame.eye_r ?? {
					x: frame.eyes.x + EYE_HALF_SPREAD,
					y: frame.eyes.y,
				};
				delete frame.eyes;
			}
			if (frame.feet && (!frame.leg_l || !frame.leg_r)) {
				frame.leg_l = frame.leg_l ?? {
					x: frame.feet.x - LEG_HALF_SPREAD,
					y: frame.feet.y,
				};
				frame.leg_r = frame.leg_r ?? {
					x: frame.feet.x + LEG_HALF_SPREAD,
					y: frame.feet.y,
				};
				delete frame.feet;
			}
			// Backfill missing L/R anchors from REST so the editor never
			// crashes on a half-migrated state.
			for (const name of ANCHOR_NAMES) {
				if (!frame[name]) {
					frame[name] = { ...REST_ANCHORS[name] };
				}
			}
			frames[f] = frame;
		}
	}
	return state;
}

function saveState() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(anchors));
	} catch {}
}

function loadItemPlacements() {
	try {
		const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
		if (!raw) return {};
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function saveItemPlacements() {
	try {
		localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(itemPlacements));
	} catch {}
}

// Returns the merged overlay {bottom, left, width, height} for the current
// item at the currently-focused animation. perAnim values override base.
function effectiveOverlay() {
	if (!currentItemId) return null;
	const rec = itemPlacements[currentItemId];
	if (!rec) return null;
	const per = rec.perAnim?.[focus.anim] ?? null;
	return { ...rec.base, ...(per ?? {}) };
}

// Editing scope:
//  - idle anim → writes to base (applies to all anims by default)
//  - other anims → writes to perAnim[anim] (creates the override on first edit)
// This matches the workflow: tune base in idle, then visit a problem anim
// and the drag automatically becomes a perAnim override.
function isEditingPerAnim() {
	return focus.anim !== "idle";
}

function setItemField(field, value) {
	if (!currentItemId) return;
	const rec = itemPlacements[currentItemId];
	if (isEditingPerAnim()) {
		rec.perAnim[focus.anim] = {
			...(rec.perAnim[focus.anim] ?? {}),
			[field]: value,
		};
	} else {
		rec.base = { ...rec.base, [field]: value };
	}
	saveItemPlacements();
}

// ── Anchor panel (right side) ─────────────────────────────────
function buildAnchorPanel() {
	const ul = document.getElementById("anchorList");
	ul.innerHTML = "";
	for (const name of ANCHOR_NAMES) {
		const li = document.createElement("li");
		li.className = "anchorRow";
		li.dataset.anchor = name;
		li.innerHTML = `
			<span class="dot" style="background:${ANCHOR_COLORS[name]}"></span>
			<span class="name">${name}</span>
			<input type="number" class="xIn" data-axis="x" min="0" max="${CARD_SIZE}" step="1"/>
			<input type="number" class="yIn" data-axis="y" min="0" max="${CARD_SIZE}" step="1"/>
		`;
		ul.appendChild(li);
		li.addEventListener("click", (e) => {
			if ((e.target).tagName === "INPUT") return;
			selectedAnchor = name;
			renderAnchorPanel();
			renderFocus();
		});
		li.querySelector(".xIn").addEventListener("change", (e) => {
			const v = clampInt(e.target.value, 0, CARD_SIZE);
			currentFrame()[name].x = v;
			selectedAnchor = name;
			saveAndRender();
		});
		li.querySelector(".yIn").addEventListener("change", (e) => {
			const v = clampInt(e.target.value, 0, CARD_SIZE);
			currentFrame()[name].y = v;
			selectedAnchor = name;
			saveAndRender();
		});
	}
	renderAnchorPanel();
}

function renderAnchorPanel() {
	const frame = currentFrame();
	for (const name of ANCHOR_NAMES) {
		const row = document.querySelector(`.anchorRow[data-anchor="${name}"]`);
		const pos = frame[name];
		row.classList.toggle("selected", name === selectedAnchor);
		row.querySelector(".xIn").value = pos.x;
		row.querySelector(".yIn").value = pos.y;
	}
}

// ── Thumbnails ─────────────────────────────────────────────────
function buildThumbnails() {
	const grid = document.getElementById("thumbsGrid");
	grid.innerHTML = "";
	for (const anim of ANIMATIONS) {
		const row = document.createElement("div");
		row.className = "animRow";
		row.innerHTML = `<span class="animLabel">${anim}</span>`;
		for (let f = 0; f < FRAMES_PER_ANIM; f++) {
			const thumb = document.createElement("div");
			thumb.className = "thumb";
			thumb.dataset.anim = anim;
			thumb.dataset.frame = f;
			thumb.innerHTML = `
				<canvas width="120" height="120"></canvas>
				<span class="label">${f + 1}</span>
			`;
			row.appendChild(thumb);
			const canvas = thumb.querySelector("canvas");
			thumbCtx[`${anim}_${f}`] = canvas.getContext("2d");
			bindThumbDrag(canvas, anim, f);
		}
		grid.appendChild(row);
	}
}

// Drag handler on each thumbnail. Lets you reposition anchors at the
// thumb scale without first clicking to focus — the focus view also
// promotes to the dragged-in thumb so you see your work in detail.
function bindThumbDrag(canvas, anim, f) {
	const THUMB_W = 120;
	const scale = THUMB_W / CARD_SIZE;
	let local = null; // { anchor }

	const hit = (x, y) => {
		const frame = anchors[anim][f];
		let best = null;
		let bestDist = 12; // generous hit radius in display px
		for (const name of ANCHOR_NAMES) {
			const p = frame[name];
			const dx = x - p.x * scale;
			const dy = y - p.y * scale;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < bestDist) {
				best = name;
				bestDist = dist;
			}
		}
		return best;
	};

	const toCanvas = (e) => {
		const r = canvas.getBoundingClientRect();
		return {
			x: ((e.clientX - r.left) * canvas.width) / r.width,
			y: ((e.clientY - r.top) * canvas.height) / r.height,
		};
	};

	canvas.addEventListener("mousedown", (e) => {
		stopPlay(); // any user click halts the animation loop
		const { x, y } = toCanvas(e);
		// Always promote this thumb to focus — single click = focus.
		focus = { anim, frame: f };
		if (mode === "items") {
			// Don't drag from thumbnails in items mode — just focus.
			selectedAnchor = null;
			render();
			e.preventDefault();
			return;
		}
		const a = hit(x, y);
		if (a) {
			local = { anchor: a };
			selectedAnchor = a;
		} else {
			selectedAnchor = null;
		}
		render();
		e.preventDefault();
	});

	canvas.addEventListener("mousemove", (e) => {
		if (!local) return;
		if (mode !== "anchors") return;
		const { x, y } = toCanvas(e);
		const lx = clampInt(Math.round(x / scale), 0, CARD_SIZE);
		const ly = clampInt(Math.round(y / scale), 0, CARD_SIZE);
		anchors[anim][f][local.anchor] = { x: lx, y: ly };
		renderThumb(anim, f);
		// Mirror live in focus + panel if this thumb is the focus.
		if (focus.anim === anim && focus.frame === f) {
			renderFocus();
			renderAnchorPanel();
		}
	});

	canvas.addEventListener("mouseup", () => {
		if (local) {
			saveState();
			local = null;
		}
	});
	canvas.addEventListener("mouseleave", () => {
		if (local) {
			saveState();
			local = null;
		}
	});
}

function renderThumbnails() {
	for (const anim of ANIMATIONS) {
		for (let f = 0; f < FRAMES_PER_ANIM; f++) {
			renderThumb(anim, f);
		}
	}
	// Active outline
	document.querySelectorAll(".thumb").forEach((t) => {
		const active =
			t.dataset.anim === focus.anim &&
			Number(t.dataset.frame) === focus.frame;
		t.classList.toggle("active", active);
	});
}

function renderThumb(anim, f) {
	const ctx = thumbCtx[`${anim}_${f}`];
	if (!ctx) return;
	const W = 120;
	ctx.clearRect(0, 0, W, W);
	const img = spriteImgs[`${anim}_${f + 1}`];
	if (img && spriteReady[`${anim}_${f + 1}`]) {
		drawSpriteFit(ctx, img, 0, 0, W, W);
	}
	const scale = W / CARD_SIZE;
	if (mode === "items" && currentItemId) {
		// Draw item at THIS anim's effective overlay.
		const rec = itemPlacements[currentItemId];
		if (rec) {
			const per = rec.perAnim?.[anim] ?? null;
			const ov = { ...rec.base, ...(per ?? {}) };
			const isPerAnim = !!per;
			drawItem(ctx, ov, scale, {
				alpha: 0.95,
				showBox: focus.anim === anim,
				boxColor: isPerAnim ? "rgba(255,149,0,0.95)" : "rgba(123,95,255,0.9)",
			});
		}
	} else {
		if (previewAccessories) {
			drawAllAccessories(ctx, anim, f, scale);
		}
		// Anchor dots at thumb scale
		const frame = anchors[anim][f];
		for (const name of ANCHOR_NAMES) {
			const p = frame[name];
			ctx.fillStyle = ANCHOR_COLORS[name];
			ctx.beginPath();
			ctx.arc(p.x * scale, p.y * scale, 2.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

// ── Focus canvas ───────────────────────────────────────────────
function renderFocus() {
	const canvas = document.getElementById("focusCanvas");
	const ctx = canvas.getContext("2d");
	const SIZE = CARD_SIZE * FOCUS_SCALE;
	canvas.width = SIZE;
	canvas.height = SIZE;
	ctx.clearRect(0, 0, SIZE, SIZE);

	// Crosshair grid (every 10 logical px = 20 display px)
	ctx.strokeStyle = "rgba(0,0,0,0.06)";
	ctx.lineWidth = 1;
	for (let i = 10; i < CARD_SIZE; i += 10) {
		ctx.beginPath();
		ctx.moveTo(i * FOCUS_SCALE, 0);
		ctx.lineTo(i * FOCUS_SCALE, SIZE);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, i * FOCUS_SCALE);
		ctx.lineTo(SIZE, i * FOCUS_SCALE);
		ctx.stroke();
	}

	// In-app rendering band: the middle 300×220 area where the sprite
	// actually renders inside the 300×300 card. Shade outside the band
	// and outline it so the user sees the live ratio.
	const band = spriteBand();
	const bandTopPx = band.top * FOCUS_SCALE;
	const bandBottomPx = (band.top + band.height) * FOCUS_SCALE;
	ctx.fillStyle = "rgba(0,0,0,0.045)";
	if (band.top > 0) ctx.fillRect(0, 0, SIZE, bandTopPx);
	if (band.top + band.height < CARD_SIZE) {
		ctx.fillRect(0, bandBottomPx, SIZE, SIZE - bandBottomPx);
	}
	ctx.strokeStyle = "rgba(123,95,255,0.35)";
	ctx.lineWidth = 1;
	ctx.setLineDash([4, 4]);
	ctx.strokeRect(
		band.left * FOCUS_SCALE,
		bandTopPx,
		band.width * FOCUS_SCALE,
		band.height * FOCUS_SCALE
	);
	ctx.setLineDash([]);
	// Centerline
	ctx.strokeStyle = "rgba(123,95,255,0.4)";
	ctx.beginPath();
	ctx.moveTo(150 * FOCUS_SCALE, 0);
	ctx.lineTo(150 * FOCUS_SCALE, SIZE);
	ctx.stroke();

	// Sprite at 2× zoom, contain-fit to CARD_SIZE
	const img = spriteImgs[`${focus.anim}_${focus.frame + 1}`];
	if (img && spriteReady[`${focus.anim}_${focus.frame + 1}`]) {
		drawSpriteFit(ctx, img, 0, 0, SIZE, SIZE);
	}

	if (mode === "items") {
		const ov = effectiveOverlay();
		drawItem(ctx, ov, FOCUS_SCALE, {
			showBox: true,
			boxColor: isEditingPerAnim() ? "rgba(255,149,0,0.95)" : "rgba(123,95,255,0.9)",
		});
	} else {
		if (previewAccessories) {
			drawAllAccessories(ctx, focus.anim, focus.frame, FOCUS_SCALE);
		}
		// Anchor dots — 8px display radius
		const frame = currentFrame();
		for (const name of ANCHOR_NAMES) {
			const p = frame[name];
			const dx = p.x * FOCUS_SCALE;
			const dy = p.y * FOCUS_SCALE;
			ctx.fillStyle = ANCHOR_COLORS[name];
			ctx.strokeStyle = name === selectedAnchor ? "white" : "rgba(255,255,255,0.85)";
			ctx.lineWidth = name === selectedAnchor ? 3 : 2;
			ctx.beginPath();
			ctx.arc(dx, dy, name === selectedAnchor ? 9 : 7, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			// Label
			ctx.fillStyle = "rgba(0,0,0,0.7)";
			ctx.font = "10px monospace";
			ctx.fillText(name, dx + 12, dy + 4);
		}
	}

	document.getElementById("focusLabel").textContent =
		`${focus.anim.toUpperCase()} · frame ${focus.frame + 1}`;
}

// Draws the currently-loaded item onto the given canvas context. The
// item rect uses HatOverlay semantics: `bottom` is from BOTTOM of the
// 300×300 card; `left` is from LEFT. Scales `scale` maps card-coord →
// canvas px.
function drawItem(ctx, ov, scale, opts = {}) {
	if (!currentItemId || !ov) return;
	const x = ov.left * scale;
	const y = (CARD_SIZE - ov.bottom - ov.height) * scale;
	const w = ov.width * scale;
	const h = ov.height * scale;
	const img = itemImgs[currentItemId];
	if (img && itemReady[currentItemId]) {
		ctx.save();
		ctx.globalAlpha = opts.alpha ?? 1;
		ctx.drawImage(img, x, y, w, h);
		ctx.restore();
	}
	if (opts.showBox) {
		ctx.strokeStyle = opts.boxColor ?? "rgba(123,95,255,0.9)";
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.strokeRect(x, y, w, h);
		ctx.setLineDash([]);
		ctx.fillStyle = opts.boxColor ?? "rgba(123,95,255,0.9)";
		ctx.fillRect(x + w - 6, y + h - 6, 12, 12);
	}
}

// Mirror constants/hats.ts: resolve `eyes`/`feet` as the midpoint of
// their L/R pair so items targeting the symmetric anchor follow both
// sides correctly when the underlying L/R drift apart per pose.
function restAnchorPos(name) {
	if (name === "eyes") {
		return {
			x: (REST_ANCHORS.eye_l.x + REST_ANCHORS.eye_r.x) / 2,
			y: (REST_ANCHORS.eye_l.y + REST_ANCHORS.eye_r.y) / 2,
		};
	}
	if (name === "feet") {
		return {
			x: (REST_ANCHORS.leg_l.x + REST_ANCHORS.leg_r.x) / 2,
			y: (REST_ANCHORS.leg_l.y + REST_ANCHORS.leg_r.y) / 2,
		};
	}
	return REST_ANCHORS[name] ?? { x: 150, y: 150 };
}

function framePosFor(anim, frame, name) {
	if (name === "eyes") {
		const l = framePosFor(anim, frame, "eye_l");
		const r = framePosFor(anim, frame, "eye_r");
		return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
	}
	if (name === "feet") {
		const l = framePosFor(anim, frame, "leg_l");
		const r = framePosFor(anim, frame, "leg_r");
		return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
	}
	return anchors[anim]?.[frame]?.[name] ?? REST_ANCHORS[name];
}

// Compute the on-card overlay rect for an item at the given (anim, frame),
// applying anchor delta + category shift. Mirrors the SwipeElement render
// logic from constants/hats.ts so the preview matches the live app.
function computeItemOverlay(itemId, anim, frame) {
	const category = ITEM_CATEGORY?.[itemId] ?? null;
	// Per-item HAT_OVERLAYS wins; category default fills in the rest.
	// Mirrors the SwipeElement lookup chain.
	const itemOv = HAT_OVERLAYS_DATA?.[itemId] ?? null;
	const categoryOv =
		(typeof CATEGORY_OVERLAYS_DATA !== "undefined" && category
			? CATEGORY_OVERLAYS_DATA[category]
			: null);
	const base = { ...(categoryOv ?? {}), ...(itemOv ?? {}) };
	if (base.bottom === undefined || base.left === undefined) return null;
	if (category && Z_BEHIND_PIG?.[category] && category === "background") {
		return null; // full-canvas — obscures everything
	}
	if (category === "aura") return null; // full-canvas
	// Anchor priority: per-item override → category default.
	const anchorName =
		base.anchor ??
		(typeof ITEM_ANCHOR_OVERRIDE !== "undefined" && ITEM_ANCHOR_OVERRIDE[itemId]) ??
		CATEGORY_ANCHORS?.[category] ??
		"head";
	const restPos = restAnchorPos(anchorName);
	const framePos = framePosFor(anim, frame, anchorName);
	const delta = {
		dx: framePos.x - restPos.x,
		dy: framePos.y - restPos.y,
	};
	const catShift = CATEGORY_PERANIM_SHIFTS?.[category]?.[anim] ?? null;
	return {
		bottom: base.bottom - delta.dy - (catShift?.dy ?? 0),
		left: base.left + delta.dx + (catShift?.dx ?? 0),
		width: base.width,
		height: base.height,
		category,
	};
}

// Render every accessory at its computed position on the given canvas
// context. Used by both the focus canvas and each thumbnail when the
// preview toggle is on. Items are drawn at low opacity so they don't
// fully obscure each other (95 items overlap heavily).
function drawAllAccessories(ctx, anim, frame, scale) {
	if (typeof HAT_OVERLAYS_DATA === "undefined") return;
	for (const id of Object.keys(ITEM_PATHS)) {
		const ov = computeItemOverlay(id, anim, frame);
		if (!ov) continue;
		const img = itemImgs[id];
		if (!img || !itemReady[id]) {
			// Trigger load if not already; render later when ready.
			ensureItemImg(id);
			continue;
		}
		const x = ov.left * scale;
		const y = (CARD_SIZE - ov.bottom - ov.height) * scale;
		const w = ov.width * scale;
		const h = ov.height * scale;
		ctx.save();
		ctx.globalAlpha = 0.45;
		ctx.drawImage(img, x, y, w, h);
		ctx.restore();
	}
}

function drawSpriteFit(ctx, img, x, y, w, h) {
	// resizeMode: contain — fit the longer side, letterbox the rest.
	const scale = Math.min(w / img.width, h / img.height);
	const drawW = img.width * scale;
	const drawH = img.height * scale;
	const dx = x + (w - drawW) / 2;
	const dy = y + (h - drawH) / 2;
	ctx.drawImage(img, dx, dy, drawW, drawH);
}

// ── Mouse drag on focus canvas ─────────────────────────────────
function bindGlobalEvents() {
	const canvas = document.getElementById("focusCanvas");

	canvas.addEventListener("mousedown", (e) => {
		stopPlay(); // any user click halts the animation loop
		const { x, y } = canvasPos(e, canvas);
		if (mode === "items") {
			const ov = effectiveOverlay();
			if (!ov) return;
			const px = ov.left * FOCUS_SCALE;
			const py = (CARD_SIZE - ov.bottom - ov.height) * FOCUS_SCALE;
			const pw = ov.width * FOCUS_SCALE;
			const ph = ov.height * FOCUS_SCALE;
			// Bottom-right corner = resize handle (12px square).
			if (x >= px + pw - 12 && x <= px + pw + 4 &&
				y >= py + ph - 12 && y <= py + ph + 4) {
				dragging = { kind: "item-resize" };
			} else if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
				dragging = {
					kind: "item-move",
					offsetX: x - px,
					offsetY: y - py,
				};
			} else {
				return;
			}
			e.preventDefault();
			return;
		}
		const hit = hitTestAnchor(x, y);
		if (hit) {
			selectedAnchor = hit;
			dragging = { anchor: hit };
			renderAnchorPanel();
			renderFocus();
		} else {
			selectedAnchor = null;
			renderAnchorPanel();
			renderFocus();
		}
	});

	canvas.addEventListener("mousemove", (e) => {
		if (!dragging) return;
		const { x, y } = canvasPos(e, canvas);
		if (mode === "items") {
			const ov = effectiveOverlay();
			if (!ov) return;
			if (dragging.kind === "item-move") {
				const newLeftPx = x - dragging.offsetX;
				const newTopPx = y - dragging.offsetY;
				const newLeft = clampInt(Math.round(newLeftPx / FOCUS_SCALE), -CARD_SIZE, CARD_SIZE * 2);
				const newTop = Math.round(newTopPx / FOCUS_SCALE);
				const newBottom = CARD_SIZE - newTop - ov.height;
				setItemField("left", newLeft);
				setItemField("bottom", newBottom);
			} else if (dragging.kind === "item-resize") {
				const px = ov.left * FOCUS_SCALE;
				const py = (CARD_SIZE - ov.bottom - ov.height) * FOCUS_SCALE;
				const newW = Math.max(8, Math.round((x - px) / FOCUS_SCALE));
				const newH = Math.max(8, Math.round((y - py) / FOCUS_SCALE));
				// Keep top edge fixed → bottom moves as height changes
				const topY = CARD_SIZE - ov.bottom - ov.height;
				setItemField("width", newW);
				setItemField("height", newH);
				setItemField("bottom", CARD_SIZE - topY - newH);
			}
			renderItemPanel();
			renderFocus();
			renderThumbnails();
			return;
		}
		const lx = clampInt(Math.round(x / FOCUS_SCALE), 0, CARD_SIZE);
		const ly = clampInt(Math.round(y / FOCUS_SCALE), 0, CARD_SIZE);
		currentFrame()[dragging.anchor] = { x: lx, y: ly };
		renderAnchorPanel();
		renderFocus();
		renderThumb(focus.anim, focus.frame);
	});

	window.addEventListener("mouseup", () => {
		if (dragging) {
			if (mode === "anchors") saveState();
			else saveItemPlacements();
			dragging = null;
		}
	});

	// Keyboard: digits 1-9 select anchor; arrows nudge.
	window.addEventListener("keydown", (e) => {
		const t = e.target;
		if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
		const step = e.shiftKey ? 5 : 1;
		if (mode === "items") {
			if (!currentItemId) return;
			const ov = effectiveOverlay();
			if (!ov) return;
			if (e.key === "ArrowUp")    setItemField("bottom", ov.bottom + step);
			else if (e.key === "ArrowDown")  setItemField("bottom", ov.bottom - step);
			else if (e.key === "ArrowLeft")  setItemField("left", ov.left - step);
			else if (e.key === "ArrowRight") setItemField("left", ov.left + step);
			else return;
			e.preventDefault();
			renderItemPanel();
			renderFocus();
			renderThumbnails();
			return;
		}
		const num = parseInt(e.key, 10);
		if (!Number.isNaN(num) && num >= 1 && num <= ANCHOR_NAMES.length) {
			selectedAnchor = ANCHOR_NAMES[num - 1];
			renderAnchorPanel();
			renderFocus();
			return;
		}
		if (!selectedAnchor) return;
		const p = currentFrame()[selectedAnchor];
		if (e.key === "ArrowUp") p.y = clampInt(p.y - step, 0, CARD_SIZE);
		else if (e.key === "ArrowDown") p.y = clampInt(p.y + step, 0, CARD_SIZE);
		else if (e.key === "ArrowLeft") p.x = clampInt(p.x - step, 0, CARD_SIZE);
		else if (e.key === "ArrowRight") p.x = clampInt(p.x + step, 0, CARD_SIZE);
		else return;
		e.preventDefault();
		saveAndRender();
	});

	// Buttons
	document.getElementById("copyPrev").addEventListener("click", copyFromPrev);
	document.getElementById("mirror").addEventListener("click", mirrorLR);
	document.getElementById("resetFrame").addEventListener("click", resetFrame);
	document.getElementById("exportBtn").addEventListener("click", openExport);
	document.getElementById("importBtn").addEventListener("click", openImport);
	document.getElementById("saveBtn").addEventListener("click", saveToApp);
	document.getElementById("ioCopy").addEventListener("click", copyIoText);
	document.getElementById("ioApply").addEventListener("click", applyImport);

	// Mode toggle
	document.getElementById("modeAnchors").addEventListener("click", () => setMode("anchors"));
	document.getElementById("modeItems").addEventListener("click", () => setMode("items"));

	// Item picker — typing or selecting from datalist loads the item.
	const itemInput = document.getElementById("itemIdInput");
	itemInput.addEventListener("change", (e) => {
		const id = e.target.value.trim();
		if (id) loadItem(id);
	});
	itemInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			const id = e.target.value.trim();
			if (id) loadItem(id);
		}
	});

	// Item numeric inputs
	for (const field of ["bottom", "left", "width", "height"]) {
		const el = document.getElementById("item" + field[0].toUpperCase() + field.slice(1));
		el.addEventListener("change", (e) => {
			const v = parseInt(e.target.value, 10);
			if (!Number.isNaN(v)) {
				setItemField(field, v);
				renderItemPanel();
				renderFocus();
				renderThumbnails();
			}
		});
	}

	// Item action buttons
	document.getElementById("itemUseBase").addEventListener("click", itemUseBase);
	document.getElementById("itemApplyToAll").addEventListener("click", itemApplyToAll);
	document.getElementById("itemResetAll").addEventListener("click", itemResetAll);

	// Accessory picker search
	document.getElementById("itemSearch").addEventListener("input", (e) => {
		filterItemPicker(e.target.value);
	});

	// Preview-all-accessories toggle (anchor mode)
	document.getElementById("previewToggle").addEventListener("change", (e) => {
		previewAccessories = e.target.checked;
		render();
	});

	// Play / Stop button — cycles focus.frame through the current
	// anim's 4 frames at the anim's natural FPS. Accessories follow
	// because renderFocus/renderThumb already use the focused frame.
	document.getElementById("playBtn").addEventListener("click", togglePlay);

	// Big "Browse all" accessory modal — easier than scrolling the
	// narrow sidebar.
	document.getElementById("browseBtn").addEventListener("click", openItemBrowser);
	document.getElementById("browserClose").addEventListener("click", closeItemBrowser);
	document.getElementById("browserSearch").addEventListener("input", (e) => {
		filterItemBrowser(e.target.value);
	});
	// Esc dismisses (native dialog behavior handles it, but make sure
	// click on backdrop also closes).
	document.getElementById("browserModal").addEventListener("click", (e) => {
		if (e.target.id === "browserModal") closeItemBrowser();
	});
	// Global hotkey "B" opens the browser when in items mode.
	window.addEventListener("keydown", (e) => {
		if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
		if (e.key === "b" || e.key === "B") {
			if (mode === "items") openItemBrowser();
		}
	});
}

function togglePlay() {
	if (playing) stopPlay();
	else startPlay();
}

function startPlay() {
	if (playing) return;
	playing = true;
	updatePlayButton();
	const fps = ANIM_FPS[focus.anim] ?? 4;
	const period = 1000 / fps;
	// Start from frame 0 so the animation reads cleanly from the top.
	focus.frame = 0;
	renderFocus();
	renderThumbnails();
	playTimer = setInterval(() => {
		focus.frame = (focus.frame + 1) % FRAMES_PER_ANIM;
		renderFocus();
		renderThumbnails();
	}, period);
}

function stopPlay() {
	if (!playing) return;
	playing = false;
	if (playTimer) {
		clearInterval(playTimer);
		playTimer = null;
	}
	updatePlayButton();
}

function updatePlayButton() {
	const btn = document.getElementById("playBtn");
	if (!btn) return;
	btn.textContent = playing ? "■ Stop" : "▶ Play";
	btn.classList.toggle("playing", playing);
}

function setMode(next) {
	stopPlay();
	mode = next;
	document.getElementById("modeAnchors").classList.toggle("active", mode === "anchors");
	document.getElementById("modeItems").classList.toggle("active", mode === "items");
	document.querySelectorAll(".modeAnchorsOnly").forEach((el) => {
		el.style.display = mode === "anchors" ? "" : "none";
	});
	document.querySelectorAll(".modeItemsOnly").forEach((el) => {
		// Sidebar uses flex display; everything else default.
		const def = el.classList.contains("itemPickerSidebar") ? "flex" : "";
		el.style.display = mode === "items" ? def : "none";
	});
	// Add the 3-column layout class to focusRow when in items mode.
	document.querySelector(".focusRow").classList.toggle("itemsMode", mode === "items");
	render();
}

function itemUseBase() {
	if (!currentItemId) return;
	const rec = itemPlacements[currentItemId];
	delete rec.perAnim[focus.anim];
	saveItemPlacements();
	renderItemPanel();
	renderFocus();
	renderThumbnails();
}

function itemApplyToAll() {
	if (!currentItemId) return;
	const rec = itemPlacements[currentItemId];
	const ov = effectiveOverlay();
	rec.base = { ...ov };
	rec.perAnim = {};
	saveItemPlacements();
	renderItemPanel();
	renderFocus();
	renderThumbnails();
}

function itemResetAll() {
	if (!currentItemId) return;
	if (!confirm(`Reset placement for "${currentItemId}" to defaults?`)) return;
	itemPlacements[currentItemId] = {
		base: { ...DEFAULT_ITEM_OVERLAY },
		perAnim: {},
	};
	saveItemPlacements();
	renderItemPanel();
	renderFocus();
	renderThumbnails();
}

function renderItemPanel() {
	const title = document.getElementById("itemPanelTitle");
	const body = document.getElementById("itemPanelBody");
	const controls = document.getElementById("itemControls");
	if (!currentItemId) {
		title.textContent = "No item loaded";
		body.style.display = "";
		controls.style.display = "none";
		return;
	}
	title.textContent = currentItemId;
	body.style.display = "none";
	controls.style.display = "";

	const ov = effectiveOverlay();
	document.getElementById("itemBottom").value = ov.bottom;
	document.getElementById("itemLeft").value = ov.left;
	document.getElementById("itemWidth").value = ov.width;
	document.getElementById("itemHeight").value = ov.height;

	const editingPerAnim = isEditingPerAnim();
	document.getElementById("itemEditingLabel").textContent =
		editingPerAnim ? `perAnim.${focus.anim}` : "base";
	document.getElementById("itemEditingHint").textContent =
		editingPerAnim
			? `Overrides base for ${focus.anim} only. Click "Use base for this anim" to delete the override.`
			: `Applies to all animations. Drag to also nudge per-frame deviations once base is good.`;
}

function canvasPos(e, canvas) {
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;
	return {
		x: (e.clientX - rect.left) * scaleX,
		y: (e.clientY - rect.top) * scaleY,
	};
}

function hitTestAnchor(px, py) {
	const frame = currentFrame();
	let best = null;
	let bestDist = 14; // hit radius in display px
	for (const name of ANCHOR_NAMES) {
		const p = frame[name];
		const dx = px - p.x * FOCUS_SCALE;
		const dy = py - p.y * FOCUS_SCALE;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < bestDist) {
			best = name;
			bestDist = dist;
		}
	}
	return best;
}

// ── Tools ───────────────────────────────────────────────────────
function copyFromPrev() {
	if (focus.frame === 0) {
		alert("Nothing previous — this is frame 1.");
		return;
	}
	const src = anchors[focus.anim][focus.frame - 1];
	const dst = anchors[focus.anim][focus.frame];
	for (const name of ANCHOR_NAMES) {
		dst[name] = { ...src[name] };
	}
	saveAndRender();
}

function mirrorLR() {
	// If selectedAnchor is hand_l → set hand_r to (300-x, y). Same the
	// other way. For other anchors, snap to centerline x=150.
	if (!selectedAnchor) {
		alert("Pick an anchor first (click one).");
		return;
	}
	const frame = currentFrame();
	const p = frame[selectedAnchor];
	if (selectedAnchor === "hand_l") {
		frame.hand_r = { x: CARD_SIZE - p.x, y: p.y };
	} else if (selectedAnchor === "hand_r") {
		frame.hand_l = { x: CARD_SIZE - p.x, y: p.y };
	} else {
		p.x = 150;
	}
	saveAndRender();
}

function resetFrame() {
	const dy = SEED_SHIFTS[focus.anim] ?? 0;
	const frame = anchors[focus.anim][focus.frame];
	for (const name of ANCHOR_NAMES) {
		frame[name] = {
			x: REST_ANCHORS[name].x,
			y: REST_ANCHORS[name].y + dy,
		};
	}
	saveAndRender();
}

// Save current PIG_FRAME_ANCHORS to constants/hats.ts via the local
// save server. No-op when the editor is loaded over file:// — the
// server URL is relative so it only resolves when served from
// http://localhost:4321 (or wherever server.mjs is running).
async function saveToApp() {
	if (mode !== "anchors") {
		alert("Items mode save isn't wired yet — switch to Anchors mode.");
		return;
	}
	const literal = serializeTS();
	const btn = document.getElementById("saveBtn");
	const originalLabel = btn.textContent;
	btn.disabled = true;
	btn.textContent = "Saving…";
	try {
		const res = await fetch("/save", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ literal }),
		});
		const json = await res.json().catch(() => ({}));
		if (!res.ok || !json.ok) {
			throw new Error(json.error ?? `HTTP ${res.status}`);
		}
		btn.textContent = "Saved ✓";
		setTimeout(() => {
			btn.textContent = originalLabel;
			btn.disabled = false;
		}, 1500);
	} catch (e) {
		btn.textContent = originalLabel;
		btn.disabled = false;
		alert(
			`Save failed: ${e.message}\n\n` +
				`Make sure the save server is running:\n` +
				`  node tools/anchor-editor/server.mjs\n\n` +
				`Then open http://localhost:4321 in this browser.`
		);
	}
}

// ── Export / Import ────────────────────────────────────────────
function openExport() {
	if (mode === "items") {
		document.getElementById("ioTitle").textContent = "Export to HAT_OVERLAYS";
		document.getElementById("ioHint").textContent =
			"Paste each block under HAT_OVERLAYS in constants/hats.ts. Only items you've touched in this session are included.";
		document.getElementById("ioText").value = serializeItemsTS();
		document.getElementById("ioApply").style.display = "none";
	} else {
		document.getElementById("ioTitle").textContent = "Export to PIG_FRAME_ANCHORS";
		document.getElementById("ioHint").textContent =
			"Paste this into constants/hats.ts to replace the existing PIG_FRAME_ANCHORS literal.";
		document.getElementById("ioText").value = serializeTS();
		document.getElementById("ioApply").style.display = "none";
	}
	document.getElementById("ioModal").showModal();
}

function openImport() {
	if (mode === "items") {
		document.getElementById("ioTitle").textContent = "Import HAT_OVERLAYS entry";
		document.getElementById("ioHint").textContent =
			"Paste an existing HAT_OVERLAYS entry to seed the current item. Example:\n  wizard: { bottom: 209, left: 64, width: 160, height: 160, perAnim: { sad: { bottom: 200 } } }";
		document.getElementById("ioText").value = "";
		document.getElementById("ioApply").style.display = "";
	} else {
		document.getElementById("ioTitle").textContent = "Import PIG_FRAME_ANCHORS";
		document.getElementById("ioHint").textContent =
			"Paste your current PIG_FRAME_ANCHORS literal. The editor will parse it and load each anchor. Existing localStorage state will be overwritten.";
		document.getElementById("ioText").value = "";
		document.getElementById("ioApply").style.display = "";
	}
	document.getElementById("ioModal").showModal();
}

// Emit each touched item as a TS overlay entry. base props always present;
// perAnim entries only emitted if they differ from base.
function serializeItemsTS() {
	const lines = [];
	const ids = Object.keys(itemPlacements).sort();
	if (ids.length === 0) {
		return "// No items edited yet — type an item id in the top bar.";
	}
	for (const id of ids) {
		const rec = itemPlacements[id];
		const { bottom, left, width, height } = rec.base;
		const perAnimEntries = [];
		for (const anim of ANIMATIONS) {
			const p = rec.perAnim?.[anim];
			if (!p || Object.keys(p).length === 0) continue;
			// Skip if every field matches base exactly.
			const diffs = [];
			for (const f of ["bottom", "left", "width", "height"]) {
				if (p[f] !== undefined && p[f] !== rec.base[f]) {
					diffs.push(`${f}: ${p[f]}`);
				}
			}
			if (diffs.length === 0) continue;
			perAnimEntries.push(`\t\t${anim}: { ${diffs.join(", ")} },`);
		}
		const fields = [`bottom: ${bottom}`, `left: ${left}`, `width: ${width}`, `height: ${height}`];
		if (perAnimEntries.length > 0) {
			lines.push(`${id}: {`);
			lines.push(`\t${fields.join(", ")},`);
			lines.push(`\tperAnim: {`);
			lines.push(...perAnimEntries);
			lines.push(`\t},`);
			lines.push(`},`);
		} else {
			lines.push(`${id}: { ${fields.join(", ")} },`);
		}
	}
	return lines.join("\n");
}

function copyIoText() {
	const txt = document.getElementById("ioText").value;
	navigator.clipboard.writeText(txt);
}

function applyImport() {
	const raw = document.getElementById("ioText").value.trim();
	try {
		if (mode === "items") {
			parseItemImport(raw);
			renderItemPanel();
			renderFocus();
			renderThumbnails();
		} else {
			const parsed = parseImport(raw);
			anchors = parsed;
			saveAndRender();
		}
		document.getElementById("ioModal").close();
	} catch (e) {
		alert("Couldn't parse: " + e.message);
	}
}

// Parse a single HAT_OVERLAYS entry like:
//   wizard: { bottom: 209, left: 64, width: 160, height: 160,
//             perAnim: { sad: { bottom: 200 } } }
// Tolerates leading/trailing commas. Seeds itemPlacements[id] and makes
// it the current item.
function parseItemImport(raw) {
	const m = raw.match(/(\w+)\s*:\s*\{([\s\S]*)\}\s*,?\s*$/);
	if (!m) throw new Error("Expected `id: { bottom: ..., left: ... }`");
	const id = m[1];
	const body = m[2];
	const base = { ...DEFAULT_ITEM_OVERLAY };
	for (const f of ["bottom", "left", "width", "height"]) {
		const re = new RegExp(`\\b${f}\\s*:\\s*(-?\\d+)`);
		const fm = body.match(re);
		if (fm) base[f] = parseInt(fm[1], 10);
	}
	const perAnim = {};
	const perAnimMatch = body.match(/perAnim\s*:\s*\{([\s\S]*?)\}\s*,?\s*\}?$/);
	if (perAnimMatch) {
		for (const anim of ANIMATIONS) {
			const re = new RegExp(`${anim}\\s*:\\s*\\{([^{}]*)\\}`);
			const am = perAnimMatch[1].match(re);
			if (!am) continue;
			const entry = {};
			for (const f of ["bottom", "left", "width", "height"]) {
				const fre = new RegExp(`\\b${f}\\s*:\\s*(-?\\d+)`);
				const fm = am[1].match(fre);
				if (fm) entry[f] = parseInt(fm[1], 10);
			}
			if (Object.keys(entry).length > 0) perAnim[anim] = entry;
		}
	}
	itemPlacements[id] = { base, perAnim };
	saveItemPlacements();
	document.getElementById("itemIdInput").value = id;
	loadItem(id);
}

function serializeTS() {
	// Emit a TS object literal that drops into PIG_FRAME_ANCHORS' body.
	const lines = [];
	lines.push("export const PIG_FRAME_ANCHORS: Record<");
	lines.push("\tPigAnimationKey,");
	lines.push("\tPartial<Record<AnchorName, Anchor>>[]");
	lines.push("> = {");
	for (const anim of ANIMATIONS) {
		lines.push(`\t${anim}: [`);
		for (let f = 0; f < FRAMES_PER_ANIM; f++) {
			const frame = anchors[anim][f];
			// Emit only anchors that DIFFER from REST so the literal
			// stays readable. (REST_ANCHORS provides the fallback.)
			const diffs = [];
			for (const name of ANCHOR_NAMES) {
				const p = frame[name];
				const r = REST_ANCHORS[name];
				if (p.x !== r.x || p.y !== r.y) {
					diffs.push(`${name}: { x: ${p.x}, y: ${p.y} }`);
				}
			}
			if (diffs.length === 0) {
				lines.push("\t\t{},");
			} else {
				lines.push("\t\t{ " + diffs.join(", ") + " },");
			}
		}
		lines.push("\t],");
	}
	lines.push("};");
	return lines.join("\n");
}

function parseImport(raw) {
	// Best-effort parser: extract per-frame anchor objects from a TS
	// literal. Supports `shiftAll(N)` helper by expanding it relative
	// to REST_ANCHORS. Falls back to REST for any missing anchor.
	//
	// Not a real TS parser — looks for `<anim>: [` blocks and walks
	// each frame literal inside.
	const out = {};
	for (const anim of ANIMATIONS) {
		out[anim] = [];
		const animRe = new RegExp(`${anim}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m");
		const m = raw.match(animRe);
		if (!m) {
			// Missing entry — seed from REST_ANCHORS.
			for (let f = 0; f < FRAMES_PER_ANIM; f++) {
				out[anim].push(restFrame());
			}
			continue;
		}
		const body = m[1];
		// Match either `{...}` literal frames or `shiftAll(N)` calls.
		const frameRe = /\{[^{}]*\}|shiftAll\(([-\d]+)\)/g;
		const found = [];
		let fm;
		while ((fm = frameRe.exec(body))) {
			found.push(fm);
		}
		for (let f = 0; f < FRAMES_PER_ANIM; f++) {
			const fr = restFrame();
			const match = found[f];
			if (!match) {
				// pad with rest
				out[anim].push(fr);
				continue;
			}
			if (match[0].startsWith("shiftAll")) {
				const dy = parseInt(match[1], 10);
				for (const name of ANCHOR_NAMES) fr[name].y += dy;
			} else {
				// Parse `head: { x: 150, y: 22 }` patterns inside.
				const inner = match[0];
				for (const name of ANCHOR_NAMES) {
					const re = new RegExp(
						`${name}\\s*:\\s*\\{\\s*x\\s*:\\s*(-?\\d+)\\s*,\\s*y\\s*:\\s*(-?\\d+)`
					);
					const mm = inner.match(re);
					if (mm) {
						fr[name] = { x: parseInt(mm[1], 10), y: parseInt(mm[2], 10) };
					}
				}
			}
			out[anim].push(fr);
		}
	}
	return out;
}

function restFrame() {
	const fr = {};
	for (const name of ANCHOR_NAMES) {
		fr[name] = { x: REST_ANCHORS[name].x, y: REST_ANCHORS[name].y };
	}
	return fr;
}

// ── Helpers ────────────────────────────────────────────────────
function currentFrame() {
	return anchors[focus.anim][focus.frame];
}

function clampInt(v, lo, hi) {
	const n = Math.round(Number(v));
	if (Number.isNaN(n)) return lo;
	return Math.max(lo, Math.min(hi, n));
}

function saveAndRender() {
	saveState();
	render();
}

function render() {
	renderFocus();
	renderAnchorPanel();
	renderItemPanel();
	renderThumbnails();
}

// ── Go ─────────────────────────────────────────────────────────
init();
