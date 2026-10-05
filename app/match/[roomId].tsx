// One table: a real one (the play server's) or a Practice one (ids that start
// "practice-", run on the phone with bot pigs). A your-move push routes here
// through utils/notificationRouting.ts. The screen lives in
// components/play/MatchScreen.tsx.
import { useLocalSearchParams } from "expo-router";
import { MatchScreen } from "@/components/play/MatchScreen";

export default function MatchRoute() {
	const { roomId } = useLocalSearchParams<{ roomId?: string | string[] }>();
	const raw = Array.isArray(roomId) ? roomId[0] : roomId;
	return <MatchScreen roomId={raw ?? null} />;
}
