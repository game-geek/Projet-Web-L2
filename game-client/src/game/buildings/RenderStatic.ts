import { Display } from "phaser";
import { BuildingKind } from "../../../../game-server/src/buildings/buildings";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import { gameColors } from "../../../../game-server/src/globals";
import { ClientBuilding, Component, DeltaField } from "./buildings";

export default class RenderStatic implements Component {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private dot: Phaser.GameObjects.Arc | null = null;
  constructor(
    private building: ClientBuilding<BuildingKind>,
    private scene: Phaser.Scene,
  ) {
    console.log("sprite");
    this.sprite = scene.add
      .sprite(building.x * 32, building.y * 32, building.variant)
      .setOrigin(0, 0);

    if (building.kind == "turret") {
      const dotSize = 6;
      const dotX = this.sprite.x + this.sprite.displayWidth - dotSize * 0.5;
      const dotY = this.sprite.y + this.sprite.displayHeight - dotSize * 0.5;

      this.dot = scene.add.circle(
        dotX,
        dotY,
        dotSize / 2,
        Display.Color.HexStringToColor(gameColors[building.ownerID]).color,
      );
      this.dot.setStrokeStyle(1, 0x000000);
    }
  }

  onDelta(delta: Partial<Record<DeltaField, any>>) {
    if (!this.sprite) return;
    if (delta.x) {
      this.sprite.x = delta.x * 32;
      if (this.dot) {
        const dotSize = 6;
        this.dot.x = this.sprite.x + this.sprite.displayWidth - dotSize * 0.5;
      }
    }
    if (delta.y) {
      this.sprite.y = delta.y * 32;
      if (this.dot) {
        const dotSize = 6;
        this.dot.y = this.sprite.y + this.sprite.displayHeight - dotSize * 0.5;
      }
    }
  }

  destroy() {
    this.sprite?.destroy();
    if (this.dot) {
      this.dot.destroy();
    }
  }

  update(dt: number) {}
}
