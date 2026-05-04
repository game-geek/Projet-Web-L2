import { BuildingSnapshotFields } from "../../../game-server/src/buildings/buildings";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../game-server/src/buildings/globals";
import serverCommunication from "../serverCommunication";
import { createClientBuilding, MapBuildings } from "./buildings/buildings";

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
  }
  update() {
    this.tick++;
    // console.log("gameManager tick", this.tick);

    // parse the latest datagrams and snapshots
    this.server.parseDatagrams();
    this.server.parseStreams();

    // send inputs
    this.processInputs();
    this.server.sendDatagram(this.clientDatagram);
    this.server.sendStream(this.clientStream);
    this.clientDatagram = null;
    this.clientStream = null;

    // apply stream/datagram changes
    this.loadFullBuildingsSnapshot();
    // this.clientBuildingsMap._displayDebugMap();
    // simulate

    // run interpolation on all components
  }

  processInputs() {
    // add ack tag to clientDatagram if datagram arrived
    if (this.server.latestDatagram) {
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

          for (const field in BuildingSnapshotFields) {
            if (field == "customState") {
              // @ts-ignore
              clientB[field] = structuredClone(b[field]);
            }
            // @ts-ignore
            clientB[field] = b[field];
          }
        } else {
          console.log("Creating a building");
          // create the building
          // @ts-ignore
          this.clientBuildingsMap.addBuilding(
            // @ts-ignore
            createClientBuilding(b, this.scene),
          );
        }
      }
      this.server.latestBuildingSnapshot = null;
    }
  }
}
