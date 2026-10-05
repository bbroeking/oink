// Invites: link, direct and crew lifecycles; who may see and take what;
// expiry, decline and cancel; the host-away push; limits; and play-by-push
// invites that start the moment the lobby fills.

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InviteSummary } from "../../multiplayer/protocol";
import { nim } from "./fixtures/games";
import { playOut, startServer, type TestClient, type TestServer } from "./helpers";

let ts: TestServer | null = null;
afterEach(async () => {
	await ts?.close();
	ts = null;
});

async function invite(host: TestClient, body: Record<string, unknown>): Promise<InviteSummary> {
	const ack = await host.request({ t: "invite.create", ...body });
	assert.equal(ack.ok, true, `invite.create refused: ${!ack.ok ? `${ack.error} ${ack.message ?? ""}` : ""}`);
	return (ack as { data: InviteSummary }).data;
}

describe("link invites", () => {
	it("create → preview → accept → countdown → play", async () => {
		ts = await startServer();
		const [hostId, guestId] = [ts.pig(1, "Rosie"), ts.pig(2, "Bramble")];
		const host = await ts.connect(hostId);
		const guest = await ts.connect(guestId);
		const inv = await invite(host, { game: "fence_the_pen", kind: "link", pace: "live" });
		assert.equal(inv.status, "open");
		assert.equal(inv.url, `https://ticklethepig.com/play/${inv.code}`);
		assert.equal(inv.from.name, "Rosie");
		assert.equal(inv.seatsMax, 2);
		const lobby = await host.room((r) => r.roomId === inv.roomId);
		assert.equal(lobby.phase, "lobby");
		assert.equal(lobby.invite?.code, inv.code);
		assert.equal(lobby.host, 0);

		const preview = await guest.request({ t: "invite.preview", code: inv.code.toLowerCase() });
		assert.equal(preview.ok && (preview.data as InviteSummary).seatsTaken, 1);

		const accepted = await guest.request({ t: "invite.accept", code: inv.code });
		assert.equal(accepted.ok, true);
		const starting = await guest.room((r) => r.roomId === inv.roomId && r.phase === "starting");
		assert.deepEqual(starting.seats.map((s) => s.name), ["Rosie", "Bramble"]);
		const full = await host.nextOf("invite.state", (m) => m.invite.status === "full");
		assert.equal(full.invite.seatsTaken, 2);
		assert.equal(ts.store.peekInvite(inv.code)?.status, "full");

		await ts.advance(ts.server.config.timing.countdownMs);
		const ended = await playOut(nim, [host, guest], inv.roomId as string, ts);
		assert.equal(ended.source, "invite");
		assert.equal(ended.result?.reason, "complete");

		const late = await (await ts.connect(ts.pig(3))).request({ t: "invite.accept", code: inv.code });
		assert.equal(!late.ok && late.error, "full");
	});

	it("serves the public preview for the landing page, with no user ids", async () => {
		ts = await startServer();
		const host = await ts.connect(ts.pig(1, "Rosie"));
		const inv = await invite(host, { game: "fence_the_pen", kind: "link", pace: "live" });
		const res = await fetch(`${ts.server.httpUrl}/v1/invites/${inv.code}`);
		assert.equal(res.status, 200);
		assert.equal(res.headers.get("access-control-allow-origin"), "*");
		const body = (await res.json()) as Record<string, unknown>;
		assert.deepEqual(body, { code: inv.code, game: "fence_the_pen", title: "Nim", from: { name: "Rosie" }, status: "open", expiresAt: inv.expiresAt });
	});
});

describe("direct invites", () => {
	it("tells an online friend in-app, pushes an offline one, and seats whoever accepts", async () => {
		ts = await startServer();
		const [hostId, online, offline] = [ts.pig(1, "Rosie"), ts.pig(2, "Bramble"), ts.pig(3, "Clover")];
		ts.store.seedFriends(hostId, online).seedFriends(offline, hostId);
		const host = await ts.connect(hostId);
		const friend = await ts.connect(online);
		const inv = await invite(host, { game: "rootle", kind: "direct", to: [online, offline], pace: "live" });
		assert.equal(inv.seatsMax, 3, "1 + two invitees");
		assert.deepEqual(inv.to, [online, offline]);
		assert.equal((await friend.nextOf("invite.state")).invite.code, inv.code);
		await ts.settle();
		assert.equal(ts.push.to(online).length, 0, "online pigs hear it in-app");
		const [push] = ts.push.to(offline);
		assert.equal(push.title, "Rosie wants to play");
		assert.equal(push.body, "Race · tap to take your seat");
		assert.equal(push.categoryId, "match_invite");
		assert.equal(push.collapseId, `invite_${inv.code}`);
		assert.equal(push.threadId, "invites");
		assert.equal(push.priority, "high");
		assert.equal(push.ttl, 15 * 60);
		assert.deepEqual(push.data, { screen: "play", invite: inv.code, url: `ticklethepig://play/${inv.code}`, foreground: "alert" });

		assert.equal((await friend.request({ t: "invite.accept", code: inv.code })).ok, true);
		const lobby = await host.room((r) => r.roomId === inv.roomId && r.seats.length === 2);
		assert.equal(lobby.phase, "lobby", "a chair is still open for Clover");
		assert.equal((await host.request({ t: "room.start", roomId: inv.roomId })).ok, true);
		const starting = await friend.room((r) => r.roomId === inv.roomId && r.phase === "starting");
		assert.equal(starting.seatCount, 2, "the host started early; the open chair dropped");
	});

	it("only friends and Sounder mates can be invited, never a blocked pig", async () => {
		ts = await startServer();
		const [hostId, stranger, blocked, mate] = [ts.pig(1), ts.pig(2), ts.pig(3), ts.pig(4)];
		ts.store.seedFriends(hostId, blocked).seedBlock(blocked, hostId).seedCrew("crew-1", [hostId, mate]);
		const host = await ts.connect(hostId);
		const res = await host.request({ t: "invite.create", game: "fence_the_pen", kind: "direct", to: [stranger], pace: "live" });
		assert.equal(!res.ok && res.error, "forbidden");
		const res2 = await host.request({ t: "invite.create", game: "fence_the_pen", kind: "direct", to: [blocked], pace: "live" });
		assert.equal(!res2.ok && res2.error, "blocked");
		const inv = await invite(host, { game: "fence_the_pen", kind: "direct", to: [mate], pace: "live" });
		assert.equal(inv.status, "open");
	});

	it("is invisible to anyone it was not addressed to", async () => {
		ts = await startServer();
		const [hostId, friendId, nosy] = [ts.pig(1), ts.pig(2), ts.pig(3)];
		ts.store.seedFriends(hostId, friendId);
		const host = await ts.connect(hostId);
		const inv = await invite(host, { game: "fence_the_pen", kind: "direct", to: [friendId], pace: "live" });
		const outsider = await ts.connect(nosy);
		assert.equal((await outsider.request({ t: "invite.preview", code: inv.code })) .ok, false);
		const take = await outsider.request({ t: "invite.accept", code: inv.code });
		assert.equal(!take.ok && take.error, "not_found");
	});

	it("folds the table when every invitee declines, telling the host in-app only", async () => {
		ts = await startServer();
		const [hostId, friendId] = [ts.pig(1), ts.pig(2)];
		ts.store.seedFriends(hostId, friendId);
		const host = await ts.connect(hostId);
		const friend = await ts.connect(friendId);
		const inv = await invite(host, { game: "fence_the_pen", kind: "direct", to: [friendId], pace: "live" });
		assert.equal((await friend.request({ t: "invite.decline", code: inv.code })).ok, true);
		assert.equal((await host.nextOf("invite.state", (m) => m.invite.status === "declined")).invite.code, inv.code);
		const closed = await host.room((r) => r.roomId === inv.roomId && r.phase === "ended");
		assert.equal(closed.result?.kind, "no_contest");
		await ts.settle();
		assert.equal(ts.push.to(hostId).length, 0, "a no is never pushed");
		assert.equal(ts.store.allResults().length, 0, "nothing was played");
	});
});

describe("crew invites", () => {
	it("pushes every Sounder mate; the first to tap takes the seat; outsiders never see it", async () => {
		ts = await startServer();
		const [hostId, mateA, mateB, outsiderId] = [ts.pig(1, "Rosie"), ts.pig(2), ts.pig(3), ts.pig(4)];
		ts.store.seedCrew("crew-1", [hostId, mateA, mateB]);
		const host = await ts.connect(hostId);
		const inv = await invite(host, { game: "fence_the_pen", kind: "crew", pace: "live" });
		await ts.settle();
		for (const mate of [mateA, mateB]) {
			const [push] = ts.push.to(mate);
			assert.equal(push.title, "Rosie wants to play Nim");
			assert.equal(push.body, "First pig to tap takes the seat");
		}
		const outsider = await ts.connect(outsiderId);
		assert.equal((await outsider.request({ t: "invite.preview", code: inv.code })).ok, false);
		const a = await ts.connect(mateA);
		assert.equal((await a.request({ t: "invite.accept", code: inv.code })).ok, true);
		const b = await ts.connect(mateB);
		const second = await b.request({ t: "invite.accept", code: inv.code });
		assert.equal(!second.ok && second.error, "full");
	});

	it("needs a Sounder with another pig in it", async () => {
		ts = await startServer();
		const host = await ts.connect(ts.pig(1));
		const res = await host.request({ t: "invite.create", game: "fence_the_pen", kind: "crew", pace: "live" });
		assert.equal(!res.ok && res.error, "forbidden");
	});
});

describe("lifecycle", () => {
	it("expires: the lobby closes and a late accept is refused", async () => {
		ts = await startServer();
		const host = await ts.connect(ts.pig(1));
		const inv = await invite(host, { game: "fence_the_pen", kind: "link", pace: "live" });
		await ts.advance(ts.server.config.timing.inviteTtlMs.link + 1);
		assert.equal((await host.nextOf("invite.state", (m) => m.invite.status === "expired")).invite.code, inv.code);
		await host.room((r) => r.roomId === inv.roomId && r.phase === "ended");
		const late = await (await ts.connect(ts.pig(2))).request({ t: "invite.accept", code: inv.code });
		assert.equal(!late.ok && late.error, "expired");
	});

	it("cancels (host only), telling a seated guest", async () => {
		ts = await startServer();
		const host = await ts.connect(ts.pig(1));
		const guest = await ts.connect(ts.pig(2));
		const inv = await invite(host, { game: "rootle", kind: "link", pace: "live" });
		assert.equal((await guest.request({ t: "invite.accept", code: inv.code })).ok, true);
		const notMine = await guest.request({ t: "invite.cancel", code: inv.code });
		assert.equal(!notMine.ok && notMine.error, "forbidden");
		assert.equal((await host.request({ t: "invite.cancel", code: inv.code })).ok, true);
		const closed = await guest.room((r) => r.roomId === inv.roomId && r.phase === "ended");
		assert.equal(closed.result?.reason, "ended_early");
		assert.equal((await guest.nextOf("invite.state", (m) => m.invite.status === "cancelled")).invite.code, inv.code);
	});

	it("releases a live guest who drops before the start", async () => {
		ts = await startServer();
		const host = await ts.connect(ts.pig(1));
		const guest = await ts.connect(ts.pig(2));
		const inv = await invite(host, { game: "rootle", kind: "link", pace: "live" });
		await guest.request({ t: "invite.accept", code: inv.code });
		await host.room((r) => r.roomId === inv.roomId && r.seats.length === 2);
		guest.terminate();
		await host.room((r) => r.roomId === inv.roomId && r.seats.length === 1);
	});

	it("pushes an away host when the table fills, and starts when they come back", async () => {
		ts = await startServer({ config: { lobbyHostWaitMs: 120_000 } });
		const [hostId, guestId] = [ts.pig(1, "Rosie"), ts.pig(2, "Bramble")];
		const host = await ts.connect(hostId);
		const inv = await invite(host, { game: "fence_the_pen", kind: "link", pace: "live" });
		host.terminate();
		await ts.waitOffline(host.userId as string);
		const guest = await ts.connect(guestId);
		assert.equal((await guest.request({ t: "invite.accept", code: inv.code })).ok, true);
		await ts.settle();
		const [push] = ts.push.to(hostId);
		assert.equal(push.title, "Bramble is at the table");
		assert.equal(push.body, "Nim · tap to play");
		assert.equal((push.data as { room: string }).room, inv.roomId);
		assert.equal(guest.latest(inv.roomId as string)?.phase, "lobby");

		const back = await ts.connect(hostId);
		const starting = await back.room((r) => r.roomId === inv.roomId && r.phase === "starting");
		assert.ok(starting.seats.every((s) => s.connected));
	});

	it("folds the table warmly when the away host never comes back", async () => {
		ts = await startServer({ config: { lobbyHostWaitMs: 120_000 } });
		const host = await ts.connect(ts.pig(1));
		const inv = await invite(host, { game: "fence_the_pen", kind: "link", pace: "live" });
		host.terminate();
		await ts.waitOffline(host.userId as string);
		const guest = await ts.connect(ts.pig(2));
		await guest.request({ t: "invite.accept", code: inv.code });
		await ts.advance(120_001);
		const closed = await guest.room((r) => r.roomId === inv.roomId && r.phase === "ended");
		assert.equal(closed.result?.kind, "no_contest");
		assert.equal(ts.store.peekInvite(inv.code)?.status, "expired");
	});

	it("allows three open invites and ten creates per ten minutes", async () => {
		ts = await startServer();
		const host = await ts.connect(ts.pig(1));
		const codes: string[] = [];
		for (let i = 0; i < 3; i++) codes.push((await invite(host, { game: "fence_the_pen", kind: "link", pace: "async" })).code);
		const fourth = await host.request({ t: "invite.create", game: "fence_the_pen", kind: "link", pace: "async" });
		assert.equal(!fourth.ok && fourth.error, "rate_limited");
		// Cancelling frees a slot, but the ten-per-ten-minutes window still counts.
		for (let round = 0; round < 7; round++) {
			await host.request({ t: "invite.cancel", code: codes.shift() as string });
			codes.push((await invite(host, { game: "fence_the_pen", kind: "link", pace: "async" })).code);
		}
		await host.request({ t: "invite.cancel", code: codes.shift() as string });
		const eleventh = await host.request({ t: "invite.create", game: "fence_the_pen", kind: "link", pace: "async" });
		assert.equal(!eleventh.ok && eleventh.error, "rate_limited");
	});

	it("gives a play-by-post invite a day, whatever its kind, and says so in the push", async () => {
		ts = await startServer();
		const [hostId, friendId] = [ts.pig(1, "Rosie"), ts.pig(2, "Bramble")];
		ts.store.seedFriends(hostId, friendId);
		const host = await ts.connect(hostId);
		const { asyncInviteTtlMs: day, inviteTtlMs } = ts.server.config.timing;
		assert.equal(day, 24 * 3_600_000);
		const now = ts.clock.now();
		const byPost = await invite(host, { game: "fence_the_pen", kind: "direct", to: [friendId], pace: "async" });
		const byPostLink = await invite(host, { game: "fence_the_pen", kind: "link", pace: "async" });
		const live = await invite(host, { game: "fence_the_pen", kind: "link", pace: "live" });
		assert.equal(byPost.expiresAt, now + day);
		assert.equal(byPostLink.expiresAt, now + day);
		assert.equal(live.expiresAt, now + inviteTtlMs.link, "live invites keep their kind's lifetime");
		await ts.settle();
		const [push] = ts.push.to(friendId);
		assert.equal(push.ttl, 24 * 3_600, "the push may wait as long as the invite");

		await ts.advance(inviteTtlMs.link + 1);
		assert.equal(ts.store.peekInvite(live.code)?.status, "expired");
		assert.equal(ts.store.peekInvite(byPost.code)?.status, "open");
		await ts.advance(day - inviteTtlMs.link - 60_000);
		const friend = await ts.connect(friendId);
		assert.equal((await friend.request({ t: "invite.accept", code: byPost.code })).ok, true, "still open a minute before the day is up");
		await friend.room((r) => r.roomId === byPost.roomId && r.phase === "playing");
		await ts.advance(60_001);
		assert.equal(ts.store.peekInvite(byPostLink.code)?.status, "expired");
		const late = await friend.request({ t: "invite.accept", code: byPostLink.code });
		assert.equal(!late.ok && late.error, "expired");
	});

	it("starts a play-by-push invite the moment it fills, and pushes the pig whose move it is", async () => {
		ts = await startServer();
		const [hostId, guestId] = [ts.pig(1, "Rosie"), ts.pig(2, "Bramble")];
		const host = await ts.connect(hostId);
		const inv = await invite(host, { game: "fence_the_pen", kind: "link", pace: "async" });
		host.terminate();
		await ts.waitOffline(host.userId as string);
		const guest = await ts.connect(guestId);
		assert.equal((await guest.request({ t: "invite.accept", code: inv.code })).ok, true);
		const playing = await guest.room((r) => r.roomId === inv.roomId && r.phase === "playing");
		assert.equal(playing.startsAt, null, "no countdown by post");
		assert.deepEqual(playing.activeSeats, [0]);
		await ts.settle();
		const [push] = ts.push.to(hostId);
		assert.equal(push.title, "Your move");
		assert.equal(push.body, "Nim · tap to play");
		assert.equal(push.threadId, "play");
	});
});
