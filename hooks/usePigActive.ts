import { useCallback, useContext, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { NavigationContext } from "expo-router/react-navigation";

const subscribeApp = (notify: () => void) => {
	const subscription = AppState.addEventListener("change", notify);
	return () => subscription.remove();
};
// Native can report null during launch. Treat that as active until told otherwise.
const appActive = () => AppState.currentState == null || AppState.currentState === "active";
const serverActive = () => true;

/** Also works outside a navigator (onboarding, loading, and isolated galleries). */
export function usePigActive(visible = true): boolean {
	const navigation = useContext(NavigationContext);
	const subscribeFocus = useCallback((notify: () => void) => {
		const focus = navigation?.addListener("focus", notify);
		const blur = navigation?.addListener("blur", notify);
		return () => { focus?.(); blur?.(); };
	}, [navigation]);
	const getFocused = useCallback(() => navigation?.isFocused() ?? true, [navigation]);
	const focused = useSyncExternalStore(subscribeFocus, getFocused, serverActive);
	const foreground = useSyncExternalStore(subscribeApp, appActive, serverActive);
	return visible && focused && foreground;
}
