import {
  CHUNK_HEIGHT,
  CHUNK_WIDTH,
  DIRTY_CHUNKS_TICKS,
  MAP_HEIGHT,
  MAP_WIDTH,
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
  ownerID: number;
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
  "ownerID",
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
    public chunkPositioning: {
      [id: number]: [number, number][];
    } = [],
    public allDirtyChunks: DirtyEntityChunkType[][][],
    public ownerID: number,
  ) {
    this.updateFunction = EntitySystems[kind];
  }

  markDirty<F extends keyof EntitySnapshot<K>>(
    fieldName: F,
    value: EntitySnapshot<K>[F],
  ) {
    this.chunkPositioning[this.id].forEach(([y, x]) => {
      if (!(this.id in this.allDirtyChunks[this.allDirtyChunksAt][y][x]))
        this.allDirtyChunks[this.allDirtyChunksAt][y][x][this.id] = {};

      this.allDirtyChunks[this.allDirtyChunksAt][y][x][this.id][fieldName] =
        value;
    });
  }
  preUpdate(allDirtyChunksAt: number) {
    this.allDirtyChunksAt = allDirtyChunksAt;
  }

  update(tick: number) {
    this.updateFunction(this, tick);
  }
}

export function createEntity<K extends EntityKind>(
  kind: K,
  x: number,
  y: number,
  id: number,
  chunkPositioning: {
    [id: number]: [number, number][];
  } = [],
  allDirtyChunks: DirtyEntityChunkType[][][],
  ownerID: number,
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
    ownerID,
  );
}
export type AnyServerEntity = ServerEntity<EntityKind>;
export type AnyEntitySnapshot = EntitySnapshot<EntityKind>;
export type DirtyEntityChunkType = { [id: number]: Partial<AnyEntitySnapshot> };
export class MapEntities {
  public readonly entities: Map<number, AnyServerEntity> = new Map();
  public readonly entityChunks: Set<AnyServerEntity>[][] = [];
  public readonly allDirtyChunks: DirtyEntityChunkType[][][] = [];
  public readonly fullDirtyEntities: Set<AnyServerEntity> = new Set();
  public readonly removedEntities: Set<number> = new Set();
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
    ownerID: number,
  ) {
    // verify if its position is correct w/ the map and if its a valid position
    const entityWidth = EntityDefs[kind].shared.w;
    const entityHeight = EntityDefs[kind].shared.h;
    if (
      !(
        x > 0 &&
        y > 0 &&
        x + EntityDefs[kind].shared.w < this.mapWidth * 32 &&
        y + EntityDefs[kind].shared.h < this.mapHeight * 32
      )
    )
      return console.log("aborting: Placement of entity out of map");

    // selecting the right chunks
    this.chunkPositioningPerEntity[id] = [];
    const newEntity = createEntity(
      kind,
      x,
      y,
      id,
      this.chunkPositioningPerEntity,
      this.allDirtyChunks,
      ownerID,
    );
    this.entities.set(id, newEntity);
    this.updateEntityChunks(newEntity);
    this.fullDirtyEntities.add(newEntity);
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
      this.updateEntityChunks(this.entities.get(entityID));
    }
  }

  updateEntityChunks(entity: AnyServerEntity) {
    if (!entity) return;
    for (const [chunkY, chunkX] of this.chunkPositioningPerEntity[entity.id]) {
      this.entityChunks[chunkY][chunkX].delete(entity);
    }
    this.chunkPositioningPerEntity[entity.id] = [];
    for (
      let chunk_y = Math.floor(entity.y / (CHUNK_HEIGHT * 32));
      chunk_y < Math.ceil((entity.y + entity.h) / (CHUNK_HEIGHT * 32));
      chunk_y += 1
    ) {
      for (
        let chunk_x = Math.floor(entity.x / (CHUNK_WIDTH * 32));
        chunk_x < Math.ceil((entity.x + entity.w) / (CHUNK_WIDTH * 32));
        chunk_x += 1
      ) {
        this.chunkPositioningPerEntity[entity.id].push([chunk_y, chunk_x]);
      }
    }

    for (const [chunkY, chunkX] of this.chunkPositioningPerEntity[entity.id]) {
      this.entityChunks[chunkY][chunkX].add(entity);
    }
  }

  removeEntity(entityID: number) {
    if (this.entities.has(entityID)) {
      this.removedEntities.add(entityID);
      const e = this.entities.get(entityID);
      if (e) {
        for (const [chunkY, chunkX] of this.chunkPositioningPerEntity[
          entityID
        ]) {
          this.entityChunks[chunkY][chunkX].delete(e);
        }
      }
      this.entities.delete(entityID);
    }
  }

  preUpdate() {
    // could i delta builder not copy but pass by references as objs are not destroyed...
    this.allDirtyChunksAt = (this.allDirtyChunksAt + 1) % DIRTY_CHUNKS_TICKS;
    this.fullDirtyEntities.clear();
    this.removedEntities.clear();
    // clear dirty chunks
    for (
      let y = 0;
      y < this.allDirtyChunks[this.allDirtyChunksAt].length;
      y++
    ) {
      for (
        let x = 0;
        x < this.allDirtyChunks[this.allDirtyChunksAt][y].length;
        x++
      ) {
        this.allDirtyChunks[this.allDirtyChunksAt][y][x] = {};
      }
    }
    for (const e of this.entities.values()) {
      e.preUpdate(this.allDirtyChunksAt);
    }
  }

  updateEntities(dt: number) {
    // update entities
    for (const e of this.entities.values()) {
      e.update(dt);
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
