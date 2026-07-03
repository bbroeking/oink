// Server-driven feature flags — the runtime replacement for the compile-time
// constants in constants/featureFlags.ts. The effective on/off for a key is
// resolved server-side by the feature_flags() RPC (global default in app_config,
// overridden per-user via profiles.feature_overrides — see
// supabase/migrations/20260692000000_feature_flags.sql), so a dark-launched
// surface can be flipped remotely and targeted at one tester without a rebuild.
//
// The provider is mounted at the app root (app/_layout.tsx) so every screen can
// read a flag with useFeatureFlag("key"). It fetches once on mount and refetches
// on auth changes, because per-user overrides differ by signed-in account.
//
// SAFE DEFAULT: while flags are still loading (or the RPC fails), every flag
// reads false — a dark-launched surface never flashes before the server confirms
// access. Guards that must tell "loading" apart from "off" use useFeatureFlagState.

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";

// Add a key here as each dark-launched surface moves to a server flag. The
// string must match an app_config.key seeded by a migration.
//   mud_wars        — Season 2 Sounder Mud Fights (20260692)
//   world_boss      — The Great Hunger server-wide co-op event (intro + raid)
//   season1_finale  — Season-1 end reveal: beta founder rewards recap (20260704400000)
export type FeatureFlagKey = "mud_wars" | "world_boss" | "season1_finale";

type FlagMap = Partial<Record<FeatureFlagKey, boolean>>;

type FeatureFlagsValue = {
	flags: FlagMap;
	loaded: boolean;
	refresh: () => Promise<void>;
};

const FeatureFlagsContext = createContext<FeatureFlagsValue>({
	flags: {},
	loaded: false,
	refresh: async () => {},
});

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
	const [flags, setFlags] = useState<FlagMap>({});
	const [loaded, setLoaded] = useState(false);

	const refresh = useCallback(async () => {
		const data = await rpc<FlagMap>("feature_flags");
		setFlags(data ?? {});
		setLoaded(true);
	}, []);

	useEffect(() => {
		refresh();
		// Per-user overrides depend on the signed-in account, so re-resolve
		// whenever auth flips (sign-in/out). Matches the app's other
		// onAuthStateChange listeners (root-lifetime, fire-and-forget).
		const { data } = supabase.auth.onAuthStateChange(() => {
			refresh();
		});
		return () => data.subscription.unsubscribe();
	}, [refresh]);

	return (
		<FeatureFlagsContext.Provider value={{ flags, loaded, refresh }}>
			{children}
		</FeatureFlagsContext.Provider>
	);
}

// The effective on/off for a flag. Loading / failure → false (safe default).
export function useFeatureFlag(key: FeatureFlagKey): boolean {
	return !!useContext(FeatureFlagsContext).flags[key];
}

// For guards that must distinguish "still loading" from "off" — e.g. a screen
// deciding whether to redirect away should wait for `loaded` before bouncing,
// or a deep link into a Brian-only surface would flash-redirect on cold start.
export function useFeatureFlagState(key: FeatureFlagKey): {
	visible: boolean;
	loaded: boolean;
} {
	const { flags, loaded } = useContext(FeatureFlagsContext);
	return { visible: !!flags[key], loaded };
}
