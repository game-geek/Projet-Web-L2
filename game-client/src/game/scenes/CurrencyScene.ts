import { Scene, Geom, Input, Math as PMath } from "phaser";
import serverCommunication from "../../serverCommunication";
import gameManager from "../gameManager";
import { gameManagerInstance } from "../../main";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../../game-server/src/buildings/globals";

export class CurrencyScene extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  msg_text: Phaser.GameObjects.Text;

  currencyText: Phaser.GameObjects.Text | null = null;
  previousCurrency = 0;

  gameManager: gameManager | null = null;

  constructor() {
    super("CurrencyScene");
  }

  init() {
    this.gameManager = gameManagerInstance;
  }

  create() {
    // currency
    this.currencyText = this.add
      .text(
        this.cameras.main.width - 20, // Right-aligned, 20px padding
        10, // Top padding
        "crystite: 0",
        {
          fontSize: "24px",
          fontFamily: "custom",
          color: "#ffffff",
          align: "right",
        },
      )
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }
  update(time: number, delta: number): void {
    if (
      this.currencyText &&
      this.gameManager &&
      this.previousCurrency != this.gameManager.currency
    ) {
      this.previousCurrency = this.gameManager.currency;
      this.currencyText.setText(`crystite: ${this.gameManager.currency || 0}`);
    }
  }
}
