import { gameManagerInstance } from "./main";

const mineElement = document.getElementById("mine") as HTMLDivElement;

mineElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("mine");
});
