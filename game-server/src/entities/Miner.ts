import { ServerEntity } from "./entities";

export default function Miner(entity: ServerEntity<"miner">, dt: number) {
  if (!entity.customState || !entity.customState.path) return;

  const path = entity.customState.path as { x: number; y: number }[];

  // 1. If we have no target, but we have a path, pick the next node
  if (!entity.customState.currentTarget && path.length > 0) {
    entity.customState.currentTarget = path.shift();
    entity.markDirty("customState", entity.customState);
  }

  // 2. If we still have no target, we've finished the path
  if (!entity.customState.currentTarget) {
    if (!entity.customState.mining) {
      entity.customState.mining = true;
      entity.markDirty("customState", entity.customState);
    }
    return;
  }

  // 3. Move toward the current target node
  const target = entity.customState.currentTarget as { x: number; y: number };
  const targetX = target.x * 32;
  const targetY = target.y * 32;

  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const dist = Math.hypot(dx, dy);
  // @ts-ignore
  const speed: number = entity.customState.speed ?? 2;
  const step = speed * 1;

  if (dist <= step) {
    // We arrived at this node; snap and clear target to fetch next one
    entity.x = targetX;
    entity.y = targetY;
    entity.customState.currentTarget = null;
  } else {
    // Keep moving
    entity.x += Math.floor((dx / dist) * step);
    entity.y += Math.floor((dy / dist) * step);
  }

  entity.markDirty("x", entity.x);
  entity.markDirty("y", entity.y);
  entity.markDirty("customState", entity.customState);
}
