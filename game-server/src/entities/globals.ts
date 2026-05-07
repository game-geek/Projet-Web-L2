import Bullet from "./Bullet";
import Eliptae from "./Eliptae";
import { EntityDef, EntityKind, ServerEntity } from "./entities";
import Miner from "./Miner";

// the default data related to those buildings
export const EntityDefs = {
  eliptae: {
    shared: { maxHp: 120, killable: true, w: 30, h: 30 },
    server: {
      initState: () => ({
        path: [],
        isShooting: 0,
        target: null,
        speed: 5,
        area: 100,
      }),
    },
    client: {
      textures: {
        top: "assets/eliptae_32.png",
      },
      components: ["Render"] as const,
    },
  },
  bullet: {
    shared: { maxHp: 100, killable: true, w: 4, h: 14 },
    server: {
      initState: () => ({
        target: null,
        damage: 15,
        speed: 15,
      }),
    },
    client: {
      textures: {
        top: "bullet_top",
      },
      components: ["Render"] as const,
    },
  },
  miner: {
    shared: { maxHp: 100, killable: true, w: 30, h: 30 },
    server: {
      initState: () => ({
        mining: false,
        miningSpeed: 50,
        path: [],
        target: null,
      }),
    },
    client: {
      textures: {
        top: "miner_top",
      },
      components: ["Render"] as const,
    },
  },
} as const;

export const EntityKinds = Object.keys(
  EntityDefs,
) as (keyof typeof EntityDefs)[];

type EntitySystem<K extends EntityKind> = (
  entity: ServerEntity<K>,
  dt: number,
) => void;

export type EntitySystemMap = {
  [K in EntityKind]: EntitySystem<K>;
};

export type EntitySystemMapOf<K extends EntityKind> = EntitySystemMap[K];

export const EntitySystems: EntitySystemMap = {
  eliptae: Eliptae,
  miner: Miner,
  bullet: Bullet,
} as const;
