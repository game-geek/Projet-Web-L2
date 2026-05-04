// should contain all the entity constructors/types in this format:
import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../../../../game-server/src/buildings/globals";
import {
  EnitiySnapshotFields,
  EntityKind,
  EntitySnapshot,
} from "../../../../game-server/src/entities/entities";
import { EntityDefs } from "../../../../game-server/src/entities/globals";
import Render from "./Render";

export type DeltaField =
  | "hp"
  | "maxHp"
  | "x"
  | "y"
  | "w"
  | "h"
  | "customState.repairProgress";

export type Component = {
  onDelta: (delta: Partial<Record<DeltaField, any>>) => void;
  update: (dt: number) => void;
  destroy: () => void;
};

export const componentRegistry = {
  Render: Render,
} as const;
export class ClientEntity<K extends EntityKind> {
  public components: Map<string, Component> = new Map();
  public deltaFieldsSub: Partial<Record<DeltaField, Set<string>>> = {};

  constructor(
    public id: number,
    public kind: K,
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public hp: number,
    public maxHp: number,
    public destroyed: boolean,
    public customState: Record<number, unknown>,
  ) {
    console.log("entity spawn");
  }

  addComponent(name: string, component: Component) {
    // should typesafe name + component...
    this.components.set(name, component);
  }
  removeComponent(name: string) {
    const c = this.components.get(name);
    if (c) c.destroy();
    this.components.delete(name);
  }
}

export class MapEntities {
  public readonly entities: Map<number, ClientEntity<EntityKind>> = new Map();

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}

  addEntity(entity: ClientEntity<EntityKind>) {
    // verify if its position is correct w/ the map and if its a valid position
    if (
      !(
        entity.x > 0 &&
        entity.y > 0 &&
        entity.x + EntityDefs[entity.kind].shared.w < this.width * 32 &&
        entity.y + EntityDefs[entity.kind].shared.h < this.height * 32
      )
    )
      return console.log("Placement out of map");

    this.entities.set(entity.id, entity);
    console.log(
      "setting",
      entity.id,
      "does it have it ?",
      this.entities.has(entity.id),
    );
  }

  addComponent(
    buildingID: number,
    name: keyof typeof componentRegistry,
    Comp: (typeof componentRegistry)[keyof typeof componentRegistry],
    scene: Phaser.Scene,
  ) {
    const b = this.entities.get(buildingID);
    if (b && !b.components.has(name)) b.addComponent(name, new Comp(b, scene));
  }
  removeComponent(buildingID: number, name: keyof typeof componentRegistry) {
    const b = this.entities.get(buildingID);
    if (b) b.removeComponent(name);
  }
}
export function issueDeltaUpdate(
  entity: ClientEntity<EntityKind>,
  snapshot: Partial<EntitySnapshot<EntityKind>>,
) {
  for (const field in EnitiySnapshotFields) {
    if (field == "customState") {
      // @ts-ignore
      entity[field] = structuredClone(snapshot[field]);
    }
    // @ts-ignore
    entity[field] = snapshot[field];
  }
  entity.components.forEach((comp) => comp.onDelta(snapshot));
}
export function issueSnapshotUpdate(
  entity: ClientEntity<EntityKind>,
  snapshot: EntitySnapshot<EntityKind>,
) {
  for (const field in EnitiySnapshotFields) {
    if (field == "customState") {
      // @ts-ignore
      entity[field] = structuredClone(snapshot[field]);
    }
    // @ts-ignore
    entity[field] = snapshot[field];
  }
  entity.components.forEach((comp) => comp.onDelta(snapshot));
}

export function createClientEntity(
  dto: EntitySnapshot<EntityKind>,
  scene: Phaser.Scene,
) {
  const def = EntityDefs[dto.kind];

  const entity = new ClientEntity(
    dto.id,
    dto.kind,
    dto.x,
    dto.y,
    dto.w,
    dto.h,
    dto.hp,
    dto.maxHp,
    dto.destroyed,
    dto.customState,
  );

  // add components

  def.client.components.forEach((componentName) => {
    if (componentName in componentRegistry) {
      // add the component
      const Comp = componentRegistry[componentName];
      entity.addComponent(componentName, new Comp(entity, scene));
    }
  });

  return entity;
}
