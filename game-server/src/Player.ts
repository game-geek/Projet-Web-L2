import { DirtyChunkType } from "./buildings/buildings";
import { CHUNK_HEIGHT, CHUNK_WIDTH } from "./buildings/globals";
import deltaBuilder from "./DeltaBuilder";
import Session from "./Session";

type ViewAreaType = { x: number; y: number; width: number; height: number };

export default class Player {
  public chunks: [number, number][] = [];
  public session: Session | null = null;
  public deltaBuilder: deltaBuilder | null = null;

  constructor(public ViewArea: ViewAreaType) {
    this.updateChunkView();
  }

  expandViewArea(newViewArea: ViewAreaType) {
    this.ViewArea = newViewArea;

    this.updateChunkView();
  }

  updateChunkView() {
    for (
      let y = Math.floor(this.ViewArea.y / CHUNK_HEIGHT);
      y < Math.ceil((this.ViewArea.y + this.ViewArea.height) / CHUNK_HEIGHT);
      y += 1
    ) {
      for (
        let x = Math.floor(this.ViewArea.x / CHUNK_WIDTH);
        x < Math.ceil((this.ViewArea.x + this.ViewArea.width) / CHUNK_WIDTH);
        x += 1
      ) {
        this.chunks.push([y, x]);
      }
    }
  }

  linkSession(session: Session, allDirtyChunks: DirtyChunkType[][][]) {
    if (this.session) {
      // error there should only be one session (kill the other ?)
    }
    this.session = session;
    this.deltaBuilder = new deltaBuilder(this, allDirtyChunks, this.chunks);
  }

  createDelta(tick: number, allDirtyChunksAt: number) {
    if (!this.deltaBuilder || !this.session) return;

    this.deltaBuilder.tick(tick, allDirtyChunksAt);
  }

  sendDelta() {
    if (!this.deltaBuilder || !this.session) return;
    this.session.sendDatagramJSON(this.deltaBuilder.snapshot);
  }
}
