import { BuildingKind } from "../../../../game-server/src/buildings/buildings";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import { ClientBuilding, Component, DeltaField } from "./buildings";

export default class RenderStatic implements Component {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  constructor(
    private building: ClientBuilding<BuildingKind>,
    private scene: Phaser.Scene,
  ) {
    console.log("sprite");
    this.sprite = scene.add
      .sprite(building.x * 32, building.y * 32, building.variant)
      .setOrigin(0, 0);
  }

  onDelta(delta: Partial<Record<DeltaField, any>>) {
    if (!this.sprite) return;
    if (delta.x) {
      this.sprite.x = delta.x * 32;
    }
    if (delta.y) {
      this.sprite.y = delta.y * 32;
    }
  }

  update(dt: number) {}
}
