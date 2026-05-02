import { EntityDef, EntityKind, ServerEntity } from "./entities";

// the default data related to those buildings
export const EntityDefs = {
  eliptae: {
    shared: { maxHp: 100, killable: true, w: 1, h: 1 },
    server: {
      initState: () => ({
        lightning: 10,
        charge: 0,
        targetId: null as number | null,
      }),
    },
    client: {
      textures: {
        top: "eliptae_top",
        left: "eliptae_left",
        right: "eliptae_right",
        bottom: "eliptae_bottom",
      },
      components: ["renderable", "health"] as const,
    },
  },
} as const;

type EntitySystem<K extends EntityKind> = (
  entity: ServerEntity<K>,
  dt: number,
) => void;

export type EntitySystemMap = {
  [K in EntityKind]: EntitySystem<K>;
};

export type EntitySystemMapOf<K extends EntityKind> = EntitySystemMap[K];

export const EntitySystems: EntitySystemMap = {
  eliptae: (e, dt) => {},
} as const;
