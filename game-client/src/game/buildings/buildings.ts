// should contain all the building constructors/types in this format:
import {
  BuildingKind,
  BuildingSnapshot,
  BuildingSnapshotFields,
  BuildingVariantMap,
} from "../../../../game-server/src/buildings/buildings";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import MiningOverlay from "./MiningOverlay";
import RenderStatic from "./RenderStatic";

export type DeltaField =
  | "hp"
  | "maxHp"
  | "x"
  | "y"
  | "w"
  | "h"
  | "customState"
  | "ownerID";

export type Component = {
  onDelta: (delta: Partial<Record<DeltaField, any>>) => void;
  update: (dt: number) => void;
  destroy: () => void;
};

export const buildingsComponentRegistry = {
  RenderStatic: RenderStatic,
  MiningOverlay: MiningOverlay,
};
export class ClientBuilding<K extends BuildingKind> {
  public components: Map<string, Component> = new Map();
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
    public ownerID: number,
  ) {}

  addComponent(name: string, component: Component) {
    // should typesafe name + component...
    this.components.set(name, component);
  }
  removeComponent(name: string) {
    const c = this.components.get(name);
    if (c) c.destroy();
    this.components.delete(name);
  }
  destroy() {
    for (const comp of this.components.values()) {
      comp.destroy();
    }
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

  removeBuilding(buildingID: number) {
    const b = this.buildings.get(buildingID);
    if (b) b.destroy();
    this.buildings.delete(buildingID);
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

  addComponent(
    buildingID: number,
    name: keyof typeof buildingsComponentRegistry,
    Comp: (typeof buildingsComponentRegistry)[keyof typeof buildingsComponentRegistry],
    scene: Phaser.Scene,
  ) {
    const b = this.buildings.get(buildingID);
    if (b && !b.components.has(name)) b.addComponent(name, new Comp(b, scene));
  }
  removeComponent(
    buildingID: number,
    name: keyof typeof buildingsComponentRegistry,
  ) {
    const b = this.buildings.get(buildingID);
    if (b) {
      b.removeComponent(name);
    }
  }
}
export function issueBuildingDeltaUpdate(
  building: ClientBuilding<BuildingKind>,
  snapshot: Partial<BuildingSnapshot<BuildingKind>>,
) {
  for (const field of BuildingSnapshotFields) {
    if (!(field in snapshot)) continue;
    if (field == "customState") {
      // @ts-ignore
      building[field] = structuredClone(snapshot[field]);
    }
    // @ts-ignore
    building[field] = snapshot[field];
  }
  building.components.forEach((comp) => comp.onDelta(snapshot));
}
export function issueBuildingsSnapshotUpdate(
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
    dto.ownerID,
  );

  // add components

  def.client.components.forEach((componentName) => {
    if (componentName in buildingsComponentRegistry) {
      // add the component
      const Comp = buildingsComponentRegistry[componentName];
      building.addComponent(componentName, new Comp(building, scene));
    }
  });

  return building;
}
