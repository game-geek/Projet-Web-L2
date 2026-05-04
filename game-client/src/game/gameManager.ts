import { Geom } from "phaser";
import { BuildingSnapshotFields } from "../../../game-server/src/buildings/buildings";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game-server/src/buildings/globals";
import serverCommunication from "../serverCommunication";
import {
  createClientBuilding,
  issueDeltaUpdate,
  issueSnapshotUpdate,
  MapBuildings,
} from "./buildings/buildings";

export default class gameManager {
  public clientBuildingsMap = new MapBuildings(MAP_WIDTH, MAP_HEIGHT);
  public clientDatagram: {
    t: number;
    ack?: number;
  } | null = null;
  public clientStream = null;
  public tick = 0;
  public scene: Phaser.Scene | null = null;

  constructor(public server: serverCommunication) {}
  init(scene: Phaser.Scene) {
    this.scene = scene;
    console.log("gamemanager init");
  }

  dispatchAction(action: null | "mine") {
    if (!this.scene) return;
    // @ts-ignore
    this.scene.setOverlayAction(action);
  }

  mineSelection(selection: Geom.Rectangle) {
    // find minable buildings and add to snapshot
    const buildingsToMine = [];
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
        if (b && b.kind == "natural_wall") buildingsToMine.push(b.id);
      }
    }
    console.log("buildingsToMine", buildingsToMine);
  }
  update() {
    this.tick++;
    // console.log("gameManager tick", this.tick);

    // parse the latest datagrams and snapshots
    this.server.parseDatagrams();
    this.server.parseStreams();

    // send inputs
    // this.processInputs();
    this.server.sendDatagram(this.clientDatagram);
    this.server.sendStream(this.clientStream);
    this.clientDatagram = null;
    this.clientStream = null;

    // apply stream/datagram changes
    this.loadFullBuildingsSnapshot();
    this.processDatagramDelta();
    // this.clientBuildingsMap._displayDebugMap();
    // simulate

    // run interpolation on all components
  }

  processDatagramDelta() {
    if (this.server.latestDatagram) {
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
      if (!this.clientDatagram)
        this.clientDatagram = {
          t: this.tick,
        };
      this.clientDatagram.ack = this.server.latestDatagram.t;
      this.server.latestDatagram = null;
    }
  }

  loadFullBuildingsSnapshot() {
    if (this.server.latestBuildingSnapshot) {
      for (const buildingId in this.server.latestBuildingSnapshot.bd) {
        const b = this.server.latestBuildingSnapshot.bd[buildingId];
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
}
