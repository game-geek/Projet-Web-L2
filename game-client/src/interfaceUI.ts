import { gameManagerInstance } from "./main";

const mineElement = document.getElementById("mine") as HTMLDivElement;
const minerElement = document.getElementById("miner") as HTMLDivElement;
const eliptaeElement = document.getElementById("eliptae") as HTMLDivElement;
const turretElement = document.getElementById("turret") as HTMLDivElement;

mineElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("mine");
});

minerElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("miner");
});

eliptaeElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("eliptae");
});
turretElement.addEventListener("click", (e) => {
  gameManagerInstance.dispatchAction("turret");
});
