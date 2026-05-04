import ServerCommunication from "./serverCommunication";
import "./connectionUI";
import StartGame from "./game/main";
import { closeConnectionUI, openConnectionUI } from "./connectionUI";
import "./global.css";
import gameManager from "./game/gameManager";

let server = new ServerCommunication();
let gameManagerInstance = new gameManager(server);

document.addEventListener("DOMContentLoaded", () => {
  // auto connect to server for debug purposes: until auth is implemented
  attemptAutoConnect();
});

export async function start(gameServerURl: string) {
  try {
    await server.initConnection(gameServerURl);
    closeConnectionUI();
    const game = StartGame("game-container");
    game.events.once("ready", () => {
      game.scene.start("Game", {
        gameManagerInstance,
      });
    });
  } catch (err) {
    console.error(`Could not connect to game with url '${gameServerURl}`);
    openConnectionUI();
  }
}

function attemptAutoConnect() {
  const savedURL = getGameServerURl();
  console.log(savedURL);
  if (!savedURL) return openConnectionUI();

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
