import { ServerEntity } from "./entities";

type Point = { x: number; y: number };

export default function Bullet(entity: ServerEntity<"bullet">, dt: number) {
  // Ensure we have a direction calculated
  if (!entity.customState.direction) {
    const target = entity.customState.target as Point | undefined;
    if (!target) return;

    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      entity.customState.direction = { x: dx / dist, y: dy / dist };
    }
  }
  // @ts-ignore
  const speed: number = entity.customState.speed ?? 5;
  const step = speed * 1; //dt
  const dir = entity.customState.direction as Point;

  // Move the entity based on the cached direction vector
  entity.x += dir.x * step;
  entity.y += dir.y * step;

  // If we had a target, check if we passed it
  if (entity.customState.target) {
    const target = entity.customState.target as Point;
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;

    // Use dot product to check if we've passed the target relative to direction
    const dot = dx * dir.x + dy * dir.y;
    if (dot <= 0) {
      // Reached/passed target, clear it but keep moving
      entity.customState.target = null;
    }
  }

  entity.markDirty("x", entity.x);
  entity.markDirty("y", entity.y);
  entity.markDirty("customState", entity.customState);
}
