import { webT } from "../main";
import { saveGameServerURL } from "./serverCommunication";

// HTML UI to connect to backend game server via URL
const connectionForm = document.getElementById("connection") as HTMLFormElement;

connectionForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const form = new FormData(connectionForm);
  // @ts-ignore
  const gameServerURL: string = form.get("game-server-url");

  saveGameServerURL(gameServerURL);
  webT.connectToGameServer(gameServerURL);
});
