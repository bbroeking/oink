// Full costumes (Halloween 2026): the slot, the fit rule, the hide rule, and
// the copy. utils/costumeFit.ts + utils/costumeCopy.ts + PigStage's costume
// layers + constants/slots.ts routing + the catalog's one id list.
import fs from "fs";
import path from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PigStage } from "../components/ui/PigStage";
import { COSTUME_THUMBNAILS } from "../constants/costumes";
import { HAT_IMAGES } from "../constants/hats";
import { PIG_FRAMES } from "../constants/pigFrames.generated";
import {
	SLOT_LABEL,
	SLOT_ORDER,
	columnForCategory,
	slotForCategory,
} from "../constants/slots";
import { ROSIE_COSTUME_FITS } from "../features/cards/data/costumeFits";
import { computeEquip } from "../utils/cosmetics";
import {
	costumeAnimation,
	costumeFitFor,
	costumeLayout,
	costumeReaction,
	pigCanWearCostume,
} from "../utils/costumeFit";
import {
	costumeCoverLine,
	costumeEquipRefusal,
	costumeOffLine,
	costumeOnLine,
	costumeTakeOffToast,
	slotsWaitingUnder,
} from "../utils/costumeCopy";

const HOLLOW_JACK = "halloween_2026_hollow_jack_costume";
const MOONPUFF = "halloween_2026_moonpuff_costume";
const costume = (id: string) => ({ id, category: "costume", emoji: null });
const hat = { id: "cowboy", category: "hat", emoji: null };

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
		expect(on.activeIds).toMatchObject({ ...current, active_costume_id: HOLLOW_JACK });
		const off = computeEquip("costume", null, on.activeIds);
		expect(off.update).toEqual({ active_costume_id: null });
		expect(off.activeIds).toMatchObject(current);
	});
});

describe("costume fit rule", () => {
	test("only Rosie wears the v1 art; unknown ids draw nothing", () => {
		expect(costumeFitFor("rosie", HOLLOW_JACK)?.name).toBe("Hollow Jack");
		expect(costumeFitFor(undefined, HOLLOW_JACK)?.name).toBe("Hollow Jack");
		expect(costumeFitFor("pepper", HOLLOW_JACK)).toBeNull();
		expect(costumeFitFor("rosie", "not_a_costume")).toBeNull();
		expect(costumeFitFor("rosie", null)).toBeNull();
		expect(pigCanWearCostume("rosie")).toBe(true);
		expect(pigCanWearCostume("bandit")).toBe(false);
	});

	test("a costumed pig plays front families only", () => {
		for (const front of ["idle", "sit", "happy", "surprise", "walk"] as const) {
			expect(costumeAnimation(front)).toBe(front);
		}
		expect(costumeAnimation("face")).toBe("idle");
		expect(costumeAnimation("face_sit")).toBe("sit");
		expect(costumeAnimation("sad")).toBe("idle");
		expect(costumeAnimation("tired")).toBe("idle");
		expect(costumeAnimation("jump")).toBe("happy");
		expect(costumeAnimation("bounce")).toBe("happy");
		expect(costumeAnimation("wave")).toBe("happy");
		expect(costumeReaction({ id: 4, kind: "jump" })).toEqual({ id: 4, kind: "happy" });
		const surprise = { id: 5, kind: "surprise" as const };
		expect(costumeReaction(surprise)).toBe(surprise);
		expect(costumeReaction(null)).toBeNull();
	});

	test("idle_1 places the layers exactly where they were painted", () => {
		const fit = costumeFitFor("rosie", HOLLOW_JACK)!;
		const { hood, romper } = costumeLayout(fit, "idle_1", 300);
		expect(hood).toMatchObject({ left: -30, top: -60, width: 360, height: 320, rotate: 0, scale: 1 });
		// The pivot is Rosie's measured crown (154, 16) relative to the hood's centre.
		expect(hood.pivotX).toBeCloseTo(30 + 154 - 180);
		expect(hood.pivotY).toBeCloseTo(60 + 16 - 160);
		expect(romper).toEqual({ left: 2, top: 136, width: 260, height: 213 });
	});

	test("the hood follows the measured head per frame; the canvas scales it all", () => {
		const fit = costumeFitFor("rosie", MOONPUFF)!;
		const six = costumeLayout(fit, "idle_6", 300).hood;
		expect(six.left).toBeCloseTo(-30 + 159.4 - 154);
		expect(six.top).toBeCloseTo(-60 + 18 - 16);
		expect(six.rotate).toBeCloseTo(-2.9);
		expect(six.scale).toBeCloseTo(1.062);
		const half = costumeLayout(fit, "idle_1", 150);
		expect(half.romper).toEqual({ left: 1, top: 68, width: 130, height: 106.5 });
		// A frame with no measurement falls back to the reference, never NaN.
		expect(costumeLayout(fit, "nope_1", 300).hood.left).toBe(-30);
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
	const byTestId = (r: TestRenderer.ReactTestRenderer, id: string) =>
		r.root.findAll((n) => n.props?.testID === id);

	async function renderStage(node: React.ReactElement) {
		let r!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			r = TestRenderer.create(node);
		});
		return r;
	}

	test("draws the hood and romper and hides every other worn item", async () => {
		const fit = ROSIE_COSTUME_FITS.find((f) => f.id === HOLLOW_JACK)!;
		const r = await renderStage(
			<PigStage
				pigFrozen
				equipped={hat}
				equippedBow={{ id: "pink_bow", category: "bow", emoji: null }}
				equippedGlasses={{ id: "aviators", category: "glasses", emoji: null }}
				equippedAura={{ id: "gold_aura", category: "aura", emoji: null }}
				equippedHeld={{ id: "magic_wand", category: "held", emoji: null }}
				equippedCostume={costume(HOLLOW_JACK)}
			/>,
		);
		const sources = sourcesOf(r);
		expect(sources).toContain(fit.hoodSource);
		expect(sources).toContain(fit.romperSource);
		expect(sources).toContain(PIG_FRAMES.rosie.idle_1);
		for (const id of ["cowboy", "pink_bow", "aviators", "gold_aura", "magic_wand"]) {
			if (HAT_IMAGES[id]) expect(sources).not.toContain(HAT_IMAGES[id]);
		}
		expect(byTestId(r, "pig-costume-hood").length).toBeGreaterThan(0);
		expect(byTestId(r, "pig-costume-romper").length).toBeGreaterThan(0);
		act(() => r.unmount());
	});

	test("taking it off brings the saved outfit back", async () => {
		const r = await renderStage(<PigStage pigFrozen equipped={hat} equippedCostume={costume(HOLLOW_JACK)} />);
		expect(sourcesOf(r)).not.toContain(HAT_IMAGES.cowboy);
		await act(async () => r.update(<PigStage pigFrozen equipped={hat} equippedCostume={null} />));
		expect(sourcesOf(r)).toContain(HAT_IMAGES.cowboy);
		expect(byTestId(r, "pig-costume-hood")).toHaveLength(0);
		act(() => r.unmount());
	});

	test("a pig the art does not fit keeps its own outfit", async () => {
		const r = await renderStage(
			<PigStage pigId="pepper" pigFrozen equipped={hat} equippedCostume={costume(HOLLOW_JACK)} />,
		);
		expect(sourcesOf(r)).toContain(HAT_IMAGES.cowboy);
		expect(byTestId(r, "pig-costume-hood")).toHaveLength(0);
		act(() => r.unmount());
	});

	test("the turn toward a friend plays the front rest under a costume", async () => {
		const r = await renderStage(
			<PigStage pigFrozen facing="left" equippedCostume={costume(MOONPUFF)} />,
		);
		const sources = sourcesOf(r);
		expect(sources).toContain(PIG_FRAMES.rosie.idle_1);
		expect(sources).not.toContain(PIG_FRAMES.rosie.face_1);
		act(() => r.unmount());
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
		expect(costumeOffLine("Hollow Jack", { active_hat_id: "a" })).toBe("Hollow Jack is off. Your hat is back.");
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
		expect(costumeTakeOffToast("costume", MOONPUFF, worn, () => "Moonpuff")).toBeNull();
		expect(costumeTakeOffToast("hat", null, worn, () => "x")).toBeNull();
	});

	test("no em dashes in anything a costume says", () => {
		const lines = [
			costumeOnLine("Hollow Jack", ids),
			costumeOffLine("Hollow Jack", ids),
			costumeCoverLine(ids),
			costumeEquipRefusal("costume", HOLLOW_JACK, "pepper") ?? "",
		];
		for (const line of lines) expect(line).not.toMatch(/—/);
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
	const soldIds = [...migration.matchAll(/\('(halloween_2026_[a-z_]+_costume)',\s*'([^']+)'[^)]*'costume',\s*'legendary'/g)];

	test("every sold costume has fitted art, a tile and a designed name", () => {
		expect(soldIds.length).toBeGreaterThanOrEqual(10);
		for (const [, id, name] of soldIds) {
			expect(costumeFitFor("rosie", id)?.name).toBe(name);
			expect(COSTUME_THUMBNAILS[id]).toBeDefined();
			expect(HAT_IMAGES[id]).toBe(COSTUME_THUMBNAILS[id]);
			expect(designed.find((w) => w.id === id)?.name).toBe(name);
		}
	});

	test("the fitted set is the designed set", () => {
		expect(ROSIE_COSTUME_FITS.map((f) => f.id).sort()).toEqual(designed.map((w) => w.id).sort());
	});
});
