import { ServerSession } from "@webtransport-bun/webtransport";
import { AnyBuildingSnapshot } from "./buildings/buildings";
import deltaBuilder from "./DeltaBuilder";
import Player from "./Player";

export default class Session {
  private readStreamManager: ReadStream | undefined;
  public latestDatagrams = null;
  public incomingStreams = new Set();
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
      this.incomingStreams.add(json);
      console.log("new datagram payload: ", json);
    } catch (err) {
      console.log("new datagram payload: Invalid datagram: must be JSON");
    }
  }

  async newDatagramPaylodad(datagram: Uint8Array<ArrayBufferLike>) {
    try {
      this.latestDatagrams = JSON.parse(new TextDecoder().decode(datagram));
      console.log("new datagram payload: ", this.latestDatagrams);
    } catch (err) {
      console.log("new datagram payload: Invalid datagram: must be JSON");
    }
  }

  async disconnection() {}

  async sendDatagramJSON(snapshot: {
    [id: number]: Partial<AnyBuildingSnapshot>;
  }) {
    console.log(snapshot);
    await this.session.sendDatagram(
      new TextEncoder().encode(JSON.stringify(snapshot)),
    );
  }

  async sendStreamJSON(snapshot: { [id: number]: AnyBuildingSnapshot }) {
    if (!this.stream) return console.log("There is no writable stream...");
    console.log(snapshot);

    await this.stream.write(new TextEncoder().encode(JSON.stringify(snapshot)));
  }
}

class ReadStream {
  private firstPacket = true;
  private messageLength = 0;
  private readonly buffer = new Uint8Array(65536); // Pre-allocate max size
  private writePos = 0;

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

      if (this.firstPacket) {
        this.firstPacket = false;
        this.messageLength = this.readStreamPayloadLength(chunk);
        if (this.messageLength < 2) {
          console.log(
            "Protocol not respected, the initial chunk of the message must have the two first bytes set to the length of the message",
          );
          break;
        }

        this.buffer.set(chunk.subarray(2), this.writePos);
        this.writePos += chunk.length - 2;

        console.log(
          "new stream data " +
            this.writePos +
            "/" +
            this.messageLength.toString(),
        );
      } else {
        this.buffer.set(chunk, this.writePos);
        this.writePos += chunk.length;

        console.log(
          "stream data " + this.writePos + "/" + this.messageLength.toString(),
        );
      }

      // Check if message is finished
      if (this.writePos > this.messageLength) {
        console.log(
          "Protocol not respected, message is too long, it does not correspond to the said length",
        );
        break;
      }
      if (this.writePos == this.messageLength) {
        this.firstPacket = true;
        this.writePos = 0;

        this.payloadCallback(this.buffer.subarray(0, this.messageLength));
      }
    }
  }
}
