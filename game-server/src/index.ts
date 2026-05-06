import "./app";
import { newPlayerSessions } from "./app";
import { MapEntities } from "./entities/entities";
import { GLOBAL_INDEX, incrementGlobalIndex, loadMap } from "./loadMap";
import Player from "./Player";

const gameColors: string[] = [
  "#FF0000", // bright red
  "#00FF00", // lime green
  "#0000FF", // royal blue
  "#FFFF00", // yellow
  "#FF00FF", // magenta
  "#00FFFF", // cyan
  "#FFA500", // orange
  "#800080", // purple
  "#00FF7F", // spring green
  "#FF4500", // orange red
  "#32CD32", // lime green
  "#1E90FF", // dodger blue
  "#FF69B4", // hot pink
  "#FFD700", // gold
  "#ADFF2F", // green yellow
  "#FF1493", // deep pink
  "#00BFFF", // deep sky blue
  "#7CFC00", // lawn green
  "#FF6347", // tomato
  "#8A2BE2", // blue violet
];
let gameColorAt = 0;

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
  gameColors[gameColorAt],
);
gameColorAt += 1;

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
let connectedPlayers: Set<string> = new Set();
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
        if (gameColorAt < gameColors.length) {
          const p = new Player(
            { x: 0, y: 0, width: 100, height: 100 },
            serverBuildingsMap,
            serverEntitiesMap,
            gameColors[gameColorAt],
          );
          gameColorAt += 1;
          players.set(newSession.userID, p);
          p.setSession(newSession);
        } else {
          console.log(
            "Cannot add player instance because there are not enough colors (20 player instances exist)",
          );
        }
      } else p.setSession(newSession);
      newPlayerSessions.delete(newSession);
      playerEvent = true;
    } else if (newSession.userID) {
      if (players.size >= MAX_PLAYERS) {
        // player limit reached, make spectator ?
      }

      if (gameColorAt < gameColors.length) {
        const p = new Player(
          { x: 0, y: 0, width: 100, height: 100 },
          serverBuildingsMap,
          serverEntitiesMap,
          gameColors[gameColorAt],
        );
        gameColorAt += 1;
        players.set(newSession.userID, p);
        p.setSession(newSession);
      } else {
        console.log(
          "Cannot add player instance because there are not enough colors (20 player instances exist)",
        );
      }
      newPlayerSessions.delete(newSession);
      playerEvent = true;
    }
  }
  for (const p of players.values()) {
    if (!p.session || !p.session.userID) continue;
    console.log(
      "player",
      p.session.closed,
      connectedPlayers.has(p.session.userID),
    );
    if (!p.session.closed && !connectedPlayers.has(p.session.userID)) {
      connectedPlayers.add(p.session.userID);
      playerEvent = true;
    } else if (p.session.closed && connectedPlayers.has(p.session.userID)) {
      connectedPlayers.delete(p.session.userID);
      playerEvent = true;
    }
    if (p.session.closed && !disconnectedPlayers.has(p.session.userID)) {
      disconnectedPlayers.add(p.session.userID);
      console.log("player disconnected ");
      playerEvent = true;
    } else if (!p.session.closed && disconnectedPlayers.has(p.session.userID)) {
      disconnectedPlayers.delete(p.session.userID);
      playerEvent = true;
      console.log("player connected");
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
        console.log("sending playerEvent", playerEvent);
        player.nonGameUpdate(
          tick,
          players,
          playerEvent,
          gameStarted,
          endOfGame,
        );

        player.createDelta(
          tick,
          serverBuildingsMap.allDirtyChunksAt,
          serverEntitiesMap.allDirtyChunksAt,
        );
        player.sendDelta(tick);
        player.sendSnapshot(tick);
      }
    });
    playerEvent = false;
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
