// Update function

import { ServerBuilding } from "./buildings";

export default function NaturalWall(
  building: ServerBuilding<"natural_wall">,
  dt: number,
) {
  building.hp = 80;
  building.customState.test = true;
  building.markDirty("hp", 80);
  building.markDirty("customState", { test: true });
}
