import { EntityKind } from "../../../../game-server/src/entities/entities";
import { EntityDefs } from "../../../../game-server/src/entities/globals";
import { ClientEntity, Component, DeltaField } from "./entities";

export default class Render implements Component {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  constructor(
    private entity: ClientEntity<EntityKind>,
    private scene: Phaser.Scene,
  ) {
    console.log("fdsfsdfsdlfjldsfjdlk");
    console.log("sprite");
    this.sprite = scene.add
      .sprite(entity.x, entity.y, EntityDefs[entity.kind].client.textures.top)
      .setOrigin(0, 0)
      .setAlpha(0.3);
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

  destroy() {
    this.sprite?.destroy();
  }
}
