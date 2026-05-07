import { ServerEntity } from "./entities";

type Point = { x: number; y: number };

export default function Eliptae(entity: ServerEntity<"eliptae">, dt: number) {
  // @ts-ignore
  if (entity.customState.isShooting > 0) {
    // @ts-ignore
    entity.customState.isShooting -= 1;
    entity.markDirty("customState", entity.customState);
  }
  // @ts-ignore
  if (
    !entity.customState ||
    !entity.customState.target ||
    // @ts-ignore
    entity.customState.path.length == 0
  )
    return;

  const cs = entity.customState as typeof entity.customState & {
    path?: Point[];
    currentTarget?: Point | null;
    lastTarget?: unknown;
    target?: unknown;
    speed?: number;
  };

  const target = cs.target;
  const path = cs.path ?? [];

  const targetChanged = cs.lastTarget !== target;
  if (targetChanged) {
    cs.lastTarget = target;
    cs.currentTarget = null;
    entity.markDirty("customState", entity.customState);
  }

  if (path.length === 0) {
    cs.currentTarget = null;
    entity.markDirty("customState", entity.customState);
    return;
  }

  if (!cs.currentTarget) {
    cs.currentTarget = path[0];
    entity.markDirty("customState", entity.customState);
  }

  const currentTarget = cs.currentTarget;
  if (!currentTarget) return;

  const targetX = currentTarget.x * 32;
  const targetY = currentTarget.y * 32;

  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const dist = Math.hypot(dx, dy);

  const speed = cs.speed ?? 2;
  const step = speed * 1;

  if (targetChanged) {
    return;
  }

  if (dist <= step) {
    entity.x = targetX;
    entity.y = targetY;

    path.shift();
    cs.currentTarget = null;

    if (path.length > 0) {
      cs.currentTarget = path[0];
    }

    entity.markDirty("x", entity.x);
    entity.markDirty("y", entity.y);
    entity.markDirty("customState", entity.customState);
  } else {
    entity.x += (dx / dist) * step;
    entity.y += (dy / dist) * step;

    entity.markDirty("x", entity.x);
    entity.markDirty("y", entity.y);
  }
}
