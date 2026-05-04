import { DIRTY_CHUNKS_TICKS } from "../buildings/globals";
import { DirtyEntityChunkType } from "./entities";

export default class entitiesDeltaBuilder {
  private ackedTick = 0;
  private needRebuild = false;
  public snapshot: DirtyEntityChunkType = {};

  constructor(
    public allDirtyChunks: DirtyEntityChunkType[][][], // reference
    public chunks: [number, number][], // reference
  ) {}

  tick(tickNumber: number, allDirtyChunksAt: number) {
    // check if we didn't go over the max ticks behind
    let totalDirtyTicks = 0;
    if (tickNumber - this.ackedTick > DIRTY_CHUNKS_TICKS) {
      console.log(
        "Entities delta: passed the ",
        DIRTY_CHUNKS_TICKS,
        "max ticks behind, sending a full entities snapshot",
      );
      // send snapshot and reset ackedTick
      this.ack(tickNumber);
      return true;
    }
    if (this.needRebuild) {
      this.snapshot = {};
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
        totalDirtyTicks++;
      }
      for (const dirtyChunks of this.allDirtyChunks.slice(
        startingTickSnapshot > allDirtyChunksAt ? 0 : startingTickSnapshot,
        allDirtyChunksAt,
      )) {
        this.addNewSnapshot(dirtyChunks);
        totalDirtyTicks++;
      }
      this.needRebuild = false;
    } else {
      this.addNewSnapshot(this.allDirtyChunks[allDirtyChunksAt]);
      totalDirtyTicks++;
    }
    if (totalDirtyTicks > 1) {
      console.log(
        "Entities delta: rebuild occurred, with",
        totalDirtyTicks,
        "ticks of dirtyChunks accessed",
      );
    }
    console.log(
      "Entities delta:",
      tickNumber - this.ackedTick - 1,
      "ticks behind",
    );
    return false;
  }

  private addNewSnapshot(dirtyChunks: DirtyEntityChunkType[][]) {
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
    if (ticknumber < this.ackedTick) return;
    this.needRebuild = true;
    this.ackedTick = ticknumber;
  }
}
