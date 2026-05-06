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
let playerEvent = false;
let disconnectedPlayers: Set<string> = new Set();
let connectedReadyPlayers: Set<string> = new Set();
function checkForNewSessions() {
  for (const newSession of newPlayerSessions) {
    console.log("new session");
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
      } else p.setSession(newSession);
      newPlayerSessions.delete(newSession);
      playerEvent = true;
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
      playerEvent = true;
    }
  }
  for (const p of players.values()) {
    if (!p.session || !p.session.userID) continue;
    if (p.session.closed && !disconnectedPlayers.has(p.session.userID)) {
      disconnectedPlayers.add(p.session.userID);
      playerEvent = true;
    } else if (!p.session.closed && disconnectedPlayers.has(p.session.userID)) {
      disconnectedPlayers.delete(p.session.userID);
      playerEvent = true;
    }
    if (
      !disconnectedPlayers.has(p.session.userID) &&
      p.playerReady &&
      !connectedReadyPlayers.has(p.session.userID)
    ) {
      connectedReadyPlayers.add(p.session.userID);
      playerEvent = true;
    } else if (
      (disconnectedPlayers.has(p.session.userID) || !p.playerReady) &&
      connectedReadyPlayers.has(p.session.userID)
    ) {
      connectedReadyPlayers.delete(p.session.userID);
      playerEvent = true;
    }
  }
  // check if session is alwready link
}

let gameStarted = false;
let endOfGame = false;

function update() {
  console.log("running", tick);
  checkForNewSessions();

  if (gameStarted) {
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
      if (player.session && !player.session.closed) {
        if (playerEvent) {
          player.nonGameUpdate(
            tick,
            players,
            playerEvent,
            gameStarted,
            endOfGame,
          );
          playerEvent = false;
        }
        player.createDelta(
          tick,
          serverBuildingsMap.allDirtyChunksAt,
          serverEntitiesMap.allDirtyChunksAt,
        );
        player.sendDelta(tick);
        player.sendSnapshot(tick);
      }
    });
  } else {
    if (endOfGame) {
      // end game stuff
    } else {
      // before game
      // check if we can start the game
      if (connectedReadyPlayers.size >= 2) {
        gameStarted = true;
        playerEvent = true;
      }
      players.forEach((player) => {
        if (player.session && !player.session.closed) {
          if (playerEvent)
            player.nonGameUpdate(
              tick,
              players,
              playerEvent,
              gameStarted,
              endOfGame,
            );
          player.sendNonGameUpdate();
        }
      });
      playerEvent = false;
    }
  }
  tick++;
}
setInterval(update, 100);
console.log("updated");
