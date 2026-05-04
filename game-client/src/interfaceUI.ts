import { gameManagerInstance } from "./main";

const mineElement = document.getElementById("mine") as HTMLDivElement;
const minerElement = document.getElementById("miner") as HTMLDivElement;

mineElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("mine");
});

minerElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("miner");
});
