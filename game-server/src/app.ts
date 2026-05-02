import { createServer, WT_STOP_SENDING } from "@webtransport-bun/webtransport";
import * as fs from "node:fs";
import Session from "./Session";
import Player from "./Player";
import deltaBuilder from "./DeltaBuilder";
import { players } from "./index";

// Dev certs server cert and private key
const certPem = fs.readFileSync("dev-server.crt", "utf-8");
const keyPem = fs.readFileSync("dev-server.key", "utf-8");

export const playerSessions: Map<string, Session> = new Map();

const server = createServer({
  port: 4433,
  tls: { certPem, keyPem },
  onSession: async (session) => {
    console.log("Session connected:", session.id, session.peer, session);

    playerSessions.set(session.id, new Session(session));

    void session.closed.then(async () => {
      console.log("session removed");
      playerSessions.get(session.id)?.disconnection();
      playerSessions.delete(session.id);
    });
  },
});
