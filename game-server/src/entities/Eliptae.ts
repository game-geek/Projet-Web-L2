import { ServerEntity } from "./entities";

export default function Eliptae(entity: ServerEntity<"eliptae">, dt: number) {
  // 1. Manage shooting state
  // @ts-ignore
  if (entity.customState.isShooting > 0) {
    // @ts-ignore
    entity.customState.isShooting -= 1;
    entity.markDirty("customState", entity.customState);
  }

  // 2. Get target coordinate
  const path = entity.customState.path as { x: number; y: number }[];
  if (!path || path.length === 0) return;

  const targetNode = path[0];
  const targetX = targetNode.x * 32;
  const targetY = targetNode.y * 32;

  // 3. Move incrementally
  //@ts-ignore
  const speed: number = entity.customState.speed ?? 5;
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 2) {
    // Reached target grid point, move to next
    path.shift();
    entity.x = targetX;
    entity.y = targetY;
  } else {
    // Move toward target
    const step = speed * 1;
    entity.x += (dx / dist) * step;
    entity.y += (dy / dist) * step;
  }

  entity.markDirty("x", entity.x);
  entity.markDirty("y", entity.y);
  entity.markDirty("customState", entity.customState);
}
