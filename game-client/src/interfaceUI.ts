import z from "zod";
import { gameManagerInstance } from "./main";
import { IncomingStreamSchema, ServerStreamtype } from "./serverCommunication";

const mineElement = document.getElementById("mine") as HTMLDivElement;
const minerElement = document.getElementById("miner") as HTMLDivElement;
const eliptaeElement = document.getElementById("eliptae") as HTMLDivElement;
const turretElement = document.getElementById("turret") as HTMLDivElement;

mineElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("mine");
});

minerElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("miner");
});

eliptaeElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("eliptae");
});
turretElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("turret");
});

// for popup

type LobbyState = NonNullable<z.infer<typeof IncomingStreamSchema>["a"]>["gs"];
export type Player = NonNullable<
  NonNullable<z.infer<typeof IncomingStreamSchema>["a"]>["gs"]
>["ps"][string];

const popup = document.getElementById("echoPopup") as HTMLElement;
const grid = document.getElementById("playersGrid") as HTMLElement;
const closeBtn = document.getElementById("echoClose") as HTMLButtonElement;
const readyForm = document.getElementById("readyForm") as HTMLFormElement;
const readyInput = document.getElementById("isReady") as HTMLInputElement;
const selfNameEl = document.getElementById("selfName") as HTMLElement;
const selfStatusEl = document.getElementById("selfStatus") as HTMLElement;

let currentState: LobbyState | null = null;
let currentSelfId: string | null = null;

function renderPlayers(state: LobbyState, selfId: string) {
  if (!state) return;
  grid.innerHTML = "";

  Object.entries(state.ps).forEach(([id, player]) => {
    if (!player) return;
    if (id === selfId) return;

    console.log(player);

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div class="player-name">${player.username || "other space kings..."}</div>
      <div class="player-meta">
        <div><span class="dot ${player.connected ? "connected" : "disconnected"}"></span>${
          player.connected ? "connected" : "disconnected"
        }</div>
        <div>ready: ${player.ready ? "yes" : "no"}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderSelf(self: Player | undefined) {
  if (!self) {
    selfNameEl.textContent = "you";
    selfStatusEl.textContent = "self player not found";
    readyInput.checked = false;
    return;
  }

  selfNameEl.textContent = self.username;
  selfStatusEl.textContent = `connected: ${self.connected ? "yes" : "no"} · ready: ${self.ready ? "yes" : "no"}`;
  readyInput.checked = self.ready;
}

export function loadAndOpen(state: LobbyState, userID: string) {
  if (!state) return;

  currentState = state;
  currentSelfId = Object.keys(state.ps).find((id) => id == userID) ?? null;

  console.log("self", currentSelfId && state.ps[currentSelfId]);

  if (!currentSelfId) {
    popup.classList.remove("hidden");
    grid.innerHTML = "";
    selfNameEl.textContent = "you";
    selfStatusEl.textContent = "you don't exist or are not connected";
    readyInput.checked = false;
    return;
  }

  renderPlayers(state, currentSelfId);
  renderSelf(state.ps[currentSelfId]);
  popup.classList.remove("hidden");
}

export function closePopup() {
  popup.classList.add("hidden");
}

// closeBtn.addEventListener("click", close);

readyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const isReady = readyInput.checked;
  gameManagerInstance.setIsReady(isReady);
});
