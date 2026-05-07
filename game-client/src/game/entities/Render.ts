import { EntityKind } from "../../../../game-server/src/entities/entities";
import { EntityDefs } from "../../../../game-server/src/entities/globals";
import { gameColors } from "../../../../game-server/src/globals";

// import { gameColors } from "../../../../game-server/src/index";  // cause process is not defined error: when imports index, it runes the code: and there are server specefic suff, ... fix: put it in a file where there is no server specefic stuff
import { ClientEntity, Component, DeltaField } from "./entities";
import { Display, Math as PMath } from "phaser";
export default class Render implements Component {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private dot: Phaser.GameObjects.Arc | null = null;

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

    if (entity.kind == "bullet") return;
    const dotSize = 6;
    const dotX = this.sprite.x + this.sprite.displayWidth - dotSize * 0.5;
    const dotY = this.sprite.y + this.sprite.displayHeight - dotSize * 0.5;

    this.dot = scene.add.circle(
      dotX,
      dotY,
      dotSize / 2,
      Display.Color.HexStringToColor(gameColors[entity.ownerID]).color,
    );
    this.dot.setStrokeStyle(1, 0x000000);
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

    if (!this.dot) return;

    // Update dot position to bottom-right of sprite
    const dotSize = 6;
    this.dot.x = this.sprite.x + this.sprite.displayWidth - dotSize * 0.5;
    this.dot.y = this.sprite.y + this.sprite.displayHeight - dotSize * 0.5;
  }
  destroy() {
    this.sprite?.destroy();
    if (this.dot) {
      this.dot.destroy();
    }
  }
}
