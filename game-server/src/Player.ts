import {
  AnyServerBuilding,
  DirtyBuildingChunkType,
  MapBuildings,
} from "./buildings/buildings";
import { CHUNK_HEIGHT, CHUNK_WIDTH } from "./buildings/globals";
import Session from "./Session";
import buildingsDeltaBuilder from "./buildings/buildingDeltaBuilder";
import buildingsSnapshotBuilder from "./buildings/buildingsSnapshotBuilder";
import entitiesDeltaBuilder from "./entities/entitiesDeltaBuilder";
import entitiesSnapshotBuilder from "./entities/entitiesSnapshotBuilder";
import { AnyServerEntity, DirtyEntityChunkType } from "./entities/entities";
import * as z from "zod";

type ViewAreaType = { x: number; y: number; width: number; height: number };

const IncomingDatagramSchema = z.object({
  t: z.number(),
  ack: z.number(),
});
type Datagramtype = z.input<typeof IncomingDatagramSchema>;

const IncomingStreamSchema = z.object({
  t: z.number(),
  a: z
    .object({
      tM: z.array(z.number()).optional(),
    })
    .optional(),
});
type Streamtype = z.input<typeof IncomingStreamSchema>;

export default class Player {
  public chunks: [number, number][] = [];
  public session: Session | null = null;
  public buildingsDeltaBuilder: buildingsDeltaBuilder | null = null;
  public buildingsSnapshotBuilder: buildingsSnapshotBuilder | null = null;
  public entitiesDeltaBuilder: entitiesDeltaBuilder | null = null;
  public entitiesSnapshotBuilder: entitiesSnapshotBuilder | null = null;
  private clientTick = 0;

  private buildingToMine: Set<number> = new Set();

  private bs = -1;
  private es = -1;
  private bd = -1;
  private ed = -1;

  constructor(
    public ViewArea: ViewAreaType,
    public buildingsMap: MapBuildings,
  ) {
    this.updateChunkView();
  }

  expandViewArea(newViewArea: ViewAreaType) {
    this.ViewArea = newViewArea;

    this.updateChunkView();
  }

  updateChunkView() {
    for (
      let y = Math.floor(this.ViewArea.y / CHUNK_HEIGHT);
      y < Math.ceil((this.ViewArea.y + this.ViewArea.height) / CHUNK_HEIGHT);
      y += 1
    ) {
      for (
        let x = Math.floor(this.ViewArea.x / CHUNK_WIDTH);
        x < Math.ceil((this.ViewArea.x + this.ViewArea.width) / CHUNK_WIDTH);
        x += 1
      ) {
        this.chunks.push([y, x]);
      }
    }
  }

  linkSession(
    session: Session,
    allBuildingDirtyChunks: DirtyBuildingChunkType[][][],
    buildings: (AnyServerBuilding | null)[][],
    allEntityDirtyChunks: DirtyEntityChunkType[][][],
    entityChunks: Set<AnyServerEntity>[][],
  ) {
    if (this.session) {
      // error there should only be one session (kill the other ?)
    }
    this.session = session;
    this.buildingsDeltaBuilder = new buildingsDeltaBuilder(
      allBuildingDirtyChunks,
      this.chunks,
    );
    this.buildingsSnapshotBuilder = new buildingsSnapshotBuilder(
      this,
      buildings,
      this.chunks,
    );
    this.entitiesDeltaBuilder = new entitiesDeltaBuilder(
      allEntityDirtyChunks,
      this.chunks,
    );
    this.entitiesSnapshotBuilder = new entitiesSnapshotBuilder(
      this,
      entityChunks,
      this.chunks,
    );
  }

  createDelta(
    tick: number,
    allBuildingDirtyChunksAt: number,
    allBEntityDirtyChunksAt: number,
  ) {
    if (
      !this.buildingsDeltaBuilder ||
      !this.entitiesDeltaBuilder ||
      !this.buildingsSnapshotBuilder ||
      !this.entitiesSnapshotBuilder ||
      !this.session
    )
      return;

    if (this.buildingsDeltaBuilder.tick(tick, allBuildingDirtyChunksAt)) {
      this.createBuildingSnapshot(tick);
    } else this.bd = tick;
    if (this.entitiesDeltaBuilder.tick(tick, allBEntityDirtyChunksAt))
      this.createEntitySnapshot(tick);
    else this.ed = tick;
  }

  addBuildingsToMine(buildingIds: number[]) {
    for (const buildingID of buildingIds) {
      const building = this.buildingsMap.allBuildings.get(buildingID);
      if (building) {
        // check ownership
        // ....
        if (building.kind == "natural_wall") {
          // can mine
          if (!this.buildingToMine.has(buildingID))
            this.buildingToMine.add(buildingID);
        }
      }
    }
  }

  processStreams() {
    if (!this.session) return;
    if (this.session.incomingStreams.size == 0) return;
    for (const stream of this.session.incomingStreams) {
      const parsedStream = IncomingStreamSchema.parse(stream);
      console.log("New client stream");
      if (parsedStream.a && parsedStream.a.tM) {
        // buildings to mine
        this.addBuildingsToMine(parsedStream.a.tM);
      }
      this.session.incomingStreams.delete(stream);
    }
  }

  processDatagrams() {
    if (!this.session) return;
    if (this.session.incomingDatagrams.size == 0) return;
    const parsedDatagrams = [];
    for (const datagram of this.session.incomingDatagrams) {
      try {
        parsedDatagrams.push(IncomingDatagramSchema.parse(datagram));
      } catch {
        console.log("Found an invalid datagram payload schema, dropping it");
      }
      this.session.incomingDatagrams.delete(datagram);
    }

    if (parsedDatagrams.length == 0) return;
    let latestDatagramIndex = 0;
    parsedDatagrams.forEach((dg, i) =>
      dg.t > latestDatagramIndex ? (latestDatagramIndex = i) : null,
    );
    this.applyDatagram(parsedDatagrams[latestDatagramIndex]);
  }
  applyDatagram(datagram: Datagramtype) {
    if (!this.buildingsDeltaBuilder || !this.entitiesDeltaBuilder) return;
    if (datagram.t < this.clientTick)
      return console.log("dropped old datagram");
    this.buildingsDeltaBuilder.ack(datagram.ack);
    this.entitiesDeltaBuilder.ack(datagram.ack);
  }

  createBuildingSnapshot(tick: number) {
    if (
      !this.buildingsDeltaBuilder ||
      !this.entitiesDeltaBuilder ||
      !this.buildingsSnapshotBuilder ||
      !this.entitiesSnapshotBuilder ||
      !this.session
    )
      return;
    if (this.bs == tick) return;
    this.buildingsSnapshotBuilder.createSnapshot();
    this.bs = tick;
  }
  createEntitySnapshot(tick: number) {
    if (
      !this.buildingsDeltaBuilder ||
      !this.entitiesDeltaBuilder ||
      !this.buildingsSnapshotBuilder ||
      !this.entitiesSnapshotBuilder ||
      !this.session
    )
      return;
    if (this.es == tick) return;
    this.entitiesSnapshotBuilder.createSnapshot();
    this.es = tick;
  }
  createSnapshot(tick: number) {
    if (
      !this.buildingsDeltaBuilder ||
      !this.entitiesDeltaBuilder ||
      !this.buildingsSnapshotBuilder ||
      !this.entitiesSnapshotBuilder ||
      !this.session
    )
      return;
    this.createBuildingSnapshot(tick);
    this.createEntitySnapshot(tick);
  }

  sendDelta(tick: number) {
    if (
      !this.buildingsDeltaBuilder ||
      !this.entitiesDeltaBuilder ||
      !this.buildingsSnapshotBuilder ||
      !this.entitiesSnapshotBuilder ||
      !this.session
    )
      return;
    if (this.bd == tick && this.ed == tick) {
      this.session.sendDatagramJSON({
        t: tick,
        bd: this.buildingsDeltaBuilder.snapshot,
        ed: this.entitiesDeltaBuilder.snapshot,
      });
    } else if (this.bd == tick) {
      this.session.sendDatagramJSON({
        t: tick,
        bd: this.entitiesDeltaBuilder.snapshot,
      });
    } else if (this.ed == tick) {
      this.session.sendDatagramJSON({
        t: tick,
        bd: this.buildingsDeltaBuilder.snapshot,
      });
    }
  }

  sendSnapshot(tick: number) {
    if (
      !this.buildingsDeltaBuilder ||
      !this.entitiesDeltaBuilder ||
      !this.buildingsSnapshotBuilder ||
      !this.entitiesSnapshotBuilder ||
      !this.session
    )
      return;
    if (this.bs == tick && this.es == tick) {
      this.session.sendStreamJSON({
        t: tick,
        bs: this.buildingsSnapshotBuilder.snapshot,
        es: this.entitiesSnapshotBuilder.snapshot,
      });
    } else if (this.bs == tick) {
      this.session.sendStreamJSON({
        t: tick,
        bs: this.buildingsSnapshotBuilder.snapshot,
      });
    } else if (this.es == tick) {
      this.session.sendStreamJSON({
        t: tick,
        es: this.entitiesSnapshotBuilder.snapshot,
      });
    }
  }
}
