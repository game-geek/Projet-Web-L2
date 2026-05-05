import { EntityKind } from "../../../../game-server/src/entities/entities";
import { EntityDefs } from "../../../../game-server/src/entities/globals";
import { ClientEntity, Component, DeltaField } from "./entities";
import { Math as PMath } from "phaser";
export default class Render implements Component {
  private sprite: Phaser.GameObjects.Sprite | null = null;

  // 1. "Truth": The last position received from the server
  private serverX: number;
  private serverY: number;

  // 2. Interpolation factor (0.1 = smooth/slow, 0.5 = fast/snappy)
  private lerpFactor: number = 0.2;

  constructor(
    private entity: ClientEntity<EntityKind>,
    private scene: Phaser.Scene,
  ) {
    this.serverX = entity.x;
    this.serverY = entity.y;

    this.sprite = scene.add
      .sprite(entity.x, entity.y, entity.kind)
      .setOrigin(0, 0);
  }

  onDelta(delta: Partial<Record<DeltaField, any>>) {
    // 3. Update the "Truth" but DO NOT move the sprite here
    if (delta.x !== undefined) this.serverX = delta.x;
    if (delta.y !== undefined) this.serverY = delta.y;
  }

  update(dt: number) {
    if (!this.sprite) return;

    // 4. Move the visual sprite towards the "Truth" every single frame
    this.sprite.x = PMath.Linear(this.sprite.x, this.serverX, this.lerpFactor);
    this.sprite.y = PMath.Linear(this.sprite.y, this.serverY, this.lerpFactor);

    // Optional: Snap if very close to avoid micro-jitter
    if (Math.abs(this.sprite.x - this.serverX) < 0.1)
      this.sprite.x = this.serverX;
    if (Math.abs(this.sprite.y - this.serverY) < 0.1)
      this.sprite.y = this.serverY;
  }

  destroy() {
    this.sprite?.destroy();
  }
}
