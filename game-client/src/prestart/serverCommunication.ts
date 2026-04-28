import { webT } from "../main";

// higher level server communication

// get previously stored connection URL
export function attemptAutoConnect() {
  const gameServerURL: string | null = localStorage.getItem("gameServerURL");
  if (gameServerURL) {
    webT.connectToGameServer(gameServerURL);
  }
}

// Save the URL to local storage
export function saveGameServerURL(gameServerURL: string) {
  localStorage.setItem("gameServerURL", gameServerURL);
}
