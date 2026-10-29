// Full costumes (Halloween 2026), the skin swap: a worn costume is drawn as
// its own sprite set of the DRAWN pig wearing it (constants/costumeFrames.
// generated.ts, costume -> pig -> frames), pose for pose in place of the pig's
// frames, and hides every other worn item. A (costume, pig) pair without a
// skin leaves that pig in its own outfit, never in another pig's skin.
// utils/costumeFit.ts + utils/costumeCopy.ts + PigStage/SpritePig/PigAvatar +
// the slot routing + the catalog's one id list + the generator's emit rule.
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

// Stand-in skins (24 frames each, distinct numeric sources), a stand-in for
// what scripts/gen_costume_frames.mjs emits:
//   Hollow Jack:  Rosie (9000+) and Pepper (8000+)
//   Count Snout:  Rosie only (7000+)
//   Starspell:    all six pigs (6000+, 100 apart)
//   Moonpuff:     no skin at all
const FAMILIES = ["idle", "happy", "surprise", "face", "face_sit", "walk"];
jest.mock("../constants/costumeFrames.generated", () => {
	const skin = (base: number) => {
		const out: Record<string, number> = {};
		["idle", "happy", "surprise", "face", "face_sit", "walk"].forEach((family, f) => {
			for (let n = 1; n <= 4; n += 1) out[`${family}_${n}`] = base + f * 10 + n;
		});
		return out;
	};
	const pigs = ["rosie", "copper", "pepper", "bandit", "pickles", "biscuit"];
	return {
		COSTUME_FRAMES: {
			halloween_2026_hollow_jack_costume: { rosie: skin(9000), pepper: skin(8000) },
			halloween_2026_count_snout_costume: { rosie: skin(7000) },
			halloween_2026_starspell_costume: Object.fromEntries(pigs.map((pig, i) => [pig, skin(6000 + i * 100)])),
		},
	};
});

import { PigStage } from "../components/ui/PigStage";
import { PigAvatar } from "../components/ui/PigAvatar";
import { COSTUME_NAMES, COSTUME_THUMBNAILS } from "../constants/costumes";
import { HAT_IMAGES } from "../constants/hats";
import { PIG_FRAMES } from "../constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "../constants/pigFramesExtra";
import { SLOT_LABEL, SLOT_ORDER, columnForCategory, slotForCategory } from "../constants/slots";
import { computeEquip } from "../utils/cosmetics";
import {
	costumeCoverage,
	costumeFitsPig,
	costumeName,
	costumePigs,
	costumePreviewPig,
	costumeSkinFor,
	costumeSkinFrameName,
	costumeSkinSource,
	costumeThumbnailFor,
	isCostumeAvailable,
} from "../utils/costumeFit";
import {
	COSTUME_NOT_READY_LINE,
	costumeCoverageLine,
	costumeCoverLine,
	costumeEquipRefusal,
	costumeNotFittedLine,
	costumeOffLine,
	costumeOnLine,
	costumeTakeOffToast,
	costumeTileTag,
	slotsWaitingUnder,
	stopCostumeEquip,
} from "../utils/costumeCopy";
import { parsePigRoster } from "../utils/pigRoster";
import { stallIntroCards } from "../utils/stallIntro";
import type { SeasonalShelf, ShelfItem } from "../utils/seasonalShelf";
import { costumeSlot } from "../utils/wornCostumes";
import { COSTUME_FRAMES } from "../constants/costumeFrames.generated";

const mockSkin = COSTUME_FRAMES.halloween_2026_hollow_jack_costume.rosie as Record<string, number>;
const pepperSkin = COSTUME_FRAMES.halloween_2026_hollow_jack_costume.pepper as Record<string, number>;

const HOLLOW_JACK = "halloween_2026_hollow_jack_costume"; // Rosie + Pepper
const COUNT_SNOUT = "halloween_2026_count_snout_costume"; // Rosie only
const STARSPELL = "halloween_2026_starspell_costume"; // every pig
const MOONPUFF = "halloween_2026_moonpuff_costume"; // no skin in this test
const costume = (id: string) => ({ id, category: "costume", emoji: null });
const hat = { id: "cowboy", category: "hat", emoji: null };
const ROSIE = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };
const SKIN_SOURCES = new Set(Object.values(mockSkin));

describe("costume slot routing", () => {
	test("costume is its own slot and column, at the head of the tray", () => {
		expect(slotForCategory("costume")).toBe("costume");
		expect(columnForCategory("costume")).toBe("active_costume_id");
		expect(SLOT_ORDER[0]).toBe("costume");
		expect(SLOT_LABEL.costume).toBe("Costume");
	});

	test("equipping a costume writes only its own column; the outfit stays saved", () => {
		const current = { active_hat_id: "cowboy", active_bow_id: "pink_bow", active_mask_id: "skull" };
		const on = computeEquip("costume", HOLLOW_JACK, current);
		expect(on.update).toEqual({ active_costume_id: HOLLOW_JACK });
		const off = computeEquip("costume", null, on.activeIds);
		expect(off.update).toEqual({ active_costume_id: null });
		expect(off.activeIds).toMatchObject(current);
	});
});

describe("availability: a costume is wearable on a pig when that pair's skin exists", () => {
	test("each pig gets its own skin, and only its own", () => {
		expect(isCostumeAvailable(HOLLOW_JACK)).toBe(true);
		expect(costumeSkinFor("rosie", HOLLOW_JACK)).toBe(mockSkin);
		expect(costumeSkinFor(undefined, HOLLOW_JACK)).toBe(mockSkin);
		expect(costumeSkinFor("pepper", HOLLOW_JACK)).toBe(pepperSkin);
		expect(costumeSkinFor("bandit", HOLLOW_JACK)).toBeNull();
		expect(costumeSkinFor("pepper", COUNT_SNOUT)).toBeNull();
		expect(costumeFitsPig(HOLLOW_JACK, "pepper")).toBe(true);
		expect(costumeFitsPig(HOLLOW_JACK, "bandit")).toBe(false);
		expect(costumePigs(HOLLOW_JACK)).toEqual(["rosie", "pepper"]);
		expect(costumePigs(STARSPELL)).toEqual(["rosie", "copper", "pepper", "bandit", "pickles", "biscuit"]);
		// A pig-only costume (no Rosie skin) is still a costume.
		expect(costumeThumbnailFor("pepper", HOLLOW_JACK)).toBe(pepperSkin.idle_1);
		expect(costumeThumbnailFor("bandit", HOLLOW_JACK)).toBeNull();
	});

	test("the effective pig decides: a lapsed member's stored pepper is drawn as Rosie", () => {
		const lapsed = parsePigRoster({ is_member: false, active_pig_id: "pepper" });
		expect(lapsed.activePigId).toBe("rosie");
		expect(costumeSkinFor(lapsed.activePigId, HOLLOW_JACK)).toBe(mockSkin);
		const member = parsePigRoster({ is_member: true, active_pig_id: "pepper" });
		expect(costumeSkinFor(member.activePigId, HOLLOW_JACK)).toBe(pepperSkin);
	});

	test("the preview draws on the viewer's pig when it fits, else the first pig it fits", () => {
		expect(costumePreviewPig(HOLLOW_JACK, "pepper")).toBe("pepper");
		expect(costumePreviewPig(HOLLOW_JACK, "bandit")).toBe("rosie");
		expect(costumePreviewPig(HOLLOW_JACK, null)).toBe("rosie");
		expect(costumePreviewPig(MOONPUFF, "pepper")).toBeNull();
	});

	test("coverage: which pigs fit every costume, and which fit some", () => {
		expect(costumeCoverage([HOLLOW_JACK, COUNT_SNOUT])).toEqual({ all: ["rosie"], some: ["pepper"] });
		expect(costumeCoverage([STARSPELL]).all).toHaveLength(6);
		expect(costumeCoverage([MOONPUFF])).toEqual({ all: [], some: [] });
	});

	test("unknown or skinless costumes are unavailable everywhere", () => {
		expect(isCostumeAvailable(MOONPUFF)).toBe(false);
		expect(isCostumeAvailable("not_a_costume")).toBe(false);
		expect(isCostumeAvailable(null)).toBe(false);
		expect(costumeSkinFor("rosie", MOONPUFF)).toBeNull();
		// No tile (so no Closet section and no stall card) and no stage slot.
		expect(COSTUME_THUMBNAILS[MOONPUFF]).toBeUndefined();
		expect(HAT_IMAGES[MOONPUFF]).toBeUndefined();
		expect(costumeSlot(MOONPUFF)).toBeNull();
		// Not equippable: the tap is stopped before the server.
		expect(costumeEquipRefusal("costume", MOONPUFF, "rosie")).toBe(COSTUME_NOT_READY_LINE);
		// The available one's tile is its own front rest frame.
		expect(HAT_IMAGES[HOLLOW_JACK]).toBe(mockSkin.idle_1);
		expect(costumeSlot(HOLLOW_JACK)).toEqual(costume(HOLLOW_JACK));
	});

	test("names come from the designed set", () => {
		expect(costumeName(HOLLOW_JACK)).toBe("Hollow Jack");
		expect(costumeName("nope")).toBeNull();
	});
});

describe("skin frame mapping (never back to bare Rosie)", () => {
	test("the six drawn families map to themselves", () => {
		for (const name of ["idle_2", "happy_4", "surprise_1", "face_3", "face_sit_2", "walk_4"]) {
			expect(costumeSkinFrameName(mockSkin, name)).toBe(name);
		}
	});

	test("Rosie's 12-frame idle cycles the skin's 4", () => {
		expect(
			Array.from({ length: 12 }, (_, i) => costumeSkinFrameName(mockSkin, `idle_${i + 1}`)),
		).toEqual(["idle_1", "idle_2", "idle_3", "idle_4", "idle_1", "idle_2", "idle_3", "idle_4", "idle_1", "idle_2", "idle_3", "idle_4"]);
	});

	test("moods rest in idle, reactions in happy, the lounge in the seated turn", () => {
		expect(costumeSkinFrameName(mockSkin, "sad_3")).toBe("idle_3");
		expect(costumeSkinFrameName(mockSkin, "tired_4")).toBe("idle_4");
		expect(costumeSkinFrameName(mockSkin, "jump_2")).toBe("happy_2");
		expect(costumeSkinFrameName(mockSkin, "wave_1")).toBe("happy_1");
		expect(costumeSkinFrameName(mockSkin, "idle_s_2")).toBe("face_sit_1");
		expect(costumeSkinFrameName(mockSkin, "sit_e")).toBe("face_sit_1");
		expect(costumeSkinFrameName(mockSkin, "walk_n_3")).toBe("face_sit_1");
		expect(costumeSkinFrameName(mockSkin, "mystery")).toBe("idle_1");
	});

	test("every frame Rosie has resolves to a skin frame", () => {
		for (const name of Object.keys(ROSIE)) {
			expect(SKIN_SOURCES.has(costumeSkinSource(mockSkin, name))).toBe(true);
		}
	});
});

describe("PigStage with a costume on", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	const sourcesOf = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAll((n) => !!n.props && n.props.source !== undefined).map((n) => n.props.source);
	const rosieSources = new Set(Object.values(ROSIE));

	async function renderStage(node: React.ReactElement) {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(node);
		});
		return r;
	}

	test("the skin replaces Rosie's frames and every worn item is hidden", async () => {
		const r = await renderStage(
			<PigStage
				pigFrozen
				equipped={hat}
				equippedBow={{ id: "pink_bow", category: "bow", emoji: null }}
				equippedGlasses={{ id: "aviators", category: "glasses", emoji: null }}
				equippedNeck={{ id: "pearl_necklace", category: "necklace", emoji: null }}
				equippedAura={{ id: "gold_aura", category: "aura", emoji: null }}
				equippedHeld={{ id: "magic_wand", category: "held", emoji: null }}
				equippedCostume={costume(HOLLOW_JACK)}
			/>,
		);
		const sources = sourcesOf(r);
		expect(sources).toContain(mockSkin.idle_1);
		expect(sources.some((s) => rosieSources.has(s))).toBe(false);
		for (const id of ["cowboy", "pink_bow", "aviators", "pearl_necklace", "gold_aura", "magic_wand"]) {
			if (HAT_IMAGES[id]) expect(sources).not.toContain(HAT_IMAGES[id]);
		}
		act(() => r.unmount());
	});

	test("every pose stays in the skin: the turn, a mood, a reaction", async () => {
		for (const props of [
			{ facing: "left" as const },
			{ pigMood: "sad" as const },
			{ pigMood: "tired" as const },
			{ pigReaction: { id: 1, kind: "jump" as const } },
			{ pigReaction: { id: 2, kind: "wave" as const } },
		]) {
			const r = await renderStage(<PigStage {...props} equippedCostume={costume(HOLLOW_JACK)} />);
			for (let tick = 0; tick < 8; tick += 1) {
				const sources = sourcesOf(r);
				expect(sources.length).toBeGreaterThan(0);
				expect(sources.some((s) => rosieSources.has(s))).toBe(false);
				await act(async () => jest.advanceTimersByTime(250));
			}
			act(() => r.unmount());
		}
	});

	test("taking it off brings Rosie and her saved outfit back", async () => {
		const r = await renderStage(<PigStage pigFrozen equipped={hat} equippedCostume={costume(HOLLOW_JACK)} />);
		expect(sourcesOf(r)).not.toContain(HAT_IMAGES.cowboy);
		await act(async () => r.update(<PigStage pigFrozen equipped={hat} equippedCostume={null} />));
		expect(sourcesOf(r)).toContain(HAT_IMAGES.cowboy);
		expect(sourcesOf(r)).toContain(PIG_FRAMES.rosie.idle_1);
		act(() => r.unmount());
	});

	test("a skinless costume keeps the ordinary outfit", async () => {
		const skinless = await renderStage(<PigStage pigFrozen equipped={hat} equippedCostume={costume(MOONPUFF)} />);
		expect(sourcesOf(skinless)).toContain(HAT_IMAGES.cowboy);
		expect(sourcesOf(skinless)).toContain(PIG_FRAMES.rosie.idle_1);
		act(() => skinless.unmount());
	});

	test("Pepper is drawn in Pepper's own skin, never Rosie's, through every pose", async () => {
		const pepperSources = new Set(Object.values(pepperSkin));
		const rosieSkinSources = new Set(Object.values(mockSkin));
		const ownPepper = new Set(Object.values({ ...PIG_FRAMES.pepper, ...PIG_FRAMES_EXTRA.pepper }));
		for (const props of [{ pigFrozen: true }, { facing: "left" as const }, { pigReaction: { id: 3, kind: "jump" as const } }]) {
			const r = await renderStage(
				<PigStage pigId="pepper" equipped={hat} equippedCostume={costume(HOLLOW_JACK)} {...props} />,
			);
			for (let tick = 0; tick < 4; tick += 1) {
				const sources = sourcesOf(r);
				expect(sources.some((src) => pepperSources.has(src))).toBe(true);
				expect(sources.some((src) => rosieSkinSources.has(src))).toBe(false);
				expect(sources.some((src) => ownPepper.has(src))).toBe(false);
				expect(sources).not.toContain(HAT_IMAGES.cowboy);
				await act(async () => jest.advanceTimersByTime(250));
			}
			act(() => r.unmount());
		}
	});

	test("a pig without the pair's skin wears its own outfit, never another pig's skin", async () => {
		const allSkins = new Set([...Object.values(mockSkin), ...Object.values(pepperSkin)]);
		const bandit = await renderStage(
			<PigStage pigId="bandit" pigFrozen equipped={hat} equippedCostume={costume(HOLLOW_JACK)} />,
		);
		expect(sourcesOf(bandit)).toContain(HAT_IMAGES.cowboy);
		expect(sourcesOf(bandit)).toContain(PIG_FRAMES.bandit.idle_1);
		expect(sourcesOf(bandit).some((src) => allSkins.has(src))).toBe(false);
		act(() => bandit.unmount());
		const pepper = await renderStage(
			<PigStage pigId="pepper" pigFrozen equipped={hat} equippedCostume={costume(COUNT_SNOUT)} />,
		);
		expect(sourcesOf(pepper)).toContain(HAT_IMAGES.cowboy);
		expect(sourcesOf(pepper)).toContain(PIG_FRAMES.pepper.idle_1);
		act(() => pepper.unmount());
	});

	test("a list avatar's icon is the drawn pig's own skin, or its outfit", async () => {
		const pepper = await renderStage(<PigAvatar pigId="pepper" hatId="cowboy" costumeId={HOLLOW_JACK} />);
		expect(sourcesOf(pepper)).toContain(pepperSkin.idle_1);
		expect(sourcesOf(pepper)).not.toContain(mockSkin.idle_1);
		act(() => pepper.unmount());
		const bandit = await renderStage(<PigAvatar pigId="bandit" hatId="cowboy" costumeId={HOLLOW_JACK} />);
		expect(sourcesOf(bandit)).not.toContain(mockSkin.idle_1);
		expect(sourcesOf(bandit)).not.toContain(pepperSkin.idle_1);
		if (HAT_IMAGES.cowboy) expect(sourcesOf(bandit)).toContain(HAT_IMAGES.cowboy);
		act(() => bandit.unmount());
	});
});

describe("costume copy", () => {
	const ids = {
		active_hat_id: "cowboy",
		active_bow_id: "pink_bow",
		active_glasses_id: "aviators",
		active_tickle_particle_id: "hearts",
	};

	test("names only the covered slots that hold something", () => {
		expect(slotsWaitingUnder(ids)).toEqual(["head", "bow", "face"]);
		expect(costumeOnLine("Hollow Jack", ids)).toBe("Hollow Jack is on. Hat, Bow and Face wait underneath.");
		expect(costumeOnLine("Moonpuff", { active_bow_id: "pink_bow" })).toBe("Moonpuff is on. Bow waits underneath.");
		expect(costumeOnLine("Moonpuff", {})).toBe("Moonpuff is on.");
	});

	test("the take-off toast and the cover line", () => {
		expect(costumeOffLine("Hollow Jack", { active_hat_id: "a", active_bow_id: "b" })).toBe(
			"Hollow Jack is off. Your hat and bow are back.",
		);
		expect(costumeOffLine("Hollow Jack", { active_aura_id: "a" })).toBe("Hollow Jack is off. Your aura is back.");
		expect(costumeCoverLine(ids)).toBe(
			"Covers everything but her face and hooves. Your hat, bow and glasses stay put underneath.",
		);
		expect(costumeCoverLine({})).toBe("Covers everything but her face and hooves.");
		expect(costumeCoverLine({}, "bandit")).toBe("Covers everything but his face and hooves.");
	});

	test("equip gate: per pig, a short toast naming who can wear it", () => {
		expect(costumeEquipRefusal("costume", HOLLOW_JACK, "rosie")).toBeNull();
		expect(costumeEquipRefusal("costume", HOLLOW_JACK, "pepper")).toBeNull();
		expect(costumeEquipRefusal("costume", HOLLOW_JACK, "bandit")).toBe(
			"Hollow Jack isn't sewn for Bandit yet. Rosie and Pepper can wear it.",
		);
		expect(costumeEquipRefusal("costume", COUNT_SNOUT, "pepper")).toBe(
			"Count Snout isn't sewn for Pepper yet. Switch to Rosie to wear it.",
		);
		expect(costumeEquipRefusal("costume", STARSPELL, "biscuit")).toBeNull();
		expect(costumeNotFittedLine(HOLLOW_JACK, "copper")).toBe(
			"Hollow Jack isn't sewn for Copper yet. Rosie and Pepper can wear it.",
		);
		expect(costumeEquipRefusal("costume", null, "pepper")).toBeNull();
		expect(costumeEquipRefusal("hat", "cowboy", "pepper")).toBeNull();
		const worn = { active_costume_id: HOLLOW_JACK, active_hat_id: "cowboy" };
		expect(costumeTakeOffToast("costume", null, worn, () => "Hollow Jack")).toBe(
			"Hollow Jack is off. Your hat is back.",
		);
		expect(costumeTakeOffToast("costume", HOLLOW_JACK, worn, () => "x")).toBeNull();
	});

	test("the equip toast: a costume on a pig without its skin stops before the server", () => {
		const toast = jest.fn();
		expect(stopCostumeEquip("costume", HOLLOW_JACK, "bandit", toast)).toBe(true);
		expect(toast).toHaveBeenCalledWith({
			tone: "info",
			title: "Hollow Jack isn't sewn for Bandit yet. Rosie and Pepper can wear it.",
		});
		toast.mockClear();
		// Fits, taking one off, any other slot, and an unknown costume's own line.
		expect(stopCostumeEquip("costume", HOLLOW_JACK, "pepper", toast)).toBe(false);
		expect(stopCostumeEquip("costume", null, "bandit", toast)).toBe(false);
		expect(stopCostumeEquip("hat", "cowboy", "bandit", toast)).toBe(false);
		expect(toast).not.toHaveBeenCalled();
		expect(stopCostumeEquip("costume", MOONPUFF, "rosie", toast)).toBe(true);
		expect(toast).toHaveBeenCalledWith({ tone: "info", title: COSTUME_NOT_READY_LINE });
	});

	test("the tile tag says what a costume fits on a pig it does not", () => {
		expect(costumeTileTag(HOLLOW_JACK, "pepper")).toBe("costume");
		expect(costumeTileTag(HOLLOW_JACK, "bandit")).toBe("not for Bandit");
		expect(costumeTileTag(COUNT_SNOUT, "pepper")).toBe("fits Rosie");
		expect(costumeTileTag(STARSPELL, "pickles")).toBe("costume");
	});

	test("the coverage line reads the manifest: Rosie alone, a partial set, every pig", () => {
		expect(costumeCoverageLine([COUNT_SNOUT])).toBe("Rosie only for now: a companion pig swaps to her first.");
		expect(costumeCoverageLine([HOLLOW_JACK])).toBe("Fitted to Rosie and Pepper for now.");
		expect(costumeCoverageLine([HOLLOW_JACK, COUNT_SNOUT])).toBe("Fitted to Rosie for now. Some fit Pepper too.");
		expect(costumeCoverageLine([STARSPELL])).toBe("Every pig in the herd can wear one.");
		expect(costumeCoverageLine([MOONPUFF])).toBe("Each costume says which pigs it fits.");
	});

	test("the stall intro's costume card: Rosie-only words only while only Rosie fits", () => {
		const item = (id: string, name: string, category = "costume") =>
			({ id, name, category, rarity: "legendary", cost: 3000 }) as unknown as ShelfItem;
		const shelf = {
			key: "halloween_2026",
			title: "Spooky Snouts",
			theme: { intro_costume_id: STARSPELL },
		} as unknown as SeasonalShelf;
		const card = (items: ShelfItem[]) => {
			const c = stallIntroCards(shelf, items, Date.UTC(2026, 9, 29, 12)).find((x) => x.id === "costumes");
			return c && c.id === "costumes" ? c : null;
		};
		const rosieOnly = card([item(COUNT_SNOUT, "Count Snout")])!;
		expect(rosieOnly.body).toBe("A full costume turns Rosie into someone else, head to hoof, front and side.");
		expect(rosieOnly.hand).toContain("Rosie only for now");
		const partial = card([item(HOLLOW_JACK, "Hollow Jack"), item(COUNT_SNOUT, "Count Snout")])!;
		expect(partial.body).toContain("turns your pig into someone else");
		expect(partial.hand).toContain("Fitted to Rosie for now. Some fit Pepper too.");
		expect(partial.hand).not.toMatch(/Rosie only/);
		const full = card([item(STARSPELL, "Starspell")])!;
		expect(full.costume.id).toBe(STARSPELL);
		expect(full.hand).toContain("Every pig in the herd can wear one.");
		expect(full.hand.startsWith("The hat, bow and the rest")).toBe(true);
		expect(`${full.body} ${full.hand}`).not.toMatch(/Rosie only/);
	});

	test("no em dashes in anything a costume says", () => {
		for (const line of [
			costumeOnLine("Hollow Jack", ids),
			costumeOffLine("Hollow Jack", ids),
			costumeCoverLine(ids),
			costumeEquipRefusal("costume", HOLLOW_JACK, "bandit") ?? "",
			costumeEquipRefusal("costume", COUNT_SNOUT, "pepper") ?? "",
			costumeTileTag(HOLLOW_JACK, "bandit"),
			costumeCoverageLine([HOLLOW_JACK, COUNT_SNOUT]),
			costumeCoverageLine([STARSPELL]),
			COSTUME_NOT_READY_LINE,
		]) {
			expect(line).not.toMatch(/—/);
		}
	});
});

describe("the costume catalog is one id list", () => {
	const content = JSON.parse(
		fs.readFileSync(path.join(__dirname, "../docs/design/halloween-2026/content.json"), "utf8"),
	) as { wearables: { id: string; category: string; name: string }[] };
	const designed = content.wearables.filter((w) => w.category === "costume");
	const migration = fs.readFileSync(
		path.join(__dirname, "../supabase/migrations/20261029240000_halloween_costumes.sql"),
		"utf8",
	);
	const sold = [...migration.matchAll(/\('(halloween_2026_[a-z_]+_costume)',\s*'([^']+)'[^)]*'costume',\s*'legendary'/g)];

	test("names match the designed set and every sold row", () => {
		expect(Object.keys(COSTUME_NAMES).sort()).toEqual(designed.map((w) => w.id).sort());
		for (const w of designed) expect(COSTUME_NAMES[w.id]).toBe(w.name);
		for (const [, id, name] of sold) expect(COSTUME_NAMES[id]).toBe(name);
	});
});

describe("scripts/gen_costume_frames.mjs emit rule", () => {
	const script = path.join(__dirname, "../scripts/gen_costume_frames.mjs");
	type Scan = {
		complete: Record<string, { slug: string; pigs: Record<string, { name: string; file: string }[]> }>;
		incomplete: Record<string, string[]>;
		ignored: string[];
		text: string;
	};
	const run = (dir: string, onlyRosie = false) =>
		JSON.parse(
			execFileSync(
				process.execPath,
				[
					"--input-type=module",
					"-e",
					`const m = await import(${JSON.stringify(script)});` +
						`const s = m.scanSkins(${JSON.stringify(dir)}${onlyRosie ? ", { include: (f) => !/\\/(bandit|biscuit|copper|pepper|pickles)\\//.test(f) }" : ""});` +
						`console.log(JSON.stringify({ ...s, text: m.render(s.complete) }));`,
				],
				{ encoding: "utf8" },
			),
		) as Scan;
	const full = FAMILIES.flatMap((f) => [1, 2, 3, 4].map((n) => `${f}_${n}`));

	test("each (costume, pig) pair is emitted only with all six families, four frames each", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "costume-skins-"));
		const write = (rel: string, names: string[]) => {
			fs.mkdirSync(path.join(dir, rel), { recursive: true });
			for (const name of names) fs.writeFileSync(path.join(dir, rel, `${name}.png`), "");
		};
		write("hollow-jack", [...full, "sad_1"]); // Rosie, complete (+ an extra)
		write("hollow-jack/pepper", full); // Pepper, complete
		write("hollow-jack/bandit", full.filter((n) => n !== "walk_4")); // Bandit, one short
		fs.mkdirSync(path.join(dir, "hollow-jack/copper")); // Copper, not started
		write("hollow-jack/wolf", full); // not a pig
		write("count-snout", full.filter((n) => n !== "walk_4")); // Rosie, one short
		write("count-snout/pickles", full); // Pickles only
		write("moonpuff", full.filter((n) => !n.startsWith("face_sit")));
		const out = run(dir);
		expect(Object.keys(out.complete).sort()).toEqual([
			"halloween_2026_count_snout_costume",
			"halloween_2026_hollow_jack_costume",
		]);
		expect(Object.keys(out.complete.halloween_2026_hollow_jack_costume.pigs)).toEqual(["rosie", "pepper"]);
		expect(Object.keys(out.complete.halloween_2026_count_snout_costume.pigs)).toEqual(["pickles"]);
		expect(out.incomplete["hollow-jack/bandit"]).toEqual(["walk_4"]);
		expect(out.incomplete["count-snout"]).toEqual(["walk_4"]);
		expect(out.incomplete.moonpuff).toHaveLength(4);
		expect(out.incomplete["hollow-jack/copper"]).toBeUndefined();
		expect(out.ignored).toEqual(["hollow-jack/wolf"]);
		// Rosie from the top level, every other pig from its own folder.
		expect(out.text).toContain('face_sit_1: require("../assets/images/sprites/costumes/hollow-jack/face_sit_1.png"),');
		expect(out.text).toContain('idle_1: require("../assets/images/sprites/costumes/hollow-jack/pepper/idle_1.png"),');
		expect(out.text).toContain('idle_1: require("../assets/images/sprites/costumes/count-snout/pickles/idle_1.png"),');
		expect(out.text).toContain("sad_1: require(");
		expect(out.text).not.toContain("hollow-jack/bandit");
		expect(out.text).not.toContain("wolf");
		expect(out.text).not.toContain("moonpuff");
		expect(out.text).toMatch(/halloween_2026_hollow_jack_costume: \{\n\t\trosie: \{[\s\S]*\n\t\tpepper: \{/);
		// A file filter (the --tracked mode) narrows the pairs, never mixes them.
		const rosieOnly = run(dir, true);
		expect(Object.keys(rosieOnly.complete)).toEqual(["halloween_2026_hollow_jack_costume"]);
		expect(Object.keys(rosieOnly.complete.halloween_2026_hollow_jack_costume.pigs)).toEqual(["rosie"]);
		fs.rmSync(dir, { recursive: true, force: true });
	});

	// No freshness test here on purpose: skins land in the tree while the art
	// is still being drawn, and the generated file is rerun at freeze
	// (`node scripts/gen_costume_frames.mjs --check` says when it is stale).
});
