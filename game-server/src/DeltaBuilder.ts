import {
  AnyBuildingSnapshot,
  AnyServerBuilding,
  DirtyChunkType,
} from "./buildings/buildings";
import { DIRTY_CHUNKS_TICKS } from "./buildings/globals";

import Player from "./Player";

export default class deltaBuilder {
  private ackedTick = 0;
  private needRebuild = false;
  public snapshot: DirtyChunkType = {};

  constructor(
    public player: Player,
    public allDirtyChunks: DirtyChunkType[][][],
    public chunks: [number, number][],
  ) {}

  tick(tickNumber: number, allDirtyChunksAt: number) {
    console.log("start", this.allDirtyChunks[0]);
    if (this.needRebuild) {
      const startingTickSnapshot = (this.ackedTick + 1) % DIRTY_CHUNKS_TICKS;
      for (
        let i =
          startingTickSnapshot > allDirtyChunksAt
            ? startingTickSnapshot
            : DIRTY_CHUNKS_TICKS;
        i < DIRTY_CHUNKS_TICKS;
        i++
      ) {
        this.addNewSnapshot(this.allDirtyChunks[i]);
      }
      for (const dirtyChunks of this.allDirtyChunks.slice(
        startingTickSnapshot > allDirtyChunksAt ? 0 : startingTickSnapshot,
        allDirtyChunksAt,
      )) {
        this.addNewSnapshot(dirtyChunks);
      }
    } else {
      this.addNewSnapshot(this.allDirtyChunks[allDirtyChunksAt]);
    }
    console.log("end", this.snapshot);
  }

  private addNewSnapshot(dirtyChunks: DirtyChunkType[][]) {
    for (const [chunkY, chunkX] of this.chunks) {
      let dirtyChunk = dirtyChunks[chunkY][chunkX];
      for (const buildingID in dirtyChunk) {
        if (buildingID in this.snapshot) {
          // merge
          for (const dirtyField in dirtyChunk[buildingID]) {
            if (dirtyField == "customState") {
              if (this.snapshot[buildingID].customState) {
                for (const dirtyField in dirtyChunk[buildingID].customState) {
                  this.snapshot[buildingID].customState[dirtyField] =
                    dirtyChunk[buildingID].customState[dirtyField];
                }
              } else {
                this.snapshot[buildingID].customState = structuredClone(
                  dirtyChunk[buildingID].customState,
                );
              }
            } else {
              // @ts-ignore
              this.snapshot[buildingID][dirtyField] =
                // @ts-ignore
                dirtyChunk[buildingID][dirtyField];
            }
          }
        } else {
          this.snapshot[buildingID] = structuredClone(dirtyChunk[buildingID]);
        }
      }
    }
  }

  ack(ticknumber: number) {
    this.needRebuild = true;
    this.ackedTick = ticknumber;
  }
}
