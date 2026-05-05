import { Scene } from "phaser";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import { BuildingKind } from "../../../../game-server/src/buildings/buildings";
import { EntityDefs } from "../../../../game-server/src/entities/globals";

export class Boot extends Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
    //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

    this.load.image("background", "assets/bg.png");
    this.load.image("pickaxe", "assets/pickaxe2.png");
    for (const buildingKind in BuildingDefs) {
      // @ts-ignore
      const b = BuildingDefs[buildingKind];
      for (const textureName in b.client.textures) {
        this.load.image(textureName, b.client.textures[textureName]);
      }
    }
    this.load.image("eliptae", "/assets/eliptae_32.png");
    this.load.image("miner", "/assets/miner_32.png");
    this.load.image("bullet", "/assets/bullet.png");
    this.load.image("void", "/assets/void.png");

    this.load.font({
      key: "custom",
      url: "assets/BruceForeverRegular-X3jd2.ttf",
      format: "truetype",
    });
  }

  create() {
    this.scene.start("Game");
  }
}
