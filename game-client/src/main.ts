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

export async function start(gameServerURl: string) {
  try {
    await server.initConnection(gameServerURl);
    const game = StartGame("game-container");
  } catch (err) {
    console.error(`Could not connect to game with url '${gameServerURl}`);
    window.location.replace("/");
  }
}

function attemptAutoConnect() {
  const savedURL = getGameServerURl();
  console.log(savedURL);
  if (!savedURL) return window.location.replace("/");

  start(savedURL);
}

// get previously stored connection URL
export function getGameServerURl() {
  console.log(localStorage.getItem("data"));
  if (localStorage.getItem("data")) {
    try {
      //@ts-ignore
      const data = JSON.parse(localStorage.getItem("data"));
      if (data.url) {
        return data.url;
      } else {
        window.location.replace("/");
      }
    } catch (err) {
      window.location.replace("/");
    }
  } else {
    window.location.replace("/");
  }
}
