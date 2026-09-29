// src/app.ts
import { createServer } from "@webtransport-bun/webtransport";
import * as fs from "fs";

// src/Session.ts
import * as z from "zod";
var IncomingAuthStream = z.object({
  userID: z.string(),
  username: z.string()
});
var Session = class {
  constructor(session) {
    this.session = session;
    this.incomingDatagrams = /* @__PURE__ */ new Set();
    this.incomingStreams = /* @__PURE__ */ new Set();
    this.userID = null;
    this.username = null;
    this.closed = false;
    session.closed.then((e) => {
      this.closed = true;
      console.warn("[session] session closed", e.code, e.reason);
    }).catch((err) => {
      console.log("error", err);
    });
    void (async () => {
      try {
        for await (const datagram of session.incomingDatagrams()) {
          this.newDatagramPaylodad(datagram);
        }
      } catch (err) {
        this.session.close({
          reason: "datagram loop error",
          code: 100
        });
        console.warn("[session] datagram loop error:", err);
      }
    })();
    const bidiStreamReader = session.incomingBidirectionalStreams.getReader();
    (async () => {
      try {
        const { done, value: duplex } = await bidiStreamReader.read();
        if (done) return;
        this.stream = duplex.writable.getWriter();
        const dataReader = duplex.readable.getReader();
        this.readStreamManager = new ReadStream(
          dataReader,
          this.newStreamPayload,
          this
        );
      } catch (err) {
        this.session.close({
          reason: "streams setup/loop error",
          code: 101
        });
        console.warn("[session] streams setup/loop error:", err);
      }
    })();
  }
  async newStreamPayload(stream, session = null) {
    if (!session)
      return console.log(
        "[session] fatal JS referencing error in newStreamPlayload"
      );
    try {
      const json = JSON.parse(new TextDecoder().decode(stream));
      if (session.userID) {
        session.incomingStreams.add(json);
      } else session.auth(json);
    } catch (err) {
      console.log(
        "new stream payload: Invalid stream: must be JSON bytes",
        err
      );
    }
  }
  auth(data) {
    try {
      const msg = IncomingAuthStream.parse(data);
      this.userID = msg.userID;
      this.username = msg.username;
      console.log("user authenticated");
    } catch (err) {
      console.log("invalid request from client", err);
    }
  }
  async newDatagramPaylodad(datagram) {
    try {
      const json = JSON.parse(new TextDecoder().decode(datagram));
      if (this.userID) {
        this.incomingDatagrams.add(json);
      }
    } catch (err) {
      console.log("new datagram payload: Invalid datagram: must be JSON", err);
    }
  }
  async disconnection() {
    console.log("[session] closing on demand");
    this.session.close();
  }
  async sendDatagramJSON(snapshot) {
    if (this.closed)
      return console.log("[session] can't send datagram because it's closed");
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
      if (bytes.length > 1200) {
        await this.sendStreamJSON(snapshot);
      } else await this.session.sendDatagram(bytes);
    } catch (err) {
      console.log("Error while trying to send datagram", err);
    }
  }
  async sendStreamJSON(snapshot) {
    if (!this.stream) return console.log("There is no writable stream...");
    if (this.closed)
      return console.log("[session] can't send stream because it's closed");
    try {
      const encoder = new TextEncoder();
      const buffer = new Uint8Array(65536);
      const result = encoder.encodeInto(
        JSON.stringify(snapshot),
        buffer.subarray(2)
      );
      const view = new DataView(buffer.buffer);
      view.setUint16(0, result.written, false);
      await this.stream.write(buffer.subarray(0, 2 + result.written));
    } catch (err) {
      console.log("Error while trying to send stream", err);
    }
  }
};
var ReadStream = class {
  constructor(dataReader, payloadCallback, session = null) {
    this.payloadCallback = payloadCallback;
    this.session = session;
    this.newPacket = true;
    this.messageLength = 0;
    this.buffer = new Uint8Array(65536);
    // Pre-allocate max size
    this.packetLength = new Uint8Array(2);
    this.packetlengthAt = 0;
    this.writePos = 0;
    this.chunkAt = 0;
    this.start(dataReader);
  }
  readStreamPayloadLength(chunk) {
    return chunk[0] << 8 | chunk[1];
  }
  async start(dataReader) {
    try {
      while (true) {
        const { done, value: chunk } = await dataReader.read();
        if (done) break;
        this.chunkAt = 0;
        while (this.chunkAt < chunk.length) {
          if (this.newPacket) {
            if (this.packetlengthAt == 0) {
              if (this.chunkAt + 1 < chunk.length) {
                this.newPacket = false;
                this.packetLength[0] = chunk[this.chunkAt];
                this.packetLength[1] = chunk[this.chunkAt + 1];
                this.messageLength = this.readStreamPayloadLength(
                  this.packetLength
                );
                this.chunkAt += 2;
              } else {
                this.packetLength[0] = chunk[this.chunkAt];
                this.chunkAt += 1;
                this.packetlengthAt = 1;
              }
            } else if (this.packetlengthAt == 1) {
              this.packetLength[1] = chunk[this.chunkAt];
              this.newPacket = false;
              this.messageLength = this.readStreamPayloadLength(
                this.packetLength
              );
              this.packetlengthAt = 0;
              this.chunkAt == 1;
            } else {
              console.log("impossible case 2");
            }
          } else {
            if (chunk.length - this.chunkAt < this.messageLength - this.writePos) {
              this.buffer.set(
                chunk.subarray(this.chunkAt, chunk.length),
                this.writePos
              );
              this.writePos += chunk.length - this.chunkAt;
              this.chunkAt = chunk.length;
            } else {
              this.buffer.set(
                chunk.subarray(
                  this.chunkAt,
                  this.chunkAt + (this.messageLength - this.writePos)
                ),
                this.writePos
              );
              this.chunkAt += this.messageLength - this.writePos;
              this.writePos += this.messageLength - this.writePos;
            }
          }
          if (this.writePos > this.messageLength) {
            break;
          }
          if (this.writePos == this.messageLength) {
            this.newPacket = true;
            this.writePos = 0;
            this.payloadCallback(
              this.buffer.subarray(0, this.messageLength),
              this.session
            );
          }
        }
      }
    } catch (err) {
      console.log("Webtransport connection closed");
      if (this.session) this.session.closed = true;
      this.session?.session.close();
    }
  }
};

// src/app.ts
var certPem = fs.readFileSync("src/certs/dev-server.crt", "utf-8");
var keyPem = fs.readFileSync("src/certs/dev-server.key", "utf-8");
var newPlayerSessions = /* @__PURE__ */ new Set();
var server = createServer({
  port: 4433,
  tls: { certPem, keyPem },
  onSession: async (session) => {
    console.log("Session connected:", session.id, session.peer, session);
    newPlayerSessions.add(new Session(session));
  }
});
console.log(`WebTransport endpoint: https://127.0.0.1:4433`);
export {
  newPlayerSessions
};
