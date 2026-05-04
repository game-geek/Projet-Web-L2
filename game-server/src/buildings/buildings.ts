import {
  BuildingDefs,
  BuildingSystemMap,
  BuildingSystemMapOf,
  BuildingSystems,
  BuildingVariantsMap,
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  DIRTY_CHUNKS_TICKS,
} from "./globals";

export type BuildingVariantMap = {
  [K in keyof typeof BuildingVariantsMap]: (typeof BuildingVariantsMap)[K][number];
};

export type BuildingKind = keyof typeof BuildingVariantsMap;
type BuildingTextures<K extends BuildingKind> = {
  [V in (typeof BuildingVariantsMap)[K][number]]: string;
};

export type BuildingDef<K extends BuildingKind> = {
  shared: {
    maxHp: number;
    destructible: boolean;
    w: number;
    h: number;
  };
  server: {
    initState: () => Record<string, unknown>;
  };
  client: {
    textures: BuildingTextures<K>;
    components: readonly string[];
  };
};

export const BuildingSnapshotFields = [
  "id",
  "kind",
  "variant",
  "x",
  "y",
  "w",
  "h",
  "hp",
  "maxHp",
  "destroyed",
  "customState",
] as const;

export type BuildingSnapshot<K extends BuildingKind> = {
  id: number;
  kind: K;
  variant: BuildingVariantMap[K];
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  customState: Record<string, unknown>;
};

export class ServerBuilding<
  K extends BuildingKind,
> implements BuildingSnapshot<K> {
  private updateFunction: BuildingSystemMapOf<K>;
  public pendingPatch: Partial<BuildingSnapshot<K>> = {};
  public allDirtyChunksAt: number = 0;

  constructor(
    public id: number,
    public kind: K,
    public variant: BuildingVariantMap[K],
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public hp: number,
    public maxHp: number,
    public destroyed = false,
    public customState: Record<string, unknown>,
    public chunkPositioning: [number, number][] = [],
    public allDirtyChunks: DirtyBuildingChunkType[][][],
  ) {
    this.updateFunction = BuildingSystems[kind];
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

export function createBuilding<K extends BuildingKind>(
  kind: K,
  variant: BuildingVariantMap[K],
  x: number,
  y: number,
  id: number,
  chunkPositioning: [number, number][] = [],
  allDirtyChunks: DirtyBuildingChunkType[][][],
) {
  const def = BuildingDefs[kind].shared;
  const customDef = BuildingDefs[kind].server;
  const customState = customDef.initState();
  return new ServerBuilding(
    id,
    kind,
    variant,
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
export type AnyServerBuilding = ServerBuilding<BuildingKind>;
export type AnyBuildingSnapshot = BuildingSnapshot<BuildingKind>;
export type DirtyBuildingChunkType = {
  [id: number]: Partial<AnyBuildingSnapshot>;
};
export class MapBuildings {
  public readonly buildings: (AnyServerBuilding | null)[][] = [];
  public readonly allBuildings: Map<number, AnyServerBuilding> = new Map();
  public readonly allDirtyChunks: DirtyBuildingChunkType[][][] = [];
  public readonly fullDirtyBuildings: Set<AnyServerBuilding> = new Set();
  public allDirtyChunksAt = 0;
  public readonly chunkPositioningPerBuilding: {
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
      this.buildings.push([]);

      for (let x = 0; x < mapWidth; x++) {
        this.buildings[y].push(null);
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

  createAndAddBuilding<K extends BuildingKind>(
    kind: K,
    variant: BuildingVariantMap[K],
    x: number,
    y: number,
    id: number,
  ) {
    // verify if its position is correct w/ the map and if its a valid position
    const buildingWidth = BuildingDefs[kind].shared.w;
    const buildingHeight = BuildingDefs[kind].shared.h;
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
        if (this.buildings[map_y][map_x]) return "Invalid building location";
      }
    }
    for (let map_y = y; map_y < y + buildingHeight; map_y++) {
      for (let map_x = x; map_x < x + buildingWidth; map_x++) {
        this.chunkPositioningPerBuilding[id] = [];

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
            this.chunkPositioningPerBuilding[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
          } else {
            // two diferent y axis chunks ...
            this.chunkPositioningPerBuilding[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerBuilding[id].push([
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
            this.chunkPositioningPerBuilding[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerBuilding[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor((x + buildingWidth) / this.chunkWidth),
            ]);
          } else {
            // two diferent y axis chunks and x axis chunks ...
            this.chunkPositioningPerBuilding[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerBuilding[id].push([
              Math.floor((y + buildingHeight) / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerBuilding[id].push([
              Math.floor(y / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
            this.chunkPositioningPerBuilding[id].push([
              Math.floor((y + buildingHeight) / this.chunkWidth),
              Math.floor(x / this.chunkWidth),
            ]);
          }
        }

        this.buildings[map_y][map_x] = createBuilding(
          kind,
          variant,
          x,
          y,
          id,
          this.chunkPositioningPerBuilding[id],
          this.allDirtyChunks,
        );
        // @ts-ignore
        if (this.buildings[map_y][map_x])
          // @ts-ignore
          this.allBuildings.set(id, this.buildings[map_y][map_x]);
        // @ts-ignore
        this.fullDirtyBuildings.add(this.buildings[map_y][map_x]);
      }
    }
  }

  updateBuildings(dt: number) {
    this.allDirtyChunksAt = (this.allDirtyChunksAt + 1) % DIRTY_CHUNKS_TICKS;
    this.fullDirtyBuildings.clear();
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.buildings[y][x]?.update(dt, this.allDirtyChunksAt);
      }
    }
  }
  _displayDebugMap() {
    console.log("[DEBUG] Class ", this.constructor.name, "buildings");
    for (let y = 0; y < this.mapHeight; y++) {
      let line = "";
      for (let x = 0; x < this.mapWidth; x++) {
        let b = this.buildings[y][x];
        line +=
          b != null
            ? (b?.kind + " - " + b?.variant).padEnd(20, "_").slice(0, 20)
            : "".padEnd(20, "_");
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
