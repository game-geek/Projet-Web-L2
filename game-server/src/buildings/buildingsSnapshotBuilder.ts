import Player from "../Player";
import {
  AnyServerBuilding,
  BuildingSnapshotFields,
  DirtyBuildingChunkType,
} from "./buildings";

export default class buildingsSnapshotBuilder {
  public snapshot: DirtyBuildingChunkType = {};
  constructor(
    public player: Player,
    public buildings: (AnyServerBuilding | null)[][],
    public chunks: [number, number][],
  ) {}

  createSnapshot() {
    this.snapshot = {};
    for (
      let y = this.player.ViewArea.y;
      y < this.player.ViewArea.y + this.player.ViewArea.height;
      y++
    ) {
      for (
        let x = this.player.ViewArea.x;
        x < this.player.ViewArea.x + this.player.ViewArea.width;
        x++
      ) {
        const b = this.buildings[y][x];
        if (b == null) continue;

        this.snapshot[b.id] = {};
        for (const field of BuildingSnapshotFields) {
          if (field == "customState")
            this.snapshot[b.id][field] = structuredClone(b[field]);
          //@ts-ignore
          else this.snapshot[b.id][field] = b[field];
        }
      }
    }
  }
}
