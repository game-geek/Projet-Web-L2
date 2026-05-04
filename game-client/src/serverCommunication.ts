// higher level server communication for packet parsing, ticksIDs, deltas, snapshots, auth, ...

import {
  AnyBuildingSnapshot,
  BuildingSnapshot,
} from "../../game-server/src/buildings/buildings";
import { BuildingVariantsMap } from "../../game-server/src/buildings/globals";
import webTransportCommunication from "./WebTransportCommunication";
import * as z from "zod";

const IncomingDatagramSchema = z.object({
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
        destroyed: z.boolean().optional(),
        customState: z.record(z.string(), z.any()).optional(),
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
        destroyed: z.boolean().optional(),
        customState: z.record(z.string(), z.any()).optional(),
      }),
    )
    .optional(),
});
type IncomingDatagramSchemaType = z.input<typeof IncomingDatagramSchema>;

const IncomingStreamSchema = z.object({
  t: z.number(),
  a: z.any().optional(),
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
        destroyed: z.boolean(),
        customState: z.record(z.string(), z.any()),
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
        destroyed: z.boolean(),
        customState: z.record(z.string(), z.any()),
      }),
    )
    .optional(),
});
type IncomingStreamSchemaType = z.input<typeof IncomingStreamSchema>;

export default class serverCommunication {
  // Create new low-level web transport connection
  private webT = new webTransportCommunication();
  public connected = false;
  public gameServerURl: null | string = null;
  public latestDatagram: IncomingDatagramSchemaType | null = null;
  public latestBuildingSnapshot: {
    t: number;
    bd: IncomingStreamSchemaType["bs"];
  } | null = null;
  public latestEntitySnapshot: {
    t: number;
    ed: IncomingStreamSchemaType["es"];
  } | null = null;
  public latestActions: Set<any> = new Set();

  async initConnection(gameServerURL: string) {
    const response = await this.webT.connectToGameServer(gameServerURL);
    if (response !== true)
      throw new Error("Could not connect to game: " + response);
    this.connected = true;
    this.gameServerURl = gameServerURL;
  }

  parseDatagrams() {
    const parsedDatagrams: IncomingDatagramSchemaType[] = [];
    for (const datagram of this.webT.incomingDatagrams) {
      try {
        parsedDatagrams.push(IncomingDatagramSchema.parse(datagram));
      } catch (err) {
        console.log("Error while trying to parse datagram", err);
      }
      this.webT.incomingDatagrams.delete(datagram);
    }

    // select the datagram with the greatest
    if (parsedDatagrams.length == 0) return;
    let latestDatagramIndex = 0;
    parsedDatagrams.forEach((dg, i) =>
      dg.t > parsedDatagrams[latestDatagramIndex].t ? i : null,
    );
    this.latestDatagram = parsedDatagrams[latestDatagramIndex];
  }

  parseStreams() {
    const parsedStreams: IncomingStreamSchemaType[] = [];
    for (const stream of this.webT.incomingStreams) {
      try {
        parsedStreams.push(IncomingStreamSchema.parse(stream));
      } catch (err) {
        console.log("Error while trying to parse stream");
      }
      this.webT.incomingStreams.delete(stream);
    }

    // select the latest snapshot, and the rest
    if (parsedStreams.length == 0) return;
    let latestBI = -1;
    let latestEI = -1;
    parsedStreams.forEach((stream, i) => {
      if (stream.bs) {
        if (latestBI >= 0) {
          if (stream.t > parsedStreams[latestBI].t) latestBI = i;
        } else latestBI = i;
      }
      if (stream.es) {
        if (latestEI >= 0) {
          if (stream.t > parsedStreams[latestEI].t) latestEI = i;
        } else latestEI = i;
      }
      if (stream.a) {
        this.latestActions.add({ t: stream.t, a: stream.a });
      }
    });

    if (latestBI >= 0) {
      this.latestBuildingSnapshot = {
        t: parsedStreams[latestBI].t,
        bd: parsedStreams[latestBI].bs,
      };
    }
    if (latestEI >= 0) {
      this.latestEntitySnapshot = {
        t: parsedStreams[latestBI].t,
        ed: parsedStreams[latestBI].es,
      };
    }
  }

  sendDatagram(datagram: any) {
    if (datagram) this.webT.writeDatagram(datagram);
  }
  sendStream(stream: any) {
    if (stream) this.webT.writeStream(stream);
  }
}
