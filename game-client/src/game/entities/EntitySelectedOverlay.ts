import { BuildingKind } from "../../../../game-server/src/buildings/buildings";
import { EntityKind } from "../../../../game-server/src/entities/entities";
import { ClientEntity, Component, DeltaField } from "./entities";

export default class EntitySelectedOverlay implements Component {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private readonly padding = 4;
  private readonly yellow = 0xffff00;

  constructor(
    private entity: ClientEntity<EntityKind>,
    private scene: Phaser.Scene,
  ) {
    this.graphics = scene.add.graphics();
    this.updateOverlay();
  }

  onDelta(delta: Partial<Record<DeltaField, any>>) {
    if (delta.x !== undefined || delta.y !== undefined) {
      this.updateOverlay();
    }
    if (delta.customState) {
      this.drawPath();
    }
  }

  private updateOverlay() {
    if (!this.graphics || !this.entity.x || !this.entity.y) return;

    this.graphics.clear();

    const left = this.entity.x - this.padding;
    const top = this.entity.y - this.padding;
    const size = 3 * this.padding + this.entity.w;

    this.graphics.lineStyle(0.5, this.yellow, 1.0);
    this.graphics.strokeRect(left, top, size, size);

    this.drawPath();
  }

  private drawPath() {
    // @ts-ignore
    if (
      !this.graphics ||
      // @ts-ignore
      !this.entity.customState?.path ||
      // @ts-ignore
      this.entity.customState.path.length === 0
    ) {
      return;
    }

    this.graphics.lineStyle(2, this.yellow, 1.0);
    this.graphics.beginPath();
    // @ts-ignore
    const path = this.entity.customState.path;
    let px = this.entity.x + 32 / 2;
    let py = this.entity.y + 32 / 2;
    this.graphics.moveTo(px, py);
    for (let i = 0; i < path.length; i++) {
      px = path[i].x * 32 + 32 / 2;
      py = path[i].y * 32 + 32 / 2;
      this.graphics.lineTo(px, py);
    }
    this.graphics.strokePath();
  }

  update(dt: number) {}

  destroy() {
    this.graphics?.destroy();
  }
}
