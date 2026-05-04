import Player from "../Player";
import {
  AnyServerEntity,
  DirtyEntityChunkType,
  EnitiySnapshotFields,
} from "./entities";

export default class entitiesSnapshotBuilder {
  public snapshot: DirtyEntityChunkType = {};
  constructor(
    public player: Player,
    public entityChunks: Set<AnyServerEntity>[][],
    public chunks: [number, number][],
  ) {}

  createSnapshot() {
    this.snapshot = {};
    for (const [chunkY, chunkX] of this.chunks) {
      for (const entity of this.entityChunks[chunkY][chunkX]) {
        this.snapshot[entity.id] = {};
        for (const field in EnitiySnapshotFields) {
          if (field == "customState") {
            // @ts-ignore
            this.snapshot[entity.id][field] = structuredClone(entity[field]);
          }
          // @ts-ignore
          else this.snapshot[entity.id][field] = entity[field];
        }
      }
    }
  }
}
