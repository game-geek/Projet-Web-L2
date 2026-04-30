const URL = "https://127.0.0.1:4433/wt";

// class that only handle webtransport packet communication
export default class WebTransportCommunication {
  private transport: null | WebTransport;
  public gameServerURL: null | string = null;
  public ready = false;
  constructor() {}

  public async connectToGameServer(gameServerUrl: string) {
    try {
      this.gameServerURL = gameServerUrl;
      this.ready = false;

      // Initialize transport connection
      this.transport = new WebTransport(gameServerUrl);

      // The connection can be used once ready fulfills
      await this.transport.ready;
      this.ready = true;

      return true;
    } catch (err) {
      this.transport = null;
      return `Error while trying to connect to ${this.gameServerURL}`;
    }
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
