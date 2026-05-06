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
    card.style.border = ".5px solid" + player.color;
    grid.appendChild(card);
    // grid.getElementsByClassName("player-name")[0].style.color = player.color;
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

// banner

const bannerElement = document.getElementById("playerBanner") as HTMLElement;

export function updatePlayerBanner(
  validatedData: LobbyState,
  userID: string,
): void {
  if (!validatedData) return;

  // Clear existing slots
  bannerElement.innerHTML = "";

  // Update slots with player data
  let slotIndex = 0;
  Object.entries(validatedData.ps)
    .sort(([id1, p1], [id2, _]) =>
      id1 == userID ? -1 : id2 == userID ? 1 : p1.connected ? -1 : 1,
    )
    .forEach(([playerID, player]) => {
      const slot = document.createElement("div");
      slot.className = "banner-player-slot";

      const playerName = document.createElement("div");
      playerName.className = "banner-player-name";

      const playerStatus = document.createElement("h6");
      playerStatus.className = "banner-player-status";

      slot.appendChild(playerName);
      slot.appendChild(playerStatus);
      bannerElement.appendChild(slot);

      // Update name
      playerName.textContent = playerID == userID ? "YOU" : player.username;

      if (player.connected) {
        playerStatus.textContent = "connected";
        playerStatus.className = `banner-player-connected`;
      } else {
        playerStatus.textContent = "disconnected";
        playerStatus.className = "banner-player-disconnected";
      }

      // Apply player color to border (override accent)
      slot.style.backgroundColor = hexToRgba(player.color, 0.3);

      slotIndex++;
    });

  // Style override for player color in CSS (add this to your CSS)
  const style = document.createElement("style");
  style.textContent = `
    .banner-player-slot.connected::before {
      border-color: var(--player-color, var(--accent));
      box-shadow: 0 0 4px var(--player-color-rgb, rgba(160, 96, 255, 0.3));
    }
  `;
  document.head.appendChild(style);
}

function hexToRgba(hex: string, alpha = 1) {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
