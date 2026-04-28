export const BuildingVariantsMap = {
  wall: ["top", "left", "right", "bottom"],
  natural_wall: ["1"],
} as const; // "as const" is needed for the types mathc PERFECTLY their values, for ex "top" is "top" and not string

export type BuildingVariantMap = {
  [K in keyof typeof BuildingVariantsMap]: (typeof BuildingVariantsMap)[K][number];
};

export type BuildingKind = keyof typeof BuildingVariantsMap;

const BuildingDefs = {
  wall: {
    maxHp: 100,
    destructible: true,
    w: 1,
    h: 1,
  },
  natural_wall: {
    maxHp: 300,
    destructible: true,
    w: 1,
    h: 1,
  },
} as const;

class ServerBuilding<K extends BuildingKind> {
  constructor(
    public kind: K,
    public variant: BuildingVariantMap[K],
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public hp: number,
    public maxHp: number,
    public destroyed = false,
  ) {}
}

export function createBuilding<K extends BuildingKind>(
  kind: K,
  variant: BuildingVariantMap[K],
  x: number,
  y: number,
) {
  const def = BuildingDefs[kind];
  return new ServerBuilding(
    kind,
    variant,
    x,
    y,
    def.w,
    def.h,
    def.maxHp,
    def.maxHp,
    false,
  );
}

type AnyServerBuilding = ServerBuilding<BuildingKind>;

export class MapBuildings {
  public readonly buildings: (AnyServerBuilding | null)[][] = [];

  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    for (let y = 0; y < height; y++) {
      this.buildings.push([]);
      for (let x = 0; x < width; x++) {
        this.buildings[y].push(null);
      }
    }
  }

  addBuilding(building: AnyServerBuilding) {
    // verify if its position is correct w/ the map and if its a valid position
    if (
      !(
        building.x >= 0 &&
        building.x + building.w < this.width &&
        building.y >= 0 &&
        building.y + building.h < this.height
      )
    )
      return "Placement out of map";
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) {
        if (this.buildings[y][x]) return "Invalid building location";
      }
    }
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) {
        this.buildings[y][x] = building;
      }
    }
  }

  _displayDebugMap() {
    console.log("[DEBUG] Class ", this.constructor.name, "buildings");
    for (let y = 0; y < this.height; y++) {
      let line = "";
      for (let x = 0; x < this.width; x++) {
        let b = this.buildings[y][x];
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
