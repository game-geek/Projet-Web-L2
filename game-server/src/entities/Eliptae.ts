import { ServerEntity } from "./entities";

export default function Eliptae(entity: ServerEntity<"eliptae">, dt: number) {
  entity.hp = 20;
  entity.markDirty("hp", 20);
}
