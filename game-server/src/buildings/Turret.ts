// Update function

import { ServerBuilding } from "./buildings";

export default function Turret(building: ServerBuilding<"turret">, dt: number) {
  //@ts-ignore
  if (building.customState.isShooting > 0) {
    //@ts-ignore
    building.customState.isShooting -= 1;
    building.markDirty("customState", building.customState);
  }
}
