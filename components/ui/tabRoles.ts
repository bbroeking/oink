import { Platform } from "react-native";

// The roles a row of tabs wears. React Native gives role "tab" no iOS trait at
// all, so VoiceOver read a tab as a bare name with no hint it could be pressed
// (React Navigation's own tab item carries the same FIXME). On iOS a tab is a
// BUTTON with `selected` state inside a container with the tab-bar trait,
// which is what makes VoiceOver say "Barn, tab, 1 of 5"; other platforms keep
// the ARIA pair. Verified on device for the hanging-signs tab bar (2026-10-04
// after round: subrole AXTabButton, value 1 on the selected sign).
//
// Give every tab `accessibilityState={{ selected }}`, and put the list role on
// a plain View that holds the tabs (the verified shape), not on a scroller.
export const TAB_ROLE = Platform.select({ ios: "button", default: "tab" } as const);
export const TAB_LIST_ROLE = Platform.select({ ios: "tabbar", default: "tablist" } as const);
