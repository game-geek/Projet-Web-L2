import "./app";
import { newPlayerSessions } from "./app";
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
const MAX_PLAYERS = 4;
function checkForNewSessions() {
  for (const newSession of newPlayerSessions) {
    if (newSession.userID && players.has(newSession.userID)) {
      // player rejoining
      // link new session
      const p = players.get(newSession.userID);
      if (!p) {
        if (players.size >= MAX_PLAYERS) {
          // player limit reached, make spectator ?
        }
        const p = new Player(
          { x: 0, y: 0, width: 100, height: 100 },
          serverBuildingsMap,
          serverEntitiesMap,
        );
        players.set(newSession.userID, p);
        p.setSession(newSession);

        newPlayerSessions.delete(newSession);
      } else p.setSession(newSession);
    } else if (newSession.userID) {
      if (players.size >= MAX_PLAYERS) {
        // player limit reached, make spectator ?
      }

      const p = new Player(
        { x: 0, y: 0, width: 100, height: 100 },
        serverBuildingsMap,
        serverEntitiesMap,
      );
      players.set(newSession.userID, p);
      p.setSession(newSession);
      newPlayerSessions.delete(newSession);
    }
  }
  // check if session is alwready link
}

function update() {
  checkForNewSessions();

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
setInterval(update, 500);
console.log("updated");
