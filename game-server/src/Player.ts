import {
  AnyServerBuilding,
  BuildingSnapshotFields,
  DirtyBuildingChunkType,
  MapBuildings,
} from "./buildings/buildings";
import {
  BuildingKinds,
  BuildingVariants,
  BuildingVariantsMap,
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
import { EntityKinds } from "./entities/globals";

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
      spE: z
        .array(
          z.object({
            n: z.literal(EntityKinds),
            x: z.number(),
            y: z.number(),
          }),
        )
        .optional(),
      spB: z
        .array(
          z.object({
            n: z.literal(BuildingKinds),
            v: z.literal(BuildingVariants),
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
  public entities: Set<number> = new Set();
  public buildings: Set<number> = new Set();

  private bs = -1;
  private es = -1;
  private bd = -1;
  private ed = -1;
  public firstConnection = false;

  constructor(
    public ViewArea: ViewAreaType,
    public buildingsMap: MapBuildings,
    public entitiesMap: MapEntities,
  ) {
    this.updateChunkView();
  }

  async setSession(session: Session) {
    if (this.session && !this.session.closed) {
      // close active session ...
      await this.session.disconnection();
    }
    if (this.session) {
      this.session = session;
    } else
      this.linkSession(
        session,
        this.buildingsMap.allDirtyChunks,
        this.buildingsMap.buildings,
        this.entitiesMap.allDirtyChunks,
        this.entitiesMap.entityChunks,
      );

    this.firstConnection = true;
  }

  expandViewArea(newViewArea: ViewAreaType) {
    this.ViewArea = newViewArea;

    this.updateChunkView();
  }

  updateClientBuildings(tick: number) {
    // if (!this.buildingsDeltaBuilder) return;

    for (const buildingID of [...this.buildings]) {
      const b = this.buildingsMap.allBuildings.get(buildingID);
      if (!b) continue;
      if (b.kind == "turret") {
        let found = false;
        if (b.customState.isShooting == 0) {
          // search for entities in its chunks as its range is smaller than the chunksize
          this.buildingsMap.chunkPositioningPerBuilding[b.id].forEach(
            ([y, x]) => {
              for (const randomEntity of this.entitiesMap.entityChunks[y][x]) {
                // @ts-ignore
                if (b.customState.isShooting > 0) break;
                if (this.entities.has(randomEntity.id)) continue;
                else {
                  // check if in range
                  if (
                    (randomEntity.kind == "miner" ||
                      randomEntity.kind == "eliptae") &&
                    // @ts-ignore
                    randomEntity.x < b.x * 32 + b.w * 32 + b.customState.area &&
                    randomEntity.x + randomEntity.w >
                      // @ts-ignore
                      b.x * 32 - b.w * 32 - b.customState.area &&
                    randomEntity.y + randomEntity.h >
                      // @ts-ignore
                      b.y * 32 - b.h * 32 - b.customState.area &&
                    // @ts-ignore
                    randomEntity.y < b.y * 32 + b.h * 32 + b.customState.area
                  ) {
                    // in range
                    // fire bullet
                    const trajectory = getBulletTrajectory(
                      {
                        x: b.x * 32,
                        y: b.y * 32,
                        w: b.w * 32,
                        h: b.h * 32,
                      },
                      {
                        x: randomEntity.x,
                        y: randomEntity.y,
                        w: randomEntity.w,
                        h: randomEntity.h,
                      },
                      {
                        w: 10,
                        h: 10,
                      },
                    );
                    this.entitiesMap.createAndAddEntity(
                      "bullet",
                      trajectory.spawn.x,
                      trajectory.spawn.y,
                      GLOBAL_INDEX,
                    );
                    this.entities.add(GLOBAL_INDEX);
                    const bullet = this.entitiesMap.entities.get(GLOBAL_INDEX);
                    if (bullet) {
                      bullet.customState.target = {
                        x: trajectory.target.x,
                        y: trajectory.target.y,
                      };
                      bullet.markDirty("customState", bullet.customState);
                    }
                    incrementGlobalIndex();

                    b.customState.isShooting = 5;
                    b.markDirty("customState", b.customState);
                    found = true;
                    break;
                  }
                }
              }
              if (found) return;
              // check for turrets
              for (
                let _y = y * CHUNK_HEIGHT;
                _y <
                Math.min((y + 1) * CHUNK_HEIGHT, this.buildingsMap.mapHeight);
                _y++
              ) {
                if (found) break;
                for (
                  let _x = x * CHUNK_WIDTH;
                  _x <
                  Math.min((x + 1) * CHUNK_WIDTH, this.buildingsMap.mapWidth);
                  _x++
                ) {
                  if (found) break;
                  const randomBuilding = this.buildingsMap.buildings[_y][_x];
                  if (!randomBuilding) continue;
                  if (this.buildings.has(randomBuilding.id)) continue;
                  else if (randomBuilding.kind == "turret") {
                    // check if in range
                    if (
                      randomBuilding.x * 32 <
                        // @ts-ignore
                        b.x * 32 + b.w * 32 + b.customState.area &&
                      randomBuilding.x * 32 + randomBuilding.w * 32 >
                        // @ts-ignore
                        b.x * 32 - b.w * 32 - b.customState.area &&
                      randomBuilding.y * 32 + randomBuilding.h * 32 >
                        // @ts-ignore
                        b.y * 32 - b.h * 32 - b.customState.area &&
                      randomBuilding.y * 32 <
                        // @ts-ignore
                        b.y * 32 + b.h * 32 + +b.customState.area
                    ) {
                      // in range
                      // fire bullet
                      const trajectory = getBulletTrajectory(
                        {
                          x: b.x * 32,
                          y: b.y * 32,
                          w: b.w * 32,
                          h: b.h * 32,
                        },
                        {
                          x: randomBuilding.x * 32,
                          y: randomBuilding.y * 32,
                          w: randomBuilding.w * 32,
                          h: randomBuilding.h * 32,
                        },
                        {
                          w: 10,
                          h: 10,
                        },
                      );
                      this.entitiesMap.createAndAddEntity(
                        "bullet",
                        trajectory.spawn.x,
                        trajectory.spawn.y,
                        GLOBAL_INDEX,
                      );
                      this.entities.add(GLOBAL_INDEX);
                      const bullet =
                        this.entitiesMap.entities.get(GLOBAL_INDEX);
                      if (bullet) {
                        bullet.customState.target = {
                          x: trajectory.target.x,
                          y: trajectory.target.y,
                        };
                        bullet.markDirty("customState", bullet.customState);
                      }
                      incrementGlobalIndex();

                      b.customState.isShooting = 10;
                      b.markDirty("customState", b.customState);
                      found = true;
                      break;
                    }
                  }
                }
              }
            },
          );
        }
      }
    }
  }

  updateClientEntities(tick: number) {
    // if (!this.buildingsDeltaBuilder) return;

    for (const entityID of [...this.entities]) {
      const e = this.entitiesMap.entities.get(entityID);
      if (!e) continue;
      if (e.kind == "miner") {
        if (true) {
          //Object.keys(this.buildingsDeltaBuilder?.snapshot).length > 0
          if (e.customState.mining != true) {
            if (e.customState.target && e.customState.path) {
              // @ts-ignore
              const x = e.customState.target.x;
              // @ts-ignore
              const y = e.customState.target.y;
              if (this.buildingsMap.buildings[y][x]) {
                if (
                  this.buildingToMine.has(this.buildingsMap.buildings[y][x].id)
                ) {
                  continue;
                }
              }
            }

            const target = this.findTargetAndPath(
              Math.floor(e.x / 32),
              Math.floor(e.y / 32),
            );
            if (target) {
              e.customState.target = target.target;
              e.customState.path = target.path;
            } else {
              e.customState.target = null;
              e.customState.path = null;
            }
          }
        }
        if (e.customState.mining && e.customState.target) {
          //@ts-ignore
          const y = e.customState.target.y;
          //@ts-ignore
          const x = e.customState.target.x;
          const b = this.buildingsMap.buildings[y][x];
          if (b) {
            // @ts-ignore
            b.hp -= e.customState.miningSpeed;
            b.markDirty("hp", b.hp);

            if (b.hp <= 0) {
              // remove building
              this.buildingsMap.removeBuildind(b.id);

              // add the mined resource
              this.currency += 50;

              if (!this.serverStream) this.serverStream = { t: tick };
              if (!this.serverStream.a) this.serverStream.a = {};
              this.serverStream.a.c = this.currency;

              // update miner
              e.customState.mining = false;
              e.customState.target = null;
              e.customState.path = null;
              this.updateClientMinerEntities();
            }
            console.log("b.hp", b.hp);
          } else {
            // building does not exist anymore
            e.customState.mining = false;
            e.customState.target = null;
            e.customState.path = null;
            this.updateClientMinerEntities();
          }
          e.markDirty("customState", e.customState);
        }
      } else if (e.kind == "eliptae") {
        if (true) {
          //Object.keys(this.buildingsDeltaBuilder?.snapshot).length > 0
          if (
            e.customState.target &&
            // @ts-ignore
            (e.customState.target.x != e.x || e.customState.target.y)
          ) {
            // recalculate path

            // @ts-ignore
            const x = e.customState.target.x;
            // @ts-ignore
            const y = e.customState.target.y;

            const path = findPath(
              MAP_WIDTH,
              MAP_HEIGHT,
              this.buildingsMap.buildings,
              { x: e.x, y: e.y },
              { x, y },
            );
            if (path) {
              e.customState.path = path;
              e.markDirty("customState", e.customState);
            }
          }
        }
        let found = false;
        //@ts-ignore
        if (!e.customState.isShooting > 0) {
          // search for entities in its chunks as its range is smaller than the chunksize
          this.entitiesMap.chunkPositioningPerEntity[e.id].forEach(([y, x]) => {
            if (found) return;
            for (const randomEntity of this.entitiesMap.entityChunks[y][x]) {
              if (this.entities.has(randomEntity.id)) continue;
              //@ts-ignore
              if (e.customState.isShooting > 0) break;
              else {
                // check if in range
                if (
                  (randomEntity.kind == "miner" ||
                    randomEntity.kind == "eliptae") &&
                  // @ts-ignore
                  randomEntity.x < e.x + e.w + e.customState.area &&
                  randomEntity.x + randomEntity.w >
                    // @ts-ignore
                    e.x - e.w - e.customState.area &&
                  randomEntity.y + randomEntity.h >
                    // @ts-ignore
                    e.y - e.h - e.customState.area &&
                  // @ts-ignore
                  randomEntity.y < e.y + e.h + +e.customState.area
                ) {
                  // in range
                  // fire bullet
                  const trajectory = getBulletTrajectory(
                    {
                      x: e.x,
                      y: e.y,
                      w: e.w,
                      h: e.h,
                    },
                    {
                      x: randomEntity.x,
                      y: randomEntity.y,
                      w: randomEntity.w,
                      h: randomEntity.h,
                    },
                    {
                      w: 10,
                      h: 10,
                    },
                  );
                  this.entitiesMap.createAndAddEntity(
                    "bullet",
                    trajectory.spawn.x,
                    trajectory.spawn.y,
                    GLOBAL_INDEX,
                  );
                  this.entities.add(GLOBAL_INDEX);
                  const bullet = this.entitiesMap.entities.get(GLOBAL_INDEX);
                  if (bullet) {
                    bullet.customState.target = {
                      x: trajectory.target.x,
                      y: trajectory.target.y,
                    };
                    bullet.markDirty("customState", bullet.customState);
                  }
                  incrementGlobalIndex();

                  e.customState.isShooting = 10;
                  e.markDirty("customState", e.customState);
                  found = true;
                  break;
                }
              }
            }
            // check for turrets
            if (found) return;
            for (
              let _y = y * CHUNK_HEIGHT;
              _y <
              Math.min((y + 1) * CHUNK_HEIGHT, this.buildingsMap.mapHeight);
              _y++
            ) {
              if (found) break;
              for (
                let _x = x * CHUNK_WIDTH;
                _x <
                Math.min((x + 1) * CHUNK_WIDTH, this.buildingsMap.mapWidth);
                _x++
              ) {
                if (found) break;
                const randomBuilding = this.buildingsMap.buildings[_y][_x];
                if (!randomBuilding) continue;
                if (this.buildings.has(randomBuilding.id)) continue;
                else if (randomBuilding.kind == "turret") {
                  // check if in range
                  if (
                    // @ts-ignore
                    randomBuilding.x * 32 < e.x + e.w + e.customState.area &&
                    randomBuilding.x * 32 + randomBuilding.w * 32 >
                      // @ts-ignore
                      e.x - e.w - e.customState.area &&
                    randomBuilding.y * 32 + randomBuilding.h * 32 >
                      // @ts-ignore
                      e.y - e.h - e.customState.area &&
                    // @ts-ignore
                    randomBuilding.y * 32 < e.y + e.h + +e.customState.area
                  ) {
                    // in range
                    // fire bullet
                    const trajectory = getBulletTrajectory(
                      {
                        x: e.x,
                        y: e.y,
                        w: e.w,
                        h: e.h,
                      },
                      {
                        x: randomBuilding.x * 32,
                        y: randomBuilding.y * 32,
                        w: randomBuilding.w * 32,
                        h: randomBuilding.h * 32,
                      },
                      {
                        w: 10,
                        h: 10,
                      },
                    );
                    this.entitiesMap.createAndAddEntity(
                      "bullet",
                      trajectory.spawn.x,
                      trajectory.spawn.y,
                      GLOBAL_INDEX,
                    );
                    this.entities.add(GLOBAL_INDEX);
                    const bullet = this.entitiesMap.entities.get(GLOBAL_INDEX);
                    if (bullet) {
                      bullet.customState.target = {
                        x: trajectory.target.x,
                        y: trajectory.target.y,
                      };
                      bullet.markDirty("customState", bullet.customState);
                    }
                    incrementGlobalIndex();

                    e.customState.isShooting = 10;
                    e.markDirty("customState", e.customState);
                    found = true;
                    break;
                  }
                }
              }
            }
          });
        }
      } else if (e.kind == "bullet") {
        // check if it is out of the map
        if (
          e.x < 0 ||
          e.y < 0 ||
          e.x + e.w > this.entitiesMap.mapWidth * 32 ||
          e.y + e.h > this.entitiesMap.mapHeight * 32
        ) {
          this.entitiesMap.removeEntity(e.id);
          continue;
        }
        // check for collisions
        let found = false;
        if (!e.customState.target) {
          // search for entities in its chunks as its range is smaller than the chunksize
          this.entitiesMap.chunkPositioningPerEntity[e.id].forEach(([y, x]) => {
            if (found) return;
            for (const randomEntity of this.entitiesMap.entityChunks[y][x]) {
              if (this.entities.has(randomEntity.id)) continue;
              else {
                // check if in range
                if (
                  isColliding(
                    {
                      x: e.x,
                      y: e.y,
                      w: e.w,
                      h: e.h,
                    },
                    {
                      x: randomEntity.x,
                      y: randomEntity.y,
                      w: randomEntity.w,
                      h: randomEntity.h,
                    },
                  )
                ) {
                  console.log("collision");
                  // in enemy hitbox
                  // destroy bullet
                  this.entitiesMap.removeEntity(e.id);

                  // apply some damage to entity
                  console.log("HIT", randomEntity.hp);
                  // @ts-ignore
                  randomEntity.hp -= e.customState.damage;
                  randomEntity.markDirty("hp", randomEntity.hp);
                  if (randomEntity.hp <= 0) {
                    this.entitiesMap.removeEntity(randomEntity.id);
                  }
                  found = true;
                  break;
                }
              }
            }

            // for turrets
            if (found) return;

            for (
              let _y = y * CHUNK_HEIGHT;
              _y <
              Math.min((y + 1) * CHUNK_HEIGHT, this.buildingsMap.mapHeight);
              _y++
            ) {
              if (found) break;
              for (
                let _x = x * CHUNK_WIDTH;
                _x <
                Math.min((x + 1) * CHUNK_WIDTH, this.buildingsMap.mapWidth);
                _x++
              ) {
                if (found) break;
                const randomBuilding = this.buildingsMap.buildings[_y][_x];
                if (!randomBuilding) continue;
                if (this.buildings.has(randomBuilding.id)) continue;
                else if (randomBuilding.kind == "turret") {
                  // check if in range
                  if (
                    isColliding(
                      {
                        x: e.x,
                        y: e.y,
                        w: e.w,
                        h: e.h,
                      },
                      {
                        x: randomBuilding.x * 32,
                        y: randomBuilding.y * 32,
                        w: randomBuilding.w * 32,
                        h: randomBuilding.h * 32,
                      },
                    )
                  ) {
                    // in enemy hitbox
                    // destroy bullet
                    this.entitiesMap.removeEntity(e.id);

                    // apply some damage to entity
                    console.log("HIT turret", randomBuilding.hp);
                    // @ts-ignore
                    randomBuilding.hp -= e.customState.damage;
                    randomBuilding.markDirty("hp", randomBuilding.hp);
                    if (randomBuilding.hp <= 0) {
                      this.buildingsMap.removeBuildind(randomBuilding.id);
                    }
                    found = true;
                    break;
                  }
                }
              }
            }
          });
        }
      }
    }
  }
  findTargetAndPath(startX: number, startY: number) {
    const buildings = [...this.buildingToMine];
    while (buildings.length > 0) {
      const bId = buildings.splice(getRandomInt(0, buildings.length - 1), 1);
      const b = this.buildingsMap.allBuildings.get(bId[0]);
      if (!b) continue;
      const path = findPath(
        MAP_WIDTH,
        MAP_HEIGHT,
        this.buildingsMap.buildings,
        {
          x: startX,
          y: startY,
        },
        {
          x: b.x,
          y: b.y,
        },
      );
      if (path) {
        console.log("FOUND path!");
        path.pop();
        return {
          path,
          target: {
            x: b.x,
            y: b.y,
          },
        };
      }
    }
    console.log("did not find path");
    return null;
  }

  updateClientMinerEntities() {
    for (const entityID of this.entities) {
      const e = this.entitiesMap.entities.get(entityID);
      if (!e) continue;
      if (e.kind == "miner") {
        if (e.customState.target) {
          // @ts-ignore
          const x = e.customState.target.x;
          // @ts-ignore
          const y = e.customState.target.y;
          if (this.buildingsMap.buildings[y][x]) {
            if (this.buildingToMine.has(this.buildingsMap.buildings[y][x].id)) {
              continue;
            }
          }
        }
        const target = this.findTargetAndPath(
          Math.floor(e.x / 32),
          Math.floor(e.y / 32),
        );
        e.customState.mining = false;
        if (target) {
          e.customState.target = target.target;
          e.customState.path = target.path;
        } else {
          e.customState.target = null;
          e.customState.path = null;
        }
        e.markDirty("customState", e.customState);
      }
    }
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

  private linkSession(
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

    // update miner entities
    this.updateClientMinerEntities();
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
      if (parsedStream.a && parsedStream.a.spE) {
        for (const spawnAction of parsedStream.a.spE) {
          if (spawnAction.n == "miner" && this.currency >= 50) {
            console.log("ADDING MINER ENTITY");
            this.entitiesMap.createAndAddEntity(
              spawnAction.n,
              Math.floor(spawnAction.x),
              Math.floor(spawnAction.y),
              GLOBAL_INDEX,
            );
            this.entities.add(GLOBAL_INDEX);
            incrementGlobalIndex();
            this.currency -= 50;
            if (!this.serverStream) this.serverStream = { t: tick };
            if (!this.serverStream.a) this.serverStream.a = {};
            this.serverStream.a.c = this.currency;
          } else if (spawnAction.n == "eliptae" && this.currency >= 100) {
            console.log("ADDING ELIPTAE ENTITY");
            this.entitiesMap.createAndAddEntity(
              spawnAction.n,
              Math.floor(spawnAction.x),
              Math.floor(spawnAction.y),
              GLOBAL_INDEX,
            );
            this.entities.add(GLOBAL_INDEX);
            incrementGlobalIndex();
            this.currency -= 100;
            if (!this.serverStream) this.serverStream = { t: tick };
            if (!this.serverStream.a) this.serverStream.a = {};
            this.serverStream.a.c = this.currency;
          }
        }
        this.updateClientMinerEntities();
      }

      if (parsedStream.a && parsedStream.a.spB) {
        for (const spawnAction of parsedStream.a.spB) {
          if (spawnAction.n == "turret" && this.currency >= 200) {
            console.log("ADDING TURRET BUILDING");
            //@ts-ignore
            if (!BuildingVariantsMap[spawnAction.n].includes(spawnAction.v))
              continue;
            this.buildingsMap.createAndAddBuilding(
              spawnAction.n,
              //@ts-ignore
              spawnAction.v,
              Math.floor(spawnAction.x),
              Math.floor(spawnAction.y),
              GLOBAL_INDEX,
            );
            this.buildings.add(GLOBAL_INDEX);
            incrementGlobalIndex();
            this.currency -= 200;
            if (!this.serverStream) this.serverStream = { t: tick };
            if (!this.serverStream.a) this.serverStream.a = {};
            this.serverStream.a.c = this.currency;
          }
        }
        this.updateClientMinerEntities();
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
    let serverDelta: any = null;
    if (this.bd == tick && this.ed == tick) {
      serverDelta = {
        t: tick,
        bd: this.buildingsDeltaBuilder.snapshot,
        ed: this.entitiesDeltaBuilder.snapshot,
      };
    } else if (this.bd == tick) {
      serverDelta = {
        t: tick,
        bd: this.entitiesDeltaBuilder.snapshot,
      };
    } else if (this.ed == tick) {
      serverDelta = {
        t: tick,
        bd: this.buildingsDeltaBuilder.snapshot,
      };
    }

    if (serverDelta) this.session.sendDatagramJSON(serverDelta);
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
    }
    if (this.es == tick) {
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
      }
    }
    console.log(
      "New buildings size",
      this.buildingsMap.fullDirtyBuildings.size,
    );
    if (this.buildingsMap.fullDirtyBuildings.size > 0) {
      console.log("Pushing new buildings to client");
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
      }
    }
    //deleted buildings
    if (this.buildingsMap.removedBuildings.size > 0) {
      if (!this.serverStream) this.serverStream = { t: tick };
      if (!this.serverStream.a) this.serverStream.a = {};
      this.serverStream.a.rB = [...this.buildingsMap.removedBuildings];
    }
    //deleted entities
    if (this.entitiesMap.removedEntities.size > 0) {
      if (!this.serverStream) this.serverStream = { t: tick };
      if (!this.serverStream.a) this.serverStream.a = {};
      this.serverStream.a.rE = [...this.entitiesMap.removedEntities];
    }

    if (Object.keys(this.serverStream).length > 1)
      this.session.sendStreamJSON(this.serverStream);

    // flush
    this.serverStream = null;
  }

  update(tick: number) {
    console.log("updating player");
    if (this.firstConnection) {
      console.log("sending full snapshot");
      this.createBuildingSnapshot(tick);
      this.createEntitySnapshot(tick);
      this.createActionsSnapshot(tick);
      this.firstConnection = false;
    }
    this.updateClientEntities(tick);
    this.updateClientBuildings(tick);
  }
}

type Point = { x: number; y: number };

function findPath(
  width: number,
  height: number,
  grid: (AnyServerBuilding | null)[][],
  start: Point,
  end: Point,
): Point[] | null {
  console.log("start", start, "end", end);
  const getIndex = (x: number, y: number) => y * width + x;
  const openSet: { f: number; x: number; y: number }[] = [];
  const parents = new Map<number, number>();
  const gScores = new Map<number, number>();

  openSet.push({ f: 0, ...start });
  gScores.set(getIndex(start.x, start.y), 0);

  while (openSet.length > 0) {
    // Sort to get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.x === end.x && current.y === end.y) {
      const path: Point[] = [];
      let currIdx = getIndex(current.x, current.y);
      while (currIdx !== undefined) {
        path.push({ x: currIdx % width, y: Math.floor(currIdx / width) });
        currIdx = parents.get(currIdx)!;
      }
      return path.reverse();
    }

    // // Neighbors (8-way)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = current.x + dx,
          ny = current.y + dy;
        // console.log(
        //   `Checking (${nx}, ${ny}, ${end.x}, ${end.y}): Occupied? ${grid[ny][nx] && !(end.x == nx && end.y == ny)}`,
        // );
        if (
          nx < 0 ||
          nx >= width ||
          ny < 0 ||
          ny >= height ||
          (grid[ny][nx] && !(end.x == nx && end.y == ny))
        )
          continue;

        const newG =
          gScores.get(getIndex(current.x, current.y))! +
          (dx !== 0 && dy !== 0 ? 1.414 : 1);
        const neighborIdx = getIndex(nx, ny);

        if (newG < (gScores.get(neighborIdx) ?? Infinity)) {
          parents.set(neighborIdx, getIndex(current.x, current.y));
          gScores.set(neighborIdx, newG);
          const f = newG + Math.sqrt((nx - end.x) ** 2 + (ny - end.y) ** 2);
          openSet.push({ f, x: nx, y: ny });
        }
      }
    }
  }
  return null;
}
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getBulletTrajectory(
  emit: { x: number; w: number; y: number; h: number },
  target: { x: number; w: number; y: number; h: number },
  bulletSize: { w: number; h: number },
): { spawn: Point; target: Point } {
  // Calculate center of the emitter, adjusting for bullet size
  const spawnX = emit.x + emit.w / 2 - bulletSize.w / 2;
  const spawnY = emit.y + emit.h / 2 - bulletSize.h / 2;

  // Calculate center of the target, adjusting for bullet size
  const targetX = target.x + target.w / 2 - bulletSize.w / 2;
  const targetY = target.y + target.h / 2 - bulletSize.h / 2;

  return {
    spawn: { x: spawnX, y: spawnY },
    target: { x: targetX, y: targetY },
  };
}
type EntityBounds = { x: number; y: number; w: number; h: number };

function isColliding(bullet: EntityBounds, target: EntityBounds): boolean {
  return (
    bullet.x < target.x + target.w &&
    bullet.x + bullet.w > target.x &&
    bullet.y < target.y + target.h &&
    bullet.y + bullet.h > target.y
  );
}
