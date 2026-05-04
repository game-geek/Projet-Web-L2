// should contain all the building constructors/types in this format:
import {
  BuildingKind,
  BuildingSnapshot,
  BuildingSnapshotFields,
  BuildingVariantMap,
} from "../../../../game-server/src/buildings/buildings";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import RenderStatic from "./RenderStatic";

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
};

const componentRegistry = {
  RenderStatic: RenderStatic,
};
export class ClientBuilding<K extends BuildingKind> {
  public components: Component[] = [];
  public deltaFieldsSub: Partial<Record<DeltaField, Set<string>>> = {};

  constructor(
    public id: number,
    public kind: K,
    public variant: BuildingVariantMap[K],
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public hp: number,
    public maxHp: number,
    public destroyed: boolean,
    public customState: Record<number, unknown>,
  ) {}

  addComponent(component: Component) {
    this.components.push(component);
  }
}

export class MapBuildings {
  public readonly buildingsMap: (ClientBuilding<BuildingKind> | null)[][] = [];
  public readonly buildings: Map<number, ClientBuilding<BuildingKind>> =
    new Map();

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    for (let y = 0; y < height; y++) {
      this.buildingsMap.push([]);
      for (let x = 0; x < width; x++) {
        this.buildingsMap[y].push(null);
      }
    }
  }

  addBuilding(building: ClientBuilding<BuildingKind>) {
    // verify if its position is correct w/ the map and if its a valid position
    if (
      !(
        building.x >= 0 &&
        building.x + building.w < this.width &&
        building.y >= 0 &&
        building.y + building.h < this.height
      )
    )
      return console.log("Placement out of map");
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) {
        if (this.buildingsMap[y][x])
          // return "Invalid building location";
          console.log("warning: a building alwready exists in that location");
      }
    }
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) {
        this.buildingsMap[y][x] = building;
      }
    }
    this.buildings.set(building.id, building);
    console.log(
      "setting",
      building.id,
      "does it have it ?",
      this.buildings.has(building.id),
    );
  }

  _displayDebugMap() {
    console.log("[DEBUG] Class ", this.constructor.name, "buildingsMap");
    for (let y = 0; y < this.height; y++) {
      let line = "";
      for (let x = 0; x < this.width; x++) {
        let b = this.buildingsMap[y][x];
        line +=
          b != null
            ? (b?.kind + " - " + b?.variant).padEnd(20, "_").slice(0, 20)
            : "".padEnd(20, "_");
        line += "  ";
      }
      console.log(line);
    }
  }
}
export function issueDeltaUpdate(
  building: ClientBuilding<BuildingKind>,
  snapshot: Partial<BuildingSnapshot<BuildingKind>>,
) {
  for (const field in BuildingSnapshotFields) {
    if (field == "customState") {
      // @ts-ignore
      building[field] = structuredClone(snapshot[field]);
    }
    // @ts-ignore
    building[field] = snapshot[field];
  }
  building.components.forEach((comp) => comp.onDelta(snapshot));
}
export function issueSnapshotUpdate(
  building: ClientBuilding<BuildingKind>,
  snapshot: BuildingSnapshot<BuildingKind>,
) {
  for (const field in BuildingSnapshotFields) {
    if (field == "customState") {
      // @ts-ignore
      building[field] = structuredClone(snapshot[field]);
    }
    // @ts-ignore
    building[field] = snapshot[field];
  }
  building.components.forEach((comp) => comp.onDelta(snapshot));
}

export function createClientBuilding(
  dto: BuildingSnapshot<BuildingKind>,
  scene: Phaser.Scene,
) {
  const def = BuildingDefs[dto.kind];

  const building = new ClientBuilding(
    dto.id,
    dto.kind,
    dto.variant,
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
      building.addComponent(new Comp(building, scene));
    }
  });

  return building;
}
