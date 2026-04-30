// should contain all the building constructors/types in this format:
import {
  BuildingKind,
  BuildingSnapshot,
  BuildingVariantMap,
} from "../../../../game-server/src/buildings/buildings";
import { BuildingDefs } from "../../../../game-server/src/buildings/globals";
import { DeltaField } from "./Components";
interface Component {
  onAttach?(): void;
  update?(dt: number): void;
}
type ComponentCtor<T extends Component = Component> = new () => T;

const ComponentRegistry: Record<string, ComponentCtor> = {};

class Transform {
  public x: number;
  public y: number;
  public w: number;
  public h: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.w = width;
    this.h = height;
  }
}

export class ClientBuilding<K extends BuildingKind> {
  public components: Record<string, Component> = {};
  public deltaFieldsSub: Partial<Record<DeltaField, Set<string>>> = {};

  constructor(
    public id: number,
    public kind: K,
    public variant: BuildingVariantMap[K],
    public transform: Transform,
    public hp: number,
    public maxHp: number,
    public destroyed: boolean,
    public customState: Record<number, unknown>,
  ) {}

  addComponent(componentName: string, component: Component) {
    this.components[componentName] = component;
  }
}

export class MapBuildings {
  public readonly buildingsMap: (ClientBuilding<BuildingKind> | null)[][] = [];

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
    if (!building.transform) return "Building is not a Transformable";

    // verify if its position is correct w/ the map and if its a valid position
    if (
      !(
        building.transform.x >= 0 &&
        building.transform.x + building.transform.w < this.width &&
        building.transform.y >= 0 &&
        building.transform.y + building.transform.h < this.height
      )
    )
      return "Placement out of map";
    for (
      let y = building.transform.y;
      y < building.transform.y + building.transform.h;
      y++
    ) {
      for (
        let x = building.transform.x;
        x < building.transform.x + building.transform.w;
        x++
      ) {
        if (this.buildingsMap[y][x])
          return "Invalid building.transform location";
      }
    }
    for (
      let y = building.transform.y;
      y < building.transform.y + building.transform.h;
      y++
    ) {
      for (
        let x = building.transform.x;
        x < building.transform.x + building.transform.w;
        x++
      ) {
        this.buildingsMap[y][x] = building;
      }
    }
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

function createClientBuilding(dto: BuildingSnapshot<BuildingKind>) {
  const def = BuildingDefs[dto.kind];

  const building = new ClientBuilding(
    dto.id,
    dto.kind,
    dto.variant,
    new Transform(dto.x, dto.y, dto.w, dto.h),
    dto.hp,
    dto.maxHp,
    dto.destroyed,
    dto.customState,
  );

  for (const spec of def.client.components) {
    const Comp = ComponentRegistry[spec];
    const component = new Comp();
    building.addComponent(spec, component);
  }

  return building;
}
