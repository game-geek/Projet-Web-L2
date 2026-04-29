import { createServer } from "@webtransport-bun/webtransport";
import * as fs from "node:fs";

// Dev certs server cert and private key
const certPem = fs.readFileSync("dev-server.crt", "utf-8");
const keyPem = fs.readFileSync("dev-server.key", "utf-8");

const server = createServer({
  port: 4433,
  tls: { certPem, keyPem },
  onSession: (session) => {
    console.log("Session connected:", session.id, session.peer, session);
  },
});

console.log("Server listening on port", server.address.port);
// server.close() when shutting down
