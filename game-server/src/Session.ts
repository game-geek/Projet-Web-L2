import { ServerSession } from "@webtransport-bun/webtransport";
import * as z from "zod";

export default class Session {
  private readStreamManager: ReadStream | undefined;
  public incomingDatagrams: Set<any> = new Set();
  public incomingStreams: Set<any> = new Set();
  private stream:
    | WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>>
    | undefined;

  constructor(private session: ServerSession) {
    // collect irt incoming diagrams
    void (async () => {
      try {
        for await (const datagram of session.incomingDatagrams()) {
          this.newDatagramPaylodad(datagram);
        }
      } catch (err) {
        console.warn("[server] datagram loop error:", err);
      }
    })();

    // collect incoming stream -> packets
    const bidiStreamReader = session.incomingBidirectionalStreams.getReader();

    (async () => {
      const { done, value: duplex } = await bidiStreamReader.read(); // Wait for client start of stream
      if (done) return;
      this.stream = duplex.writable.getWriter();

      const dataReader = duplex.readable.getReader();

      this.readStreamManager = new ReadStream(
        dataReader,
        this.newStreamPayload,
      );
    })();
  }

  async newStreamPayload(stream: Uint8Array<ArrayBufferLike>) {
    try {
      const json = JSON.parse(new TextDecoder().decode(stream));
      console.log(this.incomingStreams);
      this.incomingStreams.add(json);
      console.log("new stream payload: ", json);
    } catch (err) {
      console.log("new stream payload: Invalid stream: must be JSON bytes");
    }
  }

  async newDatagramPaylodad(datagram: Uint8Array<ArrayBufferLike>) {
    try {
      const json = JSON.parse(new TextDecoder().decode(datagram));
      this.incomingDatagrams.add(json);
      console.log("new datagram payload: ");
    } catch (err) {
      console.log("new datagram payload: Invalid datagram: must be JSON", err);
    }
  }

  async disconnection() {}

  async sendDatagramJSON(snapshot: any) {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
      console.log("size", bytes);
      await this.session.sendDatagram(bytes);
    } catch (err) {
      console.log("Error while trying to send datagram", err);
    }
  }

  async sendStreamJSON(snapshot: any) {
    if (!this.stream) return console.log("There is no writable stream...");
    console.log("sending stream to client");
    try {
      const encoder = new TextEncoder();
      const buffer = new Uint8Array(65536);
      const result = encoder.encodeInto(
        JSON.stringify(snapshot),
        buffer.subarray(2),
      );
      const view = new DataView(buffer.buffer);
      view.setUint16(0, result.written, false);
      console.log("sending stream of length", result.written);
      await this.stream.write(buffer.subarray(0, 2 + result.written));
    } catch (err) {
      console.log("Error while trying to send stream", err);
    }
  }
}

export class ReadStream {
  private newPacket = true;
  private messageLength = 0;
  private readonly buffer = new Uint8Array(65536); // Pre-allocate max size
  private packetLength = new Uint8Array(2);
  private packetlengthAt = 0;
  private writePos = 0;
  private chunkAt = 0;

  constructor(
    dataReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
    public payloadCallback: (a: Uint8Array<ArrayBufferLike>) => void,
  ) {
    this.start(dataReader);
  }

  private readStreamPayloadLength(chunk: Uint8Array<ArrayBufferLike>) {
    return (chunk[0] << 8) | chunk[1];
  }
  private async start(
    dataReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
  ) {
    while (true) {
      const { done, value: chunk } = await dataReader.read(); // New bytes!
      if (done) break;
      this.chunkAt = 0;
      while (this.chunkAt < chunk.length) {
        if (this.newPacket) {
          if (this.packetlengthAt == 0) {
            if (this.chunkAt + 1 < chunk.length) {
              // fine
              this.newPacket = false;
              this.packetLength[0] = chunk[this.chunkAt];
              this.packetLength[1] = chunk[this.chunkAt + 1];
              this.messageLength = this.readStreamPayloadLength(
                this.packetLength,
              );
              this.chunkAt += 2;
            } else {
              this.packetLength[0] = chunk[this.chunkAt];
              this.chunkAt += 1;
              this.packetlengthAt = 1;
            }
          } else if (this.packetlengthAt == 1) {
            // fine
            this.packetLength[1] = chunk[this.chunkAt];
            this.newPacket = false;
            this.messageLength = this.readStreamPayloadLength(
              this.packetLength,
            );
            this.packetlengthAt = 0;
            this.chunkAt == 1;
          } else {
            console.log("impossible case 2");
          }
        } else {
          if (
            chunk.length - this.chunkAt <
            this.messageLength - this.writePos
          ) {
            // bytes left to read in chunk
            this.buffer.set(
              chunk.subarray(this.chunkAt, chunk.length),
              this.writePos,
            );
            this.writePos += chunk.length - this.chunkAt;
            this.chunkAt = chunk.length;
          } else {
            this.buffer.set(
              chunk.subarray(
                this.chunkAt,
                this.chunkAt + (this.messageLength - this.writePos),
              ),
              this.writePos,
            );
            this.chunkAt += this.messageLength - this.writePos;
            this.writePos += this.messageLength - this.writePos;
          }

          console.log(
            "stream data " +
              this.writePos +
              "/" +
              this.messageLength.toString(),
          );
        }

        // Check if message is finished
        if (this.writePos > this.messageLength) {
          console.log(
            "Protocol not respected, message is too long, it does not correspond to the said length",
            "writepos: ",
            this.writePos,
            "messsage length: ",
            this.messageLength,
          );
          break;
        }
        if (this.writePos == this.messageLength) {
          this.newPacket = true;
          this.writePos = 0;

          this.payloadCallback(this.buffer.subarray(0, this.messageLength));
        }
      }
    }
  }
}
