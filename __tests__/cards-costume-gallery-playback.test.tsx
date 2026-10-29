import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text, View } from "react-native";
import {
  useCostumeGalleryPlayback,
  type CostumeGalleryPlaybackOptions,
} from "@/components/prototypes/card-packs/useCostumeGalleryPlayback";

function Probe(props: CostumeGalleryPlaybackOptions) {
  const playback = useCostumeGalleryPlayback(props);
  return <View>
    <Text>{`${playback.frameIndex}:${playback.frameCount}:${playback.playing}`}</Text>
    <Pressable accessibilityLabel="play" onPress={playback.play}/>
    <Pressable accessibilityLabel="pause" onPress={playback.pause}/>
    <Pressable accessibilityLabel="next" onPress={() => playback.step(1)}/>
    <Pressable accessibilityLabel="previous" onPress={() => playback.step(-1)}/>
  </View>;
}

async function render(props: CostumeGalleryPlaybackOptions) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe {...props}/>);
  });
  return renderer;
}

function value(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType(Text).props.children as string;
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
  act(() => renderer.root.findByProps({ accessibilityLabel: label }).props.onPress());
}

describe("useCostumeGalleryPlayback", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("autoplays one twelve-frame clock and resumes from the paused frame", async () => {
    const renderer = await render({ active: true, reduceMotion: false });
    expect(value(renderer)).toBe("0:12:true");
    await act(async () => jest.advanceTimersByTime(3 * (1000 / 6)));
    expect(value(renderer)).toBe("3:12:true");

    press(renderer, "pause");
    expect(value(renderer)).toBe("3:12:false");
    await act(async () => jest.advanceTimersByTime(2000));
    expect(value(renderer)).toBe("3:12:false");

    press(renderer, "play");
    expect(value(renderer)).toBe("3:12:true");
    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(value(renderer)).toBe("4:12:true");
    act(() => renderer.unmount());
  });

  it("manual stepping pauses and wraps between frame twelve and frame one", async () => {
    const renderer = await render({ active: true, reduceMotion: true });
    expect(value(renderer)).toBe("0:12:false");
    press(renderer, "previous");
    expect(value(renderer)).toBe("11:12:false");
    press(renderer, "next");
    expect(value(renderer)).toBe("0:12:false");
    press(renderer, "next");
    expect(value(renderer)).toBe("1:12:false");
    await act(async () => jest.advanceTimersByTime(2000));
    expect(value(renderer)).toBe("1:12:false");
    act(() => renderer.unmount());
  });

  it("creates no clock while inactive and resumes cleanly when active", async () => {
    const intervalSpy = jest.spyOn(global, "setInterval");
    const renderer = await render({ active: false, reduceMotion: false });
    expect(value(renderer)).toBe("0:12:false");
    expect(intervalSpy).not.toHaveBeenCalled();
    await act(async () => renderer.update(<Probe active reduceMotion={false}/>));
    expect(value(renderer)).toBe("0:12:true");
    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(value(renderer)).toBe("1:12:true");
    await act(async () => jest.advanceTimersByTime(3 * (1000 / 6)));
    expect(value(renderer)).toBe("4:12:true");
    await act(async () => renderer.update(<Probe active={false} reduceMotion={false}/>));
    expect(value(renderer)).toBe("4:12:false");
    await act(async () => jest.advanceTimersByTime(2000));
    expect(value(renderer)).toBe("4:12:false");
    await act(async () => renderer.update(<Probe active reduceMotion={false}/>));
    expect(value(renderer)).toBe("4:12:true");
    await act(async () => jest.advanceTimersByTime(1000 / 6));
    expect(value(renderer)).toBe("5:12:true");
    act(() => renderer.unmount());
  });

  it("switching to reduced motion resets to frame one but keeps manual controls", async () => {
    const renderer = await render({ active: true, reduceMotion: false });
    await act(async () => jest.advanceTimersByTime(5 * (1000 / 6)));
    expect(value(renderer)).toBe("5:12:true");
    await act(async () => renderer.update(<Probe active reduceMotion/>));
    expect(value(renderer)).toBe("0:12:false");
    press(renderer, "next");
    expect(value(renderer)).toBe("1:12:false");
    press(renderer, "play");
    await act(async () => jest.advanceTimersByTime(1000));
    expect(value(renderer)).toBe("1:12:false");
    act(() => renderer.unmount());
  });
});
