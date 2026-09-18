// The homecoming — a thin host for RewardReturn: maps one `back` errand row
// to the return's props (the pig, what it carries, the four cases' copy) and
// the claim. The primary is the give when there is a friend and the find is
// the one they asked for, else the keep; a refused give has ALREADY kept the
// find on the server (never lost), so the card lands it in the Satchel and
// says who beat him to it. Plays once per row: the host keys the return by
// the row's id and closes by unmounting.
import { useCallback, useMemo, useRef, useState } from "react";
import { RewardReturn } from "@/components/RewardReturn";
import { showToast } from "@/components/ui";
import type { ErrandRow } from "@/constants/errands";
import { errandRefusalCopy, homecomingCopy, resultItems, type ClaimOutcome, type ErrandFriend } from "@/utils/errands";
import { pigDefinition, pigPronouns } from "@/utils/pigs";
import type { GrantResult, Point } from "@/utils/rewardReturn";
import { satchelTuning } from "@/utils/satchel";

interface Props {
	row: ErrandRow | null;
	friendFor: (userId: string | null) => ErrandFriend | null;
	/** The bag's count before the claim, when known (the granted line). */
	bagCount: number | null;
	claim: (id: number, action: "give" | "keep") => Promise<ClaimOutcome>;
	target?: Point | null;
	onDone: () => void;
}

export function Homecoming({ row, friendFor, bagCount, claim, target, onDone }: Props) {
	if (!row) return null;
	return <HomecomingFor key={row.id} row={row} friendFor={friendFor} bagCount={bagCount} claim={claim} target={target} onDone={onDone} />;
}

function HomecomingFor({ row, friendFor, bagCount, claim, target, onDone }: Props & { row: ErrandRow }) {
	const friend = friendFor(row.for_user_id);
	const items = useMemo(() => resultItems(row), [row]);
	const copy = useMemo(
		() => homecomingCopy(row, friend, bagCount == null ? null : bagCount + items.length, satchelTuning().tickles),
		[row, friend, bagCount, items.length],
	);
	// The granted line can change hands mid-flight: a give the friend's wish
	// moved out from under lands in the Satchel instead.
	const [grantedLine, setGrantedLine] = useState(copy.grantedLine);
	const closing = useRef(false);

	const grant = useCallback(async (): Promise<GrantResult> => {
		const r = await claim(row.id, copy.primaryAction);
		if (r.ok) {
			if (r.action === "give" && r.tickles > 0 && friend) {
				setGrantedLine(`${friend.pigName ? `${friend.name}'s ${friend.pigName}` : `${friend.name}'s pig`} has its ${items[0]?.name ?? "find"} · you both got ${r.tickles} tickles`);
			} else if (r.action === "give" && friend) {
				setGrantedLine(`${friend.name}'s pig has its ${items[0]?.name ?? "find"}`);
			} else if (r.bagCount != null && items.length > 0) {
				setGrantedLine(`in your Satchel · ${r.bagCount} ${r.bagCount === 1 ? "find" : "finds"}`);
			}
			return { ok: true };
		}
		// A refused give has kept the find already: land it, and say why.
		if (copy.primaryAction === "give" && r.status === "kept") {
			const p = pigPronouns(row.pig_id);
			setGrantedLine(
				r.reason === "host_bag_full"
					? `their Satchel is full — ${p.subject} kept it in yours`
					: `someone beat ${p.object} to it — kept in your Satchel`,
			);
			return { ok: true };
		}
		return { ok: false, reason: r.reason, retryable: r.reason !== "already_claimed" && r.reason !== "not_back" };
	}, [claim, row, copy.primaryAction, friend, items]);

	// "Keep it" beside "Give it": a different grant, not a skip. The host
	// performs it and closes.
	const keepInstead = useCallback(async () => {
		if (closing.current) return;
		closing.current = true;
		const r = await claim(row.id, "keep");
		if (!r.ok) {
			closing.current = false;
			const c = errandRefusalCopy(r.reason, friend?.name);
			showToast({ tone: "fail", title: c.title, text: c.text });
			return;
		}
		showToast({
			tone: "success",
			title: `${pigDefinition(row.pig_id).name} kept it`,
			text: r.bagCount != null ? `in your Satchel · ${r.bagCount} ${r.bagCount === 1 ? "find" : "finds"}` : "in your Satchel",
		});
		onDone();
	}, [claim, row, friend, onDone]);

	return (
		<RewardReturn
			open
			pigId={row.pig_id}
			carry={items[0] ?? null}
			items={items}
			kicker={copy.kicker}
			title={copy.title}
			body={copy.body}
			primaryLabel={copy.primaryLabel}
			primaryBusyLabel={copy.primaryAction === "give" ? "Handing it over…" : items.length ? "Into the Satchel…" : "Ok…"}
			secondaryLabel={copy.secondaryLabel}
			onSecondary={copy.secondaryLabel ? () => void keepInstead() : undefined}
			grantedLine={grantedLine}
			target={target ?? null}
			onGrant={grant}
			onDone={onDone}
			testID="homecoming"
		/>
	);
}
