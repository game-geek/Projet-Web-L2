import { Geom } from "phaser";
import { BuildingSnapshotFields } from "../../../game-server/src/buildings/buildings";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game-server/src/buildings/globals";
import serverCommunication from "../serverCommunication";
import {
  componentRegistry,
  createClientBuilding,
  issueDeltaUpdate,
  issueSnapshotUpdate,
  MapBuildings,
} from "./buildings/buildings";
import { ClientStreamtype } from "../../../game-server/src/Player";
import { createClientEntity, MapEntities } from "./entities/entities";

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
  currency = 0;

  constructor(public server: serverCommunication) {}

  init(scene: Phaser.Scene) {
    this.scene = scene;
    console.log("gamemanager init");
  }

  dispatchAction(action: null | "mine" | "miner") {
    if (!this.scene) return;
    // @ts-ignore
    if (action == "mine") this.scene.setOverlayAction(action);
    // @ts-ignore
    else if (action == "miner") this.scene.setOverlayAction(action);
  }

  spawnMiner(x: number, y: number) {
    // spawn miner
    if (!this.clientStream) this.clientStream = { t: this.tick };
    if (!this.clientStream.a) this.clientStream.a = {};
    if (!this.clientStream.a.sp) this.clientStream.a.sp = [];
    this.clientStream.a.sp.push({ n: "miner", x, y });
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
  update() {
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
          componentRegistry["MiningOverlay"],
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
        componentRegistry["MiningOverlay"],
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
      if (action.c) {
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
            issueDeltaUpdate(
              // @ts-ignore
              this.clientBuildingsMap.buildings.get(parseInt(buildingID)),
              this.server.latestDatagram.bd[buildingID],
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
          issueSnapshotUpdate(clientB, b);
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
          issueSnapshotUpdate(clientE, e);
        } else {
          console.log("Creating a building", entityId);
          // create the building
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
