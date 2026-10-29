import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image } from "react-native";
import { CostumeRosieStage } from "@/components/prototypes/card-packs/CostumeRosieStage";
import CostumeFittingRoom from "@/components/prototypes/card-packs/CostumeFittingRoom";
import { PIG_ATTACHMENT_FRAMES } from "@/constants/pigAttachmentFrames.generated";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "@/constants/pigFramesExtra";
import { ROSIE_COSTUME_FITS } from "@/features/cards/data/costumeFits";

const ROSIE_FRAMES = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };

describe("Rosie full-body costume fitting", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders the selected costume layers against the source frame on one clock", async () => {
    const fit = ROSIE_COSTUME_FITS.find((item) => item.name === "Count Snout")!;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CostumeRosieStage fit={fit}/>);
    });

    const images = () => renderer.root.findAllByType(Image);
    expect(images().map((image) => image.props.source)).toEqual([
      ROSIE_FRAMES.idle_1,
      fit.hoodSource,
      fit.romperSource,
    ]);

    await act(async () => {
      jest.advanceTimersByTime(6 * (1000 / 6));
    });
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_7);
    expect(images()[1].props.source).toBe(fit.hoodSource);
    expect(images()[2].props.source).toBe(fit.romperSource);
    await act(async () => {
      renderer.update(<CostumeRosieStage fit={null}/>);
    });
    expect(images()).toHaveLength(1);
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_7);
    await act(async () => { jest.advanceTimersByTime(1000 / 6); });
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_8);
    act(() => renderer.unmount());
  });

  it("keeps the animated source clock continuous while changing or removing costumes", async () => {
    const first = ROSIE_COSTUME_FITS[0];
    const second = ROSIE_COSTUME_FITS[1];
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CostumeRosieStage fit={first}/>);
    });

    const images = () => renderer.root.findAllByType(Image);
    await act(async () => jest.advanceTimersByTime(6 * (1000 / 6)));
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_7);

    await act(async () => renderer.update(<CostumeRosieStage fit={second}/>));
    expect(images().map((image) => image.props.source)).toEqual([
      ROSIE_FRAMES.idle_7,
      second.hoodSource,
      second.romperSource,
    ]);

    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_8);

    await act(async () => renderer.update(<CostumeRosieStage fit={null}/>));
    expect(images()).toHaveLength(1);
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_8);
    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(images()[0].props.source).toBe(ROSIE_FRAMES.idle_9);
    act(() => renderer.unmount());
  });

  it("animates every costume over Rosie's complete twelve-frame idle", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CostumeRosieStage fit={ROSIE_COSTUME_FITS[0]}/>);
    });

    for (const fit of ROSIE_COSTUME_FITS) {
      await act(async () => renderer.update(<CostumeRosieStage fit={fit}/>));
      expect(renderer.root.findAllByType(Image).map((image) => image.props.source)).toEqual([
        expect.anything(),
        fit.hoodSource,
        fit.romperSource,
      ]);
    }

    const seen = new Set<unknown>();
    for (let frame = 0; frame < 12; frame += 1) {
      seen.add(renderer.root.findAllByType(Image)[0].props.source);
      await act(async () => jest.advanceTimersByTime(1000 / 6));
    }
    expect(seen).toEqual(new Set(Array.from(
      { length: 12 },
      (_, index) => ROSIE_FRAMES[`idle_${index + 1}` as keyof typeof ROSIE_FRAMES],
    )));
    act(() => renderer.unmount());
  });

  it("stops offscreen and honors reduced motion without advancing the dressed pig", async () => {
    const fit = ROSIE_COSTUME_FITS[0];
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CostumeRosieStage fit={fit} active={false}/>);
    });
    const pigSource = () => renderer.root.findAllByType(Image)[0].props.source;
    await act(async () => jest.advanceTimersByTime(2000));
    expect(pigSource()).toBe(ROSIE_FRAMES.idle_1);

    await act(async () => renderer.update(<CostumeRosieStage fit={fit} active reduceMotion/>));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(pigSource()).toBe(ROSIE_FRAMES.idle_1);
    expect(renderer.root.findAllByType(Image).slice(1).map((image) => image.props.source)).toEqual([
      fit.hoodSource,
      fit.romperSource,
    ]);
    act(() => renderer.unmount());
  });

  it("uses one controlled gallery frame for every pig and costume layer without starting timers", async () => {
    const fits = Array.from({ length: 12 }, (_, index) => ROSIE_COSTUME_FITS[index % ROSIE_COSTUME_FITS.length]);
    const intervalSpy = jest.spyOn(global, "setInterval");
    let renderer!: TestRenderer.ReactTestRenderer;
    const gallery = (frameIndex: number) => <>
      {fits.map((fit, index) => (
        <CostumeRosieStage
          key={`${fit.id}-${index}`}
          fit={fit}
          frameIndex={frameIndex}
          showControls={false}
        />
      ))}
    </>;

    await act(async () => {
      renderer = TestRenderer.create(gallery(7));
    });
    expect(intervalSpy).not.toHaveBeenCalled();

    const images = () => renderer.root.findAllByType(Image);
    const frameEightCrown = PIG_ATTACHMENT_FRAMES.rosie.idle_8;
    const referenceCrown = PIG_ATTACHMENT_FRAMES.rosie.idle_1;
    for (let index = 0; index < fits.length; index += 1) {
      const [pig, hood, romper] = images().slice(index * 3, index * 3 + 3);
      expect(pig.props.source).toBe(ROSIE_FRAMES.idle_8);
      expect(hood.props.source).toBe(fits[index].hoodSource);
      expect(romper.props.source).toBe(fits[index].romperSource);
      expect(hood.props.style[2]).toMatchObject({
        left: fits[index].hood.left + frameEightCrown.x - referenceCrown.x,
        top: fits[index].hood.top + frameEightCrown.y - referenceCrown.y,
        transform: [
          { rotate: `${frameEightCrown.rotation - referenceCrown.rotation}deg` },
          { scale: frameEightCrown.scale / referenceCrown.scale },
        ],
      });
    }

    await act(async () => renderer.update(gallery(11)));
    expect(images().filter((_, index) => index % 3 === 0).map((image) => image.props.source))
      .toEqual(Array(12).fill(ROSIE_FRAMES.idle_12));
    await act(async () => renderer.update(gallery(0)));
    expect(images().filter((_, index) => index % 3 === 0).map((image) => image.props.source))
      .toEqual(Array(12).fill(ROSIE_FRAMES.idle_1));
    expect(images().filter((_, index) => index % 3 === 1).map((image) => image.props.source))
      .toEqual(fits.map((fit) => fit.hoodSource));
    expect(images().filter((_, index) => index % 3 === 2).map((image) => image.props.source))
      .toEqual(fits.map((fit) => fit.romperSource));
    expect(intervalSpy).not.toHaveBeenCalled();
    act(() => renderer.unmount());
    intervalSpy.mockRestore();
  });

  it("steps all twelve source frames with accessible previous and next controls", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CostumeRosieStage fit={ROSIE_COSTUME_FITS[0]}/>);
    });
    const image = () => renderer.root.findAllByType(Image)[0];
    const previous = renderer.root.findByProps({ accessibilityLabel: "Previous idle frame" });
    const next = renderer.root.findByProps({ accessibilityLabel: "Next idle frame" });
    act(() => previous.props.onPress());
    expect(image().props.source).toBe(ROSIE_FRAMES.idle_12);
    act(() => next.props.onPress());
    expect(image().props.source).toBe(ROSIE_FRAMES.idle_1);
    act(() => renderer.unmount());
  });

  it("previews a locked costume but refuses to equip it until owned", async () => {
    const locked = ROSIE_COSTUME_FITS.find((item) => item.name === "Moonpuff")!;
    const onEquip = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CostumeFittingRoom ownedCostumeIds={[]} equippedCostumeId={null} onEquip={onEquip}/>);
    });
    act(() => renderer.root.findByProps({ accessibilityLabel: "Moonpuff, locked, preview" }).props.onPress());
    const lockedButton = renderer.root.findByProps({ accessibilityLabel: "Try on Moonpuff" });
    expect(lockedButton.props.accessibilityState).toEqual({ disabled: true });
    expect(lockedButton.props.disabled).toBe(true);
    expect(renderer.root.findAllByType(Image).map((node) => node.props.source)).toEqual([
      ROSIE_FRAMES.idle_1,
      locked.hoodSource,
      locked.romperSource,
    ]);
    expect(onEquip).not.toHaveBeenCalled();

    await act(async () => {
      renderer.update(<CostumeFittingRoom ownedCostumeIds={[locked.id]} equippedCostumeId={null} onEquip={onEquip}/>);
    });
    act(() => renderer.root.findByProps({ accessibilityLabel: "Try on Moonpuff" }).props.onPress());
    expect(onEquip).toHaveBeenCalledWith(locked.id);
    act(() => renderer.unmount());
  });
});
