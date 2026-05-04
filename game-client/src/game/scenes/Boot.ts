import { Scene } from "phaser";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import { BuildingKind } from "../../../../game-server/src/buildings/buildings";

export class Boot extends Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
    //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

    this.load.image("background", "assets/bg.png");
    const textures = {};
    for (const buildingKind in BuildingDefs) {
      // @ts-ignore
      const b = BuildingDefs[buildingKind];
      for (const textureName in b.client.textures) {
        this.load.image(textureName, b.client.textures[textureName]);
      }
    }
  }

  create() {
    this.scene.start("Game");
  }
}
