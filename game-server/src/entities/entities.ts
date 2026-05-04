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

export type EntitySnapshot<K extends EntityKind> = {
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

export const EnitiySnapshotFields = [
  "id",
  "kind",
  "x",
  "y",
  "w",
  "h",
  "hp",
  "maxHp",
  "destroyed",
  "customState",
] as const;

export class ServerEntity<K extends EntityKind> implements EntitySnapshot<K> {
  private updateFunction: EntitySystemMapOf<K>;
  public pendingPatch: Partial<EntitySnapshot<K>> = {};
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
    public allDirtyChunks: DirtyEntityChunkType[][][],
  ) {
    this.updateFunction = EntitySystems[kind];
  }

  markDirty<F extends keyof EntitySnapshot<K>>(
    fieldName: F,
    value: EntitySnapshot<K>[F],
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

export function createEntity<K extends EntityKind>(
  kind: K,
  x: number,
  y: number,
  id: number,
  chunkPositioning: [number, number][] = [],
  allDirtyChunks: DirtyEntityChunkType[][][],
) {
  const def = EntityDefs[kind].shared;
  const customDef = EntityDefs[kind].server;
  const customState = customDef.initState();
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
export type AnyEntitySnapshot = EntitySnapshot<EntityKind>;
export type DirtyEntityChunkType = { [id: number]: Partial<AnyEntitySnapshot> };
export class MapEntities {
  public readonly entities: {
    [id: number]: AnyServerEntity;
  } = {};
  public readonly entityChunks: Set<AnyServerEntity>[][] = [];
  public readonly allDirtyChunks: DirtyEntityChunkType[][][] = [];
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
    // entity chunks
    let chunk_y = 0;
    for (let y = 0; y < mapHeight; y += this.chunkHeight) {
      this.entityChunks.push([]);

      for (let x = 0; x < mapWidth; x += this.chunkWidth) {
        this.entityChunks[chunk_y].push(new Set());
      }
      chunk_y += 1;
    }
    // dirty chunks
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

  createAndAddEntity<K extends EntityKind>(
    kind: K,
    x: number,
    y: number,
    id: number,
  ) {
    // verify if its position is correct w/ the map and if its a valid position
    const entityWidth = EntityDefs[kind].shared.w;
    const entityHeight = EntityDefs[kind].shared.h;
    if (
      !(
        x >= 0 &&
        x + entityWidth < this.mapWidth &&
        y >= 0 &&
        y + entityHeight < this.mapHeight
      )
    )
      return "Placement out of map";

    // selecting the right chunks
    this.chunkPositioningPerEntity[id] = [];

    this.entities[id] = createEntity(
      kind,
      x,
      y,
      id,
      this.chunkPositioningPerEntity[id],
      this.allDirtyChunks,
    );
    this.updateEntityChunks(this.entities[id]);
  }

  updateEntityChunksBasedOnDirty() {
    const entitiesToUpdate: Set<string> = new Set();
    for (const dirtyChunkY of this.allDirtyChunks[this.allDirtyChunksAt]) {
      for (const dirtyChunkX of dirtyChunkY) {
        for (const dirtyEntityID in dirtyChunkX) {
          if (
            "x" in dirtyChunkX[dirtyEntityID] ||
            "y" in dirtyChunkX[dirtyEntityID] ||
            "w" in dirtyChunkX[dirtyEntityID] ||
            "h" in dirtyChunkX[dirtyEntityID]
          ) {
            entitiesToUpdate.add(dirtyEntityID);
          }
        }
      }
    }
    for (const entityID of entitiesToUpdate) {
      // @ts-ignore
      this.updateEntityChunks(this.entities[entityID]);
    }
  }

  updateEntityChunks(entity: AnyServerEntity) {
    for (const [chunkY, chunkX] of this.chunkPositioningPerEntity[entity.id]) {
      this.entityChunks[chunkY][chunkX].delete(entity);
    }
    this.chunkPositioningPerEntity[entity.id] = [];
    for (
      let chunk_y = Math.floor(entity.y / CHUNK_HEIGHT);
      chunk_y < Math.ceil((entity.y + entity.h) / CHUNK_HEIGHT);
      chunk_y += 1
    ) {
      for (
        let chunk_x = Math.floor(entity.x / CHUNK_WIDTH);
        chunk_x < Math.ceil((entity.x + entity.w) / CHUNK_WIDTH);
        chunk_x += 1
      ) {
        this.chunkPositioningPerEntity[entity.id].push([chunk_y, chunk_x]);
      }
    }

    for (const [chunkY, chunkX] of this.chunkPositioningPerEntity[entity.id]) {
      this.entityChunks[chunkY][chunkX].add(entity);
    }
  }

  updateEntities(dt: number) {
    this.allDirtyChunksAt = (this.allDirtyChunksAt + 1) % DIRTY_CHUNKS_TICKS;
    for (const entityID in this.entities) {
      this.entities[entityID].update(dt, this.allDirtyChunksAt);
    }
    this.updateEntityChunksBasedOnDirty();
  }
  _displayDebugMap() {
    console.log("[DEBUG] Class ", this.constructor.name, "buildings");
    for (const chunkY of this.entityChunks) {
      for (const chunkX of chunkY) {
        let line = `Chunk[${chunkY}][${chunkX}] = `;
        for (const entity of chunkX) {
          entity != null
            ? entity?.kind.padEnd(20, "_").slice(0, 20)
            : "".padEnd(20, "_");
          line += "  ";
        }
        console.log(line);
      }
    }
  }
}
