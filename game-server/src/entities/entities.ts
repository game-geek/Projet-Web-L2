import {
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  DIRTY_CHUNKS_TICKS,
} from "../buildings/globals";
import { EntityDefs, EntitySystemMapOf, EntitySystems } from "./globals";

export type EntityKind = keyof typeof EntityDefs;

type EnitiyTextures<K extends EntityKind> = {
  [V in keyof (typeof EntityDefs)[K]["client"]["textures"]]: string;
};

export type EntityDef<K extends EntityKind> = {
  shared: {
    maxHp: number;
    killable: boolean;
    w: number;
    h: number;
  };
  server: {
    initState: () => Record<string, unknown>;
  };
  client: {
    textures: EnitiyTextures<K>;
    components: readonly string[];
  };
};

export type BuildingSnapshot<K extends EntityKind> = {
  id: number;
  kind: K;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  customState: Record<string, unknown>;
};

export class ServerEntity<K extends EntityKind> implements BuildingSnapshot<K> {
  private updateFunction: EntitySystemMapOf<K>;
  public pendingPatch: Partial<BuildingSnapshot<K>> = {};
  public allDirtyChunksAt: number = 0;

  constructor(
    public id: number,
    public kind: K,
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public hp: number,
    public maxHp: number,
    public destroyed = false,
    public customState: Record<string, unknown>,
    public chunkPositioning: [number, number][] = [],
    public allDirtyChunks: DirtyChunkType[][][],
  ) {
    this.updateFunction = EntitySystems[kind];
  }

  markDirty<F extends keyof BuildingSnapshot<K>>(
    fieldName: F,
    value: BuildingSnapshot<K>[F],
  ) {
    this.chunkPositioning.forEach(([y, x]) => {
      if (!(this.id in this.allDirtyChunks[this.allDirtyChunksAt][y][x]))
        this.allDirtyChunks[this.allDirtyChunksAt][y][x][this.id] = {};

      this.allDirtyChunks[this.allDirtyChunksAt][y][x][this.id][fieldName] =
        value;
    });
  }

  update(tick: number, allDirtyChunksAt: number) {
    this.allDirtyChunksAt = allDirtyChunksAt;
    this.updateFunction(this, tick);
  }
}

export function createBuilding<K extends EntityKind>(
  kind: K,
  x: number,
  y: number,
  id: number,
  chunkPositioning: [number, number][] = [],
  allDirtyChunks: DirtyChunkType[][][],
) {
  const def = EntityDefs[kind].shared;
  const customDef = EntityDefs[kind].server;
  const customState = customDef.initState();
  console.log("ID", id);
  return new ServerEntity(
    id,
    kind,
    x,
    y,
    def.w,
    def.h,
    def.maxHp,
    def.maxHp,
    false,
    customState,
    chunkPositioning,
    allDirtyChunks,
  );
}
export type AnyServerEntity = ServerEntity<EntityKind>;
export type AnyEntitySnapshot = BuildingSnapshot<EntityKind>;
export type DirtyChunkType = { [id: number]: Partial<AnyEntitySnapshot> };
export class MapEntities {
  public readonly entities: (AnyServerEntity | null)[][] = [];
  public readonly allDirtyChunks: DirtyChunkType[][][] = [];
  public allDirtyChunksAt = 0;
  public readonly chunkPositioningPerEntity: {
    [id: number]: [number, number][];
  } = {};
  // Important: The chunk sizes must be at the very least the size of the biggest building... (otherwise need to recode stuff ...)
  public readonly chunkWidth = CHUNK_WIDTH;
  public readonly chunkHeight = CHUNK_HEIGHT;

  constructor(
    public readonly mapWidth: number,
    public readonly mapHeight: number,
  ) {
    // buildings
    for (let y = 0; y < mapHeight; y++) {
      this.entities.push([]);

      for (let x = 0; x < mapWidth; x++) {
        this.entities[y].push(null);
      }
    }
    // chunks
    for (let tickSave = 0; tickSave < DIRTY_CHUNKS_TICKS; tickSave++) {
      this.allDirtyChunks.push([]);
      for (let y = 0; y < mapHeight; y += this.chunkHeight) {
        this.allDirtyChunks[tickSave].push([]);

        for (let x = 0; x < mapWidth; x += this.chunkWidth) {
          this.allDirtyChunks[tickSave][Math.floor(y / this.chunkHeight)].push(
            {},
          );
        }
      }
    }
  }

  createAndAddBuilding<K extends EntityKind>(
    kind: K,
    x: number,
    y: number,
    id: number,
  ) {
    // verify if its position is correct w/ the map and if its a valid position
    const buildingWidth = EntityDefs[kind].shared.w;
    const buildingHeight = EntityDefs[kind].shared.h;
    if (
      !(
        x >= 0 &&
        x + buildingWidth < this.mapWidth &&
        y >= 0 &&
        y + buildingHeight < this.mapHeight
      )
    )
      return "Placement out of map";
    for (let map_y = y; map_y < y + buildingHeight; map_y++) {
      for (let map_x = x; map_x < x + buildingWidth; map_x++) {
        if (this.entities[map_y][map_x]) return "Invalid building location";
      }
    }
    for (let map_y = y; map_y < y + buildingHeight; map_y++) {
      for (let map_x = x; map_x < x + buildingWidth; map_x++) {
        this.chunkPositioningPerEntity[id] = [];

        if (
          Math.floor(x / this.chunkWidth) ==
          Math.floor((x + buildingWidth) / this.chunkWidth)
        ) {
          // x axis is on the same chunk!
          if (
            Math.floor(y / this.chunkWidth) ==
            Math.floor((y + buildingHeight) / this.chunkHeight)
          ) {
            // y axis is on the same chunk!
            this.chunkPositioningPerEntity[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
          } else {
            // two diferent y axis chunks ...
            this.chunkPositioningPerEntity[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerEntity[id].push([
              Math.floor((y + buildingHeight) / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
          }
        } else {
          // two different x axis chunks
          if (
            Math.floor(y / this.chunkWidth) ==
            Math.floor((y + buildingHeight) / this.chunkHeight)
          ) {
            // y axis is on the same chunk!
            this.chunkPositioningPerEntity[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerEntity[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor((x + buildingWidth) / this.chunkWidth),
            ]);
          } else {
            // two diferent y axis chunks and x axis chunks ...
            this.chunkPositioningPerEntity[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerEntity[id].push([
              Math.floor((y + buildingHeight) / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerEntity[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerEntity[id].push([
              Math.floor((y + buildingHeight) / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
          }
        }

        this.entities[map_y][map_x] = createBuilding(
          kind,
          x,
          y,
          id,
          this.chunkPositioningPerEntity[id],
          this.allDirtyChunks,
        );
      }
    }
  }

  updateBuildings(dt: number) {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.entities[y][x]?.update(dt, this.allDirtyChunksAt);
      }
    }
  }
  _displayDebugMap() {
    console.log("[DEBUG] Class ", this.constructor.name, "buildings");
    for (let y = 0; y < this.mapHeight; y++) {
      let line = "";
      for (let x = 0; x < this.mapWidth; x++) {
        let b = this.entities[y][x];
        line +=
          b != null ? b?.kind.padEnd(20, "_").slice(0, 20) : "".padEnd(20, "_");
        line += "  ";
      }
      console.log(line);
    }
  }
}
// export function tickBuilding<K extends BuildingKind>(
//   building: ServerBuildingOf<K>,
//   dt: number,
// ) {
//   building.update(dt);
// }
