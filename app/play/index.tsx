// Play together: the hub of matchmade play (docs/multiplayer/README.md §1).
// Reached from the one door on the Friends tab (components/play/PlayDoor) and
// from a "play" push with no invite or table on it. The screen lives in
// components/play/PlayHub.tsx so it renders in a test without the router.
import { PlayHub } from "@/components/play/PlayHub";

export default function PlayHubRoute() {
	return <PlayHub />;
}
