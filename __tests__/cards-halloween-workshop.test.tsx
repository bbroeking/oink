import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import HalloweenWorkshop from '@/components/prototypes/card-packs/HalloweenWorkshop';

const key = 'ttp.halloween-workshop.demo.v1';
const mounted: TestRenderer.ReactTestRenderer[] = [];

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<HalloweenWorkshop onBack={() => undefined}/>);
    await Promise.resolve();
    await Promise.resolve();
  });
  mounted.push(renderer!);
  return renderer!;
}

function textOf(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAllByType(Text).map(node => node.props.children).flat(Infinity).join(' ').replace(/\s+/g, ' ');
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string): void {
  renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
}

describe('Halloween workshop prototype', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  afterEach(async () => {
    await act(async () => { mounted.splice(0).forEach(renderer => renderer.unmount()); });
  });

  it('does not restore a half-confirmed pending offer', async () => {
    let renderer = await mount();
    await act(async () => { press(renderer, 'Seal this offer as Rosie'); });
    expect(textOf(renderer)).toContain('Rosie READY');
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual({ receipts: [] });
    await act(async () => { renderer.unmount(); });
    renderer = await mount();
    expect(textOf(renderer)).toContain('Rosie CHECKING OFFER');
  });

  it('commits on the second matching seal and reconstructs the immutable receipt', async () => {
    let renderer = await mount();
    await act(async () => { press(renderer, 'Seal this offer as Rosie'); });
    await act(async () => { press(renderer, 'Seal as Pippin & complete swap'); });
    expect(textOf(renderer)).toContain('Hollow Jack permanently unlocked');
    const saved = JSON.parse((await AsyncStorage.getItem(key))!);
    expect(saved.receipts).toHaveLength(1);
    await act(async () => { renderer.unmount(); });
    renderer = await mount();
    expect(textOf(renderer)).toContain('Tucked into the right albums.');
  });

  it('keeps Little Haunt out of the visit until Spook is pressed', async () => {
    const renderer = await mount();
    const haunt = renderer.root.findByProps({ accessibilityLabel: 'Little Haunt pops up between the pigs' });
    expect(haunt.parent?.props.importantForAccessibility).toBe('no-hide-descendants');
    await act(async () => { press(renderer, 'Spook'); });
    expect(haunt.parent?.props.importantForAccessibility).toBe('yes');
    expect(textOf(renderer)).toContain('Bandit gets one tiny ghostly hello.');
    await act(async () => { press(renderer, 'Send the haunt home'); });
    expect(haunt.parent?.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
