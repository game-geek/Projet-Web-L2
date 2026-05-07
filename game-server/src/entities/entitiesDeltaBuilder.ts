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
      let ticksBehind = this.ackedTick + 1 - tickNumber;
      let start = DIRTY_CHUNKS_TICKS;
      if (ticksBehind > allDirtyChunksAt - 1) {
        if (
          DIRTY_CHUNKS_TICKS - ticksBehind - (allDirtyChunksAt - 1) >
          allDirtyChunksAt
        ) {
          start = DIRTY_CHUNKS_TICKS - ticksBehind - (allDirtyChunksAt - 1);
        } else {
          start = allDirtyChunksAt + 1;
        }
        ticksBehind = allDirtyChunksAt;
      }
      for (let i = start; i < DIRTY_CHUNKS_TICKS; i++) {
        this.addNewSnapshot(this.allDirtyChunks[i]);
        totalDirtyTicks++;
      }
      console.log("start", start, "ticksbehind", ticksBehind);
      for (const dirtyChunks of this.allDirtyChunks.slice(
        allDirtyChunksAt - ticksBehind,
        allDirtyChunksAt + 1,
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
      "added",
      totalDirtyTicks,
    );
    return false;
  }

  private addNewSnapshot(dirtyChunks: DirtyEntityChunkType[][]) {
    for (const [chunkY, chunkX] of this.chunks) {
      let dirtyChunk = dirtyChunks[chunkY][chunkX];
      for (const entityID in dirtyChunk) {
        if (entityID in this.snapshot) {
          // merge
          for (const dirtyField in dirtyChunk[entityID]) {
            if (dirtyField == "customState") {
              if (this.snapshot[entityID].customState) {
                for (const dirtyField in dirtyChunk[entityID].customState) {
                  this.snapshot[entityID].customState[dirtyField] =
                    dirtyChunk[entityID].customState[dirtyField];
                }
              } else {
                this.snapshot[entityID].customState = structuredClone(
                  dirtyChunk[entityID].customState,
                );
              }
            } else {
              // @ts-ignore
              this.snapshot[entityID][dirtyField] =
                // @ts-ignore
                dirtyChunk[entityID][dirtyField];
            }
          }
        } else {
          this.snapshot[entityID] = structuredClone(dirtyChunk[entityID]);
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
