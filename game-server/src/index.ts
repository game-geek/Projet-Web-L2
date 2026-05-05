import "./app";
import { playerSessions } from "./app";
import { MapEntities } from "./entities/entities";
import { GLOBAL_INDEX, incrementGlobalIndex, loadMap } from "./loadMap";
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
    { x: 0, y: 0, width: 100, height: 100 },
    serverBuildingsMap,
    serverEntitiesMap,
  ),
);

const ai = new Player(
  { x: 0, y: 0, width: 100, height: 100 },
  serverBuildingsMap,
  serverEntitiesMap,
);

serverEntitiesMap.createAndAddEntity("eliptae", 50 * 32, 50 * 32, GLOBAL_INDEX);
ai.entities.add(GLOBAL_INDEX);
incrementGlobalIndex();
serverEntitiesMap.createAndAddEntity("eliptae", 52 * 32, 50 * 32, GLOBAL_INDEX);
ai.entities.add(GLOBAL_INDEX);
incrementGlobalIndex();
serverEntitiesMap.createAndAddEntity("eliptae", 50 * 32, 52 * 32, GLOBAL_INDEX);
ai.entities.add(GLOBAL_INDEX);
incrementGlobalIndex();
serverEntitiesMap.createAndAddEntity("eliptae", 54 * 32, 52 * 32, GLOBAL_INDEX);
ai.entities.add(GLOBAL_INDEX);
incrementGlobalIndex();
serverEntitiesMap.createAndAddEntity("eliptae", 54 * 32, 52 * 32, GLOBAL_INDEX);
ai.entities.add(GLOBAL_INDEX);
incrementGlobalIndex();
serverBuildingsMap.createAndAddBuilding(
  "turret",
  "turret",
  14,
  14,
  GLOBAL_INDEX,
);
incrementGlobalIndex();

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
        players.get("playerIDDB")?.createEntitySnapshot(tick);
        players.get("playerIDDB")?.createActionsSnapshot(tick);
        players.get("playerIDDB")?.sendSnapshot(tick);
      }
    });
  }
  console.log("running", tick);
  // read data from clients and do actions
  //...

  // clear previous
  serverBuildingsMap.preUpdate();
  serverEntitiesMap.preUpdate();

  // process inputs
  players.forEach((player) => {
    player.processDatagrams();
    player.processStreams(tick);
    player.update(tick);
  });
  ai.update(tick);

  // simulate
  serverBuildingsMap.updateBuildings(tick);
  serverEntitiesMap.updateEntities(tick);

  // build and send the delta snapshot
  players.forEach((player) => {
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
setInterval(update, 100);
console.log("updated");
