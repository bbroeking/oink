import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import SpookyTraderMiniGame from '@/components/prototypes/card-packs/SpookyTraderMiniGame';

function mount() { return TestRenderer.create(<SpookyTraderMiniGame day="2026-10-14"/>); }
function textOf(tree: TestRenderer.ReactTestRenderer) { return tree.root.findAllByType(Text).map(node => node.props.children).flat(Infinity).join(' ').replace(/\s+/g, ' '); }
function button(tree: TestRenderer.ReactTestRenderer, label: string) { return tree.root.findByProps({ accessibilityLabel: label }); }
function press(tree: TestRenderer.ReactTestRenderer, label: string) { act(() => button(tree, label).props.onPress()); }

describe('Spooky Trader mini-game', () => {
  it('shows distinct personal errands and uses the canonical pig portraits', () => {
    let tree!: TestRenderer.ReactTestRenderer; act(() => { tree = mount(); });
    const rosieText = textOf(tree);
    expect(rosieText).toContain('TODAY, OLD WISP ASKS YOU FOR');
    expect(tree.root.findByProps({ accessibilityLabel: 'Rosie' })).toBeTruthy();
    press(tree, 'View as Bandit');
    expect(textOf(tree)).not.toBe(rosieText);
    expect(tree.root.findByProps({ accessibilityLabel: 'Bandit' })).toBeTruthy();
  });

  it('requires both ready marks and clears them when the offer changes', () => {
    let tree!: TestRenderer.ReactTestRenderer; act(() => { tree = mount(); });
    expect(button(tree, 'Exchange both wearables').props.accessibilityState.disabled).toBe(true);
    press(tree, 'Mark Rosie ready'); press(tree, 'Simulate Bandit reply: ready');
    expect(button(tree, 'Exchange both wearables').props.accessibilityState.disabled).toBe(false);
    press(tree, 'Review offer again · clear ready marks');
    expect(button(tree, 'Exchange both wearables').props.accessibilityState.disabled).toBe(true);
  });

  it('exchanges together, warns before disposal, and replays the same receipt', () => {
    let tree!: TestRenderer.ReactTestRenderer; act(() => { tree = mount(); });
    press(tree, 'Mark Rosie ready'); press(tree, 'Simulate Bandit reply: ready'); press(tree, 'Exchange both wearables');
    expect(textOf(tree)).toContain('leaves your wardrobe when you hand it over');
    const handLabel = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Hand ') && node.props.accessibilityLabel.endsWith(' to Old Wisp'))[0].props.accessibilityLabel;
    press(tree, handLabel);
    const receipt = textOf(tree);
    expect(receipt).toContain('+7 draft Tickles');
    expect(receipt).toContain('SAME RECEIPT ON REPLAY');
    press(tree, 'Replay handover receipt');
    expect(textOf(tree)).toBe(receipt);
    expect(textOf(tree)).toContain('handed to Old Wisp');
    expect(textOf(tree)).not.toContain('now in your wardrobe');
  });

  it('starts a fresh story and ready state when the day changes', () => {
    let tree!: TestRenderer.ReactTestRenderer; act(() => { tree = mount(); });
    press(tree, 'Mark Rosie ready');
    expect(textOf(tree)).toContain('Rosie ready ✓');
    act(() => { tree.update(<SpookyTraderMiniGame day="2026-10-15"/>); });
    expect(textOf(tree)).toContain('2026-10-15');
    expect(textOf(tree)).toContain('Mark Rosie ready');
    expect(textOf(tree)).not.toContain('Rosie ready ✓');
  });
});
