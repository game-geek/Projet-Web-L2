import { Scene } from "phaser";
import serverCommunication from "../../serverCommunication";
import gameManager from "../gameManager";

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  msg_text: Phaser.GameObjects.Text;

  gameManager: gameManager | null = null;

  constructor() {
    super("Game");
  }

  init({ gameManagerInstance }: { gameManagerInstance: gameManager }) {
    this.gameManager = gameManagerInstance;
    this.gameManager.init(this);
    console.log("game initialized");
  }

  create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x00ff00);

    this.background = this.add.image(0, 0, "background").setOrigin(0, 0);
    this.background.setAlpha(0.5);

    this.msg_text = this.add.text(
      512,
      384,
      "Make something fun!\nand share it with us:\nsupport@phaser.io",
      {
        fontFamily: "Arial Black",
        fontSize: 38,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 8,
        align: "center",
      },
    );
    this.msg_text.setOrigin(0.5);
  }
  update(time: number, delta: number): void {
    if (!this.gameManager) return;
    this.gameManager.update();
  }
}
