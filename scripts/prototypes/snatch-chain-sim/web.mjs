import { catchThief, initialState, startTheft, waitHours } from "./game.mjs";

let state = initialState();

const $ = (selector) => document.querySelector(selector);
const visiblePlayers = () => state.players.filter((player) => !player.hidden && !player.test);
const nameOf = (id) => state.players.find((player) => player.id === id)?.name ?? id;

function options(selectedId) {
	return visiblePlayers()
		.map(
			(player) =>
				`<option value="${player.id}" ${player.id === selectedId ? "selected" : ""}>${player.name}</option>`,
		)
		.join("");
}

function statusLabel(chain) {
	if (chain.status === "active") return `${Math.max(0, chain.deadline - state.now)}h left`;
	if (chain.status === "busted") return "Busted";
	return "Expired";
}

function chainMarkup(chain) {
	const active = chain.status === "active";
	const history = chain.history
		.map(
			(event) => `
				<li>
					<span>${nameOf(event.from)} → ${nameOf(event.to)}</span>
					<strong>${event.amount} snout${event.amount === 1 ? "" : "s"}${event.bust ? " · bust" : ""}</strong>
				</li>`,
		)
		.join("");

	return `
		<article class="chain-card ${active ? "is-active" : ""}">
			<div class="chain-topline">
				<span class="chain-id">${chain.id}</span>
				<span class="status ${chain.status}">${statusLabel(chain)}</span>
			</div>
			${
				active
					? `<div class="versus">
							<div><span>Up next</span><strong>${nameOf(chain.nextActor)}</strong></div>
							<div class="stake"><span>Retaliation</span><strong>${chain.nextAmount}×</strong></div>
						</div>
						<button class="primary-button catch-button" data-catch="${chain.id}">
							Catch ${nameOf(chain.lastActor)} for ${chain.nextAmount}
						</button>`
					: `<p class="resolution">${chain.resolution}</p>`
			}
			<details>
				<summary>${chain.history.length} transfer${chain.history.length === 1 ? "" : "s"}</summary>
				<ul class="history">${history}</ul>
			</details>
		</article>`;
}

function renderPlayers() {
	const selectedTarget = $("#target").value || "ada";
	$("#players").innerHTML = visiblePlayers()
		.map((player, index) => {
			const blocked =
				player.id !== "you" &&
				state.blockedPairs.some((pair) => pair.includes("you") && pair.includes(player.id));
			return `
				<button class="player-row ${player.id === selectedTarget ? "selected" : ""}" data-target="${player.id}" ${
					player.id === "you" ? "disabled" : ""
				}>
					<span class="rank">${index + 1}</span>
					<span class="avatar">${player.name.slice(0, 1)}</span>
					<span class="player-name">
						<strong>${player.name}</strong>
						<small>${blocked ? "Blocked pair" : player.id === "you" ? "Your pig" : "Available opponent"}</small>
					</span>
					<span class="balance"><strong>${player.balance}</strong><small>snouts</small></span>
				</button>`;
		})
		.join("");
}

function render() {
	const attackerId = $("#attacker").value || "you";
	const targetId = $("#target").value || "ada";
	$("#clock").textContent = `Hour ${state.now}`;
	$("#notice").textContent = state.message;
	$("#notice").classList.toggle("blocked", state.message.startsWith("Blocked:"));
	$("#attacker").innerHTML = options(attackerId);
	$("#target").innerHTML = options(targetId);
	renderPlayers();
	$("#chains").innerHTML =
		state.chains.length > 0
			? [...state.chains].reverse().map(chainMarkup).join("")
			: `<div class="empty-state"><span>🐽</span><strong>No snouts stolen yet</strong><p>Choose an opponent to start a chain.</p></div>`;
}

$("#steal-button").addEventListener("click", () => {
	state = startTheft(state, $("#attacker").value, $("#target").value);
	render();
});

$("#players").addEventListener("click", (event) => {
	const row = event.target.closest("[data-target]");
	if (!row) return;
	$("#target").value = row.dataset.target;
	render();
});

$("#chains").addEventListener("click", (event) => {
	const button = event.target.closest("[data-catch]");
	if (!button) return;
	state = catchThief(state, button.dataset.catch);
	render();
});

document.querySelectorAll("[data-wait]").forEach((button) => {
	button.addEventListener("click", () => {
		state = waitHours(state, Number(button.dataset.wait));
		render();
	});
});

$("#target").addEventListener("change", render);
$("#attacker").addEventListener("change", render);
$("#reset-button").addEventListener("click", () => {
	state = initialState();
	render();
});

render();
