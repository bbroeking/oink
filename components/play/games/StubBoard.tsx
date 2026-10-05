// The board a game wears while its real one is being built: a cozy empty
// state and one "Ready" button that drives the stub rules
// (multiplayer/games/stub.ts). Deleted once all five boards are real.

import { View } from "react-native";
import { Button, EmptyState } from "@/components/ui";
import { SPACE } from "@/constants/theme";
import type { BoardProps } from "../types";
import type { StubState } from "@/multiplayer/games/stub";

export function StubBoard({ view, you, yourTurn, act, pending }: BoardProps<StubState>) {
	const ready = view.ready[you];
	return (
		<View style={{ gap: SPACE.md }}>
			<EmptyState glyph="sparkles" title="This board is still being painted" sub="Say you're ready and the table moves on." />
			<Button
				variant="primary"
				full
				disabled={!yourTurn || ready}
				loading={pending}
				onPress={() => {
					void act({ type: "ready" });
				}}
				accessibilityHint="Tells the table you are ready"
			>
				{ready ? "Ready" : "I'm ready"}
			</Button>
		</View>
	);
}
