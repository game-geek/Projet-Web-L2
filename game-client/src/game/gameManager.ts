import { Geom } from "phaser";
import { BuildingSnapshotFields } from "../../../game-server/src/buildings/buildings";
import {
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game-server/src/buildings/globals";
import serverCommunication from "../serverCommunication";
import {
  buildingsComponentRegistry,
  createClientBuilding,
  issueBuildingDeltaUpdate,
  MapBuildings,
} from "./buildings/buildings";
import { ClientStreamtype } from "../../../game-server/src/Player";
import {
  createClientEntity,
  entitiesComponentRegistry,
  issueEntitiesSnapshotUpdate,
  issueEntityDeltaUpdate,
  MapEntities,
} from "./entities/entities";
import {
  closePopup,
  loadAndOpen,
  PlayersData,
  updatePlayerBanner,
} from "../interfaceUI";
type EntityBounds = { x: number; y: number; w: number; h: number };
function isColliding(bullet: EntityBounds, target: EntityBounds): boolean {
  return (
    bullet.x < target.x + target.w &&
    bullet.x + bullet.w > target.x &&
    bullet.y < target.y + target.h &&
    bullet.y + bullet.h > target.y
  );
}

export default class gameManager {
  public clientBuildingsMap = new MapBuildings(MAP_WIDTH, MAP_HEIGHT);
  public clientEntitiesMap = new MapEntities(MAP_WIDTH, MAP_HEIGHT);
  public clientDatagram: {
    t: number;
    ack?: number;
  } | null = null;
  public clientStream: ClientStreamtype | null = null;
  public tick = 0;
  public scene: Phaser.Scene | null = null;

  public predictions: {
    buildingsToMine: Map<number, Set<number>>;
  } = {
    buildingsToMine: new Map(),
  };
  public buildingsToMine: Set<number> = new Set();
  public entitiesSelected: Set<number> = new Set();
  public gameStarted = false;
  public playersData: PlayersData = {};
  currency = 0;

  constructor(public server: serverCommunication) {}

  init(scene: Phaser.Scene) {
    this.scene = scene;
    console.log("gamemanager init");
  }

  setIsReady(ready: boolean) {
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    this.clientStream.a.r = ready;
  }

  dispatchAction(
    action: null | "mine" | "miner" | "eliptae" | "turret" | "wall",
  ) {
    if (!this.scene) return;
    // @ts-ignore
    if (action == "mine") this.scene.setOverlayAction(action);
    // @ts-ignore
    else if (action == "miner") this.scene.setOverlayAction(action);
    // @ts-ignore
    else if (action == "eliptae") this.scene.setOverlayAction(action);
    // @ts-ignore
    else if (action == "turret") this.scene.setOverlayAction(action);
    // @ts-ignore
    else if (action == "wall") this.scene.setOverlayAction(action);
  }

  spawnWall(x: number, y: number) {
    if (
      x < 0 ||
      y < 0 ||
      x > this.clientEntitiesMap.width * 32 ||
      y > this.clientEntitiesMap.height * 32
    )
      return;
    if (
      this.clientBuildingsMap.buildingsMap[Math.floor(y / 32)][
        Math.floor(x / 32)
      ]
    )
      return;
    // spawn wall
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    if (!this.clientStream.a.spB) this.clientStream.a.spB = [];
    this.clientStream.a.spB.push({ n: "wall", v: "wall", x, y });
  }

  spawnMiner(x: number, y: number) {
    if (
      x < 0 ||
      y < 0 ||
      x > this.clientEntitiesMap.width * 32 ||
      y > this.clientEntitiesMap.height * 32
    )
      return;
    if (
      this.clientBuildingsMap.buildingsMap[Math.floor(y / 32)][
        Math.floor(x / 32)
      ]
    )
      return;
    // spawn miner
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    if (!this.clientStream.a.spE) this.clientStream.a.spE = [];
    this.clientStream.a.spE.push({ n: "miner", x, y });
  }

  spawnEliptae(x: number, y: number) {
    if (
      x < 0 ||
      y < 0 ||
      x > this.clientEntitiesMap.width * 32 ||
      y > this.clientEntitiesMap.height * 32
    )
      return;
    // spawn miner
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    if (!this.clientStream.a.spE) this.clientStream.a.spE = [];
    this.clientStream.a.spE.push({ n: "eliptae", x, y });
  }

  spawnTurret(x: number, y: number) {
    if (
      x < 0 ||
      y < 0 ||
      x > this.clientEntitiesMap.width * 32 ||
      y > this.clientEntitiesMap.height * 32
    )
      return;
    if (
      this.clientBuildingsMap.buildingsMap[Math.floor(y / 32)][
        Math.floor(x / 32)
      ]
    )
      return;
    // spawn miner
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    if (!this.clientStream.a.spB) this.clientStream.a.spB = [];
    this.clientStream.a.spB.push({
      n: "turret",
      v: "turret",
      x: Math.floor(x),
      y: Math.floor(y),
    });
  }

  clearRobotSelection() {
    this.updateSelectedEntitiesOverlay(new Set());
  }

  targetRobotSelection(x: number, y: number) {
    if (
      x < 0 ||
      y < 0 ||
      x > this.clientEntitiesMap.width * 32 ||
      y > this.clientEntitiesMap.height * 32
    )
      return;
    console.log("setting target");
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    if (!this.clientStream.a.mE) this.clientStream.a.mE = {};
    for (const entityID of this.entitiesSelected) {
      this.clientStream.a.mE[entityID] = {
        x: x,
        y: y,
      };
    }
  }

  robotSelection(selection: Geom.Rectangle) {
    if (!this.playersData || !this.server.userID) return;
    if (
      selection.x < 0 ||
      selection.y < 0 ||
      selection.width > this.clientEntitiesMap.width * 32 ||
      selection.height > this.clientEntitiesMap.height * 32
    )
      return;
    // find robot entities
    //   for (
    //     let chunk_y = Math.floor(selection.y / (CHUNK_HEIGHT*32));
    //     chunk_y < Math.floor((selection.y + selection.height) / (CHUNK_HEIGHT*32))+1;
    //     chunk_y += 1
    //   ) {
    //     for (
    //       let chunk_x = Math.floor(selection.y / (CHUNK_HEIGHT*32));
    //       chunk_x < Math.floor((selection.x + selection.width) / (CHUNK_WIDTH*32))+1;
    //       chunk_x += 1
    //     ) {
    //       // in the future make it into chunks

    //     }
    // }
    const entitiesSelected: Set<number> = new Set();
    const s = {
      x: selection.x,
      y: selection.y,
      w: selection.width,
      h: selection.height,
    };
    for (const entity of this.clientEntitiesMap.entities.values()) {
      if (
        entity.kind == "eliptae" &&
        entity.ownerID == this.playersData[this.server.userID].ownerID &&
        isColliding(s, { x: entity.x, y: entity.y, w: entity.w, h: entity.h })
      ) {
        entitiesSelected.add(entity.id);
      }
    }

    this.updateSelectedEntitiesOverlay(entitiesSelected);
  }

  updateSelectedEntitiesOverlay(entitiesSelected: Set<number>) {
    if (!this.scene) return;
    for (const entitySelected of entitiesSelected) {
      if (!this.entitiesSelected.has(entitySelected)) {
        this.clientEntitiesMap.addComponent(
          entitySelected,
          "EntitySelectedOverlay",
          entitiesComponentRegistry.EntitySelectedOverlay,
          this.scene,
        );
      }
    }
    for (const entitySelected of this.entitiesSelected) {
      if (!entitiesSelected.has(entitySelected)) {
        this.clientEntitiesMap.removeComponent(
          entitySelected,
          "EntitySelectedOverlay",
        );
      }
    }
    this.entitiesSelected.clear();
    for (const entitySelected of entitiesSelected) {
      this.entitiesSelected.add(entitySelected);
    }
    console.log(this.entitiesSelected);
  }

  mineSelection(selection: Geom.Rectangle) {
    // find minable buildings and add to snapshot
    const buildingsToMine: Set<number> = new Set();
    for (
      let y = Math.floor(selection.y / 32);
      y < Math.ceil((selection.y + selection.height) / 32);
      y += 1
    ) {
      for (
        let x = Math.floor(selection.x / 32);
        x < Math.ceil((selection.x + selection.width) / 32);
        x += 1
      ) {
        if (y < 0 || y > MAP_WIDTH || x < 0 || x > MAP_HEIGHT) continue;
        const b = this.clientBuildingsMap.buildingsMap[y][x];
        if (b && b.kind == "natural_wall") {
          if (this.buildingsToMine.has(b.id)) continue;
          let found = false;
          for (const p of this.predictions.buildingsToMine.values()) {
            if (p.has(b.id)) {
              found = true;
              break;
            }
          }
          if (found) continue;
          console.log(b.id, this.buildingsToMine, this.predictions);
          buildingsToMine.add(b.id);
        }
      }
    }
    if (buildingsToMine.size == 0) return;
    console.log("adding buildings to mine to stream + created prediction");
    // create prediction
    this.predictions.buildingsToMine.set(this.tick, buildingsToMine);
    // send data to client
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    this.clientStream.a.bM = [...buildingsToMine];
    // render overlays for prediction
    this.setPredictionMiningOverlay(this.tick);
  }
  update(dt: number) {
    this.tick++;
    // console.log("gameManager tick", this.tick);

    // parse the latest datagrams and snapshots
    this.server.parseDatagrams();
    this.server.parseStreams();

    // send inputs
    // this.processInputs();
    if (this.clientDatagram) {
      this.server.sendDatagram(this.clientDatagram);
      this.clientDatagram = null;
    }
    if (this.clientStream) {
      this.server.sendStream(this.clientStream);
      this.clientStream = null;
    }

    // apply stream/datagram changes
    this.loadFullBuildingsSnapshot();
    this.loadFullEntitiesSnapshot();
    this.processDatagramDelta();
    this.processStreamActions();
    // this.clientBuildingsMap._displayDebugMap();
    // simulate

    // run interpolation on all components
    this.clientEntitiesMap.updateEntities(dt);
  }

  private setPredictionMiningOverlay(tick: number) {
    if (!this.scene) return; // could be bad...
    // render overlays for the prediction
    if (this.predictions.buildingsToMine.has(tick)) {
      const buildingMiningPrediction =
        this.predictions.buildingsToMine.get(tick);
      if (!buildingMiningPrediction) return;
      for (const buildingID of buildingMiningPrediction) {
        // check if its not in the predictions alwready or in the alwready ones

        if (buildingID in this.buildingsToMine) continue;
        let found = false;
        for (const [p, pids] of this.predictions.buildingsToMine.entries()) {
          if (p != tick && buildingID in pids) {
            found = true;
            break;
          }
        }
        if (found) continue;
        this.clientBuildingsMap.addComponent(
          buildingID,
          "MiningOverlay",
          buildingsComponentRegistry["MiningOverlay"],
          this.scene,
        );
      }
    }
  }

  private setRealMiningOverlayWithPredictions(
    afterPredictionTick: number,
    buildingsToMine: Set<number>,
  ) {
    if (!this.scene) return; // could be bad...
    // remove all predictions before that tick included and put everything at ease
    const newBuildingIdsForOverlay: Set<number> = new Set();
    const predictionsToRemove = [];
    for (const buildingMiningPredictionID of this.predictions.buildingsToMine.keys()) {
      if (buildingMiningPredictionID <= afterPredictionTick) {
        predictionsToRemove.push(buildingMiningPredictionID);
      }
      const buildingMiningPrediction = this.predictions.buildingsToMine.get(
        buildingMiningPredictionID,
      );
      if (!buildingMiningPrediction) continue;
      for (const bid of buildingMiningPrediction) {
        if (!(newBuildingIdsForOverlay.has(bid) || buildingsToMine.has(bid)))
          newBuildingIdsForOverlay.add(bid);
      }
    }

    let buildingIdsToRemoveIfNotPresent: Set<number> = new Set();
    for (const predictionIDToRemove of predictionsToRemove) {
      const predictionToRemove =
        this.predictions.buildingsToMine.get(predictionIDToRemove);
      if (!predictionToRemove) {
        this.predictions.buildingsToMine.delete(predictionIDToRemove);
        continue;
      }
      for (const bid of predictionToRemove) {
        if (!(newBuildingIdsForOverlay.has(bid) || buildingsToMine.has(bid)))
          buildingIdsToRemoveIfNotPresent.add(bid);
      }
    }

    console.log(
      "huge update",
      buildingIdsToRemoveIfNotPresent,
      newBuildingIdsForOverlay,
      buildingsToMine,
    );
    // apply changes
    for (const bid of newBuildingIdsForOverlay) {
      this.clientBuildingsMap.addComponent(
        bid,
        "MiningOverlay",
        buildingsComponentRegistry["MiningOverlay"],
        this.scene,
      );
    }
    for (const bid of buildingsToMine) {
      this.clientBuildingsMap.addComponent(
        bid,
        "MiningOverlay",
        buildingsComponentRegistry["MiningOverlay"],
        this.scene,
      );
    }
    for (const bid of buildingIdsToRemoveIfNotPresent) {
      this.clientBuildingsMap.removeComponent(bid, "MiningOverlay");
    }
  }
  processStreamActions() {
    for (const action of this.server.latestActions) {
      if (!action) return;
      console.log("processing stream action");
      if (action.bM) {
        console.log("got a complete buildingsToMine action");
        for (const bM of action.bM) {
          const buildingsToMine = new Set(bM.bM);
          this.setRealMiningOverlayWithPredictions(bM.t, buildingsToMine);
          this.buildingsToMine = buildingsToMine;
        }
      }
      if (typeof action.c == "number") {
        this.currency = action.c;
      }
      if (action.nB) {
        for (const newBuildingID in action.nB) {
          console.log("Creating a building", newBuildingID);
          // @ts-ignore need to typesafe the parsing with BuildingSnapshot
          this.clientBuildingsMap.addBuilding(
            createClientBuilding(
              // @ts-ignore
              { ...action.nB[newBuildingID], id: parseInt(newBuildingID) },
              this.scene,
            ),
          );
        }
      }
      if (action.nE) {
        for (const newEntityID in action.nE) {
          console.log("Creating an Entity", newEntityID);

          // @ts-ignore need to typesafe the parsing with BuildingSnapshot
          this.clientEntitiesMap.addEntity(
            createClientEntity(
              // @ts-ignore
              { ...action.nE[newEntityID], id: parseInt(newEntityID) },
              this.scene,
            ),
          );
        }
      }
      // delete buildings
      if (action.rB) {
        for (const buildingID of action.rB) {
          this.clientBuildingsMap.removeBuilding(buildingID);
        }
      }
      // delete entities
      if (action.rE) {
        for (const entityID of action.rE) {
          this.clientEntitiesMap.removeEntity(entityID);
        }
      }

      // game state
      if (action.gs) {
        this.gameStarted = action.gs.gs;
        this.playersData = action.gs.ps;
        if (!action.gs.gs && !action.gs.ge)
          loadAndOpen(action.gs, this.server.userID ?? "");
        else closePopup();
        updatePlayerBanner(
          action.gs,
          this.server.userID ?? "_unknown_username_",
        );
      }
      this.server.latestActions.delete(action);
    }
  }

  processDatagramDelta() {
    if (this.server.latestDatagram) {
      console.log("Processing server delta");
      if (this.server.latestDatagram.bd) {
        for (const buildingID in this.server.latestDatagram.bd) {
          if (!this.clientBuildingsMap.buildings.has(parseInt(buildingID))) {
            // create the building with default fields if not present
            console.log(
              "got an update of an building we don't have, fatal error!",
            );
          } else {
            console.log("updating building");
            issueBuildingDeltaUpdate(
              // @ts-ignore
              this.clientBuildingsMap.buildings.get(parseInt(buildingID)),
              this.server.latestDatagram.bd[buildingID],
            );
          }
        }
      }
      if (this.server.latestDatagram.ed) {
        for (const entityID in this.server.latestDatagram.ed) {
          if (!this.clientEntitiesMap.entities.has(parseInt(entityID))) {
            // create the building with default fields if not present
            console.log(
              "got an update of an entity we don't have, fatal error!",
            );
          } else {
            console.log("updating entity");
            issueEntityDeltaUpdate(
              // @ts-ignore
              this.clientEntitiesMap.entities.get(parseInt(entityID)),
              this.server.latestDatagram.ed[entityID],
            );
          }
        }
      }
      // add ack tag to clientDatagram if datagram arrived
      console.log("adding the delta ack to the stream");
      if (!this.clientDatagram)
        this.clientDatagram = {
          t: this.tick,
        };
      this.clientDatagram.ack = this.server.latestDatagram.t;
      this.server.latestDatagram = null;
    }
  }

  loadFullBuildingsSnapshot() {
    if (
      this.server.latestBuildingSnapshot &&
      this.server.latestBuildingSnapshot.bs
    ) {
      console.log("Loading a full buildings server snapshot");
      for (const buildingId in this.server.latestBuildingSnapshot.bs) {
        const b = this.server.latestBuildingSnapshot.bs[buildingId];
        const clientB = this.clientBuildingsMap.buildings.get(
          parseInt(buildingId),
        );
        if (
          this.clientBuildingsMap.buildings.has(parseInt(buildingId)) &&
          clientB
        ) {
          // update the building
          console.log("Updating a building");
          /// @ts-ignore
          b.id = buildingId;
          // @ts-ignore
          issueBuildingsSnapshotUpdate(clientB, b);
        } else {
          console.log("Creating a building", buildingId);
          // create the building
          this.clientBuildingsMap.addBuilding(
            createClientBuilding(
              // @ts-ignore
              { ...b, id: parseInt(buildingId) },
              this.scene,
            ),
          );
        }
      }
      this.server.latestBuildingSnapshot = null;
    }
  }

  loadFullEntitiesSnapshot() {
    if (
      this.server.latestEntitySnapshot &&
      this.server.latestEntitySnapshot.es
    ) {
      console.log("Loading a full entities server snapshot");
      for (const entityId in this.server.latestEntitySnapshot.es) {
        const e = this.server.latestEntitySnapshot.es[entityId];
        const clientE = this.clientEntitiesMap.entities.get(parseInt(entityId));
        if (
          this.clientEntitiesMap.entities.has(parseInt(entityId)) &&
          clientE
        ) {
          // update the building
          console.log("Updating a building");
          /// @ts-ignore
          e.id = entityId;
          // @ts-ignore
          issueEntitiesSnapshotUpdate(clientE, e);
        } else {
          console.log("Creating a building", entityId);
          // create the building
          console.log({ ...e, id: parseInt(entityId) });
          this.clientEntitiesMap.addEntity(
            createClientEntity(
              // @ts-ignore
              { ...e, id: parseInt(entityId) },
              this.scene,
            ),
          );
        }
      }
      this.server.latestEntitySnapshot = null;
    }
  }
}
