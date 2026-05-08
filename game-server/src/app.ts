import { createServer, WT_STOP_SENDING } from "@webtransport-bun/webtransport";
import * as fs from "node:fs";
import Session from "./Session";
import Player from "./Player";
import deltaBuilder from "./buildings/buildingDeltaBuilder";
import { players } from "./index";

// Dev certs server cert and private key
const certPem = fs.readFileSync("dev-server.crt", "utf-8");
const keyPem = fs.readFileSync("dev-server.key", "utf-8");

export const newPlayerSessions: Set<Session> = new Set();

const server = createServer({
  port: 4433,
  tls: { certPem, keyPem },
  onSession: async (session) => {
    console.log("Session connected:", session.id, session.peer, session);

    newPlayerSessions.add(new Session(session));
  },
});

console.log(`WebTransport endpoint: https://127.0.0.1:4433`);
