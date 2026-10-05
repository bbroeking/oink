// The wins board: this month's matchmade wins and nothing else (SKILL.md
// 2026-10-04: no loss column, no public zero, no rating on show, reset
// monthly). The screen lives in components/play/WinsBoard.tsx.
import { WinsBoard } from "@/components/play/WinsBoard";

export default function PlayWinsRoute() {
	return <WinsBoard />;
}
