import {
  AnyServerBuilding,
  BuildingDef,
  BuildingKind,
  BuildingSnapshot,
  ServerBuildingOf,
} from "./buildings";
import NaturalWall from "./NaturalWall";

// buildings in the game with their variants
export const BuildingVariantsMap = {
  wall: ["top", "left", "right", "bottom"],
  natural_wall: ["1"],
} as const; // "as const" is needed for the types match PERFECTLY their values, for ex "top" is "top" and not string

// the default data related to those buildings
export const BuildingDefs = {
  wall: {
    shared: { maxHp: 100, destructible: true, w: 1, h: 1 },
    server: {
      initState: () => ({
        ammo: 30,
        charge: 0,
        targetId: null as number | null,
      }),
    },
    client: {
      textures: {
        top: "wall_top",
        left: "wall_left",
        right: "wall_right",
        bottom: "wall_bottom",
      },
      components: ["renderable", "health", "repairable", "solid"] as const,
    },
  },
  natural_wall: {
    shared: { maxHp: 300, destructible: true, w: 1, h: 1 },
    server: {
      initState: () => ({
        ammo: 30,
        charge: 0,
        targetId: null as number | null,
      }),
    },
    client: {
      textures: {
        "1": "natural_wall_1",
      },
      components: ["renderable", "health", "solid"] as const,
    },
  },
} as const satisfies {
  [K in BuildingKind]: BuildingDef<K>;
};

type BuildingSystem<K extends BuildingKind> = (
  building: ServerBuildingOf<K>,
  dt: number,
) => void;

export type BuildingSystemMap = {
  [K in BuildingKind]: BuildingSystem<K>;
};

export type BuildingSystemMapOf<K extends BuildingKind> = BuildingSystemMap[K];

export const BuildingSystems: BuildingSystemMap = {
  wall: (building, dt) => {},
  natural_wall: NaturalWall,
} as const;
