// Full costumes (Halloween 2026), the skin swap: a worn costume is drawn as
// its own sprite set of Rosie wearing it (constants/costumeFrames.generated.ts),
// pose for pose in place of her frames, and hides every other worn item.
// utils/costumeFit.ts + utils/costumeCopy.ts + PigStage/SpritePig + the slot
// routing + the catalog's one id list + the generator's emit rule.
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

// One complete stand-in skin (24 frames, numeric sources 9000+) and nothing
// else: a stand-in for what scripts/gen_costume_frames.mjs emits.
const FAMILIES = ["idle", "happy", "surprise", "face", "face_sit", "walk"];
jest.mock("../constants/costumeFrames.generated", () => {
	const skin: Record<string, number> = {};
	["idle", "happy", "surprise", "face", "face_sit", "walk"].forEach((family, f) => {
		for (let n = 1; n <= 4; n += 1) skin[`${family}_${n}`] = 9000 + f * 10 + n;
	});
	return { COSTUME_FRAMES: { halloween_2026_hollow_jack_costume: skin } };
});

import { PigStage } from "../components/ui/PigStage";
import { COSTUME_NAMES, COSTUME_THUMBNAILS } from "../constants/costumes";
import { HAT_IMAGES } from "../constants/hats";
import { PIG_FRAMES } from "../constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "../constants/pigFramesExtra";
import { SLOT_LABEL, SLOT_ORDER, columnForCategory, slotForCategory } from "../constants/slots";
import { computeEquip } from "../utils/cosmetics";
import {
	costumeName,
	costumeSkinFor,
	costumeSkinFrameName,
	costumeSkinSource,
	isCostumeAvailable,
	pigCanWearCostume,
} from "../utils/costumeFit";
import {
	COSTUME_NOT_READY_LINE,
	costumeCoverLine,
	costumeEquipRefusal,
	costumeOffLine,
	costumeOnLine,
	costumeTakeOffToast,
	slotsWaitingUnder,
} from "../utils/costumeCopy";
import { costumeSlot } from "../utils/wornCostumes";
import { COSTUME_FRAMES } from "../constants/costumeFrames.generated";

const mockSkin = COSTUME_FRAMES.halloween_2026_hollow_jack_costume as Record<string, number>;

const HOLLOW_JACK = "halloween_2026_hollow_jack_costume";
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

describe("availability: only a complete skin is a costume", () => {
	test("a costume with a skin is available on Rosie only", () => {
		expect(isCostumeAvailable(HOLLOW_JACK)).toBe(true);
		expect(costumeSkinFor("rosie", HOLLOW_JACK)).toBe(mockSkin);
		expect(costumeSkinFor(undefined, HOLLOW_JACK)).toBe(mockSkin);
		expect(costumeSkinFor("pepper", HOLLOW_JACK)).toBeNull();
		expect(pigCanWearCostume("bandit")).toBe(false);
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

	test("a skinless costume, or another pig, keeps the ordinary outfit", async () => {
		const skinless = await renderStage(<PigStage pigFrozen equipped={hat} equippedCostume={costume(MOONPUFF)} />);
		expect(sourcesOf(skinless)).toContain(HAT_IMAGES.cowboy);
		expect(sourcesOf(skinless)).toContain(PIG_FRAMES.rosie.idle_1);
		act(() => skinless.unmount());
		const pepper = await renderStage(
			<PigStage pigId="pepper" pigFrozen equipped={hat} equippedCostume={costume(HOLLOW_JACK)} />,
		);
		expect(sourcesOf(pepper)).toContain(HAT_IMAGES.cowboy);
		expect(sourcesOf(pepper)).toContain(PIG_FRAMES.pepper.idle_1);
		act(() => pepper.unmount());
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
	});

	test("equip gate: Rosie only, and the toast only on a costume take-off", () => {
		expect(costumeEquipRefusal("costume", HOLLOW_JACK, "rosie")).toBeNull();
		expect(costumeEquipRefusal("costume", HOLLOW_JACK, "pepper")).toMatch(/Rosie/);
		expect(costumeEquipRefusal("costume", null, "pepper")).toBeNull();
		expect(costumeEquipRefusal("hat", "cowboy", "pepper")).toBeNull();
		const worn = { active_costume_id: HOLLOW_JACK, active_hat_id: "cowboy" };
		expect(costumeTakeOffToast("costume", null, worn, () => "Hollow Jack")).toBe(
			"Hollow Jack is off. Your hat is back.",
		);
		expect(costumeTakeOffToast("costume", HOLLOW_JACK, worn, () => "x")).toBeNull();
	});

	test("no em dashes in anything a costume says", () => {
		for (const line of [
			costumeOnLine("Hollow Jack", ids),
			costumeOffLine("Hollow Jack", ids),
			costumeCoverLine(ids),
			costumeEquipRefusal("costume", HOLLOW_JACK, "pepper") ?? "",
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
	const run = (dir: string) =>
		JSON.parse(
			execFileSync(
				process.execPath,
				[
					"--input-type=module",
					"-e",
					`const m = await import(${JSON.stringify(script)});` +
						`const s = m.scanSkins(${JSON.stringify(dir)});` +
						`console.log(JSON.stringify({ ids: Object.keys(s.complete), incomplete: s.incomplete, text: m.render(s.complete) }));`,
				],
				{ encoding: "utf8" },
			),
		) as { ids: string[]; incomplete: Record<string, string[]>; text: string };

	test("only skins with all six families, four frames each, are emitted", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "costume-skins-"));
		const write = (slug: string, names: string[]) => {
			fs.mkdirSync(path.join(dir, slug), { recursive: true });
			for (const name of names) fs.writeFileSync(path.join(dir, slug, `${name}.png`), "");
		};
		const full = FAMILIES.flatMap((f) => [1, 2, 3, 4].map((n) => `${f}_${n}`));
		write("hollow-jack", [...full, "sad_1"]);
		write("count-snout", full.filter((n) => n !== "walk_4"));
		write("moonpuff", full.filter((n) => !n.startsWith("face_sit")));
		const out = run(dir);
		expect(out.ids).toEqual(["halloween_2026_hollow_jack_costume"]);
		expect(out.incomplete["count-snout"]).toEqual(["walk_4"]);
		expect(out.incomplete.moonpuff).toHaveLength(4);
		expect(out.text).toContain('face_sit_1: require("../assets/images/sprites/costumes/hollow-jack/face_sit_1.png"),');
		expect(out.text).toContain("sad_1: require(");
		expect(out.text).not.toContain("count-snout");
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test("the committed file is current", () => {
		execFileSync(process.execPath, [script, "--check"], { encoding: "utf8" });
	});
});
