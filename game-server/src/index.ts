import "./app";
import { playerSessions } from "./app";
import { MapEntities } from "./entities/entities";
import { loadMap } from "./loadMap";
import Player from "./Player";

// Load Tiled map
const serverBuildingsMap = await loadMap(
  "/home/asus/Documents/Etudes Info L2/Dev web/Projet web/game-server/src/maps/map1/testmap1.tmj",
  [
    "/home/asus/Documents/Etudes Info L2/Dev web/Projet web/game-server/src/maps/map1/naturaltilseset1.tsj",
    "/home/asus/Documents/Etudes Info L2/Dev web/Projet web/game-server/src/maps/map1/new_natural_tiles.tsj",
  ],
);
const serverEntitiesMap = new MapEntities(
  serverBuildingsMap.mapWidth,
  serverBuildingsMap.mapHeight,
);

export const players: Map<string, Player> = new Map();
players.set(
  "playerIDDB",
  new Player(
    { x: 0, y: 0, width: 10, height: 10 },
    serverBuildingsMap,
    serverEntitiesMap,
  ),
);

let tick = 1;
function update() {
  if (playerSessions.size > 0) {
    playerSessions.forEach((session) => {
      if (!players.get("playerIDDB")?.session) {
        console.log("init player");
        players
          .get("playerIDDB")
          ?.linkSession(
            session,
            serverBuildingsMap.allDirtyChunks,
            serverBuildingsMap.buildings,
            serverEntitiesMap.allDirtyChunks,
            serverEntitiesMap.entityChunks,
          );
        players.get("playerIDDB")?.createBuildingSnapshot(tick);
        players.get("playerIDDB")?.createActionsSnapshot(tick);
        players.get("playerIDDB")?.sendSnapshot(tick);
      }
    });
  }
  console.log("running", tick);
  // read data from clients and do actions
  //...

  // simulate
  serverBuildingsMap.updateBuildings(tick);
  serverEntitiesMap.updateEntities(tick);

  // build and send the delta snapshot
  players.forEach((player) => {
    player.processDatagrams();
    player.processStreams(tick);
    player.createDelta(
      tick,
      serverBuildingsMap.allDirtyChunksAt,
      serverEntitiesMap.allDirtyChunksAt,
    );
    player.sendDelta(tick);
    player.sendSnapshot(tick);
  });
  tick++;
}
setInterval(update, 50);
console.log("updated");
