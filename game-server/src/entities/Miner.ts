import { ServerEntity } from "./entities";

export default function Miner(entity: ServerEntity<"miner">, dt: number) {
  entity.hp = 20;
  entity.markDirty("hp", 20);
}
