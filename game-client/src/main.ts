import ServerCommunication from "./serverCommunication";
import "./connectionUI";
import StartGame from "./game/main";
import { closeConnectionUI, openConnectionUI } from "./connectionUI";
import "./global.css";

let GAME = null;
let SERVER = new ServerCommunication();

document.addEventListener("DOMContentLoaded", () => {
  // auto connect to server for debug purposes: until auth is implemented
  attemptAutoConnect();
});

export async function start(gameServerURl: string) {
  try {
    await SERVER.initConnection(gameServerURl);
  } catch (err) {
    return console.error(
      `Could not connect to game with url '${gameServerURl}`,
    );
  }

  GAME = StartGame("game-container");
}

function attemptAutoConnect() {
  const savedURL = getGameServerURl();
  console.log(savedURL);
  if (!savedURL) return openConnectionUI();

  closeConnectionUI();

  start(savedURL);
}

// Save the URL to local storage
export function saveGameServerURL(gameServerURL: string) {
  localStorage.setItem("gameServerURL", gameServerURL);
}

// get previously stored connection URL
export function getGameServerURl() {
  return localStorage.getItem("gameServerURL");
}
