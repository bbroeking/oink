import {
	RIVE_PIG_ANIMATION_COMMANDS,
	RIVE_PIG_INPUTS,
	RIVE_PIG_PROTOTYPE_ANIMATIONS,
	RIVE_PIG_SKIN_ASSET,
	RIVE_PIG_SKIN_INDEX,
	hasCompleteRiveSkinMap,
	isRivePigPrototypeAnimation,
	resolveRivePigEquipment,
} from "@/components/ui/rivePigContract";
import {
	PIG_ANIMATION_SPECS,
	pigMoodAnimation,
} from "@/components/ui/pigRendererContract";
import { PIG_IDS } from "@/utils/pigs";
import { shouldUseRiveRenderer } from "@/components/ui/PigRenderer";

describe("Rive pig contract", () => {
	it("maps every pig to one stable sequential skin index", () => {
		expect(RIVE_PIG_SKIN_ASSET).toBe("pig_skin");
		expect(hasCompleteRiveSkinMap()).toBe(true);
		expect(Object.keys(RIVE_PIG_SKIN_INDEX)).toEqual(PIG_IDS);
		expect(PIG_IDS.map((pigId) => RIVE_PIG_SKIN_INDEX[pigId])).toEqual([
			0, 1, 2, 3, 4, 5,
		]);
	});

	it("covers every renderer animation without a skin-specific command", () => {
		expect(Object.keys(RIVE_PIG_ANIMATION_COMMANDS)).toEqual(
			Object.keys(PIG_ANIMATION_SPECS),
		);
		expect(RIVE_PIG_ANIMATION_COMMANDS.bounce).toEqual(
			RIVE_PIG_ANIMATION_COMMANDS.jump,
		);
		expect(RIVE_PIG_PROTOTYPE_ANIMATIONS).toEqual(["idle", "jump", "wave"]);
	});

	it.each([
		["idle", true],
		["jump", true],
		["wave", true],
		["walk", false],
		["happy", false],
		["sad", false],
		["tired", false],
		["surprise", false],
	] as const)("only activates the authored prototype animation set: %s", (animation, expected) => {
		expect(isRivePigPrototypeAnimation(animation)).toBe(expected);
	});

	it("uses numeric rest states for idle, sad, and tired", () => {
		expect(RIVE_PIG_ANIMATION_COMMANDS.idle).toEqual({
			kind: "rest",
			value: 0,
		});
		expect(RIVE_PIG_ANIMATION_COMMANDS.sad).toEqual({
			kind: "rest",
			value: 1,
		});
		expect(RIVE_PIG_ANIMATION_COMMANDS.tired).toEqual({
			kind: "rest",
			value: 2,
		});
	});

	it("maps the three spike cosmetics to internal selectors", () => {
		expect(
			resolveRivePigEquipment({
				headId: "party",
				faceId: "pixel_glasses",
				heldId: "garden_trowel_held",
			}),
		).toEqual({
			supported: true,
			equipment: { hat: 1, face: 1, held: 1 },
		});
		expect(RIVE_PIG_INPUTS.hat).toBe("equip_hat");
		expect(RIVE_PIG_INPUTS.face).toBe("equip_face");
		expect(RIVE_PIG_INPUTS.held).toBe("equip_held");
	});

	it.each([
		{ headId: "cowboy" },
		{ faceId: "monocle" },
		{ heldId: "sword_held" },
		{ maskId: "mud_mask" },
		{ neckId: "red_scarf" },
	])("forces unsupported anchored equipment back to raster: %o", (selection) => {
		expect(resolveRivePigEquipment(selection).supported).toBe(false);
	});

	it("allows an unequipped pig on the Rive spike", () => {
		expect(resolveRivePigEquipment({})).toEqual({
			supported: true,
			equipment: { hat: 0, face: 0, held: 0 },
		});
	});

	it("keeps raster as the default and requires an explicit local Rive asset", () => {
		expect(shouldUseRiveRenderer({})).toBe(false);
		expect(shouldUseRiveRenderer({ renderer: "rive" })).toBe(false);
		expect(
			shouldUseRiveRenderer({ renderer: "rive", riveSource: 123 }),
		).toBe(false);
		expect(
			shouldUseRiveRenderer({
				renderer: "rive",
				riveSource: 123,
				rolloutEnabled: true,
			}),
		).toBe(true);
	});

	it.each([
		{ hasCustomFrames: true },
		{ frameIdx: 0 },
		{ skinTintOverride: "#ffd700" },
		{ reduceMotion: true },
		{ equipmentSupported: false },
	])("keeps raster for raster-only behavior: %o", (constraint) => {
		expect(
			shouldUseRiveRenderer({
				renderer: "rive",
				riveSource: 123,
				rolloutEnabled: true,
				...constraint,
			}),
		).toBe(false);
	});

	it("keeps mood semantic while resolving the shared resting animation", () => {
		expect(pigMoodAnimation("content")).toBe("idle");
		expect(pigMoodAnimation("happy")).toBe("happy");
		expect(pigMoodAnimation("sad")).toBe("sad");
		expect(pigMoodAnimation("tired")).toBe("tired");
	});
});
