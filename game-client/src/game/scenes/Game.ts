import { Scene, Geom, Input } from "phaser";
import serverCommunication from "../../serverCommunication";
import gameManager from "../gameManager";
import { gameManagerInstance } from "../../main";

export class Game extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  msg_text: Phaser.GameObjects.Text;

  currencyText: Phaser.GameObjects.Text | null = null;

  gameManager: gameManager | null = null;

  private overlayAction: null | "mine" | "miner" = null;

  private selectionStart: Phaser.Math.Vector2 | null = null;
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super("Game");
  }

  setOverlayAction(overlayAction: null | "mine" | "miner") {
    if (overlayAction == "mine") {
      this.input.setDefaultCursor("url('assets/pickaxe2.png') 12 12, auto");
      this.overlayAction = overlayAction;
    } else if (overlayAction == "miner") {
      console.log("fdlksfjdkfhdfjmdsmlfkmsdlfksdlmk");
      this.input.setDefaultCursor("url('assets/pickaxe2.png') 12 12, auto");
      this.overlayAction = overlayAction;
    }
  }

  init() {
    this.gameManager = gameManagerInstance;
    this.gameManager.init(this);
    console.log("game initialized");
  }

  create() {
    if (!this.input.keyboard) return;
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x000000);

    this.selectionGraphics = this.add.graphics();

    const esc = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC);

    esc.on("down", () => {
      console.log("Escape pressed");
      this.overlayAction = null;
      this.input.setDefaultCursor("auto");
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.overlayAction == "mine") {
        // Save start position in World coordinates
        this.selectionStart = this.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y,
        );
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.overlayAction) return;
      if (!this.selectionGraphics) return;
      if (!this.selectionStart || !pointer.isDown) return;

      if (this.overlayAction == "mine") {
        const currentWorld = this.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y,
        );

        // Clear the previous frame's drawing
        this.selectionGraphics.clear();

        // Set the fill color (0x00ff00 is green) and alpha (0.3)
        this.selectionGraphics.fillStyle(0x555555, 0.3);

        // Set the outline style (optional, for better visibility)
        this.selectionGraphics.lineStyle(2, 0x3a3a3a, 1.0);

        // Calculate width/height relative to the start point
        const x = Math.min(this.selectionStart.x, currentWorld.x);
        const y = Math.min(this.selectionStart.y, currentWorld.y);
        const width = Math.abs(currentWorld.x - this.selectionStart.x);
        const height = Math.abs(currentWorld.y - this.selectionStart.y);

        // Draw the filled rectangle and the outline
        this.selectionGraphics.fillRect(x, y, width, height);
        this.selectionGraphics.strokeRect(x, y, width, height);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.overlayAction || !this.gameManager) return;

      if (this.overlayAction == "mine") {
        if (!this.selectionStart) return;
        const endWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // Create the mathematical rectangle
        const selectionRect = Geom.Rectangle.FromXY(
          this.selectionStart.x,
          this.selectionStart.y,
          endWorld.x,
          endWorld.y,
        );
        console.log("overlay action", this.overlayAction, selectionRect);
        this.gameManager.mineSelection(selectionRect);

        // Now check your game objects
        // Example: this.myGameObjects.filter(obj => selectionRect.contains(obj.x, obj.y))

        if (!this.selectionGraphics) return;
        this.selectionGraphics.clear();
        this.selectionStart = null;
      } else if (this.overlayAction == "miner") {
        const currentPoint = this.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y,
        );
        this.gameManager.spawnMiner(currentPoint.x, currentPoint.y);
      }
    });

    // currency
    this.currencyText = this.add
      .text(
        this.cameras.main.width - 20, // Right-aligned, 20px padding
        20, // Top padding
        "Currency: 0",
        {
          fontSize: "24px",
          fontFamily: "Arial",
          color: "#ffffff",
          align: "right",
        },
      )
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }
  update(time: number, delta: number): void {
    if (!this.gameManager) return;
    this.gameManager.update();
    if (this.currencyText)
      this.currencyText.setText(`Currency: ${this.gameManager?.currency || 0}`);
  }
}
