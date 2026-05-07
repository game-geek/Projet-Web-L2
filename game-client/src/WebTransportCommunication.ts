import { ReadStream } from "../../game-server/src/Session";
const URL = "https://127.0.0.1:4433/wt";

// class that only handle webtransport packet communication
export default class WebTransportCommunication {
  private transport: null | WebTransport;
  public gameServerURL: null | string = null;
  public ready = false;
  private datagramWriter: null | WritableStreamDefaultWriter<any> = null;
  private streamWriter: null | WritableStreamDefaultWriter<any> = null;
  public incomingDatagrams: Set<any> = new Set();
  public incomingStreams: Set<any> = new Set();
  public readStream: any;
  constructor() {}

  public async connectToGameServer(
    gameServerUrl: string,
    userID: string,
    username: string,
  ) {
    try {
      this.gameServerURL = gameServerUrl;
      this.ready = false;

      // Initialize transport connection
      this.transport = new WebTransport(gameServerUrl);

      // The connection can be used once ready fulfills
      await this.transport.ready;
      this.ready = true;

      // setup the stream
      const stream = await this.transport.createBidirectionalStream();
      this.streamWriter = stream.writable.getWriter();
      const streamReader = stream.readable.getReader();
      this.readStream = new ReadStream(streamReader, this.onStreamPayload);

      // setup the datagram writer
      this.datagramWriter = this.transport.datagrams.writable.getWriter();

      // setup the datagram reader
      const datagramReader = this.transport.datagrams.readable.getReader();
      this.readDatagramloop(datagramReader);

      let e = async () => {
        await this.transport?.closed;
        this.transport = null;
        console.log("[webT] transport closed");
      };
      e();
      // authenticate
      return this.auth(userID, username);
    } catch (err) {
      this.transport = null;
      console.log(
        `[WebT] Error while trying to connect to ${this.gameServerURL}`,
      );
      return false;
    }
  }

  private async auth(userID: string, username: string) {
    return await this.writeStream({ userID, username });
  }

  private async readDatagramloop(reader: ReadableStreamDefaultReader<any>) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      try {
        const json = JSON.parse(new TextDecoder().decode(value));
        console.log("Server datagram:", json);
        this.incomingDatagrams.add(json);
      } catch (err) {
        console.log("Datagram from server is not JSON");
      }
      // this.writeDatagram({ t: json.tick, ack: json.tick });
    }
  }

  public async writeStream(stream: any) {
    if (!this.streamWriter) return false;
    try {
      const encoder = new TextEncoder();
      const buffer = new Uint8Array(65536);
      const result = encoder.encodeInto(
        JSON.stringify(stream),
        buffer.subarray(2),
      );
      const view = new DataView(buffer.buffer);
      view.setUint16(0, result.written, false);
      await this.streamWriter.write(buffer.subarray(0, 2 + result.written));
    } catch (err) {
      console.log("Error while trying to send stream", err);
      return false;
    }
  }

  private onStreamPayload = async (data: Uint8Array<ArrayBufferLike>) => {
    try {
      const json = JSON.parse(new TextDecoder().decode(data));
      this.incomingStreams.add(json);
      console.log("new stream payload: ", json);
    } catch (err) {
      console.log(
        "new stream payload: Invalid stream: must be JSON bytes",
        err,
      );
    }
  };
  public async writeDatagram(json: any) {
    if (!this.datagramWriter) return;

    const data = new TextEncoder().encode(JSON.stringify(json)); // Your JSON
    await this.datagramWriter.write(data); // One atomic datagram!
  }

  public async closeConnection() {
    if (this.transport == null)
      throw new Error(
        "Failed to close connection bc connection is alwready closed",
      );
    // Respond to connection closing

    try {
      await this.transport.closed;
      console.log(`The HTTP/3 connection closed gracefully.`);
    } catch (error) {
      console.error(`The HTTP/3 connection closed due to ${error}.`);
    }
  }
}
