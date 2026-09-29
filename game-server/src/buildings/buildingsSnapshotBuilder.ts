
//import { ServerStreamtype } from "../../../game-client/src/serverCommunication";
import Player from "../Player";
import {
  AnyServerBuilding,
  BuildingSnapshotFields,
  DirtyBuildingChunkType,
} from "./buildings";
import * as z from "zod"


// this folowing code comes FROM THE CLIENT DUPLICATE

export const IncomingStreamSchema = z.object({
  t: z.number(),
  ed: z
    .record(
      z.string(),
      z.object({
        kind: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        w: z.number().optional(),
        h: z.number().optional(),
        maxHp: z.number().optional(),
        hp: z.number().optional(),
        destroyed: z.boolean().optional(),
        customState: z.record(z.string(), z.any()).optional(),

        ownerID: z.number().optional(),
      }),
    )
    .optional(),
  bd: z
    .record(
      z.string(),
      z.object({
        kind: z.string().optional(),
        variant: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        w: z.number().optional(),
        h: z.number().optional(),
        maxHp: z.number().optional(),
        hp: z.number().optional(),
        destroyed: z.boolean().optional(),
        customState: z.record(z.string(), z.any()).optional(),
        ownerID: z.number().optional(),
      }),
    )
    .optional(),
  a: z
    .object({
      bM: z
        .array(
          z.object({
            bM: z.array(z.number()),
            t: z.number(),
          }),
        )
        .optional(),
      c: z.number().optional(),
      nE: z
        .record(
          z.string(),
          z.object({
            kind: z.string(),
            x: z.number(),
            y: z.number(),
            w: z.number(),
            h: z.number(),
            maxHp: z.number(),
            hp: z.number(),
            destroyed: z.boolean(),
            customState: z.record(z.string(), z.any()),
            ownerID: z.number(),
          }),
        )
        .optional(),
      nB: z
        .record(
          z.string(),
          z.object({
            kind: z.string(),
            variant: z.string(),
            x: z.number(),
            y: z.number(),
            w: z.number(),
            h: z.number(),
            maxHp: z.number(),
            hp: z.number(),
            destroyed: z.boolean(),
            customState: z.record(z.string(), z.any()),
            ownerID: z.number(),
          }),
        )
        .optional(),
      rB: z.array(z.number()).optional(),
      rE: z.array(z.number()).optional(),
      gs: z
        .object({
          gs: z.boolean(),
          ge: z.boolean(),
          w: z.number().optional(),
          ps: z.record(
            z.string(),
            z.object({
              username: z.string(),
              connected: z.boolean(),
              ready: z.boolean(),
              color: z.string(),
              ownerID: z.number(),
              spawn: z.object({ x: z.number(), y: z.number() }),
            }),
          ),
        })
        .optional(),
    })
    .optional(),
  es: z
    .record(
      z.string(),
      z.object({
        kind: z.string(),
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        maxHp: z.number(),
        hp: z.number(),
        destroyed: z.boolean(),
        customState: z.record(z.string(), z.any()),
        ownerID: z.number(),
      }),
    )
    .optional(),
  bs: z
    .record(
      z.string(),
      z.object({
        kind: z.string(),
        variant: z.string(),
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        maxHp: z.number(),
        hp: z.number(),
        destroyed: z.boolean(),
        customState: z.record(z.string(), z.any()),
        ownerID: z.number(),
      }),
    )
    .optional(),
});
export type ServerStreamtype = z.input<typeof IncomingStreamSchema>;

export default class buildingsSnapshotBuilder {
  public snapshot: ServerStreamtype["bs"] = {};
  constructor(
    public player: Player,
    public buildings: (AnyServerBuilding | null)[][],
    public chunks: [number, number][],
  ) {}

  createSnapshot() {
    this.snapshot = {};
    for (
      let y = this.player.ViewArea.y;
      y < this.player.ViewArea.y + this.player.ViewArea.height;
      y++
    ) {
      for (
        let x = this.player.ViewArea.x;
        x < this.player.ViewArea.x + this.player.ViewArea.width;
        x++
      ) {
        const b = this.buildings[y][x];
        if (b == null) continue;
        // @ts-ignore
        this.snapshot[b.id] = {};
        for (const field of BuildingSnapshotFields) {
          if (field == "id") continue;
          if (field == "customState")
            this.snapshot[b.id][field] = structuredClone(b[field]);
          //@ts-ignore
          else this.snapshot[b.id][field] = b[field];
        }
      }
    }
  }
}
