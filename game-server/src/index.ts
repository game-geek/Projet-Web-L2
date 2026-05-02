import "./app";
import { playerSessions } from "./app";
import { loadMap } from "./loadMap";
import Player from "./Player";

// Load Tiled map
const serverBuildingsMap = await loadMap(
  "/home/asus/Documents/Etudes Info L2/Dev web/Projet web/game-server/src/maps/map1/testmap1.tmj",
  [
    "/home/asus/Documents/Etudes Info L2/Dev web/Projet web/game-server/src/maps/map1/naturaltilseset1.tsj",
  ],
);

export const players: Map<string, Player> = new Map();
players.set("playerIDDB", new Player({ x: 0, y: 0, width: 10, height: 10 }));

function update() {
  if (playerSessions.size > 0) {
    playerSessions.forEach((session) =>
      players
        .get("playerIDDB")
        ?.linkSession(session, serverBuildingsMap.allDirtyChunks),
    );
  }
  console.log("running");
  const tick = 0;
  // read data from clients and do actions
  //...

  // simulate
  serverBuildingsMap.updateBuildings(tick);

  // build and send the delta snapshot
  players.forEach((player) => {
    player.createDelta(tick, serverBuildingsMap.allDirtyChunksAt);
    player.sendDelta();
  });
}
setInterval(update, 200);
console.log("updated");
