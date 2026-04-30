export type DeltaField = "hp" | "destroyed" | "customState.repairProgress";

// "hp" | "maxHp"
class Health {
  displayHp: number;
  targetHp: number;
  tweenSpeed = 8;
  static readonly watchFields = ["hp"] as const satisfies readonly DeltaField[];

  constructor(initialHp: number) {
    this.displayHp = initialHp;
    this.targetHp = initialHp;
  }

  onDelta(delta: Partial<Record<DeltaField, any>>) {
    // needs to be changed for typesafety
    if (delta.hp !== undefined) this.targetHp = delta.hp;
  }
}
type ComponentFields<C> = C extends { watchFields: readonly (infer F)[] }
  ? F
  : never;

type AllFields = ComponentFields<typeof Health>;
