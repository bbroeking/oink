// Blocked users — the Me-tab safety list, opened from Account → Settings.
//
// Wave-3 conformance pass (area B). The panel was a hand-rolled `Modal` +
// centred fade-in card — the one sheet chrome in the social area that could
// have belonged to any app — with hand-rolled rows, a hand-rolled empty state
// and a one-tap unblock. It is now:
//   · the `Sheet` primitive (one scrim, one slide, one grabber, one maxHeight,
//     a Reduce-Motion crossfade and a visible dismiss) [B-06, B-17, B-25];
//   · `ListRow`s with an `Avatar` frame + a `Button` action at the 44pt floor
//     [B-06, B-12];
//   · `LoadingBeat` / `EmptyState`, with the null-vs-empty split honoured: a
//     failed fetch leaves `users` NULL and renders `EmptyState kind="error"`
//     with a retry, while `[]` is the warm "nobody blocked" shelf. A null fetch
//     is not an empty state [B-02, B-14];
//   · a destructive `ConfirmDialog` on unblock, echoing the consequence the
//     player was shown when they blocked. Blocking confirms; removing the same
//     safety boundary must confirm at least as hard [B-11].
// The confirm presents INLINE inside this sheet's own Modal — iOS will not
// reliably present a nested native one.
//
// Renamed `BlockedUsersModal` → `BlockedUsersSheet` 2026-09-11 (wave 4): spec
// §3.4 says a component named `*Sheet` mounts `SlideUpSheet` and a `*Modal`
// mounts `AdaptiveModalScaffold`. This mounts `Sheet`, so the file was lying
// about its own shape — one concept, one name (spec §3.6).
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
	fetchBlockedUsers,
	unblockUser,
	type BlockedUser,
} from "@/utils/moderation";
import {
	ART_SIZE,
	SPACE,
	UI_COLORS,
} from "@/constants/theme";
import {
	Avatar,
	Button,
	ConfirmDialog,
	EmptyState,
	Icon,
	ListRow,
	LoadingBeat,
	Sheet,
	T,
} from "./ui";

type Props = {
	visible: boolean;
	blockerId: string;
	onClose: () => void;
};

function blockedHandle(user: BlockedUser): string {
	if (!user.username) return "Unknown pig";
	return user.discriminator
		? `${user.username}#${user.discriminator}`
		: user.username;
}

export function BlockedUsersSheet({ visible, blockerId, onClose }: Props) {
	// null = unknown (never loaded, or the fetch failed). [] = genuinely empty.
	// Only [] gets the empty shelf; null gets the error + retry.
	const [users, setUsers] = useState<BlockedUser[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [unblockingId, setUnblockingId] = useState<string | null>(null);
	// The unblock awaiting confirmation. Removing a safety boundary is
	// irreversible by the same control, so it goes through ConfirmDialog.
	const [pendingUnblock, setPendingUnblock] = useState<BlockedUser | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setUsers(await fetchBlockedUsers(blockerId));
		} catch {
			setUsers(null);
			setError("Couldn't load your blocked users. Try again.");
		} finally {
			setLoading(false);
		}
	}, [blockerId]);

	useEffect(() => {
		if (visible) void load();
	}, [visible, load]);

	const handleUnblock = async (user: BlockedUser) => {
		if (unblockingId) return;
		setUnblockingId(user.id);
		setError(null);
		const result = await unblockUser(user.id);
		setUnblockingId(null);
		if (!result.ok) {
			setError(`Couldn't unblock ${blockedHandle(user)}. Try again.`);
			return;
		}
		setUsers((current) =>
			current ? current.filter((item) => item.id !== user.id) : current
		);
	};

	if (!visible) return null;

	const body = loading ? (
		<LoadingBeat label="checking the gate" />
	) : users === null ? (
		<EmptyState
			kind="error"
			title="Couldn't check the gate"
			sub={error ?? "We couldn't read your block list just now."}
			action={
				<Button
					size="sm"
					variant="ghost"
					onPress={() => void load()}
					accessibilityLabel="Try again"
					accessibilityHint="Reloads your blocked users"
					testID="blocked-users-retry"
				>
					Try again
				</Button>
			}
		/>
	) : users.length === 0 ? (
		<EmptyState
			glyph="check"
			title="Nobody blocked"
			sub="Your block list is clear."
		/>
	) : (
		<View style={styles.list}>
			{users.map((user, index) => {
				const handle = blockedHandle(user);
				return (
					<ListRow
						key={user.id}
						index={index}
						leading={
							<Avatar fill="lilac" label={`${handle}, blocked`}>
								<Icon
									name="user"
									size={ART_SIZE.glyphSm}
									color={UI_COLORS.textPrimary}
								/>
							</Avatar>
						}
						title={handle}
						trailing={
							<Button
								size="sm"
								variant="ghost"
								onPress={() => setPendingUnblock(user)}
								disabled={unblockingId !== null}
								loading={unblockingId === user.id}
								accessibilityLabel={`Unblock ${handle}`}
								accessibilityHint="Asks to confirm, then lets them interact with you again"
								testID={`unblock-${user.id}`}
							>
								Unblock
							</Button>
						}
					/>
				);
			})}
		</View>
	);

	return (
		<Sheet
			open={visible}
			onClose={onClose}
			kicker="player safety"
			title="Blocked users"
			subtitle="Blocked users can't interact with you. Unblocking does not restore a previous friendship."
			closeLabel="Close"
			testID="blocked-users-close"
			overlay={
				<ConfirmDialog
					open={pendingUnblock != null}
					presentation="inline"
					tone="destructive"
					title={`Unblock ${pendingUnblock ? blockedHandle(pendingUnblock) : "this user"}?`}
					body="They'll be able to interact with you again — friend requests, trades and visits. Blocking them back is a separate step."
					confirmLabel="Unblock"
					confirmHint="Removes the block immediately. You'd have to block them again to stop interaction."
					cancelHint="Keeps them blocked"
					busy={unblockingId != null}
					onCancel={() => setPendingUnblock(null)}
					onConfirm={() => {
						const user = pendingUnblock;
						setPendingUnblock(null);
						if (user) void handleUnblock(user);
					}}
				/>
			}
		>
			{body}
			{!!error && users !== null && (
				<T role="hand" tone="accent" align="center" style={styles.error}>
					{error}
				</T>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	list: { gap: SPACE.sm },
	error: { marginTop: SPACE.sm },
});
