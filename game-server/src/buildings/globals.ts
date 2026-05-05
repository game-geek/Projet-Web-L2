import {
  AnyServerBuilding,
  BuildingDef,
  BuildingKind,
  BuildingSnapshot,
  ServerBuilding,
} from "./buildings";
import NaturalWall from "./NaturalWall";
import Turret from "./Turret";

// buildings in the game with their variants
export const BuildingVariantsMap = {
  natural_wall: ["1", "2", "3", "4", "5", "6", "7", "8"],
  turret: ["turret"],
} as const; // "as const" is needed for the types match PERFECTLY their values, for ex "top" is "top" and not string

// the default data related to those buildings
export const BuildingDefs = {
  natural_wall: {
    shared: { maxHp: 300, destructible: true, w: 1, h: 1 },
    server: {
      initState: () => ({
        toMine: false,
      }),
    },
    client: {
      textures: {
        "1": "assets/natural-tile.png",
        "2": "assets/natural-tile2.png",
        "3": "assets/natural-tile3.png",
        "4": "assets/natural-tile4.png",
        "5": "assets/natural-tile5.png",
        "6": "assets/natural-tile6.png",
        "7": "assets/natural-tile7.png",
        "8": "assets/natural-tile8.png",
      },
      components: ["RenderStatic"] as const,
    },
  },
  turret: {
    shared: { maxHp: 300, destructible: true, w: 1, h: 1 },
    server: {
      initState: () => ({
        area: 200,
        isShooting: 0,
      }),
    },
    client: {
      textures: {
        turret: "assets/turret_32.png",
      },
      components: ["RenderStatic"] as const,
    },
  },
} as const satisfies {
  [K in BuildingKind]: BuildingDef<K>;
};

export const BuildingKinds = Object.keys(
  BuildingDefs,
) as (keyof typeof BuildingDefs)[];
export const BuildingVariants = Object.values(BuildingVariantsMap).flat();

export const DIRTY_CHUNKS_TICKS = 20;
export const CHUNK_WIDTH = 64;
export const CHUNK_HEIGHT = 64;
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;

type BuildingSystem<K extends BuildingKind> = (
  building: ServerBuilding<K>,
  dt: number,
) => void;

export type BuildingSystemMap = {
  [K in BuildingKind]: BuildingSystem<K>;
};

export type BuildingSystemMapOf<K extends BuildingKind> = BuildingSystemMap[K];

export const BuildingSystems: BuildingSystemMap = {
  natural_wall: NaturalWall,
  turret: Turret,
} as const;
