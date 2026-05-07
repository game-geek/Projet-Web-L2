import "./app";
import { newPlayerSessions } from "./app";
import { MAP_WIDTH } from "./buildings/globals";
import { MapEntities } from "./entities/entities";
import { gameColors } from "./globals";
import { GLOBAL_INDEX, incrementGlobalIndex, loadMap } from "./loadMap";
import Player, { getRandomInt } from "./Player";

let gameColorAt = 1;
export let GLOBAL_USER_IDS = 0;
export function incrementGlobalUserIDs() {
  GLOBAL_USER_IDS += 1;
}

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

// serverEntitiesMap.createAndAddEntity("eliptae", 50 * 32, 50 * 32, GLOBAL_INDEX);
// ai.entities.add(GLOBAL_INDEX);
// incrementGlobalIndex();
// serverEntitiesMap.createAndAddEntity("eliptae", 52 * 32, 50 * 32, GLOBAL_INDEX);
// ai.entities.add(GLOBAL_INDEX);
// incrementGlobalIndex();
// serverEntitiesMap.createAndAddEntity("eliptae", 50 * 32, 52 * 32, GLOBAL_INDEX);
// ai.entities.add(GLOBAL_INDEX);
// incrementGlobalIndex();
// serverEntitiesMap.createAndAddEntity("eliptae", 54 * 32, 52 * 32, GLOBAL_INDEX);
// ai.entities.add(GLOBAL_INDEX);
// incrementGlobalIndex();
// serverEntitiesMap.createAndAddEntity("eliptae", 54 * 32, 52 * 32, GLOBAL_INDEX);
// ai.entities.add(GLOBAL_INDEX);
// incrementGlobalIndex();
// serverBuildingsMap.createAndAddBuilding(
//   "turret",
//   "turret",
//   14,
//   14,
//   GLOBAL_INDEX,
// );
// incrementGlobalIndex();

export type SpawnPoint = { x: number; y: number; userID: string | null };
const spawns: Set<SpawnPoint> = new Set();
for (let spawnY = 0; spawnY * 50 < MAP_WIDTH; spawnY++) {
  for (let spawnX = 0; spawnX * 50 < MAP_WIDTH; spawnX++) {
    spawns.add({ x: spawnX * 50 + 25, y: spawnY * 50 + 25, userID: null });
  }
}

let winner: null | number = null;
const MAX_PLAYERS = 4;
function checkCores() {
  const alivePlayers = [];

  for (const player of [...players.values(), ai]) {
    if (!player) continue;
    if (
      serverBuildingsMap.buildings[player.spawnPoint.y][player.spawnPoint.x]
    ) {
      alivePlayers.push(player);
    } else {
      player.dead = true;
    }
  }
  if (alivePlayers.length == 0) {
    endOfGame = true;
    gameStarted = false;
    playerEvent = true;
  }
  if (alivePlayers.length == 1) {
    endOfGame = true;
    playerEvent = true;
    winner = alivePlayers[0].userID;
    gameStarted = false;
    for (const player of players.values()) player.winner = winner;
  }
}

function spawnPlayer(userID: string): Player | false {
  if (players.size >= MAX_PLAYERS) {
    // player limit reached, make spectator ?
  }
  if (gameColorAt >= gameColors.length) {
    return false;
  }

  // try to get spawn point
  const freeSpawns = [];
  for (const spawn of spawns) {
    if (spawn.userID == null) freeSpawns.push(spawn);
  }
  if (freeSpawns.length == 0) return false;
  const s =
    userID == "AI"
      ? freeSpawns[2]
      : freeSpawns[getRandomInt(0, freeSpawns.length - 1)];
  s.userID = userID;
  const p = new Player(
    { x: 0, y: 0, width: 100, height: 100 },
    serverBuildingsMap,
    serverEntitiesMap,
    gameColors[gameColorAt],
    gameColorAt,
    s,
  );
  gameColorAt += 1;
  return p;
}

const ai = spawnPlayer("AI");
if (ai) {
  let y = 72;
  for (let x = 17; x <= 33; x++) {
    serverBuildingsMap.createAndAddBuilding(
      "wall",
      "wall",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
  let x = 33;
  for (let y = 72; y < 87; y++) {
    serverBuildingsMap.createAndAddBuilding(
      "wall",
      "wall",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
  y = 87;
  for (let x = 33; x > 17; x--) {
    serverBuildingsMap.createAndAddBuilding(
      "wall",
      "wall",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
  x = 17;
  for (let y = 87; y > 72; y--) {
    serverBuildingsMap.createAndAddBuilding(
      "wall",
      "wall",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }

  // turrets

  y = 73;
  for (let x = 18; x <= 32; x += 2) {
    serverBuildingsMap.createAndAddBuilding(
      "turret",
      "turret",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
  x = 32;
  for (let y = 73; y < 86; y += 2) {
    serverBuildingsMap.createAndAddBuilding(
      "turret",
      "turret",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
  y = 86;
  for (let x = 32; x > 18; x -= 2) {
    serverBuildingsMap.createAndAddBuilding(
      "turret",
      "turret",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
  x = 18;
  for (let y = 86; y > 73; y -= 2) {
    serverBuildingsMap.createAndAddBuilding(
      "turret",
      "turret",
      x,
      y,
      GLOBAL_INDEX,
      ai.userID,
    );
    ai.buildings.add(GLOBAL_INDEX);
    incrementGlobalIndex();
  }
}

gameColorAt += 1;

let tick = 1;
let playerEvent = false;
let disconnectedPlayers: Set<string> = new Set();
let connectedReadyPlayers: Set<string> = new Set();
let connectedPlayers: Set<string> = new Set();
function checkForNewSessions() {
  for (const newSession of newPlayerSessions) {
    if (newSession.userID && players.has(newSession.userID)) {
      // player rejoining
      // link new session
      const p = players.get(newSession.userID);
      if (!p) {
        const p = spawnPlayer(newSession.userID);
        if (p) {
          players.set(newSession.userID, p);
          p.setSession(newSession);
        } else {
          console.log(
            "Cannot add player instance because there are not enough space/colors (20 player instances exist)",
          );
        }
      } else p.setSession(newSession);
      newPlayerSessions.delete(newSession);
      playerEvent = true;
    } else if (newSession.userID) {
      const p = spawnPlayer(newSession.userID);
      if (p) {
        players.set(newSession.userID, p);
        p.setSession(newSession);
      } else {
        console.log(
          "Cannot add player instance because there are not enough space/colors (20 player instances exist)",
        );
      }
      newPlayerSessions.delete(newSession);
      playerEvent = true;
    }
  }
  for (const p of players.values()) {
    if (!p.session || !p.session.userID) continue;
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
  checkForNewSessions();

  if (gameStarted) {
    // console.log("updating");
    checkCores();
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
    if (ai) {
      ai.update(tick);
    }
    // simulate
    serverBuildingsMap.updateBuildings(tick);
    serverEntitiesMap.updateEntities(tick);
    // build and send the delta snapshot
    players.forEach((player) => {
      if (player.session && !player.session.closed) {
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
      players.forEach((player) => {
        if (player.session && !player.session.closed) {
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
      // end game stuff
    } else {
      // before game
      // check if we can start the game
      if (connectedReadyPlayers.size >= 2) {
        gameStarted = true;
        playerEvent = true;
        players.forEach((player) => {
          if (player.session && !player.session.closed) {
            player.createSnapshot(tick);
          }
        });
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
setInterval(update, 50);
