import ServerCommunication from "./serverCommunication";
import "./interfaceUI";
import StartGame from "./game/main";
import "./global.css";
import gameManager from "./game/gameManager";

let server = new ServerCommunication();
export let gameManagerInstance = new gameManager(server);

document.addEventListener("DOMContentLoaded", () => {
  // auto connect to server for debug purposes: until auth is implemented
  attemptAutoConnect();
});

export async function start(gameServerURl: string, userID: string) {
  try {
    await server.initConnection(gameServerURl, userID);
    const game = StartGame("game-container");
  } catch (err) {
    console.error(`Could not connect to game with url '${gameServerURl}`);
    // window.location.replace("/");
  }
}

function attemptAutoConnect() {
  const data = getGameData();
  if (!data) return window.location.replace("/");

  start(data.url, data.id);
}

// get previously stored connection URL
export function getGameData() {
  console.log(localStorage.getItem("data"));
  if (localStorage.getItem("data")) {
    try {
      //@ts-ignore
      const data = JSON.parse(localStorage.getItem("data"));
      if (data.url && data.id && data.name) {
        return data;
      } else {
        // window.location.replace("/");
      }
    } catch (err) {
      // window.location.replace("/");
    }
  } else {
    // window.location.replace("/");
  }
}
