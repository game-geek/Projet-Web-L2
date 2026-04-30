import {
  BuildingDefs,
  BuildingSystemMap,
  BuildingSystemMapOf,
  BuildingSystems,
  BuildingVariantsMap,
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

class ServerBuilding<K extends BuildingKind> implements BuildingSnapshot<K> {
  private updateFunction: BuildingSystemMapOf<K>;
  public pendingPatch: Partial<BuildingSnapshot<K>> = {};
  public dirty = false;

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
    private dirtyChunks: Set<ServerBuilding<K>>[],
  ) {
    this.updateFunction = BuildingSystems[kind];
  }

  markDirty<F extends keyof BuildingSnapshot<K>>(
    fieldName: F,
    value: BuildingSnapshot<K>[F],
  ) {
    this.pendingPatch[fieldName] = value;
    if (!this.dirty) {
      this.dirty = true;
      this.dirtyChunks.forEach((dirtyChunk) => dirtyChunk.add(this));
    }
  }

  flushPatch() {
    const patch = this.dirty ? this.pendingPatch : null;
    this.dirty = false;
    this.pendingPatch = {};
    return patch;
  }

  update(dt: number) {
    this.updateFunction(this, dt);
  }
}

export function createBuilding<K extends BuildingKind>(
  kind: K,
  variant: BuildingVariantMap[K],
  x: number,
  y: number,
  dirtyChunk: Set<ServerBuilding<K>>[],
) {
  const def = BuildingDefs[kind].shared;
  const customDef = BuildingDefs[kind].server;
  const customState = customDef.initState();
  return new ServerBuilding(
    0,
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
    dirtyChunk,
  );
}
export type AnyServerBuilding = ServerBuilding<BuildingKind>;
export type ServerBuildingOf<K extends BuildingKind> = ServerBuilding<K>;
export class MapBuildings {
  public readonly buildings: (AnyServerBuilding | null)[][] = [];
  public readonly dirtyChunks: Set<AnyServerBuilding>[][] = [];
  // Important: The chunk sizes must be at the very least the size of the biggest building... (otherwise need to recode stuff ...)
  public readonly chunkWidth = 64;
  public readonly chunkHeight = 64;

  constructor(
    public readonly mapWidth: number,
    public readonly mapHeight: number,
  ) {
    for (let y = 0; y < mapHeight; y++) {
      this.buildings.push([]);
      this.dirtyChunks.push([]);

      for (let x = 0; x < mapWidth; x++) {
        this.buildings[y].push(null);

        if (x % this.chunkWidth === 0)
          this.dirtyChunks[Math.floor(y / this.chunkHeight)].push(new Set());
      }
    }
  }

  createAndAddBuilding<K extends BuildingKind>(
    kind: K,
    variant: BuildingVariantMap[K],
    x: number,
    y: number,
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
        const dirtyChunks: Set<AnyServerBuilding>[] = [];

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
            dirtyChunks.push(
              this.dirtyChunks[Math.floor(y / this.chunkWidth)][
                Math.floor(x / this.chunkWidth)
              ],
            );
          } else {
            // two diferent y axis chunks ...
            dirtyChunks.push(
              this.dirtyChunks[Math.floor(y / this.chunkWidth)][
                Math.floor(x / this.chunkWidth)
              ],
            );
            dirtyChunks.push(
              this.dirtyChunks[
                Math.floor((y + buildingHeight) / this.chunkWidth)
              ][Math.floor(x / this.chunkWidth)],
            );
          }
        } else {
          // two different x axis chunks
          if (
            Math.floor(y / this.chunkWidth) ==
            Math.floor((y + buildingHeight) / this.chunkHeight)
          ) {
            // y axis is on the same chunk!
            dirtyChunks.push(
              this.dirtyChunks[Math.floor(y / this.chunkWidth)][
                Math.floor(x / this.chunkWidth)
              ],
            );
            dirtyChunks.push(
              this.dirtyChunks[Math.floor(y / this.chunkWidth)][
                Math.floor((x + buildingWidth) / this.chunkWidth)
              ],
            );
          } else {
            // two diferent y axis chunks and x axis chunks ...
            dirtyChunks.push(
              this.dirtyChunks[Math.floor(y / this.chunkWidth)][
                Math.floor(x / this.chunkWidth)
              ],
            );
            dirtyChunks.push(
              this.dirtyChunks[
                Math.floor((y + buildingHeight) / this.chunkWidth)
              ][Math.floor(x / this.chunkWidth)],
            );
            dirtyChunks.push(
              this.dirtyChunks[Math.floor(y / this.chunkWidth)][
                Math.floor(x / this.chunkWidth)
              ],
            );
            dirtyChunks.push(
              this.dirtyChunks[
                Math.floor((y + buildingHeight) / this.chunkWidth)
              ][Math.floor(x / this.chunkWidth)],
            );
          }
        }

        this.buildings[map_y][map_x] = createBuilding(
          kind,
          variant,
          x,
          y,
          dirtyChunks,
        );
      }
    }
  }

  updateBuildings(dt: number) {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.buildings[y][x]?.update(dt);
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
