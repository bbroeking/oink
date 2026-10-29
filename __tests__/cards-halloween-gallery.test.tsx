import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image, Switch, TextInput } from "react-native";
import HalloweenGallery from "@/components/prototypes/card-packs/HalloweenGallery";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "@/constants/pigFramesExtra";

// The UI barrel reaches utils/log; loading the native Sentry SDK starts its
// own cleanup interval, which is unrelated to gallery playback.
jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const ROSIE_FRAMES = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };

async function render(props: React.ComponentProps<typeof HalloweenGallery> = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<HalloweenGallery {...props}/>);
  });
  return renderer;
}

function galleryItems(renderer: TestRenderer.ReactTestRenderer) {
  const byId = new Map<string, TestRenderer.ReactTestInstance>();
  for (const node of renderer.root.findAll(node => typeof node.props.testID === "string" && node.props.testID.startsWith("gallery-item-"))) {
    byId.set(node.props.testID, node);
  }
  return [...byId.values()];
}

function costumeStages(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(node => {
    const label = node.props.accessibilityLabel;
    return typeof label === "string"
      && label.startsWith("Rosie ")
      && !node.findAll(child => child !== node && child.props.accessibilityLabel === label).length;
  });
}

function frameLabel(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ testID: "gallery-frame-label" }).props.children.join("");
}

function pressTestId(renderer: TestRenderer.ReactTestRenderer, testID: string) {
  const node = renderer.root.findAllByProps({ testID }).find(candidate => typeof candidate.props.onPress === "function");
  if (!node) throw new Error(`Missing pressable ${testID}`);
  act(() => node.props.onPress());
}

describe("HalloweenGallery", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("shows 49 unique items with 11 costumes, 29 wearables, and 9 places", async () => {
    const renderer = await render({ reduceMotion: true });
    const ids = galleryItems(renderer).map(node => node.props.testID);
    expect(ids).toHaveLength(49);
    expect(new Set(ids).size).toBe(49);

    const filters = [
      ["Costumes 11", 11],
      ["Wearables 29", 29],
      ["Places 9", 9],
    ] as const;
    for (const [label, count] of filters) {
      act(() => renderer.root.findByProps({ accessibilityLabel: label }).props.onPress());
      expect(galleryItems(renderer)).toHaveLength(count);
    }
    act(() => renderer.unmount());
  });

  it("finds Starspell by name and the final card by printed number 049", async () => {
    const renderer = await render({ reduceMotion: true });
    const search = renderer.root.findByType(TextInput);
    act(() => search.props.onChangeText("Starspell"));
    expect(galleryItems(renderer)).toHaveLength(1);
    expect(galleryItems(renderer)[0].props.testID).toContain("starspell");

    act(() => search.props.onChangeText("049"));
    expect(galleryItems(renderer)).toHaveLength(1);
    expect(galleryItems(renderer)[0].props.testID).toContain("marshmallow_boo");
    act(() => renderer.unmount());
  });

  it("advances all eleven costume tiles and the selected preview on one clock", async () => {
    const renderer = await render();
    expect(costumeStages(renderer)).toHaveLength(12);
    expect(costumeStages(renderer).every(stage => stage.findAllByType(Image)[0].props.source === ROSIE_FRAMES.idle_1)).toBe(true);

    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(costumeStages(renderer)).toHaveLength(12);
    expect(costumeStages(renderer).every(stage => stage.findAllByType(Image)[0].props.source === ROSIE_FRAMES.idle_2)).toBe(true);
    act(() => renderer.unmount());
  });

  it("keeps comparison and manual controls on the shared frame without changing costume layers", async () => {
    const renderer = await render();
    await act(async () => jest.advanceTimersByTime(3 * (1000 / 6)));
    expect(frameLabel(renderer)).toContain("Frame 4");

    pressTestId(renderer, "gallery-original-toggle");
    const original = costumeStages(renderer).find(stage => stage.props.accessibilityLabel.includes("without a costume"));
    expect(original).toBeDefined();
    expect(original!.findAllByType(Image)).toHaveLength(1);
    expect(original!.findAllByType(Image)[0].props.source).toBe(ROSIE_FRAMES.idle_4);
    expect(costumeStages(renderer).filter(stage => stage.props.accessibilityLabel.includes("wearing"))).toHaveLength(11);

    pressTestId(renderer, "gallery-play-pause");
    pressTestId(renderer, "gallery-next");
    expect(frameLabel(renderer)).toContain("Frame 5");
    pressTestId(renderer, "gallery-play-pause");
    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(frameLabel(renderer)).toContain("Frame 6");

    const motionSwitch = renderer.root.findByType(Switch);
    act(() => motionSwitch.props.onValueChange(true));
    expect(frameLabel(renderer)).toContain("Frame 1");
    pressTestId(renderer, "gallery-previous");
    expect(frameLabel(renderer)).toContain("Frame 12");
    expect(costumeStages(renderer).every(stage => stage.findAllByType(Image)[0].props.source === ROSIE_FRAMES.idle_12)).toBe(true);
    act(() => renderer.unmount());
  });
});
