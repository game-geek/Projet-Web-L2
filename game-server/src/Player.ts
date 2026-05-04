import {
  AnyServerBuilding,
  BuildingSnapshotFields,
  DirtyBuildingChunkType,
  MapBuildings,
} from "./buildings/buildings";
import {
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "./buildings/globals";
import Session from "./Session";
import buildingsDeltaBuilder from "./buildings/buildingDeltaBuilder";
import buildingsSnapshotBuilder from "./buildings/buildingsSnapshotBuilder";
import entitiesDeltaBuilder from "./entities/entitiesDeltaBuilder";
import entitiesSnapshotBuilder from "./entities/entitiesSnapshotBuilder";
import {
  AnyServerEntity,
  DirtyEntityChunkType,
  EnitiySnapshotFields,
  MapEntities,
} from "./entities/entities";
import * as z from "zod";
import { ServerStreamtype } from "../../game-client/src/serverCommunication";
import { GLOBAL_INDEX, incrementGlobalIndex } from "./loadMap";
import { EntityDefs, EntityKinds } from "./entities/globals";

type ViewAreaType = { x: number; y: number; width: number; height: number };

const IncomingDatagramSchema = z.object({
  t: z.number(),
  ack: z.number(),
});
type ClientDatagramtype = z.input<typeof IncomingDatagramSchema>;

const IncomingStreamSchema = z.object({
  t: z.number(),
  a: z
    .object({
      bM: z.array(z.number()).optional(),
      sp: z
        .array(
          z.object({
            n: z.literal(EntityKinds),
            x: z.number(),
            y: z.number(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type ClientStreamtype = z.input<typeof IncomingStreamSchema>;

export default class Player {
  public chunks: [number, number][] = [];
  public session: Session | null = null;
  public buildingsDeltaBuilder: buildingsDeltaBuilder | null = null;
  public buildingsSnapshotBuilder: buildingsSnapshotBuilder | null = null;
  public entitiesDeltaBuilder: entitiesDeltaBuilder | null = null;
  public entitiesSnapshotBuilder: entitiesSnapshotBuilder | null = null;
  private clientTick = 0;

  private serverStream: ServerStreamtype | null = null;

  private buildingToMine: Set<number> = new Set();
  private currency = 500;
  private entities: number[] = [];

  private bs = -1;
  private es = -1;
  private bd = -1;
  private ed = -1;

  constructor(
    public ViewArea: ViewAreaType,
    public buildingsMap: MapBuildings,
    public entitiesMap: MapEntities,
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

  private addBuildingsToMine(
    buildingIds: number[],
    tick: number,
    clientTick: number,
  ) {
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
    if (!this.serverStream) this.serverStream = { t: tick };
    if (!this.serverStream.a) this.serverStream.a = {};
    const bM = [];
    for (const buildingId of this.buildingToMine.values()) {
      bM.push(buildingId);
    }
    if (!this.serverStream.a) this.serverStream.a = {};
    if (!this.serverStream.a.bM)
      this.serverStream.a.bM = [{ t: clientTick, bM: bM }];
    else this.serverStream.a.bM.push({ t: clientTick, bM: bM });
    console.log("Adding a the full buildings to mine list to the stream");
  }

  createActionsSnapshot(tick: number) {
    if (!this.serverStream) this.serverStream = { t: tick };
    if (!this.serverStream.a) this.serverStream.a = {};

    // buildingsToMine
    if (!this.serverStream.a.bM)
      this.serverStream.a.bM = [{ t: tick, bM: [...this.buildingToMine] }];

    // currency
    this.serverStream.a.c = this.currency;
  }

  processStreams(tick: number) {
    if (!this.session) return;
    if (this.session.incomingStreams.size == 0) return;
    for (const stream of this.session.incomingStreams) {
      const parsedStream = IncomingStreamSchema.parse(stream);
      console.log("processing new client stream");
      if (parsedStream.a && parsedStream.a.bM) {
        // buildings to mine
        this.addBuildingsToMine(parsedStream.a.bM, tick, parsedStream.t);
      }
      if (parsedStream.a && parsedStream.a.sp) {
        for (const spawnAction of parsedStream.a.sp) {
          this.entitiesMap.createAndAddEntity(
            spawnAction.n,
            Math.floor(spawnAction.x),
            Math.floor(spawnAction.y),
            GLOBAL_INDEX,
          );
          this.entities.push(GLOBAL_INDEX);
          incrementGlobalIndex();
        }
      }
      this.session.incomingStreams.delete(stream);
    }
  }

  processDatagrams() {
    if (!this.session) return;
    if (this.session.incomingDatagrams.size == 0) return;
    const parsedDatagrams = [];
    for (const datagram of this.session.incomingDatagrams) {
      console.log("processing new client datagram");
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
  private applyDatagram(datagram: ClientDatagramtype) {
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

    console.log("Creating buildings snapshot");
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
    console.log("Creating entities snapshot");
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
    console.log("Sending the delta");
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

    console.log("Sending the built stream");
    if (!this.serverStream) this.serverStream = { t: tick };
    if (this.bs == tick) {
      this.serverStream.bs = this.buildingsSnapshotBuilder.snapshot;
    } else if (this.es == tick) {
      this.serverStream.es = this.entitiesSnapshotBuilder.snapshot;
    }

    // add newly created entities + buildings, should be based on chunks and building visibility
    if (this.entitiesMap.fullDirtyEntities.size > 0) {
      if (!this.serverStream.a) this.serverStream.a = {};
      if (!this.serverStream.a.nE) this.serverStream.a.nE = {};
      for (const entity of this.entitiesMap.fullDirtyEntities) {
        // @ts-ignore
        this.serverStream.a.nE[entity.id] = {};
        for (const field of EnitiySnapshotFields) {
          if (field == "id") continue;
          if (field == "customState") {
            // @ts-ignore
            this.serverStream.a.nE[entity.id][field] = structuredClone(
              // @ts-ignore
              entity[field],
            );
          }
          // @ts-ignore
          else this.serverStream.a.nE[entity.id][field] = entity[field];
        }
        console.log(this.serverStream.a.nE[entity.id]);
      }
    }
    if (this.buildingsMap.fullDirtyBuildings.size > 0) {
      if (!this.serverStream.a) this.serverStream.a = {};
      if (!this.serverStream.a.nB) this.serverStream.a.nB = {};
      for (const building of this.buildingsMap.fullDirtyBuildings) {
        // @ts-ignore
        this.serverStream.a.nB[building.id] = {};
        for (const field of BuildingSnapshotFields) {
          if (field == "id") continue;
          if (field == "customState") {
            // @ts-ignore
            this.serverStream.a.nB[building.id][field] = structuredClone(
              // @ts-ignore
              building[field],
            );
          }
          // @ts-ignore
          else this.serverStream.a.nB[building.id][field] = building[field];
        }
        console.log(this.serverStream.a.nB[building.id]);
      }
    }

    console.log("stream", this.serverStream);
    if (Object.keys(this.serverStream).length > 1)
      this.session.sendStreamJSON(this.serverStream);

    // flush
    this.serverStream = null;
  }
}
