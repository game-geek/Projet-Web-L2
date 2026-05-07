import { Boot } from "./scenes/Boot";
import { CurrencyScene } from "./scenes/CurrencyScene";
import { Game as MainGame } from "./scenes/Game";
import { AUTO, Game, Scale } from "phaser";

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  scale: {
    mode: Scale.RESIZE, // or FIT / NONE
  },
  parent: "game-container",
  backgroundColor: 0x000000,
  scene: [Boot, MainGame, CurrencyScene],
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;
